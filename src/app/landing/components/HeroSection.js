"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import CropFrame from "@/shared/components/CropFrame";
import { Icon } from "@/shared/components/ui/icon";

export default function HeroSection() {
  const [baseUrl, setBaseUrl] = useState("/v1");

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const timer = window.setTimeout(() => setBaseUrl(`${window.location.origin}/v1`), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <section id="overview" className="relative scroll-mt-16 px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-20 lg:pt-36">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="max-w-2xl">
          <div className="section-label">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping bg-success opacity-30" />
              <span className="relative inline-flex size-2 bg-success" />
            </span>
            Unified AI API
          </div>

          <h1 className="mt-6 font-mono text-balance text-5xl font-semibold leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-[4.25rem]">
            One API key.
            <span className="block">Every model you need.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
            Create an account, choose a model, and pay from one wallet balance. Use the same OpenAI-compatible endpoint for every request.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login?mode=register"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-foreground px-6 font-mono text-sm font-semibold text-white transition-colors hover:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/30 focus-visible:ring-offset-2"
            >
              Get your API key
              <Icon name="arrow_forward" className="size-[18px]" aria-hidden="true" />
            </Link>
            <Link
              href="/models"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-foreground/10 bg-white px-6 font-mono text-sm font-semibold text-foreground transition-colors hover:border-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950"
            >
              Browse models
              <Icon name="arrow_outward" className="size-[18px]" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-4 font-mono text-xs text-muted-foreground">published pricing · wallet balance · usage tracking</p>
        </div>

        <CropFrame className="relative mx-auto w-full max-w-lg border border-border bg-white lg:mx-0">
          <div className="flex items-center justify-between border-b border-border bg-muted px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center border border-border bg-white text-foreground">
                <Icon name="api" className="size-[17px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold text-foreground">API ENDPOINT</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">OpenAI-compatible</p>
              </div>
            </div>
            <span className="ml-4 inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-success">
              <span className="size-1.5 bg-success" />
              ONLINE
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-muted-foreground">Base URL</p>
            <code className="mt-2 block overflow-x-auto whitespace-nowrap bg-foreground px-4 py-4 font-mono text-sm font-semibold text-white">
              {baseUrl}
            </code>

            <dl className="mt-5 divide-y divide-zinc-200 border-y border-border">
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-3">
                <dt className="font-mono text-[11px] font-semibold text-muted-foreground">CHAT</dt>
                <dd className="font-mono text-xs font-semibold text-foreground">POST /v1/chat/completions</dd>
              </div>
              <div className="grid grid-cols-[7rem_1fr] gap-3 py-3">
                <dt className="font-mono text-[11px] font-semibold text-muted-foreground">CATALOG</dt>
                <dd className="font-mono text-xs font-semibold text-foreground">GET /v1/models</dd>
              </div>
            </dl>

            <div className="mt-5 flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Use any published model ID.</p>
              <Link href="/#endpoint" className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs font-semibold text-foreground hover:underline">
                Quickstart
                <Icon name="south" className="size-[15px]" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </CropFrame>
      </div>
    </section>
  );
}
