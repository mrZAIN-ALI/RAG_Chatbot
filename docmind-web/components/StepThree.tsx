"use client";

import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ChatPreview from "@/components/ChatPreview";

interface StepThreeProps {
  projectId: string;
  onDashboard: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function StepThree({ projectId, onDashboard }: StepThreeProps) {
  const [copied, setCopied] = useState(false);

  const scriptTag = useMemo(
    () => `<script src="${API_BASE}/widget.js?id=${projectId}"></script>`,
    [projectId]
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.86fr)_minmax(360px,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <ExternalLink className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>Step 3 - Get Your Widget</CardTitle>
              <CardDescription>Copy and paste this script tag into your website HTML.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          <pre className="overflow-x-auto rounded-[8px] border border-[color:var(--border)] bg-[color:var(--foreground)] p-4 text-xs leading-6 text-[color:var(--background)]">
            {scriptTag}
          </pre>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleCopy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy to clipboard"}
            </Button>
            <Button variant="outline" onClick={onDashboard}>
              Go to Dashboard
            </Button>
          </div>
          <p className="text-sm leading-6 text-[color:var(--muted)]">
            The widget uses the project configuration saved in Step 1 and the documents uploaded in Step 2.
          </p>
        </CardContent>
      </Card>

      <ChatPreview projectId={projectId} />
    </div>
  );
}
