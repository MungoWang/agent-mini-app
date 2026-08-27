"use client"

import * as React from "react"
import { Paperclip } from "lucide-react"

import { cn } from "@monkey-mini-app/ui/lib/utils"
import { useLabels } from "@monkey-mini-app/ui/i18n/context"
import {
  parseJiraWiki,
  type WikiBlock,
  type WikiInline,
} from "./jira-wiki-parse"

export type JiraWikiClassNames = {
  root?: string
  heading?: string
  paragraph?: string
  list?: string
  listItem?: string
  code?: string
  inlineCode?: string
  quote?: string
  panel?: string
  panelTitle?: string
  table?: string
  th?: string
  td?: string
  hr?: string
  link?: string
  attachment?: string
  strike?: string
  bold?: string
  italic?: string
}

function InlineView({
  nodes,
  classNames,
  onAttachmentClick,
}: {
  nodes: WikiInline[]
  classNames?: JiraWikiClassNames
  onAttachmentClick?: (name: string) => void
}) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "text") return <span key={index}>{node.value}</span>
        if (node.type === "bold")
          return (
            <strong key={index} className={cn("font-semibold", classNames?.bold)}>
              <InlineView nodes={node.children} classNames={classNames} onAttachmentClick={onAttachmentClick} />
            </strong>
          )
        if (node.type === "italic")
          return (
            <em key={index} className={cn("italic", classNames?.italic)}>
              <InlineView nodes={node.children} classNames={classNames} onAttachmentClick={onAttachmentClick} />
            </em>
          )
        if (node.type === "strike")
          return (
            <s key={index} className={cn("text-muted-foreground", classNames?.strike)}>
              <InlineView nodes={node.children} classNames={classNames} onAttachmentClick={onAttachmentClick} />
            </s>
          )
        if (node.type === "code")
          return (
            <code
              key={index}
              className={cn("rounded-md bg-muted px-1 py-0.5 font-mono text-[0.85em]", classNames?.inlineCode)}
            >
              {node.value}
            </code>
          )
        if (node.type === "attachment")
          return (
            <button
              key={index}
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 align-middle text-xs font-medium hover:bg-muted",
                classNames?.attachment
              )}
              onClick={() => onAttachmentClick?.(node.name)}
            >
              <Paperclip className="size-3" />
              {node.name}
            </button>
          )
        return (
          <a
            key={index}
            href={node.href}
            className={cn("text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary", classNames?.link)}
            target="_blank"
            rel="noreferrer"
          >
            {node.label}
          </a>
        )
      })}
    </>
  )
}

function Blocks({
  blocks,
  classNames,
  onAttachmentClick,
}: {
  blocks: WikiBlock[]
  classNames?: JiraWikiClassNames
  onAttachmentClick?: (name: string) => void
}) {
  const inline = { classNames, onAttachmentClick }
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const level = Math.min(6, Math.max(1, block.level))
          return React.createElement(
            `h${level}`,
            {
              key: index,
              className: cn(
                "font-semibold tracking-tight first:mt-0",
                level <= 1 && "mt-6 mb-2 text-xl",
                level === 2 && "mt-5 mb-2 text-base",
                level >= 3 && "mt-4 mb-1.5 text-sm",
                classNames?.heading
              ),
            },
            <InlineView nodes={block.children} {...inline} />
          )
        }
        if (block.type === "paragraph")
          return (
            <p key={index} className={cn("mb-3 last:mb-0", classNames?.paragraph)}>
              <InlineView nodes={block.children} {...inline} />
            </p>
          )
        if (block.type === "list") {
          const Tag = block.ordered ? "ol" : "ul"
          return (
            <Tag
              key={index}
              className={cn(
                "mb-3 ml-5 space-y-1 last:mb-0",
                block.ordered ? "list-decimal" : "list-disc",
                classNames?.list
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className={cn("pl-0.5", classNames?.listItem)}>
                  <InlineView nodes={item} {...inline} />
                </li>
              ))}
            </Tag>
          )
        }
        if (block.type === "code")
          return (
            <pre
              key={index}
              className={cn(
                "mb-3 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-[0.85em] last:mb-0",
                classNames?.code
              )}
            >
              <code>{block.value}</code>
            </pre>
          )
        if (block.type === "quote")
          return (
            <blockquote
              key={index}
              className={cn(
                "mb-3 border-l-2 border-foreground/20 pl-3 text-muted-foreground italic last:mb-0",
                classNames?.quote
              )}
            >
              <InlineView nodes={block.children} {...inline} />
            </blockquote>
          )
        if (block.type === "panel")
          return (
            <div
              key={index}
              className={cn(
                "mb-3 rounded-lg border border-l-2 border-l-primary/70 bg-muted/30 px-3 py-2 last:mb-0",
                classNames?.panel
              )}
            >
              {block.title ? (
                <div className={cn("mb-1 text-xs font-semibold tracking-wide uppercase", classNames?.panelTitle)}>
                  {block.title}
                </div>
              ) : null}
              <Blocks blocks={block.children} classNames={classNames} onAttachmentClick={onAttachmentClick} />
            </div>
          )
        if (block.type === "table")
          return (
            <div key={index} className="mb-3 overflow-x-auto last:mb-0">
              <table className={cn("w-full border-collapse overflow-hidden rounded-lg text-sm", classNames?.table)}>
                {block.header.length ? (
                  <thead>
                    <tr>
                      {block.header.map((cell, cellIndex) => (
                        <th
                          key={cellIndex}
                          className={cn(
                            "border border-border bg-muted/60 px-2.5 py-1.5 text-left text-xs font-semibold",
                            classNames?.th
                          )}
                        >
                          <InlineView nodes={cell} {...inline} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className={cn("border border-border px-2.5 py-1.5", classNames?.td)}
                        >
                          <InlineView nodes={cell} {...inline} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        return <hr key={index} className={cn("my-4 border-border", classNames?.hr)} />
      })}
    </>
  )
}

/**
 * Render Jira wiki markup to tokens (headings, lists, tables, [^file], -strike-).
 * Style via className / classNames; full control via parseJiraWiki().
 * @when Jira description / comment body
 * @example
 * <JiraWiki classNames={{ heading: "text-base" }}>{`h2. Title\n* item`}</JiraWiki>
 */
export function JiraWiki({
  children,
  className,
  classNames,
  onAttachmentClick,
}: {
  children: string
  className?: string
  classNames?: JiraWikiClassNames
  onAttachmentClick?: (name: string) => void
}) {
  const t = useLabels("jiraWiki")
  const blocks = parseJiraWiki(children)
  if (!blocks.length) {
    return (
      <p data-testid="jira-wiki" className={cn("text-muted-foreground text-sm", classNames?.root, className)}>
        {t.empty}
      </p>
    )
  }
  return (
    <div
      data-testid="jira-wiki"
      className={cn("text-sm leading-relaxed text-foreground", classNames?.root, className)}
    >
      <Blocks blocks={blocks} classNames={classNames} onAttachmentClick={onAttachmentClick} />
    </div>
  )
}

export { parseJiraWiki } from "./jira-wiki-parse"
export type { WikiBlock, WikiInline } from "./jira-wiki-parse"
