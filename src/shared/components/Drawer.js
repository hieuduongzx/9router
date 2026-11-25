"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";
import { cn } from "@/shared/utils/cn";

const WIDTHS = {
  sm: "sm:max-w-[400px]",
  md: "sm:max-w-[520px]",
  lg: "sm:max-w-[640px]",
  xl: "sm:max-w-[840px]",
  full: "sm:max-w-full",
};

/**
 * Legacy Drawer API over the Radix-backed sheet — same focus trap and aria
 * wiring as the dialog, which the hand-rolled panel did not have.
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  headerActions,
  children,
  width = "md",
  className,
  accentClassName,
}) {
  return (
    <Sheet open={Boolean(isOpen)} onOpenChange={(open) => !open && onClose?.()}>
      <SheetContent
        side="right"
        className={cn("w-full gap-0 overflow-hidden p-0", WIDTHS[width] || WIDTHS.md, className)}
      >
        {accentClassName ? (
          <span className={cn("absolute left-0 top-0 h-10 w-[3px]", accentClassName)} aria-hidden />
        ) : null}

        <SheetHeader className="shrink-0 flex-row items-center justify-between gap-3 pr-12">
          <SheetDescription className="sr-only">{title || "Side panel"}</SheetDescription>
          <SheetTitle className={title ? "truncate text-base" : "sr-only"}>
            {title || "Panel"}
          </SheetTitle>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-1.5">{headerActions}</div>
          ) : null}
        </SheetHeader>

        <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-5">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
