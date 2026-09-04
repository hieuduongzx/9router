"use client";

import Link from "next/link";
import { Card } from "@/shared/components";
import Image from "next/image";
import { useShellPath } from "@/shared/hooks/useShellPath";
import { Icon } from "@/shared/components/ui/icon";

/**
 * Clickable card for MITM tools — navigates to the MITM page in the current shell.
 */
export default function MitmLinkCard({ tool }) {
  const shellPath = useShellPath();
  return (
    <Link href={shellPath("/dashboard/mitm")} className="block">
      <Card padding="sm" className="overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 flex items-center justify-center shrink-0">
              <Image
                src={tool.image}
                alt={tool.name}
                width={32}
                height={32}
                className="size-8 object-contain"
                sizes="32px"
                onError={(e) => { e.target.style.display = "none"; }}
              loading="lazy"
              decoding="async"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-medium text-sm">{tool.name}</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide border border-info/30 bg-info/10 text-info dark:text-info">MITM</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
            </div>
          </div>
          <Icon name="chevron_right" className="text-muted-foreground size-[20px]" />
        </div>
      </Card>
    </Link>
  );
}
