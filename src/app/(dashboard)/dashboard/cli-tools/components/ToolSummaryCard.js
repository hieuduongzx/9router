"use client";

import Link from "next/link";
import Image from "next/image";
import { Card } from "@/shared/components";
import { Icon } from "@/shared/components/ui/icon";

// Derive simple connected/configured/not-installed status from API payload
function getStatus(status) {
  if (!status) return { label: "Unknown", cls: "bg-gray-500/10 text-muted-foreground" };
  if (!status.installed) return { label: "Not installed", cls: "bg-gray-500/10 text-muted-foreground" };
  if (status.has9Router) return { label: "Connected", cls: "bg-success/10 text-success dark:text-success" };
  return { label: "Not configured", cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" };
}

export default function ToolSummaryCard({ toolId, tool, status }) {
  const s = getStatus(status);
  return (
    <Link href={`/dashboard/cli-tools/${toolId}`} className="block">
      <Card padding="sm" className="h-full overflow-hidden hover:border-primary/50 transition-colors cursor-pointer">
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="size-8 flex items-center justify-center shrink-0">
              {tool.image ? (
                <Image src={tool.image} alt={tool.name} width={32} height={32} className="size-8 object-contain" sizes="32px" onError={(e) => { e.target.style.display = "none"; }} loading="lazy" decoding="async" />
              ) : tool.icon ? (
                <Icon name={tool.icon} className="size-[28px]" style={{ color: tool.color }} />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-mono font-medium text-sm truncate">{tool.name}</h3>
              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide border border-current/30 ${s.cls}`}>{s.label}</span>
            </div>
            <Icon name="chevron_right" className="text-muted-foreground size-[18px] shrink-0" />
          </div>
        </div>
      </Card>
    </Link>
  );
}
