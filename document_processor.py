import os
import fitz  # PyMuPDF
import json
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

# Function to process the uploaded document and create chunks
def process_document(file, file_type):
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

    chunks = [content[i:i+500] for i in range(0, len(content), 500)]
    return chunks

# Function to extract text from PDF
def extract_text_from_pdf(file):
    doc = fitz.open(stream=file.read(), filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()
    return text

# Function to generate embeddings for chunks
def generate_embeddings(chunks):
    embeddings = model.encode(chunks)
    return embeddings

# Function to save chunks and embeddings to Supabase
def save_chunks_to_supabase(chunks, embeddings, project_name):
    try:
        for chunk, embedding in zip(chunks, embeddings):
            supabase.table("messages").insert([{
                "project": project_name,
                "role": "document",
                "content": chunk,
                "embedding": embedding.tolist()
            }]).execute()
        return True
    except Exception as e:
        st.error("Failed to save document chunks to Supabase. Please verify DB credentials and table permissions.")
        return False

# File uploader for document upload
def upload_document():
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
                chunks = process_document(uploaded_file, file_type)
                if chunks:
                    embeddings = generate_embeddings(chunks)
                    if save_chunks_to_supabase(chunks, embeddings, st.session_state["current_project"]):
                        st.session_state["upload_notice"] = "Document uploaded and processed successfully."
                        st.session_state["upload_uploader_version"] += 1
                        st.rerun()
                else:
                    st.sidebar.error("Document upload failed. Please check file format/content and try again.")

# Function to retrieve relevant chunks from Supabase
def retrieve_relevant_chunks(question, project_name):
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

# Function to generate answer using Gemini API
def generate_answer(question, relevant_chunks):
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