"use client";

import { cn } from "@/lib/utils";

// Card component with solid colors (no gradients)
export default function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = "md",
  hover = false,
  elev = false,
  className,
  accentColor,
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-3",
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };

  // Map accent colors to solid backgrounds
  const accentColors = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-amber-500",
    purple: "bg-purple-500",
    pink: "bg-pink-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
    indigo: "bg-indigo-500",
  };

  const bgColor = accentColor ? accentColors[accentColor] : "bg-blue-500";

  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900 text-slate-900 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm",
        hover && "hover:border-blue-300 hover:shadow-md transition-all duration-200",
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(
                "p-2 rounded-lg text-white shadow-md",
                bgColor
              )}>
                <span className="material-symbols-outlined text-lg">{icon}</span>
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

Card.Section = function CardSection({ children, accentColor, className, ...props }) {
  const accentBorders = {
    blue: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30",
    green: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
    yellow: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30",
    purple: "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30",
    red: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
  };
  
  const borderClass = accentColor && accentBorders[accentColor] 
    ? accentBorders[accentColor] 
    : "border-slate-200 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800/50";

  return (
    <div
      className={cn("p-4 rounded-lg border", borderClass, className)}
      {...props}
    >
      {children}
    </div>
  );
};

Card.Row = function CardRow({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "py-3 px-4 -mx-4 transition-colors rounded-lg",
        "border-b border-slate-100 dark:border-zinc-800 last:border-b-0 first:-mt-4 last:-mb-4",
        "hover:bg-slate-50 dark:hover:bg-zinc-800/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

Card.ListItem = function CardListItem({ children, actions, className, ...props }) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between py-3 px-4 -mx-4 rounded-lg",
        "border-b border-slate-100 dark:border-zinc-800 last:border-b-0 first:-mt-5 last:-mb-5",
        "hover:bg-slate-50 dark:hover:bg-zinc-800/50",
        "transition-colors",
        className
      )}
      {...props}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {actions && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {actions}
        </div>
      )}
    </div>
  );
};
