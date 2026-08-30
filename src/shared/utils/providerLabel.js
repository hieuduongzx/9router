import { AI_PROVIDERS } from "@/shared/constants/providers";

/**
 * Human label for a provider id.
 *
 * Custom providers ("provider nodes") are stored under a generated id like
 * `openai-compatible-chat-<uuid>`, which is meaningless in a UI. Their operator
 * name lives on the node row, so it wins; registry providers fall back to their
 * catalog display name; anything unknown shows the raw id rather than "Unknown",
 * since the id is still the only thing that identifies the row.
 *
 * Pure on purpose: this is imported by client components, so it must not reach
 * for the database. Callers on the server pass `nodeNames` in.
 *
 * @param {string} providerId
 * @param {Record<string, string>} [nodeNames] - provider node id → name
 * @returns {string}
 */
export function providerLabel(providerId, nodeNames = {}) {
  const id = String(providerId || "").trim();
  if (!id) return "Unknown provider";
  return nodeNames[id] || AI_PROVIDERS[id]?.name || id;
}
