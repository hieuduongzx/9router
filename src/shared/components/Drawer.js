"use client";

import { useEffect } from "react";
import { cn } from "@/shared/utils/cn";

export default function Drawer({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  width = "md",
  className 
}) {
  const widths = {
    sm: "w-[400px]",
    md: "w-[500px]",
    lg: "w-[600px]",
    xl: "w-[800px]",
    full: "w-full",
  };

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-sm transition-opacity cursor-pointer animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className={cn(
        "absolute right-0 top-0 h-full bg-card shadow-float flex flex-col",
        "border-l border-border",
        "animate-slide-in-right",
        widths[width] || widths.md,
        className
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-foreground tracking-tight truncate">
                {title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="p-1.5 -mr-1 rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
