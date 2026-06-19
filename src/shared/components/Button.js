"use client";

import { Children, cloneElement, isValidElement } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Button — token-driven so it follows the theme automatically.
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium rounded-md",
    "transition-[background-color,color,box-shadow,transform] duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 active:scale-[0.985]",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary — high-contrast inverted surface (matches dashboard accent style)
        default:
          "bg-foreground text-background shadow-soft hover:bg-foreground/90 active:bg-foreground/85",
        primary:
          "bg-foreground text-background shadow-soft hover:bg-foreground/90 active:bg-foreground/85",

        // Accent — primary brand color
        accent:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",
        blue:
          "bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 active:bg-primary/85",

        // Destructive
        destructive:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 active:bg-destructive/85",
        danger:
          "bg-destructive text-destructive-foreground shadow-soft hover:bg-destructive/90 active:bg-destructive/85",

        // Outline — bordered, transparent fill
        outline:
          "border border-border bg-transparent text-foreground hover:bg-muted hover:border-border/80",

        // Secondary — soft fill
        secondary:
          "bg-muted text-foreground hover:bg-bg-hover",

        // Ghost — transparent
        ghost:
          "text-text-muted hover:text-foreground hover:bg-muted",

        // Link
        link:
          "text-primary underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-[13px]",
        xs: "h-7 px-2.5 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-11 px-6 text-[15px]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function renderInner(loading, icon, children, iconRight) {
  return (
    <>
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[16px] leading-none">progress_activity</span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="material-symbols-outlined text-[16px] leading-none">{iconRight}</span>
      )}
    </>
  );
}

function Button({ className, variant = "default", size = "default", asChild = false, icon, iconRight, loading, fullWidth, children, ...props }) {
  const classes = cn(buttonVariants({ variant, size, className }), fullWidth && "w-full");

  // When asChild=true, Slot expects exactly one element child. We must merge
  // the icon/iconRight/loading content INTO that child rather than as siblings.
  if (asChild) {
    const child = isValidElement(children) ? Children.only(children) : null;
    if (!child) {
      // Fallback: render as a plain button if asChild was used without a single
      // valid element child.
      return (
        <button className={classes} disabled={props.disabled || loading} {...props}>
          {renderInner(loading, icon, children, iconRight)}
        </button>
      );
    }
    return (
      <Slot className={classes} {...props}>
        {cloneElement(
          child,
          { "aria-disabled": props.disabled || loading || undefined },
          renderInner(loading, icon, child.props.children, iconRight)
        )}
      </Slot>
    );
  }

  return (
    <button
      className={classes}
      disabled={props.disabled || loading}
      {...props}
    >
      {renderInner(loading, icon, children, iconRight)}
    </button>
  );
}

export { Button, buttonVariants };
export default Button;
