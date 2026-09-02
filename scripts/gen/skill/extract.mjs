/**
 * Read the UI library and produce component records: own props with provenance, related
 * types, and one entry per L1 primitive module. Nothing here formats markdown.
 *
 * Props are classified by **declaration site** (`propOrigin` + `isPassthroughProp`), never by
 * a hand-maintained name list — rationale in docs/contracts/skill-sync.md.
 */
import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

import { LAYER_TYPE, SKIP_FILES, SKIP_TYPE_NAMES } from "./constants.mjs"

/** Names every HTML element already takes; filled from @types/react before extraction. */
export const elementAttrNames = new Set()


/**
 * Prop provenance — how a prop got into a component's props bag.
 *
 *   own    : declared by us (`packages/ui/src/**`) or inlined in our props type
 *   vendor : declared by a component library we wrap (`@base-ui/react/**` Props …)
 *   dom    : inherited HTML / ARIA / event members from `typescript/lib/lib.*.d.ts`
 *            or `@types/react` — identical on every component, so never listed;
 *            the base type is named once instead (see `domBasesOf`).
 *
 * No name lists: the compiler already knows where each symbol came from.
 */
export function propOrigin(decl) {
  const file = decl.getSourceFile?.()?.fileName ?? ""
  if (isOurUiSource(file)) return "own"
  if (isLibDts(file) || isReactTypesDts(file)) return "dom"
  if (file.includes(`${path.sep}node_modules${path.sep}`) || file.includes("/node_modules/")) {
    return "vendor"
  }
  return "own"
}

export function isOurUiSource(fileName) {
  return (
    fileName.includes(`${path.sep}packages${path.sep}ui${path.sep}src${path.sep}`) ||
    fileName.includes("/packages/ui/src/")
  )
}

/** typescript/lib/lib.dom.d.ts, lib.es5.d.ts, … (DOM + String/Function prototypes). */
export function isLibDts(fileName) {
  return /[\\/]typescript[\\/]lib[\\/]lib\./.test(fileName)
}

/** @types/react — HTMLAttributes / AriaAttributes / DOMAttributes / RefAttributes bags. */
export function isReactTypesDts(fileName) {
  return /[\\/]@types[\\/]react[\\/]/.test(fileName)
}

/** `React.AriaAttributes` → `AriaAttributes`; works on nodes without a sourceFile link. */
export function entityNameText(node) {
  if (!node) return ""
  if (ts.isIdentifier(node)) return node.text
  if (ts.isQualifiedName(node)) return entityNameText(node.right)
  return ""
}

export function indexReactAttributeBags(program) {
  elementAttrNames.clear()
  for (const sourceFile of program.getSourceFiles()) {
    if (!isReactTypesDts(sourceFile.fileName)) continue

    const byName = new Map()
    const collectInterfaces = (node) => {
      if (ts.isInterfaceDeclaration(node)) byName.set(node.name.text, node)
      ts.forEachChild(node, collectInterfaces)
    }
    collectInterfaces(sourceFile)

    const root = byName.get("HTMLAttributes")
    if (!root) continue
    const queue = [root]
    const visited = new Set()
    while (queue.length) {
      const iface = queue.shift()
      if (!iface || visited.has(iface.name.text)) continue
      visited.add(iface.name.text)
      for (const member of iface.members) {
        if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue
        const name = member.name
        // Read the identifier directly — getText() needs an intact sourceFile link.
        const text =
          name && (ts.isIdentifier(name) || ts.isStringLiteral(name))
            ? name.text
            : null
        if (text) elementAttrNames.add(text)
      }
      for (const clause of iface.heritageClauses ?? []) {
        for (const base of clause.types) {
          const dep = byName.get(entityNameText(base.expression))
          if (dep) queue.push(dep)
        }
      }
    }
  }
}

/** Presentation / event passthrough inherited from the DOM, wherever it was re-declared. */
export function isPassthroughProp(name, decl) {
  return propOrigin(decl) !== "own" && elementAttrNames.has(name)
}

/** Tidy a type-reference snippet picked up verbatim from source. */
export function tidyType(text) {
  return String(text)
    .replace(/\s*</g, "<")
    .replace(/<\s*/g, "<")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s*>/g, ">")
    .trim()
}

/**
 * Name the DOM bases a component extends, read from its **declared props node**.
 * `Omit<React.ComponentProps<"div">, "children" | "title"> & { variables: … }` yields
 * that `Omit<…>` as one line instead of 300 property rows. Walking the type node
 * (our alias → RHS, our interface → heritage clauses, intersection → members) is
 * what keeps a contract honest about what the component *is*; flattened properties
 * alone cannot tell "our API" from "inherited HTML".
 */
export function domBasesOf(checker, sig) {
  const out = []
  const seen = new Set()

  /** Every property of this type is an inherited HTML / ARIA / event member. */
  function isDomBag(type) {
    const props = type?.getProperties?.() ?? []
    if (!props.length) return false
    return props.every((sym) => {
      const decl = sym.valueDeclaration ?? sym.declarations?.[0]
      return decl ? propOrigin(decl) === "dom" : false
    })
  }

  function walk(node, depth) {
    if (!node || depth > 4) return
    if (ts.isIntersectionTypeNode(node) || ts.isUnionTypeNode(node)) {
      for (const member of node.types) walk(member, depth + 1)
      return
    }
    if (ts.isTypeLiteralNode(node)) return // our own inline members
    if (!ts.isTypeReferenceNode(node)) return

    const sym = checker.getSymbolAtLocation(node.typeName)
    const decl = sym?.declarations?.[0]
    if (decl && isOurSourceNode(decl)) {
      if (ts.isTypeAliasDeclaration(decl)) {
        walk(decl.type, depth + 1)
        return
      }
      if (ts.isInterfaceDeclaration(decl)) {
        for (const clause of decl.heritageClauses ?? []) {
          for (const base of clause.types) walk(base, depth + 1)
        }
        return
      }
    }

    // Not ours: vendor Props (Base UI `Root.Props`) are the real API and stay in the
    // table; only react/lib attribute bags collapse into a base line.
    if (!isDomBag(checker.getTypeAtLocation(node))) return
    const text = tidyType(node.getText())
    if (text && !seen.has(text)) {
      seen.add(text)
      out.push(text)
    }
  }

  // Works for `function Foo(props: X)` and for `const Foo = VendorPrimitive.Root`:
  // both expose the props annotation through the first parameter's declaration.
  const paramDecl = sig?.getParameters?.()[0]?.declarations?.[0]
  walk(paramDecl && ts.isParameter(paramDecl) ? paramDecl.type : undefined, 0)
  return out
}

export function isOurSourceNode(node) {
  const file = node.getSourceFile?.()?.fileName ?? ""
  return isOurUiSource(file)
}

/**
 * L1 primitives (`packages/ui/src/components/*`) are compound — `<Dialog>` +
 * `<DialogTrigger>` + `<DialogContent>` — and are exported through a trailing
 * `export { … }` list, which the generic statement walk cannot see. Each module
 * gets one contract listing every part.
 *
 * Nothing here is hand-maintained: modules come from the directory, the family
 * name is the longest common prefix of its exported components (`Dialog` wins over
 * `DialogTrigger` because every sibling starts with it), and a module whose parts
 * share no prefix just reports its own file name.
 */
export function pascalCase(slug) {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("")
}

/** Longest common prefix of component names, or "" when they are unrelated. */
export function commonPrefix(names) {
  if (!names.length) return ""
  let prefix = names[0]
  for (const name of names.slice(1)) {
    while (prefix && !name.startsWith(prefix)) prefix = prefix.slice(0, -1)
  }
  return prefix.length >= 3 ? prefix : ""
}

export function kebab(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
}

export function listIndexModules(srcRoot) {
  const indexPath = path.join(srcRoot, "index.ts")
  const text = fs.readFileSync(indexPath, "utf8")
  const modules = []
  const re = /export \* from "\.\/(composites|products|blocks)\/([^"]+)"/g
  let match
  while ((match = re.exec(text))) {
    const layer = match[1]
    const name = match[2]
    if (SKIP_FILES.has(name)) continue
    const base = path.join(srcRoot, layer, name)
    const file = [".tsx", ".ts"]
      .map((ext) => base + ext)
      .find((candidate) => fs.existsSync(candidate))
    if (!file) continue
    modules.push({ layer, name, file })
  }
  return modules
}

/**
 * Every module under `packages/ui/src/components/` is an L1 primitive — discovered
 * from the directory, so adding a component file needs no change here.
 */
export function listPrimitiveModules(srcRoot) {
  const dir = path.join(srcRoot, "components")
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && !SKIP_FILES.has(f.replace(/\.tsx?$/, "")))
    .map((f) => ({
      layer: "components",
      name: f.replace(/\.tsx?$/, ""),
      file: path.join(dir, f),
    }))
}

export function createProgram(uiRoot, files) {
  const configPath = path.join(uiRoot, "tsconfig.json")
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    uiRoot
  )
  return ts.createProgram({
    rootNames: [...new Set([...parsed.fileNames, ...files])],
    options: parsed.options,
  })
}

export function jsDocInfo(node) {
  const comments = ts.getJSDocCommentsAndTags(node)
  let summary = ""
  const examples = []
  let when = ""
  let family = ""
  for (const comment of comments) {
    if (!ts.isJSDoc(comment)) continue
    const raw = comment.comment
    if (typeof raw === "string") summary = raw.trim()
    else if (Array.isArray(raw))
      summary = raw.map((p) => (typeof p === "string" ? p : p.text)).join("").trim()
    for (const tag of comment.tags ?? []) {
      const name = tag.tagName.text
      const body =
        typeof tag.comment === "string"
          ? tag.comment.trim()
          : Array.isArray(tag.comment)
            ? tag.comment.map((p) => (typeof p === "string" ? p : p.text)).join("").trim()
            : ""
      if (name === "example" && body) examples.push(body.replace(/^\n/, ""))
      if ((name === "when" || name === "ai") && body) when = body
      if (name === "family" && body) family = body
    }
  }
  return { summary, examples, when, family }
}

export function isComponentName(name) {
  return /^[A-Z]/.test(name)
}

export function typeString(checker, type, node, { expandAlias = false } = {}) {
  if (expandAlias) {
    const text = aliasSourceText(type)
    if (text) return text.replace(/\s+/g, " ").trim()
  }
  return checker
    .typeToString(
      type,
      node,
      ts.TypeFormatFlags.NoTruncation |
        ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope
    )
    .replace(/\s+/g, " ")
    .trim()
}

/** Prefer the original `type Foo = …` RHS from source — expands unions cleanly. */
export function aliasSourceText(type) {
  const sym = type.aliasSymbol ?? type.symbol
  if (!sym) return null
  const decl = sym.declarations?.[0]
  if (decl && ts.isTypeAliasDeclaration(decl) && decl.type) {
    return decl.type.getText()
  }
  if (decl && ts.isInterfaceDeclaration(decl)) return null
  return null
}

export function isOptionalSymbol(symbol, decl) {
  return (
    (symbol.flags & ts.SymbolFlags.Optional) !== 0 ||
    (decl && ts.isPropertySignature(decl) && !!decl.questionToken) ||
    (decl && ts.isPropertyDeclaration(decl) && !!decl.questionToken) ||
    (decl && ts.isParameter(decl) && !!decl.questionToken)
  )
}

export function fieldsFromObjectType(checker, type, node) {
  const fields = []
  let dropped = 0
  const target = type.getNonNullableType()
  // Skip primitives / callables with no useful props
  if (
    target.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Boolean |
      ts.TypeFlags.ESSymbol |
      ts.TypeFlags.Void |
      ts.TypeFlags.Null |
      ts.TypeFlags.Undefined |
      ts.TypeFlags.Never)
  ) {
    return fields
  }
  for (const symbol of target.getProperties()) {
    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0]
    if (!decl) continue
    // Single source of truth for what counts as noise: where the symbol was declared.
    // (lib.d.ts / @types/react → inherited HTML; ours or a vendor component lib → API.)
    if (propOrigin(decl) === "dom" || isPassthroughProp(symbol.name, decl)) {
      dropped++
      continue
    }
    const propType = checker.getTypeOfSymbolAtLocation(symbol, decl)
    let doc = ""
    const docs = symbol.getDocumentationComment(checker)
    if (docs?.length) doc = docs.map((d) => d.text).join("").trim()
    fields.push({
      name: symbol.name,
      type: typeString(checker, propType, decl),
      optional: isOptionalSymbol(symbol, decl),
      doc,
      _type: propType,
      _node: decl,
    })
  }
  const out = fields.sort((a, b) => a.name.localeCompare(b.name))
  out.dropped = dropped
  return out
}

/**
 * Props of a component *value* — from its call signature, so it works the same for
 * a local `function Dialog(props: DialogPrimitive.Root.Props)` and for a re-exported
 * `const Select = SelectPrimitive.Root`.
 */
export function propsFromSignature(checker, sig, node) {
  const empty = { props: [], propType: null, dropped: 0, bases: [] }
  if (!sig) return empty
  const params = sig.getParameters()
  if (!params.length) return empty
  const propSym = params[0]
  const where = propSym.valueDeclaration ?? propSym.declarations?.[0] ?? node
  const propType = checker.getTypeOfSymbolAtLocation(propSym, where)
  const raw = fieldsFromObjectType(checker, propType, where)
  const props = raw.map(({ _type, _node, ...rest }) => rest)
  props.dropped = raw.dropped
  return {
    props,
    propType,
    node: where,
    dropped: raw.dropped,
    bases: domBasesOf(checker, sig),
  }
}

/** First call signature of a value's type (component functions, forwardRef, …). */
export function componentSignature(checker, decl) {
  const type = checker.getTypeAtLocation(decl)
  return type?.getCallSignatures?.()[0] ?? null
}

/**
 * Unwrap Array / Promise / Readonly / union nullish to the object-ish core.
 */
export function unwrapType(type) {
  let t = type.getNonNullableType()
  // union of T | null already handled; also T | undefined
  if (t.isUnion?.()) {
    const parts = t.types.filter(
      (x) =>
        !(x.flags & (ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void))
    )
    if (parts.length === 1) t = parts[0]
  }
  // Array<T> / T[]
  if (checkerIsArrayLike(t)) {
    const args = t.typeArguments ?? t.resolvedTypeArguments
    if (args?.[0]) return unwrapType(args[0])
    const indexed = t.getNumberIndexType?.()
    if (indexed) return unwrapType(indexed)
  }
  // Promise<T>
  const ref = t.symbol?.name
  if ((ref === "Promise" || ref === "Readonly") && t.typeArguments?.[0]) {
    return unwrapType(t.typeArguments[0])
  }
  return t
}

export function checkerIsArrayLike(type) {
  const name = type.symbol?.name ?? type.aliasSymbol?.name
  if (name === "Array" || name === "ReadonlyArray") return true
  if (type.flags & ts.TypeFlags.Object) {
    const obj = type
    if (obj.objectFlags & ts.ObjectFlags.Reference) {
      const tn = obj.target?.symbol?.name
      if (tn === "Array" || tn === "ReadonlyArray") return true
    }
  }
  return false
}

export function typeAliasName(type) {
  return type.aliasSymbol?.name ?? type.symbol?.name ?? null
}

export function shouldExpandName(name) {
  if (!name) return false
  if (SKIP_TYPE_NAMES.has(name)) return false
  if (!/^[A-Z]/.test(name)) return false
  // skip DOM / React namespaces
  if (name.startsWith("React") || name.startsWith("JSX")) return false
  if (name.endsWith("Event") && name !== "CalendarEvent") return false
  return true
}

/** Only expand types declared inside our package source. */
export function isPackageUiType(type) {
  const sym = type.aliasSymbol ?? type.symbol
  if (!sym) return false
  const decls = sym.getDeclarations?.() ?? sym.declarations ?? []
  for (const d of decls) {
    const file = d.getSourceFile?.()?.fileName ?? ""
    if (file.includes(`${path.sep}packages${path.sep}ui${path.sep}src${path.sep}`))
      return true
    // also accept when running with forward slashes
    if (file.includes("/packages/ui/src/")) return true
  }
  return false
}

/**
 * Collect expandable named types starting from prop types + file exports.
 * BFS so nested KanbanCard → KanbanComment is included.
 */
export function collectRelatedTypes(checker, seedTypes, max = 24) {
  const out = []
  const seen = new Set()
  const queue = []

  function enqueue(type, hintName) {
    if (!type || out.length + queue.length >= max) return
    const core = unwrapType(type)
    const name = hintName || typeAliasName(core) || typeAliasName(type)
    if (!shouldExpandName(name)) return
    if (seen.has(name)) return
    // Prefer package declarations; allow alias name from our package only
    if (!isPackageUiType(core) && !isPackageUiType(type)) return
    // must look like a struct (has properties) or a string/union alias we still want
    const fields = fieldsFromObjectType(checker, core, undefined)
    const isUnion =
      core.isUnion?.() &&
      core.types.every(
        (t) =>
          t.flags &
          (ts.TypeFlags.StringLiteral |
            ts.TypeFlags.NumberLiteral |
            ts.TypeFlags.BooleanLiteral |
            ts.TypeFlags.EnumLiteral |
            ts.TypeFlags.Undefined |
            ts.TypeFlags.Null |
            ts.TypeFlags.String |
            ts.TypeFlags.Number |
            ts.TypeFlags.Boolean)
      )
    if (!fields.length && !isUnion) {
      // alias to primitive or opaque — still record one-liner
      const text = typeString(checker, type.aliasSymbol ? type : core, undefined, {
        expandAlias: true,
      })
      if (text) {
        seen.add(name)
        out.push({ name, kind: "alias", text, fields: [] })
      }
      return
    }
    seen.add(name)
    queue.push({ name, core, fields, isUnion, original: type, dropped: fields.dropped })
  }

  for (const t of seedTypes) enqueue(t)

  while (queue.length && out.length < max) {
    const item = queue.shift()
    if (item.isUnion) {
      out.push({
        name: item.name,
        kind: "union",
        text: typeString(
          checker,
          item.original?.aliasSymbol ? item.original : item.core,
          undefined,
          { expandAlias: true }
        ),
        fields: [],
      })
      continue
    }
    const cleanFields = item.fields.map(({ _type, _node, ...rest }) => rest)
    out.push({
      name: item.name,
      kind: "object",
      fields: cleanFields,
      text: null,
      dropped: item.dropped,
    })
    // nest: enqueue field types
    for (const f of item.fields) {
      if (f._type) enqueue(f._type)
    }
  }
  return out
}

export function exportedTypesFromFile(checker, sourceFile) {
  const types = []
  for (const stmt of sourceFile.statements) {
    if (!hasExport(stmt)) continue
    if (ts.isTypeAliasDeclaration(stmt) && isComponentName(stmt.name.text)) {
      const type = checker.getTypeAtLocation(stmt)
      // For `type X = { ... }` getTypeAtLocation on the decl is the alias type
      const sym = checker.getSymbolAtLocation(stmt.name)
      const t = sym ? checker.getDeclaredTypeOfSymbol(sym) : type
      types.push(t)
    }
    if (ts.isInterfaceDeclaration(stmt) && isComponentName(stmt.name.text)) {
      const sym = checker.getSymbolAtLocation(stmt.name)
      if (sym) types.push(checker.getDeclaredTypeOfSymbol(sym))
    }
  }
  return types
}

export function propTypeSeeds(checker, sig) {
  if (!sig) return []
  const params = sig.getParameters()
  if (!params.length) return []
  const propSym = params[0]
  const where = propSym.valueDeclaration ?? propSym.declarations?.[0]
  if (!where) return []
  const propType = checker.getTypeOfSymbolAtLocation(propSym, where)
  const seeds = [propType]
  for (const field of fieldsFromObjectType(checker, propType, where)) {
    if (field._type) seeds.push(field._type)
  }
  return seeds
}

export function extractFromFile(program, module, repoRoot) {
  const sourceFile = program.getSourceFile(module.file)
  if (!sourceFile) return []
  const checker = program.getTypeChecker()
  const fileExportedTypes = exportedTypesFromFile(checker, sourceFile)
  const components = []

  function pushComponent(name, node, propsNode) {
    if (!isComponentName(name)) return
    const doc = jsDocInfo(node)
    let props = []
    let seeds = [...fileExportedTypes]
    const fn = propsNode && ts.isFunctionLike(propsNode) ? propsNode : ts.isFunctionLike(node) ? node : null
    let dropped = 0
    let bases = []
    if (fn) {
      const extracted = propsFromSignature(
        checker,
        checker.getSignatureFromDeclaration(fn),
        fn
      )
      props = extracted.props
      dropped = extracted.dropped
      bases = extracted.bases
      seeds.push(...propTypeSeeds(checker, checker.getSignatureFromDeclaration(fn)))
    }
    // Don't treat the component's own inline props bag as a named type dump
    // unless it has an alias name like FooProps
    const related = collectRelatedTypes(checker, seeds).filter(
      (t) => t.name !== name && t.name !== `${name}Props`
    )

    components.push({
      name,
      layer: module.layer,
      componentType: LAYER_TYPE[module.layer] ?? module.layer,
      primitive: module.layer === "components",
      family: doc.family,
      file: path.relative(repoRoot, module.file),
      slug: kebab(name),
      module: module.name,
      summary: doc.summary,
      when: doc.when,
      examples: doc.examples,
      props,
      dropped,
      bases,
      types: related,
    })
  }

  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && hasExport(stmt)) {
      pushComponent(stmt.name.text, stmt, stmt)
      continue
    }
    if (ts.isVariableStatement(stmt) && hasExport(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        const init = decl.initializer
        if (!init) continue
        if (
          ts.isArrowFunction(init) ||
          ts.isFunctionExpression(init) ||
          ts.isCallExpression(init)
        ) {
          const fn =
            ts.isCallExpression(init) &&
            init.arguments[0] &&
            (ts.isArrowFunction(init.arguments[0]) ||
              ts.isFunctionExpression(init.arguments[0]))
              ? init.arguments[0]
              : ts.isArrowFunction(init) || ts.isFunctionExpression(init)
                ? init
                : null
          if (fn) pushComponent(decl.name.text, stmt, fn)
          else if (isComponentName(decl.name.text))
            pushComponent(decl.name.text, stmt, null)
        }
      }
    }
  }
  return components
}

export function hasExport(node) {
  return !!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/* --------------------------------------------------- L1 primitive families */

/**
 * One contract per L1 module. Parts and the family name are derived, never listed:
 * exported component names → longest common prefix (`Dialog`, `AlertDialog`,
 * `Chart`); a module with no shared prefix keeps its file name PascalCase.
 */
export function extractPrimitiveModule(program, module, repoRoot) {
  const sourceFile = program.getSourceFile(module.file)
  if (!sourceFile) return null
  const checker = program.getTypeChecker()

  // L1 modules export through a trailing `export { A, B, … }`, invisible to a
  // statement-level `export` modifier check — index every top-level declaration,
  // then keep exactly what the module exports.
  const exported = new Set()
  const decls = new Map()
  const remember = (name, node) => {
    if (!decls.has(name)) decls.set(name, node)
  }
  for (const stmt of sourceFile.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      remember(stmt.name.text, stmt)
      if (hasExport(stmt)) exported.add(stmt.name.text)
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        remember(d.name.text, d)
        if (hasExport(stmt)) exported.add(d.name.text)
      }
    } else if (ts.isExportDeclaration(stmt) && ts.isNamedExports(stmt.exportClause)) {
      for (const e of stmt.exportClause.elements) exported.add(e.name.text)
    }
  }

  const parts = []
  const helpers = []
  for (const name of [...exported].sort()) {
    const decl = decls.get(name)
    if (!decl) continue // pure re-export of a vendor part (SelectValue, …)
    const doc = jsDocInfo(decl)
    const sig = componentSignature(checker, decl)
    const extracted = propsFromSignature(checker, sig, decl)
    const entry = {
      name,
      props: extracted.props,
      dropped: extracted.dropped,
      bases: extracted.bases,
      summary: doc.summary,
      when: doc.when,
      family: doc.family,
      examples: doc.examples,
    }
    if (isComponentName(name)) parts.push(entry)
    else helpers.push(entry)
  }
  if (!parts.length && !helpers.length) return null

  const names = parts.map((p) => p.name)
  // Compound root, in order of trust: the part matching the file name
  // (`scroll-area.tsx` → `ScrollArea`), then the shared prefix when that prefix is
  // itself a part (`Dialog`), then the prefix as a label only (`Chart`, `Resizable`).
  // Parts inherit the root's `@family` / docs.
  const fromFile = pascalCase(module.name)
  const prefix = commonPrefix(names)
  const rootName =
    names.length === 1
      ? names[0]
      : [fromFile, prefix].find((n) => names.includes(n)) ?? prefix ?? fromFile
  // Docs + taxonomy are declared on the module's primary part. When the compound
  // root is not itself an export (`Chart` → ChartContainer, `Resizable` → …), take
  // the part that carries the annotation instead of whatever sorts first.
  const rootPart =
    parts.find((p) => p.name === rootName) ??
    parts.find((p) => p.family) ??
    parts.find((p) => p.summary) ??
    parts[0]
  const examples = rootPart?.examples?.length
    ? rootPart.examples
    : parts.map((p) => p.examples).flat().filter(Boolean)

  return {
    root: rootName,
    family: rootPart?.family ?? "",
    componentType: "component",
    primitive: true,
    slug: module.name,
    file: path.relative(repoRoot, module.file),
    summary: rootPart?.summary ?? "",
    when: rootPart?.when ?? "",
    parts,
    examples,
    helpers,
  }
}

/**
 * Read the library and return everything the renderers need. Roots are passed in so the
 * module never guesses where the repo lives.
 */
export function buildRecords({ repoRoot, uiRoot, srcRoot }) {
  const modules = [...listIndexModules(srcRoot), ...listPrimitiveModules(srcRoot)]
  const program = createProgram(uiRoot, modules.map((m) => m.file))
  // The DOM-attribute vocabulary must exist before any props are classified.
  indexReactAttributeBags(program)

  const components = []
  const primitives = []
  for (const mod of modules) {
    if (mod.layer === "components") {
      const family = extractPrimitiveModule(program, mod, repoRoot)
      if (family) primitives.push(family)
      continue
    }
    components.push(...extractFromFile(program, mod, repoRoot))
  }

  const seen = new Set()
  const unique = components.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)))
  return { components: unique, primitives }
}
