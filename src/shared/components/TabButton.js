"use client";

import { cn } from "@/lib/utils";

// Tab/Contact style card - kiểu như ảnh (icon màu, text đen, border nhẹ)
export function TabButton({
  children,
  title,
  subtitle,
  icon,
  iconColor = "blue",
  onClick,
  href,
  active = false,
  className,
  ...props
}) {
  // Icon colors - màu nhạt cho icon background
  const iconBgColors = {
    blue: "bg-blue-50 text-blue-500",
    purple: "bg-purple-50 text-purple-500",
    green: "bg-green-50 text-green-500",
    cyan: "bg-cyan-50 text-cyan-500",
    amber: "bg-amber-50 text-amber-500",
    pink: "bg-pink-50 text-pink-500",
    indigo: "bg-indigo-50 text-indigo-500",
    red: "bg-red-50 text-red-500",
  };

  const Comp = href ? "a" : "button";

  return (
    <Comp
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-3 rounded-xl border transition-all duration-200",
        active
          ? "border-blue-300 bg-blue-50/50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50",
        className
      )}
      {...props}
    >
      {icon && (
        <div className={cn(
          "flex items-center justify-center h-10 w-10 rounded-lg shrink-0",
          iconBgColors[iconColor] || iconBgColors.blue
        )}>
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>
      )}
      <div className="flex flex-col items-start text-left min-w-0">
        {title && (
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </span>
        )}
        {subtitle && (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </span>
        )}
        {children}
      </div>
    </Comp>
  );
}

// Simple black button - cho các nút hành động chính
export function BlackButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  loading = false,
  className,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2",
        "bg-black text-white text-sm font-medium rounded-lg",
        "hover:bg-slate-800 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "dark:bg-white dark:text-black dark:hover:bg-slate-200",
        className
      )}
      {...props}
    >
      {loading && (
        <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
      )}
      {children}
    </button>
  );
}

// Outline button đen - cho các nút phụ
export function OutlineButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  className,
  ...props
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2",
        "bg-transparent text-slate-700 text-sm font-medium rounded-lg",
        "border border-slate-300 hover:bg-slate-50 hover:border-slate-400",
        "transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "dark:text-slate-300 dark:border-zinc-600 dark:hover:bg-zinc-800",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default TabButton;
