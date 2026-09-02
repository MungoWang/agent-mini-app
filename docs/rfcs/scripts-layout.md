# RFC: `scripts/` layout, naming, and a self-checking gate

> Status: **landed.** Operational doc: [`scripts/README.md`](../../scripts/README.md).
> Delta from the proposal: no `check/scripts.mjs` gate (conventions live in the README instead);
> `scripts/README.md` is hand-written (no generator); `run-demo.sh` deleted; `mma-init` kept as `setup/host-config.mts`.
> Scope: `scripts/**` (14 files, ~3,048 lines), their callers (`package.json` in root + packages, CI, docs, the skill, host error strings), and a new gate that keeps the folder honest.

## 1. Why this needs a rule, not a cleanup

Current inventory (everything sits flat in `scripts/`):

| File | Lines | What it does | Invoked by |
|---|---:|---|---|
| `build-ui.mjs` | 209 | ui package → `dist/` (flat re-export + globals.css) | `build:ui`, `prepack` of ui, install script, **host error strings** |
| `build-sdk.mjs` | 245 | sdk `runtime.js` / `sdk.js` bundle | `build:sdk`, `prepack` of sdk, install script, **host error strings**, **sdk test** |
| `generate-skill.mjs` | 1229 | components → `references/catalog.md` + `contracts/*.md` + `ai/catalog.json` | `gen:skill`, `prepublishOnly` of dsh |
| `sync-skill.mjs` | 34 | copy canonical skill into an adapter for the tarball | `prepack`/`postpack` of dsh |
| `vendor-undraw.mjs` | 122 | unDraw SVGs → tokenised `Illu*` components | manual (AGENTS.md) |
| `check-skill.mjs` | 450 | 13 rules: skill prose vs code/registry truth | `check:skill`, CI, smoke test |
| `check-templates.mts` | 114 | type-check the 7 skill templates | `check:templates` |
| `dev-react-host.mts` | 73 | Vite host + demo host for local UI work | `react-host` |
| `demo-templates.mts` | 83 | seed demo apps into the dev workspace | called by `dev-react-host.mts` |
| `dsh-debug-switch.mts` | 77 | flip the local dsh profile between path-linked and published | `dsh:debug`, `dsh:prod` |
| `install-dsh-mini-app.sh` | 143 | build + path-link packages into `~/.dsh/profiles/web` | manual (LOCAL.md, AGENTS.md) |
| `mma-init.ts` | 33 | write a complete `host.json` via `bootstrapHostConfig` | manual, `pnpm exec tsx`; **imported by `packages/dsh/tests`** |
| `publish.mts` | 108 | e2e gate then ordered npm publish | `publish:packages` |
| `run-demo.sh` | 8 | `pnpm --filter demo-host dev` | **nothing** (only `docs/archive/**` mentions it) |

Four distinct problems, and none of them are "too many files":

1. **No axis.** Build steps, code generators, CI gates, long-running dev servers, machine installers and the release script are one flat list. You cannot tell what is safe to run twice from what rewrites tracked files.
2. **Extension = accident.** `.mjs` (plain node), `.mts` (needs `tsx`), `.ts` (`mma-init`), `.sh` — chosen per author mood, so `pnpm exec tsx scripts/x.mjs` and `node scripts/y.mts` both appear in docs.
3. **Names describe verbs inconsistently** (`generate-skill` vs `check-skill` vs `sync-skill` vs `vendor-undraw` vs `mma-init`), and the public `pnpm` names use both orders: `build:ui` (verb:object) vs `gen:skill` (object:verb).
4. **The real cost of any change is invisible.** Renaming one file touches, today: 11 tracked files mentioning `gen:skill`, 4 hardcoded script paths inside **user-facing error strings in `packages/host/src` / `packages/sdk/tests`**, a **relative import from a vitest file**, two npm lifecycle hooks in `packages/dsh/package.json`, CI, and the generated banner embedded in **133 contract files**.

`run-demo.sh` is the proof: it has no caller at all and nobody noticed, because nothing checks reachability.

## 2. Proposed layout — axis = lifecycle stage

Directory answers "when do I run this and what does it touch"; the file name answers "to what".

```
scripts/
 README.md # generated index (see §5) — never hand-edited
 build/ # repo source → repo/package artifacts, safe to re-run
 ui.mjs
 sdk.mjs
 gen/ # rewrites TRACKED files → must be followed by a diff check
 skill/
 index.mjs # entry: pnpm gen:skill
 extract.mjs # TS AST → component records (props provenance, L1 families)
 render.mjs # records → catalog.md / contracts/*.md / ai/catalog.json
 families.mjs # loads packages/ui/catalog-families.json
 scripts-readme.mjs
 check/ # read-only gates; non-zero exit means "fix the tree"
 skill.mjs
 templates.mts
 scripts.mjs # NEW: see §5
 dev/ # local loop, may hold ports / mutate only runtime dirs
 react-host.mts
 demo-templates.mts
 dsh-switch.mts
 setup/ # mutates the machine (~/.dsh, host.json), not the repo
 install-dsh-plugin.sh
 host-config.mts
 release/
 publish.mts
```

Notes on the two judgement calls inside this shape:

- **`generate-skill.mjs` gets split, not just moved.** 1,229 lines mixing TypeScript-AST extraction, taxonomy loading and three markdown/JSON renderers is why every fix to it today is risky. The `gen/skill/` module split is mechanical (the file already has those sections) and each part gets a reviewable size.
- **Redundancy is dropped**: `build/ui.mjs`, not `build/build-ui.mjs` — the directory is the verb, so the name is the object. Exception: `gen/skill/index.mjs` where the stage owns a multi-file tool.

Rejected alternative: grouping by subject (`skill/`, `ui/`, `dsh/`). It reads nicely for one file and breaks immediately — `check/skill` and `gen/skill` are the same subject in different stages, and the thing an operator actually asks is "is this safe to run / does CI run it".

## 3. Naming rules

| Rule | Rationale |
|---|---|
| **No file directly in `scripts/`.** | Forces a stage decision; enforced by the gate. |
| `<stage>/<verb-less-object>.<ext>`, kebab-case, singular nouns | Paths read as sentences: `check/skill`, `build/ui`. |
| Extension by runtime: `.mjs` plain Node (default), `.mts` only when it needs TS types or imports `@monkey-mini-app/*` (run with `tsx`), `.sh` only when it must drive a shell/machine (`dsh`, symlink farms). **No bare `.ts`.** | The extension then tells you the run command; docs stop saying `pnpm exec tsx` for plain-JS files. |
| Every script starts with a fixed header block: `Purpose` / `Inputs` / `Writes` / `Side effects: none \| repo \| runtime-dir \| machine` / `Run as: pnpm <name> \| manual: <when>` / `Deadman:` (what breaks if it's wrong) | Machine-readable enough for the index and the gate; human-readable enough to stop opening files. |
| Reachable or flagged: a script must be referenced by `package.json`, CI, another script, or a lifecycle hook — or carry `Run as: manual:` with a reason | Kills `run-demo.sh` silently rotting again. |
| Prefer calling via `pnpm <name>` in docs, comments and other scripts; never hardcode a `scripts/**` path in a string a user sees without also adding it to the gate's path check | Today 4 user-facing error strings embed script paths. |

## 4. Public command surface

Recommendation: **rename the pnpm scripts to a single order — `verb:object`** — and keep temporary aliases for one cycle, because 11 tracked files say `gen:skill`:

| Now | Proposed | Alias to keep temporarily |
|---|---|---|
| `build:ui`, `build:sdk` | unchanged | — |
| `gen:skill` | `gen:skill` | `gen:skill` |
| `check:skill` | `check:skill` | `check:skill` |
| `skill` (gen + check) | `skill` (unchanged: stage bundle) | — |
| `check:templates` | `check:templates` | `check:templates` |
| `react-host` | `dev:host` | `react-host` |
| `dsh:debug` / `dsh:prod` | `dev:dsh-debug` / `dev:dsh-prod` | — (only LOCAL.md uses them) |
| *(new)* | `gen:readme`, `check:scripts` | — |
| `publish:prep`, `publish`, `publish:packages` | unchanged | — |

Aliases are the only way to rename without a docs stampede; the gate reports alias usage so the next cycle can delete them. If you prefer zero aliases, the sweep is §6 and everything in-repo is updated in the same commit (docs outside the repo are not, which is the actual argument for aliases).

## 5. Gate (dropped) — conventions in `scripts/README.md` instead

Rules, all derived from the filesystem and headers (no hand-maintained list):

1. **Placement** — no file directly under `scripts/`; directory name ∈ known stages.
2. **Header contract** — every script has the required header fields; `.ts` extension is rejected; `.mts` must actually import TS-typed things (else demote to `.mjs`).
3. **Reachability** — every script is referenced by root/`packages/*/package.json`, CI, another script, or is declared `Run as: manual:`; otherwise "dead script" (this is what catches the next `run-demo.sh`).
4. **Path integrity** — every `scripts/<path>` mention in tracked text (`*.md`, `*.json`, `*.ts`, `*.mjs`, `*.mts`, `*.sh`, CI) resolves to an existing file. **This is the rule that makes a rename safe**: a stale `node scripts/build/ui.mjs` inside a host error string fails CI. Excludes `docs/archive/**` and `apps/dsh-host/registry/**` (installed copies of published packages — they legitimately mention old names).
5. **Index freshness** — `scripts/README.md` equals `gen:readme` output (same trick as the skill contract: CI regenerates and `git diff --exit-code`).
6. **Stage discipline** (optional, v2) — files under `gen/` must declare `Writes:`; files under `check/` must not write anything (verifiable by asserting the script never calls `writeFileSync`).

Wire into CI next to `pnpm check:skill`, and into `pnpm test` via a `packages/smoke-test/scripts-consistency.test.ts` that invokes it, so the invariant holds even when someone runs only tests.

## 6. Reference sweep (the actual work, in order)

`git mv` for every move to preserve history, then update:

1. **Root `package.json`** — all script paths + the §4 renames and aliases.
2. **`packages/*/package.json` lifecycle hooks** — `packages/dsh` (`prepack`/`postpack` → `gen/skill/copy.mjs`, currently `sync-skill.mjs`), `packages/ui` / `packages/sdk` (`prepack` → `build/ui.mjs`, `build/sdk.mjs`).
3. **`.github/workflows/ci.yml`** — `gen:skill` → `gen:skill`, add `check:scripts`.
4. **User-facing strings in code (highest risk, invisible to grep-and-pray)** — `packages/host/src/compile/ui-compiler.ts:103,137`, `packages/host/src/compile/app-css.ts:59`, `packages/sdk/tests/dist-abi.test.ts:12`.
5. **Cross-script calls** — `dev/react-host.mts` → `dev/demo-templates.mts`; `setup/install-dsh-plugin.sh` → `build/ui.mjs`, `build/sdk.mjs`, `setup/host-config.mts`.
6. **Test import** — `packages/dsh/tests/mma-init.test.ts` imports `../../../scripts/setup/host-config.mts` → `../../../scripts/setup/host-config.mts`. *(Also worth deciding: `writeHostConfig` may belong in `packages/dsh/src` with the script as a thin CLI — a script imported by production tests is a smell. Out of scope here, flagged in §8.)*
7. **Generated banner constant** — `gen/skill/` writes `<!-- generated by scripts/gen/skill/index.mjs … -->`; after the change, run `pnpm gen:skill` once (dirties 133 contracts + catalog + `ai/catalog.json` in one mechanical commit).
8. **Docs / instructions** — `AGENTS.md` (11 mentions of `gen:skill`, `build:ui`, `sync-skill`, `vendor-undraw`, `install-dsh-mini-app.sh`, `mma-init`, `publish.mts`), `LOCAL.md`, `docs/README.md`, `docs/contracts/skill-sync.md`, `docs/architecture/overview.md`, `docs/rfcs/pi-extension-port.md`, `packages/ui/README.md`, `TODO.md`.
9. **The skill** — `references/troubleshoot.md` (mentions the build commands), `references/catalog.md`/`contracts/*` (regenerated by 7), and `scripts/check/skill.mjs`'s own rule sources (`tool-catalog`/`taxonomy` read `packages/...` paths, not scripts, so unaffected) — but `check/skill.mjs` hardcodes `scripts/check/skill.mjs`? verify during the sweep; the path-integrity rule covers it.
10. **Data files with prose references** — `packages/ui/catalog-families.json` `$comment`.

Not touched: `docs/archive/**`, `apps/dsh-host/registry/**`, `apps/dsh-host/.dsh/**` (runtime copies), `packages/*/dist|lib`.

## 7. Commit plan (each independently reviewable and green)

1. **Headers + gate in report-only mode.** No moves. Immediately surfaces: `run-demo.sh` unreachable, any missing header, and the full reference graph. *(Also the cheapest moment to fix headers while each file is still familiar.)*
2. **Split `generate-skill.mjs` into `gen/skill/{index,extract,render,families}.mjs`.** Behaviour-neutral; verify by `pnpm gen:skill && git diff --exit-code skills packages/ui/ai` — the generated output must be byte-identical to step 1's.
3. **Move by stage** (`build/` → `gen/` → `check/` → `dev/` → `setup/` → `release/`) with the §6 sweep per group; gate stays report-only.
4. **Rename `pnpm` scripts + add aliases**; docs point at `pnpm` names only.
5. **`gen:readme` + `scripts/README.md`**, flip the gate to failing, add both to CI.
6. *(Next cycle, after aliases have had time to be noticed as unused)* delete aliases.

Step 2 before step 3 on purpose: splitting while the file is one familiar unit is easier than splitting it after it moved and the diff is noisy.

## 8. Open questions for you

1. **Layout axis** — stages as in §2, or do you want subject-first (`skill/`, `ui/`, `dsh/`)?
2. **Alias policy for `pnpm` names** — one cycle of aliases (§4), or hard rename in one commit?
3. **`run-demo.sh`** — delete (it duplicates `pnpm --filter demo-host dev`), or wire it as `dev:gallery`?
4. **`mma-init`** — keep as `setup/host-config.mts`, or move `writeHostConfig` into `packages/dsh/src` (it is imported by a dsh test, and its logic is host-config bootstrapping, which the dsh adapter already owns)?
5. **Stage discipline rule v2** (`check/*` must not write files) — worth having, or over-engineering for a 14-file folder?
6. **`dev-react-host` vs `apps/demo-host`** — `demo-templates.mts` seeds demo apps for the dev host; is that a script or part of `apps/demo-host`? I lean script (it touches `runtime/`), but it is the weakest placement in this proposal.
