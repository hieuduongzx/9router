"use client";

import { cn } from "@/lib/utils";

// Card — token-driven container with refined elevation and spacing.
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
        "rounded-xl border border-border bg-card text-card-foreground",
        elev ? "shadow-pop" : "shadow-soft",
        hover &&
          "transition-[border-color,box-shadow,transform] duration-200 ease-out hover:border-primary/40 hover:shadow-pop",
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className={cn(
                  "flex items-center justify-center size-9 shrink-0 rounded-lg text-white shadow-soft",
                  bgColor
                )}
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
              )}
              {subtitle && (
                <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

Card.Section = function CardSection({ children, accentColor, className, ...props }) {
  const accentBorders = {
    blue: "border-blue-200/70 bg-blue-500/[0.06] dark:border-blue-800/50",
    green: "border-green-200/70 bg-green-500/[0.06] dark:border-green-800/50",
    yellow: "border-amber-200/70 bg-amber-500/[0.06] dark:border-amber-800/50",
    purple: "border-purple-200/70 bg-purple-500/[0.06] dark:border-purple-800/50",
    red: "border-red-200/70 bg-red-500/[0.06] dark:border-red-800/50",
  };

  const borderClass = accentColor && accentBorders[accentColor]
    ? accentBorders[accentColor]
    : "border-border bg-bg-subtle/50";

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
        "border-b border-border last:border-b-0 first:-mt-4 last:-mb-4",
        "hover:bg-bg-subtle/60",
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
        "border-b border-border last:border-b-0 first:-mt-5 last:-mb-5",
        "hover:bg-bg-subtle/60 transition-colors",
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
