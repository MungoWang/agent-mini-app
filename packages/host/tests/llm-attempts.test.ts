import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_AGENT_ATTEMPTS,
  DEFAULT_LLM_MAX_TOKENS,
  HostError,
  type LlmAttempt,
  type LlmRunOptions,
  MAX_LLM_ATTEMPTS,
  runLlmAttempts,
} from "@monkey-mini-app/host";

/**
 * The `schema` guarantee: an app must never have to guess whether the model answered.
 *
 * Before this, `ctx.llm(prompt, { schema })` handed back whatever came out — truncated objects,
 * prose around the JSON, or a page of reasoning — and every app rewrote its own parser to cope.
 * These cases pin the three things that replaced that: retries only where retrying can help, the
 * rejected text kept on the error, and no silent infinite loop.
 */

const SCHEMA = { type: "object", properties: { a: { type: "string" } }, required: ["a"] };

function recorder(replies: Array<string | Error>) {
  const seen: Array<{ input: string; opts: LlmRunOptions }> = [];
  let i = 0;
  const run = vi.fn(async (input: string, opts: LlmRunOptions) => {
    seen.push({ input, opts });
    const reply = replies[Math.min(i, replies.length - 1)];
    i++;
    if (reply instanceof Error) throw reply;
    return reply;
  });
  return { run, seen, calls: () => run.mock.calls.length };
}

const attemptsOf = (err: unknown): LlmAttempt[] => [...((err as HostError).attempts ?? [])] as LlmAttempt[];

describe("runLlmAttempts", () => {
  it("returns the first answer untouched when nothing is wrong", async () => {
    const { run, calls } = recorder(['{"a":"ok"}']);
    await expect(runLlmAttempts("go", { schema: SCHEMA }, run)).resolves.toBe('{"a":"ok"}');
    expect(calls()).toBe(1);
  });

  it("retries a failed call and returns the next answer", async () => {
    const { run, calls } = recorder([new Error("provider 503"), "plain text"]);
    await expect(runLlmAttempts("go", undefined, run)).resolves.toBe("plain text");
    expect(calls()).toBe(2);
  });

  it("retries an answer that is not JSON under a schema, and tells the model why", async () => {
    const { run, seen } = recorder(["Here is your answer: n/a", '{"a":"fine"}']);
    await expect(runLlmAttempts("give me a", { schema: SCHEMA }, run)).resolves.toBe('{"a":"fine"}');

    expect(seen).toHaveLength(2);
    expect(seen[1].input).toContain("give me a");
    expect(seen[1].input).toContain("rejected: not valid JSON");
    // The rejected sample itself rides along — otherwise the model just repeats its mistake.
    expect(seen[1].input).toContain("Here is your answer");
  });

  it("gives up with LLM_JSON_INVALID and keeps every rejected sample on the error", async () => {
    const { run, calls } = recorder(["nope"]);
    const err = await runLlmAttempts("go", { schema: SCHEMA }, run).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(HostError);
    expect((err as HostError).code).toBe("LLM_JSON_INVALID");
    expect(calls()).toBe(3); // the default budget

    const attempts = attemptsOf(err);
    expect(attempts).toHaveLength(3);
    expect(attempts.map((a) => a.kind)).toEqual(["json", "json", "json"]);
    expect(attempts[0].n).toBe(1);
    expect(attempts[0].head).toBe("nope");
    expect((err as HostError).message).toContain("nope");
  });

  it("reports LLM_RETRY_EXHAUSTED when no attempt ever reached the model", async () => {
    const { run } = recorder([new Error("socket hang up")]);
    const err = await runLlmAttempts("go", { schema: SCHEMA }, run).catch((e: unknown) => e);

    expect((err as HostError).code).toBe("LLM_RETRY_EXHAUSTED");
    expect((err as HostError).message.startsWith("llm: ")).toBe(true);
    expect(attemptsOf(err).every((a) => a.kind === "transport")).toBe(true);
  });

  it("mixes causes and still names the one that mattered last", async () => {
    const { run } = recorder(["not json", new Error("boom"), "still not json"]);
    const err = await runLlmAttempts("go", { schema: SCHEMA }, run).catch((e: unknown) => e);

    expect((err as HostError).code).toBe("LLM_JSON_INVALID");
    expect(attemptsOf(err).map((a) => a.kind)).toEqual(["json", "transport", "json"]);
  });

  it("does not retry when the caller asks for exactly one attempt", async () => {
    const { run, calls } = recorder(["junk"]);
    const err = await runLlmAttempts("go", { schema: SCHEMA, retryTimes: 1 }, run).catch((e: unknown) => e);

    expect(calls()).toBe(1);
    expect(attemptsOf(err)).toHaveLength(1);
  });

  it("counts retryTimes as attempts in total, and caps a runaway value", async () => {
    const { run, calls } = recorder(["junk"]);
    await runLlmAttempts("go", { schema: SCHEMA, retryTimes: 9999 }, run).catch(() => undefined);
    expect(calls()).toBe(MAX_LLM_ATTEMPTS);
  });

  it("stops between attempts once the caller's signal is aborted", async () => {
    // Stop the clock on the "user pressed Stop" path: attempts run back to back, so the abort has
    // to land *during* one for the loop's between-attempt check to be the thing that ends it.
    const controller = new AbortController();
    let calls = 0;
    const err = await runLlmAttempts(
      "go",
      { schema: SCHEMA, signal: controller.signal },
      async () => {
        calls++;
        controller.abort();
        return "junk";
      },
    ).catch((e: unknown) => e);

    expect((err as HostError).code).toBe("ABORTED");
    expect(calls).toBe(1);
  });

  it("applies the platform output ceiling, and never overrides the author's", async () => {
    const plain = recorder(["text"]);
    await runLlmAttempts("go", undefined, plain.run);
    expect(plain.seen[0].opts.maxTokens).toBe(DEFAULT_LLM_MAX_TOKENS);

    const explicit = recorder(["text"]);
    await runLlmAttempts("go", { maxTokens: 256 }, explicit.run);
    expect(explicit.seen[0].opts.maxTokens).toBe(256);
  });

  it("does not re-run an agent turn by default — a turn has side effects", async () => {
    // `ctx.agent` may already have posted a comment or pushed a build; replaying the turn repeats
    // that. One attempt is the host default, and raising it stays the caller's decision.
    const { run, calls } = recorder(["nope"]);
    await runLlmAttempts("do the thing", { schema: SCHEMA }, run, {
      attempts: DEFAULT_AGENT_ATTEMPTS,
    }).catch(() => undefined);
    expect(calls()).toBe(1);
  });
});
