"use client";

import { useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import Button from "./Button";
import Tooltip from "./Tooltip";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  showTrafficLights = true,
  className,
}) {
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-4xl",
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Modal content */}
      <div
        className={cn(
          "relative w-full bg-card text-card-foreground",
          "border border-border",
          "rounded-xl shadow-float",
          "animate-slide-up",
          sizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || showTrafficLights) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center min-w-0">
              {/* Traffic lights — desktop only */}
              {showTrafficLights && (
                <div className="hidden md:flex items-center gap-2 mr-4 shrink-0">
                  <Tooltip text="Close" position="top" color="#FF5F56">
                    <button
                      onClick={onClose}
                      aria-label="Close"
                      title="Close"
                      className="w-3 h-3 rounded-full bg-[#FF5F56] hover:brightness-90 transition-all cursor-pointer flex items-center justify-center group/dot"
                    >
                      <span className="text-[8px] font-bold text-black/60 opacity-0 group-hover/dot:opacity-100 transition-opacity leading-none">✕</span>
                    </button>
                  </Tooltip>
                  <div className="w-3 h-3 rounded-full bg-text-muted/30 cursor-not-allowed" />
                  <div className="w-3 h-3 rounded-full bg-text-muted/30 cursor-not-allowed" />
                </div>
              )}
              {title && (
                <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">
                  {title}
                </h2>
              )}
            </div>
            {/* X button — mobile only */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="md:hidden p-1.5 rounded-md text-text-muted hover:bg-muted hover:text-foreground transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 max-h-[calc(80vh-140px)] overflow-y-auto custom-scrollbar">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border bg-bg-subtle/30 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  loading = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-foreground/85 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}
