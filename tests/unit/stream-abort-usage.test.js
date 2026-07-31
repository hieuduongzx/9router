// A client that hangs up mid-stream (Claude Code cancelling a tool loop, a killed
// terminal) cancels the readable, so the transform's flush() never runs. Usage was
// only reported from flush(), so an aborted request recorded no tokens at all and its
// cost came out $0 even though the upstream had already been billed.
import { describe, it, expect, vi } from "vitest";

async function loadStream() {
  vi.resetModules();
  return import("open-sse/utils/stream.js");
}

const encoder = new TextEncoder();

/** A stream that emits chunks then stays open, like a live SSE connection. */
function liveSource(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
    },
  });
}

describe("streaming usage on client abort", () => {
  it("reports usage when the client cancels before the stream ends", async () => {
    const { createPassthroughStreamWithLogger } = await loadStream();
    const completions = [];
    const onStreamComplete = (content, usage, ttftAt, meta) => completions.push({ content, usage, meta });

    const transform = createPassthroughStreamWithLogger(
      "openai", null, "gpt-test", null,
      { model: "gpt-test", messages: [{ role: "user", content: "hello there" }] },
      onStreamComplete, null,
    );

    const body = liveSource([
      'data: {"choices":[{"delta":{"content":"partial answer"}}]}\n\n',
    ]);
    const reader = body.pipeThrough(transform).getReader();
    await reader.read();
    await reader.cancel(new Error("client_closed"));
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(completions).toHaveLength(1);
    expect(completions[0].meta?.aborted).toBe(true);
    const tokens = completions[0].usage || {};
    const inTokens = tokens.prompt_tokens || tokens.input_tokens || 0;
    const outTokens = tokens.completion_tokens || tokens.output_tokens || 0;
    // Estimated, but non-zero — otherwise there is nothing to price the request with.
    expect(inTokens + outTokens).toBeGreaterThan(0);
  });

  it("still reports exactly once on a normal stream end", async () => {
    const { createPassthroughStreamWithLogger } = await loadStream();
    const completions = [];
    const transform = createPassthroughStreamWithLogger(
      "openai", null, "gpt-test", null,
      { model: "gpt-test", messages: [{ role: "user", content: "hello" }] },
      (content, usage, ttftAt, meta) => completions.push({ usage, meta }), null,
    );

    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"done"}}],"usage":{"prompt_tokens":11,"completion_tokens":7}}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    const reader = body.pipeThrough(transform).getReader();
    while (!(await reader.read()).done) { /* drain */ }
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(completions).toHaveLength(1);
    expect(completions[0].meta?.aborted).toBeFalsy();
    expect(completions[0].usage?.prompt_tokens).toBe(11);
  });
});
