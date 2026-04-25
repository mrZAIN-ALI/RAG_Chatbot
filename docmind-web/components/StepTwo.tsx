"use client";

import { useRef, useState } from "react";
import { FileCheck2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { uploadDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UploadResult {
  fileName: string;
  chunksStored: number;
}

interface StepTwoProps {
  projectId: string;
  onContinue: () => void;
}

export default function StepTwo({ projectId, onContinue }: StepTwoProps) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasSuccessfulUpload = results.length > 0;

  const handleContinue = () => {
    if (!hasSuccessfulUpload) return;
    setMessage("Opening widget setup...");
    onContinue();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      setMessage(`Uploading ${file.name}...`);
      setUploading(true);
      setProgress(35);
      const response = await uploadDocument(file, projectId);
      setProgress(100);
      setResults((previous) => [...previous, { fileName: file.name, chunksStored: response.chunks_stored }]);
      setMessage(`${file.name} uploaded. Continue is ready.`);
      toast.success(`${response.chunks_stored} chunks stored`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setMessage(message);
      toast.error(message);
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 250);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)]">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
            <UploadCloud className="h-5 w-5" />
          </span>
          <div>
            <CardTitle>Step 2 - Upload Documents</CardTitle>
            <CardDescription>Drop PDF, TXT, or DOCX files to build your chatbot knowledge base.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <label
          className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-[color:var(--border)] bg-[color:var(--surface-strong)] p-6 text-center transition hover:border-[color:var(--accent)] hover:bg-[color:var(--accent-soft)]"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud className="mb-4 h-9 w-9 text-[color:var(--accent)]" />
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Drag and drop files here</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">PDF, TXT, DOCX</p>
          <input
            ref={fileInputRef}
            className="hidden"
            type="file"
            accept=".pdf,.txt,.docx"
            aria-label="Upload document"
            onChange={(event) => {
              void handleFiles(event.target.files);
            }}
          />
        </label>

        {uploading ? (
          <div className="rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3">
            <div className="h-2 rounded-[8px] bg-[color:var(--accent-soft)]">
              <div
                className="h-2 rounded-[8px] bg-[color:var(--accent)] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Uploading... {progress}%</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {results.map((result, index) => (
            <div
              key={`${result.fileName}-${index}`}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-3 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2 text-[color:var(--foreground)]">
                <FileCheck2 className="h-4 w-4 shrink-0 text-[color:var(--success)]" />
                <span className="truncate">{result.fileName}: {result.chunksStored} chunks stored</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--border)] pt-5">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Add another file
          </Button>
          <Button disabled={!hasSuccessfulUpload} onClick={handleContinue}>
            Continue
          </Button>
        </div>
        {message ? <p className="text-sm text-[color:var(--muted)]">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
