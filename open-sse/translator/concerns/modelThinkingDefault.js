import { extractThinking } from "./thinkingUnified.js";

const VALID_MODES = new Set([
  "auto",
  "none",
  "thinking",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);

export function normalizeModelThinkingDefault(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (normalized === "off" || normalized === "disabled") return "none";
  return VALID_MODES.has(normalized) ? normalized : "auto";
}

// Apply a published model route's default only when the client did not send
// thinking intent in any supported wire shape. The normal translator later
// converts this neutral hint into the selected provider's native format.
export function applyModelThinkingDefault(body, value) {
  const mode = normalizeModelThinkingDefault(value);
  if (!body || typeof body !== "object" || mode === "auto" || extractThinking(body)) {
    return body;
  }
  if (mode === "thinking") {
    return { ...body, thinking: { type: "enabled" } };
  }
  return { ...body, reasoning_effort: mode };
}
