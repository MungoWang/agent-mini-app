# Loader

Host 在服务端即时编译：**后端**用 sucrase 编译 `main.api.ts` / `lib/*.ts`；**前端 UI** 用 esbuild-wasm 把 `ui.tsx` 连同用到的组件打包成单个 ESM bundle（tree-shake，按 app 裁剪组件库）。

## 后端（main.api.ts / lib/*.ts）

- `import { defineDashboard } from "@monkeyagent/dashboard"`
- `import { foo } from "./lib/foo"`（也可 `./components/...`）
- TypeScript 随意（sucrase：参数类型、`{ title: string }`、`catch (e: any)` 都可以）
- `export default defineDashboard(...)`
- `lib/` 里 `export function` / `export const` / `export async function`

## 前端（ui.tsx）

- `import { Button, DataGrid, ... } from "@monkey-mini-app/ui"` —— 组件库（已内置图标/图表/编辑器依赖，不要额外 import npm 包）
- `import { useDashboardApi } from "@monkeyagent/host"` —— host 注入的 hook，只返回 `{ call }`
- `import { useState } from "react"` —— React 19（host 注入）
- `import { foo } from "./lib/foo"` —— 相对 app 内文件，随 bundle 一起打包
- 布局用 Tailwind classes（`flex flex-col gap-3` 等）

## 禁止（编译即报错，不要绕）

- npm 包：`recharts`、`lucide-react`、`rss-parser`、`openai`、`node-fetch`…（组件库已内置）
- Node 内置：`fs`、`http`、`path`…
- 逃出 app 目录的 `../` 出界（前端 `./lib` 同理）
- UI `import main.api.ts`（要数据走 `call`）

抓网页用 `ctx.http("https://…", { timeout: 8000 })`，看 `r.ok` / `r.text` / `r.json`；解析写在 `./lib`。本机命令才 `ctx.bash`。

改 `ui.tsx` / `main.api.ts` / `lib/*.ts` 会按 mtime 重新编译。RSS + lib 完整例子见 `templates/insights/`。
