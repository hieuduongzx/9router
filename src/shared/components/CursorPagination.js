"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

const PAGE_WINDOW = 2;

/**
 * Compact page list: `1 … p-2 p-1 [p] p+1 p+2 … last`, collapsing to a plain
 * range when few pages exist.
 */
function pageItems(page, totalPages) {
  if (totalPages <= 0) return [];
  const items = new Set([1, totalPages]);
  for (let i = page - PAGE_WINDOW; i <= page + PAGE_WINDOW; i++) {
    if (i >= 1 && i <= totalPages) items.add(i);
  }
  const sorted = [...items].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of sorted) {
    if (prev && n - prev > 1) out.push("…");
    out.push(n);
    prev = n;
  }
  return out;
}

/** "Showing N items" + per-page dropdown + Newer/Older + numbered pages. */
export default function CursorPagination({
  count,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}) {
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const pages = pageItems(page, totalPages);

  return (
    <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
        <span className="section-label !text-muted-foreground">Showing {count} items</span>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5">
            per page:
            <div className="relative inline-flex">
              <select
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="h-7 appearance-none rounded-sm border border-border bg-surface py-0.5 pl-2 pr-6 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <Icon name="expand_more" className="pointer-events-none absolute right-0.5 top-1/2 -translate-y-1/2 size-[14px] text-muted-foreground" />
            </div>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="inline-flex h-8 items-center gap-1 rounded-sm border border-border px-3 font-mono text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="chevron_left" className="size-[15px]" />
          Newer
        </button>

        {pages.length > 1 && (
          <nav aria-label="Pages" className="flex items-center gap-1">
            {pages.map((item, index) =>
              item === "…" ? (
                <span key={`gap-${index}`} aria-hidden className="px-1 font-mono text-xs text-muted-foreground">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => onPageChange(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 font-mono text-xs font-medium transition-colors",
                    item === page
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:bg-surface-2",
                  )}
                >
                  {item}
                </button>
              ),
            )}
          </nav>
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          aria-label="Next page"
          className="inline-flex h-8 items-center gap-1 rounded-sm border border-border px-3 font-mono text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Older
          <Icon name="chevron_right" className="size-[15px]" />
        </button>
      </div>
    </div>
  );
}

CursorPagination.propTypes = {
  count: PropTypes.number.isRequired,
  page: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func,
  pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
  className: PropTypes.string,
};
