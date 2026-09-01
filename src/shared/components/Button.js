"use client";

import { Button as UIButton } from "./ui/button";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Legacy Button API kept as an adapter over the shadcn button.
 *
 * ~300 call sites pass this codebase's own vocabulary (`variant="primary"`,
 * `icon="add"`, `loading`, `fullWidth`). Rather than touch every one, the names
 * are translated here; `ui/button` stays the canonical shadcn component for new
 * code. `danger`/`error` both map to `destructive` because both spellings are
 * already in use.
 */
const VARIANTS = {
  primary: "default",
  default: "default",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  link: "link",
  danger: "destructive",
  destructive: "destructive",
  error: "destructive",
  success: "success",
  warning: "default",
  info: "default",
};

const SIZES = {
  xs: "xs",
  sm: "sm",
  md: "default",
  default: "default",
  lg: "lg",
  xl: "lg",
  icon: "icon",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  return (
    <UIButton
      variant={VARIANTS[variant] || "default"}
      size={SIZES[size] || "default"}
      disabled={disabled || loading}
      className={cn(fullWidth && "w-full", className)}
      {...props}
    >
      {loading ? <Icon name="progress_activity" /> : icon ? <Icon name={icon} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} /> : null}
    </UIButton>
  );
}
