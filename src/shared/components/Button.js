"use client";

import { cn } from "@/shared/utils/cn";

const variants = {
  primary:
    "bg-primary text-white shadow-sm hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary/30",
  secondary:
    "bg-surface-2 text-text-main border border-border shadow-sm hover:bg-surface-3 focus-visible:ring-2 focus-visible:ring-primary/20",
  outline:
    "border border-border bg-transparent text-text-main shadow-sm hover:bg-surface-2 hover:text-text-main focus-visible:ring-2 focus-visible:ring-primary/20",
  ghost:
    "text-text-muted hover:bg-surface-2 hover:text-text-main",
  danger:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500/30",
  success:
    "bg-green-600 text-white shadow-sm hover:bg-green-700 focus-visible:ring-2 focus-visible:ring-green-500/30",
};

const sizes = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-9 px-4 text-sm rounded-md",
  lg: "h-10 px-6 text-sm rounded-md",
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
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors",
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
