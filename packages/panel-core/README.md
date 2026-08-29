# @monkey-mini-app/panel-core

mini-app 面板的 **UI 核心**（纯 React，零宿主假设）。宿主实现 `MiniAppAdapter` → `createMiniAppPanel(adapter)` → 完整面板（tabs / 主题 / 搜索 / 浏览 / 设置 / 模态）。

## 三层抽象

```
┌─────────────────────────────┐
│ host-shell（宿主壳）          │  dsh：client.ts 协议壳 + 布局 + iframe
│                              │  PI：扩展 slot / 窗口
├─────────────────────────────┤
│ host-adapter（能力接缝）      │  MiniAppAdapter 实现（数据/iframe/持久化）
├─────────────────────────────┤
│ panel-core（本包，零宿主）    │  React 组件 + store + 主题 + 默认行为
└─────────────────────────────┘
```

**边界铁律**：core 不得出现任何宿主字符串/API/文案（dsh 路径、`/api/...`、空态文案等一律走 adapter）；宿主不得 import `panel-core/src/*`（只走 package exports：`@monkey-mini-app/panel-core`）。

## 快速接入

```tsx
import { createMiniAppPanel } from "@monkey-mini-app/panel-core"

const panel = createMiniAppPanel({
  listApps: () => fetchApps(),            // 数据
  frame: { url, mount, unmount, reload }, // iframe 内容
  openPanel, closePanel,                  // 面板生命周期
  persistTheme: (t, p) => save(t, p),     // 可选
  history, storage, config, deleteApp,    // 可选能力
})

panel.mount(el)   // 挂载（core 自注入样式 + 渲染）
panel.open()      // 宿主入口按钮 → adapter.openPanel
panel.close()
panel.actions.fetchApps()  // 手动刷新列表（核心动作）
```

## MiniAppAdapter 能力表（均可选）

| 字段 | 类型 | 有 → core 行为 |
|---|---|---|
| `listApps` | `() => Promise<AppItem[]>` | 列表 / 搜索 / 卡片 |
| `frame.*` | mount/unmount/reload/url | tab 切换显示 iframe |
| `openPanel/closePanel` | `() => void` | 生命周期（宿主动画/布局） |
| `persistTheme?` | `(theme, palette) => void` | 全局主题持久化 |
| `palettes?` | `() => Promise<Palette[]>` | 自定义主题（合并进主题 pop） |
| `appTheme?` | `{save, clear}` | 「当前小程序」作用域主题 |
| `history?` | `{list, detail}` | 历史按钮 + 浏览面板 |
| `storage?` | `{listTables, readTable}` | 存储按钮 + 浏览面板 |
| `config?` | `{load, save}` | 设置表单 |
| `deleteApp?` | `(id) => Promise<void>` | 删除（无则隐藏） |
| `emptyText?` | `string` | 空态文案（默认通用） |

不实现的能力 → 对应按钮/入口自动隐藏（core `capabilitiesOf`）。

## core 提供 / 宿主负责

**core**（本包）：全部 React 组件、store（`usePanelState`）、`PALETTES`/`TOKENS`/`applyThemeTo`（8 套内置主题）、`createPanelActions`（tabs/主题/搜索/浏览/设置/模态的纯状态流转）、样式注入 `injectPanelCss`。

**宿主**：数据来源、iframe 内容、面板容器/布局动画、主题持久化、自定义主题来源、宿主自身 UI 集成（入口按钮/侧栏）。

## 主题系统

- `PALETTES`（8 套，含 label + swatch，ThemePop 直接用）
- `TOKENS`（每套 light/dark 完整 TokenSet）
- `applyThemeTo(el, theme, palette, custom?)` → 写 CSS 变量 + data-theme/data-palette + bg/fg
- 宿主 `persistTheme` 只管持久化；应用由 core `actions.setAppearance` 完成

## 目录

```
src/themes.ts     主题系统（PALETTES/TOKENS/applyThemeTo）
src/store.ts      useSyncExternalStore 单例 store
src/context.tsx   MiniAppActionsProvider（actions 注入）
src/actions.ts    createPanelActions（默认行为，宿主零重复）
src/adapter.ts    MiniAppAdapter 类型 + capabilitiesOf
src/panel.tsx     createMiniAppPanel（一行接入）
src/components/   MiniAppPanel/Tabs/Toolbar/ThemePop/AppList/Settings/Browse/Modal/Loading
```

## 测试

```bash
pnpm --filter @monkey-mini-app/panel-core test   # 或仓库级 pnpm test
```
