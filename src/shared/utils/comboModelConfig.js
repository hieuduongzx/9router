import { getCapabilitiesForModel } from "open-sse/providers/capabilities.js";
import { comboRoutedModels } from "open-sse/services/comboMembers.js";
import { getThinkingLevels } from "open-sse/providers/thinkingLevels.js";
import { resolveProviderId } from "@/shared/constants/providers";

export const MODEL_CAPABILITIES = [
  ["reasoning", "Reasoning", "psychology"],
  ["vision", "Vision", "visibility"],
  ["pdf", "PDF input", "description"],
  ["tools", "Tools", "build"],
  ["search", "Web search", "travel_explore"],
  ["audioInput", "Audio input", "mic"],
  ["audioOutput", "Audio output", "volume_up"],
  ["videoInput", "Video input", "videocam"],
  ["imageOutput", "Image output", "image"],
];

export const MODEL_CAPABILITY_KEYS = MODEL_CAPABILITIES.map(([key]) => key);

const THINKING_MODE_META = {
  auto: { label: "Auto", description: "Honor the client request or use each model's native default." },
  none: { label: "Off", description: "Request no reasoning. Models that cannot disable it use their minimum level." },
  thinking: { label: "On", description: "Enable the model's native thinking mode." },
  minimal: { label: "Minimal", description: "Use the smallest supported reasoning effort." },
  low: { label: "Low", description: "Prefer short reasoning for lower latency." },
  medium: { label: "Medium", description: "Balance reasoning depth and latency." },
  high: { label: "High", description: "Use deeper reasoning when the selected model supports it." },
  xhigh: { label: "X-high", description: "Use extended reasoning on compatible models." },
  max: { label: "Max", description: "Use the largest supported reasoning budget." },
};

const THINKING_MODE_ORDER = ["auto", "none", "thinking", "minimal", "low", "medium", "high", "xhigh", "max"];
const VALID_THINKING_MODES = new Set(THINKING_MODE_ORDER);

export function normalizeThinkingMode(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (normalized === "off" || normalized === "disabled") return "none";
  return VALID_THINKING_MODES.has(normalized) ? normalized : "auto";
}

export function thinkingModeMeta(value) {
  const mode = normalizeThinkingMode(value);
  return { value: mode, ...THINKING_MODE_META[mode] };
}

export function normalizeCapabilityOverrides(value) {
  const overrides = {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return overrides;
  for (const key of MODEL_CAPABILITY_KEYS) {
    if (typeof value[key] === "boolean") overrides[key] = value[key];
  }
  return overrides;
}

export function splitRoutedModel(value) {
  const routed = String(value || "").trim();
  const separator = routed.indexOf("/");
  const providerAlias = separator > 0 ? routed.slice(0, separator) : "";
  const model = separator > 0 ? routed.slice(separator + 1) : routed;
  return {
    provider: resolveProviderId(providerAlias) || providerAlias || null,
    model,
  };
}

function mergeCapabilities(target, capabilities) {
  for (const [key, value] of Object.entries(capabilities || {})) {
    if (typeof value === "boolean") {
      target[key] = Boolean(target[key]) || value;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      target[key] = Math.max(Number(target[key]) || 0, value);
    } else if (Array.isArray(value)) {
      target[key] = Array.from(new Set([...(target[key] || []), ...value]));
    } else if (value != null && target[key] == null) {
      target[key] = value;
    }
  }
}

export function deriveComboCapabilities(models) {
  const capabilities = {};
  for (const member of models || []) {
    const value = typeof member === "string" ? member : member?.value || member?.id || "";
    const { provider, model } = splitRoutedModel(value);
    if (!model) continue;
    mergeCapabilities(capabilities, getCapabilitiesForModel(provider, model));
  }
  return capabilities;
}

export function applyCapabilityOverrides(capabilities, overrides) {
  const result = { ...(capabilities || {}) };
  for (const [key, enabled] of Object.entries(normalizeCapabilityOverrides(overrides))) {
    result[key] = enabled;
  }
  return result;
}

export function getEffectiveComboCapabilities(combo) {
  // Switched-off members must not advertise caps the route can never serve.
  return applyCapabilityOverrides(
    deriveComboCapabilities(comboRoutedModels(combo)),
    combo?.capabilityOverrides,
  );
}

export function getComboThinkingProfile(models) {
  const available = new Set(["auto", "none"]);
  let reasoningModels = 0;
  let cannotDisable = 0;

  for (const member of models || []) {
    const value = typeof member === "string" ? member : member?.value || member?.id || "";
    const { provider, model } = splitRoutedModel(value);
    if (!model) continue;
    const levels = getThinkingLevels(provider, model);
    if (!levels?.length) continue;
    reasoningModels += 1;
    if (!levels.includes("none")) cannotDisable += 1;
    levels.forEach((level) => available.add(level));
  }

  return {
    options: THINKING_MODE_ORDER
      .filter((mode) => available.has(mode))
      .map((mode) => ({ value: mode, ...THINKING_MODE_META[mode] })),
    reasoningModels,
    cannotDisable,
  };
}
