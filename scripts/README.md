# `scripts/`

Repo automation, grouped by **lifecycle stage**. Directory = when to run it and what it touches; filename = the object.

```
scripts/
 build/ repo source → package artifacts (safe to re-run)
 gen/ rewrites TRACKED files (commit the diff)
 check/ read-only gates — non-zero exit means fix the tree
 dev/ local loop (ports / temp runtime dirs)
 setup/ mutates the machine (~/.dsh, host.json), not the repo
 release/ npm publish
```

No file sits directly under `scripts/`. If you are about to add one, pick a stage first.

## Conventions

| Rule | Detail |
|---|---|
| Naming | `<stage>/<object>.<ext>`, kebab-case, singular nouns. The directory is the verb — do not write `build/build-ui.mjs`. |
| Extensions | `.mjs` = plain Node (default). `.mts` = needs TypeScript types or imports `@monkey-mini-app/*` (run with `tsx`). `.sh` = drives a shell/machine only. No bare `.ts`. IDE types for `.mts` come from `scripts/tsconfig.json` (`@types/node`). |
| Header | Every script starts with a block listing `Inputs` / `Writes` / `Side effects: none \| repo \| runtime-dir \| machine` / `Run as`. Prefer calling via `pnpm <name>` in docs. |
| Reachability | A script must be reachable from `package.json`, CI, another script, or a package lifecycle hook — or its header must say `Run as: manual: …` with a reason. Dead scripts get deleted. |
| Hardcoded paths | Prefer `pnpm <name>` in docs and comments. If a user-facing error string embeds a `scripts/...` path, update it in the same change as any rename. |

## Index

| Path | Run as | Writes | Side effects |
|---|---|---|---|
| `build/ui.mjs` | `pnpm build:ui` (also ui `prepack`) | `packages/ui/dist/**` | repo build output |
| `build/sdk.mjs` | `pnpm build:sdk` (also ui `prepack`) | `packages/ui/dist/{runtime.js,sdk.js,vendors/lodash.js}` | repo build + `node_modules/.cache` (esm.sh fetched once per React version; `--force` / `--refresh` / `--offline`) |
| `build/api.mjs` | `pnpm build:api` (also api `prepack`) | `packages/api/dist/index.js` | repo build |
| `gen/skill/index.mjs` | `pnpm gen:skill` | `skills/.../references/**`, `packages/ui/ai/catalog.json` | repo tracked files |
| `gen/skill/copy.mjs` | dsh `prepack` / `postpack` | `packages/<adapter>/skills/monkey-mini-app/` | packing scratch copy |
| `gen/examples.mjs` | `pnpm gen:examples` (in `pnpm verify`) | `apps/dsh-host/fixtures/com.example.kit/lib/**` | repo tracked fixture |
| `build/api.mjs` | `pnpm build:api` (also api `prepack`) | `packages/api/dist/index.js` | repo build |
| `gen/illustrations.mjs` | manual — only when changing illustrations | `packages/ui/src/lib/illustrations.tsx` | repo tracked source |
| `check/skill.mjs` | `pnpm check:skill` | nothing | exit 1 on drift |
| `check/templates.mts` | `pnpm check:templates` | `packages/dsh/.tpl-check/` (deleted after) | temp dir |
| `check/typecheck-all.mjs` | `pnpm typecheck` | nothing | exit 1 if any tsconfig disagrees (root aggregate + every package + skill templates) |
| `check/verify.mjs` | `pnpm verify` | build dists + may rewrite skill contracts | repo build + skill gen |
| `dev/react-host.mts` | `pnpm dev:host` | temp runtime dirs | two local processes |
| `dev/demo-templates.mts` | internal (spawned by `dev/react-host`) | OS temp workspace | host process on a port |
| `dev/dsh-switch.mts` | `pnpm dev:dsh-debug` / `dev:dsh-prod` | `~/.dsh/profiles/web/**` | machine (`pnpm install`) |
| `dev/dsh-switch.lib.mts` | imported by switch CLI + test | nothing | none |
| `dev/dsh-switch.test.mts` | `pnpm test:dsh-switch` | nothing | none |
| `setup/install-dsh-plugin.sh` | manual — developer machine only | `~/.dsh/profiles/web/**` | machine (path-link + install) |
| `setup/host-config.mts` | `pnpm exec tsx scripts/setup/host-config.mts` | `runtime/host.json` | runtime dir |
| `release/publish.mts` | `pnpm publish:packages` | package versions (with `--bump`) | npm publish (irreversible) |

`gen/skill/` is split: `constants.mjs` (vocabulary), `families.mjs` (taxonomy file), `extract.mjs` (source → records), `render.mjs` (records → artifacts), `index.mjs` (CLI).

## Public `pnpm` names

Canonical form is **`verb:object`**:

| Command | Purpose |
|---|---|
| `pnpm gen:skill` | regenerate skill contracts |
| `pnpm check:skill` | skill ↔ code gate |
| `pnpm check:templates` | type-check skill templates |
| `pnpm gen:examples` | publish ui-examples into the dsh e2e fixture app |
| `pnpm format:examples` / `check:format` | prettier over `packages/ui-examples` (the check runs inside `pnpm verify`) |
| `pnpm skill` | gen then check |
| `pnpm verify` | **post-refactor one-shot**: build ui/sdk/api → skill → templates → lint → tsc → tests → dsh build |
| `pnpm verify:coverage` | `verify` + `test:coverage` (host/panel/dsh ≥85% lines; kit ≥40% lines floor) |
| `pnpm build:ui` / `build:sdk (iframe → ui/dist)` | package dist |
| `pnpm dev:host` | Vite + demo host |
| `pnpm dev:dsh-debug` / `dev:dsh-prod` | path-link vs published dsh profile |
| `pnpm publish:packages` | e2e then npm publish |


## Adding a script

1. Pick a stage directory. If it rewrites tracked files → `gen/`. If CI should fail on bad output → `check/`. If it only builds artifacts → `build/`.
2. Name it `<object>.<ext>` and fill the header fields.
3. Wire it from a `package.json` script (or mark `Run as: manual:`).
4. Update this README's index table in the same change.
5. Never put a new file at `scripts/` root.

Background and the rejected alternatives: [`docs/rfcs/scripts-layout.md`](../docs/rfcs/scripts-layout.md).
