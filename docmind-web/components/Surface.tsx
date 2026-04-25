import * as React from "react";
import { cn } from "@/lib/utils";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "strong" | "accent";
}

export function Surface({ className, tone = "default", ...props }: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-[8px] border p-5 shadow-[var(--shadow-soft)] backdrop-blur",
        tone === "default" ? "border-[color:var(--border)] bg-[color:var(--surface)]" : "",
        tone === "strong" ? "border-[color:var(--border)] bg-[color:var(--surface-strong)]" : "",
        tone === "accent" ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]" : "",
        className
      )}
      {...props}
    />
  );
}
