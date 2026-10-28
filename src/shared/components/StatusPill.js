"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * Terminal-style request status tag. Shared by both request tables so they can
 * never drift apart, and themed through the success/danger tokens rather than
 * hardcoded palette colours.
 *
 * Accepts the loose status values the two sources produce: "success"/"ok" (in
 * any case), a raw "200", "rate_limited"/"error_429", "error_<code>", and
 * empty/"-" for records whose status was not recorded — the last renders
 * neutral rather than red, since "not recorded" is not the same claim as
 * "failed".
 */
export default function StatusPill({ status, className }) {
  const value = String(status ?? "").trim().toLowerCase();
  const unknown = value === "" || value === "-";
  const completed = value.includes("success") || value === "ok" || value === "200";
  // A 429 is capacity, not a broken request: it gets its own tone so it reads
  // differently from a hard failure, matching the "Rate limited" outcome filter.
  const rateLimited = !completed && (value.includes("429") || value.includes("rate"));
  const code = value.match(/(\d{3})/)?.[1];

  let tone = "border-danger/30 bg-danger/10 text-danger";
  let label = code ? `Failed · ${code}` : "Failed";
  if (unknown) {
    tone = "border-border bg-surface-2 text-muted-foreground";
    label = "Unknown";
  } else if (completed) {
    tone = "border-success/30 bg-success/10 text-success";
    label = "Completed";
  } else if (rateLimited) {
    tone = "border-warning/40 bg-warning/10 text-warning";
    label = "Rate limited";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center border px-2 py-0.5 text-xs font-medium text-muted-foreground tracking-wide",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}

StatusPill.propTypes = {
  status: PropTypes.string,
  className: PropTypes.string,
};
