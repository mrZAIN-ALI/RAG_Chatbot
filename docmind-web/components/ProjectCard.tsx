"use client";

import type { MouseEvent } from "react";
import { CheckCircle2, Copy, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ProjectCardProps {
  project: Project;
  selected?: boolean;
  deleting?: boolean;
  onSelect: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function ProjectCard({ project, selected, deleting = false, onDelete, onSelect }: ProjectCardProps) {
  const embedCode = `<script src="${API_BASE}/widget.js?id=${project.project_id}"></script>`;

  const handleCopy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied");
  };

  return (
    <article
      data-testid="project-card"
      className={[
        "group rounded-lg border bg-white p-4 shadow-sm transition",
        "hover:border-slate-300 hover:shadow-md",
        selected ? "border-slate-900 ring-2 ring-slate-900/10" : "border-slate-200",
        deleting ? "pointer-events-none opacity-70" : "",
      ].join(" ")}
      onClick={() => onSelect(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onSelect(project);
        }
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold text-slate-950">{project.name}</h2>
            {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{project.description || "No description"}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={deleting}>
          <Copy className="mr-1 h-4 w-4" />
          Copy embed code
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          aria-label={deleting ? `Deleting ${project.name}` : `Delete ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(project.project_id);
          }}
        >
          {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
          {deleting ? <span className="sr-only">Deleting</span> : "Delete"}
        </Button>
      </div>
    </article>
  );
}
