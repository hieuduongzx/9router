"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  default: "border-transparent bg-surface-2 text-text-muted",
  primary: "border-transparent bg-primary/10 text-primary",
  success: "border-transparent bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "border-transparent bg-amber-500/10 text-amber-700 dark:text-amber-400",
  error: "border-transparent bg-red-500/10 text-red-700 dark:text-red-400",
  info: "border-transparent bg-blue-500/10 text-blue-700 dark:text-blue-400",
  outline: "border-border text-text-main",
};

const sizes = {
  sm: "px-1.5 py-0 text-[10px]",
  md: "px-2.5 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
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
        "inline-flex items-center gap-1 rounded-md border font-semibold transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full",
            variant === "success" && "bg-emerald-500",
            variant === "warning" && "bg-amber-500",
            variant === "error" && "bg-red-500",
            variant === "info" && "bg-blue-500",
            variant === "primary" && "bg-primary",
            (variant === "default" || variant === "outline") && "bg-text-muted"
          )}
        />
      )}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {children}
    </span>
  );
}
