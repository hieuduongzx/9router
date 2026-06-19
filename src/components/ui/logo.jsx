import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Api2K brand mark.
 * Solid square with the "2K" wordmark inside.
 *
 * Uses currentColor for the background so it inherits theme colors:
 *  - Light theme: parent gives `text-foreground` -> dark mark on light bg
 *  - Dark theme: parent gives `text-foreground` -> light mark on dark bg
 *
 * Sizes follow the standard tailwind size scale.
 */
export function Logo({ className, size = "md", ...props }) {
  const dimensions = {
    xs: "h-5 w-5",
    sm: "h-6 w-6",
    md: "h-7 w-7",
    lg: "h-8 w-8",
    xl: "h-10 w-10",
  };

  return (
    <span
      aria-label="Api2K"
      role="img"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md bg-foreground text-background font-bold tracking-tight select-none",
        dimensions[size] || dimensions.md,
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          size === "xs" && "text-[9px]",
          size === "sm" && "text-[10px]",
          size === "md" && "text-[11px]",
          size === "lg" && "text-xs",
          size === "xl" && "text-sm",
        )}
      >
        2K
      </span>
    </span>
  );
}

/**
 * Inline word + mark combo, used in sidebars and login screens.
 */
export function LogoWithText({
  className,
  size = "md",
  showText = true,
  ...props
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      {...props}
    >
      <Logo size={size} />
      {showText && (
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Api2K
        </span>
      )}
    </span>
  );
}

export default Logo;
