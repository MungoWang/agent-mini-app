/**
 * The **view runtime**: the half of the diagnostics channel that answers questions.
 *
 * A mini-app iframe is served by the host while the panel embedding it runs on the
 * adapter's origin, so nothing outside the iframe can read the rendered DOM — and any
 * query shape we design in advance is a guess at what an agent will ask. So the iframe
 * ships an executor instead: the agent writes JavaScript, we run it inside the rendered
 * document and post the answer back to our own (same-origin) host.
 *
 * ## Why this is a function whose source we ship
 *
 * {@link viewEvalRuntime} stringifies {@link viewEvalClient}, so the runtime is written and
 * type-checked as real TypeScript and unit-tested under jsdom, then serialized into the
 * browser. The rule that makes that work: **`viewEvalClient` must be self-contained** — no
 * imports, no module-scope identifiers. Everything it needs arrives as a parameter.
 *
 * ## Shape of the API
 *
 * The injected surface is three names on purpose. `mma.selector` is the only one we own:
 * its format must have a single source, or "copy this address back into `$()`" silently
 * breaks. `$` / `$$` are jQuery-prior shorthand for `querySelector(All)`, and `$$` returns
 * a plain Array. Nothing else is wrapped — host-side data is one same-origin `fetch` away,
 * and every extra name is one more thing to keep in the model's attention.
 *
 * ## Guards live in the execution layer, not in a renderer
 *
 * Byte budget, node budget, recursion depth and a wall clock are each checked at every push
 * by the one serializer that every return value passes through — so forgetting to call
 * something costs an option, never a bypass. What this cannot stop is a **synchronous
 * infinite loop**: the thread never returns here, and the only escape is reloading the
 * iframe. That limit is stated in the skill rather than promised away.
 */

/** Hard ceiling on a reply, in bytes. A caller may ask for less, never more. */
export const VIEW_EVAL_BYTE_CAP = 6144;

/** View-side wall clock, kept under the host's 1.5 s so a timeout answer still lands. */
export const VIEW_EVAL_SELF_TIMEOUT_MS = 1_200;

/** Elements the walk may enter per evaluation — counts work, not just emitted lines. */
export const VIEW_EVAL_MAX_NODES = 600;

/** Nesting ceiling for returned objects/arrays (guards self-referential structures). */
export const VIEW_EVAL_MAX_DEPTH = 24;

/** How deep a returned Element expands by default. Going deeper is the agent's own walk. */
export const VIEW_EVAL_TREE_DEPTH = 2;

/** Bytes held back for the summary line and truncation notes, both known only at the end. */
const VIEW_EVAL_HEADER_RESERVE = 280;

/**
 * V8 wraps a `new Function` body in two lines, so line 1 of the caller's code is reported
 * as line 3. Subtracted before the offending line is quoted back with a caret.
 */
const VIEW_EVAL_STACK_OFFSET = 2;

/** Caps handed to the runtime so each number exists in exactly one place. */
export type ViewEvalLimits = {
  cap: number;
  selfTimeoutMs: number;
  maxNodes: number;
  maxDepth: number;
  treeDepth: number;
  headerReserve: number;
  stackOffset: number;
};

/** Handed to the runtime; exported so tests can run the client exactly as the browser does. */
export const LIMITS: ViewEvalLimits = {
  cap: VIEW_EVAL_BYTE_CAP,
  selfTimeoutMs: VIEW_EVAL_SELF_TIMEOUT_MS,
  maxNodes: VIEW_EVAL_MAX_NODES,
  maxDepth: VIEW_EVAL_MAX_DEPTH,
  treeDepth: VIEW_EVAL_TREE_DEPTH,
  headerReserve: VIEW_EVAL_HEADER_RESERVE,
  stackOffset: VIEW_EVAL_STACK_OFFSET,
};

/** The runtime source for one app, ready to drop into a `<script>` tag. */
export function viewEvalRuntime(appId: string): string {
  const call = `(${viewEvalClient.toString()})(${JSON.stringify(appId)}, ${JSON.stringify(LIMITS)});`;
  /**
   * esbuild's `keepNames` (on by default in tsup) rewrites every function declaration into
   * `fn(){…} __name(fn, "fn")` — and that helper lives in the **bundle's** module scope, so
   * the stringified body would throw `ReferenceError: __name is not defined` in the iframe
   * and take the whole runtime down with it (found in a real browser, not in tests).
   *
   * Wrapping in a block that declares the helpers locally makes the shipped source
   * self-contained whatever the bundler decided to do to it. Name-preservation is worth
   * nothing inside a diagnostic runtime, so the shim is identity.
   */
  return `{ var __name = function (target) { return target; };
${call}
}`;
}

/**
 * Self-contained: runs inside the app iframe. Do not import into it or close over module
 * scope — after `toString()` there is no module left, only this body. Everything DOM-side
 * is reached through `win`, because this file is compiled for Node and executed in a browser.
 *
 * Exported for tests: calling it directly covers the code under the file's own line numbers
 * (executing the serialized form runs a string, which coverage cannot attribute here). The
 * other test still runs the serialized form, because that is what the browser gets.
 */
export function viewEvalClient(appId: string, limits: ViewEvalLimits): void {
  /**
   * The window this script runs in. In a browser `globalThis` **is** the window; the
   * explicit lookup keeps the same source correct wherever it gets evaluated (another
   * realm's `window.eval`, where `globalThis` still points at the host's global).
   */
  const global: any = globalThis;
  const win: any = global.window || global;
  const base = "/api/app/" + encodeURIComponent(appId);
  const DEFAULT_CODE = 'return mma.$("#root");';
  /** Latched from the first real parent message: whoever hosts us, not whoever claims to. */
  let parentOrigin = "";

  /* ---------------------------------------------------------- injected surface */

  /** Every run currently being serialized, for query accounting. */
  let current: Budget | null = null;

  /** Shared lookup, deliberately uncounted — `selector()` resolves uniqueness with it. */
  function find(sel: string, root?: any): any[] {
    const scope = root && root.nodeType === 1 ? root : win.document;
    const list = scope.querySelectorAll(sel);
    const out = [];
    for (let i = 0; i < list.length; i++) out.push(list[i]);
    return out;
  }

  /** `mma.$(sel, root?)` → Element | null */
  function q(sel: string, root?: any): any {
    const hit = find(sel, root)[0] || null;
    if (hit && current) current.matched++;
    return hit;
  }

  /** `mma.$$(sel, root?)` → Array<Element> — a plain array, so `[0]` / `.map()` just work */
  function qa(sel: string, root?: any): any[] {
    const out = find(sel, root);
    if (current) current.matched += out.length;
    return out;
  }

  function escapeIdent(value: string): string {
    return win.CSS && win.CSS.escape
      ? win.CSS.escape(value)
      : value.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
  }

  /**
   * `mma.selector(el)` → a CSS selector that resolves back through `mma.$`. Ids win, then
   * the shortest unique class/tag chain, then an nth-of-type path — unique by construction.
   */
  function selectorOf(el: any): string {
    if (!el || el.nodeType !== 1) return "";
    const tag = el.tagName.toLowerCase();
    if (el.id) {
      const byId = "#" + escapeIdent(el.id);
      if (find(byId).length === 1) return byId;
    }
    const raw = typeof el.className === "string" ? el.className.trim() : "";
    if (raw) {
      const cls = raw.split(/\s+/).filter(Boolean);
      let dots = "";
      for (let i = 0; i < cls.length && i < 3; i++) {
        dots += "." + escapeIdent(cls[i]);
        if (find(tag + dots).length === 1) return tag + dots;
      }
    }
    const path = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== win.document.body) {
      if (node.id) {
        path.unshift("#" + escapeIdent(node.id));
        return path.join(" > ");
      }
      let n = 1;
      for (let s = node.previousElementSibling; s; s = s.previousElementSibling) {
        if (s.tagName === node.tagName) n++;
      }
      path.unshift(node.tagName.toLowerCase() + ":nth-of-type(" + n + ")");
      node = node.parentElement;
    }
    return path.join(" > ");
  }

  const mma = { $: q, $$: qa, selector: selectorOf };

  /* ------------------------------------------------------------------ readers */

  function isElement(value: any): boolean {
    return (
      !!value && typeof value === "object" && value.nodeType === 1 && typeof value.tagName === "string"
    );
  }

  function isList(value: any): boolean {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return true;
    return typeof value.length === "number" && typeof value.item === "function";
  }

  /** Nodes nobody styled on purpose: they are not the answer to a rendering question. */
  function skipElement(el: any): boolean {
    const t = el.tagName;
    return (
      t === "SCRIPT" || t === "STYLE" || t === "LINK" || t === "META" || t === "TITLE" || t === "HEAD"
    );
  }

  function ownText(el: any): string {
    let out = "";
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) out += n.nodeValue;
    }
    return out.replace(/\s+/g, " ").trim();
  }

  function childCount(el: any): number {
    let n = 0;
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) n++;
    return n;
  }

  /**
   * One element, one line, in the notation a model already reads from CSS:
   * `div.panel.x  x=16 y=64 w=380 h=812  (4 children)`. Geometry keeps its labels because a
   * bare `16,64` reads as a size, and state flags stay because a node with no box would
   * otherwise look like a layout bug instead of a hidden one.
   */
  function describe(el: any): string {
    let line = el.tagName.toLowerCase();
    if (el.id) line += "#" + el.id;
    const raw = typeof el.className === "string" ? el.className.trim() : "";
    if (raw) {
      const cls = raw.split(/\s+/).filter(Boolean);
      line += "." + cls.slice(0, 8).join(".");
      if (cls.length > 8) line += ".+" + (cls.length - 8);
    }
    if (!el.isConnected) return line + "  detached";
    let box: any = null;
    try {
      box = el.getBoundingClientRect();
    } catch (e) {
      return line + "  detached";
    }
    if (box) {
      line +=
        "  x=" + Math.round(box.left) + " y=" + Math.round(box.top) +
        " w=" + Math.round(box.width) + " h=" + Math.round(box.height);
    }
    const kids = childCount(el);
    if (kids) line += "  (" + kids + (kids === 1 ? " child)" : " children)");
    else {
      const text = ownText(el);
      // Containers report a child count and never textContent: a panel's text is the whole
      // page, which is both the biggest noise source and the biggest blow-up risk.
      if (text) line += '  "' + (text.length > 120 ? text.slice(0, 120) + "\u2026" : text) + '"';
    }
    try {
      const cs = win.getComputedStyle(el);
      if (cs.display === "none") line += "  display:none";
      else if (cs.visibility === "hidden") line += "  visibility:hidden";
      else if (cs.opacity && parseFloat(cs.opacity) === 0) line += "  opacity:0";
    } catch (e) {
      /* no computed style available — the name and geometry still say something */
    }
    return line;
  }

  /* -------------------------------------------------------------------- gates */

  /**
   * The four hard limits, in one place, checked at every push. `stopped` keeps the **first**
   * gate to fire, because the next step differs: a byte stop means "narrow the projection",
   * a node stop means "pick a smaller root", a depth stop means "you returned a cycle".
   */
  function budget(maxBytes: number) {
    return {
      cap: Math.max(256, maxBytes - limits.headerReserve),
      lines: [] as string[],
      bytes: 0,
      shown: 0,
      visited: 0,
      matched: 0,
      dropped: 0,
      stopped: "",
      deadline: Date.now() + limits.selfTimeoutMs,
    };
  }

  type Budget = ReturnType<typeof budget>;

  function stopRun(g: Budget, reason: string): boolean {
    if (!g.stopped) g.stopped = reason;
    return false;
  }

  /** A content line. Once any gate has fired, no more content is appended. */
  function emit(g: Budget, text: string): boolean {
    if (g.stopped) {
      g.dropped++;
      return false;
    }
    if (Date.now() > g.deadline) return stopRun(g, "timeout");
    const cost = text.length + 1;
    if (g.bytes + cost > g.cap) return stopRun(g, "bytes");
    g.bytes += cost;
    g.lines.push(text);
    g.shown++;
    return true;
  }

  /**
   * A truncation notice. Silence here would be read as completeness, so notes are allowed
   * into the header reserve even after the content budget is spent.
   */
  function note(g: Budget, text: string): boolean {
    const cost = text.length + 1;
    if (g.bytes + cost > g.cap + limits.headerReserve) {
      g.dropped++;
      return false;
    }
    g.bytes += cost;
    g.lines.push(text);
    return true;
  }

  /** Counting an element **before** building its line: `$$("*")` should stop early. */
  function enter(g: Budget): boolean {
    g.visited++;
    if (g.visited > limits.maxNodes) return stopRun(g, "nodes");
    return !g.stopped;
  }

  /* --------------------------------------------------------------- serializing */

  function walkElement(g: Budget, el: any, depth: number, indent: string, expand: number): void {
    if (g.stopped || !enter(g)) return;
    if (skipElement(el)) return;
    if (!emit(g, indent + describe(el))) return;
    // Icon internals are noise at any depth; a nested document is somebody else's tree.
    // Case-insensitive on purpose: SVG elements keep their lowercase tagName.
    const tag = String(el.tagName).toUpperCase();
    if (tag === "SVG" || tag === "IFRAME" || depth >= limits.maxDepth) return;
    let beyond = 0;
    for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
      if (depth + 1 > expand) {
        beyond++;
        continue;
      }
      walkElement(g, c, depth + 1, indent + "  ", expand);
    }
    if (beyond && !g.stopped) {
      note(
        g,
        indent +
          "  +" +
          beyond +
          " deeper " +
          (beyond === 1 ? "level" : "levels") +
          " not shown — return that node to go on",
      );
    }
  }

  /**
   * One serializer for every return value, so `return mma.$$(".x")` and a hand-projected
   * object pay the same in guards. A list of elements is a locator: one line each, no
   * children — the agent asks for a subtree by returning it.
   */
  function walkValue(g: Budget, value: any, depth: number, indent: string, seen: any[]): void {
    if (g.stopped) return;
    if (Date.now() > g.deadline) {
      stopRun(g, "timeout");
      return;
    }
    if (isElement(value)) {
      walkElement(g, value, 0, indent, limits.treeDepth);
      return;
    }
    if (value === null) {
      emit(g, indent + "null");
      return;
    }
    const t = typeof value;
    // A returned string is the agent's own answer, so it goes through raw — quoting a
    // hand-written report would put escape sequences between it and the reader.
    if (t === "string") {
      for (const one of value.split("\n")) emit(g, indent + one);
      return;
    }
    if (t === "number" || t === "boolean" || t === "bigint" || t === "undefined" || t === "symbol") {
      emit(g, indent + String(value));
      return;
    }
    if (t === "function") {
      emit(g, indent + "[Function " + (value.name || "anonymous") + "]");
      return;
    }
    if (seen.indexOf(value) !== -1) {
      emit(g, indent + "[Circular]");
      return;
    }
    if (depth >= limits.maxDepth) {
      stopRun(g, "depth");
      note(g, indent + "\u2026 depth " + limits.maxDepth + " reached");
      return;
    }
    seen.push(value);
    if (value instanceof win.Error) {
      emit(g, indent + value.name + ": " + value.message);
    } else if (isList(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!enter(g)) break;
        const item = value[i];
        if (isElement(item)) emit(g, indent + describe(item));
        else if (typeof item === "string") emit(g, indent + JSON.stringify(item));
        else walkValue(g, item, depth + 1, indent, seen);
      }
    } else if (typeof win.Map !== "undefined" && value instanceof win.Map) {
      emit(g, indent + "Map(" + value.size + ")");
      value.forEach(function (v: any, k: any) {
        emit(
          g,
          indent +
            "  " +
            String(k) +
            " => " +
            (v && typeof v === "object" ? "[" + Object.prototype.toString.call(v) + "]" : String(v)),
        );
      });
    } else if (typeof win.Set !== "undefined" && value instanceof win.Set) {
      emit(g, indent + "Set(" + value.size + ")");
      value.forEach(function (v: any) {
        walkValue(g, v, depth + 1, indent + "  ", seen);
      });
    } else {
      const keys = Object.keys(value);
      if (!keys.length) {
        emit(g, indent + (Object.prototype.toString.call(value) === "[object Object]" ? "{}" : String(value)));
      } else {
        emit(g, indent + "{");
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          const child = value[key];
          if (child === null || typeof child !== "object") {
            // typeof is not "object", so without this a callback under a key would print its
            // whole source body — the one thing guaranteed to blow the byte budget.
            const shown =
              typeof child === "function"
                ? "[Function " + (child.name || "anonymous") + "]"
                : typeof child === "string"
                  ? JSON.stringify(child)
                  : String(child);
            emit(g, indent + "  " + key + ": " + shown);
            continue;
          }
          // A structured value under a key keeps the key on its own line — otherwise the
          // reader sees a list of elements and has to guess which field they came from.
          emit(g, indent + "  " + key + ":");
          if (isElement(child)) walkElement(g, child, 0, indent + "    ", limits.treeDepth);
          else walkValue(g, child, depth + 1, indent + "    ", seen);
        }
        emit(g, indent + "}");
      }
    }
    seen.pop();
  }

  /**
   * Meaning travels with the output. Anything that needs a legend to read is either a name
   * the model already knows (`display:none`, `w=`) or declared once, here, at the top —
   * including which coordinate space the numbers are in, the one thing not inferable.
   */
  function summary(g: Budget, root: any, tookMs: number): string {
    const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");
    let head = "# ";
    if (isElement(root)) {
      // "12 shown of 87" is the whole truncation story in five tokens.
      head += plural(g.shown, "line") + " shown of " + (1 + root.getElementsByTagName("*").length) + " in subtree";
    } else {
      head += plural(g.shown, "line");
    }
    if (g.matched) head += " · " + plural(g.matched, "query hit");
    // Only when the walk touched nodes the answer does not show — otherwise it restates `shown`.
    if (g.visited && g.visited !== g.shown) head += " · " + plural(g.visited, "element") + " walked";
    head += " · depth " + limits.treeDepth + " · coords: viewport px (scrolls with page)";
    head += " · viewport " + win.innerWidth + "x" + win.innerHeight;
    head += " · " + Math.max(0.1, Math.round((g.bytes / 1024) * 10) / 10) + "KB · " + tookMs + "ms";
    if (g.stopped) head += " · STOPPED by " + g.stopped + " budget, output is partial";
    if (g.dropped) head += " · " + plural(g.dropped, "item") + " dropped";
    return head;
  }

  /* ------------------------------------------------------------------ executor */

  function runtimeError(e: any, code: string): Record<string, unknown> {
    const out: Record<string, unknown> = { kind: "runtime", message: String((e && (e.message || e.name)) || e) };
    const m = /<anonymous>:(\d+):(\d+)/.exec(String((e && e.stack) || ""));
    if (m) {
      const line = Number(m[1]) - limits.stackOffset;
      const column = Number(m[2]);
      if (line >= 1) {
        out.line = line;
        out.column = column;
        const src = String(code || "").split("\n")[line - 1];
        if (typeof src === "string") {
          out.source = src;
          out.caret = " ".repeat(Math.max(0, column - 1)) + "^";
        }
      }
    }
    return out;
  }

  function execute(id: string, code: string, maxBytes: number): void {
    const started = Date.now();
    const asked = typeof maxBytes === "number" && maxBytes > 0 ? maxBytes : limits.cap;
    const g = budget(Math.min(asked, limits.cap));

    function send(payload: Record<string, unknown>): void {
      payload.requestId = id;
      payload.tookMs = Date.now() - started;
      post(payload);
      if (current === g) current = null;
    }

    let fn: any;
    try {
      const AsyncFunction: any = Object.getPrototypeOf(async function () {}).constructor;
      fn = new AsyncFunction("mma", code);
    } catch (e: any) {
      // A syntax error carries no position, so the submitted source goes back instead.
      return send({
        ok: false,
        error: {
          kind: "syntax",
          message: String((e && e.message) || e),
          source: String(code || "")
            .split("\n")
            .slice(0, 20)
            .join("\n"),
        },
      });
    }

    current = g;
    let settled = false;
    let value: any;
    try {
      value = fn(mma);
    } catch (e: any) {
      settled = true;
      return send({ ok: false, error: runtimeError(e, code) });
    }
    Promise.resolve(value).then(
      function (result: any) {
        if (settled) return;
        settled = true;
        if (result === undefined) {
          return send({
            ok: false,
            error: {
              kind: "runtime",
              message: "code is an async function body — it must `return` a value (got undefined)",
            },
          });
        }
        const list = isList(result) && !isElement(result) ? result : [result];
        for (let i = 0; i < list.length && !g.stopped; i++) walkValue(g, list[i], 0, "", []);
        if (g.stopped) note(g, "\u2026 " + g.stopped + " budget reached — narrow the root or ask for fewer bytes");
        const rootForSummary = isElement(result) ? result : list.length === 1 ? list[0] : null;
        send({
          ok: true,
          view: "live",
          result: [summary(g, rootForSummary, Date.now() - started)].concat(g.lines).join("\n"),
          bytes: g.bytes,
          truncated: !!g.stopped,
          stoppedBy: g.stopped,
          visited: g.visited,
          matched: g.matched,
          dropped: g.dropped,
        });
      },
      function (err: any) {
        if (settled) return;
        settled = true;
        send({ ok: false, error: runtimeError(err, code) });
      },
    );
  }

  /* ---------------------------------------------------------------- transport */

  function post(payload: Record<string, unknown>): void {
    try {
      win
        .fetch(base + "/view/eval", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        })
        .catch(function () {
          /* nobody is waiting any more; the host's own timeout reports that honestly */
        });
    } catch (e) {
      /* a diagnostic channel must never throw into the app */
    }
  }

  /**
   * Liveness marker. Lets the host tell "the runner never executed" — a failure this project
   * has actually been bitten by, where a template placeholder produced a syntax error and
   * the whole script silently did nothing — from "the page booted and then wedged".
   */
  function beat(): void {
    try {
      win
        .fetch(base + "/alive", {
          method: "POST",
          body: "{}",
          headers: { "content-type": "application/json" },
        })
        .catch(function () {});
    } catch (e) {
      /* ignore */
    }
  }

  win.addEventListener("message", function (ev: any) {
    // Only the window that embedded us, and only from the origin that first spoke to us.
    if (ev.source !== win.parent) return;
    if (!parentOrigin) {
      if (!ev.origin || ev.origin === "null") return;
      parentOrigin = ev.origin;
    }
    if (ev.origin !== parentOrigin) return;
    const d = ev.data;
    if (!d || d.type !== "mma-view-eval" || typeof d.requestId !== "string" || !d.requestId) return;
    try {
      execute(d.requestId, typeof d.code === "string" && d.code ? d.code : DEFAULT_CODE, d.maxBytes);
    } catch (e: any) {
      post({
        requestId: d.requestId,
        ok: false,
        error: { kind: "runtime", message: String((e && e.message) || e) },
      });
    }
  });

  if (win.document.readyState === "loading") {
    win.document.addEventListener("DOMContentLoaded", beat);
  } else {
    beat();
  }
}
