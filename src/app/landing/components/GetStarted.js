"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = (text) => {
    copy(text, "landing");
  };

  return (
    <section className="bg-zinc-950 px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-start gap-16 lg:flex-row">
          <div className="flex-1">
            <h2 className="mb-6 text-3xl font-bold tracking-tight md:text-4xl">Get Started in 30 Seconds</h2>
            <p className="mb-8 text-lg text-zinc-400">
              Install Router2k, configure your providers via web dashboard, and start routing AI requests.
            </p>

            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="flex size-8 flex-none items-center justify-center rounded-full bg-blue-500/15 font-bold text-blue-400">1</div>
                <div>
                  <h4 className="text-lg font-semibold">Install Router2k</h4>
                  <p className="mt-1 text-sm text-zinc-500">Run the npx command to start the server instantly</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-8 flex-none items-center justify-center rounded-full bg-blue-500/15 font-bold text-blue-400">2</div>
                <div>
                  <h4 className="text-lg font-semibold">Open Dashboard</h4>
                  <p className="mt-1 text-sm text-zinc-500">Configure providers and API keys via web interface</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex size-8 flex-none items-center justify-center rounded-full bg-blue-500/15 font-bold text-blue-400">3</div>
                <div>
                  <h4 className="text-lg font-semibold">Route Requests</h4>
                  <p className="mt-1 text-sm text-zinc-500">Point your CLI tools to http://localhost:20128</p>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full flex-1">
            <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
                <div className="size-3 rounded-full bg-red-500" />
                <div className="size-3 rounded-full bg-yellow-500" />
                <div className="size-3 rounded-full bg-green-500" />
                <div className="ml-2 font-mono text-xs text-zinc-500">terminal</div>
              </div>

              <div className="overflow-x-auto p-6 font-mono text-sm leading-relaxed">
                <div
                  className="group mb-4 flex cursor-pointer items-center gap-2"
                  onClick={() => handleCopy("npx 9router")}
                >
                  <span className="text-green-400">$</span>
                  <span className="text-white">npx 9router</span>
                  <span className="ml-auto text-xs text-zinc-500 opacity-0 group-hover:opacity-100">
                    {copied === "landing" ? "✓ Copied" : "Copy"}
                  </span>
                </div>

                <div className="mb-6 text-zinc-400">
                  <span className="text-blue-400">&gt;</span> Starting Router2k...<br />
                  <span className="text-blue-400">&gt;</span> Server running on <span className="text-sky-400">http://localhost:20128</span><br />
                  <span className="text-blue-400">&gt;</span> Dashboard: <span className="text-sky-400">http://localhost:20128/dashboard</span><br />
                  <span className="text-green-400">&gt;</span> Ready to route! ✓
                </div>

                <div className="mb-2 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
                  Configure providers in dashboard or use environment variables
                </div>

                <div className="text-xs text-zinc-400">
                  <span className="text-violet-400">Data Location:</span><br />
                  <span className="text-zinc-500">  macOS/Linux:</span> ~/.9router/db/data.sqlite<br />
                  <span className="text-zinc-500">  Windows:</span> %APPDATA%/9router/db/data.sqlite
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
