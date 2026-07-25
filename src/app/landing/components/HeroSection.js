"use client";
import Link from "next/link";
import CropFrame from "@/shared/components/CropFrame";

const CODE_LINES = [
  { type: "remove", text: 'client = OpenAI(api_key="sk-...")' },
  { type: "add", text: "client = OpenAI(" },
  { type: "add", text: '  base_url="https://api.router2k.ai/v1",' },
  { type: "add", text: '  api_key="sk-router2k-..."' },
  { type: "add", text: ")" },
  { type: "space", text: "" },
  { type: "plain", text: "# Everything else stays the same." },
  { type: "plain", text: "response = client.chat.completions.create(" },
  { type: "plain", text: '  model="router2k/auto",' },
  { type: "plain", text: '  messages=[{"role": "user", "content": "..."}]' },
  { type: "plain", text: ")" },
];

const METRICS = [
  ["200+", "models available"],
  ["0%", "token markup"],
  ["<50ms", "failover trigger"],
];

export default function HeroSection() {
  return (
    <section className="relative px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="max-w-2xl">
          <div className="section-label">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping bg-emerald-500 opacity-30" />
              <span className="relative inline-flex size-2 bg-emerald-500" />
            </span>
            OpenAI-compatible routing infrastructure
          </div>

          <h1 className="mt-6 font-mono text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-zinc-950 sm:text-6xl lg:text-[4.25rem]">
            One gateway for
            <span className="block">every AI model.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-zinc-600">
            Route each request by quality, cost, and availability. Router2k handles provider failover, policy enforcement, and usage visibility behind one production endpoint.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login?mode=register"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-zinc-950 px-6 font-mono text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
            >
              Get your API key
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-zinc-300 bg-white px-6 font-mono text-sm font-semibold text-zinc-800 transition-colors hover:border-zinc-950"
            >
              Open dashboard
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">dashboard</span>
            </Link>
          </div>

          <p className="mt-4 font-mono text-xs text-zinc-500">{"// "}no credit card required — configure in under a minute</p>

          <dl className="mt-9 grid grid-cols-3 border-t border-zinc-200">
            {METRICS.map(([value, label]) => (
              <div key={label} className="border-r border-zinc-200 py-5 pr-3 last:border-r-0">
                <dt className="font-mono text-2xl font-semibold tracking-tight text-zinc-950">{value}</dt>
                <dd className="mt-1 text-sm leading-5 text-zinc-500">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        <CropFrame className="relative mx-auto w-full max-w-xl border border-zinc-200 bg-white lg:mx-0">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center border border-zinc-200 bg-white text-zinc-950">
                <span className="material-symbols-outlined text-[17px]" aria-hidden="true">route</span>
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-zinc-950">POST /v1/chat/completions</p>
                <p className="mt-0.5 font-mono text-xs text-zinc-500">router2k/auto</p>
              </div>
            </div>
            <span className="ml-4 shrink-0 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-xs font-semibold text-emerald-700">200 OK</span>
          </div>

          <div className="p-5 sm:p-6">
            <p className="section-label mb-3">OpenAI SDK, only the endpoint changes</p>
            <pre className="terminal-block overflow-x-auto rounded-sm p-4 text-left leading-6">
              {CODE_LINES.map((line, index) => {
                const color = line.type === "add" ? "text-emerald-400" : line.type === "remove" ? "text-red-400" : "text-zinc-300";
                const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
                return (
                  <span key={`${line.text}-${index}`} className={`block ${color}`}>
                    {line.type === "space" ? " " : `${prefix}${line.text}`}
                  </span>
                );
              })}
            </pre>

            <div className="mt-5 border border-zinc-200 bg-zinc-50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-label !mb-0">Routing decision</p>
                  <p className="mt-1.5 font-mono text-sm font-semibold text-zinc-950">openai/gpt-5.6-sol</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs font-semibold text-emerald-700">Policy passed</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">42ms decision</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 border-t border-zinc-200 pt-4 font-mono text-xs text-zinc-700">
                <span className="material-symbols-outlined text-[16px] text-zinc-950" aria-hidden="true">verified_user</span>
                Failover armed, usage captured, 0% markup
              </div>
            </div>
          </div>
        </CropFrame>
      </div>
    </section>
  );
}
