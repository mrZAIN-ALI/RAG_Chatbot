"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
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
    <Card>
      <CardHeader>
        <CardTitle>Step 2 - Upload Documents</CardTitle>
        <CardDescription>Drop PDF, TXT, or DOCX files to build your chatbot knowledge base.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFiles(event.dataTransfer.files);
          }}
        >
          <UploadCloud className="mb-3 h-8 w-8 text-slate-500" />
          <p className="text-sm font-medium text-slate-700">Drag and drop files here</p>
          <p className="mt-1 text-xs text-slate-500">PDF, TXT, DOCX</p>
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

        {uploading ? <p className="text-sm text-slate-600">Uploading... {progress}%</p> : null}

        <div className="space-y-2">
          {results.map((result, index) => (
            <p key={`${result.fileName}-${index}`} className="text-sm text-slate-700">
              {result.fileName}: {result.chunksStored} chunks stored
            </p>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Add another file
          </Button>
          <Button disabled={!hasSuccessfulUpload} onClick={handleContinue}>
            Continue
          </Button>
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
