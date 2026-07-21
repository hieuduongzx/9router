"use client";

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 px-6 pb-8 pt-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-6 items-center justify-center rounded-md bg-blue-600 text-white">
                <span className="material-symbols-outlined text-[14px]">route</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Router2k</h3>
            </div>
            <p className="mb-6 max-w-xs text-sm text-zinc-500">
              The unified endpoint for AI generation. Connect, route, and manage your AI providers with ease.
            </p>
            <div className="flex gap-4">
              <a className="text-zinc-400 transition-colors hover:text-white" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined">code</span>
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white">Product</h4>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="#features">Features</a>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="/dashboard">Dashboard</a>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">Changelog</a>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white">Resources</h4>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="https://github.com/decolua/9router#readme" target="_blank" rel="noopener noreferrer">Documentation</a>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="https://www.npmjs.com/package/9router" target="_blank" rel="noopener noreferrer">NPM</a>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white">Legal</h4>
            <a className="text-sm text-zinc-400 transition-colors hover:text-blue-400" href="https://github.com/decolua/9router/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">MIT License</a>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-800 pt-8 md:flex-row">
          <p className="text-sm text-zinc-600">© {new Date().getFullYear()} Router2k. All rights reserved.</p>
          <div className="flex gap-6">
            <a className="text-sm text-zinc-600 transition-colors hover:text-white" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a className="text-sm text-zinc-600 transition-colors hover:text-white" href="https://www.npmjs.com/package/9router" target="_blank" rel="noopener noreferrer">NPM</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
