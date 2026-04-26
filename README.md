# DocMind

DocMind is a custom RAG chatbot builder for websites. It lets you describe a chatbot, upload website knowledge such as PDFs, docs, policies, FAQs, and service details, connect an LLM provider, then embed the finished assistant on any website with one script tag.

The production path is a Next.js frontend, a FastAPI backend, Supabase persistence, and a vanilla JavaScript widget. The older `app.py` Streamlit app remains in the repository as the original local prototype, but the portfolio-ready product is the FastAPI + Next.js + widget stack.

## Live Demo

Frontend demo: `https://your-vercel-docmind-demo.vercel.app`

FastAPI demo: `https://your-railway-docmind-api.up.railway.app`

Widget script example:

```html
<script src="https://your-railway-docmind-api.up.railway.app/widget.js?id=YOUR_PROJECT_ID"></script>
```

## What DocMind Does

| Area | Functionality |
| --- | --- |
| Landing page | Explains the RAG builder flow, links to setup and dashboard, supports dark/light theme, and uses a responsive portfolio-style UI. |
| Guided setup | Walks through Configure -> Upload -> Embed without leaving `/setup`. |
| Bot configuration | Captures bot name, website knowledge description, tone, restricted topics, provider, model, and API key. |
| Document upload | Accepts PDF, TXT, and DOCX files, extracts text, chunks content, embeds it, and stores it for retrieval. |
| RAG retrieval | Uses semantic search, cross-encoder reranking, query rewriting, confidence scoring, and optional conversation summaries. |
| Chat API | Answers user questions from uploaded project knowledge through `/api/chat`. |
| Widget embed | Serves `widget.js` from FastAPI and works on external websites with one script tag. |
| Dashboard | Lists real backend projects, selects a project, previews the widget, copies embed code, refreshes projects, and deletes projects without a page refresh. |
| Deployment | Includes Railway config for FastAPI and Vercel config for Next.js. |
| Testing | Includes API unit tests, widget tests, frontend Vitest tests, integration tests, Playwright widget E2E tests, and Makefile shortcuts. |

## Architecture

```text
Browser
  |
  v
Next.js frontend
  |  /          landing page
  |  /setup     guided builder
  |  /dashboard project console
  v
FastAPI backend
  |  project API, upload API, chat API, widget.js
  v
RAG pipeline
  |  parsing, chunking, embeddings, retrieval, reranking, LLM call
  v
Supabase
  |  project_config, messages, conversation_summaries, low_confidence_queries


Any Website
  |
  v
widget.js loaded from FastAPI
  |
  v
FastAPI /api/chat
  |
  v
Supabase + configured vector store + configured LLM provider
```

Short version:

```text
Browser -> Next.js -> FastAPI -> Supabase
Any Website -> Widget.js -> FastAPI
```

## Product Flow

1. Configure the chatbot.
   In `/setup`, enter a bot name, describe what the website assistant should know, choose a tone, define restricted topics, and provide the model provider, model name, and API key.

2. Upload website knowledge.
   Upload PDF, TXT, or DOCX files. DocMind extracts text, creates sentence-aware chunks, stores chunk metadata, generates embeddings, and saves the searchable knowledge base.

3. Embed the widget.
   DocMind generates a script tag. Paste it into any website, and visitors can open the floating assistant and ask questions using the backend project configuration.

4. Operate from the dashboard.
   `/dashboard` loads projects from the real backend, lets you select a chatbot, preview it inside a simulated website, copy the embed code, refresh the project list, or delete projects.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS, lucide-react, sonner |
| Backend | FastAPI, Python, Uvicorn, Pydantic |
| RAG parsing | PyMuPDF, spaCy, DOCX ZIP/XML parsing |
| Embeddings | SentenceTransformers `all-MiniLM-L6-v2` |
| Reranking | SentenceTransformers cross-encoder `ms-marco-MiniLM-L-6-v2` |
| Vector stores | Supabase, FAISS, ChromaDB |
| Persistence | Supabase PostgreSQL tables |
| LLM providers | Gemini, OpenAI, Groq |
| Widget | Vanilla JavaScript, scoped CSS, dynamic script-origin detection |
| Testing | Pytest, Jest, Vitest, React Testing Library, Playwright |
| Deployment | Railway free tier for FastAPI, Vercel free tier for Next.js |

## Quick Start

PowerShell:

```powershell
git clone https://github.com/your-username/docmind.git
cd RAG_Chatbot
python -m venv .venv; .\.venv\Scripts\activate
pip install -r requirements.txt -r requirements-api.txt; python -m spacy download en_core_web_sm
npm install; cd widget; npm install; cd ..\docmind-web; npm install; cd ..
copy .env.example .env
```

Fill `.env` with real Supabase and LLM provider values, then run the full local stack:

```powershell
.\run_docmind.ps1
```

The launcher starts FastAPI and Next.js in the background, chooses available ports, writes logs under `.runtime/logs`, and prints the local URLs. Stop both services with:

```powershell
.\stop_docmind.ps1
```

Manual startup:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
cd docmind-web; $env:NEXT_PUBLIC_API_BASE="http://127.0.0.1:8000"; npm run dev
```

## Environment Variables

Create `.env` from `.env.example`.

| Variable | Required | Description | Example |
| --- | --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL used by FastAPI, Streamlit prototype, and Supabase vector storage. | `https://abc.supabase.co` |
| `SUPABASE_API_KEY` | Yes | Supabase API key for backend database access. Use a trusted backend key for deployment. | `your_supabase_key` |
| `VECTOR_STORE_BACKEND` | Yes | Vector backend. Supported values: `supabase`, `faiss`, `chroma`. | `supabase` |
| `RETRIEVAL_TOP_K` | Yes | Number of semantic candidates fetched before reranking. | `20` |
| `RERANK_TOP_N` | Yes | Number of reranked chunks passed to answer generation. | `5` |
| `SUMMARY_THRESHOLD` | Yes | Conversation length before summary memory can be used. | `10` |
| `LOW_CONFIDENCE_THRESHOLD` | Yes | Confidence score below which DocMind prepends a warning and logs the query. | `0.25` |
| `LLM_PROVIDER` | Yes | Default backend provider. Implemented values: `gemini`, `openai`, `groq`. | `gemini` |
| `GEMINI_API_KEY` | For Gemini | Google Gemini API key. | `your_gemini_key` |
| `GEMINI_MODEL` | For Gemini | Gemini model name. | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | For OpenAI | OpenAI API key. | `your_openai_key` |
| `OPENAI_MODEL` | For OpenAI | OpenAI model name. | `gpt-4` |
| `GROQ_API_KEY` | For Groq | Groq API key. | `your_groq_key` |
| `GROQ_MODEL` | For Groq | Groq model name. | `llama3-8b-8192` |
| `YOUR_SITE_URL` | Optional | Local/site metadata retained from early milestones. | `http://localhost:3000` |
| `YOUR_SITE_NAME` | Optional | Human-readable site name. | `DocMind` |
| `NEXT_PUBLIC_API_BASE` | Frontend | Public FastAPI base URL used by Next.js. In Vercel, set this to the Railway API URL. | `http://localhost:8000` |
| `DOCMIND_API_BASE` | Tests | API base used by integration and full-stack test helpers. | `http://127.0.0.1:8000` |

Provider note: the current backend provider factory implements Gemini, OpenAI, and Groq. Claude appears in some UI copy as a provider-family target, but production Claude support requires adding an Anthropic/Claude provider implementation.

## Supabase Schema

Run [supabase_schema.sql](./supabase_schema.sql) in the Supabase SQL Editor before using the deployed app.

| Table | Purpose |
| --- | --- |
| `project_config` | Stores chatbot project settings: name, description, tone, restrictions, provider, model, API key, and creation time. |
| `messages` | Stores document chunks, embeddings, metadata, user messages, assistant messages, and timestamps. |
| `conversation_summaries` | Stores compressed long-conversation memory per project. |
| `low_confidence_queries` | Stores queries where retrieval confidence was below the configured threshold. |

## Backend API

FastAPI lives in [api/main.py](./api/main.py).

| Endpoint | Method | Functionality |
| --- | --- | --- |
| `/health` | GET | Railway health check. Returns `{"status":"ok","version":"1.0.0"}`. |
| `/` | GET | API root with docs links and active model config. |
| `/api/projects` | POST | Creates a chatbot project and stores setup configuration. |
| `/api/projects` | GET | Lists all projects from `project_config`, newest first. |
| `/api/projects/{project_id}/widget-config` | GET | Returns public widget config without exposing the API key. |
| `/api/projects/{project_id}` | DELETE | Deletes the project and its messages. |
| `/api/upload` | POST | Uploads a PDF, TXT, or DOCX file, chunks it, embeds it, and stores it. |
| `/api/chat` | POST | Runs retrieval, reranking, answer generation, confidence handling, and message persistence. |
| `/api/history/{project_id}` | GET | Returns project chat history in timestamp order. |
| `/widget.js` | GET | Serves the embeddable JavaScript widget as `application/javascript`. |

FastAPI also enables CORS for all origins so the widget can be loaded from external websites.

## RAG Pipeline

Core RAG logic lives in [document_processor.py](./document_processor.py).

| Stage | Implementation |
| --- | --- |
| File parsing | PDF via PyMuPDF, DOCX via standard-library ZIP/XML parsing, TXT via UTF-8/Latin-1 fallback. |
| Chunking | spaCy sentence-aware chunks targeting about 400 words with about 12 percent overlap. |
| Metadata | Each chunk stores `filename`, `chunk_index`, and `total_chunks`. |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2`. |
| Vector storage | `SupabaseVectorStore`, `FAISSVectorStore`, or `ChromaVectorStore` selected by `VECTOR_STORE_BACKEND`. |
| Initial retrieval | Cosine similarity over stored document embeddings, controlled by `RETRIEVAL_TOP_K`. |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2`, controlled by `RERANK_TOP_N`. |
| Query rewriting | Last 4 conversation turns can be rewritten into a self-contained query. |
| Conversation memory | Long conversations can use stored summaries after `SUMMARY_THRESHOLD`. |
| Confidence scoring | Average rerank score normalized to 0.0-1.0. |
| Low-confidence handling | Logs low-confidence queries and prepends a verification warning when needed. |
| Answer generation | Uses the configured LLM provider abstraction. |

## Frontend

The Next.js app lives in [docmind-web](./docmind-web).

| Route | Purpose |
| --- | --- |
| `/` | Product landing page with RAG builder explanation, CTA links, theme toggle, hamburger menu, and footer. |
| `/setup` | Guided builder with Configure, Upload, and Embed steps. |
| `/dashboard` | Project console for listing, selecting, previewing, copying embeds, refreshing, and deleting projects. |

Important frontend behavior:

- All backend calls are typed in [docmind-web/lib/api.ts](./docmind-web/lib/api.ts).
- API errors surface as toast notifications.
- The setup flow stores the current `project_id` in `localStorage` so refreshes can resume after project creation.
- Step 2 shows upload progress and chunk count after success.
- Step 3 displays the generated script tag and provides copy buttons.
- Dashboard deletion updates local state immediately after the backend succeeds, without a page refresh.
- The UI supports dark and light themes through local CSS theme state.
- No paid component libraries are used.

## Embeddable Widget

The widget lives in [widget/widget.js](./widget/widget.js) and is served by FastAPI at `/widget.js`.

Basic embed:

```html
<script src="https://your-railway-docmind-api.up.railway.app/widget.js?id=YOUR_PROJECT_ID"></script>
```

Optional configuration:

```html
<script>
  window.DocMindConfig = {
    apiBase: "https://your-railway-docmind-api.up.railway.app",
    primaryColor: "#7c2cff"
  };
</script>
<script src="https://your-railway-docmind-api.up.railway.app/widget.js?id=YOUR_PROJECT_ID"></script>
```

Widget behavior:

- Reads `id` from the script URL as the project ID.
- Detects API origin from the script source, so deployed Railway URLs work without hardcoded localhost references.
- Uses `window.DocMindConfig.apiBase` only when you want to override the detected origin.
- Fetches public project widget config from `/api/projects/{project_id}/widget-config`.
- Loads existing chat history from `/api/history/{project_id}`.
- Sends visitor messages to `/api/chat`.
- Uses the saved project provider, model, and API key from setup, so website visitors do not need to enter credentials.
- Injects scoped `.docmind-` CSS to avoid conflicts with the host website.
- Renders a bottom-right floating button, chat panel, loading indicator, markdown-formatted assistant messages, and friendly error messages.

For the embed to work on a real website, the FastAPI backend must be online because the website loads `widget.js` and sends chat requests to that backend. The Next.js frontend does not need to be open for the widget to answer, but it is needed for creating and managing projects.

## Project Structure

```text
api/                 FastAPI app, Pydantic models, shared dependencies
docmind-web/         Next.js landing page, setup workflow, dashboard, UI components
widget/              Vanilla JavaScript embeddable chat widget and Jest tests
tests/               API unit tests, integration tests, widget E2E tests, fixtures
docs/                Archived milestone notes and support docs
artifacts/           Local generated artifacts, mostly ignored
vector_stores/       Local FAISS/Chroma persistence, ignored
.runtime/            Local launcher logs and PID files, ignored
document_processor.py RAG ingestion, retrieval, reranking, memory, and LLM providers
app.py               Legacy Streamlit prototype from early milestones
supabase_schema.sql  Database schema for required Supabase tables
railway.json         Railway FastAPI deployment config
docmind-web/vercel.json Vercel Next.js deployment config
DEPLOY.md            Step-by-step free-tier deployment guide
```

## Testing

| Command | What it checks |
| --- | --- |
| `make test-unit` | FastAPI unit tests in `tests/test_api.py`. |
| `make test-widget` | Jest widget unit tests in `widget/widget.test.js`. |
| `make test-frontend` | Vitest/React Testing Library tests in `docmind-web`. |
| `make test-e2e` | Real FastAPI integration flow. Requires a running backend and real env values. |
| `make test-widget-e2e` | Playwright widget tests in a real browser. |
| `make test-stack` | Full-stack local test helper. |
| `make test-all` | Runs API unit tests, widget unit tests, frontend tests, and stack checks in sequence. |

Useful direct commands:

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_api.py -v
cd widget; npm test
cd docmind-web; npx vitest run
cd docmind-web; npx tsc --noEmit
cd docmind-web; npm run lint
```

CI runs on pushes and pull requests to `main` through [.github/workflows/ci.yml](./.github/workflows/ci.yml). CI includes API unit tests, widget tests, and frontend tests. E2E tests are intentionally left out of CI because they need real Supabase and LLM credentials.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for the full deployment guide.

High-level deployment path:

1. Deploy FastAPI to Railway using [railway.json](./railway.json).
2. Set all backend environment variables in Railway.
3. Copy the Railway URL.
4. Deploy `docmind-web/` to Vercel using [docmind-web/vercel.json](./docmind-web/vercel.json).
5. Set `NEXT_PUBLIC_API_BASE` in Vercel to the Railway URL.
6. Use the Railway URL in widget script tags.

Railway start command:

```bash
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

Health check:

```text
/health
```

## Milestone Changelog

| Milestone | Result |
| --- | --- |
| Base setup | Added `.env.example`, documented local setup, verified the original Streamlit prototype. |
| Semantic chunking | Replaced fixed-size chunks with spaCy sentence-aware chunks and overlap. |
| Retrieval + reranking | Added top-k retrieval, cross-encoder reranking, and retrieval env controls. |
| Query rewriting | Added self-contained query rewriting for follow-up questions. |
| Conversation memory | Added conversation summaries for longer chats. |
| Low confidence | Added confidence scoring, warning prefix, and low-confidence query logging. |
| Vector stores | Added Supabase, FAISS, and Chroma vector store abstraction. |
| Multi-provider LLM | Added Gemini, OpenAI, and Groq provider abstraction. |
| FastAPI backend | Wrapped the RAG system in REST endpoints and served `widget.js`. |
| Widget | Built the embeddable vanilla JavaScript chat widget. |
| Next.js frontend | Built landing, setup, dashboard, API wrappers, and frontend tests. |
| E2E/CI | Added integration tests, Playwright widget tests, Makefile targets, and GitHub Actions CI. |
| Deployment polish | Added Railway/Vercel configs, health check, deployment docs, and portfolio README structure. |
| UI polish | Added unified dark/light design, hamburger navigation, responsive layouts, larger live preview, and professional footer. |

## Current Completion Checklist

Infrastructure:

- FastAPI serves project, upload, chat, history, widget, widget-config, root, and health endpoints.
- Next.js renders landing, setup, and dashboard pages.
- Widget works from a deployed FastAPI origin with one script tag.
- Supabase schema includes the 4 required tables.

Tests:

- API unit tests cover backend endpoint behavior.
- Widget unit tests cover injection, open/close, message sending, and error states.
- Frontend tests cover landing CTA, setup flow behavior, embed copy, dashboard rendering, and API error toasts.
- E2E tests cover create -> upload -> chat -> delete and widget browser behavior when real services are available.

Deployment:

- FastAPI is configured for Railway free tier.
- Next.js is configured for Vercel free tier.
- Widget is served from the FastAPI deployment URL.
- Secrets are read from environment variables, not hardcoded in source.

Portfolio:

- README explains the product, architecture, functionality, local setup, tests, deployment, and milestone history.
- DEPLOY.md explains free-tier deployment and widget usage.
- Live demo placeholders should be replaced after deployment.

## Contributing

Keep changes focused and avoid committing secrets, local vector indexes, runtime logs, `.env`, build outputs, or generated caches.

Before opening a pull request, run the relevant checks:

```powershell
make test-unit
make test-widget
make test-frontend
```

For changes that touch the full RAG flow or widget browser behavior, also run the E2E commands with real environment values.
