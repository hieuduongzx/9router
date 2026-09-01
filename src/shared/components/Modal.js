"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import Button from "./Button";
import { cn } from "@/shared/utils/cn";

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  full: "sm:max-w-4xl",
};

/**
 * Legacy Modal API over the Radix dialog.
 *
 * The old implementation handled Escape and scroll-lock by hand but had no focus
 * trap, no `role="dialog"`, and no return-focus — a keyboard user could tab
 * behind an open modal. Radix supplies all of that; this wrapper only translates
 * the `isOpen`/`onClose`/`title`/`footer` prop shape used by ~40 call sites.
 *
 * `showTrafficLights` is accepted and ignored: the macOS dot row it drew was
 * decorative (two of the three dots were inert) and the dialog now has a single
 * real close affordance.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnOverlay = true,
  showTrafficLights,
  className,
  bodyClassName,
}) {
  void showTrafficLights;

  return (
    <Dialog open={Boolean(isOpen)} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className={cn("gap-0 p-0", SIZES[size] || SIZES.md, className)}
        onInteractOutside={closeOnOverlay ? undefined : (event) => event.preventDefault()}
      >
        <DialogHeader className="border-b px-5 py-4 pr-12">
          {/* Always rendered: Radix needs a title for the dialog's accessible name. */}
          <DialogTitle className={title ? "text-base" : "sr-only"}>{title || "Dialog"}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className={cn("custom-scrollbar max-h-[70vh] overflow-y-auto p-5", bodyClassName)}>
          {children}
        </div>

        {footer ? (
          <DialogFooter className="border-t px-5 py-3.5 sm:justify-end">{footer}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
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
      <p className="text-sm text-muted-foreground">{message}</p>
    </Modal>
  );
}
