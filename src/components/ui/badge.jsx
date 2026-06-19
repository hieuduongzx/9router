import * as React from "react"
import { cva } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1.5 transition-all duration-150",
  {
    variants: {
      variant: {
        // Default - Soft gray with border
        default: "bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
        
        secondary: "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
        
        destructive: "bg-red-100 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800",
        
        outline: "border border-slate-200 text-slate-600 bg-white dark:border-zinc-700 dark:bg-transparent dark:text-zinc-400",
        
        // Status badges with soft colors
        success: "bg-green-100 text-green-700 border border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
        
        warning: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
        
        info: "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({ className, variant, ...props }) {
  return (
    <div
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
