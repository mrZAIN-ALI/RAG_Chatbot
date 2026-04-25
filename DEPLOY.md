# Deploying DocMind

DocMind can be deployed on free tiers with Railway for FastAPI and Vercel for Next.js. Keep secrets in provider dashboards, not in git.

## Section 1 - Deploy FastAPI to Railway (free)

1. Push this repository to GitHub.
2. Open Railway and create a new project from the GitHub repo.
3. In Supabase, open the SQL Editor and run `supabase_schema.sql` from the repository root. It creates:
   - `project_config`
   - `messages`
   - `conversation_summaries`
   - `low_confidence_queries`
4. Select the repository root as the service source. Railway reads `railway.json` and uses Nixpacks.
5. Set the backend environment variables in the Railway dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_API_KEY`
   - `VECTOR_STORE_BACKEND`
   - `RETRIEVAL_TOP_K`
   - `RERANK_TOP_N`
   - `SUMMARY_THRESHOLD`
   - `LOW_CONFIDENCE_THRESHOLD`
   - `LLM_PROVIDER`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `GROQ_API_KEY`
   - `GROQ_MODEL`
   - `YOUR_SITE_URL`
   - `YOUR_SITE_NAME`
   - `NEXT_PUBLIC_API_BASE` (optional for FastAPI, but keep it aligned with the Railway URL if you mirror the full `.env`)
6. Deploy the service. Railway provides `PORT` automatically and starts:

```bash
uvicorn api.main:app --host 0.0.0.0 --port $PORT
```

7. Open `/health` on the deployed Railway URL and confirm it returns:

```bash
curl https://your-docmind-api.up.railway.app/health
```

```json
{ "status": "ok", "version": "1.0.0" }
```

8. Save the deployed Railway URL. You will use it as `NEXT_PUBLIC_API_BASE` in Vercel.

## Section 2 - Deploy Next.js to Vercel (free)

1. Open Vercel and import the same GitHub repository.
2. Set the project root directory to `docmind-web`.
3. Vercel detects Next.js automatically.
4. Set this environment variable in Vercel:

```env
NEXT_PUBLIC_API_BASE=https://your-docmind-api.up.railway.app
```

5. Deploy. Vercel auto-deploys on every push to `main`.

You can verify the frontend build locally before pushing:

```bash
cd docmind-web
npm ci
npm run build
```

## Section 3 - Using the Widget

Use the deployed Railway API URL in the script tag:

```html
<script src="https://your-docmind-api.up.railway.app/widget.js?id=PROJECT_ID"></script>
```

Check that the script is reachable:

```bash
curl "https://your-docmind-api.up.railway.app/widget.js?id=PROJECT_ID"
```

Optional `window.DocMindConfig` options:

| Option | Description | Example |
| --- | --- | --- |
| `apiBase` | Overrides the API URL. Usually not needed because the widget detects it from the script origin. | `"https://your-docmind-api.up.railway.app"` |
| `primaryColor` | Sets the widget button and user bubble color. | `"#2563eb"` |

Full embed example:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DocMind Widget Example</title>
  </head>
  <body>
    <h1>Example Website</h1>
    <p>The DocMind assistant loads from Railway and talks to the FastAPI backend.</p>

    <script>
      window.DocMindConfig = {
        primaryColor: "#2563eb"
      };
    </script>
    <script src="https://your-docmind-api.up.railway.app/widget.js?id=PROJECT_ID"></script>
  </body>
</html>
```

## Section 4 - Environment Variables Reference

| Variable | Description | Example value |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase project URL. | `https://abc123.supabase.co` |
| `SUPABASE_API_KEY` | Supabase API key for backend data access. | `your_supabase_service_or_anon_key` |
| `VECTOR_STORE_BACKEND` | Vector store implementation. Supported: `supabase`, `faiss`, `chroma`. | `supabase` |
| `RETRIEVAL_TOP_K` | Candidate chunks retrieved before reranking. | `20` |
| `RERANK_TOP_N` | Top reranked chunks sent to the LLM. | `5` |
| `SUMMARY_THRESHOLD` | Conversation turn threshold for summary maintenance. | `10` |
| `LOW_CONFIDENCE_THRESHOLD` | Confidence threshold for low-confidence handling. | `0.25` |
| `LLM_PROVIDER` | Active provider. Supported: `gemini`, `openai`, `groq`. | `gemini` |
| `GEMINI_API_KEY` | Google Gemini API key. | `your_gemini_key` |
| `GEMINI_MODEL` | Gemini model name. | `gemini-2.5-flash` |
| `OPENAI_API_KEY` | OpenAI API key. | `your_openai_key` |
| `OPENAI_MODEL` | OpenAI model name. | `gpt-4` |
| `GROQ_API_KEY` | Groq API key. | `your_groq_key` |
| `GROQ_MODEL` | Groq model name. | `llama3-8b-8192` |
| `YOUR_SITE_URL` | Public app or local site URL for metadata and examples. | `https://your-demo.vercel.app` |
| `YOUR_SITE_NAME` | Public app/site name. | `DocMind` |
| `NEXT_PUBLIC_API_BASE` | Public FastAPI base URL for the Next.js frontend. Set this in Vercel. | `https://your-docmind-api.up.railway.app` |
| `DOCMIND_API_BASE` | API base used by local integration tests and `make test-all`. | `http://127.0.0.1:8000` |
