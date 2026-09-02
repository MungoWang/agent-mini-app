/**
 * The functional taxonomy. The vocabulary (names, catalog order, one-line blurbs) is data —
 * packages/ui/catalog-families.json — while *membership* is declared per component as
 * `@family` JSDoc. Unknown or missing families fail generation.
 */
import fs from "node:fs"

export function loadFamilies(familiesPath) {
  const raw = JSON.parse(fs.readFileSync(familiesPath, "utf8"))
  const families = raw.families ?? []
  if (!families.length) throw new Error(`no families in ${familiesPath}`)
  return { families, names: new Set(families.map((f) => f.name)) }
}
