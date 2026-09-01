"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

/**
 * ⌘K navigator over the dashboard rail. Deliberately nav-only: it jumps to the
 * pages the sidebar already lists, so there is no server round-trip and no
 * result that turns out not to exist. Matching is a plain substring test on the
 * label and the group name, which is enough for a list this size and never
 * surprises with fuzzy hits.
 */
export default function JumpToPalette({ open, onClose, items }) {
  // Mounting only while open is what resets the query and selection — cheaper
  // and less error-prone than clearing them from an effect on every toggle.
  if (!open) return null;
  return <PaletteDialog onClose={onClose} items={items} />;
}

function PaletteDialog({ onClose, items }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    // Focus after paint so the dialog is mounted when focus moves.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const go = useCallback((href) => {
    onClose();
    router.push(href);
  }, [onClose, router]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index + 1) % results.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (results.length ? (index - 1 + results.length) % results.length : 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const target = results[activeIndex];
      if (target) go(target.href);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 p-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close navigator"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Jump to page"
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-lg border border-border bg-surface"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="size-[18px] text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to..."
            aria-label="Jump to page"
            className="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 border border-border px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="custom-scrollbar max-h-[52vh] overflow-y-auto py-1">
          {results.length ? (
            results.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.href}-${item.label}`}
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                    index === activeIndex ? "bg-surface-2 text-foreground" : "text-muted-foreground"
                  )}
                >
                  {Icon ? <Icon aria-hidden size={15} strokeWidth={2.25} className="shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {item.group}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching page</p>
          )}
        </div>
      </div>
    </div>
  );
}

const itemsShape = PropTypes.arrayOf(
  PropTypes.shape({
    href: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    group: PropTypes.string,
    icon: PropTypes.elementType,
  })
).isRequired;

JumpToPalette.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  items: itemsShape,
};

PaletteDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  items: itemsShape,
};
