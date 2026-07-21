"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      <div className="flex flex-col gap-3 border-b border-border-subtle px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[19px]">api</span>
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-text-main">API endpoint</h2>
            <p className="mt-0.5 text-xs text-text-muted">OpenAI-compatible access on this Router2k instance</p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
          <span className="size-1.5 rounded-full bg-success" />
          Local endpoint
        </span>
      </div>

      <div className="px-5 py-4">
        <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-muted" htmlFor="local-api-endpoint">
          Base URL
        </label>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <input
            id="local-api-endpoint"
            value={baseUrl}
            readOnly
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg-alt px-3 py-2 font-mono text-xs text-text-main outline-none"
          />
          <button
            type="button"
            onClick={() => copy(baseUrl, "local-endpoint")}
            className="flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Copy local API endpoint"
            title="Copy local API endpoint"
          >
            <span className="material-symbols-outlined text-[18px]">{copied === "local-endpoint" ? "check" : "content_copy"}</span>
          </button>
        </div>
        <p className="mt-2 text-xs text-text-muted">Use an active API key with every request.</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle bg-bg-alt/60 px-5 py-3">
        <Link href="/dashboard/api-keys" className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-300">
          Manage API keys
        </Link>
        <Link href="/dashboard/cli-tools" className="text-xs font-medium text-text-muted hover:text-text-main">
          Configure CLI tools
        </Link>
      </div>
    </Card>
  );
}
