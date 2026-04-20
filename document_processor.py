"""Document ingestion, chunking, embedding, retrieval, and Gemini answer generation utilities.

Supabase migration (run once if metadata column does not exist):
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata JSONB;
"""

import os
import logging
from abc import ABC, abstractmethod
from pathlib import Path
import uuid
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
LAST_RETRIEVAL_META = {"query": None, "project": None, "confidence": 1.0}

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    nlp = None


class VectorStore(ABC):
    """Abstract interface for vector storage backends used by retrieval."""

    @abstractmethod
    def save_chunks(self, chunks, embeddings, metadata, project) -> None:
        """Persist chunk texts, embeddings, and metadata for a project."""

    @abstractmethod
    def get_all_embeddings(self, project) -> list[dict]:
        """Return all stored embedding rows for a project."""


class SupabaseVectorStore(VectorStore):
    """Vector store implementation backed by Supabase messages table."""

    def __init__(self, supabase_client):
        """Initialize Supabase vector store with an existing Supabase client."""
        self.supabase_client = supabase_client

    def save_chunks(self, chunks, embeddings, metadata, project) -> None:
        """Save chunks and embeddings into Supabase using the existing document row schema."""
        for chunk_text, embedding, chunk_metadata in zip(chunks, embeddings, metadata):
            self.supabase_client.table("messages").insert([{
                "project": project,
                "role": "document",
                "content": chunk_text,
                "embedding": embedding.tolist() if hasattr(embedding, "tolist") else list(embedding),
                "metadata": chunk_metadata,
            }]).execute()

    def get_all_embeddings(self, project) -> list[dict]:
        """Fetch all message rows containing embeddings for a project from Supabase."""
        response = self.supabase_client.table("messages") \
            .select("role, content, embedding, metadata") \
            .eq("project", project) \
            .execute()
        return response.data or []


class FAISSVectorStore(VectorStore):
    """Vector store implementation backed by local FAISS index files."""

    def __init__(self):
        """Initialize FAISS vector store with local persistence directory."""
        self.base_dir = Path("./vector_stores")

    def _project_dir(self, project: str) -> Path:
        """Return local project directory for FAISS artifacts."""
        return self.base_dir / project

    def save_chunks(self, chunks, embeddings, metadata, project) -> None:
        """Persist FAISS index and sidecar payload files for a project."""
        try:
            import faiss
        except ImportError as exc:
            raise RuntimeError("faiss-cpu is not installed. Please install dependencies.") from exc

        project_dir = self._project_dir(project)
        project_dir.mkdir(parents=True, exist_ok=True)

        index_path = project_dir / "faiss.index"
        docs_path = project_dir / "docs.json"
        emb_path = project_dir / "embeddings.npy"

        new_embeddings = np.array(embeddings, dtype=np.float32)
        if new_embeddings.ndim == 1:
            new_embeddings = new_embeddings.reshape(1, -1)

        existing_docs = []
        if docs_path.exists():
            existing_docs = json.loads(docs_path.read_text(encoding="utf-8"))

        existing_embeddings = np.empty((0, new_embeddings.shape[1]), dtype=np.float32)
        if emb_path.exists():
            existing_embeddings = np.load(emb_path)

        combined_embeddings = np.vstack([existing_embeddings, new_embeddings])
        np.save(emb_path, combined_embeddings)

        for chunk_text, chunk_metadata in zip(chunks, metadata):
            existing_docs.append({
                "role": "document",
                "content": chunk_text,
                "metadata": chunk_metadata,
            })
        docs_path.write_text(json.dumps(existing_docs, ensure_ascii=True), encoding="utf-8")

        index = faiss.IndexFlatL2(combined_embeddings.shape[1])
        index.add(combined_embeddings)
        faiss.write_index(index, str(index_path))

    def get_all_embeddings(self, project) -> list[dict]:
        """Load embeddings and associated document payloads for a project from local files."""
        project_dir = self._project_dir(project)
        docs_path = project_dir / "docs.json"
        emb_path = project_dir / "embeddings.npy"

        if not docs_path.exists() or not emb_path.exists():
            return []

        docs = json.loads(docs_path.read_text(encoding="utf-8"))
        embeddings = np.load(emb_path)

        rows = []
        for idx, doc in enumerate(docs):
            if idx >= len(embeddings):
                break
            rows.append({
                "role": doc.get("role", "document"),
                "content": doc.get("content", ""),
                "embedding": embeddings[idx].tolist(),
                "metadata": doc.get("metadata", {}),
            })
        return rows


class ChromaVectorStore(VectorStore):
    """Vector store implementation backed by local Chroma persistent collections."""

    def __init__(self):
        """Initialize Chroma vector store with local persistence directory."""
        self.base_dir = Path("./vector_stores")

    def _project_dir(self, project: str) -> Path:
        """Return local project directory for Chroma persistence."""
        return self.base_dir / project / "chroma"

    def _get_collection(self, project: str):
        """Create or fetch Chroma collection for a given project."""
        try:
            import chromadb
        except ImportError as exc:
            raise RuntimeError("chromadb is not installed. Please install dependencies.") from exc

        path = self._project_dir(project)
        path.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(path))
        return client.get_or_create_collection(name="documents")

    def save_chunks(self, chunks, embeddings, metadata, project) -> None:
        """Persist chunk vectors and metadata into project-scoped Chroma collection."""
        collection = self._get_collection(project)
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [md if isinstance(md, dict) else {} for md in metadata]
        collection.add(
            ids=ids,
            documents=list(chunks),
            embeddings=[emb.tolist() if hasattr(emb, "tolist") else list(emb) for emb in embeddings],
            metadatas=metadatas,
        )

    def get_all_embeddings(self, project) -> list[dict]:
        """Read all stored document embeddings and metadata from Chroma collection."""
        collection = self._get_collection(project)
        payload = collection.get(include=["documents", "embeddings", "metadatas"])

        documents = payload.get("documents", [])
        if documents is None:
            documents = []

        embeddings = payload.get("embeddings", [])
        if embeddings is None:
            embeddings = []

        metadatas = payload.get("metadatas", [])
        if metadatas is None:
            metadatas = []

        rows = []
        for idx, doc in enumerate(documents):
            rows.append({
                "role": "document",
                "content": doc,
                "embedding": embeddings[idx] if idx < len(embeddings) else None,
                "metadata": metadatas[idx] if idx < len(metadatas) else {},
            })
        return rows


class LLMProvider(ABC):
    """Abstract interface for configurable answer-generation providers."""

    @abstractmethod
    def generate(self, system_prompt, context, query, history) -> str:
        """Generate a response using a system prompt, context, query, and history."""


class GeminiProvider(LLMProvider):
    """LLM provider that generates answers with Gemini."""

    def __init__(self):
        """Initialize the Gemini provider."""
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = "gemini-2.5-flash"

    def generate(self, system_prompt, context, query, history) -> str:
        """Generate an answer using Gemini chat completion."""
        if not self.api_key:
            raise RuntimeError("Missing GEMINI_API_KEY in environment variables.")

        genai.configure(api_key=self.api_key)
        model_client = genai.GenerativeModel(model_name=self.model_name, system_instruction=system_prompt)
        formatted_history = "\n".join(
            [f"{item.get('role', 'user')}: {item.get('content', '')}" for item in (history or []) if item.get("content")]
        ) or "No prior turns."
        prompt = f"Context:\n{context}\n\nConversation History:\n{formatted_history}\n\nQuestion:\n{query}"
        response = model_client.generate_content(prompt)
        answer_text = (getattr(response, "text", "") or "").strip()
        if not answer_text:
            raise RuntimeError("Gemini returned an empty answer.")
        return answer_text


class OpenAIProvider(LLMProvider):
    """LLM provider that generates answers with OpenAI."""

    def __init__(self):
        """Initialize the OpenAI provider."""
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.model_name = os.getenv("OPENAI_MODEL", "gpt-4")

    def generate(self, system_prompt, context, query, history) -> str:
        """Generate an answer using the OpenAI SDK."""
        if not self.api_key:
            raise RuntimeError("Missing OPENAI_API_KEY in environment variables.")

        try:
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("openai package is not installed. Please install dependencies.") from exc

        client = OpenAI(api_key=self.api_key)
        messages = [{"role": "system", "content": system_prompt}]
        for item in history or []:
            role = item.get("role")
            content = item.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{query}"})
        response = client.chat.completions.create(model=self.model_name, messages=messages)
        answer_text = (response.choices[0].message.content or "").strip()
        if not answer_text:
            raise RuntimeError("OpenAI returned an empty answer.")
        return answer_text


class GroqProvider(LLMProvider):
    """LLM provider that generates answers with Groq."""

    def __init__(self):
        """Initialize the Groq provider."""
        self.api_key = os.getenv("GROQ_API_KEY")
        self.model_name = os.getenv("GROQ_MODEL", "llama3-8b-8192")

    def generate(self, system_prompt, context, query, history) -> str:
        """Generate an answer using the Groq SDK."""
        if not self.api_key:
            raise RuntimeError("Missing GROQ_API_KEY in environment variables.")

        try:
            from groq import Groq
        except ImportError as exc:
            raise RuntimeError("groq package is not installed. Please install dependencies.") from exc

        client = Groq(api_key=self.api_key)
        messages = [{"role": "system", "content": system_prompt}]
        for item in history or []:
            role = item.get("role")
            content = item.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{query}"})
        response = client.chat.completions.create(model=self.model_name, messages=messages)
        answer_text = (response.choices[0].message.content or "").strip()
        if not answer_text:
            raise RuntimeError("Groq returned an empty answer.")
        return answer_text


def get_llm_provider(provider: str) -> LLMProvider:
    """Return the LLM provider selected by the environment or supplied backend name."""
    selected = (os.getenv("LLM_PROVIDER", provider or "gemini") or "gemini").strip().lower()
    if selected == "openai":
        return OpenAIProvider()
    if selected == "groq":
        return GroqProvider()
    return GeminiProvider()


def get_vector_store(backend: str) -> VectorStore:
    """Return the configured vector store backend, defaulting to Supabase."""
    selected = (os.getenv("VECTOR_STORE_BACKEND", "supabase") or backend or "supabase").strip().lower()
    if selected == "faiss":
        return FAISSVectorStore()
    if selected == "chroma":
        return ChromaVectorStore()
    return SupabaseVectorStore(supabase)


def summarize_conversation(messages, project, supabase_client):
    """Summarize conversation history, store it in Supabase, and return the summary string.

    CREATE TABLE SQL (run once):
    CREATE TABLE IF NOT EXISTS public.conversation_summaries (
        project TEXT PRIMARY KEY,
        summary TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
    );
    """
    if not messages:
        return ""

    conversation_text = "\n".join(
        [f"{msg.get('role', 'user')}: {msg.get('content', '')}" for msg in messages if msg.get("content")]
    )
    if not conversation_text:
        return ""

    summary_prompt = (
        "Summarize this conversation in 3-5 sentences preserving all key "
        "facts, decisions, and entities mentioned.\n\n"
        f"Conversation:\n{conversation_text}"
    )

    summary_api_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    summary_text = ""
    try:
        response = requests.post(
            f"{summary_api_url}?key={GEMINI_API_KEY}",
            headers={"Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": summary_prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 512,
                },
            },
            timeout=60,
        )

        if response.status_code == 200:
            payload = response.json()
            candidates = payload.get("candidates", [])
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            summary_text = "\n".join([part.get("text", "") for part in parts if part.get("text")]).strip()
    except Exception:
        summary_text = ""

    if not summary_text:
        return ""

    try:
        supabase_client.table("conversation_summaries").delete().eq("project", project).execute()
        supabase_client.table("conversation_summaries").insert([{
            "project": project,
            "summary": summary_text,
        }]).execute()
    except Exception:
        # Never break the main chat flow because of summary persistence issues.
        pass

    return summary_text


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


def handle_low_confidence(query, score, project, supabase_client):
    """Log a low-confidence query event to Supabase and return the user-facing warning message.

    CREATE TABLE SQL (run once):
    CREATE TABLE IF NOT EXISTS public.low_confidence_queries (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        project TEXT NOT NULL,
        query TEXT NOT NULL,
        score DOUBLE PRECISION NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
    );
    """
    try:
        supabase_client.table("low_confidence_queries").insert([{
            "project": project,
            "query": query,
            "score": float(score),
        }]).execute()
    except Exception:
        # Logging failures must never break response generation.
        pass

    return "I'm not confident I found relevant information for this question. Here's my best attempt, but please verify: "


def retrieve_and_rerank(query, project, supabase_client):
    """Rewrite query, retrieve/rerank candidates, and attach normalized confidence score metadata.

    Returns a list of dicts with keys: content, initial_score, rerank_score, confidence_score.
    """
    retrieval_top_k = int(os.getenv("RETRIEVAL_TOP_K", "20"))
    rerank_top_n = int(os.getenv("RERANK_TOP_N", "5"))

    # Keep rerank list bounded by available initial candidates.
    retrieval_top_k = max(1, retrieval_top_k)
    rerank_top_n = max(1, min(rerank_top_n, retrieval_top_k))

    vector_store = get_vector_store(os.getenv("VECTOR_STORE_BACKEND", "supabase"))
    messages = vector_store.get_all_embeddings(project)
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
    top_reranked = reranked[:rerank_top_n]

    if top_reranked:
        avg_top_score = float(np.mean([row["rerank_score"] for row in top_reranked]))
        normalized_confidence = (avg_top_score - (-10.0)) / (10.0 - (-10.0))
        normalized_confidence = max(0.0, min(1.0, normalized_confidence))
    else:
        normalized_confidence = 0.0

    for row in top_reranked:
        row["confidence_score"] = normalized_confidence

    LAST_RETRIEVAL_META["query"] = query
    LAST_RETRIEVAL_META["project"] = project
    LAST_RETRIEVAL_META["confidence"] = normalized_confidence

    return top_reranked

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
    """Persist chunk content and embeddings via the configured VectorStore backend."""
    try:
        vector_store = get_vector_store(os.getenv("VECTOR_STORE_BACKEND", "supabase"))
        chunks = [chunk_payload["content"] for chunk_payload in chunk_payloads]
        metadata = [chunk_payload.get("metadata", {}) for chunk_payload in chunk_payloads]
        vector_store.save_chunks(chunks, embeddings, metadata, project_name)
        return True
    except Exception as e:
        st.error("Failed to save document chunks to vector store. Please verify backend configuration.")
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

def generate_answer(question, relevant_chunks, recent_messages=None, project=None, supabase_client=None):
    """Generate an answer through the configured LLM provider."""
    if not relevant_chunks:
        return "Error: No relevant document context found for this project. Upload a document and try again."

    threshold_raw = os.getenv("SUMMARY_THRESHOLD", "10")
    try:
        summary_threshold = max(1, int(threshold_raw))
    except ValueError:
        summary_threshold = 10

    active_supabase_client = supabase_client or supabase
    threshold_raw_conf = os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.25")
    try:
        low_conf_threshold = float(threshold_raw_conf)
    except ValueError:
        low_conf_threshold = 0.25

    current_confidence = LAST_RETRIEVAL_META.get("confidence", 1.0)
    meta_query = LAST_RETRIEVAL_META.get("query")
    meta_project = LAST_RETRIEVAL_META.get("project")
    if meta_query != question or (project is not None and meta_project != project):
        current_confidence = 1.0

    context_text = "\n\n".join(relevant_chunks) if relevant_chunks else "No relevant context found."
    llm_context = context_text
    history_for_llm = recent_messages or []
    if recent_messages and len(recent_messages) > summary_threshold and project:
        try:
            summary_response = active_supabase_client.table("conversation_summaries") \
                .select("summary") \
                .eq("project", project) \
                .order("updated_at", desc=True) \
                .limit(1) \
                .execute()
            summary_rows = summary_response.data or []
            if summary_rows and summary_rows[0].get("summary"):
                llm_context = f"Conversation summary:\n{summary_rows[0]['summary']}\n\nDocument context:\n{context_text}"
                history_for_llm = []
        except Exception:
            pass

    system_prompt = (
        "You are a helpful assistant. Use the provided context to answer the user's question. "
        "If the answer is not in the context, say so clearly. "
        "Use recent conversation turns to resolve references like 'this', 'that', or 'it'. "
        "Be specific and concrete: preserve exact numbers/units/examples from context when present. "
        "If the user asks for a specific count (for example 10 questions), return the full requested count completely. "
        "Avoid vague wording and generic advice when concrete details exist."
    )

    provider = get_llm_provider(os.getenv("LLM_PROVIDER", "gemini"))

    try:
        answer_text = provider.generate(system_prompt, llm_context, question, history_for_llm)
        if not answer_text:
            return "Error: LLM provider returned an empty answer."

        if current_confidence < low_conf_threshold:
            handle_low_confidence(
                question,
                current_confidence,
                project or "unknown_project",
                active_supabase_client,
            )

        return answer_text
    except Exception as e:
        return f"Error: Failed to generate answer: {e}"