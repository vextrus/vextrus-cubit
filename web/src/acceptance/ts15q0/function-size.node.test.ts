/*
 * S15-Q0: the web's size and complexity ratchet (the ticket: "a complexity and size ratchet with a
 * committed baseline (a new over-limit function fails CI; existing ones may only shrink)"; web: eslint
 * max-lines-per-function / complexity with a baseline).
 *
 * Run through the web's real lint config (`npm run lint`, which fails on any problem: --max-warnings
 * 0), on planted code: a new function far past any limit fails (300 lines; 30 branches in 33 lines),
 * a small one passes, and the longest function in src today, grown by 20 lint-clean lines in its own
 * file, fails. The limits and the baseline's form are the builder's.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const web = fileURLToPath(new URL('../../..', import.meta.url))
const eslint = new ESLint({ cwd: web })
const PLANTED = 'src/ui/PlantedQ0.ts'

async function problems(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: join(web, filePath) })
  return (result?.messages ?? []).map((m) => `${m.ruleId ?? 'fatal'}: ${m.message}`)
}

function longFunction(): string {
  const body = Array.from({ length: 300 }, (_, i) => `  total += ${i}`)
  return ['export function plantedQ0Long(): number {', '  let total = 0', ...body, '  return total', '}', ''].join('\n')
}

function branchyFunction(): string {
  const branches = Array.from({ length: 30 }, (_, i) => `  if (n === ${i}) return ${i}`)
  return ['export function plantedQ0Branchy(n: number): number {', ...branches, '  return -1', '}', ''].join('\n')
}

interface Found {
  file: string
  name: string
  lines: number
  bodyStart: number
}

function isProduction(file: string): boolean {
  if (!/\.tsx?$/.test(file) || /\.(test|gen|fixture|d)\.tsx?$/.test(file)) return false
  return !file.startsWith('test/') && !file.startsWith('acceptance/') && !file.includes('/acceptance/')
}

function functionsOf(file: string): Found[] {
  const text = readFileSync(join(web, 'src', file), 'utf8')
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind)
  const found: Found[] = []
  const line = (at: number) => source.getLineAndCharacterOfPosition(at).line
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node) && 'body' in node && node.body && ts.isBlock(node.body as ts.Node)) {
      const body = node.body as ts.Block
      const name = (node as ts.FunctionDeclaration).name?.getText(source) ?? '(anonymous)'
      found.push({ file, name, lines: line(node.getEnd()) - line(node.getStart(source)) + 1, bodyStart: body.getStart(source) + 1 })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function longestFunction(): Found {
  const files = readdirSync(join(web, 'src'), { recursive: true, encoding: 'utf8' }).filter(isProduction).sort()
  const all = files.flatMap(functionsOf)
  return all.reduce((best, f) => (f.lines > best.lines ? f : best))
}

function grown(found: Found): string {
  const text = readFileSync(join(web, 'src', found.file), 'utf8')
  const added = Array.from({ length: 20 }, (_, i) => `\n  const _grownQ0${i} = ${i}`).join('')
  return text.slice(0, found.bodyStart) + added + text.slice(found.bodyStart)
}

describe('the web’s size and complexity gate (npm run lint)', () => {
  it('fails a new function of 300 lines', async () => {
    expect(await problems(longFunction(), PLANTED)).not.toEqual([])
  })

  it('fails a new function of 30 branches', async () => {
    expect(await problems(branchyFunction(), PLANTED)).not.toEqual([])
  })

  it('passes a new small function', async () => {
    expect(await problems('export function plantedQ0Small(n: number): number {\n  return n + 1\n}\n', PLANTED)).toEqual([])
  })
})

describe('the ratchet: the longest function today may only shrink', () => {
  const found = longestFunction()
  const file = `src/${found.file}`

  it('passes the longest function as it is', async () => {
    expect(await problems(readFileSync(join(web, file), 'utf8'), file)).toEqual([])
  })

  it('fails the longest function grown by 20 lines', async () => {
    expect(await problems(grown(found), file), `${file} ${found.name}, ${found.lines} lines`).not.toEqual([])
  })
})
