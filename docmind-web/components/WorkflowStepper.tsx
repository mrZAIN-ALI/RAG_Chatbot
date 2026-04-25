import { Check, FileUp, MessageSquareCode, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkflowStep {
  id: number;
  title: string;
  description: string;
}

const defaultSteps: WorkflowStep[] = [
  {
    id: 1,
    title: "Configure",
    description: "Name the assistant, choose tone, set limits, and connect a provider.",
  },
  {
    id: 2,
    title: "Upload",
    description: "Add source documents and store searchable chunks in the backend.",
  },
  {
    id: 3,
    title: "Embed",
    description: "Copy one script tag and launch the chatbot on any website.",
  },
];

const icons = {
  1: Settings2,
  2: FileUp,
  3: MessageSquareCode,
} as const;

export function WorkflowStepper({
  currentStep,
  steps = defaultSteps,
  compact = false,
}: {
  currentStep?: number;
  steps?: WorkflowStep[];
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-3", compact ? "md:grid-cols-3" : "lg:grid-cols-3")}>
      {steps.map((step) => {
        const Icon = icons[step.id as keyof typeof icons] ?? Check;
        const isComplete = currentStep ? step.id < currentStep : false;
        const isActive = currentStep ? step.id === currentStep : false;

        return (
          <article
            key={step.id}
            className={cn(
              "rounded-[8px] border bg-[color:var(--surface)] p-4 shadow-[var(--shadow-soft)] transition",
              isActive ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-[8px] border",
                  isComplete
                    ? "border-[color:var(--success)] bg-[color:var(--success)] text-white"
                    : "border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--accent)]"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <div>
                <p className="text-xs font-semibold text-[color:var(--muted)]">Step {step.id}</p>
                <h3 className="text-base font-semibold text-[color:var(--foreground)]">{step.title}</h3>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{step.description}</p>
          </article>
        );
      })}
    </div>
  );
}
