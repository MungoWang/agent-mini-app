#!/usr/bin/env node
/**
 * Skill gate: keep skills/monkey-mini-app/ honest against the code it documents.
 *
 * Every rule here exists because the doc set had already drifted in a way that
 * makes an agent generate broken mini-apps (see docs/contracts/skill-sync.md):
 *
 * 1. author specifiers — UI: react + @monkey-mini-app/ui; backend: @monkey-mini-app/api; + relative paths
 * 2. tool names — a `mini_app_*` the skill names must exist
 * 3. `ctx.*` surface — must be a real key of AppContext
 * 3b. ctx mirror — packages/api AppCtx must declare exactly the host's ctx keys
 *     (the backend gets `defineApp` injected by the host but takes its *types*
 *     from the SDK, so the two lists must not drift)
 * 4. generated contracts — size cap, ui import, no orphan/missing doc
 * 4b. taxonomy — every component declares a `@family` from
 * packages/ui/catalog-families.json, and catalog.md is grouped by it
 * 5. markdown tables — a merged row silently deletes two nav entries
 * 6. relative links — a dead link is an unreadable contract
 * 7. doc language — developer-facing docs are English (AGENTS.md → Doc rules);
 * sample product copy in code fences/spans stays host-locale
 * 7b. skill language — skill prose/comments are English; Chinese only survives as
 * sample copy inside code, which is what a generated app shows
 *
 * `when` coverage is reported as a warning: it needs prose from a human, so it
 * must not block `gen:skill`.
 *
 * Usage: pnpm check:skill () (runs in `pnpm lint` and CI)

 * Inputs: skills/monkey-mini-app/**, packages/host/src/{tools/tool-facade.ts,apps/apps-manager.ts}, packages/dsh/src/lifecycle.ts, packages/ui/{ai/catalog.json,catalog-families.json}, docs/**, AGENTS.md, README.md
 * Writes: nothing
 * Side effects: none — exit 1 means the tree drifted
 * Run as: pnpm check:skill () — CI and packages/smoke-test/catalog-consistency.test.ts
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const skillDir = path.join(root, "skills/monkey-mini-app")
const contractsDir = path.join(skillDir, "references/contracts")

const errors = []
const warnings = []
const fail = (rule, file, detail) =>
 errors.push({ rule, file: rel(file), detail })
const warn = (rule, file, detail) =>
 warnings.push({ rule, file: rel(file), detail })

function rel(p) {
 return path.relative(root, p)
}

function walk(dir, filter) {
 if (!fs.existsSync(dir)) return []
 const out = []
 for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
 const full = path.join(dir, ent.name)
 if (ent.isDirectory()) out.push(...walk(full, filter))
 else if (filter(full)) out.push(full)
 }
 return out
}

const mdFiles = walk(skillDir, (f) => f.endsWith(".md"))
const sourceFiles = walk(skillDir, (f) => /\.(ts|tsx)$/.test(f))
const allFiles = [...mdFiles, ...sourceFiles]

/* ------------------------------------------------- 1. author import specifiers */

// Two author packages: `@monkey-mini-app/ui` (UI) and `@monkey-mini-app/api` (backend).
// Pre-unification names no longer resolve — teaching them would generate broken apps.
const BANNED_SPECIFIERS = [
 "@monkeyagent/dashboard",
 "@monkeyagent/host",
 "@monkey-mini-app/sdk",
 "defineDashboard",
 "useDashboardApi",
]

for (const file of allFiles) {
 const text = fs.readFileSync(file, "utf8")
 text.split("\n").forEach((line, i) => {
 for (const banned of BANNED_SPECIFIERS) {
 if (line.includes(banned)) {
 fail(
 "author-specifier",
 file,
 `line ${i + 1}: says "${banned}" — UI: @monkey-mini-app/ui; backend: @monkey-mini-app/api; + in-app relative paths`
)
 }
 }
 })
}

/* ------------------------------------------------------ 2. mini_app_* tool names */

function realToolNames() {
 const names = new Set()
 const files = [
 "packages/host/src/tools/tool-facade.ts",
 "packages/dsh/src/lifecycle.ts",
 ]
 for (const f of files) {
 const p = path.join(root, f)
 if (!fs.existsSync(p)) {
 fail("tool-catalog", p, "source of tool names is missing — update check-skill.mjs")
 continue
 }
 for (const m of fs.readFileSync(p, "utf8").matchAll(/"(mini_app_[a-z_]+)"/g)) {
 names.add(m[1])
 }
 }
 return names
}

const tools = realToolNames()
const mentionedTools = new Map()
for (const file of allFiles) {
 for (const m of fs.readFileSync(file, "utf8").matchAll(/\b(mini_app_[a-z_]+)\b/g)) {
 if (!mentionedTools.has(m[1])) mentionedTools.set(m[1], [])
 mentionedTools.get(m[1]).push(file)
 }
}
for (const [name, files] of mentionedTools) {
 const key = name.replace(/_$/, "") // `mini_app_*` globs in prose
 if (tools.has(key) || key === "mini_app_") continue
 fail(
 "tool-name",
 files[0],
 `${name} is documented but not registered (also in ${files.length} file(s)) — known: ${[...tools].sort().join(", ")}`
)
}
for (const name of tools) {
 if (!mentionedTools.has(name)) warn("tool-coverage", skillDir, `${name} exists but the skill never mentions it`)
}

/* --------------------------------------------------------- 3. `ctx.*` surface */

/** Top-level member names of a type-literal alias, e.g. `export type X = { … }`. */
function typeLiteralKeys(file, aliasName) {
 if (!fs.existsSync(file)) return null
 const src = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true)
 const keys = new Set()
 for (const stmt of src.statements) {
 if (!ts.isTypeAliasDeclaration(stmt) || stmt.name.text !== aliasName) continue
 if (!ts.isTypeLiteralNode(stmt.type)) continue
 for (const member of stmt.type.members) {
 if (member.name) keys.add(member.name.getText().replace(/[?"']/g, ""))
 }
 }
 return keys
}

/** The host's runtime ctx surface. */
function realCtxKeys() {
 const p = path.join(root, "packages/host/src/apps/apps-manager.ts")
 const keys = typeLiteralKeys(p, "AppContext")
 if (!keys || !keys.size) {
 fail("ctx-catalog", p, "source of the ctx surface is missing — update check/skill.mjs")
 return new Set()
 }
 return keys
}

const ctxKeys = realCtxKeys()

/* --- 3b. the SDK's author-facing mirror must match the host surface exactly. ---
 * The backend never loads the React bundle, so `defineApp` comes from the host while
 * the *types* come from packages/api/src/index.ts. Two lists that drift are worse than
 * none, so the sets have to be identical (rule name: ctx-mirror).
 */
{
 const sdkApp = path.join(root, "packages/api/src/index.ts")
 const mirrored = typeLiteralKeys(sdkApp, "AppCtx")
 if (!mirrored || !mirrored.size) {
 fail("ctx-mirror", sdkApp, "AppCtx type literal not found — update check/skill.mjs")
 } else {
 for (const k of ctxKeys) {
 if (!mirrored.has(k)) fail("ctx-mirror", sdkApp, `ctx.${k} exists in the host but not in the API package's AppCtx`)
 }
 for (const k of mirrored) {
 if (!ctxKeys.has(k)) fail("ctx-mirror", sdkApp, `AppCtx declares ctx.${k}, which the host does not provide`)
 }
 }
}

for (const file of allFiles) {
 const text = fs.readFileSync(file, "utf8")
 text.split("\n").forEach((line, i) => {
 // Drop markdown link targets and `…/ctx.md` filenames before scanning: they are
 // document paths, not author API.
 const scan = line
 .replace(/\]\([^)]*\)/g, "]()")
 .replace(/[\w./-]*\.md\b/g, "")
 for (const m of scan.matchAll(/\bctx\.([a-zA-Z_][\w]*)(?![\w.])/g)) {
 if (ctxKeys.has(m[1])) continue
 fail("ctx-member", file, `line ${i + 1}: ctx.${m[1]} is not a key of AppContext`)
 }
 })
}

/* --------------------------------------------------- 4. generated contract files */

const MAX_CONTRACT_BYTES = 8 * 1024

for (const file of walk(contractsDir, (f) => f.endsWith(".md"))) {
 const bytes = fs.statSync(file).size
 if (bytes > MAX_CONTRACT_BYTES) {
 fail(
 "contract-size",
 file,
 `${bytes} bytes > ${MAX_CONTRACT_BYTES} — almost certainly an inherited-prop dump; fix generate-skill.mjs`
)
 }
 const text = fs.readFileSync(file, "utf8")
 if (!text.includes("@monkey-mini-app/ui")) {
 fail("contract-import", file, 'no `@monkey-mini-app/ui` import line')
 }
 // Our own components legitimately declare callbacks (onRowClick, onCardsChange),
 // so name matching would be wrong. Real inherited noise is React's own vocabulary:
 // `aria-*` props and React DOM event-handler / Booleanish attribute types.
 const noise = text
 .split("\n")
 .filter(
 (l) =>
 /^\|\s*`aria-/.test(l) ||
 /^\|\s*`[^`]+`\s*\|\s*`[^`]*(EventHandler|Booleanish|NativeEvents|SVGAttributes)[^`]*`/.test(l)
)
 if (noise.length) {
 fail(
 "contract-noise",
 file,
 `${noise.length} inherited HTML/ARIA prop row(s), e.g. ${noise[0].slice(0, 60)} — fix generate-skill.mjs`
)
 }
 if (!text.includes("**when**")) {
 warn("contract-when", file, "no `@when` JSDoc — the catalog cannot say when to pick this")
 }
 if (!/## (Props|Parts)/.test(text) && !text.includes("Props not inferred")) {
 warn("contract-props", file, "no props section at all")
 }
}

const catalog = fs.readFileSync(path.join(skillDir, "references/catalog.md"), "utf8")
for (const file of walk(contractsDir, (f) => f.endsWith(".md"))) {
 const slug = path.basename(file, ".md")
 if (!catalog.includes(`contracts/${slug}.md`)) {
 fail("catalog-orphan", file, "not linked from catalog.md — an agent will never find it")
 }
}
for (const m of catalog.matchAll(/contracts\/([\w-]+)\.md/g)) {
 if (!fs.existsSync(path.join(contractsDir, `${m[1]}.md`))) {
 fail("catalog-dead", path.join(skillDir, "references/catalog.md"), `links ${m[1]}.md which does not exist`)
 }
}

/* ------------------------------------------------- 4b. functional taxonomy */

const familiesFile = path.join(root, "packages/ui/catalog-families.json")
const registryFile = path.join(root, "packages/ui/ai/catalog.json")
const vocabulary = () => {
 if (!fs.existsSync(familiesFile)) {
 fail("taxonomy", familiesFile, "vocabulary file missing")
 return new Set()
 }
 const raw = JSON.parse(fs.readFileSync(familiesFile, "utf8"))
 const names = (raw.families ?? []).map((f) => f.name)
 if (!names.length) fail("taxonomy", familiesFile, "no families declared")
 return new Set(names)
}

if (fs.existsSync(registryFile)) {
 const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"))
 const fams = vocabulary()
 const counts = new Map()
 for (const [name, entry] of Object.entries(registry.components ?? {})) {
 if (!entry.family) {
 fail("taxonomy", `${name}@${registry.package}`, "no `@family` on the component")
 continue
 }
 if (!fams.has(entry.family)) {
 fail("taxonomy", `${name}@${registry.package}`, `unknown family "${entry.family}"`)
 continue
 }
 if (!entry.componentType) fail("taxonomy", name, "no componentType")
 if (typeof entry.primitive !== "boolean") fail("taxonomy", name, "no primitive flag")
 counts.set(entry.family, (counts.get(entry.family) ?? 0) + 1)
 if (entry.contract && !fs.existsSync(path.join(root, "skills/monkey-mini-app", entry.contract))) {
 fail("dead-link", registryFile, `${name} → ${entry.contract} does not exist`)
 }
 }
 for (const f of fams) {
 if (!counts.get(f)) warn("taxonomy-empty", familiesFile, `family "${f}" has no components`)
 }
 // catalog.md must be grouped by the same vocabulary
 const catalogText = fs.readFileSync(path.join(skillDir, "references/catalog.md"), "utf8")
 const sections = [...catalogText.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
 for (const s of sections) {
 if (s.startsWith("⚠")) {
 fail("taxonomy", path.join(skillDir, "references/catalog.md"), `"${s}" — unclassified components: re-run pnpm gen:skill`)
 continue
 }
 if (counts.has(s) && !fams.has(s)) fail("taxonomy", path.join(skillDir, "references/catalog.md"), `section "${s}" is not in the vocabulary`)
 }
 for (const [f, n] of counts) {
 if (n && !sections.includes(f)) {
 fail("taxonomy", path.join(skillDir, "references/catalog.md"), `family "${f}" (${n} components) has no section — catalog.md is stale, run pnpm gen:skill`)
 }
 }
 // every contract carries the same classification line
 for (const file of walk(contractsDir, (x) => x.endsWith(".md"))) {
 const text = fs.readFileSync(file, "utf8")
 const m = text.match(/^`[^`]+` · family: (.+?) · type: (\w+)/m)
 if (!m) {
 fail("taxonomy", file, "no `· family: … · type: …` line — regenerate contracts")
 continue
 }
 if (m[1] && !fams.has(m[1])) fail("taxonomy", file, `family "${m[1]}" not in vocabulary`)
 }
} else {
 fail("taxonomy", registryFile, "missing — run pnpm gen:skill")
}

/* ------------------------------------------- 4d. examples published from ui-examples */

// references/examples/** is generated from packages/ui-examples: every file must
// describe itself (subject or group + title + scenario) and must be reachable from a
// contract or a group index, or an agent will never find it.
{
 const examplesDir = path.join(skillDir, "references/examples")
 const sharedPrefix = "packages/ui-examples/src/components"
 if (fs.existsSync(examplesDir)) {
 const docs = [...walk(contractsDir, (f) => f.endsWith(".md")), ...walk(examplesDir, (f) => f.endsWith(".md"))]
 // links are resolved relative to the doc that carries them (contracts/ uses ../examples/,
 // a group index inside examples/ uses ./<dir>/)
 const linked = new Set()
 for (const d of docs) {
 for (const m of fs.readFileSync(d, "utf8").matchAll(/\]\(([^)\s]+\.tsx)\)/g)) {
 const abs = path.resolve(path.dirname(d), m[1])
 if (abs.startsWith(examplesDir + path.sep)) linked.add(path.relative(examplesDir, abs).split(path.sep).join("/"))
 }
 }
 let checked = 0
 for (const file of walk(examplesDir, (f) => f.endsWith(".tsx"))) {
 const rel = path.relative(examplesDir, file).split(path.sep).join("/")
 if (rel.startsWith("shared/")) continue
 checked++
 const text = fs.readFileSync(file, "utf8")
 const head = /^\/\*\*([\s\S]*?)\*\//.exec(text)
 if (!head) {
 fail("example-meta", file, `no JSDoc header — needs @exampleOf|@group + @title + @scenario (source: ${sharedPrefix}/${rel})`)
 continue
 }
 const tag = (k) => new RegExp(`@${k}\\s+(.*)`).exec(head[1])?.[1]?.trim() ?? ""
 const of = tag("exampleOf")
 const group = tag("group")
 if (of === group === "") fail("example-meta", file, "needs @exampleOf <Component> or @group <slug>")
 if (of && group) fail("example-meta", file, "@exampleOf and @group are mutually exclusive")
 if (!tag("title")) fail("example-meta", file, "missing @title")
 const sc = tag("scenario")
 if (!sc) fail("example-meta", file, "missing @scenario — say what situation this example represents")
 else if (/^TODO/i.test(sc)) fail("example-meta", file, "@scenario is still a placeholder — describe the situation, not the component name")
 if (!linked.has(rel)) fail("example-orphan", file, `nothing links examples/${rel} — add @exampleOf/@group so gen:skill references it`)
 }
 console.log(`check:skill — ${checked} examples under references/examples/`)
 } else {
 fail("example-orphan", examplesDir, `missing — run pnpm gen:skill (source: ${sharedPrefix})`)
 }
}

/* ------------------------------------------- 4c. annotation hygiene in ui source */

// Two stacked JSDoc blocks silently hide everything in the first one: TypeScript
// attaches only the comment directly above the declaration. That is how a component
// can lose its @when/@family while the source still looks documented.
for (const file of walk(path.join(root, "packages/ui/src"), (f) => /\.tsx?$/.test(f))) {
 const lines = fs.readFileSync(file, "utf8").split("\n")
 for (let i = 1; i < lines.length; i++) {
 if (lines[i].trim() === "/**" && lines[i - 1].trim() === " */") {
 fail(
 "jsdoc-stacked",
 file,
 `line ${i + 1}: a second JSDoc block right after another — the first is ignored; merge them`
)
 }
 }
}

/* --------------------------------------------------- 5. markdown table integrity */

function cells(line) {
 // Count unescaped pipes: `|` inside `` `a \| b` `` is escaped as `\|`.
 return line.replace(/\\\|/g, "\u0000").split("|").length - 2
}

for (const file of mdFiles) {
 const lines = fs.readFileSync(file, "utf8").split("\n")
 let i = 0
 while (i < lines.length) {
 if (!lines[i].trimStart().startsWith("|")) {
 i++
 continue
 }
 const block = []
 while (i < lines.length && lines[i].trimStart().startsWith("|")) {
 block.push({ line: lines[i], n: i + 1 })
 i++
 }
 if (block.length < 2) continue
 const header = cells(block[0].line)
 if (!/^\|[\s:|-]+\|$/.test(block[1].line.trim())) continue // not a real table
 for (const row of block) {
 const n = cells(row.line)
 if (n !== header) {
 fail(
 "md-table",
 file,
 `line ${row.n}: ${n} cells but the table header has ${header} — a merged row deletes nav entries`
)
 }
 }
 }
}

/* ------------------------------------------------------------ 6. relative links */

const LINK = /\]\((?!https?:|mailto:|#)([^)\s]+)\)/g
for (const file of mdFiles) {
 const text = fs.readFileSync(file, "utf8")
 text.split("\n").forEach((line, i) => {
 for (const m of line.matchAll(LINK)) {
 const target = m[1].split("#")[0]
 if (!target || target.startsWith("/")) continue
 if (!fs.existsSync(path.resolve(path.dirname(file), target))) {
 fail("dead-link", file, `line ${i + 1}: → ${m[1]} does not exist`)
 }
 }
 })
}

/* ------------------------------------------------- 7. doc language policy */

// Project rule (AGENTS.md → Doc rules): developer-facing docs are English. Chinese is
// allowed only where the *end user* reads it, i.e. sample copy inside code fences or
// inline code — and in explicitly bilingual twins (`*.zh.md`, README.zh.md).
const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
const docTargets = [path.join(root, "AGENTS.md"), path.join(root, "README.md")]
if (fs.existsSync(path.join(root, "docs"))) {
 // Public contracts + architecture must be English. RFCs and archive may stay
 // author-language notes (AGENTS.md → Doc rules).
 docTargets.push(
 ...walk(
 path.join(root, "docs"),
 (f) =>
 f.endsWith(".md") &&
 !f.includes(`${path.sep}archive${path.sep}`) &&
 !f.includes(`${path.sep}rfcs${path.sep}`),
 ),
 )
}
for (const file of docTargets) {
 if (file.endsWith(".zh.md")) continue
 let inFence = false
 fs.readFileSync(file, "utf8").split("\n").forEach((raw, i) => {
 if (/^\s*(```|~~~)/.test(raw)) {
 inFence = !inFence
 return
 }
 if (inFence) return // fenced samples may hold product copy
 const line = raw
 .replace(/`[^`]*`/g, "") // inline code likewise
 .replace(/\[[^\]]*\]\([^)]*\.zh\.md\)/g, "") // the bilingual twin's own label
 if (CJK.test(line)) {
 fail("doc-language", file, `line ${i + 1}: non-English developer-facing prose — translate it (code fences/spans are exempt)`)
 }
 })
}

/* ---------------------------------------- 7b. skill language (English prose) */

// The skill is developer-facing instruction: prose is English. Chinese is allowed only
// where it is *sample product copy* — inside code fences, inline code, or string literals
// of the sample apps — because that is what a generated mini-app shows the end user.
for (const file of mdFiles) {
 let inFence = false
 fs.readFileSync(file, "utf8").split("\n").forEach((raw, i) => {
 if (/^\s*(```|~~~)/.test(raw)) {
 inFence = !inFence
 return
 }
 if (inFence) return
 if (/^description:\s/.test(raw)) return // matching surface: bilingual trigger terms
 if (CJK.test(raw.replace(/`[^`]*`/g, ""))) {
 fail(
 "skill-language",
 file,
 `line ${i + 1}: Chinese in instruction prose — write the instruction in English and keep Chinese only inside code`
)
 }
 })
}
for (const file of sourceFiles) {
 fs.readFileSync(file, "utf8").split("\n").forEach((raw, i) => {
 const t = raw.trim()
 if (!/^(\/\/|\/\*|\*)/.test(t)) return // string literals may hold sample copy
 if (CJK.test(t)) fail("skill-language", file, `line ${i + 1}: Chinese comment in a sample — use English`)
 })
}

/* -------------------------------------------------------------------- report */

const byRule = (list) => {
 const groups = new Map()
 for (const item of list) {
 if (!groups.has(item.rule)) groups.set(item.rule, [])
 groups.get(item.rule).push(item)
 }
 return [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
}

console.log(
 `check:skill — ${mdFiles.length} md + ${sourceFiles.length} source files, ` +
 `${tools.size} tools, ${ctxKeys.size} ctx keys, ` +
 `${walk(contractsDir, (f) => f.endsWith(".md")).length} contracts`
)

for (const [rule, list] of byRule(errors)) {
 console.error(`\n✖ ${rule} (${list.length})`)
 for (const item of list.slice(0, 25)) console.error(` ${item.file}: ${item.detail}`)
 if (list.length > 25) console.error(` … ${list.length - 25} more`)
}
for (const [rule, list] of byRule(warnings)) {
 console.warn(`\n▲ ${rule} (${list.length})`)
 for (const item of list.slice(0, 12)) console.warn(` ${item.file}: ${item.detail}`)
 if (list.length > 12) console.warn(` … ${list.length - 12} more`)
}

if (errors.length) {
 console.error(`\ncheck:skill FAILED — ${errors.length} error(s), ${warnings.length} warning(s)`)
 process.exit(1)
}
console.log(`\ncheck:skill ok (${warnings.length} warning(s))`)
