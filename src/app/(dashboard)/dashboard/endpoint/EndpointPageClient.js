"use client";

import { useEffect, useState } from "react";
import Card from "@/shared/components/Card";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function EndpointPageClient() {
  const [baseUrl, setBaseUrl] = useState("/v1");
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setBaseUrl(`${window.location.origin}/v1`), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Card padding="none" className="min-w-0 overflow-hidden">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 shrink-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-surface-2 text-text-main">
            <span className="material-symbols-outlined text-[18px]">api</span>
          </span>
          <h2 className="font-mono text-sm font-semibold text-text-main">API endpoint</h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-success">
            <span className="size-1.5 rounded-full bg-success" />
            Local
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label className="sr-only" htmlFor="local-api-endpoint">
            Base URL
          </label>
          <input
            id="local-api-endpoint"
            value={baseUrl}
            readOnly
            className="min-w-0 flex-1 rounded-sm border border-border bg-bg-alt px-3 py-1.5 font-mono text-xs text-text-main outline-none"
          />
          <button
            type="button"
            onClick={() => copy(baseUrl, "local-endpoint")}
            className="flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Copy local API endpoint"
            title="Copy local API endpoint"
          >
            <span className="material-symbols-outlined text-[17px]">{copied === "local-endpoint" ? "check" : "content_copy"}</span>
          </button>
        </div>
      </div>
    </Card>
  );
}
