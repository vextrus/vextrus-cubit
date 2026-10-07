#!/usr/bin/env node
/*
 * The catalogue check (a step of web.yml; docs/plans/M0.md, 01b): the English catalogues are
 * extracted and compiled strictly, so a message used without English fails.
 *
 *   1. `lingui extract --clean` over the chrome (lingui.config.ts); then every src/<feature>/locales/
 *      en.po (takeoff's also src/takeoff/locales/<area>/en.po) must be unchanged against git (the POT date aside) and none may be new. A message used in
 *      code but missing from its committed catalogue fails here: run `npm run messages:extract` and
 *      commit the catalogue.
 *   2. `lingui compile --strict` over the chrome and over the machine's codes
 *      (lingui.messages.config.ts): an entry without English fails.
 *
 * It rewrites the catalogues in place, like `npm run messages:extract`.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const web = fileURLToPath(new URL('..', import.meta.url))

function run(command, args) {
  const r = spawnSync(command, args, { cwd: web, stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\ncheck-messages: \`${[command, ...args].join(' ')}\` failed`)
    process.exit(r.status ?? 1)
  }
}

const lingui = 'node_modules/.bin/lingui'

run(lingui, ['extract', '--clean'])

const changed = execFileSync('git', ['diff', '--name-only', '-I', 'POT-Creation-Date', '--', 'src/*/locales/en.po', 'src/takeoff/locales/*/en.po'], { cwd: web, encoding: 'utf8' }).trim()
const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src/*/locales/en.po', 'src/takeoff/locales/*/en.po'], { cwd: web, encoding: 'utf8' }).trim()
if (changed || added) {
  console.error('\ncheck-messages: the English catalogues are not up to date with the code:')
  for (const f of [...changed.split('\n'), ...added.split('\n')].filter(Boolean)) console.error(`  ${f}`)
  console.error('Run `npm run messages:extract` and commit the catalogues (every visible string needs its English message).')
  process.exit(1)
}

run(lingui, ['compile', '--strict'])
run(lingui, ['compile', '--strict', '--config', 'lingui.messages.config.ts'])
console.log('check-messages: every message has its English, and the catalogues match the code')
