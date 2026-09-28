#!/usr/bin/env node
/*
 * The design-docs lint (docs/plans/M0.md, ticket 01b; the reviews U3 and U6): the behaviour spec
 * and its wireframes must not drift back to names the plan retired. Run on every PR by web.yml.
 *
 * In docs/design/ (every .md and .svg):
 *   - a bare "ticket 20" (the ticket is 20a or 20b since session 02)
 *   - render/text.py   (the decode function is engine/text/decode.py)
 *   - app/keys         (the key map is web/src/ui/keys/)
 *   - make_dwg.py      (fixtures are one generator each, engine/fixtures/dwg/<name>.py)
 * In docs/design/m0-wireframes/ (the SVGs' text):
 *   - "MEP" as an exclusion reason (MEP sheets are confirmed like the rest, ADR 0040)
 *   - "Engine" as a viewer mode (the read drawing is "As read", the owner's ruling of 26 Sep 2026)
 *
 *   node scripts/lint-design-docs.mjs [docs/design]   exit 1 and a line per finding when any
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const EVERYWHERE = [
  { pattern: /\bticket 20(?![0-9a-z])/gi, why: 'ticket 20 is 20a (sign-in, projects, members) or 20b (the Drawing Set)' },
  { pattern: /render\/text\.py/g, why: 'the decode function is engine/text/decode.py' },
  { pattern: /app\/keys/g, why: 'the key map is web/src/ui/keys/' },
  { pattern: /make_dwg\.py/g, why: 'each fixture is its own generator, engine/fixtures/dwg/<name>.py' },
]

const EXCLUSION_WORDS = /\b(exclu\w*|leave out|left out|superseded|duplicate|cover|index|by others|for information|blank)\b/i

/** Stale text in one wireframe text run, if any. */
function staleWireframeText(text) {
  const t = text.trim()
  if (/\bMEP\b/.test(t) && EXCLUSION_WORDS.test(t)) return { found: t, why: '"MEP" is not an exclusion reason: MEP sheets are confirmed like the rest (ADR 0040)' }
  if (/^Engine$/.test(t) || /\bEngine\s*[|·]\s*Plot\b/.test(t) || /\bPlot\s*[|·]\s*Engine\b/.test(t)) {
    return { found: t === 'Engine' ? 'Engine' : t, why: 'the viewer mode is "As read", not "Engine" (the owner, 26 Sep 2026)' }
  }
  return undefined
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length
}

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...files(path))
    else if (/\.(md|svg)$/.test(name)) out.push(path)
  }
  return out
}

function decodeEntities(text) {
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

/** @returns {{ file: string, line: number, found: string, why: string }[]} */
export function lintDesignDocs(root) {
  const findings = []
  for (const path of files(root)) {
    const file = relative(root, path).split(sep).join('/')
    const text = readFileSync(path, 'utf8')
    for (const { pattern, why } of EVERYWHERE) {
      for (const m of text.matchAll(pattern)) findings.push({ file, line: lineOf(text, m.index), found: m[0], why })
    }
    if (file.startsWith('m0-wireframes/') && file.endsWith('.svg')) {
      for (const m of text.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)) {
        const stale = staleWireframeText(decodeEntities(m[1]))
        if (stale) findings.push({ file, line: lineOf(text, m.index), ...stale })
      }
    }
  }
  return findings
}

function main() {
  const web = fileURLToPath(new URL('..', import.meta.url))
  const root = process.argv[2] ?? join(web, '..', 'docs', 'design')
  const findings = lintDesignDocs(root)
  for (const f of findings) console.error(`docs/design/${f.file}:${f.line}  "${f.found}": ${f.why}`)
  if (findings.length) {
    console.error(`\nlint-design-docs: ${findings.length} stale reference${findings.length === 1 ? '' : 's'} in docs/design/`)
    process.exit(1)
  }
  console.log('lint-design-docs: docs/design/ holds no stale reference')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
