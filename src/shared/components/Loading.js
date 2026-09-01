"use client";

import { Skeleton as UISkeleton } from "./ui/skeleton";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

const SPINNER_SIZES = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
  xl: "size-12",
};

export function Spinner({ size = "md", className }) {
  return (
    <Icon
      name="progress_activity"
      className={cn("animate-spin text-primary", SPINNER_SIZES[size], className)}
    />
  );
}

export function PageLoading({ message = "Loading..." }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4"
    >
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function Skeleton({ className, ...props }) {
  return <UISkeleton className={className} {...props} />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-xs">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-md" />
      </div>
      <Skeleton className="mb-2 h-8 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Skeleton rows shaped like a data table, for a table's own loading state. */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-3 py-3.5">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn("h-4", colIndex === 0 ? "w-40" : "w-20", colIndex === columns - 1 && "ml-auto")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Loading({ type = "spinner", ...props }) {
  switch (type) {
    case "page":
      return <PageLoading {...props} />;
    case "skeleton":
      return <Skeleton {...props} />;
    case "card":
      return <CardSkeleton {...props} />;
    case "table":
      return <TableSkeleton {...props} />;
    default:
      return <Spinner {...props} />;
  }
}
