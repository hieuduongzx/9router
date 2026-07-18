export default {
  id: "tinyfish",
  alias: "tinyfish",
  display: {
    name: "TinyFish",
    icon: "travel_explore",
    color: "#0EA5E9",
    textIcon: "TF",
    website: "https://docs.tinyfish.ai",
    notice: {
      text: "Free Search & Fetch APIs. Get your key at agent.tinyfish.ai/api-keys",
      apiKeyUrl: "https://agent.tinyfish.ai/api-keys",
    },
  },
  category: "apikey",
  authType: "apikey",
  serviceKinds: ["webSearch", "webFetch"],
  searchConfig: {
    // GET https://api.search.tinyfish.ai?query=...
    baseUrl: "https://api.search.tinyfish.ai",
    method: "GET",
    authType: "apikey",
    authHeader: "x-api-key",
    costPerQuery: 0,
    freeMonthlyQuota: null,
    searchTypes: ["web", "news", "research_paper"],
    defaultMaxResults: 10,
    maxMaxResults: 50,
    timeoutMs: 15000,
    cacheTTLMs: 300000,
  },
  fetchConfig: {
    // POST https://api.fetch.tinyfish.ai  { urls: [...] }
    baseUrl: "https://api.fetch.tinyfish.ai",
    method: "POST",
    authType: "apikey",
    authHeader: "x-api-key",
    costPerQuery: 0,
    freeMonthlyQuota: null,
    formats: ["markdown", "html", "json"],
    maxCharacters: 200000,
    timeoutMs: 60000,
  },
};
