"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Bot, Menu, X } from "lucide-react";
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

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-[8px] px-3 py-2 text-sm font-medium text-[color:var(--muted)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]",
        active ? "bg-[color:var(--surface-strong)] text-[color:var(--foreground)] shadow-[var(--shadow-soft)]" : ""
      )}
    >
      {label}
    </Link>
  );
}

export function AppNav({ active, ctaHref = "/setup", ctaLabel = "New chatbot" }: AppNavProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--border)] bg-[color:var(--nav-bg)] backdrop-blur-xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-3 text-[color:var(--foreground)]">
          <LogoMark />
          <span className="text-base font-semibold">DocMind</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={active === link.id}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={ctaHref}
            className="hidden h-10 items-center justify-center rounded-[8px] bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)] transition hover:bg-[color:var(--accent)] hover:text-white md:inline-flex"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {ctaLabel}
          </Link>
          <ThemeToggle />
          <button
            type="button"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setOpen((current) => !current)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] md:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={active === link.id}
                onClick={() => setOpen(false)}
              />
            ))}
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-[8px] bg-[color:var(--foreground)] px-4 text-sm font-semibold text-[color:var(--background)]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
