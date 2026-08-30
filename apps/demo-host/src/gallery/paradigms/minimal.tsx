import { ArrowRight, Check, ChevronRight } from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { StyleHeader, Reveal } from "./shared"

/**
 * Minimal Whitespace · 极简留白
 * 大字号细字重 + 大量留白 + 少边框（行内 hover 高亮代替卡片）。
 * 参照：Apple / Notion 内容页。
 */
export function MinimalParadigm() {
  return (
    <div className="space-y-10">
      <div>
        <StyleHeader
          tag="Minimal Whitespace"
          name="极简留白"
          desc="大标题细字重 · 克制分隔 · 内容本身成为视觉主体"
        />
        <div className="mx-auto max-w-2xl">
          {/* 文章式 hero：无卡片 */}
          <Reveal>
            <p className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
              Release Notes · v2.4
            </p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight">
              让整理成为<span className="text-primary">习惯</span>
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed">
              本周我们把重复操作收敛成了三个动作：归档、置顶、定时清理。
              更少的按钮，更多的专注。
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button size="lg" className="rounded-full px-6">
                开始体验 <ArrowRight className="size-4" />
              </Button>
              <Button size="lg" variant="ghost" className="text-muted-foreground rounded-full">
                查看更新
              </Button>
            </div>
          </Reveal>

          {/* 分隔线 + 功能清单：行内 hover */}
          <div className="mt-14 border-t" />
          <div className="mt-8 space-y-1">
            {[
              { title: "智能归档", desc: "自动识别 30 天未动的项目", icon: Check },
              { title: "聚焦模式", desc: "隐藏全部次要信息，只留当前任务", icon: Check },
              { title: "周回顾", desc: "每周日 20:00 推送一份简短总结", icon: Check },
            ].map((item, i) => (
              <Reveal key={item.title} delay={80 + i * 60}>
                <button
                  type="button"
                  className="group flex w-full items-center gap-4 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110">
                    <item.icon className="size-4" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="text-muted-foreground block text-xs">{item.desc}</span>
                  </span>
                  <ChevronRight className="text-muted-foreground/50 size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              </Reveal>
            ))}
          </div>

          {/* 极简数据行：无卡片，数字 + 分隔 */}
          <div className="mt-12 grid grid-cols-3 divide-x divide-border">
            {[
              ["12,480", "本周活跃"],
              ["4.2%", "留存提升"],
              ["1.9h", "人均专注"],
            ].map(([num, label], i) => (
              <Reveal key={label} delay={200 + i * 60} className="px-4 first:pl-0">
                <div className="text-2xl font-semibold tabular-nums">{num}</div>
                <div className="text-muted-foreground mt-1 text-xs">{label}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* 列表式：任务行，hover 浮现操作 */}
      <div>
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-medium">今日清单</h3>
              <span className="text-muted-foreground text-xs">3 项 · 2 小时</span>
            </div>
          </Reveal>
          <div className="divide-y divide-border">
            {[
              { t: "写周报", d: "09:30", done: true },
              { t: "评审移动端改版", d: "11:00", done: false },
              { t: "整理调研纪要", d: "15:30", done: false },
            ].map((item, i) => (
              <Reveal key={item.t} delay={100 + i * 70}>
                <div className="group flex items-center gap-3 py-3">
                  <span
                    className={
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors " +
                      (item.done ? "border-primary bg-primary text-primary-foreground" : "border-border")
                    }
                  >
                    {item.done ? <Check className="size-3" /> : null}
                  </span>
                  <span className={item.done ? "text-muted-foreground flex-1 line-through" : "flex-1"}>
                    {item.t}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums">{item.d}</span>
                  <Badge
                    variant="outline"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    详情
                  </Badge>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
