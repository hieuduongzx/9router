"use client";

import PropTypes from "prop-types";
import { cn } from "@/shared/utils/cn";

/**
 * Terminal-style request status tag. Shared by both request tables so they can
 * never drift apart, and themed through the success/danger tokens rather than
 * hardcoded palette colours.
 *
 * Accepts the loose status values the two sources produce: "success"/"ok" (in
 * any case), a raw "200", and empty/"-" for records whose status was not
 * recorded — the last renders neutral rather than red, since "not recorded" is
 * not the same claim as "failed".
 */
export default function StatusPill({ status, className }) {
  const value = String(status ?? "").trim().toLowerCase();
  const unknown = value === "" || value === "-";
  const completed = value.includes("success") || value.includes("ok") || value === "200";

  let tone = "border-danger/30 bg-danger/10 text-danger";
  if (unknown) tone = "border-border bg-surface-2 text-text-muted";
  else if (completed) tone = "border-success/30 bg-success/10 text-success";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide",
        tone,
        className
      )}
    >
      {unknown ? "Unknown" : completed ? "Completed" : "Failed"}
    </span>
  );
}

StatusPill.propTypes = {
  status: PropTypes.string,
  className: PropTypes.string,
};
