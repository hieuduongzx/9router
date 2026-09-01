"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CropFrame from "@/shared/components/CropFrame";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { Icon } from "@/shared/components/ui/icon";

const CLIENTS = [
  { id: "python", label: "Python" },
  { id: "node", label: "Node.js" },
  { id: "curl", label: "cURL" },
];

function buildSnippet(client, baseUrl) {
  if (client === "node") {
    return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.ROUTER2K_API_KEY,
});

const response = await client.chat.completions.create({
  model: "your-model-id",
  messages: [{ role: "user", content: "Hello" }],
});`;
  }

  if (client === "curl") {
    return `curl "${baseUrl}/chat/completions" \\
  -H "Authorization: Bearer $ROUTER2K_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "your-model-id",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`;
  }

  return `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ["ROUTER2K_API_KEY"],
)

response = client.chat.completions.create(
    model="your-model-id",
    messages=[{"role": "user", "content": "Hello"}],
)`;
}

export default function EndpointSection() {
  const [baseUrl, setBaseUrl] = useState("/v1");
  const [activeClient, setActiveClient] = useState("python");
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setBaseUrl(`${window.location.origin}/v1`), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const snippet = useMemo(() => buildSnippet(activeClient, baseUrl), [activeClient, baseUrl]);

  return (
    <section id="endpoint" className="scroll-mt-16 px-5 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div>
            <p className="section-label">API endpoint</p>
            <h2 className="mt-3 text-balance font-mono text-3xl font-semibold tracking-[-0.025em] text-foreground sm:text-4xl lg:text-5xl">
              Start calling the API.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Use your Router2k API key, choose a published model ID, and send a standard OpenAI-compatible request.
            </p>

            <div className="mt-8 border border-border">
              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3">
                <span className="text-xs font-medium text-muted-foreground">Base URL</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-success">
                  <span className="size-1.5 bg-success" />
                  CURRENT ENDPOINT
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 p-3">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap bg-foreground px-3 py-2.5 font-mono text-xs text-white">
                  {baseUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(baseUrl, "landing-base-url")}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-border bg-white text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                  aria-label="Copy API base URL"
                >
                  <Icon name={copied === "landing-base-url" ? "check" : "content_copy"} className="size-[18px]" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <CropFrame className="min-w-0 self-start border border-border bg-white">
            <div className="flex flex-col border-b border-border bg-muted sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center px-4 py-3">
                <span className="font-mono text-xs font-semibold text-foreground">quickstart</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">/ client setup</span>
              </div>
              <div className="flex border-t border-border sm:border-l sm:border-t-0">
                {CLIENTS.map((client) => (
                  <button
                    type="button"
                    key={client.id}
                    onClick={() => setActiveClient(client.id)}
                    className={`h-10 border-r border-border px-4 font-mono text-xs font-semibold last:border-r-0 sm:h-12 ${
                      activeClient === client.id
                        ? "bg-foreground text-white"
                        : "bg-white text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {client.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative bg-foreground">
              <pre className="min-h-[330px] overflow-x-auto p-5 pb-16 font-mono text-[12px] leading-6 text-muted-foreground sm:p-6 sm:pb-16">
                <code>{snippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => copy(snippet, "landing-snippet")}
                className="absolute bottom-4 right-4 inline-flex h-9 items-center gap-2 rounded-sm border border-foreground/30 bg-foreground px-3 font-mono text-xs font-semibold text-muted-foreground transition-colors hover:border-foreground/15 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <Icon name={copied === "landing-snippet" ? "check" : "content_copy"} className="size-[16px]" aria-hidden="true" />
                {copied === "landing-snippet" ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">Replace <code className="font-mono text-xs text-foreground">your-model-id</code> with a published model.</p>
              <Link href="/dashboard/endpoint" className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground hover:underline">
                Endpoint reference
                <Icon name="arrow_outward" className="size-[15px]" aria-hidden="true" />
              </Link>
            </div>
          </CropFrame>
        </div>
      </div>
    </section>
  );
}
