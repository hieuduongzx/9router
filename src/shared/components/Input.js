"use client";

import { cn } from "@/lib/utils";

// Input — token-driven, consistent focus ring with the rest of the design system.
export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-[13px] font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        )}
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full rounded-md border bg-card px-3 py-1.5",
            "text-foreground placeholder:text-text-subtle",
            "transition-[border-color,box-shadow] duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted",
            // iOS zoom fix
            "text-[16px] sm:text-sm",
            icon && "pl-10",
            error
              ? "border-destructive/60 focus-visible:ring-destructive/30 focus-visible:border-destructive"
              : "border-border hover:border-border/60 dark:hover:border-border/80",
            inputClassName
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}
