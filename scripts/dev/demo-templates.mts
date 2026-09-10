/**
 * Demo host: register every skill template with fake-but-working capabilities so
 * the full UI renders and AI/bash buttons respond. Open the printed URLs.
 * Usage: pnpm tsx scripts/dev/demo-templates.mts [port]   (default 17900)

 * Inputs:       skills/monkey-mini-app/templates/**, argv[1] port (default 17900)
 * Writes:       a mkdtemp workspace under the OS temp dir
 * Side effects: starts a host process on a port
 * Run as:       internal — spawned by scripts/dev/react-host.mts
 */
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootstrapHostConfig, createHost, type HostCapabilities } from "@monkey-mini-app/host";

const port = Number(process.argv[2] || 17900);
const base = path.resolve("skills/monkey-mini-app/templates");
const TEMPLATES = ["minimal", "today", "board", "radar", "sheets", "runner", "chores", "watch"];

// Templates that need a library outside the platform surface (mini_app_install).
// The demo host installs them so `call("list")` on first paint does not hit BACKEND_IMPORT.
const NEEDS_PACKAGES: Record<string, { name: string }[]> = {
  sheets: [{ name: "exceljs" }],
};

function readTemplate(name: string) {
  const files: Record<string, string> = {};
  const walk = (d: string, pre: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      const rel = pre ? `${pre}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, rel);
      else files[rel] = readFileSync(full, "utf8");
    }
  };
  walk(path.join(base, name), "");
  return files;
}

// 演示能力：让 AI/bash 按钮能点，返回可读的假数据
const caps: HostCapabilities = {
  listTools: () => [],
  bash: async (_ctx, cmd) => {
    if (cmd.includes("df ")) return { stdout: "Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3s1 500000000 180000000 320000000 36% /", stderr: "", exitCode: 0 };
    // ps
    return { stdout: "  PID %CPU %MEM COMMAND\n  123  12.3  4.5 node server.js\n  456   3.2  1.1 chrome helper\n  789   1.0  0.8 dockerd", stderr: "", exitCode: 0 };
  },
  llm: async (_ctx, prompt) => {
    // insights digest vs jira worklog, tell them apart by the prompt shape
    if (prompt.includes("bullets")) {
      return JSON.stringify({ headline: "本周前端热点速览", bullets: ["React 19 正式稳定", "Vite 6 推进 Rolldown", "WebGPU 跨浏览器加速"] });
    }
    return JSON.stringify({ note: "处理看板拖拽状态未持久化，补充回归用例并已提交。" });
  },
  agent: async (_ctx, _goal, opts) => {
    const on = opts?.onEvent;
    if (on) {
      on({ type: "turn", phase: "start", turn: 1 });
      on({ type: "tool", phase: "start", name: "read", args: { path: "src/index.ts" } });
      on({ type: "tool", phase: "end", name: "read" });
      on({ type: "text-delta", text: "已汇总组件导出清单…" });
      on({ type: "turn", phase: "end", turn: 1 });
      on({ type: "done", text: "已汇总组件导出清单…" });
    }
    return "已汇总组件导出清单…";
  },
};

const root = mkdtempSync(path.join(tmpdir(), "mma-demo-"));
let services: any;
const host = createHost(caps, { attach: (_c, s) => { services = s; } }, {
  config: bootstrapHostConfig({ runtimeRoot: root, hostPort: port }),
  about: { adapter: "react-host", packageName: "@monkey-mini-app/host", env: "development" },
});
await host.apply();

for (const name of TEMPLATES) {
  const id = JSON.parse(readFileSync(path.join(base, name, "manifest.json"), "utf8")).id;
  await services.apps.register(id, readTemplate(name));
  // mini-app 的存储种子内置在 api 里，无需额外 seed
  const needs = NEEDS_PACKAGES[name];
  if (needs) {
    try {
      const out = await services.apps.installPackages(id, { packages: needs });
      if (!out.ok) console.warn(`[demo] ${name}: install failed — ${out.error ?? ""}`.slice(0, 200));
    } catch (cause) {
      console.warn(`[demo] ${name}: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
  }
}

console.log("\n==============================================");
console.log("demo host ready at http://127.0.0.1:" + port);
console.log("首页索引（点卡片进每个模板）：");
console.log("  → http://127.0.0.1:" + port + "/");
console.log("单个模板直达：");
console.log("==============================================");
for (const name of TEMPLATES) {
  const id = JSON.parse(readFileSync(path.join(base, name, "manifest.json"), "utf8")).id;
  console.log(`  ${name.padEnd(9)} → /app/${id}`);
}
console.log("tips: 任意页加 ?theme=dark 看暗色；每个模板源码有 // ⭐ 关键 注释\n");
process.stdin.resume();
