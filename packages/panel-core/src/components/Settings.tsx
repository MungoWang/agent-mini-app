import * as React from "react"
import { usePanelState } from "../store.js"
import { usePanelActions } from "../context.js"

export function Settings() {
  const s = usePanelState()
  const actions = usePanelActions()
  const [form, setForm] = React.useState<Record<string, string>>({})
  React.useEffect(() => {
    if (!s.settingsOpen) return
    setForm(s.cfg && Object.keys(s.cfg).length ? s.cfg : actions.getCfg())
  }, [s.settingsOpen, s.cfgVersion])
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }))
  return (
    <div className="mma-settings" id="mma-settings" data-open={s.settingsOpen ? "1" : "0"}>
      <div className="mma-settings-head">
        <h3>设置</h3>
        <button type="button" className="mma-iconbtn" id="mma-cfg-close" onClick={() => actions.toggleSettings(false)}>
          ✕
        </button>
      </div>
      <label>
        Host 端口
        <input id="mma-cfg-port" type="number" value={form.hostPort || ""} onChange={set("hostPort")} />
      </label>
      <label>
        界面语言
        <select id="mma-cfg-lang" value={form.chatLanguage || "zh"} onChange={set("chatLanguage")}>
          <option value="zh">中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        主题
        <select id="mma-cfg-theme" value={form.theme || "light"} onChange={set("theme")}>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
      <label>
        调色板
        <select id="mma-cfg-palette" value={form.palette || "default"} onChange={set("palette")}>
          {[
            ["default", "默认"],
            ["tokyo", "东京夜"],
            ["forest", "苔原"],
            ["matcha", "草莓抹茶"],
            ["yellow", "药丸黄"],
            ["zoro", "三刀流"],
            ["hokage", "火影黎明"],
            ["slate", "石墨"],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label>
        卡片样式
        <select id="mma-cfg-cardstyle" value={form.cardStyle || "stamp"} onChange={set("cardStyle")}>
          <option value="stamp">印章</option>
          <option value="etch">蚀刻</option>
          <option value="hero">海报</option>
          <option value="list">列表</option>
        </select>
      </label>
      <label>
        LLM Provider
        <input id="mma-cfg-provider" value={form.provider || ""} onChange={set("provider")} />
      </label>
      <label>
        LLM 模型
        <input id="mma-cfg-model" value={form.model || ""} onChange={set("model")} />
      </label>
      <div className="mma-settings-actions">
        <span className="mma-settings-msg" id="mma-cfg-msg">
          {s.cfgMsg}
        </span>
        <button type="button" className="mma-textbtn" id="mma-cfg-save" onClick={() => actions.saveHostConfig(form)}>
          保存
        </button>
      </div>
    </div>
  )
}
