"use client";

import { cn } from "@/shared/utils/cn";

/**
 * Group heading with a trailing hairline rule.
 *
 * Old system: `text-xs font-medium text-muted-foreground` — an
 * uppercase tracked mono caption above each section. Repeated across the
 * dashboard, it was legible only when you already knew what you were looking
 * at. Replaced with a plain semibold sans label: the trailing rule does the
 * grouping work, so the type itself can stay readable.
 */
export default function SectionLabel({ children, action, className, lineClassName }) {
  return (
    <div className={cn("mb-3 flex items-center gap-3", className)}>
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      <span className={cn("h-px flex-1 bg-border", lineClassName)} aria-hidden />
      {action}
    </div>
  );
}
