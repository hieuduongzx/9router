"use client";

import { cn } from "@/shared/utils/cn";

export default function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const showMax = 5;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + showMax - 1);

    if (end - start + 1 < showMax) {
      start = Math.max(1, end - showMax + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2.5",
        className
      )}
    >
      {/* Left — compact info */}
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-text-muted tabular-nums">
          {startItem}–{endItem} <span className="text-text-muted/50">of</span> {totalItems}
        </span>

        {/* Page size */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-7 px-1.5 rounded-md border border-border bg-transparent text-[12px] text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Right — page nav */}
      {totalPages > 1 && (
        <div className="flex items-center gap-0.5">
          <PageBtn
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </PageBtn>

          {pageNumbers[0] > 1 && (
            <>
              <PageBtn onClick={() => onPageChange(1)}>1</PageBtn>
              {pageNumbers[0] > 2 && <span className="text-text-muted/40 text-[11px] px-1">···</span>}
            </>
          )}

          {pageNumbers.map((page) => (
            <PageBtn
              key={page}
              active={currentPage === page}
              onClick={() => onPageChange(page)}
            >
              {page}
            </PageBtn>
          ))}

          {pageNumbers[pageNumbers.length - 1] < totalPages && (
            <>
              {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                <span className="text-text-muted/40 text-[11px] px-1">···</span>
              )}
              <PageBtn onClick={() => onPageChange(totalPages)}>{totalPages}</PageBtn>
            </>
          )}

          <PageBtn
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </PageBtn>
        </div>
      )}
    </div>
  );
}

function PageBtn({ children, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-md text-[12px] font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-text-muted hover:text-foreground hover:bg-muted",
        disabled && "opacity-30 pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}
