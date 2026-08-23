# Backend loader

Host: `compileAppSource` + 作用域 `require`。不要假设「零 import」。

## 允许

- `import { defineDashboard } from "@monkeyagent/dashboard"`
- `import { foo } from "./lib/foo"`（也可 `./components/...`）
- TypeScript：宿主用 sucrase（参数类型、`{ title: string }`、`catch (e: any)` 都可以）
- `export default defineDashboard(...)`
- `lib/` 里 `export function` / `export const` / `export async function`

## 禁止（会 throw）

- npm：`rss-parser`、`openai`、`node-fetch`…
- Node 内置：`fs`、`http`、`path`…
- 逃出 app 目录的 `../` 出界

抓网页用 `ctx.http("https://…", { timeout: 8000 })`，看 `r.ok` / `r.text` / `r.json`；解析写在 `./lib`。本机命令才 `ctx.bash`。`export function parseFeed` 可被 `import { parseFeed } from "./lib/parseFeed"` 直接用。

改 `main.api.ts` 或 `lib/*.ts` 会按 mtime 重新加载。RSS + lib 完整例子见 `templates/news/`。
