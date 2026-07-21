"use client";

import { cn } from "@/shared/utils/cn";

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
  ...props
}) {
  const paddings = {
    none: "",
    xs: "p-3",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface text-text-main",
        elev ? "shadow-md" : "shadow-sm",
        hover && "transition-colors hover:bg-surface-2/40 cursor-pointer",
        paddings[padding],
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex size-9 items-center justify-center rounded-md border border-border bg-surface-2 text-text-muted">
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold leading-none tracking-tight">{title}</h3>}
              {subtitle && <p className="mt-1.5 text-sm text-text-muted">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

Card.Section = function CardSection({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-bg p-4",
        className
      )}
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
        "border-b border-border px-3 py-3 -mx-3 last:border-b-0",
        "transition-colors hover:bg-surface-2/50",
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
        "group flex items-center justify-between border-b border-border px-3 py-3 -mx-3 last:border-b-0",
        "transition-colors hover:bg-surface-2/50",
        className
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {actions}
        </div>
      )}
    </div>
  );
};
