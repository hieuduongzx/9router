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


export default function FlowAnimation() {
  const ticker = [...MODELS, ...MODELS];

  return (
    <section id="integrations" aria-label="Available AI models" className="landing-marquee relative border-y border-zinc-200 bg-white">
      <div className="flex items-stretch">
        <div className="relative z-10 hidden shrink-0 items-center border-r border-zinc-200 bg-white px-6 font-mono text-xs font-semibold uppercase tracking-wide text-zinc-950 md:flex">
          Available models
        </div>
        <div className="min-w-0 flex-1 overflow-hidden py-3.5 [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
          <div className="landing-marquee-track flex w-max items-center gap-7 whitespace-nowrap pr-7 font-mono text-[13px] font-medium text-zinc-600">
            {ticker.map((model, index) => (
              <span key={`${model}-${index}`} className="inline-flex items-center gap-2.5">
                <span className="size-1.5 bg-zinc-950" />
                {model}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
