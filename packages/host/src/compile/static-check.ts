/**
 * Reload-time static check for mini-app sources: **undefined identifiers**.
 *
 * The compile steps cannot catch this class of bug. `compileAppSource` (sucrase) only
 * strips types, and esbuild does no type checking and treats an unbound identifier as a
 * global — so `greet()` defined but `greeting()` called transpiles green and blows up in
 * the browser with a bare `ReferenceError`. That is the single most common agent
 * mistake (names that do not line up), and it is the same failure mode already recorded
 * in `packages/ui-examples/tests/render.test.ts`.
 *
 * Deliberately **parser-only** (`ts.createSourceFile`, no program, no `lib.*.d.ts`), the
 * same way `scripts/check/skill.mjs` uses TypeScript. A full checker would need the type
 * surface of every published package at runtime and would drown the one signal we care
 * about in unrelated type noise.
 *
 * Because there is no checker, scopes are over-approximated on purpose: a name declared
 * in *any* scope of a file counts as declared for that whole file. That can miss a
 * real shadowing bug, but it never invents one — a false positive here would block an
 * app that works, which is the worse failure.
 *
 * Findings split in two:
 * - `error`  — high confidence (typo of a declared name, missing component/hook/React
 *   import). Blocks reload.
 * - `notice` — an unknown name that may just be a global this allowlist does not know.
 *   Surfaced to the agent, never blocks.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Type-only: erased at build time, so a host install without `typescript` still loads.
import type * as tsTypes from "typescript";
import type tsModule from "typescript";

import { platformKeyframeNames } from "./platform-keyframes.ts";

type Ts = typeof tsModule;

type TsLoader = Promise<Ts | null>;

let tsReady: TsLoader | null = null;

/**
 * Load the TypeScript parser on first use. `typescript` is a dependency, but it is also
 * ~20 MB — if a particular install cannot resolve it, the honest answer is "this check is
 * unavailable", not "your app is broken". Reload must never fail over its own linter.
 */
function loadTs(): TsLoader {
  if (!tsReady) {
    tsReady = import("typescript")
      .then((mod) => ((mod as { default?: Ts }).default ?? (mod as unknown as Ts)) ?? null)
      .catch(() => null);
  }
  return tsReady;
}

/** True when the parser is resolvable in this install. */
export async function staticCheckAvailable(): Promise<boolean> {
  return (await loadTs()) !== null;
}

/**
 * Bound immediately before the synchronous scan below runs, and only read from it — the
 * whole traversal is one synchronous block after the `await`, so there is no interleaving
 * to worry about. Passing `ts` through six helpers bought nothing but noise.
 */
let ts: Ts;

/** Trees that are generated, vendored, or not source. */
const SKIP_DIRS = new Set(["node_modules", ".git", ".autogen", ".ui-build", ".shots"]);

export type StaticFinding = {
  /** App-relative path, e.g. `ui.tsx` / `api/parse.ts`. */
  file: string;
  line: number;
  column: number;
  name: string;
  /** Closest declared name, when there is one. */
  suggestion?: string;
  severity: "error" | "notice";
  reason: string;
};

export type StaticCheckResult = {
  findings: StaticFinding[];
  /** Findings grouped under the reload `errors[]` prefix for their layer. */
  errorsByLayer: Map<string, StaticFinding[]>;
  /** The parser could not be loaded, so nothing was checked. */
  unavailable?: boolean;
};

/**
 * Globals that are legitimately free in a mini-app: UI runs in a browser, backend runs
 * in the host's Node process. Deliberately generous — a miss here only ever downgrades
 * a finding to `notice`, it cannot block an app.
 */
const GLOBALS = new Set([
  // ES value globals
  "Array", "ArrayBuffer", "Atomics", "BigInt", "BigInt64Array", "BigUint64Array",
  "Boolean", "DataView", "Date", "decodeURI", "decodeURIComponent", "encodeURI",
  "encodeURIComponent", "Error", "escape", "eval", "EvalError", "FinalizationRegistry",
  "Float16Array", "Float32Array", "Float64Array", "Function", "globalThis", "Infinity",
  "Int8Array", "Int16Array", "Int32Array", "Intl", "isFinite", "isNaN", "JSON", "Map",
  "Math", "NaN", "Number", "Object", "parseFloat", "parseInt", "Promise", "Proxy", "RangeError",
  "ReferenceError", "Reflect", "RegExp", "Set", "SharedArrayBuffer", "String", "Symbol",
  "SyntaxError", "TypeError", "undefined", "Uint8Array", "Uint8ClampedArray", "Uint16Array",
  "Uint32Array", "WeakMap", "WeakRef", "WeakSet",
  // browser
  "AbortController", "AbortSignal", "addEventListener", "afterprint", "AnalyserNode", "Animation",
  "atob", "Audio", "AudioContext", "AudioNode", "beforeprint", "beforeunload", "Blob", "BroadcastChannel",
  "btoa", "CanvasGradient", "CanvasPattern", "CanvasRenderingContext2D", "CharacterData", "close",
  "Clipboard", "ClipboardEvent", "CloseEvent", "Comment", "console", "Crypto", "crypto", "CustomEvent",
  "DeviceMotionEvent", "DeviceOrientationEvent", "devicePixelRatio", "DocumentFragment", "DocumentTimeline",
  "DOMParser", "DOMRect", "DOMTokenList", "DragEvent", "Element", "Event", "EventSource", "EventTarget",
  "fetch", "File", "FileList", "FileReader", "FocusEvent", "FormData", "Gamepad", "HashChangeEvent",
  "History", "HTMLAnchorElement", "HTMLAudioElement", "HTMLBaseElement", "HTMLBodyElement", "HTMLButtonElement",
  "HTMLCanvasElement", "HTMLCollection", "HTMLDivElement", "HTMLDocument", "HTMLElement", "HTMLEmbedElement",
  "HTMLFieldSetElement", "HTMLFormElement", "HTMLHeadElement", "HTMLHeadingElement", "HTMLHtmlElement",
  "HTMLIFrameElement", "HTMLImageElement", "HTMLInputElement", "HTMLLabelElement", "HTMLLegendElement",
  "HTMLLIElement", "HTMLLinkElement", "HTMLMetaElement", "HTMLMeterElement", "HTMLObjectElement",
  "HTMLOListElement", "HTMLOptGroupElement", "HTMLOptionElement", "HTMLParagraphElement", "HTMLPreElement",
  "HTMLProgressElement", "HTMLScriptElement", "HTMLSelectElement", "HTMLSlotElement", "HTMLSourceElement",
  "HTMLSpanElement", "HTMLStyleElement", "HTMLTableElement", "HTMLTableCellElement", "HTMLTableColElement",
  "HTMLTableRowElement", "HTMLTableSectionElement", "HTMLTemplateElement", "HTMLTextAreaElement",
  "HTMLTimeElement", "HTMLTitleElement", "HTMLTrackElement", "HTMLUListElement", "HTMLUnknownElement",
  "HTMLVideoElement", "IDBDatabase", "IDBTransaction", "Image", "InputEvent", "IntersectionObserver",
  "keyboard", "KeyboardEvent", "KeyframeEffect", "localStorage", "Location", "matchMedia", "MediaQueryList",
  "MediaRecorder", "MessageChannel", "MessageEvent", "MessagePort", "MutationObserver", "Navigation",
  "navigator", "Node", "NodeList", "OffscreenCanvas", "onerror", "open", "Option", "Path2D", "performance",
  "PointerEvent", "PopStateEvent", "print", "Process", "ProgressEvent", "CustomStateSet", "RadioNodeList",
  "Range", "requestAnimationFrame", "requestIdleCallback", "ResizeObserver", "Screen", "ScrollTimeline",
  "sessionStorage", "ShadowRoot", "Storage", "StorageEvent", "Text", "TextDecoder", "TextEncoder",
  "TextMetrics", "Touch", "TouchEvent", "TouchList", "TrackEvent", "URL", "URLPattern", "URLSearchParams",
  "VideoFrame", "VisualViewport", "WebSocket", "WheelEvent", "window", "Worker", "WPTEstimates",
  "cancelAnimationFrame", "cancelIdleCallback", "clearInterval", "clearTimeout", "getComputedStyle",
  "structuredClone", "queueMicrotask", "reportError", "setTimeout", "setInterval", "postMessage",
  "addEventListener", "removeEventListener", "dispatchEvent", "Alert", "Confirm", "Prompt",
  // host-side Node globals reachable from main.api.ts
  "Buffer", "process", "require", "__dirname", "__filename", "module", "exports",
  "console", "TextEncoderStream", "TextDecoderStream", "CompressionStream", "DecompressionStream",
  "ByteLengthQueuingStrategy", "CountQueuingStrategy", "MessageChannel", "ReadableStream",
  "TransformStream", "WritableStream", "ReadableStreamDefaultReader", "Iterator", "DOMException",
  "AggregateError", "WebAssembly", "Generator", "AsyncFunction", "AsyncGenerator", "Response",
  "Request", "Headers", "AbortSignalAny", "FinalizationRegistry", "SharedArrayBuffer",
]);

/** Layer prefix for a relative path — matches the `errors[i]` prefixes documented in SKILL.md. */
export function layerOfRel(rel: string): string {
  const posix = rel.split(path.sep).join("/");
  if (posix === "main.api.ts" || posix === "main.api.js" || /^api\//.test(posix)) return "main.api";
  if (/^shared\//.test(posix)) return "shared";
  return "ui";
}

/** Every .ts/.tsx in the app dir (same tree the UI bundle and the CSS scan see). */
function sourceFiles(appDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      if (SKIP_DIRS.has(name)) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full);
    }
  };
  walk(appDir);
  return out.sort();
}

/** Names bound by an identifier or a binding pattern (destructuring). */
function bindingNames(node: tsTypes.Node | undefined, into: Set<string>): void {
  if (!node) return;
  if (ts.isIdentifier(node)) {
    into.add(node.text);
    return;
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    for (const el of node.elements) {
      if (ts.isOmittedExpression(el)) continue;
      bindingNames(el.name, into);
    }
    return;
  }
  if (ts.isBindingElement(node)) {
    bindingNames(node.name, into);
  }
}

function isTypeRange(kind: tsTypes.SyntaxKind): boolean {
  return kind >= ts.SyntaxKind.FirstTypeNode && kind <= ts.SyntaxKind.LastTypeNode;
}

/** Collect every value-level name a file binds (module-wide, over-approximated). */
function collectDeclarations(root: tsTypes.Node, decls: Set<string>): void {
  const visit = (node: tsTypes.Node): void => {
    if (ts.isVariableDeclaration(node)) {
      bindingNames(node.name, decls);
    } else if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      if (node.name) decls.add(node.name.text);
    } else if (ts.isFunctionExpression(node) || ts.isClassExpression(node)) {
      if (node.name) decls.add(node.name.text);
    } else if (ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
      if (node.name && ts.isIdentifier(node.name)) decls.add(node.name.text);
    } else if (ts.isParameter(node)) {
      bindingNames(node.name, decls);
    } else if (ts.isCatchClause(node)) {
      bindingNames(node.variableDeclaration?.name, decls);
    } else if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      // `import { type X, Y }` is a value import that merely carries a type-only
      // specifier: filter per specifier, never veto the whole statement (that made
      // every component imported alongside a `type` binding look undefined).
      if (clause && !clause.isTypeOnly) {
        if (clause.name) decls.add(clause.name.text);
        const nb = clause.namedBindings;
        if (nb) {
          if (ts.isNamespaceImport(nb)) decls.add(nb.name.text);
          else for (const spec of nb.elements) if (!spec.isTypeOnly) decls.add(spec.name.text);
        }
      }
      return; // imports bind names; nothing else in them is a value position
    } else if (ts.isExportDeclaration(node)) {
      return; // `export { a } from "./b"` — specifiers are neither local refs nor local bindings
    } else if (ts.isExportSpecifier(node)) {
      // `export { local as exported }` (no moduleSpecifier) refers to a local binding.
      if (!node.parent.parent || !ts.isExportDeclaration(node.parent.parent) || !node.parent.parent.moduleSpecifier) {
        decls.add((node.propertyName ?? node.name).text);
      }
    } else if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return; // type-only: does NOT make a runtime name defined
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
}

/** Where an identifier sits, which decides how confident we can be. */
type RefSite = {
  name: string;
  pos: number;
  /** Called as a function: `foo(...)`. */
  called: boolean;
  /** JSX component tag. */
  jsx: boolean;
  /** Base of a member access: `React.useState`. */
  memberBase: boolean;
};

function collectReferences(root: tsTypes.Node, sf: tsTypes.SourceFile): RefSite[] {
  const out: RefSite[] = [];

  const isDeclarationName = (node: tsTypes.Identifier): boolean => {
    const p = node.parent;
    if (!p) return false;
    if (ts.isVariableDeclaration(p) || ts.isBindingElement(p)) return p.name === node || isInsideName(p.name, node);
    if (
      ts.isFunctionDeclaration(p) || ts.isClassDeclaration(p) || ts.isFunctionExpression(p) ||
      ts.isClassExpression(p) || ts.isInterfaceDeclaration(p) || ts.isTypeAliasDeclaration(p) ||
      ts.isEnumDeclaration(p) || ts.isModuleDeclaration(p) || ts.isParameter(p) || ts.isTypeParameterDeclaration(p)
    ) {
      return p.name === node;
    }
    if (ts.isPropertyAssignment(p)) {
      const shorthand = (p as unknown as { isShorthandAssignment?: boolean }).isShorthandAssignment === true;
      return p.name === node && !shorthand;
    }
    if (ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isAccessor(p) ||
        ts.isPropertySignature(p) || ts.isMethodSignature(p)) {
      return p.name === node && !ts.isComputedPropertyName(node);
    }
    if (ts.isEnumMember(p)) return p.name === node;
    if (ts.isQualifiedName(p) || ts.isNamespaceImport(p) || ts.isImportSpecifier(p) ||
        ts.isExportSpecifier(p) || ts.isBreakStatement(p) || ts.isContinueStatement(p)) {
      return true;
    }
    if (ts.isLabeledStatement(p)) return p.label === node;
    if (ts.isJsxAttribute(p) || ts.isJsxSpreadAttribute(p)) return false; // handled by the walk
    if (ts.isPropertyAccessExpression(p)) return p.name === node;
    if (ts.isMetaProperty(p)) return false;
    return false;
  };

  const isInsideName = (nameNode: tsTypes.Node, needle: tsTypes.Node): boolean => {
    let found = false;
    const hunt = (n: tsTypes.Node): void => {
      if (found) return;
      if (n === needle) {
        found = true;
        return;
      }
      if (ts.isBindingElement(n) && n.propertyName) return; // `{ a: b }` — `a` is a source key
      ts.forEachChild(n, hunt);
    };
    hunt(nameNode);
    return found;
  };

  const visit = (node: tsTypes.Node): void => {
    const kind = node.kind;
    // Type positions are erased at runtime — never report from them.
    if (isTypeRange(kind)) return;
    if (ts.isImportDeclaration(node) || ts.isExternalModuleReference(node)) return;

    if (ts.isJsxAttribute(node)) {
      if (node.initializer) visit(node.initializer);
      return;
    }
    // `</div>` repeats the tag name; only the opening element is a reference.
    if (ts.isJsxClosingElement(node) || ts.isJsxText(node) || ts.isJsxNamespacedName(node)) return;
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName;
      if (ts.isIdentifier(tag)) {
        const text = tag.text;
        // Lower-case tags are intrinsic elements (`div`), not values.
        if (!/^[a-z]/.test(text)) out.push({ name: text, pos: tag.getStart(sf), called: false, jsx: true, memberBase: false });
      } else {
        visit(tag); // `<Foo.Bar />` walks into the member expression
      }
      visit(node.attributes);
      if (ts.isJsxOpeningElement(node)) return; // children handled below by forEachChild
      return;
    }

    if (ts.isIdentifier(node)) {
      if (!isDeclarationName(node)) {
        const p = node.parent;
        const called = !!p && ts.isCallExpression(p) && p.expression === node;
        const memberBase = !!p && ts.isPropertyAccessExpression(p) && p.expression === node;
        out.push({ name: node.text, pos: node.getStart(sf), called, jsx: false, memberBase });
      }
      return;
    }

    // Skip declaration-name subtrees that are patterns (`const { a, b } = …` binds, does not read),
    // but still walk their initializers.
    if (ts.isVariableDeclaration(node)) {
      if (node.initializer) visit(node.initializer);
      visitBindingDefault(node.name);
      return;
    }
    if (ts.isParameter(node)) {
      if (node.initializer) visit(node.initializer);
      return;
    }
    if (ts.isBindingElement(node)) {
      if (node.initializer) visit(node.initializer);
      return;
    }
    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isQualifiedName(node)) return;
    if (ts.isMetaProperty(node)) return;
    if (
      ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node) ||
      ts.isTypeParameterDeclaration(node)
    ) {
      ts.forEachChild(node, (child) => {
        const cn = child as tsTypes.Node;
        if (ts.isIdentifier(cn) && node.kind !== ts.SyntaxKind.ModuleDeclaration && "name" in node && (node as { name?: tsTypes.Node }).name === cn) return;
        if (isTypeRange(cn.kind)) return;
        if (ts.isTypeParameterDeclaration(cn) || ts.isHeritageClause(cn) && node.kind === ts.SyntaxKind.InterfaceDeclaration) return;
        visit(cn);
      });
      return;
    }

    ts.forEachChild(node, visit);
  };

  /** `const { a = someExpr } = x` — the default is a read. */
  const visitBindingDefault = (pattern: tsTypes.Node): void => {
    if (ts.isObjectBindingPattern(pattern) || ts.isArrayBindingPattern(pattern)) {
      for (const el of pattern.elements) {
        if (ts.isBindingElement(el)) {
          if (el.initializer) visit(el.initializer);
          if (el.propertyName && ts.isComputedPropertyName(el.propertyName)) visit(el.propertyName);
          if (el.name && !ts.isIdentifier(el.name)) visitBindingDefault(el.name);
        }
      }
    }
  };

  visit(root);
  return out;
}

/** Bounded edit distance; returns -1 as soon as it cannot beat `max`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return -1;
  const prev = new Array<number>(b.length + 1);
  const cur = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return -1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length] <= max ? prev[b.length] : -1;
}

function closestMatch(name: string, decls: Iterable<string>): string | undefined {
  const max = name.length <= 4 ? 1 : name.length <= 8 ? 2 : 3;
  let best: string | undefined;
  let bestD = max + 1;
  for (const cand of decls) {
    if (cand === name || Math.abs(cand.length - name.length) > max) continue;
    if (cand[0] !== name[0] && cand.length > 3) continue; // cheap prefilter: first letter
    const d = editDistance(name.toLowerCase(), cand.toLowerCase(), max);
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = cand;
    }
  }
  return best;
}

/**
 * Scan every source of a mini-app for names that will not exist at runtime.
 * `appDir` is the registered app directory; findings carry app-relative paths.
 */
/** Every file whose text may declare CSS: sources plus any hand-written stylesheet. */
function cssBearingFiles(appDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(dir, name);
      if (SKIP_DIRS.has(name)) continue;
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      // `.autogen` is skipped with the app's other generated trees: it re-echoes the
      // platform's own keyframes, and flagging those would be pure noise.
      else if (/\.(ts|tsx|js|jsx|css)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(full);
    }
  };
  walk(appDir);
  return out.sort();
}

const KEYFRAME_DECL = /@keyframes\s+(?:"([^"]+)"|'([^']+)'|([\w-]+))/g;

type KeyframeDecl = { name: string; file: string; line: number; column: number };

/**
 * `@keyframes` the app declares, wherever they are written. Deliberately text-based: an app
 * puts keyframes in a `<style>` template literal, in `` css`…` ``, in a plain string it
 * injects, or in a `.css` file — an AST walk would have to decide which strings are CSS,
 * and guessing wrong means missing a real collision.
 */
function keyframeDeclarations(appDir: string): KeyframeDecl[] {
  const decls: KeyframeDecl[] = [];
  for (const abs of cssBearingFiles(appDir)) {
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (!src.includes("@keyframes")) continue;
    const rel = path.relative(appDir, abs).split(path.sep).join("/");
    for (const m of src.matchAll(KEYFRAME_DECL)) {
      const name = m[1] ?? m[2] ?? m[3];
      if (!name) continue;
      const at = m.index ?? 0;
      const before = src.slice(0, at);
      decls.push({
        name,
        file: rel,
        line: before.split("\n").length,
        column: at - (before.lastIndexOf("\n") + 1) + 1,
      });
    }
  }
  return decls;
}

/**
 * Keyframe collisions inside this one app document — **notices, never blocking**.
 *
 * Each mini-app is its own iframe and therefore its own document: an app's keyframes cannot
 * reach another app, so uniquely named custom animation is safe and is not something to
 * forbid. Two things do silently misbehave: re-declaring a name the platform sheet already
 * defines, and declaring the same name twice in one app, where whichever mounts last wins
 * for both users (that is a real bug we hit — one dashboard defined `aibrief-soft` twice
 * with different opacity values). Worth telling the agent about; not worth refusing to
 * reload an app over, because overriding a platform keyframe can be exactly what the author
 * meant to do.
 */
function keyframeFindings(appDir: string): StaticFinding[] {
  const decls = keyframeDeclarations(appDir);
  if (!decls.length) return [];
  const reserved = platformKeyframeNames();
  const seen = new Map<string, KeyframeDecl>();
  const out: StaticFinding[] = [];
  for (const d of decls) {
    const at = { file: d.file, line: d.line, column: d.column, name: d.name };
    if (reserved.has(d.name)) {
      out.push({
        ...at,
        severity: "notice",
        reason:
          `@keyframes "${d.name}" reuses a name the platform stylesheet already defines, so the later-mounted ` +
          `rule wins for every animation using it in this app. Rename it (e.g. "${d.name}-app") unless that ` +
          `override is what you meant.`,
      });
      continue;
    }
    const first = seen.get(d.name);
    if (first) {
      out.push({
        ...at,
        severity: "notice",
        reason:
          `@keyframes "${d.name}" is declared twice in this app (also at ${first.file}:${first.line}); ` +
          `whichever mounts last wins, so one of the two users silently gets the other's values.`,
      });
      continue;
    }
    seen.set(d.name, d);
  }
  return out;
}

/**
 * The three heads that carry an event name. Deliberately narrow: `\bpush\(` would match the
 * `rows.push(item)` every app writes, mark it "computed", and silence the check forever — and a
 * check that never fires is worse than none. `ctx.push(` / `streamTo:` are the only ways a name
 * actually reaches the bus; `on(` is matched only when it opens a string literal, so a computed
 * subscriber cannot invent a false accusation either.
 */
const PUSH_HEAD = /\bctx\.push\(\s*/g;
const STREAM_HEAD = /streamTo:\s*/g;
const LISTEN_HEAD = /\bon\(\s*(?=["'`])/g;
const QUOTE = /["'`]/;

type EventRefs = { names: Map<string, { file: string; line: number }>; dynamic: boolean };

function collectInto(
  src: string,
  rel: string,
  head: RegExp,
  into: EventRefs,
): void {
  for (const m of src.matchAll(head)) {
    const at = (m.index ?? 0) + m[0].length;
    const rest = src.slice(at, at + 200);
    const quote = rest[0];
    if (!quote || !QUOTE.test(quote)) {
      // `push(name)` / `on(` with no string first: pairing literals against this is guesswork.
      into.dynamic = true;
      continue;
    }
    const close = rest.indexOf(quote, 1);
    if (close < 0) {
      into.dynamic = true;
      continue;
    }
    const name = rest.slice(1, close);
    if (!into.names.has(name)) {
      into.names.set(name, { file: rel, line: src.slice(0, at).split("\n").length });
    }
  }
}

/**
 * Event names that cannot match — **notices, never blocking**.
 *
 * `ctx.push("readStage")` and `useApp().on("readStage")` are joined by a string the type checker
 * never sees: the backend and `ui.tsx` compile as separate bundles, and the UI may not import
 * `main.api.ts` (AGENTS.md → Hard constraints 1), so no type can cross the seam. A one-character
 * typo therefore produces an app that works, looks fine, and never updates — the worst kind of bug
 * to debug from the outside. Matching the literals catches that; it stays a notice because
 * `push`/`on` are common method names elsewhere, and a false alarm must never be able to stop a
 * working app from reloading. Declaring the names once in `shared/` is the way to make the pairing
 * real rather than checked (skill: ctx.md → "Typed events").
 */
function eventFindings(appDir: string): StaticFinding[] {
  const pushed: EventRefs = { names: new Map(), dynamic: false };
  const listened: EventRefs = { names: new Map(), dynamic: false };

  for (const abs of sourceFiles(appDir)) {
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (!src.includes("ctx.push(") && !src.includes("on(") && !src.includes("streamTo")) continue;
    const rel = path.relative(appDir, abs).split(path.sep).join("/");
    collectInto(src, rel, PUSH_HEAD, pushed);
    // `streamTo` is a push the host performs on the app's behalf.
    collectInto(src, rel, STREAM_HEAD, pushed);
    // `on("` is also how a socket or an emitter is wired up, and accusing those would be a false
    // positive. The app's own subscriber comes from `useApp()`, which lives in the UI package — so
    // only files that import from it can register a listener as far as this check is concerned.
    if (/from\s+["']@monkey-mini-app\/ui["']/.test(src)) collectInto(src, rel, LISTEN_HEAD, listened);
  }

  // One computed name anywhere and literal pairing stops being evidence.
  if (pushed.dynamic || listened.dynamic) return [];
  if (!pushed.names.size && !listened.names.size) return [];

  const out: StaticFinding[] = [];
  for (const [name, ref] of listened.names) {
    if (pushed.names.has(name)) continue;
    out.push({
      ...ref,
      column: 1,
      name,
      severity: "notice",
      reason:
        `nothing in this app pushes "${name}", so this subscriber never fires — check the spelling ` +
        `against ctx.push / streamTo, or declare the name once in shared/ and import it on both sides`,
    });
  }
  for (const [name, ref] of pushed.names) {
    if (listened.names.has(name)) continue;
    out.push({
      ...ref,
      column: 1,
      name,
      severity: "notice",
      reason:
        `"${name}" is pushed but nothing subscribes to on("${name}") — dead code, or spelled ` +
        `differently on the UI side`,
    });
  }
  return out;
}

export async function checkAppSources(appDir: string): Promise<StaticCheckResult> {
  const empty: StaticCheckResult = { findings: [], errorsByLayer: new Map() };
  const loaded = await loadTs();
  if (!loaded) return { ...empty, unavailable: true };
  ts = loaded;

  const findings: StaticFinding[] = [];

  for (const abs of sourceFiles(appDir)) {
    const rel = path.relative(appDir, abs);
    let src: string;
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.Unknown);
    const parseErrors = (sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics;
    if (parseErrors && parseErrors.length > 0) {
      continue; // the compile step already reports syntax errors; do not double-report
    }

    const decls = new Set<string>();
    collectDeclarations(sf, decls);
    for (const ref of collectReferences(sf, sf)) {
      if (decls.has(ref.name) || GLOBALS.has(ref.name)) continue;
      const where = sf.getLineAndCharacterOfPosition(ref.pos);
      const suggestion = closestMatch(ref.name, decls);

      // A bare *read* of an unknown name is only a hint — it may be a global this
      // allowlist does not know. A *call*, a JSX tag, a hook or a PascalCase member base
      // is different: nothing works by accidentally naming a free function, and the
      // reported failure (`greeting()` where only `greet()` exists) is exactly this.
      const hook = ref.called && /^use[A-Z]/.test(ref.name);
      let severity: "error" | "notice" = "notice";
      let reason = `"${ref.name}" is not declared or imported in this file (it may be a global this check does not know)`;
      if (suggestion) {
        severity = "error";
        reason = `"${ref.name}" is not defined (did you mean "${suggestion}"?)`;
      } else if (ref.jsx) {
        severity = "error";
        reason = `JSX component <${ref.name} /> is not defined or imported`;
      } else if (hook) {
        severity = "error";
        reason = `hook "${ref.name}" is called but not imported (hooks come from "react")`;
      } else if (ref.called) {
        severity = "error";
        reason = `"${ref.name}()" is called but never defined or imported`;
      } else if (ref.memberBase && /^[A-Z]/.test(ref.name)) {
        severity = "error";
        reason = `"${ref.name}" is used before being imported`;
      }

      findings.push({
        file: rel.split(path.sep).join("/"),
        line: where.line + 1,
        column: where.character + 1,
        name: ref.name,
        ...(suggestion ? { suggestion } : {}),
        severity,
        reason,
      });
    }
  }

  findings.push(...keyframeFindings(appDir));
  findings.push(...eventFindings(appDir));

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  const errorsByLayer = new Map<string, StaticFinding[]>();
  for (const f of findings) {
    if (f.severity !== "error") continue;
    const layer = layerOfRel(f.file);
    const list = errorsByLayer.get(layer) ?? [];
    list.push(f);
    errorsByLayer.set(layer, list);
  }
  return { findings, errorsByLayer };
}

/** One-line, agent-readable rendering of a finding (no prefix — the caller adds the layer). */
export function formatFinding(f: StaticFinding): string {
  return `${f.reason} — ${f.file}:${f.line}:${f.column}`;
}
