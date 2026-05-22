"use client";

import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Badge — soft pastel fills with consistent border, token-driven defaults.
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1.5 transition-colors duration-150",
  {
    variants: {
      variant: {
        // Standard
        default: "bg-muted text-text-muted border border-border",

        primary: "bg-primary/[0.10] text-primary border border-primary/20",

        secondary: "bg-muted text-foreground border border-border",

        outline: "bg-transparent text-text-muted border border-border",

        ghost: "text-text-muted hover:bg-muted",

        // Status — soft pastel + matching border
        success: "bg-green-500/[0.10] text-green-700 border border-green-500/25 dark:text-green-400",

        warning: "bg-amber-500/[0.10] text-amber-700 border border-amber-500/25 dark:text-amber-400",

        error: "bg-red-500/[0.10] text-red-700 border border-red-500/25 dark:text-red-400",

        info: "bg-blue-500/[0.10] text-blue-700 border border-blue-500/25 dark:text-blue-400",

        // Workflow status
        backlog: "bg-purple-500/[0.10] text-purple-700 border border-purple-500/25 dark:text-purple-400",

        todo: "bg-amber-500/[0.10] text-amber-700 border border-amber-500/25 dark:text-amber-400",

        "in-progress": "bg-yellow-500/[0.10] text-yellow-700 border border-yellow-500/25 dark:text-yellow-400",

        done: "bg-green-500/[0.10] text-green-700 border border-green-500/25 dark:text-green-400",

        canceled: "bg-red-500/[0.10] text-red-700 border border-red-500/25 dark:text-red-400",

        // Priority
        low: "bg-muted text-text-muted border border-border",

        medium: "bg-blue-500/[0.10] text-blue-700 border border-blue-500/25 dark:text-blue-400",

        high: "bg-orange-500/[0.10] text-orange-700 border border-orange-500/25 dark:text-orange-400",

        urgent: "bg-red-500/[0.10] text-red-700 border border-red-500/25 dark:text-red-400",
      },
      size: {
        sm: "h-5 px-2 text-[10px]",
        md: "h-[22px] px-2.5 text-[11px]",
        lg: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  // Solid color dots — sit inside the soft fill for a clear status read.
  const dotColors = {
    default: "bg-text-muted",
    primary: "bg-primary",
    success: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
    backlog: "bg-purple-500",
    todo: "bg-amber-500",
    "in-progress": "bg-yellow-500",
    done: "bg-green-500",
    canceled: "bg-red-500",
    low: "bg-text-muted",
    medium: "bg-blue-500",
    high: "bg-orange-500",
    urgent: "bg-red-500",
  };

  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full shrink-0",
            dotColors[variant] || dotColors.default
          )}
        />
      )}
      {icon && <span className="material-symbols-outlined text-xs leading-none">{icon}</span>}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
export default Badge;
