# RFC: Authoring protocol unification (+ UI import bounds)

> Date: 2026-09-02
> Status: **implemented** (hard cut landed; notes on what changed vs. the design below)
> Package: `packages/host` + `packages/sdk` (+ skill / templates / docs)
> Supersedes the narrow “UI import bounds only” draft (same file; scope expanded).

## 1. Problem

Two related holes / inconsistencies in the mini-app authoring surface:

### 1a. Split / leaked author packages

| Side | Today | Issue |
|---|---|---|
| UI | real `@monkey-mini-app/sdk` (`useApp` + UI kit) | OK naming |
| Backend | virtual `@monkeyagent/dashboard` → injected `defineDashboard` | Old MonkeyAgent namespace; not a real package; semantics ≠ `useApp` |
| UI legacy | `@monkeyagent/host` / `@monkey-mini-app/ui` aliased to `/mma/sdk.js` | Same leak / dual names |

There is **no** `@monkey-mini-app/dashboard` package. `defineDashboard` lives only as a local function in `packages/host/src/apps/apps-manager.ts`, injected by a fake `require`.

### 1b. UI can escape the app dir (verified)

`makeUiPlugin()` (`packages/host/src/compile/ui-compiler.ts`) has **no** `../` bounds check. esbuild resolves relative specs against `resolveDir`, so `../<sibling-app>/Secret` and `../../outside` currently **bundle**. Backend already blocks this via `resolveAppModule`.

### 1c. Folder messaging vs reality

Docs / error strings say “only `./lib` / `./components`”, but:

- Backend already accepts **any** `./…` inside `appDir` (plus bare `lib/` / `components/` prefixes).
- `components/` as a backend special-case is wrong (frontend convention).
- No mechanical ban on UI↔backend cross-imports, so shared trees get messy.

## 2. Agreed target (hard cut — **no** `@monkeyagent/*` alias period)

| Surface | New rule |
|---|---|
| Author package | **Both** sides import `@monkey-mini-app/sdk` |
| UI API | `useApp` (+ components from the same package) |
| Backend API | `defineApp` (replaces `defineDashboard`); host **injects** it — backend must not load the React SDK bundle |
| Remove | `@monkeyagent/dashboard`, `@monkeyagent/host`, `defineDashboard`, author-facing `useDashboardApi` |
| Layout | Entries `ui.tsx` + `main.api.ts`; trees **`ui/**`** (UI only), **`api/**`** (backend only), **`shared/**`** (isomorphic pure) |
| Cross-import | UI must not import `./api/**` or `main.api.ts`; backend must not import `./ui/**`; both must not escape `appDir` |
| Drop | Bare `lib/` / `components/` require special-cases |
| `shared/**` | No React / `ctx` / DOM / Node — skill convention first; optional static gate later |

**Explicitly not doing:** publish a real `@monkey-mini-app/dashboard` npm package; keep `@monkeyagent/*` compatibility shims.

## 3. Design

### 3.1 Backend loader (`apps-manager.ts`)

```ts
if (spec === "@monkey-mini-app/sdk") {
  return { defineApp, default: defineApp };
}
if (!spec.startsWith(".")) {
  throw new HostError("BACKEND_IMPORT", `backend cannot import '${spec}'. Only @monkey-mini-app/sdk and relative imports under the app dir`);
}
const next = resolveAppModule(file, spec, appDir);
// after resolve: reject if relative path is under ui/
assertBackendMayImport(appDir, next);
return this.loadAppFile(next, appDir, loaded);
```

- Rename `defineDashboard` → `defineApp`, `DashboardDef` → `AppDef` (and exported types from `@monkey-mini-app/host`).
- Error codes may keep `INVALID_DASHBOARD` temporarily or rename to `INVALID_APP` in the same change — prefer rename for consistency.
- Containment check in `resolveAppModule` stays; add `ui/**` ban on top.

### 3.2 UI compiler (`ui-compiler.ts`) — bounds + tree ban

`makeUiPlugin(appDir)` (today takes no args):

1. Existing: forbid `main.api.ts`; externalise `react` → `/mma/runtime.js`; externalise SDK → `/mma/sdk.js`.
2. **Remove** `@monkeyagent/host` from `SDK_SPECIFIER` (hard cut). Keep `@monkey-mini-app/sdk` (and optionally `@monkey-mini-app/ui` as same-namespace alias → `/mma/sdk.js`, or drop it in the same hard cut — prefer **sdk only** for authors).
3. Relative `onResolve` (`/^\.\.?\//`):
   - Escape `appDir` → fail (same predicate as backend / sketch below).
   - Target under `api/` → fail (`UI cannot import api/**`).

Sketch:

```ts
build.onResolve({ filter: /^\.\.?\// }, (args) => {
  const abs = path.resolve(args.resolveDir, args.path);
  const rel = path.relative(root, abs);
  if (rel === "" || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    return { errors: [{ text: `UI import escapes the app dir: "${args.path}"` }] };
  }
  const norm = rel.split(path.sep).join("/");
  if (norm === "api" || norm.startsWith("api/")) {
    return { errors: [{ text: `UI cannot import api/**: "${args.path}"` }] };
  }
  return undefined;
});
```

### 3.3 SDK package

- Export `defineApp(def: AppDef): AppDef` as an **identity** helper for types / editor; runtime backend uses the host inject.
- Stop exporting `useDashboardApi`.
- Document in package description: author SDK for **UI and backend contract** (UI ships in `/mma/sdk.js`; `defineApp` is types + inject).

### 3.4 Templates / fixtures / skill

- Every `main.api.ts`: `import { defineApp } from "@monkey-mini-app/sdk"`.
- Move `insights/lib/sample.ts` → `shared/sample.ts` (pure data).
- Skill + AGENTS hard constraints + `loader.md` / `troubleshoot.md` / `check:templates` ambient modules + `check:skill` constants: new names only.
- `templates/README.md`: document `ui/` · `api/` · `shared/` as the recommended layout (not a mandatory deep tree for trivial apps — entries alone are enough when there are no helpers).

## 4. Verification

`packages/host/tests/ui-compiler.test.ts`:

- In-app `./shared/x`, `./ui/x` still compile.
- `../sibling/Secret`, `../../outside` → escape error.
- `./api/x` from UI → `api/**` error.

`packages/host/tests/apps-manager.test.ts` (+ smoke):

- `@monkey-mini-app/sdk` + `defineApp` loads.
- `@monkeyagent/dashboard` / `defineDashboard` → fail.
- Backend `./ui/x` → fail; `./api/x` / `./shared/x` → ok.

Gates:

```bash
pnpm --filter @monkey-mini-app/host test
pnpm exec tsc -b
pnpm check:skill
pnpm check:templates
pnpm test
```

## 5. Severity / rollout

- Escape check: defense-in-depth / inter-app confidentiality (trusted shared FS) — low severity but closes a doc lie.
- Protocol rename: **breaking** for every existing mini-app still on `@monkeyagent/dashboard`. Hard cut by product decision; authors / agents rewrite via skill. No runtime migrator in this RFC.

## 6. Out of scope (still)

- `mini_app_unregister`
- Static “`shared/**` must be pure” linter (convention in skill until needed)
- Renaming the npm package `@monkey-mini-app/sdk` itself

## 7. What landed differently / extra

- **`@monkey-mini-app/ui` alias also removed** (§3.2 said “optionally”): hard cut means one author specifier. An app importing it now gets `Could not resolve "@monkey-mini-app/ui"`.
- **Bounds check must compare realpath’d dirs** — esbuild reports `/private/var/…` while the workspace path is `/var/…` on macOS, so a naive `path.relative` flagged every in-app import as an escape. `realDir()` in `ui-compiler.ts` handles it.
- **`AppsManager.appMtime` now walks the whole app dir** instead of `manifest.json` + `main.api.*` + `lib/*.ts`; otherwise edits under `api/` / `shared/` would never invalidate the backend cache.
- **Drift gate moved from types to `check:skill`**: a host test importing `@monkey-mini-app/sdk` types drags `packages/ui/src` into the host’s NodeNext project (extensionless relative imports there → hundreds of TS2835). Instead rule **`ctx-mirror`** in `scripts/check/skill.mjs` parses both `AppContext` (host) and `AppCtx` (SDK) with the TypeScript compiler API and fails if the key sets differ.
- **`check:templates` is now green and honest**: it type-checks templates against the real SDK sources (no more ambient fake modules), filters diagnostics to `templates/**`, adds a shorthand ambient declaration for the CDN `https://esm.sh/*` imports, and throws if `tsc` exits non-zero without diagnostics (it had been silently passing on a broken regex).
