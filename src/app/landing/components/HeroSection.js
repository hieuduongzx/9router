"use client";
import Link from "next/link";

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

export default function HeroSection() {
  return (
    <section className="relative px-6 pb-12 pt-36 sm:pt-40 lg:pb-16">
      <div className="mx-auto flex max-w-7xl flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3 py-1 text-xs font-bold text-zinc-700 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
          Zero markup. Higher availability. Better prices.
        </div>

        <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.96] tracking-[-0.055em] text-zinc-950 md:text-7xl lg:text-8xl">
          One Gateway.
          <span className="block">Every Model.</span>
          <span className="block text-blue-600">Route Smarter. Ship Safer. Spend Less.</span>
        </h1>

        <p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-zinc-600 md:text-xl">
          Router2k grades every prompt and routes it intelligently. Adaptive routing, load balancing, guardrails, observability, and governance — all through a single OpenAI-compatible endpoint.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login?mode=register"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-zinc-950 px-7 text-sm font-bold text-white shadow-xl shadow-blue-950/15 transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 sm:w-auto"
          >
            Get your API key →
          </Link>
          <a
            href="#models"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white px-7 text-sm font-bold text-zinc-800 shadow-sm transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:w-auto"
          >
            Browse models
          </a>
        </div>

        <p className="mt-4 text-sm font-medium text-zinc-500">No credit card · live in 60 seconds</p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {[
            "Adaptive routing",
            "OpenAI-compatible",
            "0% token markup",
          ].map((item) => (
            <span key={item} className="rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-zinc-600 shadow-sm">
              {item}
            </span>
          ))}
        </div>

        <div className="landing-float relative mt-12 w-full max-w-4xl">
          <div className="absolute -inset-6 rounded-[2rem] bg-blue-500/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-2xl shadow-blue-950/12">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
              <div className="size-3 rounded-full bg-red-400" />
              <div className="size-3 rounded-full bg-amber-400" />
              <div className="size-3 rounded-full bg-emerald-400" />
              <div className="ml-3 flex items-center gap-4 text-xs font-bold text-zinc-500">
                <span className="border-b-2 border-blue-600 pb-3 text-blue-700">Python</span>
                <span>TypeScript</span>
                <span>cURL</span>
              </div>
            </div>
            <pre className="overflow-x-auto bg-white p-5 text-left font-mono text-[12px] leading-6 text-zinc-700 sm:text-sm">
              {CODE_LINES.map((line, index) => {
                const color = line.type === "add" ? "text-emerald-700" : line.type === "remove" ? "text-rose-600" : "text-zinc-500";
                const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
                return (
                  <span key={`${line.text}-${index}`} className={`block ${color}`}>
                    {line.type === "space" ? "\u00A0" : `${prefix}${line.text}`}
                  </span>
                );
              })}
            </pre>
            <div className="border-t border-zinc-200 bg-blue-50/70 px-5 py-4 text-sm font-medium text-zinc-700">
              One line. Router2k grades the prompt, routes to the best model, and adds $0.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
