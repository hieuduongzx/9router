// These are request parameters, not evidence of how much reasoning a model did.
export function formatRequestReasoning(intent, fallback = "—") {
  if (!intent) return fallback;
  if (intent.mode === "none") return "Off";
  if (intent.mode === "budget") return `${Number(intent.budget).toLocaleString()} tokens`;
  if (intent.mode === "level") return intent.level || fallback;
  if (intent.mode === "auto") return "Auto";
  if (intent.mode === "enabled") return "On";
  if (intent.mode === "adaptive") return "Adaptive";
  return fallback;
}
