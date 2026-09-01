"use client";

import { Spinner } from "@/shared/components";

/**
 * App-router default while a server-rendered page hydrates or a client page
 * re-fetches. Was missing before, so every navigation was a brief blank
 * surface.
 */
export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
    >
      <Spinner size="lg" />
      <span className="text-sm text-muted-foreground">Loading…</span>
    </div>
  );
}
