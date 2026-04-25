import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}

export function SectionHeader({ eyebrow, title, description, align = "left" }: SectionHeaderProps) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "")}>
      <p className="text-sm font-semibold uppercase text-[color:var(--accent)]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight text-[color:var(--foreground)] md:text-5xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-[color:var(--muted)] md:text-lg">{description}</p>
      ) : null}
    </div>
  );
}
