"use client";

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Check, Copy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { APP_CONFIG } from "@/shared/constants/config";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

/** `r2k-abc…4f2a` → `r2k-••••••••4f2a`; never render the middle of a live key. */
function maskKey(key) {
  if (typeof key !== "string" || key.length < 8) return null;
  const dashAt = key.indexOf("-");
  const prefix = dashAt > 0 && dashAt <= 6 ? key.slice(0, dashAt + 1) : "";
  return `${prefix}${"•".repeat(12)}${key.slice(-4)}`;
}

/** The endpoint and two environment variables needed to call the gateway. */
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
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="grid lg:grid-cols-2">
        <section className="min-w-0">
          <CardHeader className="flex min-h-16 flex-row items-center px-6 py-4">
            <CardTitle className="text-base">Base URL</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="gateway-base-url">
              Base URL
            </label>
            <Input
              id="gateway-base-url"
              value={baseUrl}
              readOnly
              className="min-w-0 flex-1 font-mono"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy(baseUrl, "base-url")}
              aria-label="Copy base URL"
              title="Copy base URL"
            >
              {copied === "base-url" ? (
                <Check aria-hidden size={16} strokeWidth={2.25} />
              ) : (
                <Copy aria-hidden size={16} strokeWidth={2.25} />
              )}
            </Button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            OpenAI-compatible. Point any SDK, CLI, or agent at this URL and authenticate with
            a {APP_CONFIG.name} key.
          </p>
          </CardContent>
        </section>

        <section className="min-w-0 border-t lg:border-l lg:border-t-0">
          <CardHeader className="flex min-h-16 flex-row items-center justify-between gap-3 px-6 py-4">
            <CardTitle className="text-base">Quick start</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy(exportBlock, "exports")}
              >
                {copied === "exports" ? (
                  <Check aria-hidden size={12} strokeWidth={2.5} />
                ) : (
                  <Copy aria-hidden size={12} strokeWidth={2.5} />
                )}
                {copied === "exports" ? "Copied" : "Copy"}
              </Button>
          </CardHeader>
          <CardContent className="pb-6">
          <div className="terminal-block overflow-x-auto px-3 py-2.5">
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
          </CardContent>
        </section>
      </div>
    </Card>
  );
}

QuickStartPanel.propTypes = { apiKey: PropTypes.string };
