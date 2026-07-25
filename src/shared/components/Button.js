"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  primary:
    "bg-primary text-[hsl(var(--primary-foreground))] hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-primary/30",
  secondary:
    "bg-surface-2 text-text-main border border-border hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-primary/20",
  outline:
    "border border-border bg-transparent text-text-main hover:bg-surface-2 hover:text-text-main focus-visible:ring-2 focus-visible:ring-primary/20",
  ghost:
    "text-text-muted hover:bg-surface-2 hover:text-text-main",
  danger:
    "border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 focus-visible:ring-2 focus-visible:ring-red-500/30",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-500/30",
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-sm",
  md: "h-9 px-4 text-sm rounded-sm",
  lg: "h-10 px-6 text-sm rounded-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono font-medium tracking-tight transition-colors",
        "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="material-symbols-outlined text-[18px]">{iconRight}</span>
      )}
    </button>
  );
}
