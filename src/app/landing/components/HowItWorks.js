"use client";

const ROUTE_STEPS = [
  {
    icon: "route",
    title: "Route",
    text: "Grade each prompt and choose the model that fits the job: cheapest that clears the quality bar, highest quality, or a balanced policy.",
  },
  {
    icon: "monitoring",
    title: "Observe",
    text: "See request cost, chosen model, provider, latency, and failure reason so every route is explainable after the call finishes.",
  },
  {
    icon: "admin_panel_settings",
    title: "Govern",
    text: "Apply budgets, roles, guardrails, and policy checks before provider spend happens instead of auditing mistakes later.",
  },
];

const MODES = [
  ["Cheapest", "lowest cost", "Use efficient models when the prompt is routine."],
  ["Balanced", "quality bar", "Spend only when the task demands it."],
  ["Quality", "highest score", "Send hard reasoning to frontier models."],
  ["Adaptive", "learns from traffic", "Tune the trade-off from real outcomes."],
];

export default function HowItWorks() {
  return (
    <section className="relative border-y border-blue-100 bg-white/72 px-6 py-24 sm:py-28" id="how-it-works">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p className="text-sm font-black text-blue-600">AI gateway for production</p>
          <h2 className="mt-3 text-balance text-4xl font-black tracking-[-0.04em] text-zinc-950 md:text-6xl">
            Route smarter. Prove every decision.
          </h2>
          <p className="mt-4 text-pretty text-base leading-7 text-zinc-600 md:text-lg">
            Router2k keeps routing, observability, and governance on the same hop. The endpoint chooses, records, and enforces before the request reaches a provider.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.82fr]">
          <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-xl shadow-blue-950/8">
            {ROUTE_STEPS.map((step, index) => (
              <div key={step.title} className="grid gap-4 border-b border-zinc-100 p-6 last:border-b-0 md:grid-cols-[5rem_1fr] md:p-8">
                <div className={`flex size-16 items-center justify-center rounded-2xl ${index === 0 ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"}`}>
                  <span className="material-symbols-outlined text-3xl">{step.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">0{index + 1}</p>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.025em] text-zinc-950">{step.title}</h3>
                  <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-zinc-600 md:text-base">{step.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-blue-950/12 md:p-8">
            <p className="text-sm font-bold text-blue-200">Route on your terms.</p>
            <h3 className="mt-3 text-balance text-3xl font-black tracking-[-0.04em] md:text-4xl">
              Pick a policy. Let the gateway enforce it.
            </h3>
            <div className="mt-7 grid gap-3">
              {MODES.map(([name, meta, text]) => (
                <div key={name} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-white">{name}</p>
                    <p className="rounded-full bg-blue-400/15 px-2.5 py-1 text-xs font-bold text-blue-100">{meta}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-300">{text}</p>
                </div>
              ))}
            </div>
            <a className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 text-sm font-black text-zinc-950 transition hover:bg-blue-50" href="#features">
              See guardrails ↓
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
