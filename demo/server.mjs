import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";
const runtimeRoot = process.env.MONKEY_MINI_APP_ROOT || path.join(os.tmpdir(), "mma-demo-runtime");

const TOKENS = {
  "color-background": "#0b0d12",
  "color-surface": "#141824",
  "color-foreground": "#f4f4f5",
  "color-primary": "#3b82f6",
  "color-primary-foreground": "#ffffff",
  "color-muted": "#1c2230",
  "color-muted-foreground": "#9aa3b5",
  "color-border": "#2a3142",
  "radius-md": "10px",
  "space-3": "12px",
  "space-4": "16px",
};

function ensureApps() {
  const hello = path.join(runtimeRoot, "apps", "com.example.hello");
  const counter = path.join(runtimeRoot, "apps", "com.example.counter");
  fs.mkdirSync(path.join(hello), { recursive: true });
  fs.mkdirSync(path.join(counter, "storage"), { recursive: true });
  fs.writeFileSync(
    path.join(hello, "manifest.json"),
    JSON.stringify({ id: "com.example.hello", name: "Hello", version: "0.1.0", entry: "App.tsx", permissions: ["ui"] }, null, 2)
  );
  fs.writeFileSync(
    path.join(hello, "App.tsx"),
    `export default function App() {
  return (
    <div style={{ padding: "var(--space-4)", color: "var(--color-foreground)", background: "var(--color-background)" }}>
      <h1 style={{ color: "var(--color-primary)" }}>Hello mini-app</h1>
    </div>
  );
}
`
  );
  fs.writeFileSync(
    path.join(counter, "manifest.json"),
    JSON.stringify({ id: "com.example.counter", name: "Counter", version: "0.1.0", entry: "App.tsx", permissions: ["storage", "ui"] }, null, 2)
  );
  const store = path.join(counter, "storage", "default.json");
  if (!fs.existsSync(store)) fs.writeFileSync(store, JSON.stringify({ count: 0 }, null, 2));
}

function readCount() {
  const store = path.join(runtimeRoot, "apps", "com.example.counter", "storage", "default.json");
  try {
    return JSON.parse(fs.readFileSync(store, "utf8")).count ?? 0;
  } catch {
    return 0;
  }
}

function writeCount(n) {
  const store = path.join(runtimeRoot, "apps", "com.example.counter", "storage", "default.json");
  fs.mkdirSync(path.dirname(store), { recursive: true });
  fs.writeFileSync(store, JSON.stringify({ count: n }, null, 2));
}

const page = () => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>monkey-mini-app Host</title>
  <style>
    :root {
      --color-background: ${TOKENS["color-background"]};
      --color-surface: ${TOKENS["color-surface"]};
      --color-foreground: ${TOKENS["color-foreground"]};
      --color-primary: ${TOKENS["color-primary"]};
      --color-primary-foreground: ${TOKENS["color-primary-foreground"]};
      --color-muted: ${TOKENS["color-muted"]};
      --color-muted-foreground: ${TOKENS["color-muted-foreground"]};
      --color-border: ${TOKENS["color-border"]};
      --radius-md: ${TOKENS["radius-md"]};
      --space-3: ${TOKENS["space-3"]};
      --space-4: ${TOKENS["space-4"]};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; background: var(--color-background); color: var(--color-foreground);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
    .shell { display: flex; flex-direction: column; height: 100%; }
    .bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px;
      border-bottom: 1px solid var(--color-border); background: #10141d; }
    .brand { font-weight: 700; font-size: 13px; letter-spacing: .04em; color: var(--color-muted-foreground); margin-right: 8px; }
    .tabs { display: flex; gap: 6px; flex: 1; }
    .tab { border: 1px solid var(--color-border); background: var(--color-muted); color: var(--color-muted-foreground);
      padding: 8px 14px; border-radius: 8px 8px 0 0; cursor: pointer; font-size: 13px; }
    .tab.active { background: var(--color-surface); color: var(--color-foreground); border-bottom-color: var(--color-surface); }
    .stage { flex: 1; padding: 28px; overflow: auto; }
    .card { max-width: 560px; background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 24px; }
    h1 { margin: 0 0 8px; color: var(--color-primary); font-size: 28px; }
    p { color: var(--color-muted-foreground); margin: 0 0 16px; }
    .count { font-size: 56px; font-weight: 700; margin: 8px 0 16px; }
    button { background: var(--color-primary); color: var(--color-primary-foreground); border: 0;
      padding: 10px 16px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-right: 8px; }
    button.ghost { background: transparent; color: var(--color-foreground); border: 1px solid var(--color-border); }
    .meta { font-size: 12px; color: var(--color-muted-foreground); margin-top: 20px; }
    code { font-family: ui-monospace, monospace; font-size: 12px; }
  </style>
</head>
<body>
  <div class="shell">
    <div class="bar">
      <div class="brand">MONKEY MINI-APP</div>
      <div class="tabs">
        <button class="tab active" data-app="hello">Hello</button>
        <button class="tab" data-app="counter">Counter</button>
      </div>
    </div>
    <div class="stage">
      <div id="hello" class="card">
        <h1>Hello mini-app</h1>
        <p>真实落盘的 <code>com.example.hello</code>，样式只用 Host theme tokens。</p>
        <p>这就是 AI 生成的最小 UI：一个 TSX + manifest，Host 统一主题。</p>
      </div>
      <div id="counter" class="card" hidden>
        <h1>Counter</h1>
        <p><code>com.example.counter</code> · storage/default.json</p>
        <div class="count" id="count">…</div>
        <button id="inc">+1</button>
        <button class="ghost" id="reset">reset</button>
      </div>
      <div class="meta">runtime: ${runtimeRoot}</div>
    </div>
  </div>
  <script>
    const tabs = document.querySelectorAll('.tab');
    function show(id) {
      hello.hidden = id !== 'hello';
      counter.hidden = id !== 'counter';
      tabs.forEach(t => t.classList.toggle('active', t.dataset.app === id));
    }
    tabs.forEach(t => t.onclick = () => show(t.dataset.app));
    async function refresh() {
      const r = await fetch('/api/count');
      const j = await r.json();
      document.getElementById('count').textContent = j.count;
    }
    document.getElementById('inc').onclick = async () => {
      await fetch('/api/count', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({delta:1}) });
      refresh();
    };
    document.getElementById('reset').onclick = async () => {
      await fetch('/api/count', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({set:0}) });
      refresh();
    };
    refresh();
  </script>
</body>
</html>`;

ensureApps();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  if (url.pathname === "/api/count" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ count: readCount() }));
    return;
  }
  if (url.pathname === "/api/count" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const j = body ? JSON.parse(body) : {};
      let n = readCount();
      if (typeof j.set === "number") n = j.set;
      else n += Number(j.delta || 1);
      writeCount(n);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ count: n }));
    });
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page());
});

server.listen(PORT, HOST, () => {
  console.log(`demo http://${HOST}:${PORT}`);
  console.log("runtime", runtimeRoot);
});
