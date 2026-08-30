import { ArrowUpRight, Quote } from "lucide-react"
import { Badge } from "@monkey-mini-app/ui/components/badge"
import { Button } from "@monkey-mini-app/ui/components/button"
import { StyleHeader, Reveal } from "./shared"

/**
 * Editorial · 编辑排版
 * 衬线大标题 + 黑白灰 + 单一强调色 + 编号目录 + 细分隔线。
 * 参照：杂志目录 / 出版站（适合内容、精选、知识库首页）。
 */
const SERIF = "font-serif tracking-tight"

export function EditorialParadigm() {
  return (
    <div className="mx-auto max-w-4xl">
      <StyleHeader
        tag="Editorial"
        name="编辑排版"
        desc="衬线标题 · 黑白灰 + 单一强调色 · 编号目录 · 杂志感留白"
      />

      {/* 刊头 */}
      <Reveal>
        <div className="border-b-2 border-foreground pb-6">
          <div className="flex items-baseline justify-between">
            <div className={SERIF + " text-4xl font-bold tracking-tight"}>
              每周<span className="text-primary">精选</span>
            </div>
            <div className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
              Vol.24 · Aug 2026
            </div>
          </div>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed">
            本期主题：让工具回到「记事」的本分。三篇文章，一个观点。
          </p>
        </div>
      </Reveal>

      {/* 头条：衬线大标题 + 引文 */}
      <Reveal delay={120}>
        <article className="mt-10">
          <p className="text-primary mb-3 text-xs font-medium tracking-[0.2em] uppercase">
            Feature
          </p>
          <h2 className={SERIF + " max-w-2xl text-3xl leading-snug font-bold"}>
            记事的本质，是让人愿意
            <span className="text-primary italic">回头再看</span>
          </h2>
          <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-relaxed">
            我们不缺工具，缺的是「合手的形状」。这周我们花了一半时间删功能，
            而不是加功能。
          </p>
          <div className="mt-5 flex items-center gap-4">
            <Button size="sm" variant="outline" className="rounded-full">
              阅读全文 <ArrowUpRight className="size-3.5" />
            </Button>
            <span className="text-muted-foreground text-xs">6 min read</span>
          </div>

          {/* 引文块 */}
          <blockquote className="relative mt-8 max-w-xl border-l-2 border-primary pl-5">
            <Quote className="text-primary/30 absolute -top-1 left-0 size-5" />
            <p className={SERIF + " text-lg leading-relaxed italic"}>
              好界面不是被看见的，而是被忘记的。
            </p>
            <footer className="text-muted-foreground mt-2 text-xs">
              — 产品笔记 · 2026-08
            </footer>
          </blockquote>
        </article>
      </Reveal>

      {/* 目录：编号文章列表 */}
      <div className="mt-12 border-t border-border" />
      <div className="mt-8">
        <div className="mb-4 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          本期目录
        </div>
        <div className="divide-y divide-border">
          {[
            { no: "01", title: "删除按钮的艺术", desc: "三个被删掉的功能，以及为什么更好用了", tag: "设计" },
            { no: "02", title: "终端里的秩序感", desc: "等宽不是复古，是对齐的承诺", tag: "工程" },
            { no: "03", title: "渐变与克制", desc: "一个强调色够不够？够了。", tag: "视觉" },
          ].map((item, i) => (
            <Reveal key={item.no} delay={160 + i * 80}>
              <button
                type="button"
                className="group flex w-full items-start gap-6 py-5 text-left transition-colors hover:bg-muted/40 px-2 -mx-2"
              >
                <span className={SERIF + " text-foreground/25 pt-0.5 text-sm tabular-nums transition-colors group-hover:text-primary"}>
                  {item.no}
                </span>
                <span className="flex-1">
                  <span className="block text-base font-semibold transition-transform group-hover:translate-x-0.5">
                    {item.title}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-sm">{item.desc}</span>
                </span>
                <Badge variant="secondary" className="mt-0.5 shrink-0">
                  {item.tag}
                </Badge>
              </button>
            </Reveal>
          ))}
        </div>
      </div>

      {/* 页脚式结语 */}
      <Reveal delay={400}>
        <div className="mt-10 flex flex-wrap items-center justify-between border-t border-border pt-6">
          <span className="text-muted-foreground text-xs">下期预告：让数字动起来</span>
          <span className="text-foreground/30 text-xs tracking-[0.2em] uppercase">
            · end ·
          </span>
        </div>
      </Reveal>
    </div>
  )
}
