"use client";

import { useId } from "react";

import { Input as UIInput } from "./ui/input";
import { Label } from "./ui/label";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Labelled field wrapper over the shadcn input — label, optional leading icon,
 * error and hint in one component, which is how ~60 forms in this app already
 * call it. Use `ui/input` directly when you're composing your own field.
 */
export default function Input({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className,
  inputClassName,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={inputId}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      <div className="relative">
        {icon ? (
          <Icon
            name={icon}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
        ) : null}
        <UIInput
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(icon && "pl-9", inputClassName)}
          {...props}
        />
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="flex items-center gap-1.5 text-xs text-destructive">
          <Icon name="error" className="size-3.5" />
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
