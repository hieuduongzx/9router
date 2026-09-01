"use client";

import { Card as UICard } from "./ui/card";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Legacy configured-card API over the shadcn card surface.
 *
 * ~116 call sites pass `title`/`subtitle`/`icon`/`action`/`padding`, so the
 * header is assembled here instead of composed at each site. New code should
 * use `ui/card`'s slots (`CardHeader`/`CardTitle`/`CardAction`/`CardContent`) —
 * they read better and don't need a prop per feature.
 */
const PADDINGS = {
  none: "p-0",
  xs: "p-3",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

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
  const hasHeader = Boolean(title || action);

  return (
    <UICard
      className={cn(
        // The base card owns vertical rhythm via `py-6 gap-6`; padding here is
        // explicit and uniform, so both are reset first.
        "gap-0 py-0",
        PADDINGS[padding] ?? PADDINGS.md,
        hover && "cursor-pointer transition-colors hover:bg-accent/40",
        elev && "shadow-sm",
        className,
      )}
      {...props}
    >
      {hasHeader ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                <Icon name={icon} className="size-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              {title ? <h3 className="truncate font-semibold leading-none">{title}</h3> : null}
              {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      {children}
    </UICard>
  );
}

Card.Section = function CardSection({ children, className, ...props }) {
  return (
    <div className={cn("rounded-lg border bg-muted/30 p-4", className)} {...props}>
      {children}
    </div>
  );
};

Card.Row = function CardRow({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "-mx-3 border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/40",
        className,
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
        "group -mx-3 flex items-center justify-between border-b px-3 py-3 transition-colors last:border-b-0 hover:bg-accent/40",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {actions ? (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {actions}
        </div>
      ) : null}
    </div>
  );
};
