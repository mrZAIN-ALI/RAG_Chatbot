"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
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
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Step 3 - Get Your Widget</CardTitle>
          <CardDescription>Copy and paste this script tag into your website HTML.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-md bg-slate-900 p-4 text-xs text-slate-100">{scriptTag}</pre>
          <Button onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy to clipboard"}
          </Button>
          <Button variant="outline" onClick={onDashboard}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>

      <ChatPreview projectId={projectId} />
    </div>
  );
}
