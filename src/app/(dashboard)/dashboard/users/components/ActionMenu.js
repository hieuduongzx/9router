"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kebab menu for low-frequency account actions.
 * @param {{items: Array<{label: string, icon: string, onSelect: () => void, disabled?: boolean, danger?: boolean}>, label: string, align?: "left"|"right"}} props
 */
export default function ActionMenu({ items, label, align = "right" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex size-8 items-center justify-center rounded-sm border border-border text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
      </button>
      {open && (
        <div className={`absolute top-9 z-30 w-52 border border-border bg-surface py-1 shadow-lg ${align === "left" ? "left-0" : "right-0"}`}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                item.danger ? "text-danger hover:bg-danger/10" : "text-text-main hover:bg-surface-2"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
