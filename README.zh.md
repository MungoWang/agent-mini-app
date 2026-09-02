# monkey-mini-app

[English](README.md) | 中文

**面向 AI 的小程序平台**：agent 一轮就能生成真正的 React 应用、在本机跑起来、并继续使用。
产品是平台本身（runtime + 面板 + SDK）。Agent 壳（今天是 dsh，之后是 pi）只是 adapter。

![home](docs/assets/home.png)

## 为什么做这个

**Agent 原生创作。** skill + `mini_app_*` 工具 + SDK 里的 UI 套件，让模型不用自造技术栈就能搭出高质量 app（`manifest.json` + `ui.tsx` + `main.api.ts`）。图标、表格、图表、编辑器已在 `@monkey-mini-app/sdk`。

**小程序是工作单元——而且能回调模型。** 每个 app 都是可热重载的小程序。`main.api.ts` 拿到的是宿主 `ctx`，不是玩具沙箱：

| `ctx.*` | 小程序能做什么 |
|---------|----------------|
| `http` / `bash` / `tool`（MCP） | 网络、本机、已有工具 |
| `llm` / `agent` | **从 app 里**调模型或拉起子 agent |
| `storage` | 数据落在这台机器上 |

这条环路——agent 做出 app，app 再调 `ctx.llm` / `ctx.agent`——才是重点。

**统一管理面板。** 画廊、打开/钉住/侧栏、主题、历史、存储、重载。每个宿主同一套 chrome。

**宿主无关。** `createHost(capabilities, lifecycle)` + `PanelHost`。dsh web 是已发布的 adapter；pi / pi-web 是下一个（[RFC](docs/rfcs/pi-extension-port.md)）。`host` / `panel` / `sdk` 不依赖 dsh。

![apps](docs/assets/apps-list.png)
*dsh adapter 里的画廊——实现接缝的任何宿主都能跑同一批 app。*

![side](docs/assets/sidebar-mode.png)
*钉在侧栏：左对话，右小程序。*

## 小程序长什么样

```tsx
// ui.tsx
import { Button, useApp } from "@monkey-mini-app/sdk";

export default function Ui() {
  const { call } = useApp();
  return <Button onClick={() => call("ping")}>ping</Button>;
}
```

```ts
// main.api.ts
import { defineApp } from "@monkey-mini-app/sdk";

export default defineApp({
  name: "Ping",
  description: "one-line app",
  api: { ping: async (ctx) => ctx.appId },
});
```

前后端只 import 一个包：`@monkey-mini-app/sdk`（UI 额外可用 `react`）。
辅助代码放 `ui/`（仅 UI）、`api/`（仅后端）、`shared/`（同构纯净，两边都行）；
相对路径不得跳出 app 目录。
创作 skill：`skills/monkey-mini-app/`。

## 试用

只跑平台（不接 agent 壳）：

```bash
pnpm dev:host # Vite :5174 · apps host :17900
```

接到 dsh web（当前 adapter）：

```bash
dsh plugin --profile web add @monkey-mini-app/dsh-mini-app
dsh web --no-open # :3080 · apps host :17880
```

重启 `dsh web` → **小程序**。不用再装别的 npm 包。

## 开发

**[LOCAL.md](./LOCAL.md)** · **[AGENTS.md](./AGENTS.md)** · **[docs/README.md](./docs/README.md)**

| 包 | 角色 |
|----|------|
| `host` | 平台：apps、git、HTTP、编译、`mini_app_*`、`ctx.*` |
| `panel` | 管理面板（`PanelHost`） |
| `sdk` | 小程序 ABI；iframe `/mma/runtime.js` + `/mma/sdk.js` |
| `ui` | 组件库（打进 SDK） |
| `dsh` | dsh adapter（插件 + skill） |

## License

MIT
