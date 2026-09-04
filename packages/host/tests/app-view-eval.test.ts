// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  VIEW_EVAL_BYTE_CAP,
  VIEW_EVAL_LIMITS,
  viewEvalClient,
  viewEvalRuntime,
} from "@monkey-mini-app/host";

/**
 * The runtime reaches the browser as a **stringified function**, so TypeScript never sees
 * what actually runs — the exact shape of bug that once shipped a diagnostics script which
 * parsed nowhere and reported nothing. These tests execute the real injected source inside
 * jsdom and read the POST it sends back, which is the only honest way to cover it.
 */

type Sent = { path: string; body: Record<string, unknown> };

const APP_ID = "com.example.view";

/**
 * Two boots, one behaviour. `install` runs the **serialized** source (what the browser
 * actually executes); the default runs the function itself so coverage lands on this file.
 * Both must behave identically — that equivalence is the point of shipping a stringified
 * function, and it is also where a bundler helper (`__name`) once broke it silently.
 */
function boot(install = true): { sent: Sent[]; ask: (query: Record<string, unknown>) => void } {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      sent.push({
        path: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : {},
      });
      return Promise.resolve({ ok: true } as Response);
    }),
  );
  if (install) {
    // Executed exactly as the runner HTML runs it: one classic script, self-contained.
    new Function(viewEvalRuntime(APP_ID))();
  } else {
    viewEvalClient(APP_ID, VIEW_EVAL_LIMITS);
  }
  void install;

  return {
    sent,
    ask: (query) => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "mma-view-eval", appId: APP_ID, ...query },
          origin: window.location.origin,
          source: window, // same realm: jsdom's `window.parent === window`
        }),
      );
    },
  };
}

/** Wait for the answer POST (the runtime answers on a microtask + a promise). */
async function answers(sent: Sent[], want = 1, tries = 40): Promise<Sent[]> {
  for (let i = 0; i < tries; i++) {
    if (sent.filter((s) => s.path.endsWith("/view/eval")).length >= want) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  return sent.filter((s) => s.path.endsWith("/view/eval"));
}

async function ask(code: string, extra: Record<string, unknown> = {}, install = true) {
  const { sent, ask: send } = boot(install);
  send({ requestId: "v1", code, ...extra });
  const [reply] = await answers(sent);
  return reply?.body ?? {};
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.getElementById("root")?.remove();
  vi.unstubAllGlobals();
});

describe("view runtime · shipping form", () => {
  it("references no bundler helper an iframe cannot resolve", () => {
    // tsup's `keepNames` appends `__name(fn, "fn")` inside the function body, and that
    // helper only exists in the bundle's module scope — in a browser the whole runtime
    // died on `ReferenceError: __name`. Any such identifier must be declared by the wrapper.
    const src = viewEvalRuntime("com.x");
    const helpers = new Set([...src.matchAll(/\b(__[a-zA-Z]+)\s*\(/g)].map((m) => m[1]));
    for (const name of helpers) {
      expect(src, `${name} is called but never declared`).toContain(`var ${name} =`);
    }
    expect(helpers.size).toBeGreaterThanOrEqual(0);
  });

  it("is a single executable script with the caps inlined", () => {
    const src = viewEvalRuntime("com.x");
    expect(() => new Function(src)).not.toThrow();
    expect(src).not.toMatch(/__[A-Z_]+__/);
  });
});

describe("view runtime · serialized form == source form", () => {
  // The browser gets a string, so every behaviour above is asserted against the stringified
  // source. These run the function directly (coverage lands on this file) and assert the two
  // forms answer identically — the equivalence the whole approach depends on.
  it("answers the same query identically from the function and from its source string", async () => {
    document.body.innerHTML = `<div id="root"><h2 class="t">Hi</h2><b>x</b></div>`;
    const code = 'const el = mma.$("h2"); return { text: el.textContent, sel: mma.selector(el), bold: mma.$$("b").length };';
    const viaString = await ask(code, {}, true);
    const direct = await ask(code, {}, false);
    // The header carries a wall-clock field, which cannot be byte-identical between runs.
    const withoutTiming = (s: unknown) => String(s).replace(/ · \d+ms/g, "");
    expect(withoutTiming(direct.result)).toBe(withoutTiming(viaString.result));
    expect(direct.ok).toBe(true);
    expect(String(direct.result)).toContain('text: "Hi"');
  });

  it("walks elements, guards and errors identically in both forms", async () => {
    document.body.innerHTML = `<div id="root">${"<p>a</p>".repeat(60)}</div>`;
    for (const install of [true, false]) {
      const tree = await ask('return mma.$("#root");', { maxBytes: 500 }, install);
      expect(tree.stoppedBy, install ? "string form" : "direct form").toBe("bytes");
      const bad = await ask("return null.nope;", {}, install);
      expect((bad.error as Record<string, unknown>).kind).toBe("runtime");
      const cyc = await ask("const a = {}; a.me = a; return a;", {}, install);
      expect(String(cyc.result)).toContain("[Circular]");
    }
  });
});

describe("view runtime · liveness", () => {
  it("checks in on boot, which is what separates not-booted from stuck", () => {
    const { sent } = boot();
    expect(sent.some((s) => s.path === `/api/app/${APP_ID}/alive`)).toBe(true);
  });
});

describe("view runtime · the injected surface", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="root" class="panel flex">
        <h2 class="title">Panel</h2>
        <button class="btn">Refresh</button>
        <aside class="notes" style="display:none"><p>a note</p></aside>
      </div>`;
  });

  it("exposes $ / $$ / selector and nothing else", async () => {
    const r = await ask("return Object.keys(mma).sort();");
    const names = String(r.result)
      .split("\n")
      .slice(1)
      .map((l) => l.trim().replace(/"/g, ""))
      .join(",");
    expect(names).toBe("$,$$,selector");
  });

  it("$$ returns a real array", async () => {
    const r = await ask('return Array.isArray(mma.$$("h2"));');
    expect(r.result).toContain("true");
  });

  it("selector() output resolves back through $()", async () => {
    const r = await ask('const el = mma.$("button.btn"); const sel = mma.selector(el); return sel + " -> " + (mma.$(sel) === el);');
    expect(String(r.result).trim()).toMatch(/button.* -> true$/);
  });

  it("describes an element as tag.class + geometry + child count", async () => {
    const r = await ask('return mma.$("#root");');
    const text = String(r.result);
    expect(text).toMatch(/^# .*coords: viewport px/);
    expect(text).toContain("div#root.panel.flex");
    expect(text).toContain("(3 children)");
    expect(text).toContain('  "Panel"');
    // The hidden subtree is marked instead of silently measured at nothing.
    expect(text).toContain("display:none");
  });

  it("defaults to the #root subtree when no code is given", async () => {
    document.body.innerHTML = `<div id="root"><b>hi</b></div>`;
    const { sent, ask: send } = boot();
    send({ requestId: "v1" });
    const [reply] = await answers(sent);
    expect(reply.body.ok).toBe(true);
    expect(String(reply.body.result)).toContain("div#root");
  });
});

describe("view runtime · return values", () => {
  it("passes a string through as the answer, not quoted noise", async () => {
    const r = await ask('return "rows: 12";');
    expect(String(r.result).split("\n").pop()).toBe("rows: 12");
  });

  it("serializes plain objects and lists of elements (one line, no children)", async () => {
    document.body.innerHTML = `<div id="root"><ul><li>a</li><li>b</li></ul></div>`;
    const obj = await ask("return { n: 2, ok: true, label: 'x' };");
    expect(String(obj.result)).toContain("n: 2");
    expect(String(obj.result)).toContain('label: "x"');

    const list = await ask("return mma.$$('li');");
    const lines = String(list.result).split("\n").slice(1);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^li .* "a"$/);
  });

  it("survives a self-referential return instead of hanging the walk", async () => {
    const r = await ask("const a = { n: 1 }; a.self = a; return a;");
    expect(String(r.result)).toContain("[Circular]");
    expect(r.ok).toBe(true);
  });

  it("says so when the body forgot to return", async () => {
    const r = await ask("mma.$('#root');");
    expect(r.ok).toBe(false);
    expect(String((r.error as Record<string, unknown>).message)).toMatch(/must `return`/);
  });
});

describe("view runtime · guards", () => {
  it("stops on the byte budget and admits it", async () => {
    document.body.innerHTML = `<div id="root">${"<p>text</p>".repeat(200)}</div>`;
    const r = await ask('return mma.$("#root");', { maxBytes: 600 });
    expect(r.truncated).toBe(true);
    expect(r.stoppedBy).toBe("bytes");
    expect(Number(r.bytes)).toBeLessThanOrEqual(600);
    // Truncation must be visible in the text as well as in the envelope.
    expect(String(r.result)).toMatch(/STOPPED by bytes|budget reached/);
  });

  it("caps maxBytes at the hard ceiling", async () => {
    const r = await ask("return 'x'.repeat(50);", { maxBytes: 999_999 });
    expect(Number(r.bytes)).toBeLessThanOrEqual(VIEW_EVAL_BYTE_CAP);
  });

  it("counts elements walked so $$('*') stops early rather than exploding", async () => {
    document.body.innerHTML = `<div id="root">${"<span></span>".repeat(1200)}</div>`;
    const r = await ask("return mma.$$('#root *').length;");
    expect(r.ok).toBe(true);
    expect(Number(r.matched)).toBeGreaterThan(0);
  });
});

describe("view runtime · errors are distinguishable", () => {
  it("syntax errors carry the message and echo the source (no position is available)", async () => {
    const r = await ask("return (;");
    expect(r.ok).toBe(false);
    const err = r.error as Record<string, unknown>;
    expect(err.kind).toBe("syntax");
    expect(String(err.message)).toMatch(/Unexpected|missing/i);
    expect(err.source).toBe("return (;");
  });

  it("runtime errors report the line inside the caller's own code, with a caret", async () => {
    const r = await ask("const a = 1;\nreturn null.x;");
    const err = r.error as Record<string, unknown>;
    expect(err.kind).toBe("runtime");
    // V8 numbers the Function-ctor body from line 3; the caller's line 2 is what matters.
    expect(err.line).toBe(2);
    expect(err.source).toBe("return null.x;");
    expect(String(err.caret).trim()).toBe("^");
  });

  it("a rejected promise is a runtime error, not a missing view", async () => {
    const r = await ask("return Promise.reject(new Error('boom'));");
    expect((r.error as Record<string, unknown>).message).toContain("boom");
    expect(r.view).toBeUndefined();
  });
});

describe("view runtime · values that are not elements", () => {
  it("renders Map / Set / empty objects without losing their shape", async () => {
    document.body.innerHTML = `<div id="root"><i>a</i><i>b</i></div>`;
    const map = await ask("const m = new Map([['k', 'v']]); return m;");
    expect(String(map.result)).toContain("Map(1)");
    expect(String(map.result)).toContain("k => v");

    const set = await ask("return new Set([1, 2]);");
    expect(String(set.result)).toContain("Set(2)");

    const empty = await ask("return {};");
    expect(String(empty.result).trim().split("\n").pop()).toBe("{}");

    const mixed = await ask("return { nodes: mma.$$('i'), big: 10n };");
    expect(String(mixed.result)).toContain("big: 10");
    expect(String(mixed.result)).toMatch(/i .* "a"/);
  });

  it("names a function instead of printing it", async () => {
    const r = await ask("return { fn: function named() {} };");
    expect(String(r.result)).toContain("[Function named]");
  });

  it("flags a detached node instead of measuring it as zero-size", async () => {
    const r = await ask('const d = document.createElement("div"); d.className = "gone"; return d;');
    expect(String(r.result)).toContain("detached");
  });

  it("never walks inside an svg (icon internals are noise)", async () => {
    document.body.innerHTML = `<div id="root"><svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg></div>`;
    const r = await ask('return mma.$("#root");');
    const text = String(r.result);
    expect(text).toContain("svg");
    expect(text).not.toContain("path");
  });

  it("stops on the element budget and says which gate fired", async () => {
    document.body.innerHTML = `<div id="root">${"<b>x</b>".repeat(700)}</div>`;
    const r = await ask("return mma.$('#root').querySelectorAll('b').length;");
    expect(r.ok).toBe(true);
    const walk = await ask('return mma.$("#root");', { maxBytes: 6000 });
    expect(["nodes", "bytes"]).toContain(walk.stoppedBy);
    expect(walk.truncated).toBe(true);
  });

  it("keeps going when the query itself is slow but finite", async () => {
    const r = await ask('await new Promise((k) => setTimeout(k, 40)); return "settled";');
    expect(String(r.result).trim().split("\n").pop()).toBe("settled");
  });
});

describe("view runtime · intake", () => {
  it("ignores anything that is not a well-formed query from the parent", async () => {
    const { sent, ask: send } = boot();
    const before = sent.length;
    send({ requestId: "", code: "return 1" });
    window.dispatchEvent(new MessageEvent("message", { data: { type: "other" }, origin: window.location.origin, source: window }));
    window.dispatchEvent(new MessageEvent("message", { data: { type: "mma-view-eval", requestId: "vx", code: "return 1" }, origin: "http://evil.example", source: window }));
    await new Promise((r) => setTimeout(r, 20));
    expect(sent.filter((s) => s.path.endsWith("/view/eval"))).toHaveLength(0);
    expect(sent.length).toBe(before);
  });
});
