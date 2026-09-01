"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
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
        className={cn("w-full gap-0 p-0", WIDTHS[width] || WIDTHS.md, className)}
      >
        {accentClassName ? (
          <span className={cn("absolute left-0 top-0 h-10 w-[3px]", accentClassName)} aria-hidden />
        ) : null}

        <SheetHeader className="flex-row items-center justify-between gap-3 pr-12">
          <SheetTitle className={title ? "text-base" : "sr-only"}>{title || "Panel"}</SheetTitle>
          {headerActions ? (
            <div className="flex items-center gap-1.5">{headerActions}</div>
          ) : null}
        </SheetHeader>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
