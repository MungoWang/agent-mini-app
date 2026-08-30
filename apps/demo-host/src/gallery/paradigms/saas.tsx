import {
  ArrowUpRight,
  Bell,
  Calendar,
  ChevronRight,
  CircleCheck,
  Flame,
  Inbox,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@monkey-mini-app/ui/components/card"
import { Tabs, TabsList, TabsTrigger } from "@monkey-mini-app/ui/components/tabs"
import { Progress } from "@monkey-mini-app/ui/components/progress"
import { Sparkline } from "@monkey-mini-app/ui/blocks/sparkline"
import { StyleHeader, useCountUp, Reveal } from "./shared"

/* ------------------------------------------------------------------ */
/* 范式 demo 的私有动效/工具（demo 内联；正式组件化后再进组件库）        */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* 范式一：Dashboard（hero + KPI strip + 主副栏）                      */
/* ------------------------------------------------------------------ */

function StatCardFancy({
  title,
  value,
  delta,
  data,
  delay,
}: {
  title: string
  value: number
  delta: string
  data: number[]
  delay: number
}) {
  const n = useCountUp(value)
  return (
    <Reveal delay={delay}>
      <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
        <CardHeader className="pb-1">
          <CardDescription className="text-xs font-medium">{title}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-2">
          <div>
            <div className="bg-linear-to-r from-foreground to-foreground/55 bg-clip-text text-3xl font-semibold text-transparent tabular-nums">
              {n}
            </div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <span className="inline-flex items-center gap-0.5 font-medium text-emerald-500">
                <TrendingUp className="size-3" />
                {delta}
              </span>
            </div>
          </div>
          <div className="w-20 opacity-70">
            <Sparkline data={data.map((v) => ({ value: v }))} />
          </div>
        </CardContent>
      </Card>
    </Reveal>
  )
}

function DashboardParadigm() {
  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card">
      {/* 光晕背景 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(600px 180px at 20% 0%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 70%), radial-gradient(500px 160px at 80% 0%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 70%)",
        }}
      />
      <div className="relative p-6 sm:p-8">
        {/* hero */}
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <div className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Sparkles className="size-3.5" />
                Monday · Aug 26
              </div>
              <h2 className="bg-linear-to-r from-foreground via-foreground to-primary bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
                早上好，运营看板
              </h2>
              <p className="text-muted-foreground mt-2 text-sm">
                过去 24 小时的应用健康度与业务趋势，核心指标全部稳中向好。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Calendar className="size-3.5" />
                近 7 天
              </Button>
              <Button size="sm">
                <Bell className="size-3.5" />
                订阅报告
              </Button>
            </div>
          </div>
        </Reveal>

        {/* KPI strip */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCardFancy title="活跃用户" value={12840} delta="+12.4%" data={[12, 15, 13, 17, 19, 22, 26, 24, 28, 30]} delay={60} />
          <StatCardFancy title="今日转化" value={3128} delta="+8.1%" data={[8, 9, 11, 10, 13, 12, 15, 17, 16, 18]} delay={140} />
          <StatCardFancy title="营收" value={862} delta="+5.2%" data={[6, 7, 8, 7, 9, 10, 11, 10, 12, 13]} delay={220} />
          <StatCardFancy title="退款率" value={1.2} delta="-0.4%" data={[4, 3, 3, 4, 3, 2, 3, 2, 2, 1]} delay={300} />
        </div>

        {/* 主副栏 */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Reveal delay={200} className="lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">转化漏斗</CardTitle>
                  <CardDescription>访问 → 注册 → 首购，逐层收敛</CardDescription>
                </div>
                <Badge variant="outline" className="gap-1">
                  <Flame className="size-3 text-primary" />
                  实时
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "访问", value: 86, pct: 100, color: "var(--primary)" },
                  { label: "注册", value: 54, pct: 63, color: "var(--primary)" },
                  { label: "首购", value: 31, pct: 36, color: "var(--primary)" },
                ].map((row, i) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-12 text-xs">{row.label}</span>
                    <div className="flex-1">
                      <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${row.pct}%`,
                            background: `color-mix(in oklch, ${row.color} ${90 - i * 18}%, transparent)`,
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-xs font-medium tabular-nums">{row.value}%</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={280}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">实时活动</CardTitle>
                <CardDescription>最近一分钟</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {[
                  { name: "Ada · 完成订单", time: "12s", icon: CircleCheck },
                  { name: "Ben · 新注册", time: "26s", icon: Inbox },
                  { name: "Cici · 升级 Pro", time: "41s", icon: ArrowUpRight },
                ].map((item, i) => (
                  <Reveal key={item.name} delay={320 + i * 80}>
                    <div className="hover:bg-muted/50 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors">
                      <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                        <item.icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">{item.time}</span>
                    </div>
                  </Reveal>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 范式二：简报（今日要点 + 进度 + 时间线）                            */
/* ------------------------------------------------------------------ */

function BriefParadigm() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border bg-card p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-70"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                今日简报 · 3 个重点
              </div>
              <h3 className="bg-linear-to-r from-foreground to-primary bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
                转化率连续三天新高
              </h3>
              <p className="text-muted-foreground mt-2 max-w-md text-sm leading-relaxed">
                新注册引导页的改动生效了——注册漏斗第 2 步的流失下降 18%，建议把同款引导复制到移动端。
              </p>
              <div className="mt-4 flex items-center gap-2">
                <Badge>增长</Badge>
                <Badge variant="secondary">建议跟进</Badge>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">关键路径完成度</CardTitle>
              <CardDescription>本周计划 vs 实际</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "新版注册引导", pct: 100, tag: "已上线" },
                { label: "移动端适配", pct: 64, tag: "进行中" },
                { label: "数据看板重构", pct: 28, tag: "本周启动" },
              ].map((row) => (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span>{row.label}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">{row.pct}%</span>
                  </div>
                  <Progress value={row.pct} />
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={200}>
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">本周时间线</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-5 border-l pl-4">
              {[
                { day: "周一", title: "上线注册引导 v2", done: true },
                { day: "周三", title: "漏斗数据确认", done: true },
                { day: "今天", title: "复盘会 · 复制到移动端", done: false, active: true },
                { day: "周五", title: "发布移动端 A/B", done: false },
              ].map((item, i) => (
                <Reveal key={item.title} delay={240 + i * 70}>
                  <li className="relative">
                    <span
                      className={
                        "absolute -left-[21px] top-1 size-2.5 rounded-full ring-4 ring-card " +
                        (item.active
                          ? "bg-primary"
                          : item.done
                            ? "bg-emerald-500"
                            : "bg-muted")
                      }
                    />
                    <div className="text-muted-foreground text-xs">{item.day}</div>
                    <div className={item.done ? "text-muted-foreground text-sm" : "text-sm font-medium"}>
                      {item.title}
                    </div>
                  </li>
                </Reveal>
              ))}
            </ol>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 范式三：工作台（tabs + 分组列表 + 空状态提示）                      */
/* ------------------------------------------------------------------ */

function WorkbenchParadigm() {
  return (
    <Reveal>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div className="flex items-center gap-2">
            <Tabs defaultValue="today" className="w-auto">
              <TabsList>
                <TabsTrigger value="today">今天</TabsTrigger>
                <TabsTrigger value="week">本周</TabsTrigger>
                <TabsTrigger value="all">全部</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Search className="size-3.5" />
              搜索
            </Button>
            <Button size="sm">
              <Sparkles className="size-3.5" />
              新建
            </Button>
          </div>
        </div>
        <div className="grid gap-px bg-border lg:grid-cols-3">
          {[
            { title: "待处理", count: 4, items: ["审批：预算调整", "评审：移动端 A/B 方案", "回复：客户反馈 3 条", "确认：本周排期"] },
            { title: "进行中", count: 2, items: ["新版注册引导（二期）", "数据看板重构"] },
            { title: "已完成", count: 6, items: ["注册引导 v2 上线", "漏斗埋点验证"] },
          ].map((col, ci) => (
            <div key={col.title} className="bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{col.title}</span>
                <Badge variant="secondary" className="tabular-nums">
                  {col.count}
                </Badge>
              </div>
              <div className="space-y-2">
                {col.items.map((item, i) => (
                  <Reveal key={item} delay={100 + ci * 80 + i * 50}>
                    <button
                      type="button"
                      className="hover:border-primary/40 hover:bg-muted/40 w-full rounded-lg border border-transparent bg-muted/30 px-3 py-2 text-left text-sm transition-all hover:translate-x-0.5"
                    >
                      <span className="line-clamp-1">{item}</span>
                    </button>
                  </Reveal>
                ))}
                {col.items.length < 3 ? (
                  <div className="text-muted-foreground/60 flex items-center gap-1.5 px-1 py-2 text-xs">
                    <ChevronRight className="size-3" />
                    查看全部
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  )
}

/* ------------------------------------------------------------------ */

export function SaasParadigms() {
  return (
    <div className="space-y-10">
      <div>
        <StyleHeader tag="Glow Minimal" name="辉光简约" desc="渐变标题 + 主题色光晕 + 留白 + 微动效（三组页面统一语言）" />
        <DashboardParadigm />
      </div>
      <div>
        <BriefParadigm />
      </div>
      <div>
        <WorkbenchParadigm />
      </div>
    </div>
  )
}
