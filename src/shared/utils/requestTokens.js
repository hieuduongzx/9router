/**
 * Token fields on stored request details / usageHistory rows.
 * Canonical shape (after canonicalizeUsage):
 *   prompt_tokens               = total input INCLUDING cache read + cache creation
 *   cached_tokens               = cache-read portion (subset of prompt_tokens)
 *   cache_creation_input_tokens = cache-write portion (subset of prompt_tokens)
 * Legacy Claude rows may still carry cache_read_input_tokens with a prompt that
 * excludes cache — getInputTokens folds that up so the table never under-counts.
 */

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getCachedTokens(tokens) {
  return num(tokens?.cached_tokens || tokens?.cache_read_input_tokens);
}

export function getCacheCreationTokens(tokens) {
  return num(
    tokens?.cache_creation_input_tokens
    ?? tokens?.prompt_tokens_details?.cache_creation_tokens,
  );
}

export function getInputTokens(tokens) {
  const prompt = num(tokens?.prompt_tokens || tokens?.input_tokens);
  const cache = getCachedTokens(tokens);
  return prompt < cache ? cache : prompt;
}
