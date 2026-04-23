"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import ChatPreview from "@/components/ChatPreview";
import ProjectCard from "@/components/ProjectCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteProject, getProjects, type Project } from "@/lib/api";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [deletingProjectIds, setDeletingProjectIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const items = await getProjects();
        setProjects(items);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not load projects.";
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProjects();
  }, []);

  const selectedProject = useMemo(
    () => projects.find((project) => project.project_id === selectedProjectId),
    [projects, selectedProjectId]
  );

  const handleDelete = async (projectId: string) => {
    if (deletingProjectIds.has(projectId)) return;

    setDeletingProjectIds((previous) => new Set(previous).add(projectId));
    try {
      await deleteProject(projectId);
      setProjects((previous) => {
        const remaining = previous.filter((project) => project.project_id !== projectId);
        setSelectedProjectId((current) => (current === projectId ? undefined : current));
        return remaining;
      });
      toast.success("Project deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not delete project.";
      toast.error(message);
    } finally {
      setDeletingProjectIds((previous) => {
        const next = new Set(previous);
        next.delete(projectId);
        return next;
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-slate-950">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm text-slate-300">DocMind</p>
                <h1 className="text-2xl font-semibold tracking-tight">Project Dashboard</h1>
              </div>
            </div>
          </div>
          <Link
            href="/setup"
            className="inline-flex h-10 items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-100"
          >
            <Plus className="mr-2 h-4 w-4" />
            New chatbot
          </Link>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Your Projects</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{projects.length} chatbot{projects.length === 1 ? "" : "s"} configured</p>
              </div>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 bg-slate-50/70 p-4">
            {loading ? <p className="text-sm text-slate-600">Loading projects...</p> : null}

            {!loading && projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="text-sm font-medium text-slate-900">No projects yet.</p>
                <Link href="/setup" className="mt-2 inline-flex text-sm font-semibold text-slate-900 underline">
                  Build your first chatbot
                </Link>
              </div>
            ) : null}

            {projects.map((project) => (
              <ProjectCard
                key={project.project_id}
                project={project}
                selected={project.project_id === selectedProjectId}
                deleting={deletingProjectIds.has(project.project_id)}
                onSelect={(item) => setSelectedProjectId(item.project_id)}
                onDelete={handleDelete}
              />
            ))}
          </CardContent>
        </Card>

        <ChatPreview projectId={selectedProject?.project_id} projectName={selectedProject?.name} />
      </div>
    </main>
  );
}
