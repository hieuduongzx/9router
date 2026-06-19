import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary - solid foreground
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        // Destructive
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        // Outline
        outline:
          "border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground",
        // Secondary
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        // Ghost
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground",
        // Link
        link:
          "text-foreground underline-offset-4 hover:underline",
        // Subtle accent (used where 'blue' was used previously — kept neutral)
        blue:
          "bg-foreground text-background shadow-sm hover:bg-foreground/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
