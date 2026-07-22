// Free OpenCode models that don't use the "-free" id suffix
const KNOWN_FREE_OPENCODE_MODELS = ["big-pickle"];

export const FILTERS = {
  // Generic OpenAI / OpenRouter-style catalog: keep id + display name.
  openai: (models) =>
    models
      .filter((m) => m?.id)
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length || m.contextLength,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),

  // OpenRouter free-tier slugs: id ends with ":free" (e.g. nvidia/nemotron-…:free).
  "openrouter-free-suffix": (models) =>
    models
      .filter((m) => typeof m?.id === "string" && m.id.endsWith(":free"))
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
        contextLength: m.context_length || m.contextLength,
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),

  "openrouter-free": (models) =>
    models
      .filter(
        (m) =>
          m.pricing?.prompt === "0" &&
          m.pricing?.completion === "0" &&
          m.context_length >= 200000
      )
      .map((m) => ({ id: m.id, name: m.name, contextLength: m.context_length }))
      .sort((a, b) => b.contextLength - a.contextLength),

  "opencode-free": (models) =>
    models
      .filter((m) => m.id?.endsWith("-free") || KNOWN_FREE_OPENCODE_MODELS.includes(m.id))
      .map((m) => ({ id: m.id, name: m.id })),

  // models.dev returns a large catalog; keep only mimo models
  "mimo-free": (models) =>
    (Array.isArray(models) ? models : [])
      .filter((m) => m.id?.startsWith("mimo") || m.name?.toLowerCase().includes("mimo"))
      .map((m) => ({ id: m.id, name: m.name || m.id })),
};
