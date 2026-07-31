"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CropFrame from "@/shared/components/CropFrame";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

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
            <h2 className="mt-3 text-balance font-mono text-3xl font-semibold tracking-[-0.025em] text-zinc-950 sm:text-4xl lg:text-5xl">
              Start calling the API.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600">
              Use your Router2k API key, choose a published model ID, and send a standard OpenAI-compatible request.
            </p>

            <div className="mt-8 border border-zinc-200">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Base URL</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-emerald-700">
                  <span className="size-1.5 bg-emerald-500" />
                  CURRENT ENDPOINT
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2 p-3">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap bg-zinc-950 px-3 py-2.5 font-mono text-xs text-white">
                  {baseUrl}
                </code>
                <button
                  type="button"
                  onClick={() => copy(baseUrl, "landing-base-url")}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-950 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
                  aria-label="Copy API base URL"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {copied === "landing-base-url" ? "check" : "content_copy"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <CropFrame className="min-w-0 self-start border border-zinc-200 bg-white">
            <div className="flex flex-col border-b border-zinc-200 bg-zinc-50 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center px-4 py-3">
                <span className="font-mono text-xs font-semibold text-zinc-950">quickstart</span>
                <span className="ml-2 font-mono text-xs text-zinc-400">/ client setup</span>
              </div>
              <div className="flex border-t border-zinc-200 sm:border-l sm:border-t-0">
                {CLIENTS.map((client) => (
                  <button
                    type="button"
                    key={client.id}
                    onClick={() => setActiveClient(client.id)}
                    className={`h-10 border-r border-zinc-200 px-4 font-mono text-xs font-semibold last:border-r-0 sm:h-12 ${
                      activeClient === client.id
                        ? "bg-zinc-950 text-white"
                        : "bg-white text-zinc-500 hover:text-zinc-950"
                    }`}
                  >
                    {client.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative bg-zinc-950">
              <pre className="min-h-[330px] overflow-x-auto p-5 pb-16 font-mono text-[12px] leading-6 text-zinc-200 sm:p-6 sm:pb-16">
                <code>{snippet}</code>
              </pre>
              <button
                type="button"
                onClick={() => copy(snippet, "landing-snippet")}
                className="absolute bottom-4 right-4 inline-flex h-9 items-center gap-2 rounded-sm border border-zinc-700 bg-zinc-900 px-3 font-mono text-xs font-semibold text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {copied === "landing-snippet" ? "check" : "content_copy"}
                </span>
                {copied === "landing-snippet" ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex flex-col gap-3 border-t border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-zinc-500">Replace <code className="font-mono text-xs text-zinc-800">your-model-id</code> with a published model.</p>
              <Link href="/dashboard/endpoint" className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-zinc-950 hover:underline">
                Endpoint reference
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_outward</span>
              </Link>
            </div>
          </CropFrame>
        </div>
      </div>
    </section>
  );
}
