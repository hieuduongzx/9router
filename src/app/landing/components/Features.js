"use client";

const FEATURES = [
  ["route", "Adaptive routing", "Grade every prompt and route it to the best model for cost, quality, latency, or a custom objective."],
  ["sync_alt", "Load balancing", "Spread requests across healthy providers and fail over before transient upstream outages reach users."],
  ["shield", "Guardrails", "Block sensitive or disallowed requests before the upstream call is billed."],
  ["monitoring", "Observability", "Inspect model, provider, cost, latency, status, and failure reason for every request."],
  ["account_tree", "Governance", "Centralize policies, budgets, roles, and provider controls for production AI traffic."],
  ["receipt_long", "Zero markup", "Keep provider pricing visible instead of hiding token spend behind an opaque blended rate."],
];

const CHECKS = [
  "OpenAI-compatible endpoint",
  "Per-request route receipts",
  "Provider health aware",
  "Prompt and model policies",
  "Usage and cost analytics",
  "200+ model catalog",
];

export default function Features() {
  return (
    <section className="px-6 py-24 sm:py-28" id="features">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black text-blue-600">Ship safer</p>
            <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.04em] text-zinc-950 md:text-6xl">
              Reliability, safety, and spend controls on one hop.
            </h2>
          </div>
          <p className="max-w-md text-pretty text-base leading-7 text-zinc-600">
            Router2k follows the AI gateway model: route intelligently, verify every call, enforce guardrails, and keep cost transparent.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map(([icon, title, desc]) => (
            <article key={title} className="group rounded-[1.5rem] border border-zinc-200 bg-white p-6 shadow-sm shadow-blue-950/5 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-950/8">
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                <span className="material-symbols-outlined">{icon}</span>
              </div>
              <h3 className="text-xl font-black tracking-[-0.025em] text-zinc-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{desc}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-blue-100 bg-blue-50/70 p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKS.map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-bold text-zinc-700">
                <span className="material-symbols-outlined text-[18px] text-blue-700">check_circle</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
