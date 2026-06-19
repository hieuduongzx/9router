"use client";

import { cn } from "@/shared/utils/cn";

export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className,
}) {
  const sizes = {
    sm: {
      track: "w-7 h-4",
      thumb: "size-3",
      translate: "translate-x-3",
    },
    md: {
      track: "w-10 h-[22px]",
      thumb: "size-[18px]",
      translate: "translate-x-[18px]",
    },
    lg: {
      track: "w-12 h-7",
      thumb: "size-6",
      translate: "translate-x-5",
    },
  };

  const handleClick = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer rounded-full p-0.5",
          "transition-colors duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked
            ? "bg-primary"
            : "bg-bg-hover dark:bg-bg-hover/80",
          sizes[size].track,
          disabled && "cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block rounded-full bg-white shadow-soft ring-1 ring-black/5",
            "transform transition-transform duration-200 ease-out",
            checked ? sizes[size].translate : "translate-x-0",
            sizes[size].thumb
          )}
        />
      </button>
      {(label || description) && (
        <div className="flex flex-col leading-tight">
          {label && (
            <span className="text-[13px] font-medium text-foreground">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-text-muted mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

