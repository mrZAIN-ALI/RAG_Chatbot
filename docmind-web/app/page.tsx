import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Database,
  FileText,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { SectionHeader } from "@/components/SectionHeader";
import { Surface } from "@/components/Surface";
import { WorkflowStepper } from "@/components/WorkflowStepper";

const featureCards = [
  {
    title: "Model flexible",
    description: "Connect Gemini, Groq, or another provider without changing the website embed.",
    icon: Sparkles,
  },
  {
    title: "Document grounded",
    description: "Uploaded content is chunked, stored, and retrieved before answers are generated.",
    icon: FileText,
  },
  {
    title: "One script deploy",
    description: "Every chatbot ends with a copy-ready widget tag for any external website.",
    icon: Code2,
  },
  {
    title: "Controlled answers",
    description: "Tone, restricted topics, and confidence handling keep responses inside the brief.",
    icon: ShieldCheck,
  },
];

const previewRows = [
  { label: "Project", value: "Support Assistant" },
  { label: "Documents", value: "4 uploaded" },
  { label: "Widget", value: "Ready" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] decor-grid">
      <AppNav active="home" ctaHref="/setup" ctaLabel="Start setup" />

      <main>
        <section className="contour-lines mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(360px,0.74fr)]">
          <div className="relative z-10">
            <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">AI knowledge widgets</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[1.03] text-[color:var(--foreground)] md:text-7xl">
              DocMind turns your documents into a website chatbot.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:var(--muted)] md:text-xl">
              Build a branded assistant, upload source material, and ship an embeddable chat widget without
              rebuilding your site.
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

            <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-3">
              {["3 guided steps", "Real backend", "Any website"].map((item) => (
                <div
                  key={item}
                  className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm font-semibold text-[color:var(--foreground)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10">
            <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] backdrop-blur">
              <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[color:var(--accent)]">Live widget</p>
                    <h2 className="mt-2 text-2xl font-bold text-[color:var(--foreground)]">Ask DocMind</h2>
                  </div>
                  <MessageCircle className="h-8 w-8 text-[color:var(--cyan)]" />
                </div>
                <div className="mt-8 space-y-3">
                  <div className="max-w-[84%] rounded-[8px] bg-[color:var(--accent-soft)] p-4 text-sm text-[color:var(--foreground)]">
                    How do customers return an unused product?
                  </div>
                  <div className="ml-auto max-w-[88%] rounded-[8px] border border-[color:var(--border)] bg-[color:var(--background)] p-4 text-sm leading-6 text-[color:var(--muted)]">
                    The assistant searches your uploaded policy, answers with source-grounded context, and keeps the
                    visitor inside your approved support scope.
                  </div>
                </div>
                <div className="mt-8 grid gap-3">
                  {previewRows.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-[8px] border border-[color:var(--border)] px-4 py-3 text-sm"
                    >
                      <span className="text-[color:var(--muted)]">{row.label}</span>
                      <span className="font-semibold text-[color:var(--foreground)]">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8">
          <SectionHeader
            eyebrow="How it works"
            title="A complete chatbot workflow without loose ends."
            description="The UI follows the same path your users expect: configure the bot, upload knowledge, then copy the deployable widget."
            align="center"
          />
          <div className="mt-12">
            <WorkflowStepper />
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-20 md:px-8 lg:grid-cols-[0.78fr_1.22fr]">
          <SectionHeader
            eyebrow="Built for RAG"
            title="Useful controls, not decoration."
            description="DocMind keeps the setup approachable while preserving the real decisions that make a document chatbot reliable."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <Surface key={feature.title} className="min-h-48">
                  <Icon className="h-6 w-6 text-[color:var(--accent)]" />
                  <h3 className="mt-6 text-xl font-semibold text-[color:var(--foreground)]">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{feature.description}</p>
                </Surface>
              );
            })}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-20 md:px-8 lg:grid-cols-2">
          <Surface className="min-h-[420px] min-w-0 overflow-hidden p-0">
            <div className="border-b border-[color:var(--border)] p-5">
              <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">Dashboard preview</p>
              <h2 className="mt-2 text-2xl font-bold text-[color:var(--foreground)]">Projects stay connected.</h2>
            </div>
            <div className="space-y-3 p-5">
              {["Support Assistant", "Onboarding Bot", "Policy Guide"].map((name, index) => (
                <div
                  key={name}
                  className="grid gap-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-[color:var(--foreground)]">{name}</p>
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {index + 2} documents indexed and widget script ready
                    </p>
                  </div>
                  <span className="inline-flex h-8 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] px-3 text-xs font-semibold text-[color:var(--accent)]">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </Surface>

          <Surface className="min-h-[420px] min-w-0 p-0">
            <div className="flex h-full flex-col justify-between p-6">
              <div>
                <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">Embed preview</p>
                <h2 className="mt-3 text-3xl font-bold leading-tight text-[color:var(--foreground)]">
                  One script tag connects every website.
                </h2>
              </div>
              <pre className="mt-10 max-w-full overflow-x-auto rounded-[8px] border border-[color:var(--border)] bg-[color:var(--foreground)] p-5 text-xs leading-6 text-[color:var(--background)]">
                {`<script src="https://api.example.com/widget.js?id=project_123"></script>`}
              </pre>
              <div className="mt-6 flex items-center gap-3 text-sm text-[color:var(--muted)]">
                <Database className="h-4 w-4 text-[color:var(--cyan)]" />
                FastAPI, Supabase, retrieval, and provider calls stay behind the widget.
              </div>
            </div>
          </Surface>
        </section>

        <section className="mx-auto w-full max-w-7xl px-5 py-20 md:px-8">
          <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--foreground)] p-8 text-[color:var(--background)] shadow-[var(--shadow-soft)] md:p-12">
            <p className="text-sm font-semibold uppercase text-[color:var(--cyan)]">Ready for manual testing</p>
            <div className="mt-4 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <h2 className="max-w-3xl text-3xl font-bold leading-tight md:text-5xl">
                Create a bot, upload a document, copy the widget, and inspect the dashboard.
              </h2>
              <Link
                href="/setup"
                className="inline-flex h-12 items-center justify-center rounded-[8px] bg-[color:var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
              >
                Start Building
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
