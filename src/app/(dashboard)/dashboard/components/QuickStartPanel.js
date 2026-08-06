"use client";

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Check, Copy } from "lucide-react";
import CropFrame from "@/shared/components/CropFrame";
import SectionLabel from "@/shared/components/SectionLabel";
import { APP_CONFIG } from "@/shared/constants/config";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

/** `r2k-abc…4f2a` → `r2k-••••••••4f2a`; never render the middle of a live key. */
function maskKey(key) {
  if (typeof key !== "string" || key.length < 8) return null;
  const dashAt = key.indexOf("-");
  const prefix = dashAt > 0 && dashAt <= 6 ? key.slice(0, dashAt + 1) : "";
  return `${prefix}${"•".repeat(12)}${key.slice(-4)}`;
}

/**
 * The one crop-marked panel on the dashboard (DESIGN.md reserves the ornament
 * for a single featured container). Left half is the endpoint an SDK points at,
 * right half is the two env vars that make that SDK talk to it.
 */
export default function QuickStartPanel({ apiKey }) {
  const [origin, setOrigin] = useState("");
  const { copied, copy } = useCopyToClipboard(1800);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const baseUrl = `${origin}/v1`;
  const keyDisplay = useMemo(() => maskKey(apiKey) || "<your-api-key>", [apiKey]);
  const exportBlock = `export OPENAI_BASE_URL=${baseUrl}\nexport OPENAI_API_KEY=${apiKey || "<your-api-key>"}`;

  return (
    <CropFrame>
      <div className="grid border border-border bg-surface lg:grid-cols-2">
        <div className="min-w-0 p-5 sm:p-6">
          <SectionLabel>Base URL</SectionLabel>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="gateway-base-url">
              Base URL
            </label>
            <input
              id="gateway-base-url"
              value={baseUrl}
              readOnly
              className="min-w-0 flex-1 rounded-sm border border-border bg-bg-alt px-3 py-2.5 font-mono text-sm text-text-main outline-none"
            />
            <button
              type="button"
              onClick={() => copy(baseUrl, "base-url")}
              className="flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-surface text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
              aria-label="Copy base URL"
              title="Copy base URL"
            >
              {copied === "base-url" ? (
                <Check aria-hidden size={16} strokeWidth={2.25} />
              ) : (
                <Copy aria-hidden size={16} strokeWidth={2.25} />
              )}
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            OpenAI-compatible. Point any SDK, CLI, or agent at this URL and authenticate with
            a {APP_CONFIG.name} key.
          </p>
        </div>

        <div className="min-w-0 border-t border-border p-5 sm:p-6 lg:border-l lg:border-t-0">
          <SectionLabel
            action={
              <button
                type="button"
                onClick={() => copy(exportBlock, "exports")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main"
              >
                {copied === "exports" ? (
                  <Check aria-hidden size={12} strokeWidth={2.5} />
                ) : (
                  <Copy aria-hidden size={12} strokeWidth={2.5} />
                )}
                {copied === "exports" ? "Copied" : "Copy"}
              </button>
            }
          >
            Quick start
          </SectionLabel>
          <div className="terminal-block overflow-x-auto rounded-sm px-3 py-2.5">
            <pre className="min-w-0">
              <code className="block whitespace-pre">
                <span className="terminal-prompt mr-2">$</span>
                export OPENAI_BASE_URL={baseUrl}
                {"\n"}
                <span className="terminal-prompt mr-2">$</span>
                export OPENAI_API_KEY={keyDisplay}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </CropFrame>
  );
}

QuickStartPanel.propTypes = { apiKey: PropTypes.string };
