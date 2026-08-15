/**
 * Shared, theme-aware chart constants for the dashboard.
 *
 * Colors read from the CSS custom properties defined in globals.css so charts
 * follow light/dark mode instead of hard-coding hex values that wash out (or
 * vanish) against one of the two grounds. Everything is flat, square, and
 * hairline — no shadows, gradients-as-decoration, or rounded chrome.
 */

export const CHART_COLORS = {
  tokens: "var(--color-chip-tokens)", // violet
  requests: "var(--color-chip-requests)", // amber
  cost: "var(--color-chip-cost)", // green
  danger: "var(--color-chip-danger)", // red
  info: "var(--color-chip-info)", // blue
  input: "var(--color-chip-tokens)",
  output: "var(--color-chip-info)",
  muted: "var(--color-text-subtle)",
};

/** Categorical ramp for by-model / by-provider breakdowns (max 5 + Other). */
export const CHART_RAMP = [
  "var(--color-chip-tokens)",
  "var(--color-chip-info)",
  "var(--color-chip-cost)",
  "var(--color-chip-requests)",
  "var(--color-chip-danger)",
];

export const CHART_OTHER = "var(--color-text-subtle)";

/** Thin solid series stroke for single-metric trend lines. */
export const TREND_STROKE = "var(--color-text-main)";

export const CHART_TICK = {
  fill: "var(--color-text-muted)",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
};

export const CHART_GRID = {
  stroke: "var(--color-border)",
  strokeOpacity: 0.6,
  strokeDasharray: "2 4",
};

export const CHART_TOOLTIP_STYLE = {
  background: "var(--color-surface)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 0,
  color: "var(--color-text-main)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  boxShadow: "none",
};

export const CHART_TOOLTIP_LABEL = {
  color: "var(--color-text-main)",
  fontFamily: "var(--font-mono)",
};

export const CHART_CURSOR = { fill: "var(--color-surface-2)", opacity: 0.55 };
