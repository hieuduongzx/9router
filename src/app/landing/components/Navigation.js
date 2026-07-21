"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <button
          type="button"
          className="flex cursor-pointer items-center gap-3 border-none bg-transparent p-0"
          onClick={() => router.push("/")}
          aria-label="Navigate to home"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">
            <span className="material-symbols-outlined text-[18px]">route</span>
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-white">Router2k</h2>
        </button>

        <div className="hidden items-center gap-8 md:flex">
          <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="#features">Features</a>
          <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="#how-it-works">How it Works</a>
          <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="https://github.com/decolua/9router#readme" target="_blank" rel="noopener noreferrer">Docs</a>
          <a className="flex items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">
            GitHub <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="hidden h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-500 sm:flex"
          >
            Get Started
          </button>
          <button
            className="text-white md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-4 p-6">
            <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it Works</a>
            <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="https://github.com/decolua/9router#readme" target="_blank" rel="noopener noreferrer">Docs</a>
            <a className="text-sm font-medium text-zinc-400 transition-colors hover:text-white" href="https://github.com/decolua/9router" target="_blank" rel="noopener noreferrer">GitHub</a>
            <button
              onClick={() => router.push("/dashboard")}
              className="h-9 rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
