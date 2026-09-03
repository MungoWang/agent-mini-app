# TODO

Platform runtime/SDK, react-host, and the dsh-host install gate are landed. See `docs/architecture/overview.md`, `LOCAL.md`.

## Authoring protocol unification

硬切完成：两侧统一 `@monkey-mini-app/ui`（backend 注入 `defineApp`）、`ui/` `api/` `shared/` 互斥 + app 根边界、旧名（`@monkeyagent/*` / `defineDashboard` / `useDashboardApi`）删除。见 [`docs/rfcs/authoring-protocol.md`](docs/rfcs/authoring-protocol.md)。

**阶段 2（约定未开工，另开干净 PR）— S2 包面拆分：**
- 前端作者面 → `@monkey-mini-app/ui`（合并今天的 sdk：`useApp` + kit + iframe bundle）
- 后端作者面 → 新包 `@monkey-mini-app/api`（只 `defineApp` + 类型；运行时 host 注入或 esbuild 打包）
- 然后后端执行层改为 esbuild 打包（删 require 沙箱）→ 命名导出编译期失败，类型洞彻底堵上
- 动机：今天 backend `import { Button } from "@monkey-mini-app/ui"` 类型放行、运行时 `undefined`（已验证）

遗留（不阻塞）：

- 本地旧 import 小程序需按 skill 改（`mma-runtime/` gitignore）
- `shared/**` 纯同构无静态门禁
- panel 内部 `closeDashboard` 命名未改
- panel `host-shell.ts` 覆盖率拖低 threshold（与本协议无关的 WIP）

---

**Skill ↔ code 同步**：契约见 [`docs/contracts/skill-sync.md`](docs/contracts/skill-sync.md)（生成器 + `pnpm check:skill` 门禁）。待平台侧决定：`mini_app_unregister`（整 app 删除工具）；`packages/ui/src/index.ts` 未 re-export `lib/illustrations`（只靠 `build-ui.mjs` 注入 dist）；`manifest.permissions` 被 parse 但不校验。

Publish with `pnpm publish:packages` (runs `pnpm test:dsh` first; emergency `--skip-e2e`).


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
