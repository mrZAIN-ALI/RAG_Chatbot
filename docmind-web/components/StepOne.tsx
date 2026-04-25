"use client";

import { useState } from "react";
import { BrainCircuit, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createProject } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StepOneProps {
  onCreated: (projectId: string) => void;
}

type Tone = "Professional" | "Friendly" | "Technical";

export default function StepOne({ onCreated }: StepOneProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tone, setTone] = useState<Tone>("Professional");
  const [restrictedTopics, setRestrictedTopics] = useState("");
  const [provider, setProvider] = useState("gemini");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [apiKey, setApiKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const canContinue =
    name.trim().length > 0 &&
    provider.trim().length > 0 &&
    model.trim().length > 0 &&
    apiKey.trim().length > 0 &&
    !submitting;

  const handleContinue = async () => {
    if (!canContinue) return;
    const projectName = name.trim();
    try {
      setErrorMessage("");
      setStatusMessage("Creating chatbot...");
      setSubmitting(true);
      const result = await createProject({
        name: projectName,
        description: description.trim(),
        tone,
        restrictedTopics: restrictedTopics.trim(),
        provider: provider.trim(),
        model: model.trim(),
        apiKey: apiKey.trim(),
      });
      setStatusMessage("Chatbot created. Opening document upload...");
      localStorage.setItem("docmind_project_id", result.project_id);
      onCreated(result.project_id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create project.";
      setStatusMessage("");
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>Step 1 - Describe Your Bot</CardTitle>
            <CardDescription>Define the assistant identity, source boundaries, and model connection.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-name">
            Bot name
          </label>
          <Input id="bot-name" placeholder="Support Assistant" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-description">
            What should this bot know about?
          </label>
          <Textarea
            id="bot-description"
            placeholder="Product docs, pricing details, and onboarding FAQs..."
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-tone">
            Tone
          </label>
          <Select
            id="bot-tone"
            value={tone}
            onChange={(event) => setTone(event.target.value as Tone)}
            options={[
              { label: "Professional", value: "Professional" },
              { label: "Friendly", value: "Friendly" },
              { label: "Technical", value: "Technical" },
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="restricted-topics">
            Topics this bot should NOT answer
          </label>
          <Textarea
            id="restricted-topics"
            placeholder="Legal advice, health diagnosis, private account actions..."
            value={restrictedTopics}
            onChange={(event) => setRestrictedTopics(event.target.value)}
          />
        </div>

        <div className="grid gap-4 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 md:grid-cols-2">
          <div className="flex items-center gap-3 md:col-span-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">Provider connection</p>
              <p className="text-xs text-[color:var(--muted)]">Stored with the project configuration for backend chat calls.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-provider">
              AI provider
            </label>
            <Input
              id="bot-provider"
              placeholder="gemini"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-model">
              Model name
            </label>
            <Input
              id="bot-model"
              placeholder="gemini-2.5-flash"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-semibold text-[color:var(--foreground)]" htmlFor="bot-api-key">
              API key
            </label>
            <Input
              id="bot-api-key"
              type="password"
              placeholder="Provider API key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-[color:var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
            <ShieldCheck className="h-4 w-4 text-[color:var(--success)]" />
            Required: bot name, provider, model, and API key.
          </div>
          <Button disabled={!canContinue} onClick={handleContinue}>
            {submitting ? "Creating..." : "Continue"}
          </Button>
        </div>
        {statusMessage ? <p className="text-sm text-[color:var(--muted)]">{statusMessage}</p> : null}
        {errorMessage ? <p className="text-sm text-[color:var(--danger)]">{errorMessage}</p> : null}
      </CardContent>
    </Card>
  );
}
