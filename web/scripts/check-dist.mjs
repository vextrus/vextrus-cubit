#!/usr/bin/env node
/*
 * After `vite build`: what must never ship is absent from the production bundle
 * (docs/design/m0-screens.md §1.8 and §8; docs/plans/M0.md, 01b):
 *   - the test-only pseudo right-to-left language (its tag, en-XB, and its accent table);
 *   - the development-only specimen route (its path, its markers and its catalogue's words), and the
 *     sheet harness's (/dev/sheet, ticket 16);
 *   - the seed's static copy and the tests' in-memory API (their invented people's addresses): the
 *     product signs in through the API (20a), so nothing seeded is written into the app.
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
  { text: '/dev/sheet', why: 'the development-only sheet harness route' },
  { text: 'data-sheet-harness', why: 'the sheet harness page' },
  { text: 'Specimen of the shared pieces', why: 'the specimen’s catalogue' },
  { text: 'shapla-homes.example', why: 'the seed’s people (src/app/seed/)' },
  { text: 'padma-builders.example', why: 'the seed’s people (src/app/seed/)' },
  { text: 'meghna.example', why: 'the seed’s people (src/app/seed/)' },
  { text: 'kanchan-homes.example', why: 'the tests’ in-memory API (src/app/seed/api.fixture.ts)' },
  { text: 'vextrus.example', why: 'the seed’s Vextrus Engineer (src/app/seed/)' },
]

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

let failed = 0
for (const file of files(dist)) {
  if (/tiny-sheet|lineweight-ramp|\.bin$/.test(file)) {
    failed++
    console.error(`check-dist: ${relative(web, file)} is a sheet buffer (the harness's fixtures or a local sheet), which must never ship`)
  }
}
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
console.log(`check-dist: ${all.length} files, no test-only language, no specimen and no seeded people`)
