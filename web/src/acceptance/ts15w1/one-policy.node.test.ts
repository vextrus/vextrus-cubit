/*
 * Ticket S15-W1's acceptance test, one policy (#542: "One query policy"; owns "data modules' retry";
 * the orchestrator's pin: "one retry policy module every data module uses (the copies gone)"). On main
 * the rule "a refusal is an answer, an unreachable server keeps being tried" is written in
 * src/app/router.ts and copied into takeoff/data.ts, app/session.ts, members/data.ts,
 * drawing-set/data.ts, with variants inline in members/ActsPanel.tsx and takeoff/SheetLook.tsx.
 *
 * A file writes a retry rule when a query's or a mutation's `retry` or `retryDelay` option is given a
 * function, a count or `true` that the file itself defines (inline, or declared in the file); `retry: false` (never try again) and a rule
 * imported from elsewhere are not rules of its own. Which module holds the one rule, and its names,
 * are the builder's: at most one file under src/ may write one.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const NAMES = new Set(['retry', 'retryDelay'])

function sources(folder: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) {
      if (name === 'acceptance' || name === 'test' || name === 'node_modules') continue
      out.push(...sources(path))
    } else if (/\.tsx?$/.test(name) && !/\.(test|node\.test|browser\.test|tz\.test)\.tsx?$/.test(name) && !/\.(gen|fixture|d)\.ts$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

const OPTION_KEYS = new Set(['queryKey', 'queryFn', 'mutationFn', 'initialPageParam'])

/** An object literal of a query's or a mutation's options (not, say, a hook's own `retry` handle). */
function isOptions(object: ts.Node): boolean {
  if (!ts.isObjectLiteralExpression(object)) return false
  const keys = object.properties.map((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : ''))
  if (keys.some((k) => OPTION_KEYS.has(k))) return true
  const parent = object.parent
  if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name) && ['queries', 'mutations'].includes(parent.name.text)) return true
  if (ts.isCallExpression(parent) && parent.arguments.includes(object as ts.Expression)) {
    const callee = parent.expression
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : ''
    return /Query|Queries|Mutation|queryOptions/.test(name)
  }
  return false
}

const isRule = (node: ts.Node | undefined): boolean =>
  !!node &&
  (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isNumericLiteral(node) || node.kind === ts.SyntaxKind.TrueKeyword)

/** The lines where the file writes a retry rule of its own. */
function rulesIn(path: string): number[] {
  const text = readFileSync(path, 'utf8')
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const local = new Map<string, ts.Node>() // functions and values declared in the file, by name
  const uses: { name: string; at: ts.Node }[] = []
  const lines: number[] = []
  const line = (n: ts.Node) => file.getLineAndCharacterOfPosition(n.getStart()).line + 1
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) local.set(node.name.text, node)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) local.set(node.name.text, node.initializer)
    if (ts.isPropertyAssignment(node) && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && NAMES.has(node.name.text) && isOptions(node.parent)) {
      if (isRule(node.initializer)) lines.push(line(node))
      else if (ts.isIdentifier(node.initializer)) uses.push({ name: node.initializer.text, at: node })
    }
    if (ts.isShorthandPropertyAssignment(node) && NAMES.has(node.name.text) && isOptions(node.parent)) uses.push({ name: node.name.text, at: node })
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name) && NAMES.has(node.name.text) && isOptions(node.parent)) lines.push(line(node))
    ts.forEachChild(node, visit)
  }
  visit(file)
  for (const use of uses) {
    const declared = local.get(use.name)
    if (declared && (ts.isFunctionDeclaration(declared) || isRule(declared))) lines.push(line(use.at))
  }
  return lines
}

describe('one query policy', () => {
  it('writes the retry rule in one module only: no data module keeps its own copy', () => {
    const files = sources(SRC)
    expect(files.length, 'source files found under src/').toBeGreaterThan(50)
    const writers = files
      .map((path) => ({ file: relative(SRC, path), lines: rulesIn(path) }))
      .filter((w) => w.lines.length > 0)
      .map((w) => `${w.file}:${w.lines.join(',')}`)
    expect(writers.length, `files writing a retry rule of their own: ${writers.join('; ')}`).toBeLessThanOrEqual(1)
  })
})
