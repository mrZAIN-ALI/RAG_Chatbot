# Software Requirements Specification

## 1. Document Control

### 1.1 Product Name
RAG 2.0 Chatbot

### 1.2 Version
Current implementation state as of this repository snapshot.

### 1.3 Purpose of This Document
This document specifies the functional behavior, architecture, runtime requirements, configuration, and operational workflow of the RAG 2.0 Chatbot application.

## 2. System Overview

### 2.1 Product Summary
RAG 2.0 Chatbot is a Streamlit application that supports project-scoped document ingestion and conversational question answering over uploaded content.

The system combines:
- document chunking and embedding,
- semantic retrieval plus reranking,
- query rewriting,
- optional conversation summarization,
- confidence scoring and low-confidence logging,
- configurable vector backends,
- configurable answer-generation LLM provider.

### 2.2 High-Level Modules
- UI and session orchestration: app.py
- Retrieval, ingestion, LLM orchestration, and backends: document_processor.py
- Dependency manifest: requirements.txt
- Runtime configuration: .env

## 3. Goals and Scope

### 3.1 In Scope
- Project-based chat sessions.
- Upload and process source documents.
- Persist messages and embeddings.
- Retrieve top relevant document chunks.
- Generate grounded answers using a selectable LLM provider.
- Maintain chat continuity through stored history and optional summary records.

### 3.2 Out of Scope
- User authentication and authorization.
- Multi-tenant isolation beyond project string separation.
- API server endpoint exposure for third-party clients.
- Fully native DOCX parsing pipeline.

## 4. Functional Requirements

### 4.1 Project Management
- FR-001: The system shall allow creating a named project.
- FR-002: The system shall allow selecting one active project.
- FR-003: The system shall allow deleting a selected project and its stored rows in the messages table.

### 4.2 Document Ingestion
- FR-010: The system shall allow file upload from the sidebar when a project is selected.
- FR-011: The system shall process PDF using PyMuPDF text extraction.
- FR-012: The system shall process non-PDF uploads as text via UTF-8 fallback to latin1 decoding.
- FR-013: The system shall split parsed text into sentence-aware chunks near 400 words with overlap.
- FR-014: The system shall generate embeddings using all-MiniLM-L6-v2.
- FR-015: The system shall persist chunk content, embedding vectors, and metadata.

### 4.3 Retrieval and Ranking
- FR-020: The system shall rewrite user query using recent conversation context.
- FR-021: The system shall retrieve candidate chunks from the configured vector backend.
- FR-022: The system shall compute cosine similarity for initial ranking.
- FR-023: The system shall rerank top candidates using cross-encoder/ms-marco-MiniLM-L-6-v2.
- FR-024: The system shall output top reranked chunks for answer generation.
- FR-025: The system shall compute a normalized confidence score and store retrieval metadata.

### 4.4 Answer Generation
- FR-030: The system shall provide an abstract LLMProvider interface for answer generation.
- FR-031: The system shall support GeminiProvider.
- FR-032: The system shall support OpenAIProvider.
- FR-033: The system shall support GroqProvider.
- FR-034: The provider selection shall be controlled by LLM_PROVIDER environment variable.
- FR-035: If LLM_PROVIDER is missing or unsupported, the default provider shall be Gemini.
- FR-036: The answer prompt shall include retrieved context and conversation information.

### 4.5 Conversation Memory and Logging
- FR-040: The system shall persist user and assistant turns in Supabase.
- FR-041: The system shall summarize conversation into conversation_summaries when threshold is exceeded.
- FR-042: The system shall log low-confidence events to low_confidence_queries.
- FR-043: Low-confidence logging shall not inject warning prefix text into the user-facing assistant answer.

### 4.6 Vector Store Abstraction
- FR-050: The system shall expose VectorStore abstraction.
- FR-051: The system shall support SupabaseVectorStore.
- FR-052: The system shall support FAISSVectorStore.
- FR-053: The system shall support ChromaVectorStore.
- FR-054: Vector backend selection shall be controlled by VECTOR_STORE_BACKEND.

## 5. Non-Functional Requirements

### 5.1 Reliability
- NFR-001: Failures in summary persistence and low-confidence logging shall not crash main answer flow.
- NFR-002: Retrieval and answer errors shall be surfaced as readable error text in the UI.

### 5.2 Performance
- NFR-010: Retrieval scope shall be bounded by RETRIEVAL_TOP_K.
- NFR-011: Rerank output shall be bounded by RERANK_TOP_N.

### 5.3 Maintainability
- NFR-020: LLM and vector storage layers shall use explicit abstraction interfaces.
- NFR-021: Feature behavior shall be configurable via environment variables.

### 5.4 Security
- NFR-030: Secrets shall be provided through environment variables.
- NFR-031: No hardcoded API keys shall exist in source code.

## 6. Runtime Architecture

### 6.1 Execution Flow
1. User selects project and uploads document.
2. Document is parsed, chunked, embedded, and stored through configured vector backend.
3. User asks a question.
4. Query is rewritten using recent conversation context.
5. Candidate chunks are retrieved and reranked.
6. Confidence score is computed.
7. Answer is generated by selected LLM provider using grounded context.
8. User and assistant messages are saved.
9. If chat length exceeds threshold, conversation summary is refreshed.
10. If confidence is below threshold, low-confidence event is logged.

### 6.2 Provider and Backend Routing
- LLM provider routing: get_llm_provider based on LLM_PROVIDER.
- Vector backend routing: get_vector_store based on VECTOR_STORE_BACKEND.
- Active provider/model visibility: chat window shows current provider and model at runtime.

### 6.3 Important Implementation Note
Answer generation, query rewriting, and conversation summarization all use the active provider selected by LLM_PROVIDER.

## 7. Data Model and Storage

### 7.1 Required Tables

#### messages
```sql
create table if not exists public.messages (
	id bigint generated by default as identity primary key,
	role text not null,
	content text not null,
	project text not null,
	timestamp timestamptz not null default timezone('utc'::text, now()),
	embedding jsonb,
	metadata jsonb
);

create index if not exists idx_messages_project_timestamp
on public.messages (project, timestamp);
```

#### conversation_summaries
```sql
create table if not exists public.conversation_summaries (
	project text primary key,
	summary text not null,
	updated_at timestamptz not null default timezone('utc'::text, now())
);
```

#### low_confidence_queries
```sql
create table if not exists public.low_confidence_queries (
	id bigint generated by default as identity primary key,
	project text not null,
	query text not null,
	score double precision not null,
	timestamp timestamptz not null default timezone('utc'::text, now())
);
```

### 7.2 Suggested RLS and Policy Baseline
Use a policy configuration appropriate for your deployment. During local prototyping, an allow-all policy is commonly used but is not recommended for production.

## 8. Configuration Requirements

Create .env in repository root and provide values for the following:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_API_KEY=your_supabase_service_or_anon_key

YOUR_SITE_URL=http://localhost:8501
YOUR_SITE_NAME=RAG_Chatbot

VECTOR_STORE_BACKEND=supabase
RETRIEVAL_TOP_K=20
RERANK_TOP_N=5
SUMMARY_THRESHOLD=10
LOW_CONFIDENCE_THRESHOLD=0.25

LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key

OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-3.5-turbo

GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama3-8b-8192
```

### 8.1 LLM_PROVIDER Values
- gemini
- openai
- groq

If invalid or not provided, Gemini is used as default.

### 8.2 VECTOR_STORE_BACKEND Values
- supabase
- faiss
- chroma

If invalid or not provided, Supabase is used as default.

## 9. Dependency Requirements

### 9.1 Python
- Python 3.10+ recommended.

### 9.2 Core Libraries
- streamlit
- supabase
- sentence-transformers
- spacy
- PyMuPDF
- google-generativeai
- openai
- groq
- faiss-cpu
- chromadb

### 9.3 Additional Model Download
spaCy English model is required:

```bash
python -m spacy download en_core_web_sm
```

## 10. Installation and Startup

### 10.1 Clone and Environment

Windows:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

macOS/Linux:
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### 10.2 Start Application
```bash
streamlit run app.py
```

Default URL:
- http://localhost:8501

If you see `ModuleNotFoundError: No module named 'supabase'`, start Streamlit from the project virtual environment instead of the global Python install:

```bash
.venv\Scripts\streamlit.exe run app.py
```

That ensures Streamlit uses the same dependency set installed in `.venv`.

## 11. User Workflow

### 11.1 First-Time Setup Workflow
1. Configure environment values in .env.
2. Create required Supabase tables.
3. Start the Streamlit app.
4. Create a project in the sidebar.
5. Upload document(s).
6. Start asking questions.

### 11.2 Chat Workflow
1. User sends question in project chat.
2. System retrieves and reranks related document chunks.
3. System generates grounded answer from selected provider.
4. Chat turn is rendered and persisted.
5. Summary and confidence logging run in background path as applicable.
6. Chat window displays currently active provider and model.

## 12. Error Handling Behavior

The system returns explicit errors for:
- missing context for answer generation,
- provider API key missing,
- provider package missing,
- retrieval and persistence failures,
- document decode problems,
- unsupported runtime conditions.

These errors are displayed as user-readable messages rather than raw tracebacks.

## 13. Known Limitations

- Non-PDF ingestion path treats uploads as text bytes. Native DOCX parsing is not currently implemented.
- RLS and security hardening are deployment responsibilities and are not fully managed by the app itself.

## 14. Verification and Acceptance

Acceptance proof artifacts are stored under artifacts/acceptance.

To run milestone acceptance scripts, use the project virtual environment and execute the corresponding proof file.

## 15. Operational Recommendations

- Keep secrets out of source control.
- Use one value per environment key to avoid duplicate-key override confusion.
- For production, add authenticated access, stricter Supabase RLS policies, audit logging, and secret management through a secure vault.

