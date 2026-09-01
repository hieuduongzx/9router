"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "@/shared/utils/cn";

const SIZES = {
  sm: {
    root: "h-4 w-7",
    thumb: "size-3 data-[state=checked]:translate-x-3",
  },
  md: {
    root: "h-5 w-9",
    thumb: "size-4 data-[state=checked]:translate-x-4",
  },
  lg: {
    root: "h-6 w-11",
    thumb: "size-5 data-[state=checked]:translate-x-5",
  },
};

function Switch({ className, size = "md", ...props }) {
  const dimensions = SIZES[size] || SIZES.md;
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex shrink-0 items-center rounded-full border border-transparent p-0.5 shadow-xs outline-none transition-all",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        dimensions.root,
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-background ring-0 transition-transform duration-200",
          "data-[state=unchecked]:translate-x-0",
          "dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
          dimensions.thumb,
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
