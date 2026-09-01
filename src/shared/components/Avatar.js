"use client";

import { Avatar as UIAvatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "@/shared/utils/cn";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
};

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Avatar({ src, alt = "Avatar", name, size = "md", className }) {
  return (
    <UIAvatar className={cn(SIZES[size] || SIZES.md, className)}>
      {src ? <AvatarImage src={src} alt={alt} /> : null}
      <AvatarFallback className="font-medium uppercase">{getInitials(name)}</AvatarFallback>
    </UIAvatar>
  );
}
