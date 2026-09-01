"use client";

import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

/**
 * Legacy Tooltip API over the Radix tooltip.
 *
 * The previous implementation was pure CSS `:hover`, so it never appeared for
 * keyboard users and could be clipped by an ancestor's `overflow: hidden`. Radix
 * portals the content and opens on focus as well as hover.
 *
 * The trigger wraps children in a span rather than using them directly: several
 * call sites pass a `<button>`, and Radix's default trigger *is* a button.
 */
export default function Tooltip({ text, children, position = "top", color, className }) {
  if (!text) return children;

  return (
    <UITooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side={position}
        className={className}
        style={color ? { backgroundColor: color, color: "#fff" } : undefined}
      >
        {text}
      </TooltipContent>
    </UITooltip>
  );
}
