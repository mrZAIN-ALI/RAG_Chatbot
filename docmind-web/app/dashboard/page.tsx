"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, LayoutDashboard, Plus, RefreshCw, Server, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppNav } from "@/components/AppNav";
import ChatPreview from "@/components/ChatPreview";
import ProjectCard from "@/components/ProjectCard";
import { Surface } from "@/components/Surface";
import { Button } from "@/components/ui/button";
import { deleteProject, getProjects, type Project } from "@/lib/api";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [deletingProjectIds, setDeletingProjectIds] = useState<Set<string>>(new Set());

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getProjects();
      setProjects(items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load projects.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadProjects();
      }
    });

    return () => {
      active = false;
    };
  }, [loadProjects]);

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
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)] decor-grid">
      <AppNav active="dashboard" ctaHref="/setup" ctaLabel="New chatbot" />

      <main className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
        <header className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">Project console</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-[color:var(--foreground)] md:text-6xl">
              Dashboard
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)] md:text-lg">
              Manage every chatbot, copy embed scripts, preview the widget, and remove projects without leaving the page.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={loadProjects} disabled={loading}>
              <RefreshCw className={loading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
              Refresh
            </Button>
            <Link
              href="/setup"
              className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              <Plus className="mr-2 h-4 w-4" />
              New chatbot
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Surface className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-[color:var(--foreground)]">{projects.length}</p>
              <p className="text-sm text-[color:var(--muted)]">Configured chatbots</p>
            </div>
          </Surface>
          <Surface className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <LayoutDashboard className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-[color:var(--foreground)]">
                {selectedProject ? "1" : "0"}
              </p>
              <p className="text-sm text-[color:var(--muted)]">Live previews selected</p>
            </div>
          </Surface>
          <Surface className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
              <Server className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-[color:var(--foreground)]">API</p>
              <p className="text-sm text-[color:var(--muted)]">Connected through backend</p>
            </div>
          </Surface>
        </section>

        <div className="mt-8 grid w-full gap-6 lg:grid-cols-[minmax(300px,0.58fr)_minmax(560px,1.42fr)]">
          <Surface className="overflow-hidden p-0">
            <div className="border-b border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[color:var(--foreground)]">Your Projects</h2>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {projects.length} chatbot{projects.length === 1 ? "" : "s"} configured
                  </p>
                </div>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin text-[color:var(--accent)]" /> : null}
              </div>
            </div>

            <div className="space-y-3 p-4">
              {loading ? <p className="text-sm text-[color:var(--muted)]">Loading projects...</p> : null}

              {!loading && projects.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-strong)] p-8 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-[color:var(--accent)]" />
                  <p className="mt-4 text-sm font-semibold text-[color:var(--foreground)]">No projects yet.</p>
                  <Link
                    href="/setup"
                    className="mt-2 inline-flex text-sm font-semibold text-[color:var(--accent)] underline"
                  >
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
            </div>
          </Surface>

          <ChatPreview projectId={selectedProject?.project_id} projectName={selectedProject?.name} />
        </div>
      </main>
    </div>
  );
}
