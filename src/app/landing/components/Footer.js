"use client";

import Link from "next/link";
import { Icon } from "@/shared/components/ui/icon";

const FOOTER_GROUPS = [
  {
    label: "Explore",
    links: [
      ["/#models", "Models"],
      ["/#endpoint", "Endpoint"],
      ["/models", "Full catalog"],
    ],
  },
  {
    label: "Account",
    links: [
      ["/dashboard/api-keys", "API keys"],
      ["/dashboard/account?tab=wallet", "Wallet"],
      ["/dashboard/usage", "Usage"],
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-muted px-5 pb-8 pt-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.75fr_0.75fr]">
          <div>
            <div className="mb-5 flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center border border-foreground bg-foreground text-background">
                <Icon name="route" className="size-[17px]" aria-hidden="true" />
              </div>
              <h3 className="font-mono text-lg font-semibold tracking-tight text-foreground">Router2k</h3>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-6 text-muted-foreground">
              One OpenAI-compatible API for leading AI models. Compare pricing, manage your wallet, and track every request from one account.
            </p>
            <div className="inline-flex items-center gap-2 border border-border bg-card px-3 py-2 font-mono text-[11px] text-muted-foreground">
              <span className="size-1.5 bg-success" />
              WALLET-BASED API ACCESS
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <h4 className="text-xs font-medium text-muted-foreground">{group.label}</h4>
              {group.links.map(([href, label]) => (
                <Link key={href} className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground" href={href}>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-8 font-mono text-xs md:flex-row">
          <p className="text-muted-foreground">© {new Date().getFullYear()} Router2k. All rights reserved.</p>
          <div className="flex gap-6">
            <Link className="font-semibold text-muted-foreground transition-colors hover:text-foreground" href="/models">Full catalog</Link>
            <Link className="font-semibold text-muted-foreground transition-colors hover:text-foreground" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
