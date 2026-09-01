"use client";

import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { cn } from "@/shared/utils/cn";

/**
 * Legacy Toggle API over the Radix switch. Call sites pass
 * `checked`/`onChange(next)`, so the boolean is unwrapped here rather than
 * Radix's `onCheckedChange`.
 */
export default function Toggle({
  checked = false,
  onChange,
  label,
  description,
  disabled = false,
  size = "md",
  className,
  ariaLabel,
  title,
  id,
}) {
  const control = (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={(next) => onChange?.(next)}
      disabled={disabled}
      size={size}
      aria-label={ariaLabel || (label ? undefined : title)}
      title={title}
    />
  );

  if (!label && !description) {
    return <div className={className}>{control}</div>;
  }

  return (
    <div className={cn("flex items-center gap-3", disabled && "opacity-50", className)}>
      {control}
      <div className="flex flex-col gap-1">
        {label ? (
          <Label htmlFor={id} className="leading-none">
            {label}
          </Label>
        ) : null}
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </div>
    </div>
  );
}
