"""Document ingestion, chunking, embedding, retrieval, and Gemini answer generation utilities.

Supabase migration (run once if metadata column does not exist):
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;
"""

import os
import logging
import fitz  # PyMuPDF
import json
import spacy
import google.generativeai as genai
from supabase import create_client, Client
import streamlit as st
from sentence_transformers import SentenceTransformer, CrossEncoder
import numpy as np
import requests

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.5-flash"
API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)
logger = logging.getLogger(__name__)

# Initialize Sentence Transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')
cross_encoder_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None


def rewrite_query(query, conversation_history):
    """Rewrite a query to be self-contained using recent conversation history via Gemini SDK.

    Returns the original query unchanged if rewriting fails for any reason.
    """
    if not query:
        return query

    trimmed_history = (conversation_history or [])[-4:]
    history_text = "\n".join(
        [f"{item.get('role', 'user')}: {item.get('content', '')}" for item in trimmed_history]
    ) or "No conversation history provided."

    try:
        if not GEMINI_API_KEY:
            return query

        genai.configure(api_key=GEMINI_API_KEY)
        rewriter_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=(
                "You are a query rewriter. Given a conversation history and a new "
                "question, rewrite the question to be fully self-contained and "
                "specific. Replace all pronouns with their referents. Return ONLY "
                "the rewritten question, nothing else."
            ),
        )

        response = rewriter_model.generate_content(
            f"Conversation history:\n{history_text}\n\nNew question:\n{query}"
        )
        rewritten = (getattr(response, "text", "") or "").strip()
        return rewritten if rewritten else query
    except Exception:
        return query


def retrieve_and_rerank(query, project, supabase_client):
    """Rewrite query, retrieve cosine candidates, rerank with cross-encoder, and return top rows.

    Returns a list of dicts with keys: content, initial_score, rerank_score.
    """
    retrieval_top_k = int(os.getenv("RETRIEVAL_TOP_K", "20"))
    rerank_top_n = int(os.getenv("RERANK_TOP_N", "5"))

    # Keep rerank list bounded by available initial candidates.
    retrieval_top_k = max(1, retrieval_top_k)
    rerank_top_n = max(1, min(rerank_top_n, retrieval_top_k))

    response = supabase_client.table("messages") \
        .select("role, content, embedding") \
        .eq("project", project) \
        .execute()

    messages = response.data or []
    if not messages:
        return []

    history_response = supabase_client.table("messages") \
        .select("role, content, timestamp") \
        .eq("project", project) \
        .order("timestamp", desc=True) \
        .limit(20) \
        .execute()

    history_rows = history_response.data or []
    conversation_history = [
        {"role": row.get("role", "user"), "content": row.get("content", "")}
        for row in history_rows
        if row.get("role") in ("user", "assistant") and row.get("content")
    ]
    conversation_history = list(reversed(conversation_history[:4]))

    rewritten_query = rewrite_query(query, conversation_history)
    logging.debug("Query rewrite - original: %s | rewritten: %s", query, rewritten_query)

    query_embedding = model.encode([rewritten_query])[0]

    cosine_candidates = []
    for msg in messages:
        if msg.get("role") != "document" or msg.get("embedding") is None:
            continue

        embedding = np.array(msg["embedding"], dtype=float)
        if embedding.size == 0:
            continue

        denominator = np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
        if denominator == 0:
            continue

        similarity = float(np.dot(query_embedding, embedding) / denominator)
        cosine_candidates.append({
            "content": msg.get("content", ""),
            "initial_score": similarity,
        })

    if not cosine_candidates:
        return []

    cosine_candidates.sort(key=lambda x: x["initial_score"], reverse=True)
    initial_top = cosine_candidates[:retrieval_top_k]

    pair_inputs = [[rewritten_query, candidate["content"]] for candidate in initial_top]
    rerank_scores = cross_encoder_model.predict(pair_inputs)

    reranked = []
    for candidate, rerank_score in zip(initial_top, rerank_scores):
        reranked.append({
            "content": candidate["content"],
            "initial_score": candidate["initial_score"],
            "rerank_score": float(rerank_score),
        })

    reranked.sort(key=lambda x: x["rerank_score"], reverse=True)
    return reranked[:rerank_top_n]

def process_document(file, file_type):
    """Parse an uploaded file and return sentence-aware chunk payloads with metadata."""
    if nlp is None:
        st.error("spaCy model 'en_core_web_sm' is missing. Run: python -m spacy download en_core_web_sm")
        return []

    if file_type == "pdf":
        content = extract_text_from_pdf(file)
    else:
        try:
            content = file.read().decode("utf-8")
        except UnicodeDecodeError:
            try:
                content = file.read().decode("latin1")
            except UnicodeDecodeError as e:
                st.error("Could not decode the uploaded file. Please use a UTF-8 text file, PDF, or DOCX.")
                return []

    if not content or not content.strip():
        st.warning("The uploaded file appears to be empty or unreadable.")
        return []

    sentence_chunks = chunk_text_by_sentences(content, target_words=400, overlap_ratio=0.12)
    if not sentence_chunks:
        return []

    filename = getattr(file, "name", "uploaded_file")
    total_chunks = len(sentence_chunks)

    chunk_payloads = []
    for idx, chunk_text in enumerate(sentence_chunks):
        chunk_payloads.append({
            "content": chunk_text,
            "metadata": {
                "filename": filename,
                "chunk_index": idx,
                "total_chunks": total_chunks,
            },
        })

    return chunk_payloads


def chunk_text_by_sentences(text, target_words=400, overlap_ratio=0.12):
    """Split text on sentence boundaries, target ~400 words, with 10-15% sentence overlap."""
    doc = nlp(text)
    sentences = [sent.text.strip() for sent in doc.sents if sent.text and sent.text.strip()]
    if not sentences:
        return []

    chunks = []
    start_idx = 0
    overlap_word_target = max(1, int(target_words * overlap_ratio))

    while start_idx < len(sentences):
        current_sentences = []
        current_word_count = 0
        end_idx = start_idx

        while end_idx < len(sentences):
            sentence = sentences[end_idx]
            sentence_words = len(sentence.split())
            if current_sentences and current_word_count >= target_words:
                break

            current_sentences.append(sentence)
            current_word_count += sentence_words
            end_idx += 1

        if not current_sentences:
            break

        chunks.append(" ".join(current_sentences))

        if end_idx >= len(sentences):
            break

        # Carry 1-2 trailing sentences into the next chunk, near 10-15% overlap.
        overlap_count = 0
        overlap_words = 0
        for sentence in reversed(current_sentences):
            if overlap_count >= 2:
                break
            overlap_words += len(sentence.split())
            overlap_count += 1
            if overlap_words >= overlap_word_target and overlap_count >= 1:
                break

        if len(current_sentences) == 1:
            overlap_count = 0
        else:
            overlap_count = min(overlap_count, len(current_sentences) - 1)

        start_idx = end_idx - overlap_count

    return chunks

def extract_text_from_pdf(file):
    """Extract and concatenate text from all pages in an uploaded PDF."""
    doc = fitz.open(stream=file.read(), filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def generate_embeddings(chunk_payloads):
    """Generate vector embeddings for chunk payload content in original order."""
    texts = [chunk_payload["content"] for chunk_payload in chunk_payloads]
    embeddings = model.encode(texts)
    return embeddings

def save_chunks_to_supabase(chunk_payloads, embeddings, project_name):
    """Persist chunk content, embedding, and metadata for a project in Supabase."""
    try:
        for chunk_payload, embedding in zip(chunk_payloads, embeddings):
            supabase.table("messages").insert([{
                "project": project_name,
                "role": "document",
                "content": chunk_payload["content"],
                "embedding": embedding.tolist(),
                "metadata": chunk_payload["metadata"],
            }]).execute()
        return True
    except Exception as e:
        st.error("Failed to save document chunks to Supabase. Please verify DB credentials and table permissions.")
        return False

def upload_document():
    """Render sidebar uploader, process selected file, and store chunks+embeddings."""
    if "upload_uploader_version" not in st.session_state:
        st.session_state["upload_uploader_version"] = 0

    if "upload_notice" in st.session_state:
        st.sidebar.success(st.session_state.pop("upload_notice"))

    uploader_key = f"upload_file_{st.session_state.get('current_project', 'none')}_{st.session_state['upload_uploader_version']}"
    uploaded_file = st.sidebar.file_uploader("Upload Document", type=["txt", "pdf", "docx"], key=uploader_key)

    if uploaded_file and st.session_state["current_project"]:
        with st.sidebar:
            with st.spinner("Processing document..."):
                file_type = uploaded_file.name.split(".")[-1]
                chunk_payloads = process_document(uploaded_file, file_type)
                if chunk_payloads:
                    embeddings = generate_embeddings(chunk_payloads)
                    if save_chunks_to_supabase(chunk_payloads, embeddings, st.session_state["current_project"]):
                        st.session_state["upload_notice"] = "Document uploaded and processed successfully."
                        st.session_state["upload_uploader_version"] += 1
                        st.rerun()
                else:
                    st.sidebar.error("Document upload failed. Please check file format/content and try again.")

def retrieve_relevant_chunks(question, project_name):
    """Retrieve reranked document chunk text for downstream answer generation."""
    try:
        reranked_rows = retrieve_and_rerank(question, project_name, supabase)
        return [row["content"] for row in reranked_rows]
    except Exception as e:
        st.error("Could not retrieve relevant document chunks. Please verify document embeddings and database state.")
        return []

def generate_answer(question, relevant_chunks, recent_messages=None):
    """Generate a grounded answer from Gemini using retrieved chunks and recent chat context."""
    if not GEMINI_API_KEY:
        return "Error: Missing GEMINI_API_KEY in environment variables."

    if not relevant_chunks:
        return "Error: No relevant document context found for this project. Upload a document and try again."

    context_text = "\n\n".join(relevant_chunks) if relevant_chunks else "No relevant context found."
    conversation_context = ""
    if recent_messages:
        formatted_messages = []
        for msg in recent_messages[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content:
                formatted_messages.append(f"{role}: {content}")
        conversation_context = "\n".join(formatted_messages)

    prompt = (
        "You are a helpful assistant. Use the provided context to answer the user's question. "
        "If the answer is not in the context, say so clearly. "
        "Use recent conversation turns to resolve references like 'this', 'that', or 'it'. "
        "Be specific and concrete: preserve exact numbers/units/examples from context when present. "
        "Avoid vague wording and generic advice when concrete details exist.\n\n"
        f"Recent Conversation:\n{conversation_context if conversation_context else 'No prior turns.'}\n\n"
        f"Context:\n{context_text}\n\n"
        f"Question:\n{question}"
    )

    try:
        response = requests.post(
            f"{API_URL}?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "temperature": 0.3,
                    "maxOutputTokens": 1024
                }
            },
            timeout=60
        )

        if response.status_code == 200:
            response_data = response.json()
            candidates = response_data.get("candidates", [])
            if not candidates:
                return "Error: Gemini returned no answer candidates."

            parts = candidates[0].get("content", {}).get("parts", [])
            text_parts = [part.get("text", "") for part in parts if part.get("text")]
            if text_parts:
                return "\n".join(text_parts)
            return "Error: Gemini returned an empty answer."
        else:
            error_message = "Gemini API request failed."
            try:
                payload = response.json()
                error_message = payload.get("error", {}).get("message", error_message)
            except (ValueError, json.JSONDecodeError):
                pass

            if response.status_code == 429:
                return "Error: Gemini quota limit reached. Please check your Gemini billing/quota and retry in a few minutes."
            if response.status_code in (401, 403):
                return "Error: Gemini API key is invalid or does not have permission for this model."

            return f"Error: {error_message}"
    except requests.Timeout:
        return "Error: Gemini request timed out. Please try again."
    except Exception as e:
        return f"Error: Failed to call Gemini API: {e}"