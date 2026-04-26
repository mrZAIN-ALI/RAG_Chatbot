# DocMind - Custom RAG Chatbot Builder for Websites

## Upwork Portfolio Case Study

DocMind is a full-stack AI application that lets website owners build a custom RAG chatbot from their own website knowledge. The user provides website details through PDFs, docs, policies, FAQs, product information, or service information, connects an LLM provider, and receives an embeddable chatbot widget that can be added to any website with one script tag.

This project demonstrates end-to-end AI product development: frontend UI, backend APIs, document processing, embeddings, vector retrieval, reranking, LLM integration, dashboard management, embeddable JavaScript widget, testing, and free-tier deployment readiness.

## Project Snapshot

| Item | Details |
| --- | --- |
| Project name | DocMind |
| Project type | Full-stack AI SaaS prototype / RAG chatbot builder |
| Main use case | Create a website-specific chatbot from uploaded knowledge files |
| Target users | Website owners, SaaS teams, agencies, support teams, small businesses |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python, Pydantic, Uvicorn |
| AI/RAG | SentenceTransformers, semantic search, reranking, LLM provider abstraction |
| Database | Supabase PostgreSQL |
| Widget | Vanilla JavaScript embed served from FastAPI |
| Deployment target | Railway for backend, Vercel for frontend |
| Testing | Pytest, Jest, Vitest, React Testing Library, Playwright |

## The Problem

Many businesses have useful information scattered across website pages, PDF guides, FAQ documents, product notes, service descriptions, and support policies. Visitors often cannot find the right answer quickly, while businesses do not want to manually build and maintain a custom support chatbot from scratch.

The goal of DocMind is to solve this by giving a business a simple workflow:

1. Describe the chatbot and its boundaries.
2. Upload the website knowledge files.
3. Choose the AI model provider and model.
4. Copy one script tag.
5. Embed the chatbot on the website.

The chatbot should answer using the uploaded knowledge, remember conversation context, respond clearly when a question is outside the uploaded business details, and work from any website after deployment.

## The Solution

DocMind provides a complete RAG chatbot creation workflow. It is not only a chat interface. It is a builder that creates a project, processes website knowledge, generates embeddings, stores searchable chunks, connects to an LLM provider, and produces an embeddable widget.

The finished system has three major parts:

| Part | Responsibility |
| --- | --- |
| Next.js web app | Landing page, guided setup flow, dashboard, live preview, copy embed code |
| FastAPI backend | Project API, upload API, chat API, history API, widget serving, health checks |
| Widget.js | Lightweight embeddable chatbot that works on external websites |

## Core User Journey

### 1. Landing Page

The landing page explains DocMind as a custom RAG website assistant builder. It uses a modern portfolio-style design with dark/light theme support, clear calls to action, and a visual flow showing:

```text
Website PDF -> RAG Index -> Model Provider -> Site Widget
```

The page links users to:

- Setup flow
- Dashboard
- How the system works

### 2. Guided Setup

The setup page has a three-step workflow:

```text
Configure -> Upload -> Embed
```

Step 1 captures:

- Bot name
- Website knowledge description
- Tone
- Restricted topics
- AI provider
- Model name
- API key

Step 2 handles:

- PDF upload
- TXT upload
- DOCX upload
- Drag-and-drop file input
- Upload progress
- Chunk count after successful processing
- Multiple file uploads

Step 3 provides:

- Generated widget script tag
- Inline copy button
- Main "Copy to clipboard" button
- Live chatbot preview
- Link to dashboard

### 3. Dashboard

The dashboard is the operational hub. It connects to the real backend and provides:

- Project list from Supabase
- Project selection
- Refresh action
- Copy embed code per project
- Delete project without page refresh
- Live chatbot preview in a simulated website
- Empty state linking to setup

The dashboard was designed to be scannable and practical rather than decorative. The project list is compact, while the live chatbot preview has more room for real testing.

### 4. Widget Embed

After setup, the user receives a script tag:

```html
<script src="https://your-railway-api.up.railway.app/widget.js?id=PROJECT_ID"></script>
```

The widget:

- Loads from the FastAPI backend
- Reads the project ID from the script URL
- Detects API origin from the script source
- Does not rely on hardcoded localhost URLs
- Opens as a floating chat button
- Loads public widget configuration
- Loads previous history
- Sends messages to `/api/chat`
- Uses scoped `.docmind-` CSS so it does not conflict with the host website
- Shows a preview-only welcome message when no history exists and removes it before the first real user message

For real websites, the backend must be online because the website loads `widget.js` and sends chat requests to the deployed API.

## System Architecture

```text
Website Owner
  |
  v
Next.js Frontend
  |
  |-- Landing page
  |-- Setup flow
  |-- Dashboard
  |
  v
FastAPI Backend
  |
  |-- Project endpoints
  |-- Upload endpoint
  |-- Chat endpoint
  |-- History endpoint
  |-- Widget serving endpoint
  |-- Health endpoint
  |
  v
RAG Pipeline
  |
  |-- Parse PDF/TXT/DOCX
  |-- Sentence-aware chunking
  |-- Generate embeddings
  |-- Store vectors
  |-- Retrieve candidate chunks
  |-- Rerank with cross-encoder
  |-- Rewrite follow-up queries
  |-- Generate answer with selected LLM
  |-- Score confidence
  |
  v
Supabase
  |
  |-- project_config
  |-- messages
  |-- conversation_summaries
  |-- low_confidence_queries


External Website
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

## How the System Works Internally

### Project Creation Flow

1. User fills out Step 1 in the Next.js setup page.
2. Frontend calls `POST /api/projects`.
3. Backend validates the request with Pydantic models.
4. Backend creates a project ID.
5. Project configuration is stored in Supabase `project_config`.
6. Frontend stores the project ID in `localStorage`.
7. Setup flow moves to document upload.

### Document Upload Flow

1. User uploads a PDF, TXT, or DOCX file.
2. Frontend sends `multipart/form-data` to `POST /api/upload`.
3. Backend reads file bytes and passes them into the document processor.
4. Document processor extracts text:
   - PDF through PyMuPDF
   - TXT through text decoding
   - DOCX through ZIP/XML parsing
5. Text is split into sentence-aware chunks with overlap.
6. Each chunk receives metadata:
   - filename
   - chunk index
   - total chunks
7. Embeddings are generated with SentenceTransformers.
8. Chunks and embeddings are saved to the selected vector store.
9. Backend returns chunk count and filename.
10. Frontend shows the successful upload and chunk count.

### Chat Flow

1. Visitor types a message in the widget or preview.
2. Widget sends a request to `POST /api/chat`.
3. Backend loads project configuration.
4. Backend resolves provider, model, and API key.
5. Query may be rewritten using recent conversation context.
6. Query embedding is generated.
7. Initial semantic search retrieves candidate chunks.
8. Cross-encoder reranks the candidates.
9. Top chunks are passed into the LLM as context.
10. LLM generates the answer.
11. Confidence score is calculated.
12. Low-confidence queries are logged when needed.
13. User and assistant messages are saved to Supabase.
14. Widget displays the answer.

### Widget Flow

1. Website loads the script from the deployed FastAPI backend.
2. Widget reads the project ID from `?id=PROJECT_ID`.
3. Widget detects API base URL from the script origin.
4. Widget injects isolated CSS and UI elements.
5. User clicks the floating button.
6. Widget loads public project config and history.
7. User sends a message.
8. Widget calls `/api/chat`.
9. Assistant response appears in the chat panel.

### Delete Project Flow

1. User clicks delete in the dashboard.
2. Frontend calls `DELETE /api/projects/{project_id}`.
3. Backend deletes project config.
4. Backend deletes related messages when available.
5. Frontend removes the project from the dashboard state without page refresh.

## Backend API Summary

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Health check for Railway deployment |
| `/` | GET | Root endpoint with API metadata |
| `/api/projects` | POST | Create chatbot project |
| `/api/projects` | GET | List all chatbot projects |
| `/api/projects/{project_id}` | DELETE | Delete a project |
| `/api/projects/{project_id}/widget-config` | GET | Return public widget configuration |
| `/api/upload` | POST | Upload and process knowledge file |
| `/api/chat` | POST | Ask a question through the RAG pipeline |
| `/api/history/{project_id}` | GET | Load chat history |
| `/widget.js` | GET | Serve embeddable widget script |

## Database Design

Supabase stores the project configuration, document chunks, chat messages, conversation memory, and low-confidence logs.

| Table | Purpose |
| --- | --- |
| `project_config` | Stores chatbot setup details such as name, description, tone, restrictions, provider, model, and API key |
| `messages` | Stores document chunks, embeddings, chunk metadata, user messages, assistant messages, and timestamps |
| `conversation_summaries` | Stores compressed memory for long conversations |
| `low_confidence_queries` | Stores questions where retrieval confidence is low |

## RAG Features Built

### Sentence-Aware Chunking

Instead of splitting documents at random character counts, DocMind uses spaCy sentence boundaries. This keeps chunks readable and improves retrieval quality.

### Chunk Overlap

Chunks include overlap from nearby sentences so information is not lost at boundaries.

### Metadata Storage

Each chunk stores useful metadata such as source filename, chunk index, and total chunks. This makes the system easier to debug and extend.

### Semantic Search

The query is embedded and compared against stored document embeddings using cosine similarity.

### Cross-Encoder Reranking

After initial retrieval, a cross-encoder reranks the candidate chunks to improve relevance before the answer is generated.

### Query Rewriting

Follow-up questions like "What about that?" can be rewritten using recent chat history so retrieval has enough context.

### Conversation Summaries

For longer chats, the system can use stored summaries instead of sending the full conversation history each time.

### Confidence Scoring

The system calculates a normalized confidence score from reranking results.

### Low-Confidence Handling

If the score is below the configured threshold, DocMind logs the query and gives a business-friendly fallback. Instead of saying "I am not confident", the assistant says it could not find related information in the business details and invites the visitor to ask about the business, products, services, policies, or uploaded information.

## LLM Provider Support

The backend uses an LLM provider abstraction so different providers can be connected without rewriting the RAG pipeline.

Implemented providers:

- Gemini
- OpenAI
- Groq

The UI can mention Claude as a provider-family target, but the backend currently needs an Anthropic provider class before Claude can be claimed as fully implemented.

## Vector Store Support

DocMind includes a vector store abstraction with three implementations:

| Backend | Use case |
| --- | --- |
| Supabase | Default backend and easiest deployment option |
| FAISS | Local vector index persistence |
| ChromaDB | Local persistent vector database |

The selected backend is controlled by `VECTOR_STORE_BACKEND`.

## Frontend Features

### Professional Landing Page

The landing page was redesigned from a basic template into a polished portfolio-quality product page with:

- Clear product message
- RAG pipeline visual
- Strong CTA buttons
- Dark/light theme support
- Responsive layout
- Hamburger navigation overlay
- Professional footer

### Guided Setup UX

The setup page keeps the user inside one clear workflow. It shows progress and only unlocks the next step after the current step is complete.

### Toast Error Handling

API errors are surfaced with toast notifications so failures are visible to the user.

### Responsive Design

The UI was checked for mobile and desktop sizes, including 375px and 1440px layouts.

### Dashboard UX

The dashboard focuses on real operations:

- Project list
- Live preview
- Copy embed
- Delete project
- Refresh state
- Empty state

## Widget Features

The embeddable widget is built in plain JavaScript so it can run on any normal website without React, Next.js, or external CSS.

Widget capabilities:

- Floating launcher button
- Chat panel
- Close button
- Message input
- Enter key send
- Loading indicator
- Markdown rendering for assistant messages
- Friendly error messages
- Scoped CSS
- Dynamic API origin detection
- Public project config loading
- Chat history loading
- Preview-only welcome message that is not saved as chat history
- Works from a deployed backend URL

## Testing and Quality Assurance

The project includes tests across the backend, frontend, widget, and integration layer.

| Test type | Tooling | Coverage |
| --- | --- | --- |
| API unit tests | Pytest | FastAPI endpoints, validation, CORS, health, widget serving |
| Widget unit tests | Jest | Widget injection, open/close, sending, errors |
| Frontend tests | Vitest + React Testing Library | Landing CTA, setup flow, upload state, copy embed, dashboard, toasts |
| Integration tests | Pytest + HTTP client | Create project, upload, chat, delete |
| Browser E2E tests | Playwright | Widget behavior in a real browser |
| Type checks | TypeScript | Frontend type safety |
| Linting | ESLint | Frontend code quality |

Makefile shortcuts were added for common checks:

```bash
make test-unit
make test-widget
make test-frontend
make test-e2e
make test-widget-e2e
make test-all
```

GitHub Actions CI runs unit and frontend tests on pushes and pull requests to `main`.

## Deployment Readiness

The project was prepared for free-tier deployment.

### Backend on Railway

Railway uses `railway.json` with:

```bash
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

The backend exposes `/health` for Railway health checks.

### Frontend on Vercel

The Next.js app lives in `docmind-web/` and includes `vercel.json`.

Vercel requires:

```env
NEXT_PUBLIC_API_BASE=https://your-railway-api.up.railway.app
```

### Widget Deployment

The widget is served from the Railway backend URL:

```html
<script src="https://your-railway-api.up.railway.app/widget.js?id=PROJECT_ID"></script>
```

## Security and Configuration Notes

- Secrets are loaded from environment variables.
- `.env` is ignored by git.
- `.env.example` provides safe placeholders.
- Widget public config does not return the stored API key.
- Local fallback project storage strips API keys before writing to disk.
- CORS is enabled so the widget can work on external domains.
- Generated runtime files, vector indexes, build folders, logs, caches, and local environment files are ignored.

## My Role and Contributions

For this project, the work included:

- Designing the complete product flow
- Building the FastAPI backend
- Creating API models and endpoint contracts
- Implementing RAG ingestion and retrieval logic
- Adding sentence-aware chunking and overlap
- Adding reranking and confidence handling
- Adding conversation memory features
- Adding vector store abstraction
- Adding multi-provider LLM abstraction
- Building the embeddable JavaScript widget
- Building the Next.js frontend
- Building the guided setup workflow
- Building the dashboard
- Improving UI/UX, theme support, and responsive layouts
- Creating deployment configuration for Railway and Vercel
- Writing documentation
- Adding automated tests and CI workflow

## Business Value

DocMind demonstrates how a business can turn static website knowledge into an interactive support assistant. The value for a client is practical:

- Reduces repeated support questions
- Helps visitors find answers faster
- Can be embedded into any website
- Does not require rebuilding the host website
- Allows each chatbot to be customized per business
- Supports multiple LLM provider options
- Keeps setup simple for non-technical users
- Provides dashboard management for ongoing operations

## Technical Value

This project demonstrates the ability to build more than a simple chatbot UI. It includes:

- Real backend architecture
- Document ingestion pipeline
- RAG retrieval quality improvements
- LLM abstraction
- Vector store abstraction
- Production-style API structure
- Embeddable script architecture
- Frontend workflow design
- Automated testing
- Deployment documentation
- Environment/security hygiene

## Suggested Upwork Portfolio Summary

DocMind is a full-stack AI RAG chatbot builder that turns website knowledge files into an embeddable chatbot. I built the Next.js frontend, FastAPI backend, document ingestion pipeline, semantic search, reranking, LLM provider abstraction, Supabase persistence, dashboard, JavaScript widget, tests, and free-tier deployment configuration. The system lets users configure a chatbot, upload PDFs/TXT/DOCX files, generate embeddings, retrieve relevant context, answer questions with an LLM, and embed the assistant on any website with one script tag.

## Suggested Upwork Skills Tags

- AI Chatbot Development
- Retrieval-Augmented Generation
- FastAPI
- Next.js
- React
- TypeScript
- Python
- Supabase
- OpenAI API
- Gemini API
- Groq API
- Vector Search
- Embeddings
- JavaScript Widget
- SaaS Development
- API Development
- Full-Stack Development

## Future Improvements

Possible next upgrades:

- Add Anthropic Claude backend provider support
- Add authentication and team accounts
- Add source citation display in chatbot answers
- Add per-project analytics dashboard
- Add file management and re-indexing
- Add streaming responses
- Add rate limiting and abuse protection
- Add admin controls for provider/API key management
- Add hosted demo with real sample project

## Final Result

DocMind is a portfolio-ready full-stack AI project that shows the complete path from idea to working product: user interface, backend APIs, RAG pipeline, database schema, embeddable widget, tests, and deployment documentation. It is a strong demonstration of practical AI engineering for real business workflows, especially for clients who want custom chatbot systems connected to their own knowledge base.
