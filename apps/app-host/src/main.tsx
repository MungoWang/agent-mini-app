/** app-host：panel-core 多宿主复用验证（无 dsh）。
 *  只用 createMiniAppPanel(demoAdapter) —— adapter 只提供数据/iframe/面板显示，
 *  UI 行为（tabs/主题/搜索/浏览/模态）全部来自 core 默认。 */
import * as React from "react"
import { createMiniAppPanel, setPanelState, type AppItem, type MiniAppAdapter } from "@monkey-mini-app/panel-core"

const MOCK_APPS: AppItem[] = [
  { id: "com.demo.crm", name: "客户管理", description: "演示：客户列表 + 状态流转", acronym: "KM", commits: 12 },
  { id: "com.demo.analytics", name: "数据分析", description: "演示：指标卡 + 趋势", acronym: "FX", commits: 8 },
  { id: "com.demo.tasks", name: "任务台", description: "演示：看板 + 工时", acronym: "RW", commits: 21 },
  { id: "com.demo.glossary", name: "术语库", description: "演示：搜索 + 分页", acronym: "SY", commits: 3 },
]

const MOCK_HISTORY = [
  { id: "abc123def456", message: "feat: 增加导出", time: "2026-08-25 10:00", files: [{ path: "ui.tsx", add: 12, del: 3, preview: "export function App() {}" }] },
  { id: "def456abc123", message: "fix: 修复筛选", time: "2026-08-24 16:30", files: [{ path: "main.api.ts", add: 4, del: 2 }] },
]

const MOCK_STORAGE = [
  { name: "main.storage", size: 274, updatedAt: "2026-08-26T11:51:01Z" },
  { name: "settings", size: 120, updatedAt: "2026-08-26T09:00:00Z" },
]

function renderMockFrame(app: AppItem): string {
  return `<div style="padding:32px;font-family:system-ui;color:#1a1d20">
    <h2 style="margin:0 0 6px">${app.name}</h2>
    <p style="color:#667;margin:0 0 20px">${app.description}</p>
    <div style="display:flex;gap:12px">
      <div style="flex:1;border:1px solid #e5e8ec;border-radius:10px;padding:16px;background:#fff">
        <div style="font-size:12px;color:#889">演示指标</div><div style="font-size:26px;font-weight:700">128</div>
      </div>
      <div style="flex:1;border:1px solid #e5e8ec;border-radius:10px;padding:16px;background:#fff">
        <div style="font-size:12px;color:#889">app-host 假 iframe</div>
        <div style="font-size:13px;margin-top:8px">内容由 adapter.frame.mount 渲染，panel-core 只管容器与 tab 状态</div>
      </div>
    </div>
  </div>`
}

function demoAdapter(): MiniAppAdapter {
  return {
    emptyText: "还没有小程序（app-host 演示）",
    listApps: () => new Promise((res) => setTimeout(() => res(MOCK_APPS), 300)),
    frame: {
      url: (id) => "mock://" + id,
      mount: (appId) => {
        const app = MOCK_APPS.find((a) => a.id === appId)
        if (!app) return
        // 清理其他 frame 显示
        const frames = document.getElementById("mma-frames")
        if (!frames) return
        for (const w of frames.querySelectorAll(".mma-frame")) (w as HTMLElement).style.display = "none"
        let wrap = frames.querySelector(`.mma-frame[data-app="${appId}"]`) as HTMLElement | null
        if (!wrap) {
          wrap = document.createElement("div")
          wrap.className = "mma-frame"
          wrap.setAttribute("data-app", appId)
          wrap.innerHTML = renderMockFrame(app)
          frames.appendChild(wrap)
        }
        wrap.style.display = "flex"
      },
      unmount: (appId) => {
        document.getElementById("mma-frames")?.querySelector(`.mma-frame[data-app="${appId}"]`)?.remove()
      },
      reload: () => {},
    },
    openPanel: () => {
      const host = document.getElementById("mma-host")
      if (host) host.style.display = "flex"
      setPanelState({ visible: true })
    },
    closePanel: () => {
      const host = document.getElementById("mma-host")
      if (host) host.style.display = "none"
      setPanelState({ visible: false })
    },
    deleteApp: (appId) => {
      setPanelState({ apps: MOCK_APPS.filter((a) => a.id !== appId) })
      return Promise.resolve()
    },
    history: { list: () => Promise.resolve(MOCK_HISTORY), detail: (_a, id) => Promise.resolve(MOCK_HISTORY.find((c) => c.id === id) || { id, message: "?", time: "", files: [] }) },
    storage: { listTables: () => Promise.resolve(MOCK_STORAGE), readTable: (_a, name) => Promise.resolve({ table: name, rows: [{ a: 1 }, { a: 2 }] }) },
    config: {
      load: () => Promise.resolve({ hostPort: "9000", chatLanguage: "zh", theme: "light", palette: "default", cardStyle: "stamp", provider: "mock", model: "mock-1" }),
      save: (cfg) => { setPanelState({ cfgMsg: "已保存（模拟）", cfg: cfg }); return Promise.resolve() },
    },
  }
}

const panel = createMiniAppPanel(demoAdapter())

function openPanel() {
  panel.open()
  panel.actions.fetchApps()
}

// 首次即挂载（隐藏状态），点按钮打开
document.addEventListener("DOMContentLoaded", () => {
  const host = document.getElementById("host")
  if (!host) return
  const container = document.createElement("div")
  container.id = "mma-host"
  container.style.cssText = "position:absolute;inset:0;display:none;flex-direction:column;overflow:hidden;"
  host.appendChild(container)
  panel.mount(container)
})
document.getElementById("btn-open")?.addEventListener("click", openPanel)
