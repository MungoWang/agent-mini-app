# TODO / 交接 — 修复 dsh 插件装完就跑不起来的依赖问题（2026-08-31）

## ⭐ 核心问题
**`@monkey-mini-app/dsh-mini-app` 用 `dsh plugin --profile web add` 装完后，host 无法编译 mini-app 的 UI，插件跑不起来（报错）。
TypeError: Failed to fetch dynamically imported module: http://127.0.0.1:17880/api/app/com.deepseek.capabilitylab/ui/entry.js

## 我们的核心点就几个
 1. dsh 安装包不能太大，<10M                                                          
 2. 用正规途径解决依赖问题，我不希望用手写依赖的方式来做，不利于将来的维护 
 3. 一些不常用并且又大的包，可以用 cdn 来按需引用 
 4. 如有需要我们可以把一些公用依赖生成到一个统一的vendor js。跟 per app js 分开。至于什么时候生成是在build package 还是在runtime，可以根据我们的最佳实践来做取舍。


## 初步检查
** 经过AI初步分析根因是**依赖没装齐/解析不到**。以下分析内容可能不准确，所以我们需要自己确认！

具体两个已定位的坑：
1. **`@monkey-mini-app/ui` 子路径解析失败**：ui 包 `dist/src/*` 内部用 `@monkey-mini-app/ui/<subpath>` 互引，经 exports `"./*": "./dist/src/*"` 映射到**无扩展名**路径，Node/esbuild 在 hoisted npm 装下不补扩展名 → `Could not resolve "@monkey-mini-app/ui/products/..."`（244 个错）。
2. **`react-is` 缺**：`recharts`（图表组件用的）把 `react-is` 声明为 **peerDependency**，而 dsh profile 的 `pnpm-workspace.yaml` 是 **`autoInstallPeers: false`** → `react-is` 不装 → host 编译时 `Could not resolve "react-is"`。

**目标：让 `dsh plugin add` 装完就能正常打开/编译/运行任一 mini-app。**

## 已修的状态（HEAD = `8fcf304` 已提交） -- 这些修复也都是 AI 自己做的，但可能也存在问题。
- **host 0.1.3（已发布）**：ui-compiler 加**子路径 resolver**（`@monkey-mini-app/ui/<subpath>` → `distDir/src/*`，补扩展名）→ **坑 1 已解决**。
- **`8fcf304`（已提交）**：ui 把 `shiki / @codemirror/* / @uiw/react-codemirror / @tiptap/* / @lezer / prosemirror` 从 `dependencies` → `devDependencies` + `peerDependencies`（**减轻安装体积**）；编辑器/高亮组件改 **CDN + 原生降级**（CodeBlock→纯 `<pre>`、CodeEditor/RichTextEditor→原生 textarea→CDN、JqlInput→原生）。**这些是好的、要保留。**
- **未提交但正确（保留）**：`scripts/publish.mts`（修 `.publish-smoke` 非法包名）；`packages/panel/package.json` version 0.1.1。
- **已回退/删除**：之前尝试的「统一 vendor 路线」（host external react/ui + importmap + `/mma-ui/vendor.js` 路由 + `vendorPath` 透传 + `dsh/src/vendor.ts` + `build-vendor.mjs`）。**那条线有一个未解阻塞**（esbuild 对 re-export-only entry + bundle 不重发射出导出，`react does not provide 'useMemo'`）。**接手时不要基于这些半成品**。

## 还差的核心（难点）
**坑 2（`react-is`）还没修** —— 装完后 host 编译 app UI 仍报 `Could not resolve "react-is"`。这是**让插件「装完能跑」的最后一块**。

## 解决原则（用户定的，按此择优）
1. **dsh 安装包 < 10M**。
2. **用正规途径**，**不手写/手动声明依赖**（不利于维护）。
3. **不常用且大的包 → CDN 按需引用**。
4. **允许公用依赖生成统一 vendor js，跟 per-app js 分开**；build 时生成还是 runtime 生成按最佳实践取舍。

## 推荐方向（满足原则 2，能根治坑 2）
- **统一 vendor 自包含**（build package 时生成）：把 `react + @monkey-mini-app/ui`（含 recharts→react-is 等 peer）在**构建期内联成一个自包含 `vendor.js`**；host 把 `react` + `@monkey-mini-app/ui` **external** 到 vendor（importmap + `/mma-ui/vendor.js` 路由 + dsh 传 `vendorPath`）；运行时 app 编译**不再解析 ui 依赖树** → `react-is`/peer 全内联，**零手写依赖**。
  - **必须先修：esbuild 不重发射出 entry 导出的问题**（`export * from "react"` / `export { useMemo } from "react"` + `bundle:true` 不 emit `export{}`）。试法：`import * as React` + 显式 `export { … }`；或 `format:"esm"` 去掉 `platform:"browser"`；或 `splitting:true`；或 esbuild `banner`/`footer` 手动追加 `export{…}`。**让 `vendor.js` 真正 `export { useMemo, useState, createRoot, Card, … }`。**
- 备选（仅当 vendor 实在绕不过，且与原则 2 有冲突）：**host 从 node_modules 解析** + 把 `react-is` 加进 `@monkey-mini-app/ui` 的 `dependencies`（手工声明，兜底）。

## 体积数据
- 单独 esbuild 打 `react + @monkey-mini-app/ui`（编辑器已 CDN）vendor ≈ **2.4MB**（含 react-is）→ **满足 <10M**。
- 若 `splitting:true` 且只打高频 → 主 vendor.js ≈ 3.4MB + 懒 chunk。

## 别忘
- **核心判定**：装完 `dsh plugin add` → 起 dsh web → 打开「能力实验室」「AI 热点雷达」→ **能正常渲染**（无 `Could not resolve` / `does not provide` 报错）。
- dev 验证：repo 里 `dsh web --no-open`（走 dsh:debug link）。
- publish 验证：`pnpm publish:packages --bump patch` → 干净目录 `dsh plugin --profile web add @monkey-mini-app/dsh-mini-app` → 起 dsh web。
- 门禁：`pnpm lint` / `pnpm exec tsc -b` / `pnpm test:coverage`。注意 `packages/ui/src/index.ts` 的「node16 需要扩展名」是**既有**报错。
