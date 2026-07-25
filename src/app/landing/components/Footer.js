"use client";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white px-6 pb-8 pt-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center border border-zinc-950 bg-zinc-950 text-white">
                <span className="material-symbols-outlined text-[17px]">route</span>
              </div>
              <h3 className="font-mono text-lg font-semibold tracking-tight text-zinc-950">Router2k</h3>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-6 text-zinc-500">
              One AI gateway for adaptive routing, load balancing, guardrails, observability, and governance across every model.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="section-label !mb-0">Product</h4>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/models">Models</a>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/dashboard/endpoint">API endpoint</a>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/dashboard">Dashboard</a>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="section-label !mb-0">Gateway</h4>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/dashboard/providers">Providers</a>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/dashboard/usage">Usage</a>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/#integrations">Integrations</a>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="section-label !mb-0">Account</h4>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/login">Sign in</a>
            <a className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-950" href="/login?mode=register">Get API key</a>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-200 pt-8 font-mono text-xs md:flex-row">
          <p className="text-zinc-500">© {new Date().getFullYear()} Router2k. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="font-semibold text-zinc-500 transition-colors hover:text-zinc-950" href="/models">Models</a>
            <a className="font-semibold text-zinc-500 transition-colors hover:text-zinc-950" href="/dashboard">Dashboard</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
