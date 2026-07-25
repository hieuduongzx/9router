"use client";

import { cn } from "@/shared/utils/cn";

/** Corner-bracket ornament — the system's one decorative device. Use on featured/hero panels only. */
export default function CropFrame({ children, className }) {
  return (
    <div className={cn("crop-frame", className)}>
      <span className="crop-corner-tr" aria-hidden />
      <span className="crop-corner-bl" aria-hidden />
      {children}
    </div>
  );
}
