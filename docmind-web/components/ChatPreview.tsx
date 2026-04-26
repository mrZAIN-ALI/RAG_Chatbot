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
    :root{--ink:#12131a;--muted:#5f6678;--line:#dfe4ef;--soft:#f6f7fb;--accent:#6d5dfc;--cyan:#11bfd7;--dark:#10121a;}
    *{box-sizing:border-box;}
    html,body{min-height:100%;}
    body{font-family:Inter,Arial,sans-serif;background:#eef1f7;margin:0;color:var(--ink);}
    .site{min-height:100%;background:#fff;overflow:hidden;}
    .announcement{height:34px;display:flex;align-items:center;justify-content:center;background:var(--dark);color:#fff;font-size:12px;font-weight:700;letter-spacing:.02em;}
    .nav{height:68px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);background:rgba(255,255,255,.92);padding:0 28px;position:sticky;top:0;z-index:5;backdrop-filter:blur(14px);}
    .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:16px;}
    .brand-mark{display:flex;height:34px;width:34px;align-items:center;justify-content:center;border-radius:8px;background:linear-gradient(135deg,var(--accent),var(--cyan));box-shadow:0 10px 22px rgba(109,93,252,.22);}
    .brand-mark svg{height:19px;width:19px;display:block;}
    .links{display:flex;gap:20px;color:#4b5164;font-size:13px;font-weight:650;}
    .mock-link,.nav-cta{cursor:default;}
    .nav-cta{border:1px solid var(--line);border-radius:8px;padding:9px 13px;background:#fff;color:var(--ink);}
    .hero{display:grid;grid-template-columns:minmax(0,1.05fr) 320px;gap:28px;padding:42px 30px 30px;background:radial-gradient(circle at 78% 8%,rgba(109,93,252,.18),transparent 28%),linear-gradient(180deg,#ffffff 0%,#f7f8fc 100%);}
    .eyebrow{font-size:12px;font-weight:850;color:var(--accent);text-transform:uppercase;letter-spacing:.08em;}
    h1{margin:10px 0 12px;font-size:38px;line-height:1.02;letter-spacing:-.03em;max-width:610px;}
    p{margin:0;color:var(--muted);line-height:1.6;font-size:14px;}
    .hero-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px;}
    .button{display:inline-flex;height:42px;align-items:center;border-radius:8px;padding:0 16px;font-size:13px;font-weight:800;text-decoration:none;}
    .button.primary{background:var(--accent);color:#fff;box-shadow:0 12px 28px rgba(109,93,252,.28);}
    .button.secondary{border:1px solid var(--line);background:#fff;color:var(--ink);}
    .hero-card{border:1px solid var(--line);border-radius:14px;background:#fff;padding:16px;box-shadow:0 22px 60px rgba(18,19,26,.11);}
    .product-visual{height:168px;border-radius:12px;background:linear-gradient(135deg,#191b2a,#6d5dfc 54%,#11bfd7);position:relative;overflow:hidden;}
    .product-visual:before{content:"";position:absolute;inset:22px 34px;border:1px solid rgba(255,255,255,.4);border-radius:14px;}
    .product-visual:after{content:"";position:absolute;right:26px;bottom:26px;width:86px;height:86px;border-radius:50%;background:rgba(255,255,255,.18);}
    .hero-card h2{margin:14px 0 6px;font-size:18px;}
    .rating{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;border-top:1px solid var(--line);padding-top:12px;color:var(--muted);font-size:12px;font-weight:700;}
    .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 30px 28px;background:#f7f8fc;}
    .metric{border:1px solid var(--line);border-radius:10px;background:#fff;padding:14px;}
    .metric strong{display:block;font-size:20px;}
    .metric span{font-size:12px;color:var(--muted);}
    .section{padding:30px;}
    .section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:16px;}
    .section-head h2{margin:0;font-size:24px;letter-spacing:-.02em;}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
    .card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:17px;box-shadow:0 10px 24px rgba(18,19,26,.05);}
    .icon{display:flex;height:38px;width:38px;align-items:center;justify-content:center;border-radius:8px;background:#f0edff;color:var(--accent);font-weight:900;margin-bottom:18px;}
    .card h3{margin:0 0 8px;font-size:16px;}
    .strip{margin:0 30px 30px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(135deg,#10121a,#222540);color:#fff;padding:24px;display:grid;grid-template-columns:1fr 280px;gap:18px;align-items:center;}
    .strip h2{margin:0 0 10px;font-size:24px;}
    .strip p{color:rgba(255,255,255,.72);}
    .quote{border-radius:12px;background:rgba(255,255,255,.1);padding:16px;font-size:13px;line-height:1.55;}
    .faq{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 30px 34px;}
    .faq-item{border:1px solid var(--line);border-radius:10px;background:#fff;padding:14px;font-size:13px;}
    .faq-item strong{display:block;margin-bottom:5px;}
    .footer{display:flex;justify-content:space-between;gap:14px;border-top:1px solid var(--line);background:#fbfcff;padding:18px 30px 90px;color:var(--muted);font-size:12px;}
    .preview-label{position:fixed;left:16px;bottom:16px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px 12px;color:var(--muted);font-size:12px;box-shadow:0 10px 24px rgba(18,19,26,.08);z-index:20;}
    @media(max-width:900px){.hero{grid-template-columns:1fr}.hero-card{max-width:420px}.grid,.metrics,.faq,.strip{grid-template-columns:1fr}.links{display:none}h1{font-size:32px}.section-head{display:block}}
  </style>
</head>
<body>
  <div class="site">
    <div class="announcement">Free shipping on new customer starter packs this week</div>
    <div class="nav">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4.5 9.5 12 4l7.5 5.5v9A1.5 1.5 0 0 1 18 20h-3.8v-5.2H9.8V20H6a1.5 1.5 0 0 1-1.5-1.5v-9Z" stroke="white" stroke-width="2" stroke-linejoin="round"/>
            <path d="M8.2 11.3h7.6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </span>
        ${safeName}
      </div>
      <div class="links"><span class="mock-link">Products</span><span class="mock-link">Benefits</span><span class="mock-link">Reviews</span><span class="mock-link">Support</span></div>
      <div class="nav-cta">Contact sales</div>
    </div>
    <main>
      <section class="hero">
        <div>
          <div class="eyebrow">Customer website preview</div>
          <h1>Better product guidance for every visitor.</h1>
          <p>${safeName} helps customers compare products, understand key qualities, and choose the right option with confidence. The chatbot is embedded exactly like it would be on this website.</p>
          <div class="hero-actions">
            <span class="button primary mock-link">Shop best sellers</span>
            <span class="button secondary mock-link">Read product guide</span>
          </div>
        </div>
        <aside class="hero-card">
          <div class="product-visual"></div>
          <h2>Signature product line</h2>
          <p>Curated product details, buying advice, and customer FAQs are available through the assistant.</p>
          <div class="rating"><span>4.9 customer rating</span><span>24/7 assistant</span></div>
        </aside>
      </section>
      <section class="metrics">
        <div class="metric"><strong>12k+</strong><span>customers helped</span></div>
        <div class="metric"><strong>3 min</strong><span>average buying guide read</span></div>
        <div class="metric"><strong>98%</strong><span>questions routed to assistant</span></div>
      </section>
      <section class="section">
        <div class="section-head">
          <div>
            <div class="eyebrow">Why customers choose us</div>
            <h2>Built to make product decisions easier.</h2>
          </div>
          <p>Visitors can browse the page and ask the embedded chatbot specific product questions without leaving the buying flow.</p>
        </div>
        <div class="grid">
          <article class="card"><div class="icon">01</div><h3>Product clarity</h3><p>Explain materials, features, differences, and best-use cases from your uploaded knowledge base.</p></article>
          <article class="card"><div class="icon">02</div><h3>Guided buying</h3><p>Help new users compare options and understand which product fits their needs.</p></article>
          <article class="card"><div class="icon">03</div><h3>Support ready</h3><p>Answer policy, care, setup, and usage questions using your approved website information.</p></article>
        </div>
      </section>
      <section class="strip">
        <div>
          <h2>Ask the assistant before buying.</h2>
          <p>The chat panel opens inside this preview so you can see how visitors will experience the assistant on a real website.</p>
        </div>
        <div class="quote">"The assistant helped me understand the product differences quickly and made the buying decision feel simple."</div>
      </section>
      <section class="faq">
        <div class="faq-item"><strong>Can I ask product questions?</strong><span>Yes. The assistant answers using the files and details uploaded during setup.</span></div>
        <div class="faq-item"><strong>Does the visitor need an API key?</strong><span>No. The backend uses the project configuration saved by the chatbot owner.</span></div>
      </section>
    </main>
    <footer class="footer"><span>${safeName}</span><span>Products · Support · Privacy · Contact</span></footer>
    <div class="preview-label">${safeLabel}</div>
  </div>
  <script>
    window.DocMindConfig = { primaryColor: "#6d5dfc" };
  <\/script>
  <script src="${widgetSrc}"><\/script>
  <script>
    document.addEventListener("click", function(event) {
      var link = event.target.closest && event.target.closest("a");
      if (link && !link.closest(".docmind-panel")) {
        event.preventDefault();
      }
    });

    (function openPreviewChat() {
      var attempts = 0;
      var timer = setInterval(function() {
        var button = document.querySelector(".docmind-button");
        var panel = document.querySelector(".docmind-panel");
        if (button && panel && !panel.classList.contains("docmind-open")) {
          button.click();
          clearInterval(timer);
        }
        attempts += 1;
        if (attempts > 30) clearInterval(timer);
      }, 250);
    })();
  <\/script>
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
