"use client";

import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Empty / zero state. Pages were each rolling their own centred div, so the
 * copy hierarchy and spacing drifted; this fixes the shape and makes the
 * primary action a required-looking slot so an empty state offers a way out
 * instead of only stating a fact.
 */
export default function EmptyState({
  icon = "layers",
  title,
  description,
  action,
  className,
  compact = false,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "flex items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground",
            compact ? "size-9" : "size-12",
          )}
        >
          <Icon name={icon} className={compact ? "size-4" : "size-5"} />
        </span>
      ) : null}
      {title ? (
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
          {title}
        </p>
      ) : null}
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className={compact ? "mt-1" : "mt-2"}>{action}</div> : null}
    </div>
  );
}
