/**
 * Type-check every skill template (`packages/dsh/skills/monkey-mini-app/templates/**`).
 *
 * Templates import two host-virtual modules (`@monkeyagent/host` / `@monkeyagent/dashboard`)
 * that have no package — the host injects them at compile time — plus `@monkey-mini-app/ui`.
 * This script writes a throwaway `.d.ts` for the virtual modules + a throwaway tsconfig into
 * `packages/dsh/.tpl-check/`, runs `tsc`, then deletes the dir. Nothing is left in the repo
 * and no type declarations are added to the shipped packages.
 *
 * Usage: `pnpm tpl:check`
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tplDir = path.join(root, "packages/dsh/skills/monkey-mini-app/templates");
const dshDir = path.join(root, "packages/dsh");
const uiSrc = path.join(root, "packages/ui/src");

// Live inside the monorepo so tsc can resolve react + ui's deps via node_modules,
// but under a dot-dir that the script always deletes (finally).
const checkDir = path.join(dshDir, ".tpl-check");

const DECL = `declare module "@monkeyagent/host" {
  export type DashboardApiCall = <T = any>(method: string, args?: Record<string, unknown>) => Promise<T>;
  export interface DashboardApi { call: DashboardApiCall }
  export function useDashboardApi(): DashboardApi;
}

declare module "@monkeyagent/dashboard" {
  export interface DashboardCtx {
    appId: string;
    appDir: string;
    storage: {
      get(key: string): Promise<any>;
      set(key: string, value: unknown): Promise<void>;
      delete(key: string): Promise<void>;
      clear(): Promise<void>;
      table(name: string): any;
    };
    state: Record<string, unknown>;
    credentials: Record<string, string>;
    log(...a: unknown[]): void;
    push(method: string, params?: unknown): void;
    mcp(name: string, args?: Record<string, unknown>): Promise<any>;
    tool(name: string, args?: Record<string, unknown>): Promise<any>;
    listTools(): unknown[];
    llm(prompt: string, opts?: unknown): Promise<string>;
    agent(goal: string, opts?: unknown): Promise<string>;
    bash(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
    http(url: any, opts?: unknown): Promise<any>;
    system: { metrics(): Promise<any> };
    config: Record<string, unknown>;
    signal?: AbortSignal;
  }
  export function defineDashboard(def: {
    name: string;
    description?: string;
    entry?: string;
    api: Record<string, (ctx: DashboardCtx, ...args: any[]) => any>;
  }): void;
}
`;

rmSync(checkDir, { recursive: true, force: true });
mkdirSync(checkDir, { recursive: true });

try {
  writeFileSync(path.join(checkDir, "mmahost.d.ts"), DECL);

  const tsconfig = {
    compilerOptions: {
      target: "esnext",
      module: "esnext",
      moduleResolution: "bundler",
      jsx: "react-jsx",
      strict: true,
      noImplicitAny: false,
      skipLibCheck: true,
      noEmit: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      types: [],
      baseUrl: ".",
      paths: {
        "@monkeyagent/host": [path.join(checkDir, "mmahost.d.ts")],
        "@monkeyagent/dashboard": [path.join(checkDir, "mmahost.d.ts")],
        "@monkey-mini-app/ui": [path.join(uiSrc, "index.ts")],
        "@monkey-mini-app/ui/*": [path.join(uiSrc, "*")],
      },
    },
    include: [
      path.join(tplDir, "**/*.ts"),
      path.join(tplDir, "**/*.tsx"),
      path.join(checkDir, "mmahost.d.ts"),
    ],
  };
  writeFileSync(path.join(checkDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

  execFileSync("pnpm", ["exec", "tsc", "-p", path.join(checkDir, "tsconfig.json")], {
    cwd: root,
    stdio: "inherit",
  });
  console.log("\n[tpl:check] ✅ 所有模板 type-check 通过");
} catch {
  console.error("\n[tpl:check] ❌ 模板存在类型错误（上方为 tsc 输出）");
  process.exitCode = 1;
} finally {
  rmSync(checkDir, { recursive: true, force: true });
}
