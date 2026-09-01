"use client";

import { useTheme } from "@/shared/hooks/useTheme";
import { cn } from "@/shared/utils/cn";
import { Icon } from "@/shared/components/ui/icon";

export default function ThemeToggle({ className, variant = "default" }) {
  const { isDark, toggleTheme } = useTheme();

  const variants = {
    default: cn(
      "flex items-center justify-center size-8 rounded-sm",
      "text-muted-foreground hover:text-foreground",
      "hover:bg-surface-2 transition-colors"
    ),

    card: cn(
      "flex items-center justify-center size-11 rounded-sm",
      "bg-surface hover:bg-surface-2",
      "border border-border",
      "text-muted-foreground hover:text-foreground",
      "transition-all group"
    ),
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(variants[variant], className)}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      <Icon name={isDark ? "light_mode" : "dark_mode"} className={cn(
          "size-[18px]",
          variant === "card" && "transition-transform duration-300 group-hover:rotate-12"
        )} />
    </button>
  );
}
