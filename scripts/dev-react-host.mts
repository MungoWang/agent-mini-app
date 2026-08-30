/**
 * One-command react-host dev: boot the demo host (scripts/demo-templates.mts) then
 * vite react-host. Usage: `pnpm react-host [hostPort]`  (host default 17900).
 * Ctrl-C / exit tears down the demo host too.
 */
import { spawn, type ChildProcess } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST_PORT = Number(process.argv[2] || 17900);
const APP_PORT = 5174;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let host: ChildProcess | null = null;
let app: ChildProcess | null = null;

function teardown(): void {
  for (const p of [app, host]) {
    if (p && p.exitCode == null) p.kill("SIGTERM");
  }
}
process.on("SIGINT", teardown);
process.on("SIGTERM", teardown);
process.on("exit", teardown);

function spawnPkg(args: string[], cwd: string): ChildProcess {
  return spawn("pnpm", args, { cwd, stdio: "inherit" });
}

function probe(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path: "/api/apps", timeout: 700 }, (res) => {
      res.resume();
      res.statusCode === 200 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`));
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function waitForHost(port: number): Promise<void> {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    try {
      await probe(port);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 700));
    }
  }
  throw new Error(`demo host did not come up on http://127.0.0.1:${port}`);
}

async function main(): Promise<void> {
  host = spawnPkg(["tsx", "scripts/demo-templates.mts", String(HOST_PORT)], root);
  await waitForHost(HOST_PORT);
  console.log(`\n[react-host] demo host ready on http://127.0.0.1:${HOST_PORT}`);
  console.log(`[react-host] opening http://localhost:${APP_PORT}  (?host=http://127.0.0.1:${HOST_PORT} to override)\n`);
  app = spawnPkg(["--filter", "react-host", "dev"], root);
  const code = await new Promise<number>((resolve) => app!.on("exit", (c) => resolve(c ?? 0)));
  teardown();
  process.exit(code);
}

main().catch((err) => {
  console.error(`[react-host] ${err instanceof Error ? err.message : String(err)}`);
  teardown();
  process.exit(1);
});
