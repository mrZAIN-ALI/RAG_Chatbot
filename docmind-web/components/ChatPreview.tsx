"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChatPreviewProps {
  projectId?: string;
  projectName?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default function ChatPreview({ projectId, projectName }: ChatPreviewProps) {
  if (!projectId) {
    return (
      <Card className="min-h-[700px]">
        <CardHeader className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]">
          <CardTitle>Live Chat Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[610px] items-center justify-center bg-[color:var(--surface)] p-8 text-center">
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">Select a chatbot from the left.</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">The live preview opens only for the project you choose.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const label = projectName ? `${projectName} preview` : "Widget preview";
  const widgetSrc = `${API_BASE}/widget.js?id=${encodeURIComponent(projectId)}`;
  const safeLabel = escapeHtml(label);
  const safeName = escapeHtml(projectName ?? "this organization");
  const srcDoc = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html,body{height:100%;}
    body{font-family:Inter,Arial,sans-serif;background:#f7f8fb;margin:0;color:#111118;overflow:hidden;}
    .site{min-height:100%;display:flex;flex-direction:column;}
    .nav{height:54px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dfe3ee;background:#fff;padding:0 18px;}
    .brand{font-weight:700;font-size:15px;}
    .links{display:flex;gap:14px;color:#62677a;font-size:12px;}
    .hero{padding:30px 22px 20px;background:#f7f8fb;}
    .eyebrow{font-size:12px;font-weight:700;color:#7c2cff;text-transform:uppercase;}
    h1{margin:8px 0 8px;font-size:30px;line-height:1.08;max-width:520px;}
    p{margin:0;color:#62677a;line-height:1.55;font-size:14px;max-width:560px;}
    .content{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:18px 22px;}
    .card{background:#fff;border:1px solid #dfe3ee;border-radius:8px;padding:16px;box-shadow:0 10px 24px rgba(17,17,24,.05);}
    .card h2{margin:0 0 8px;font-size:15px;}
    .card p{font-size:13px;}
    .preview-label{position:absolute;left:14px;bottom:14px;border:1px solid #dfe3ee;border-radius:8px;background:#fff;padding:8px 12px;color:#62677a;font-size:12px;}
    @media(max-width:720px){.content{grid-template-columns:1fr}.links{display:none}h1{font-size:24px}}
  </style>
</head>
<body>
  <div class="site">
    <div class="nav">
      <div class="brand">${safeName}</div>
      <div class="links"><span>Services</span><span>Docs</span><span>Contact</span></div>
    </div>
    <main>
      <section class="hero">
        <div class="eyebrow">Live website simulation</div>
        <h1>Welcome to ${safeName}</h1>
        <p>This preview behaves like an external website with the DocMind chatbot embedded. Click the floating button in the bottom-right corner to open the assistant.</p>
      </section>
      <section class="content">
        <div class="card"><h2>Organization Info</h2><p>The assistant uses the questionnaire details and uploaded documents for this chatbot.</p></div>
        <div class="card"><h2>Ask Anything</h2><p>Visitor questions go through your FastAPI RAG backend without asking visitors for provider credentials.</p></div>
      </section>
    </main>
    <div class="preview-label">${safeLabel}</div>
  </div>
  <script src="${widgetSrc}"><\/script>
</body>
</html>`;

  return (
    <Card className="overflow-hidden lg:sticky lg:top-20">
      <CardHeader className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]">
        <CardTitle>Live Chat Preview{projectName ? ` - ${projectName}` : ""}</CardTitle>
      </CardHeader>
      <CardContent className="bg-[color:var(--surface)] p-3">
        <iframe
          title="DocMind Chat Preview"
          className="h-[760px] w-full rounded-[8px] border border-[color:var(--border)] bg-white"
          srcDoc={srcDoc}
        />
      </CardContent>
    </Card>
  );
}
