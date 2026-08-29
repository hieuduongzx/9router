"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import PropTypes from "prop-types";
import ProviderDetailClient from "../[id]/ProviderDetailClient";

export default function ProviderSettingsLightbox({ providerId, providerName, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  if (!providerId) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center sm:p-4 lg:p-8" role="dialog" aria-modal="true" aria-labelledby="provider-settings-title">
      <button type="button" className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Close provider settings" />
      <section className="relative flex min-h-0 w-full flex-col border-border bg-bg sm:max-w-7xl sm:border">
        <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-5">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">Provider settings</p>
            <h2 id="provider-settings-title" className="truncate font-mono text-sm font-semibold text-text-main">{providerName || providerId}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href={`/dashboard/providers/${providerId}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm px-3 font-mono text-xs font-semibold text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">open_in_new</span>
              <span className="hidden sm:inline">Open full page</span>
            </Link>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="inline-flex size-11 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-main focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Close provider settings"
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
            </button>
          </div>
        </header>
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <ProviderDetailClient providerId={providerId} embedded onClose={onClose} />
        </div>
      </section>
    </div>
  );
}

ProviderSettingsLightbox.propTypes = {
  providerId: PropTypes.string.isRequired,
  providerName: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};
