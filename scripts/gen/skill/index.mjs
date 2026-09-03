#!/usr/bin/env node
/**
 * Generate the mini-app UI reference from component source (TypeScript AST + JSDoc)
 * → skills/monkey-mini-app/references/{catalog.md,contracts/*.md} + packages/ui/ai/catalog.json.
 *
 * Inputs: packages/ui/src/** (AST + JSDoc), packages/ui/src/index.ts,
 *         packages/ui/catalog-families.json, packages/ui-examples/src/**
 * Writes: skills/monkey-mini-app/references/** (incl. examples/), packages/ui/ai/catalog.json
 * Side effects: repo tracked files — commit the regenerated diff
 * Run as: pnpm gen:skill (bundle: pnpm skill) · CI also asserts the tree is up to date
 *
 * Discovery is from source, so adding a component needs no change here: components come from
 * packages/ui/src/index.ts, L1 primitives from the components/ directory.
 *
 * constants.mjs vocabulary · families.mjs taxonomy · extract.mjs source → records · render.mjs records → artifacts
 * Rules and rationale: docs/contracts/skill-sync.md. Verified by `pnpm check:skill`.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { loadFamilies } from "./families.mjs"
import { buildRecords } from "./extract.mjs"
import { loadExamples, writeSkillExamples } from "./examples.mjs"
import { renderCatalog, renderCatalogJson, renderContract, renderFamilyContract } from "./render.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const uiRoot = path.join(repoRoot, "packages/ui")
const srcRoot = path.join(uiRoot, "src")
const skillRef = path.join(repoRoot, "skills/monkey-mini-app/references")
const contractsDir = path.join(skillRef, "contracts")
const catalogMdPath = path.join(skillRef, "catalog.md")
const catalogJsonPath = path.join(uiRoot, "ai/catalog.json")

function main() {
 const { families } = loadFamilies(path.join(uiRoot, "catalog-families.json"))
 const familyNames = new Set(families.map((f) => f.name))
 const { components, primitives } = buildRecords({ repoRoot, uiRoot, srcRoot })

 // One contract per file: an L1 primitive must not overwrite a block/product doc.
 const used = new Set(components.map((c) => c.slug))
 for (const f of primitives) {
 if (used.has(f.slug)) f.slug = `l1-${f.slug}`
 used.add(f.slug)
 }

 // Examples come from the ui-examples package; @exampleOf ties one to a component.
 const exRoot = path.join(repoRoot, "packages/ui-examples")
 const examples = loadExamples(exRoot)
 const subjects = new Map()
 for (const c of components) {
 subjects.set(c.name, c.slug)
 for (const p of c.parts ?? []) subjects.set(p.name, c.slug)
 for (const p of c.helpers ?? []) subjects.set(p.name, c.slug)
 }
 for (const f of primitives) {
 subjects.set(f.root, f.slug)
 for (const p of f.parts ?? []) subjects.set(p.name, f.slug)
 }
 const { bySubject, missingSubject } = writeSkillExamples({
 skillRef,
 examples,
 sharedRoot: path.join(exRoot, "src/shared"),
 examplesRoot: exRoot,
 subjectSlugs: new Set(subjects.keys()),
 })
 // resolve each record's examples through its slug
 const bySlug = new Map()
 for (const [name, slug] of subjects) {
 const list = bySubject.get(name)
 if (!list) continue
 const bucket = bySlug.get(slug) ?? []
 for (const e of list) if (!bucket.some((x) => x.href === e.href)) bucket.push(e)
 bySlug.set(slug, bucket)
 }

 fs.mkdirSync(contractsDir, { recursive: true })
 for (const file of fs.readdirSync(contractsDir)) {
 if (file.endsWith(".md")) fs.unlinkSync(path.join(contractsDir, file))
 }
 for (const c of components) {
 fs.writeFileSync(path.join(contractsDir, `${c.slug}.md`), renderContract(c, bySlug.get(c.slug) ?? []))
 }
 for (const f of primitives) {
 fs.writeFileSync(path.join(contractsDir, `${f.slug}.md`), renderFamilyContract(f, bySlug.get(f.slug) ?? []))
 }

 // One flat list of every documented component, for the catalog and the registry.
 const entries = [
 ...components.map((c) => ({ ...c })),
 ...primitives.map((f) => ({
 name: f.root,
 slug: f.slug,
 file: f.file,
 componentType: f.componentType,
 primitive: f.primitive,
 family: f.family,
 summary: f.summary,
 when: f.when,
 parts: f.parts,
 helpers: f.helpers,
 })),
 ]

 const badFamily = entries.filter((e) => !familyNames.has(e.family))
 if (badFamily.length) {
 console.error(
 `\n@family missing or unknown on ${badFamily.length}/${entries.length} component(s) — vocabulary: ${[...familyNames].join(" | ")}`
)
 for (const e of badFamily.slice(0, 40)) {
 console.error(` ${e.name} (${e.file}) → "${e.family || ""}"`)
 }
 if (badFamily.length > 40) console.error(` … ${badFamily.length - 40} more`)
 }

 if (missingSubject.length) {
 console.warn(
 `\n[gen:skill] WARNING @exampleOf does not match any component (${missingSubject.length}):\n` +
 missingSubject.map((m) => `  - ${m}`).join("\n") +
 "\n",
 )
 }
 fs.writeFileSync(catalogMdPath, renderCatalog(entries, families))
 fs.mkdirSync(path.dirname(catalogJsonPath), { recursive: true })
 fs.writeFileSync(
 catalogJsonPath,
 JSON.stringify(renderCatalogJson(entries, families), null, 2) + "\n"
)

 const withTypes = components.filter((c) => c.types?.length).length
 const parts = primitives.reduce((n, f) => n + f.parts.length + f.helpers.length, 0)
 console.log(
 `monkey-mini-app skill: ${entries.length} components in ${families.length} families ` +
 `(${components.length} contracts, ${withTypes} with related types; ${primitives.length} L1 files, ${parts} parts) ` +
 `→ skills/monkey-mini-app/references/`
)
 if (badFamily.length) process.exitCode = 1
}

main()
