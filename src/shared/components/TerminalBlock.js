"use client";

import { useState } from "react";
import { cn } from "@/shared/utils/cn";

export default function TerminalBlock({ command, label, className }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className={cn(className)}>
      {label && (
        <div className="mb-1.5 font-mono text-[11px] font-semibold tracking-wide text-text-muted">
          {label}
        </div>
      )}
      <div className="terminal-block flex items-center justify-between gap-3 rounded-sm px-3 py-2.5">
        <code className="min-w-0 flex-1 truncate">
          <span className="terminal-prompt mr-2">$</span>
          {command}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center justify-center rounded-sm border border-white/15 p-1 text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
          aria-label="Copy command"
        >
          <span className="material-symbols-outlined text-[15px]">
            {copied ? "check" : "content_copy"}
          </span>
        </button>
      </div>
    </div>
  );
}
