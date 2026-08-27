import { StreamLanguage } from "@codemirror/language"
import type { CompletionContext } from "@codemirror/autocomplete"

const KEYWORDS =
  /^(AND|OR|NOT|ORDER|BY|ASC|DESC|IN|IS|EMPTY|NULL|WAS|CHANGED)\b/i
const OPERATORS = /^(!=|!~|>=|<=|=|~|>|<)/

export const jqlLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null
    if (stream.match(/"(?:[^"\\]|\\.)*"/) || stream.match(/'(?:[^'\\]|\\.)*'/)) return "string"
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return "number"
    if (stream.match(KEYWORDS)) return "keyword"
    if (stream.match(OPERATORS)) return "operator"
    if (stream.match(/^[(),[\]]/)) return "punctuation"
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*(?=\s*\()/)) return "function"
    if (stream.match(/^[A-Za-z][A-Za-z0-9_.]*/)) return "variableName"
    stream.next()
    return null
  },
})

export type JqlSuggestItem = { name: string; detail?: string }

export function jqlCompletion(fields: JqlSuggestItem[], functions: JqlSuggestItem[]) {
  const keywords = ["AND", "OR", "NOT", "ORDER BY", "ASC", "DESC", "IN", "NOT IN", "IS", "IS NOT", "EMPTY"]
  return (context: CompletionContext) => {
    const word = context.matchBefore(/[A-Za-z_][\w.]*/)
    if (!word && !context.explicit) return null
    return {
      from: word?.from ?? context.pos,
      options: [
        ...fields.map((field) => ({
          label: field.name,
          type: "property",
          detail: field.detail,
        })),
        ...functions.map((fn) => ({
          label: `${fn.name}()`,
          type: "function",
          detail: fn.detail,
        })),
        ...keywords.map((label) => ({ label, type: "keyword" })),
      ],
    }
  }
}

export const defaultJqlFields: JqlSuggestItem[] = [
  { name: "project", detail: "Project key" },
  { name: "status", detail: "Status" },
  { name: "assignee", detail: "Assignee" },
  { name: "reporter", detail: "Reporter" },
  { name: "issuetype", detail: "Issue type" },
  { name: "priority", detail: "Priority" },
  { name: "labels", detail: "Labels" },
  { name: "fixVersion", detail: "Fix version" },
  { name: "created", detail: "Created" },
  { name: "updated", detail: "Updated" },
  { name: "summary", detail: "Summary" },
  { name: "key", detail: "Issue key" },
]

export const defaultJqlFunctions: JqlSuggestItem[] = [
  { name: "currentUser", detail: "Logged-in user" },
  { name: "now", detail: "Current time" },
  { name: "startOfDay", detail: "Start of day" },
  { name: "endOfDay", detail: "End of day" },
  { name: "membersOf", detail: "Group members" },
]
