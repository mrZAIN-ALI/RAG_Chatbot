import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  FileText,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { SectionHeader } from "@/components/SectionHeader";
import { Surface } from "@/components/Surface";
import { WorkflowStepper } from "@/components/WorkflowStepper";

const actionGroups = [
  {
    icon: FileText,
    label: "Website knowledge",
    title: "Upload your site details",
    description: "Add PDFs, docs, policies, FAQs, product details, and service information that represent your website.",
    items: ["Website content PDFs", "Support and policy docs", "Product/service details"],
  },
  {
    icon: KeyRound,
    label: "Model choice",
    title: "Use your model API",
    description: "Bring the model provider and API key you want to use, including Gemini, OpenAI, Claude, or Groq.",
    items: ["Provider name", "Model name", "Private API key"],
  },
  {
    icon: Code2,
    label: "Website embed",
    title: "Copy the chatbot widget",
    description: "DocMind generates the script tag and preview so the custom RAG chatbot can be embedded into your website.",
    items: ["Script tag", "Live preview", "Dashboard handoff"],
  },
];

const pipelineNodes = [
  { icon: FileText, title: "Website PDF", detail: "Policies, FAQs, services" },
  { icon: Database, title: "RAG Index", detail: "Chunk, store, retrieve" },
  { icon: Bot, title: "Your Model", detail: "Gemini, OpenAI, Claude, Groq" },
  { icon: MessageCircle, title: "Site Widget", detail: "Embed and chat" },
];

const dashboardRows = [
  { name: "Website Support Bot", meta: "FAQ and policy PDF indexed", status: "Ready" },
  { name: "Service Guide Bot", meta: "Service pages uploaded", status: "Live" },
  { name: "Product Help Bot", meta: "Product docs embedded", status: "Ready" },
];

function SectionFrame({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mx-auto w-full max-w-7xl px-5 py-16 md:px-8 md:py-24">
      <div className="min-w-0">
        <SectionHeader eyebrow={eyebrow} title={title} />
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function RagBuilderVisual() {
  return (
    <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] backdrop-blur">
      <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[color:var(--accent)]">Custom RAG builder</p>
            <h2 className="mt-2 text-2xl font-bold text-[color:var(--foreground)]">Website docs to chatbot</h2>
          </div>
          <Bot className="h-8 w-8 text-[color:var(--cyan)]" />
        </div>

        <div className="mt-8 grid gap-3">
          {pipelineNodes.map((node, index) => {
            const Icon = node.icon;
            return (
              <div key={node.title}>
                <div className="grid grid-cols-[44px_1fr] gap-4 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--background)] p-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-[color:var(--foreground)]">{node.title}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">{node.detail}</p>
                  </div>
                </div>
                {index < pipelineNodes.length - 1 ? (
                  <div className="ml-5 h-5 w-px bg-[color:var(--border)]" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--accent-soft)] p-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Output</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            A custom chatbot trained on your website details and ready to embed with one script tag.
          </p>
        </div>
      </div>
    </div>
  );
}

function FooterScene() {
  return (
    <footer className="mt-16 overflow-hidden border-t border-[color:var(--border)] bg-[linear-gradient(135deg,#101014_0%,#4c11c9_48%,#7c2cff_100%)] text-white">
      <div className="relative mx-auto w-full max-w-7xl px-5 py-14 md:px-8">
        <div className="absolute inset-x-0 top-6 hidden h-52 opacity-70 md:block">
          <div className="absolute bottom-14 left-[8%] h-20 w-20 rounded-[8px] bg-white/12" />
          <div className="absolute bottom-14 left-[18%] h-28 w-12 rounded-[4px] bg-white/10" />
          <div className="absolute bottom-14 left-[28%] h-40 w-16 rounded-[4px] bg-white/10" />
          <div className="absolute bottom-14 left-[42%] h-32 w-20 rounded-[4px] bg-white/10" />
          <div className="absolute bottom-14 left-[58%] h-24 w-14 rounded-[4px] bg-white/10" />
          <div className="absolute bottom-14 left-[72%] h-36 w-20 rounded-[4px] bg-white/10" />
          <div className="absolute bottom-14 left-[84%] h-16 w-32 border-b-[70px] border-l-[48px] border-r-[48px] border-b-white/14 border-l-transparent border-r-transparent" />
          <div className="absolute bottom-14 left-[6%] h-px w-[86%] bg-white/80" />
          <div className="absolute bottom-10 left-[14%] h-1 w-16 bg-white/50" />
          <div className="absolute bottom-8 left-[38%] h-1 w-20 bg-white/50" />
          <div className="absolute bottom-9 left-[62%] h-1 w-14 bg-white/50" />
          <div className="absolute bottom-7 left-[76%] h-1 w-24 bg-white/50" />
        </div>

        <div className="relative z-10 grid min-h-[430px] gap-10 pt-44 md:grid-cols-[minmax(0,1fr)_360px] md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-white/70">DocMind</p>
            <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
              Build a custom RAG chatbot for your website.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/78">
              Upload website knowledge, choose your model provider, and embed the finished assistant where visitors need help.
            </p>
            <Link
              href="/setup"
              className="mt-8 inline-flex h-12 items-center justify-center rounded-[8px] border border-white/80 px-8 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
            >
              Start Building
            </Link>
          </div>

          <div className="rounded-[8px] border border-white/20 bg-white/10 p-5 backdrop-blur">
            <p className="text-sm font-semibold uppercase text-white/70">Product flow</p>
            <div className="mt-5 grid gap-3 text-sm text-white/82">
              <Link href="/#how-it-works" className="transition hover:text-white">How it works</Link>
              <Link href="/setup" className="transition hover:text-white">Setup</Link>
              <Link href="/dashboard" className="transition hover:text-white">Dashboard</Link>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-12 flex flex-col gap-3 border-t border-white/18 pt-6 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© 2026 DocMind. All rights reserved.</p>
          <p>Custom RAG chatbot builder for website knowledge.</p>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] decor-grid">
      <AppNav active="home" ctaHref="/setup" ctaLabel="Start setup" />

      <main>
        <section className="contour-lines mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.78fr)]">
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">Custom RAG website assistant</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[1.03] text-[color:var(--foreground)] md:text-7xl">
              Build a chatbot from your website knowledge.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)] md:text-xl">
              Upload PDFs with your website details, choose a supported model provider and API key, then embed a custom RAG chatbot into your site.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/setup"
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[color:var(--accent)] px-6 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
              >
                Build Your Chatbot
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 text-sm font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)]"
              >
                View Dashboard
              </Link>
            </div>
          </div>

          <div className="relative z-10">
            <RagBuilderVisual />
          </div>
        </section>

        <SectionFrame
          id="how-it-works"
          eyebrow="How it works"
          title="From website PDFs to an embedded assistant."
          description="The scroll follows the actual build path: add site knowledge, connect the model, then publish the widget."
        >
          <WorkflowStepper showNumbers={false} />
        </SectionFrame>

        <SectionFrame
          eyebrow="Builder inputs"
          title="Everything starts with your website details."
          description="Keep related setup actions grouped so users understand what information DocMind needs before it can create the chatbot."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {actionGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Surface key={group.title} className="flex min-h-[360px] flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-[8px] border border-[color:var(--border)] px-3 py-1 text-xs font-semibold uppercase text-[color:var(--muted)]">
                        {group.label}
                      </span>
                    </div>
                    <h3 className="mt-8 text-2xl font-bold text-[color:var(--foreground)]">{group.title}</h3>
                    <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">{group.description}</p>
                  </div>
                  <div className="mt-8 space-y-3">
                    {group.items.map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-2 text-sm text-[color:var(--foreground)]"
                      >
                        <CheckCircle2 className="h-4 w-4 text-[color:var(--success)]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </Surface>
              );
            })}
          </div>
        </SectionFrame>

        <SectionFrame
          eyebrow="Operate"
          title="Manage projects and embeds together."
          description="After setup, dashboard actions stay grouped around the project list, embed code, and live chatbot preview."
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
            <Surface className="min-w-0 overflow-hidden p-0">
              <div className="border-b border-[color:var(--border)] p-5">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-[color:var(--accent)]" />
                  <h3 className="text-xl font-bold text-[color:var(--foreground)]">Project dashboard</h3>
                </div>
              </div>
              <div className="space-y-3 p-5">
                {dashboardRows.map((row) => (
                  <div
                    key={row.name}
                    className="grid gap-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 sm:grid-cols-[1fr_auto]"
                  >
                    <div>
                      <p className="font-semibold text-[color:var(--foreground)]">{row.name}</p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">{row.meta}</p>
                    </div>
                    <span className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] px-3 text-xs font-semibold text-[color:var(--accent)]">
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </Surface>

            <Surface className="min-w-0 p-0">
              <div className="flex h-full flex-col justify-between p-6">
                <div>
                  <div className="flex items-center gap-3">
                    <Code2 className="h-5 w-5 text-[color:var(--accent)]" />
                    <h3 className="text-xl font-bold text-[color:var(--foreground)]">Embed package</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[color:var(--muted)]">
                    Copy one script tag from setup or any project card. The backend handles retrieval, provider calls, and history.
                  </p>
                </div>
                <pre className="mt-8 max-w-full overflow-x-auto rounded-[8px] border border-[color:var(--border)] bg-[color:var(--foreground)] p-5 text-xs leading-6 text-[color:var(--background)]">
                  {`<script src="https://api.example.com/widget.js?id=project_123"></script>`}
                </pre>
                <div className="mt-6 grid gap-3 text-sm text-[color:var(--muted)]">
                  <div className="flex items-center gap-3">
                    <UploadCloud className="h-4 w-4 text-[color:var(--cyan)]" />
                    Website PDFs become searchable retrieval context.
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
                    Restrictions and confidence handling stay attached.
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </SectionFrame>

        <SectionFrame
          eyebrow="Next step"
          title="Create the chatbot or manage existing builds."
          description="The page ends with only the two useful destinations so visitors do not have to hunt for the next action."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/setup"
              className="group rounded-[8px] border border-[color:var(--accent)] bg-[color:var(--accent)] p-6 text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--foreground)]"
            >
              <KeyRound className="h-6 w-6" />
              <h3 className="mt-8 text-2xl font-bold">Build a new RAG chatbot</h3>
              <p className="mt-3 text-sm leading-6 text-white/80">Upload website details, choose the provider/model, and copy the widget.</p>
              <span className="mt-8 inline-flex items-center text-sm font-semibold">
                Open setup
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>

            <Link
              href="/dashboard"
              className="group rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-[var(--shadow-soft)] transition hover:border-[color:var(--accent)]"
            >
              <FileText className="h-6 w-6 text-[color:var(--accent)]" />
              <h3 className="mt-8 text-2xl font-bold text-[color:var(--foreground)]">Manage existing projects</h3>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">Review projects, preview widgets, copy embeds, or delete a chatbot.</p>
              <span className="mt-8 inline-flex items-center text-sm font-semibold text-[color:var(--accent)]">
                Open dashboard
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </SectionFrame>
      </main>

      <FooterScene />
    </div>
  );
}
