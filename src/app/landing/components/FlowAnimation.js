"use client";
import { useEffect, useState } from "react";
import ProviderIcon from "@/shared/components/ProviderIcon";

const CLI_TOOLS = [
  { id: "claude", name: "Claude Code", image: "/providers/claude.png" },
  { id: "codex", name: "OpenAI Codex", image: "/providers/codex.png" },
  { id: "cline", name: "Cline", image: "/providers/cline.png" },
  { id: "cursor", name: "Cursor", image: "/providers/cursor.png" },
];

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    color: "bg-emerald-500",
    textColor: "text-white",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    color: "bg-orange-400",
    textColor: "text-white",
  },
  {
    id: "gemini",
    name: "Gemini",
    color: "bg-blue-500",
    textColor: "text-white",
  },
  {
    id: "github",
    name: "GitHub Copilot",
    color: "bg-zinc-700",
    textColor: "text-white",
  },
];

const ACTIVE = "#3b82f6";
const IDLE = "rgb(63, 63, 70)";

export default function FlowAnimation() {
  const [activeFlow, setActiveFlow] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFlow((prev) => (prev + 1) % PROVIDERS.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative mt-16 hidden h-[360px] w-full max-w-4xl animate-[float_6s_ease-in-out_infinite] items-center justify-center md:flex">
      {/* Router2k Hub - Center */}
      <div className="group relative z-20 flex size-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border-2 border-blue-500 bg-zinc-900 shadow-[0_0_40px_rgba(37,99,235,0.3)] transition-transform duration-500 hover:scale-105">
        <span className="material-symbols-outlined text-4xl text-blue-500">hub</span>
        <span className="text-xs font-bold tracking-widest text-white uppercase">Router2k</span>
        <div className="absolute inset-0 animate-ping rounded-full border border-blue-500/30 opacity-20" />
      </div>

      {/* CLI Tools - Left side */}
      <div className="absolute top-1/2 left-0 flex -translate-y-1/2 flex-col gap-7">
        {CLI_TOOLS.map((tool) => (
          <div
            key={tool.id}
            className="group flex items-center gap-3 opacity-70 transition-opacity hover:opacity-100"
          >
            <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-2 transition-all hover:scale-105 hover:border-blue-500/50">
              <ProviderIcon
                src={tool.image}
                alt={tool.name}
                size={48}
                className="max-h-[48px] max-w-[48px] rounded-xl object-contain"
                fallbackText={tool.name.slice(0, 2).toUpperCase()}
              />
            </div>
          </div>
        ))}
      </div>

      {/* SVG Lines from CLI to hub */}
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full stroke-blue-700/60"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path className="animate-[dash_2s_linear_infinite]" d="M 60 50 C 250 70, 250 180, 360 180" fill="none" strokeDasharray="5,5" strokeWidth="2" />
        <path className="animate-[dash_2s_linear_infinite]" d="M 60 140 C 250 140, 250 180, 360 180" fill="none" strokeDasharray="5,5" strokeWidth="2" />
        <path className="animate-[dash_2s_linear_infinite]" d="M 60 210 C 250 210, 250 180, 360 180" fill="none" strokeDasharray="5,5" strokeWidth="2" />
        <path className="animate-[dash_2s_linear_infinite]" d="M 60 300 C 250 280, 250 180, 360 180" fill="none" strokeDasharray="5,5" strokeWidth="2" />
      </svg>

      {/* SVG Lines from hub to Providers */}
      <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        {[
          "M 440 180 C 550 180, 550 50, 740 50",
          "M 440 180 C 550 180, 550 130, 740 130",
          "M 440 180 C 550 180, 550 230, 740 230",
          "M 440 180 C 550 180, 550 310, 740 310",
        ].map((d, idx) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke={activeFlow === idx ? ACTIVE : IDLE}
            strokeWidth={activeFlow === idx ? "3" : "2"}
            className={activeFlow === idx ? "animate-pulse" : ""}
          />
        ))}
      </svg>

      {/* AI Providers - Right side */}
      <div className="absolute top-0 right-0 bottom-0 flex flex-col justify-between py-6">
        {PROVIDERS.map((provider, idx) => (
          <div
            key={provider.id}
            className={`flex min-w-[140px] cursor-help items-center justify-center rounded-lg px-4 py-2 text-xs font-bold shadow-lg transition-all hover:scale-110 ${provider.color} ${provider.textColor} ${
              activeFlow === idx ? "scale-110 ring-4 ring-blue-500/50" : ""
            }`}
            title={provider.name}
          >
            {provider.name}
          </div>
        ))}
      </div>
    </div>
  );
}
