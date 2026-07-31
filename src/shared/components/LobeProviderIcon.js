"use client";

import { useEffect, useState } from "react";
import { cn } from "@/shared/utils/cn";
import { getLobeIconUrl, normalizeLobeIconKey } from "@/shared/utils/lobeIcons";


export default function LobeProviderIcon({ iconKey, name, className }) {
  const normalizedKey = normalizeLobeIconKey(iconKey);
  const [useColor, setUseColor] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUseColor(true);
    setFailed(false);
  }, [normalizedKey]);

  const fallback = String(name || "?").trim().slice(0, 1).toUpperCase() || "?";

  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center overflow-hidden border border-border bg-surface font-mono text-xs font-semibold text-text-main",
        className,
      )}
      aria-hidden="true"
    >
      {!normalizedKey || failed ? (
        fallback
      ) : (
        <picture className="size-full p-1">
          <source
            media="(prefers-color-scheme: dark)"
            srcSet={getLobeIconUrl(normalizedKey, "dark", useColor)}
          />
          <img
            src={getLobeIconUrl(normalizedKey, "light", useColor)}
            alt=""
            className="size-full object-contain"
            onError={() => {
              if (useColor) setUseColor(false);
              else setFailed(true);
            }}
          />
        </picture>
      )}
    </span>
  );
}
