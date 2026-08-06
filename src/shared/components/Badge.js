"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  default: "border-border bg-surface-2 text-text-muted",
  primary: "border-border text-text-main",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  error: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  outline: "border-border text-text-main",
};

const sizes = {
  sm: "px-1.5 py-0 text-[10px]",
  md: "px-2 py-0.5 text-[11px]",
  lg: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  variant = "default",
  size = "md",
  dot = false,
  icon,
  className,
}) {
  return (
    <span
      className={cn(
        // Square, not pill: chips across the dashboard share one flat shape.
        "inline-flex items-center gap-1 border font-mono font-semibold uppercase tracking-wide transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5",
            variant === "success" && "bg-emerald-500",
            variant === "warning" && "bg-amber-500",
            variant === "error" && "bg-red-500",
            variant === "info" && "bg-blue-500",
            variant === "primary" && "bg-text-main",
            (variant === "default" || variant === "outline") && "bg-text-muted"
          )}
        />
      )}
      {icon && <span className="material-symbols-outlined text-[14px] normal-case">{icon}</span>}
      {children}
    </span>
  );
}
