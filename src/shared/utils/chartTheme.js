/**
 * Shared, theme-aware chart constants for the dashboard.
 *
 * Colors read the CSS custom properties from globals.css so charts follow
 * light/dark mode instead of hard-coding hex values that wash out (or vanish)
 * against one of the two grounds. Chrome matches the card/popover primitives:
 * rounded, hairline, one small shadow.
 */

export const CHART_COLORS = {
  tokens: "var(--chip-tokens)", // violet
  requests: "var(--chip-requests)", // amber
  cost: "var(--chip-cost)", // green
  danger: "var(--chip-danger)", // red
  info: "var(--chip-info)", // blue
  input: "var(--chip-tokens)",
  output: "var(--chip-info)",
  muted: "var(--muted-foreground)",
};

/** Categorical ramp for by-model / by-provider breakdowns (max 5 + Other). */
export const CHART_RAMP = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export const CHART_OTHER = "var(--muted-foreground)";

/** Series stroke for single-metric trend lines. */
export const TREND_STROKE = "var(--primary)";

export const CHART_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-sans)",
};

export const CHART_GRID = {
  stroke: "var(--border)",
  strokeOpacity: 1,
};

export const CHART_TOOLTIP_STYLE = {
  background: "var(--popover)",
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
};

export const CHART_TOOLTIP_LABEL = {
  color: "var(--popover-foreground)",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
};

export const CHART_CURSOR = { fill: "var(--muted)", opacity: 0.6 };
