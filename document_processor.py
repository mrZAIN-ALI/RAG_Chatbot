"""Document ingestion, chunking, embedding, retrieval, and Gemini answer generation utilities.

Supabase migration (run once if metadata column does not exist):
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;
"""

import os
import fitz  # PyMuPDF
import json
import spacy
from supabase import create_client, Client
import streamlit as st
from sentence_transformers import SentenceTransformer
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

# Initialize Sentence Transformer model
model = SentenceTransformer('all-MiniLM-L6-v2')

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None

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
    """Retrieve top-k semantically similar document chunks for a question and project."""
    try:
        response = supabase.table("messages") \
            .select("role, content, embedding") \
            .eq("project", project_name) \
            .execute()

        messages = response.data
        if not messages:
            return []

        # Generate embedding for the question
        question_embedding = model.encode([question])[0]

        # Calculate cosine similarity between question embedding and document embeddings
        similarities = []
        for msg in messages:
            # Only compare against document rows that actually have embedding vectors
            if msg.get("role") != "document" or msg.get("embedding") is None:
                continue

            embedding = np.array(msg["embedding"], dtype=float)
            if embedding.size == 0:
                continue

            similarity = np.dot(question_embedding, embedding) / (np.linalg.norm(question_embedding) * np.linalg.norm(embedding))
            similarities.append((similarity, msg["content"]))

        # Sort by similarity and return the most relevant chunks
        similarities.sort(reverse=True, key=lambda x: x[0])
        relevant_chunks = [content for _, content in similarities[:5]]
        return relevant_chunks
    except Exception as e:
        st.error("Could not retrieve relevant document chunks. Please verify document embeddings and database state.")
        return []

def generate_answer(question, relevant_chunks):
    """Generate a grounded answer from Gemini using retrieved chunk context."""
    if not GEMINI_API_KEY:
        return "Error: Missing GEMINI_API_KEY in environment variables."

    if not relevant_chunks:
        return "Error: No relevant document context found for this project. Upload a document and try again."

    context_text = "\n\n".join(relevant_chunks) if relevant_chunks else "No relevant context found."
    prompt = (
        "You are a helpful assistant. Use the provided context to answer the user's question. "
        "If the answer is not in the context, say so clearly.\n\n"
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