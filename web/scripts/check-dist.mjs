#!/usr/bin/env node
/*
 * After `vite build`: what must never ship is absent from the production bundle
 * (docs/design/m0-screens.md §1.8 and §8; docs/plans/M0.md, 01b):
 *   - the test-only pseudo right-to-left language (its tag, en-XB, and its accent table);
 *   - the development-only specimen route (its path, its markers and its catalogue's words).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = fileURLToPath(new URL('..', import.meta.url))
const dist = join(web, 'dist')

const FORBIDDEN = [
  { text: 'en-XB', why: 'the test-only pseudo right-to-left language' },
  { text: 'áƀçðéƒĝĥ', why: 'the pseudo language’s accent table' },
  { text: '/dev/specimen', why: 'the development-only specimen route' },
  { text: 'data-specimen', why: 'the specimen page' },
  { text: 'Specimen of the shared pieces', why: 'the specimen’s catalogue' },
]

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

let failed = 0
const all = files(dist).filter((f) => /\.(js|css|html)$/.test(f))
if (!all.some((f) => f.endsWith('index.html'))) {
  console.error('check-dist: dist/index.html is missing; did `vite build` run?')
  process.exit(1)
}
for (const file of all) {
  const text = readFileSync(file, 'utf8')
  for (const { text: needle, why } of FORBIDDEN) {
    if (text.includes(needle)) {
      failed++
      console.error(`check-dist: ${relative(web, file)} holds "${needle}" (${why}), which must never ship`)
    }
  }
}
if (failed) process.exit(1)
console.log(`check-dist: ${all.length} files, no test-only language and no specimen`)
