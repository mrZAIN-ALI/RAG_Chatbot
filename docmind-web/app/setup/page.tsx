"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StepOne from "@/components/StepOne";
import StepTwo from "@/components/StepTwo";
import StepThree from "@/components/StepThree";
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
    <main className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Build Your Chatbot</h1>
          <p className="mt-2 text-sm text-slate-600">Step {step} of 3</p>
        </div>
        {projectId ? (
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
        ) : null}
      </header>

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
    </main>
  );
}
