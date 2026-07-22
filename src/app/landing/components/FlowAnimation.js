"use client";

const MODELS = [
  "openai/gpt-5.6-sol",
  "anthropic/claude-opus-4.8",
  "google/gemini-3.1-pro",
  "xai/grok-4.5",
  "deepseek/deepseek-v4",
  "qwen/qwen3-coder",
  "meta/llama-4",
  "mistral/codestral",
];

const INTEGRATIONS = [
  "OpenAI SDK",
  "Anthropic SDK",
  "Google GenAI SDK",
  "Vercel AI SDK",
  "LangChain",
  "LlamaIndex",
  "Cursor",
  "OpenCode",
  "Promptfoo",
  "GitHub",
  "cURL",
];

const STATS = [
  ["200+", "models, one endpoint"],
  ["0%", "token markup, ever"],
  ["75.5%", "routing accuracy"],
  ["<50ms", "mid-stream failover"],
];

export default function FlowAnimation() {
  const ticker = [...MODELS, ...MODELS];

  return (
    <section id="integrations" className="relative px-0 pb-16 pt-4">
      <div className="landing-marquee overflow-hidden border-y border-blue-100 bg-white/74 py-3 shadow-sm shadow-blue-950/5">
        <div className="landing-marquee-track flex w-max items-center gap-6 whitespace-nowrap text-xs font-semibold text-zinc-500">
          {ticker.map((model, index) => (
            <span key={`${model}-${index}`} className="inline-flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-blue-500" />
              {model}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid border-b border-blue-100/80 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(([value, label]) => (
            <div key={label} className="border-blue-100/80 py-8 text-center sm:border-r last:border-r-0">
              <p className="text-3xl font-black tracking-[-0.04em] text-zinc-950 md:text-4xl">{value}</p>
              <p className="mt-1 text-sm font-medium text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-4xl text-center">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Integrations</p>
          <h2 className="mt-4 text-balance text-3xl font-black tracking-[-0.035em] text-zinc-950 md:text-5xl">
            Works with the tools you already use
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base leading-7 text-zinc-600">
            Drop-in OpenAI-compatible, with routing, failover, observability, and guardrails kept behind one endpoint.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {INTEGRATIONS.map((item, index) => (
              <span
                key={item}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold shadow-sm ${index === 0 ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-200 bg-white text-zinc-700"}`}
              >
                <span className="material-symbols-outlined text-[15px]">{index === 0 ? "hub" : "api"}</span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
