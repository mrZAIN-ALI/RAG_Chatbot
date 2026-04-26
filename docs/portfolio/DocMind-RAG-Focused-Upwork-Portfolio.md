# DocMind - RAG-Focused Full-Stack AI Portfolio Document

## Project Overview

DocMind is a full-stack Retrieval-Augmented Generation chatbot builder for websites. It lets a business upload its own website knowledge, configure the assistant personality and model provider, then embed a finished chatbot into any website with one script tag.

This project is not only a chatbot UI. It includes the complete AI product pipeline:

- Next.js frontend
- Guided chatbot setup
- FastAPI backend
- Supabase persistence
- Document ingestion
- Sentence-aware chunking
- Embeddings
- Vector storage
- Semantic retrieval
- Cross-encoder reranking
- Query rewriting
- Conversation memory
- Confidence scoring
- Business-friendly fallback responses
- Embeddable JavaScript widget
- Dashboard preview
- Tests
- Deployment configuration

## Business Problem

Many businesses already have helpful information in PDFs, website copy, product pages, support policies, service descriptions, FAQs, and onboarding documents. The problem is that customers do not always find the right information quickly.

DocMind solves this by turning those business details into a searchable chatbot that can answer customer questions directly on the business website.

## What The User Can Do

1. Open the landing page and understand the product.
2. Start the guided setup.
3. Create a chatbot project.
4. Add business details and restrictions.
5. Select provider and model.
6. Upload PDF, TXT, or DOCX knowledge files.
7. See how many chunks were stored.
8. Copy the generated widget script.
9. Preview the chatbot inside a realistic static website mock.
10. Open the dashboard.
11. View all projects from the backend.
12. Copy embed code for any project.
13. Delete projects without refreshing the page.
14. Embed the chatbot into an external website.

## Main Product Screens

| Screen | Purpose |
| --- | --- |
| Landing page | Explains DocMind and sends users to setup or dashboard |
| Setup page | Three-step builder: Configure, Upload, Embed |
| Dashboard | Project console with project list, copy embed, delete, refresh, and live preview |
| Widget preview | Static dummy website showing exactly how the chatbot appears when embedded |
| External website | Any customer site loading `widget.js` from the deployed FastAPI URL |

## High-Level Architecture

```text
Browser
  |
  v
Next.js Frontend
  |
  |-- Landing page
  |-- Setup flow
  |-- Dashboard
  |-- Live website preview
  |
  v
FastAPI Backend
  |
  |-- Project API
  |-- Upload API
  |-- Chat API
  |-- History API
  |-- Widget API
  |-- Health check
  |
  v
RAG Pipeline
  |
  |-- Parse files
  |-- Chunk text
  |-- Generate embeddings
  |-- Save vectors
  |-- Retrieve candidates
  |-- Rerank chunks
  |-- Generate answer
  |-- Score confidence
  |
  v
Supabase
  |
  |-- project_config
  |-- messages
  |-- conversation_summaries
  |-- low_confidence_queries


Any Website
  |
  v
widget.js
  |
  v
FastAPI /api/chat
  |
  v
RAG Pipeline + Supabase + LLM Provider
```

## RAG Pipeline In Detail

### 1. Project Configuration

When a project is created, DocMind stores:

- Project ID
- Bot name
- Business description
- Desired tone
- Restricted topics
- LLM provider
- Model name
- API key
- Creation time

This data is stored in the Supabase `project_config` table.

### 2. File Upload

The user uploads business knowledge through the setup flow.

Supported file types:

- PDF
- TXT
- DOCX

The frontend sends the file to FastAPI using `multipart/form-data`.

Endpoint:

```text
POST /api/upload
```

### 3. Text Extraction

The backend extracts text using different strategies depending on file type:

| File type | Parser |
| --- | --- |
| PDF | PyMuPDF |
| TXT | UTF-8 or Latin-1 decoding |
| DOCX | Standard-library ZIP/XML parsing |

If a file is empty or unreadable, the backend returns an upload error.

### 4. Sentence-Aware Chunking

Instead of splitting text at a fixed character count, DocMind uses spaCy sentence boundaries.

Chunking behavior:

- Target size: about 400 words
- Boundary: sentence-aware
- Overlap: about 10-15 percent
- Carryover: 1-2 trailing sentences when useful

Why this matters:

- Chunks stay readable.
- Sentences are not cut in half.
- Context does not disappear at chunk boundaries.
- Retrieval quality improves because each chunk has coherent meaning.

### 5. Chunk Metadata

Each chunk stores metadata:

```json
{
  "filename": "uploaded_file.pdf",
  "chunk_index": 0,
  "total_chunks": 12
}
```

This is useful for debugging, later source citations, file management, and analytics.

### 6. Embedding Generation

DocMind generates embeddings with:

```text
sentence-transformers/all-MiniLM-L6-v2
```

Embeddings turn each chunk into a vector so user questions can be matched semantically instead of only by keyword.

### 7. Vector Store Abstraction

DocMind supports multiple vector stores behind one interface:

| Backend | Purpose |
| --- | --- |
| Supabase | Default production-friendly option |
| FAISS | Local vector index persistence |
| ChromaDB | Local persistent vector database |

The selected backend is controlled by:

```env
VECTOR_STORE_BACKEND=supabase
```

### 8. Query Rewriting

Follow-up questions often lack context. For example:

```text
User: Tell me about the Vesper earbuds.
User: What about battery life?
```

The second question can be rewritten into a self-contained query before retrieval.

DocMind uses recent conversation history to rewrite short or vague follow-up questions. If rewriting fails, the original query is used so the chat flow never breaks.

### 9. Initial Retrieval

The rewritten query is embedded and compared against stored document vectors using cosine similarity.

The initial retrieval pool is controlled by:

```env
RETRIEVAL_TOP_K=20
```

This returns a broader candidate set before reranking.

### 10. Cross-Encoder Reranking

Semantic search is fast, but the first results are not always the best. DocMind improves quality with a second stage:

```text
cross-encoder/ms-marco-MiniLM-L-6-v2
```

The cross-encoder scores each query/chunk pair more carefully, then DocMind keeps only the top final chunks.

Final chunk count is controlled by:

```env
RERANK_TOP_N=5
```

### 11. Context Assembly

The top reranked chunks are joined into the context passed to the selected LLM provider.

The answer-generation prompt tells the assistant to:

- Use provided context.
- Be specific.
- Preserve exact details when available.
- Say clearly when information is not in the context.
- Respond warmly to simple greetings.
- Invite visitors to ask about the business, products, services, policies, or uploaded details.

### 12. LLM Provider Abstraction

DocMind uses provider classes so the RAG pipeline does not depend on one model company.

Implemented providers:

- Gemini
- OpenAI
- Groq

The current UI can mention Claude as a provider-family target, but the backend needs an Anthropic provider class before Claude is fully implemented.

### 13. Conversation Memory

DocMind can summarize long conversations to reduce context size.

The threshold is controlled by:

```env
SUMMARY_THRESHOLD=10
```

When the conversation is longer than the threshold, stored summaries can be used instead of the full history.

### 14. Confidence Scoring

DocMind calculates confidence from rerank scores.

The confidence value is normalized between:

```text
0.0 and 1.0
```

This gives the backend and UI a way to know whether retrieved content is likely relevant.

### 15. Low-Confidence Handling

When confidence is below:

```env
LOW_CONFIDENCE_THRESHOLD=0.25
```

DocMind logs the query to `low_confidence_queries`.

The user-facing response is business-friendly. Instead of saying "I am not confident", it says:

```text
I could not find information related to this in the business details. I am here to assist with questions about this business, its products, services, policies, and uploaded information.
```

This avoids confusing visitors with technical confidence language.

### 16. Small-Talk Handling

Simple greetings such as:

- hi
- hello
- hey
- good morning
- good evening

do not trigger the low-confidence fallback. The assistant replies warmly and invites the visitor to ask about the business.

## FastAPI Backend

The backend is responsible for validating requests, coordinating the RAG pipeline, talking to Supabase, and serving the widget.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Health check for deployment |
| `/` | GET | API metadata |
| `/api/projects` | POST | Create a chatbot project |
| `/api/projects` | GET | List projects |
| `/api/projects/{project_id}` | DELETE | Delete project and messages |
| `/api/projects/{project_id}/widget-config` | GET | Public widget config without API key |
| `/api/upload` | POST | Upload and process a knowledge file |
| `/api/chat` | POST | Run retrieval and generate an answer |
| `/api/history/{project_id}` | GET | Load chat history |
| `/widget.js` | GET | Serve embeddable widget JavaScript |

## Supabase Tables

| Table | Purpose |
| --- | --- |
| `project_config` | Stores chatbot setup and provider configuration |
| `messages` | Stores document chunks, embeddings, metadata, and chat history |
| `conversation_summaries` | Stores summarized long-conversation memory |
| `low_confidence_queries` | Stores unrelated or low-relevance questions |

## Frontend Implementation

The frontend is a Next.js application with three routes:

| Route | Functionality |
| --- | --- |
| `/` | Landing page |
| `/setup` | Guided chatbot builder |
| `/dashboard` | Project console |

Frontend features:

- Responsive layout
- Dark/light theme
- Hamburger menu
- Toast notifications for API errors
- Typed API wrappers
- Three-step setup flow
- Drag-and-drop upload
- Chunk count display
- Embed code copy
- Project dashboard
- Real backend project list
- Delete without page refresh
- Realistic static website preview
- Auto-open widget preview
- Static dummy links inside preview so users do not navigate away

## Widget Implementation

The widget is built with vanilla JavaScript so it can work on any website.

Key widget details:

- Loaded through one script tag.
- Reads project ID from `?id=PROJECT_ID`.
- Detects backend origin from the script source.
- Supports optional `window.DocMindConfig`.
- Injects scoped `.docmind-` CSS.
- Renders a floating button.
- Opens a chat panel.
- Loads widget config.
- Loads existing history.
- Sends messages to `/api/chat`.
- Displays markdown-formatted assistant responses.
- Shows friendly setup/API error messages.
- Shows preview-only welcome text when history is empty.
- Removes the preview welcome before the first real user message.
- Does not ask visitors for provider credentials.

## Security And Configuration

Security practices included:

- `.env` is ignored.
- `.env.example` contains safe placeholders.
- API keys are read from environment or trusted backend/project configuration.
- Widget public config does not expose the stored API key.
- `artifacts/docmind_projects.json` is ignored and used only as a local fallback cache.
- Local fallback cache strips `api_key` and similar secret fields before writing to disk.
- Runtime logs, vector stores, build folders, caches, and generated outputs are ignored.
- If any real key is exposed during testing, it should be revoked and replaced.

## Testing

| Test type | Tooling | Coverage |
| --- | --- | --- |
| API unit tests | Pytest | FastAPI endpoint behavior |
| Widget tests | Jest | Injection, open/close, send, history, welcome, errors |
| Frontend tests | Vitest + React Testing Library | Landing, setup, dashboard, copy, toasts |
| Integration tests | Pytest + HTTPX | Create, upload, chat, delete |
| Browser E2E | Playwright | Widget behavior in browser |
| Type checking | TypeScript | Frontend type safety |
| Linting | ESLint | Frontend lint rules |

Important checks:

```bash
make test-unit
make test-widget
make test-frontend
make test-e2e
make test-widget-e2e
make test-all
```

## Deployment

Backend deployment target:

- Railway free tier
- `railway.json`
- Nixpacks builder
- Uvicorn start command
- `/health` check

Frontend deployment target:

- Vercel free tier
- `docmind-web/vercel.json`
- `NEXT_PUBLIC_API_BASE` points to Railway backend

Widget deployment:

- Served from FastAPI at `/widget.js`
- External sites load it from the Railway backend URL

## Upwork Portfolio Value

This project demonstrates:

- AI chatbot development
- Retrieval-Augmented Generation
- Full-stack SaaS engineering
- FastAPI backend design
- Next.js frontend design
- Supabase integration
- Embedding and reranking
- JavaScript widget development
- Real deployment preparation
- Test coverage
- Documentation
- Security hygiene

## What To Highlight On Upwork

Use this short profile/project summary:

DocMind is a full-stack RAG chatbot builder for websites. I built the Next.js frontend, FastAPI backend, Supabase schema, document ingestion pipeline, sentence-aware chunking, embeddings, vector retrieval, cross-encoder reranking, LLM provider abstraction, conversation memory, confidence handling, dashboard, and embeddable JavaScript widget. The system lets users upload business knowledge files, generate a chatbot, preview it inside a realistic website mock, and embed it on any website with one script tag.

Suggested skill tags:

- AI Chatbot Development
- Retrieval-Augmented Generation
- LangChain-style RAG Architecture
- FastAPI
- Next.js
- React
- TypeScript
- Python
- Supabase
- Embeddings
- Vector Search
- Semantic Search
- OpenAI API
- Gemini API
- Groq API
- JavaScript Widget
- SaaS Development

## Screenshots And Video Portfolio Plan

For Upwork, prepare these assets:

1. Landing page screenshot.
2. Setup Step 1 screenshot showing chatbot configuration.
3. Setup Step 2 screenshot showing upload and chunk count.
4. Setup Step 3 screenshot showing embed code and copy button.
5. Dashboard screenshot showing project list and live preview.
6. Chat widget screenshot inside the realistic website preview.
7. Short screen-recording video showing the full flow.
8. Optional architecture slide image.
9. This PDF as the detailed project explanation.

## Recommended Demo Video Script

Keep the video around 60-90 seconds.

Suggested flow:

1. Show landing page.
2. Click setup.
3. Configure chatbot.
4. Upload a PDF/TXT/DOCX file.
5. Show chunk count.
6. Copy embed code.
7. Open dashboard.
8. Select project.
9. Show realistic website preview with chatbot open.
10. Ask one relevant question.
11. Show answer.
12. Briefly show README/PDF/architecture.

Suggested voiceover:

```text
This is DocMind, a full-stack RAG chatbot builder for websites. A business can upload its own website knowledge, choose a model provider, and generate an embeddable chatbot. The backend parses documents, chunks them by sentence, generates embeddings, retrieves relevant context, reranks results, and sends the best context to the selected LLM. The dashboard shows all projects, embed code, deletion, and a realistic website preview where the chatbot is already integrated.
```

## Final Result

DocMind is a complete full-stack AI portfolio project. It proves the ability to build real RAG systems, production-style APIs, frontend workflows, embeddable widgets, deployment-ready configuration, and professional documentation. It is suitable for clients who need AI assistants, knowledge-base chatbots, product support bots, internal document search, or website-integrated customer support tools.
