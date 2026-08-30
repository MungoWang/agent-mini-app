# 本地开发

## 安装 / 更新 dsh 插件

```bash
bash scripts/install-dsh-mini-app.sh
dsh web --no-open          # http://127.0.0.1:3080 ；apps host :17880
```

脚本会：构建 `ui` + `dsh` bundle、path-link 进 dsh web profile、bootstrap `host.json`（若不存在）。

仅重写配置：

```bash
pnpm exec tsx scripts/mma-init.ts
```

## 日常改码

```bash
# 改 host / panel / dsh 源码后
pnpm --filter @monkey-mini-app/dsh-mini-app build
# 重启 dsh web，浏览器硬刷新

# 改组件库
node scripts/build-ui.mjs
pnpm skill:gen   # 可选：刷新 UI skill 契约
```

## 测试

```bash
pnpm lint
pnpm test
pnpm exec tsc -b
```

## 文档

统一入口：[`docs/README.md`](./docs/README.md)。不要在仓库根另起长文。

## 常见问题

1. **缺 host.json** — 跑 `install-dsh-mini-app.sh` 或 `mma-init.ts`。
2. **主题刷新丢失** — 确认 apps host 已更新（`POST /api/host-config`）；硬刷新浏览器。
3. **旧包名** — `dsh-plugin` / `host-core` / `panel-core` 已删除；见 tag `archive/pre-cutover-legacy-2026-08-29`。
