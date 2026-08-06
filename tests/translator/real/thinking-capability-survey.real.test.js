// REAL survey: probe EVERY chat model (all providers with active creds) for actual
// reasoning behaviour and compare it against the declared capability data in
// open-sse/providers/capabilities.js + thinkingLevels.js.
//
// Two probes per model:
//   A "on"  — reasoning_effort=<THINK_EFFORT> → did the model actually reason?
//   B "off" — reasoning_effort=none, ONLY for models that reasoned in A
//             → verifies caps.thinkingCanDisable (never covered by any other test).
//
// This is a SURVEY: it logs a table + suggested capabilities.js edits, it does not
// fail on capability mismatches (only real harness errors throw).
//
//   RUN_REAL=1 npx vitest run -c tests/vitest.config.js "tests/translator/real/thinking-capability-survey"
//   RUN_REAL=1 REAL_PROVIDERS=claude,glm,deepseek npx vitest run ... (provider filter)
//   RUN_REAL=1 THINK_MODELS=glm-5,kimi npx vitest run ...            (model substring filter)
//   RUN_REAL=1 THINK_SKIP_DISABLE=1 npx vitest run ...               (skip probe B, halves quota)
import { describe, it, expect, afterAll } from "vitest";
import { getProviderCredentials } from "../../../src/sse/services/auth.js";
import { checkAndRefreshToken } from "../../../src/sse/services/tokenRefresh.js";
import { handleChatCore } from "../../../open-sse/handlers/chatCore.js";
import { getModelsByProviderId } from "../../../open-sse/config/providerModels.js";
import { getCapabilitiesForModel } from "../../../open-sse/providers/capabilities.js";
import { getThinkingLevels } from "../../../open-sse/providers/thinkingLevels.js";
// Same detector the dashboard's per-model reasoning probe uses, so the button and
// this survey can never disagree about what counts as evidence.
import {
  REASONING_EVIDENCE,
  REASONING_PROBE_MAX_TOKENS,
  REASONING_PROBE_PROMPT,
  detectReasoningEvidence,
} from "../../../src/lib/reasoningEvidence.js";

const RUN_REAL = process.env.RUN_REAL === "1";
const TIMEOUT_MS = 180000;
const MAX_TOKENS = REASONING_PROBE_MAX_TOKENS;
const EFFORT = process.env.THINK_EFFORT || "high";
const SKIP_DISABLE_PROBE = process.env.THINK_SKIP_DISABLE === "1";
const CRED_ISSUE = [401, 402, 403, 429];
const NON_CHAT_KINDS = new Set(["embedding", "image", "imageToText", "tts", "stt", "video", "music", "webSearch"]);
const NON_CHAT_ID_RE = /embedding|image|tts|whisper|rerank|vision-model/i;

const PROVIDER_FILTER = (process.env.REAL_PROVIDERS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const MODEL_FILTER = (process.env.THINK_MODELS || "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const PROMPT = REASONING_PROBE_PROMPT;

// Account/credential noise — never a reasoning signal.
const CRED_MSG_RE = /subscription|unauthorized|invalid api key|invalid access token|insufficient|credits|payment|spending|organization policy|disallowed|quota|exhausted|not supported when using|not available for integrator|requires a subscription|model.*not found|does not exist|not yet known|requires a role/i;

// Collected rows for the end-of-run summary table.
const results = [];

async function drainSSE(response) {
  if (!response?.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

async function probe(providerId, model, credentials, effort) {
  const result = await handleChatCore({
    body: {
      model: `${providerId}/${model}`,
      stream: true,
      // Not honoured by every upstream, but where it is we get the strongest signal.
      stream_options: { include_usage: true },
      max_tokens: MAX_TOKENS,
      reasoning_effort: effort,
      messages: [{ role: "user", content: PROMPT }],
    },
    modelInfo: { provider: providerId, model },
    credentials,
    connectionId: credentials.connectionId,
  });

  const status = Number(result.status) || (result.success ? 200 : 0);
  if (!result.success) {
    const errMsg = String(result.error || "");
    return {
      ok: false,
      status,
      credIssue: CRED_ISSUE.includes(status) || CRED_MSG_RE.test(errMsg),
      error: errMsg.slice(0, 120),
    };
  }

  const raw = await drainSSE(result.response).catch(() => "");
  return { ok: true, status, credIssue: false, error: "", ...detectReasoningEvidence(raw), empty: raw.length === 0 };
}

function chatModels(providerId) {
  return getModelsByProviderId(providerId)
    .filter((m) => !NON_CHAT_KINDS.has(m.kind || m.type || "llm"))
    .filter((m) => !NON_CHAT_ID_RE.test(m.id))
    .filter((m) => !MODEL_FILTER.length || MODEL_FILTER.some((f) => m.id.includes(f)));
}

function targetProviders() {
  try {
    const Database = require("better-sqlite3");
    const os = require("os");
    const path = require("path");
    const dbPath = process.env.DATA_DIR
      ? path.join(process.env.DATA_DIR, "db", "data.sqlite")
      : path.join(os.homedir(), ".9router", "db", "data.sqlite");
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT DISTINCT provider FROM providerConnections WHERE isActive = 1").all();
    db.close();
    let list = rows.map((r) => r.provider).sort();
    if (PROVIDER_FILTER.length) list = list.filter((p) => PROVIDER_FILTER.includes(p));
    return list;
  } catch {
    return [];
  }
}

describe.skipIf(!RUN_REAL)("REAL thinking capability survey", () => {
  const providers = RUN_REAL ? targetProviders() : [];

  it("has active providers in DB", () => {
    expect(providers.length).toBeGreaterThan(0);
  });

  for (const providerId of providers) {
    for (const m of (RUN_REAL ? chatModels(providerId) : [])) {
      const model = m.id;
      it.concurrent(`${providerId} / ${model}`, async () => {
        const caps = getCapabilitiesForModel(providerId, model);
        const levels = getThinkingLevels(providerId, model);
        const declared = !!caps.reasoning;
        // thinkingLevels drops "none" when the model cannot turn thinking off.
        const declaredCanDisable = declared ? !!levels?.includes("none") : null;
        const row = {
          providerId, model, declared, declaredCanDisable,
          format: caps.thinkingFormat || "-",
          status: 0, evidence: "-", reasoningTokens: 0, error: "",
        };

        const credentials = await getProviderCredentials(providerId, new Set(), model);
        if (!credentials || credentials.allRateLimited) {
          results.push({ ...row, verdict: "skip-cred", status: "no-cred" });
          return expect(true).toBe(true);
        }
        const refreshed = await checkAndRefreshToken(providerId, credentials);

        // ── Probe A: ask for reasoning ───────────────────────────────
        const on = await probe(providerId, model, refreshed, EFFORT);
        row.status = on.status;
        row.error = on.error;

        if (on.credIssue) {
          results.push({ ...row, verdict: "skip-cred" });
          return expect(true).toBe(true);
        }
        if (!on.ok) {
          // A 400 on reasoning_effort means our thinking payload was rejected.
          results.push({
            ...row,
            verdict: declared ? "FAIL-rejected-but-declared" : "skip-rejected",
          });
          return expect(true).toBe(true);
        }
        if (on.empty) {
          results.push({ ...row, verdict: "skip-empty-response" });
          return expect(true).toBe(true);
        }

        row.evidence = on.evidence;
        row.reasoningTokens = on.reasoningTokens;

        if (on.reasoned && !declared) {
          results.push({ ...row, verdict: "FAIL-undeclared-reasoning" });
          return expect(true).toBe(true);
        }
        if (!on.reasoned && declared) {
          // Not proof of absence: the model may hide its CoT and report no usage.
          // An explicit reasoning_tokens:0 is a much harder negative.
          results.push({
            ...row,
            verdict: on.evidence === REASONING_EVIDENCE.ZERO ? "FAIL-declared-no-reasoning" : "WARN-declared-no-evidence",
          });
          return expect(true).toBe(true);
        }
        if (!on.reasoned && !declared) {
          results.push({ ...row, verdict: "ok-plain" });
          return expect(true).toBe(true);
        }

        // ── Probe B: can it be turned off? ───────────────────────────
        if (SKIP_DISABLE_PROBE) {
          results.push({ ...row, verdict: "ok-reasoning" });
          return expect(true).toBe(true);
        }

        const off = await probe(providerId, model, refreshed, "none");
        if (!off.ok || off.credIssue || off.empty) {
          results.push({
            ...row,
            verdict: "ok-reasoning",
            note: `disable-probe inconclusive (${off.credIssue ? "cred" : off.ok ? "empty" : off.status})`,
          });
          return expect(true).toBe(true);
        }

        const stillReasons = off.reasoned;
        let verdict;
        if (stillReasons && declaredCanDisable) verdict = "FAIL-cannot-disable";
        else if (stillReasons && !declaredCanDisable) verdict = "ok-cannot-disable-confirmed";
        else if (!stillReasons && !declaredCanDisable) verdict = "WARN-can-actually-disable";
        else verdict = "ok-reasoning";

        results.push({ ...row, verdict, offEvidence: off.evidence });
        // Survey never fails on capability outcome.
        return expect(true).toBe(true);
      }, TIMEOUT_MS);
    }
  }

  afterAll(() => {
    if (!results.length) return;
    // FAIL groups first (most actionable), then WARN, ok, skip; alphabetical within rank.
    const rank = (v) => (v.startsWith("FAIL") ? 0 : v.startsWith("WARN") ? 1 : v.startsWith("ok") ? 2 : 3);
    const groups = [...new Set(results.map((r) => r.verdict))]
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

    console.log("\n================ THINKING CAPABILITY SURVEY ================");
    console.log(`effort=${EFFORT} disable-probe=${SKIP_DISABLE_PROBE ? "off" : "on"} models=${results.length}`);
    for (const g of groups) {
      const rows = results.filter((r) => r.verdict === g);
      console.log(`\n### ${g} (${rows.length})`);
      for (const r of rows) {
        const tok = r.reasoningTokens ? ` tok=${r.reasoningTokens}` : "";
        const off = r.offEvidence ? ` off=${r.offEvidence}` : "";
        console.log(
          `  [${r.status}] ${r.providerId}/${r.model}`
          + ` declared=${r.declared} canDisable=${r.declaredCanDisable} fmt=${r.format}`
          + ` evidence=${r.evidence}${tok}${off}`
          + `${r.note ? ` :: ${r.note}` : ""}${r.error ? ` :: ${r.error}` : ""}`
        );
      }
    }

    // Concrete edits for open-sse/providers/capabilities.js — paste + set the format.
    const edits = results.filter((r) => r.verdict.startsWith("FAIL"));
    if (edits.length) {
      console.log("\n### SUGGESTED capabilities.js EDITS");
      for (const r of edits) {
        if (r.verdict === "FAIL-undeclared-reasoning") {
          console.log(`  "${r.model}": { reasoning: true, thinkingFormat: "<PICK>" },  // ${r.providerId}: reasoned via ${r.evidence}`);
        } else if (r.verdict === "FAIL-declared-no-reasoning") {
          console.log(`  "${r.model}": { reasoning: false },  // ${r.providerId}: reported reasoning_tokens=0`);
        } else if (r.verdict === "FAIL-cannot-disable") {
          console.log(`  "${r.model}": { ...keep, thinkingCanDisable: false },  // ${r.providerId}: still reasoned at effort=none`);
        } else if (r.verdict === "FAIL-rejected-but-declared") {
          console.log(`  // ${r.providerId}/${r.model}: declared reasoning but upstream rejected reasoning_effort (${r.status}) — check thinkingFormat "${r.format}"`);
        }
      }
      console.log("  (exact-id entries go in MODEL_CAPABILITIES, or PROVIDER_CAPABILITIES[provider] if provider-specific)");
    }
    console.log("\n================ END SURVEY ================\n");
  });
});
