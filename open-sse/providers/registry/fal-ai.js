export default {
  id: "fal-ai",
  priority: 55,
  hasFree: true,
  alias: "fal-ai",
  aliases: [
    "fal",
  ],
  uiAlias: "fal",
  display: {
    name: "Fal AI",
    icon: "bolt",
    color: "#2563EB",
    textIcon: "FL",
    website: "https://fal.ai",
    notice: {
      text: "OpenAI-compatible chat via fal.run/openrouter. Auth: Authorization: Key <FAL_KEY> (not Bearer). Suggested list = OpenRouter free slugs ending in :free. Paid models still work if you add them manually.",
      apiKeyUrl: "https://fal.ai/dashboard/keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  authHint: "Paste your FAL_KEY (uuid:hex). Requests use Authorization: Key …",
  transport: {
    baseUrl: "https://fal.run/openrouter/router/openai/v1/chat/completions",
    format: "openai",
    thinkingFormat: "openai",
    // FAL rejects Bearer; Authorization must be "Key <token>".
    auth: {
      combined: true,
      header: "Authorization",
      scheme: "key",
    },
  },
  models: [
    { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "NVIDIA: Nemotron 3 Ultra (free)" },
    { id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free", name: "NVIDIA: Nemotron 3 Nano Omni (free)" },
    { id: "cohere/north-mini-code:free", name: "Cohere: North Mini Code (free)" },
    { id: "google/gemma-4-31b-it:free", name: "Google: Gemma 4 31B (free)" },
    { id: "google/gemma-4-26b-a4b-it:free", name: "Google: Gemma 4 26B A4B (free)" },
    { id: "poolside/laguna-m.1:free", name: "Poolside: Laguna M.1 (free)" },
    // Native Fal image endpoints (queue.fal.run) — still available under media routes.
    { id: "fal-ai/flux/schnell", name: "FLUX Schnell", params: ["n", "size"], kind: "image" },
    { id: "fal-ai/flux/dev", name: "FLUX Dev", params: ["n", "size"], kind: "image" },
    { id: "fal-ai/flux-pro/v1.1", name: "FLUX Pro v1.1", params: ["n", "size"], kind: "image" },
    { id: "fal-ai/flux-pro/v1.1-ultra", name: "FLUX Pro v1.1 Ultra", params: ["n", "size"], kind: "image" },
    { id: "fal-ai/recraft-v3", name: "Recraft V3", params: ["n", "size", "style"], kind: "image" },
    { id: "fal-ai/ideogram/v2", name: "Ideogram V2", params: ["n", "size", "style"], kind: "image" },
    { id: "fal-ai/stable-diffusion-v35-large", name: "SD 3.5 Large", params: ["n", "size"], kind: "image" },
  ],
  serviceKinds: ["llm", "image"],
  imageConfig: { baseUrl: "https://queue.fal.run" },
  // Suggest only OpenRouter free-tier slugs (id ends with ":free").
  modelsFetcher: { url: "https://openrouter.ai/api/v1/models", type: "openrouter-free-suffix" },
  passthroughModels: true,
};
