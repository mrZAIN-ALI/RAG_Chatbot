# DocMind

DocMind turns uploaded documents into an embeddable AI chatbot for any website. It combines a Next.js setup dashboard, a FastAPI RAG backend, Supabase persistence, and a lightweight `widget.js` embed script.

## Live Demo

Live demo: `https://your-vercel-docmind-demo.vercel.app`

## Architecture

```text
Browser
  -> Next.js setup and dashboard
  -> FastAPI RAG API
  -> Supabase

Any Website
  -> widget.js
  -> FastAPI RAG API
  -> Supabase
```

## Quick Start

```powershell
git clone https://github.com/your-username/docmind.git
cd RAG_Chatbot
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt; python -m spacy download en_core_web_sm; npm install; cd widget; npm install; cd ..; cd docmind-web; npm install; cd ..; copy .env.example .env
```

Fill `.env` with your Supabase and provider keys, then run `.\run_docmind.ps1` or start FastAPI and Next.js separately:

```powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
cd docmind-web; npm run dev
```

## How It Works

1. Describe the chatbot, model provider, tone, and restricted topics in the setup flow.
2. Upload documents so DocMind can chunk, embed, store, retrieve, and rerank the knowledge base.
3. Copy the generated script tag into any website and chat through the deployed FastAPI backend.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python, Uvicorn |
| RAG | SentenceTransformers, reranking, configurable vector store |
| Persistence | Supabase |
| LLM Providers | Gemini, OpenAI, Groq |
| Widget | Vanilla JavaScript embed |
| Deployment | Railway free tier for FastAPI, Vercel free tier for Next.js |
| Testing | Pytest, Vitest, Playwright |

## Milestone Changelog

| Milestone | Highlights |
| --- | --- |
| M1-M2 | Core document ingestion, project flow, and baseline RAG chat. |
| M3-M4 | FastAPI endpoints, embeddable widget, and frontend setup flow. |
| M5-M6 | Conversation memory, confidence handling, and error surfacing. |
| M7-M8 | Multiple vector stores and multiple LLM providers. |
| B-5 | Railway/Vercel deployment config, health checks, dynamic widget origin, and portfolio docs. |

## Contributing

Issues and pull requests are welcome. Keep changes focused, avoid committing secrets, and run the relevant tests before opening a PR:

```powershell
.\.venv\Scripts\python.exe -m pytest
cd docmind-web; npx vitest run
```
