"use client";

import { Badge as UIBadge } from "./ui/badge";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Legacy Badge API over the shadcn badge. `default` maps to `secondary` because
 * in this codebase it always meant "quiet neutral chip", not "solid primary".
 */
const VARIANTS = {
  default: "secondary",
  primary: "default",
  secondary: "secondary",
  outline: "outline",
  success: "success",
  warning: "warning",
  error: "error",
  danger: "error",
  info: "info",
};

const DOT_COLORS = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-destructive",
  danger: "bg-destructive",
  info: "bg-info",
  primary: "bg-primary",
  default: "bg-muted-foreground",
  secondary: "bg-muted-foreground",
  outline: "bg-muted-foreground",
};

export default function Badge({
  children,
  variant = "default",
  size = "default",
  dot = false,
  icon,
  className,
  ...props
}) {
  return (
    <UIBadge variant={VARIANTS[variant] || "secondary"} size={size} className={className} {...props}>
      {dot ? (
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", DOT_COLORS[variant] || DOT_COLORS.default)}
        />
      ) : null}
      {icon ? <Icon name={icon} className="size-3" /> : null}
      {children}
    </UIBadge>
  );
}
