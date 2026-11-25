"use client";

import { Icon } from "@/shared/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

/**
 * Kebab menu for low-frequency account actions.
 * Rendered via Radix DropdownMenu Portal so table overflow containers never clip it.
 * @param {{items: Array<{label: string, icon: string, onSelect: () => void, disabled?: boolean, danger?: boolean}>, label: string, align?: "left"|"right"}} props
 */
export default function ActionMenu({ items, label, align = "right" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name="more_horiz" className="size-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align === "left" ? "start" : "end"}
        className="w-52 rounded-lg p-1"
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.label}
            disabled={item.disabled}
            onSelect={() => item.onSelect()}
            variant={item.danger ? "destructive" : "default"}
            className="cursor-pointer gap-2 font-mono text-xs"
          >
            <Icon name={item.icon} className="size-[16px]" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
