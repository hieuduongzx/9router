"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

/** "Showing N items" + per-page dropdown + Newer/Older cursor buttons. */
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

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
          className="inline-flex h-8 items-center gap-1 rounded-sm border border-border px-3 font-mono text-xs font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon name="chevron_left" className="size-[15px]" />
          Newer
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
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
