"use client";

import { cn } from "@/shared/utils/cn";

export default function SectionLabel({ children, action, className, lineClassName }) {
  return (
    <div className={cn("mb-3 flex items-center gap-3", className)}>
      <span className="section-label whitespace-nowrap">{children}</span>
      <span className={cn("h-px flex-1 bg-border", lineClassName)} aria-hidden />
      {action}
    </div>
  );
}
