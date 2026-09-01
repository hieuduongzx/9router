"use client";

import { useId } from "react";

import { Label } from "./ui/label";
import { Icon } from "./ui/icon";
import { cn } from "@/shared/utils/cn";

/**
 * Labelled native select.
 *
 * Stays a real `<select>` on purpose: every call site here passes
 * `onChange={(e) => …e.target.value}`, and native is also the better control on
 * mobile. Reach for `ui/select` (Radix) when you need custom option markup,
 * grouping, or search — its API is value/onValueChange, not an event.
 */
export default function Select({
  id,
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select an option",
  error,
  hint,
  disabled = false,
  required = false,
  className,
  selectClassName,
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <Label htmlFor={selectId}>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
      ) : null}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-9 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm",
            "dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            selectClassName,
          )}
          {...props}
        >
          {children ?? (
            <>
              <option value="" disabled>
                {placeholder}
              </option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </>
          )}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-60"
        />
      </div>
      {error ? (
        <p id={`${selectId}-error`} className="flex items-center gap-1.5 text-xs text-destructive">
          <Icon name="error" className="size-3.5" />
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={`${selectId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
