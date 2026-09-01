import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with conflict resolution.
 *
 * `twMerge` is what makes `className` a real override on every primitive: a
 * caller passing `rounded-none` or `h-11` wins over the component's base
 * utility instead of both landing in the class list and the later-defined one
 * silently winning. The previous implementation was a plain join, which is why
 * ~90 call sites reached for `!important` prefixes to force an override — those
 * are unnecessary now.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
