"use client";

const FEATURES = [
  {
    icon: "link",
    title: "Unified Endpoint",
    desc: "Access all providers via a single standard API URL.",
    colors: {
      border: "hover:border-blue-500/50",
      bg: "hover:bg-blue-500/5",
      iconBg: "bg-blue-500/10",
      iconText: "text-blue-500",
      titleHover: "group-hover:text-blue-400",
    },
  },
  {
    icon: "bolt",
    title: "Easy Setup",
    desc: "Get up and running in minutes with npx command.",
    colors: {
      border: "hover:border-sky-500/50",
      bg: "hover:bg-sky-500/5",
      iconBg: "bg-sky-500/10",
      iconText: "text-sky-500",
      titleHover: "group-hover:text-sky-400",
    },
  },
  {
    icon: "shield_with_heart",
    title: "Model Fallback",
    desc: "Automatically switch providers on failure or high latency.",
    colors: {
      border: "hover:border-rose-500/50",
      bg: "hover:bg-rose-500/5",
      iconBg: "bg-rose-500/10",
      iconText: "text-rose-500",
      titleHover: "group-hover:text-rose-400",
    },
  },
  {
    icon: "monitoring",
    title: "Usage Tracking",
    desc: "Detailed analytics and cost monitoring across all models.",
    colors: {
      border: "hover:border-violet-500/50",
      bg: "hover:bg-violet-500/5",
      iconBg: "bg-violet-500/10",
      iconText: "text-violet-500",
      titleHover: "group-hover:text-violet-400",
    },
  },
  {
    icon: "key",
    title: "OAuth & API Keys",
    desc: "Securely manage credentials in one vault.",
    colors: {
      border: "hover:border-amber-500/50",
      bg: "hover:bg-amber-500/5",
      iconBg: "bg-amber-500/10",
      iconText: "text-amber-500",
      titleHover: "group-hover:text-amber-400",
    },
  },
  {
    icon: "cloud_sync",
    title: "Cloud Sync",
    desc: "Sync your configurations across devices instantly.",
    colors: {
      border: "hover:border-cyan-500/50",
      bg: "hover:bg-cyan-500/5",
      iconBg: "bg-cyan-500/10",
      iconText: "text-cyan-500",
      titleHover: "group-hover:text-cyan-400",
    },
  },
  {
    icon: "terminal",
    title: "CLI Support",
    desc: "Works with Claude Code, Codex, Cline, Cursor, and more.",
    colors: {
      border: "hover:border-emerald-500/50",
      bg: "hover:bg-emerald-500/5",
      iconBg: "bg-emerald-500/10",
      iconText: "text-emerald-500",
      titleHover: "group-hover:text-emerald-400",
    },
  },
  {
    icon: "dashboard",
    title: "Dashboard",
    desc: "Visual dashboard for real-time traffic analysis.",
    colors: {
      border: "hover:border-indigo-500/50",
      bg: "hover:bg-indigo-500/5",
      iconBg: "bg-indigo-500/10",
      iconText: "text-indigo-500",
      titleHover: "group-hover:text-indigo-400",
    },
  },
];

export default function Features() {
  return (
    <section className="px-6 py-24" id="features">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">Powerful Features</h2>
          <p className="max-w-xl text-lg text-zinc-400">
            Everything you need to manage your AI infrastructure in one place, built for scale.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className={`group rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 transition-all duration-300 ${feature.colors.border} ${feature.colors.bg}`}
            >
              <div className={`mb-4 flex size-10 items-center justify-center rounded-lg ${feature.colors.iconBg} ${feature.colors.iconText} transition-transform duration-300 group-hover:scale-110`}>
                <span className="material-symbols-outlined">{feature.icon}</span>
              </div>
              <h3 className={`mb-2 text-lg font-semibold transition-colors ${feature.colors.titleHover}`}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-zinc-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
