# 任务归档：ui-examples 包（Phase 1/2）

> 归档日期：2026-09-05 · 落地日期：2026-09-03 · 原位置：`TODO.md`
> 现状：`gen:skill` 已把 examples 写进 `references/examples/`，`gen/examples.mjs` 已产出 dsh e2e fixture。
> 未闭环：`packages/ui-examples/src/areas/*.tsx` 仍在（gallery 分组），是否继续拆按需再开。

---

## ui-examples package (Phase 1 landed)

`packages/ui-examples` — portable examples (react + bare `@monkey-mini-app/ui` + relatives),
enforced by eslint `no-restricted-imports`; typechecked in `pnpm verify`. Component link is
the `@exampleOf` JSDoc tag, not the folder name.

Phase 2 (not started):

- decompose `areas/*.tsx` showcases into `components/<Name>/<name>-NN.tsx`
- Icon-ize `apps/demo-host/.../paradigms` and move them in (drops lucide)
- `gen/skill`: copy examples into `references/examples/`, link from `contracts/<slug>.md`
(inline if small, else link — respect the 8KB contract cap), build `examples/<group>.md`
for `@group` files; validate `@exampleOf` resolves in `check:skill`
- `gen/examples`: byte-copy selected files into `com.example.kit/lib/` for dsh e2e

