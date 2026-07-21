"use client";

export default function HowItWorks() {
  return (
    <section className="border-y border-zinc-800 bg-zinc-900/40 py-24" id="how-it-works">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">How Router2k Works</h2>
          <p className="max-w-xl text-lg text-zinc-400">
            Data flows seamlessly from your application through our intelligent routing layer to the best provider for the job.
          </p>
        </div>

        <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="absolute top-12 right-[16%] left-[16%] -z-10 hidden h-px bg-gradient-to-r from-zinc-700 via-blue-500 to-zinc-700 md:block" />

          <div className="group relative flex flex-col gap-6">
            <div className="z-10 mx-auto flex size-24 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl transition-colors group-hover:border-zinc-600 md:mx-0">
              <span className="material-symbols-outlined text-4xl text-zinc-300">terminal</span>
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold">1. CLI &amp; SDKs</h3>
              <p className="text-sm text-zinc-400">
                Your requests start from your favorite tools or our unified SDK. Just change the base URL.
              </p>
            </div>
          </div>

          <div className="group relative flex flex-col gap-6 md:items-center md:text-center">
            <div className="z-10 mx-auto flex size-24 items-center justify-center rounded-2xl border-2 border-blue-500 bg-zinc-950 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
              <span className="material-symbols-outlined animate-pulse text-4xl text-blue-500">hub</span>
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold text-blue-400">2. Router2k Hub</h3>
              <p className="text-sm text-zinc-400">
                Our engine analyzes the prompt, checks provider health, and routes for lowest latency or cost.
              </p>
            </div>
          </div>

          <div className="group relative flex flex-col gap-6 md:items-end md:text-right">
            <div className="z-10 mx-auto flex size-24 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl transition-colors group-hover:border-zinc-600 md:mx-0">
              <div className="grid grid-cols-2 gap-2">
                <div className="size-6 rounded bg-white/10" />
                <div className="size-6 rounded bg-white/10" />
                <div className="size-6 rounded bg-white/10" />
                <div className="size-6 rounded bg-white/10" />
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold">3. AI Providers</h3>
              <p className="text-sm text-zinc-400">
                The request is fulfilled by OpenAI, Anthropic, Gemini, or others instantly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
