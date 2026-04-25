"use client";

import * as React from "react";
import Link from "next/link";
import { Bot, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type ActiveRoute = "home" | "setup" | "dashboard";

interface AppNavProps {
  active: ActiveRoute;
  ctaHref?: string;
  ctaLabel?: string;
}

const links = [
  { label: "How it works", href: "/#how-it-works", id: "home" },
  { label: "Setup", href: "/setup", id: "setup" },
  { label: "Dashboard", href: "/dashboard", id: "dashboard" },
] as const;

function LogoMark() {
  return (
    <span className="relative flex h-9 w-9 items-center justify-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)]">
      <Bot className="h-4 w-4 text-[color:var(--accent)]" />
      <span className="absolute -right-1 -top-1 h-2 w-2 rounded-[2px] bg-[color:var(--cyan)]" />
    </span>
  );
}

export function AppNav({ active, ctaHref = "/setup", ctaLabel = "New chatbot" }: AppNavProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--nav-bg)] backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
          <Link href="/" className="flex items-center gap-3 text-[color:var(--foreground)]">
            <LogoMark />
            <span className="text-base font-semibold">DocMind</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              onClick={() => setOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </nav>
      </header>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 text-white backdrop-blur-md"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-end px-5 md:px-8">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/20 bg-white/10 text-white shadow-[var(--shadow-soft)] transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5 pb-16">
            <div className="text-center" onClick={(event) => event.stopPropagation()}>
              <div className="space-y-5">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block text-5xl font-bold leading-tight text-white transition hover:text-[color:var(--accent)] md:text-7xl",
                      active === link.id ? "text-[color:var(--accent)]" : ""
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
                className="mt-10 inline-flex h-12 items-center justify-center rounded-[8px] bg-[color:var(--accent)] px-8 text-sm font-semibold text-white shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              {ctaLabel}
            </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
