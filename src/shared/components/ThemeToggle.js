"use client";

import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";

export default function ThemeToggle({ className, variant = "default" }) {
  const { toggleTheme, isDark } = useTheme();

  const variants = {
    default: cn(
      "inline-flex items-center justify-center size-8 rounded-md",
      "text-text-muted hover:text-foreground hover:bg-muted",
      "transition-colors duration-150"
    ),
    card: cn(
      "inline-flex items-center justify-center size-10 rounded-full",
      "bg-card border border-border shadow-soft",
      "text-text-muted hover:text-primary hover:shadow-pop hover:border-primary/30",
      "transition-[color,box-shadow,border-color] duration-200 group"
    ),
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(variants[variant], className)}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[18px] leading-none",
          variant === "card" && "transition-transform duration-300 group-hover:rotate-12"
        )}
      >
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}

