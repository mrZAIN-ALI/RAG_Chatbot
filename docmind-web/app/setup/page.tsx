"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import StepOne from "@/components/StepOne";
import StepTwo from "@/components/StepTwo";
import StepThree from "@/components/StepThree";
import { Surface } from "@/components/Surface";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { Button } from "@/components/ui/button";

export default function SetupPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectId, setProjectId] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    const storedProjectId = localStorage.getItem("docmind_project_id") || "";
    if (storedProjectId) {
      queueMicrotask(() => {
        setProjectId(storedProjectId);
        setStep(2);
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] decor-grid">
      <AppNav active="setup" ctaHref="/dashboard" ctaLabel="Dashboard" />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <header className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--muted)]">
              <Link href="/" className="inline-flex items-center gap-2 transition hover:text-[color:var(--accent)]">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <Link href="/dashboard" className="inline-flex items-center gap-2 transition hover:text-[color:var(--accent)]">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </div>
            <p className="mt-8 text-sm font-semibold uppercase text-[color:var(--accent)]">Guided setup</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[color:var(--foreground)] md:text-6xl">
              Build Your Chatbot
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg">
              Move through configuration, document upload, and widget embed without leaving the setup context.
            </p>
          </div>

          <Surface className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">Current progress</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">Step {step} of 3</p>
            </div>
            {projectId ? (
              <div className="space-y-3">
                <p className="break-all rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-xs text-[color:var(--muted)]">
                  Project ID: {projectId}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem("docmind_project_id");
                    setProjectId("");
                    setStep(1);
                  }}
                >
                  Start new bot
                </Button>
              </div>
            ) : (
              <p className="text-sm leading-6 text-[color:var(--muted)]">
                Create a project first, then uploads and embed settings unlock automatically.
              </p>
            )}
          </Surface>
        </header>

        <section className="mt-10">
          <WorkflowStepper currentStep={step} compact />
        </section>

        <section className="mt-8">
          {step === 1 ? (
            <StepOne
              onCreated={(id) => {
                setProjectId(id);
                setStep(2);
              }}
            />
          ) : null}

          {step === 2 && projectId ? <StepTwo projectId={projectId} onContinue={() => setStep(3)} /> : null}

          {step === 3 && projectId ? <StepThree projectId={projectId} onDashboard={() => router.push("/dashboard")} /> : null}
        </section>
      </main>
    </div>
  );
}
