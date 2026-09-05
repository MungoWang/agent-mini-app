/**
 * Pre-publish dsh harness:
 *   verdaccio → publish @monkey-mini-app/* → isolated DSH_HOME plugin add → dsh web
 *
 * Homes stay in this app dir. Does not touch ~/.dsh or ~/.monkey-mini-app.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(appDir, "../..");
const require = createRequire(path.join(appDir, "package.json"));

const REGISTRY = "http://127.0.0.1:4873";
const WEB_PORT = 3088;
const HOST_PORT = 17880;
const DSH_HOME = path.join(appDir, ".dsh");
const RUNTIME = path.join(appDir, "mma-runtime");
const PROFILE = path.join(DSH_HOME, "profiles", "web");
/**
 * dsh web ≥ 0.1.2 authenticates the browser with a launch token: only the printed
 * `http://127.0.0.1:<port>/?token=…` URL is reachable, and following it mints a 30-day
 * HttpOnly cookie. Everything else answers `401 dsh web authentication required`, which a
 * test sees as "our footer button does not exist". Capture that URL for the specs here.
 */
const BOOT_URL_FILE = path.join(DSH_HOME, "web-url");
const ORDER = ["ui", "api", "host", "panel", "dsh"] as const;

const children: ChildProcess[] = [];

function log(msg: string): void {
  console.log(`[dsh-host] ${msg}`);
}

function teardown(): void {
  for (const child of children) {
    if (child.exitCode == null) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  teardown();
  process.exit(130);
});
process.on("SIGTERM", () => {
  teardown();
  process.exit(0);
});

function waitHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      const req = http.get(url, (res) => {
        res.resume();
        if ((res.statusCode ?? 500) < 500) {
          resolve();
          return;
        }
        retry();
      });
      req.on("error", retry);
      req.setTimeout(1500, () => {
        req.destroy();
        retry();
      });
    };
    const retry = (): void => {
      if (Date.now() > deadline) {
        reject(new Error(`timeout waiting for ${url}`));
        return;
      }
      setTimeout(tick, 400);
    };
    tick();
  });
}

function localVersion(): string {
  try {
    const sha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot })
      .toString()
      .trim();
    const diff = execFileSync("git", ["diff", "HEAD"], { cwd: repoRoot });
    if (diff.length > 0) {
      const dirty = createHash("sha1").update(diff).digest("hex").slice(0, 8);
      return `0.0.0-dshhost.${sha}.${dirty}`;
    }
    return `0.0.0-dshhost.${sha}`;
  } catch {
    return `0.0.0-dshhost.${Date.now()}`;
  }
}

function rewriteMonkeyDeps(pkg: Record<string, unknown>, version: string): void {
  pkg.version = version;
  for (const field of ["dependencies", "peerDependencies"] as const) {
    const deps = pkg[field] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const name of Object.keys(deps)) {
      if (name.startsWith("@monkey-mini-app/")) deps[name] = version;
    }
  }
}

function registryHas(name: string, version: string): boolean {
  try {
    const raw = execFileSync("npm", ["view", `${name}@${version}`, "version", "--registry", REGISTRY], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return raw === version;
  } catch {
    return false;
  }
}

function publishLocal(version: string): void {
  for (const dir of ORDER) {
    const pkgDir = path.join(repoRoot, "packages", dir);
    const pkgFile = path.join(pkgDir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as { name: string };
    if (registryHas(pkg.name, version)) {
      log(`skip publish ${pkg.name}@${version} (already on verdaccio)`);
      continue;
    }
    const original = readFileSync(pkgFile, "utf8");
    const next = JSON.parse(original) as Record<string, unknown>;
    rewriteMonkeyDeps(next, version);
    writeFileSync(pkgFile, `${JSON.stringify(next, null, 2)}\n`);
    try {
      log(`publish ${pkg.name}@${version}`);
      const userconfig = path.join(appDir, ".npmrc.publish");
      writeFileSync(
        userconfig,
        [`registry=${REGISTRY}/`, "//127.0.0.1:4873/:_authToken=dsh-host", "always-auth=true", ""].join("\n"),
      );
      execFileSync("npm", ["publish", "--registry", REGISTRY, "--access", "public", "--userconfig", userconfig], {
        cwd: pkgDir,
        stdio: "inherit",
      });
    } finally {
      writeFileSync(pkgFile, original);
    }
  }
}

function packageBin(mod: string, binName: string): string {
  const pkgFile = require.resolve(`${mod}/package.json`);
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8")) as { bin?: string | Record<string, string> };
  const rel = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[binName];
  if (!rel) throw new Error(`${mod} has no bin ${binName}`);
  return path.resolve(path.dirname(pkgFile), rel);
}

function startVerdaccio(): ChildProcess {
  mkdirSync(path.join(appDir, "registry"), { recursive: true });
  const bin = packageBin("verdaccio", "verdaccio");
  const child = spawn(process.execPath, [bin, "--config", path.join(appDir, "verdaccio.yaml")], {
    cwd: appDir,
    stdio: "inherit",
  });
  children.push(child);
  return child;
}

function dshBin(): string {
  return packageBin("@deepseek-ai/dsh", "dsh");
}

function runDsh(args: string[], opts?: { stdio?: "inherit" | "pipe" }): void {
  execFileSync(process.execPath, [dshBin(), ...args], {
    cwd: repoRoot,
    stdio: opts?.stdio ?? "inherit",
    env: {
      ...process.env,
      DSH_HOME,
      DSH_TELEMETRY_MODE: "DISABLED",
    },
  });
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function patchYaml(runtimeRoot: string, skillDest: string): string {
  return [
    "- id: monkey-mini-app",
    "  config:",
    `    runtimeRoot: ${yamlQuote(runtimeRoot)}`,
    `    skillDest: ${yamlQuote(skillDest)}`,
    "",
  ].join("\n");
}

function writeOverlay(runtimeRoot: string, skillDest: string): string {
  const yaml = patchYaml(runtimeRoot, skillDest);
  const file = path.join(appDir, "overlay.yml");
  writeFileSync(file, yaml);
  mkdirSync(PROFILE, { recursive: true });
  writeFileSync(path.join(PROFILE, "cordis.patch.yml"), yaml);
  return file;
}

/**
 * Copy one skill template into the harness runtime and install the npm package its backend
 * imports — the same two steps `mini_app_install` performs for an agent. `--ignore-scripts`
 * here for the same reason the tool uses it.
 */
function seedTemplateApp(template: string, appId: string, pkg: string): void {
  const dest = path.join(RUNTIME, "apps", appId);
  const src = path.join(repoRoot, "skills/monkey-mini-app/templates", template);
  if (!existsSync(src)) {
    log(`WARN template missing: ${template}`);
    return;
  }
  cpSync(src, dest, { recursive: true });
  const manifest = path.join(dest, "package.json");
  if (!existsSync(manifest)) {
    writeFileSync(
      manifest,
      `${JSON.stringify({ private: true, name: appId, version: "0.0.0", dependencies: {} }, null, 2)}\n`,
    );
  }
  log(`npm install ${pkg} → ${appId}`);
  try {
    execFileSync(
      "npm",
      ["install", "--ignore-scripts", "--omit=dev", "--no-audit", "--no-fund", pkg],
      { cwd: dest, stdio: "pipe", env: process.env },
    );
  } catch (cause) {
    // Stay up: the spreadsheet specs then fail naming the missing package, which is more
    // diagnosable than a harness that refuses to boot on an offline machine.
    const msg = cause instanceof Error ? cause.message : String(cause);
    log(`WARN install ${pkg} failed — spreadsheet e2e will fail: ${msg.slice(0, 300)}`);
  }
}

function seedRuntime(version: string): { overlay: string } {  rmSync(RUNTIME, { recursive: true, force: true });
  mkdirSync(path.join(RUNTIME, "apps"), { recursive: true });
  const cfg = {
    runtimeRoot: RUNTIME,
    hostPort: HOST_PORT,
    theme: "light",
    palette: "default",
    locale: "zh-CN",
    chatLanguage: "zh-CN",
    llm: null,
  };
  writeFileSync(path.join(RUNTIME, "host.json"), `${JSON.stringify(cfg, null, 2)}\n`);
  const fixtures = path.join(appDir, "fixtures");
  for (const id of ["com.example.todo", "com.example.review", "com.example.kit"]) {
    cpSync(path.join(fixtures, id), path.join(RUNTIME, "apps", id), { recursive: true });
  }
  // The spreadsheet sample is seeded **from the shipped skill template**, so the e2e exercises
  // what an agent actually installs rather than a copy that can drift. It needs a real npm
  // package, which is the whole point of `mini_app_install`.
  seedTemplateApp("spreadsheet", "com.example.spreadsheet", "exceljs");
  const skillDest = path.join(DSH_HOME, "skills", "monkey-mini-app");
  const overlay = writeOverlay(RUNTIME, skillDest);
  writeFileSync(path.join(appDir, ".version"), version);
  return { overlay };
}

function prepareProfile(version: string): void {
  mkdirSync(DSH_HOME, { recursive: true });
  log("init web profile");
  runDsh(["web", "--dump-default-config"], { stdio: "pipe" });
  mkdirSync(PROFILE, { recursive: true });
  writeFileSync(
    path.join(PROFILE, ".npmrc"),
    [
      `@monkey-mini-app:registry=${REGISTRY}/`,
      "auto-install-peers=false",
      "ignore-workspace-root-check=true",
      "link-workspace-packages=false",
      "",
    ].join("\n"),
  );
  const ws = path.join(PROFILE, "pnpm-workspace.yaml");
  if (existsSync(ws)) {
    let text = readFileSync(ws, "utf8");
    if (!/autoInstallPeers:\s*false/.test(text)) {
      text += (text.endsWith("\n") ? "" : "\n") + "autoInstallPeers: false\n";
      writeFileSync(ws, text);
    }
  }
  const pkgFile = path.join(PROFILE, "package.json");
  let installed = false;
  if (existsSync(pkgFile)) {
    const deps = (JSON.parse(readFileSync(pkgFile, "utf8")) as { dependencies?: Record<string, string> })
      .dependencies;
    installed = deps?.["@monkey-mini-app/dsh-mini-app"] === version;
  }
  if (installed) {
    log(`plugin already ${version}`);
    return;
  }
  log(`dsh plugin add @monkey-mini-app/dsh-mini-app@${version}`);
  runDsh(["plugin", "--profile", "web", "add", `@monkey-mini-app/dsh-mini-app@${version}`]);
}

function startWeb(overlay: string): ChildProcess {
  const child = spawn(
    process.execPath,
    [dshBin(), "--profile", "web", "--patch", overlay, "--no-open", "--port", String(WEB_PORT)],
    {
      cwd: repoRoot,
      // piped (not "inherit") only so the tokenized boot URL can be captured; the output is
      // echoed straight back below, so `pnpm dsh-host` still shows everything.
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DSH_HOME,
        DSH_TELEMETRY_MODE: "DISABLED",
      },
    },
  );
  children.push(child);
  writeFileSync(BOOT_URL_FILE, "");
  let bootUrlSeen = false;
  for (const stream of [child.stdout, child.stderr]) {
    stream?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      const hit = /http:\/\/127\.0\.0\.1:3088\/\?token=[^\s"']+/.exec(chunk.toString());
      if (hit && !bootUrlSeen) {
        bootUrlSeen = true;
        writeFileSync(BOOT_URL_FILE, hit[0]);
        log(`web boot url → ${path.relative(appDir, BOOT_URL_FILE)}`);
      }
    });
  }
  child.on("exit", (code) => {
    teardown();
    process.exit(code ?? 1);
  });
  return child;
}

async function main(): Promise<void> {
  const version = localVersion();
  log(`version ${version}`);
  log(`DSH_HOME ${DSH_HOME}`);
  log(`runtimeRoot ${RUNTIME}`);

  startVerdaccio();
  await waitHttp(`${REGISTRY}/`, 30_000);
  log("verdaccio up");
  publishLocal(version);
  prepareProfile(version);
  const { overlay } = seedRuntime(version);
  startWeb(overlay);
  await waitHttp(`http://127.0.0.1:${WEB_PORT}/`, 120_000);
  await waitHttp(`http://127.0.0.1:${HOST_PORT}/health`, 60_000);
  // A 401 already proves the web server is listening; the token can trail it by a moment.
  const until = Date.now() + 15_000;
  while (!readFileSyncOpt(BOOT_URL_FILE) && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 200));
  }
  log(`ready  web http://127.0.0.1:${WEB_PORT}  apps http://127.0.0.1:${HOST_PORT}`);
}

function readFileSyncOpt(file: string): string {
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    return "";
  }
}

main().catch((err) => {
  console.error(`[dsh-host] ${err instanceof Error ? err.message : String(err)}`);
  teardown();
  process.exit(1);
});
