#!/usr/bin/env node
/*
 * Logical CSS only, in stylesheets (docs/design/m0-screens.md §1.8; ADR 0038). ESLint checks the
 * classes and inline styles in code (eslint/vextrus.js); this checks every .css file under src/
 * (a `canvas/` folder excepted, as the canvases are fixed left to right) for physical properties:
 * margin-left, padding-right, left, right, border-left, border-top-left-radius, text-align: left,
 * float: right, translateX(), and physical classes pulled in with @apply.
 *
 *   node scripts/lint-css.mjs        exit 1 and a line per finding when any
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { physicalClasses } from '../eslint/vextrus.js'

const PHYSICAL_PROPERTY =
  /(?<![\w-])((?:margin|padding|scroll-margin|scroll-padding)-(?:left|right)|left|right|border-(?:left|right)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius)\s*:/g
const SIDE_VALUE = /(?<![\w-])(text-align|float|clear)\s*:\s*(left|right)\b/g
const TRANSLATE_X = /\btranslate(?:X|3d)\(/g

/** Blanks comments but keeps line breaks, so findings keep their line numbers. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
}

/** @returns {{ line: number, found: string }[]} */
export function lintCss(css) {
  const findings = []
  stripComments(css)
    .split('\n')
    .forEach((text, i) => {
      const line = i + 1
      for (const m of text.matchAll(PHYSICAL_PROPERTY)) findings.push({ line, found: m[1] })
      for (const m of text.matchAll(SIDE_VALUE)) findings.push({ line, found: `${m[1]}: ${m[2]}` })
      for (const m of text.matchAll(TRANSLATE_X)) findings.push({ line, found: m[0] })
      const apply = text.match(/@apply\s+([^;]+)/)
      if (apply) for (const token of physicalClasses(apply[1])) findings.push({ line, found: token })
    })
  return findings
}

function cssFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      if (name !== 'canvas' && name !== 'node_modules') out.push(...cssFiles(path))
    } else if (name.endsWith('.css')) out.push(path)
  }
  return out
}

function main() {
  const web = fileURLToPath(new URL('..', import.meta.url))
  let failed = 0
  for (const file of cssFiles(join(web, 'src'))) {
    for (const f of lintCss(readFileSync(file, 'utf8'))) {
      failed++
      console.error(`${relative(web, file)}:${f.line}  "${f.found}" names a physical side; use its logical form (m0-screens §1.8)`)
    }
  }
  if (failed) {
    console.error(`\nlint-css: ${failed} physical propert${failed === 1 ? 'y' : 'ies'} in CSS`)
    process.exit(1)
  }
  console.log('lint-css: logical properties only')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
