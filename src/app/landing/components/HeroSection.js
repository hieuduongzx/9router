"use client";
import { useRouter } from "next/navigation";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-6 pb-20 pt-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[1000px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          <span className="flex h-2 w-2 animate-pulse rounded-full bg-blue-500" />
          Universal AI Gateway
        </div>

        <h1 className="text-5xl font-bold leading-[1.1] tracking-tight md:text-7xl">
          One Endpoint for <br />
          <span className="text-blue-500">All AI Providers</span>
        </h1>

        <p className="mx-auto max-w-2xl text-lg font-light text-zinc-400 md:text-xl">
          AI endpoint proxy with a web dashboard. Works seamlessly with Claude Code, OpenAI Codex, Cline, RooCode, and other CLI tools.
        </p>

        <div className="flex w-full flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex h-12 items-center gap-2 rounded-md bg-blue-600 px-8 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-500"
          >
            <span className="material-symbols-outlined">rocket_launch</span>
            Get Started
          </button>
          <a
            href="https://github.com/decolua/9router"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-8 text-base font-semibold text-white transition-colors hover:bg-zinc-800"
          >
            <span className="material-symbols-outlined">code</span>
            View on GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
