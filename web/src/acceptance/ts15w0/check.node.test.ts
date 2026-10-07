/*
 * Ticket S15-W0's acceptance test, the catalogue check still covers every split catalogue: web.yml's
 * `messages:check` (`web/scripts/check-messages.mjs`: "every message has its English, and the
 * catalogues match the code") fails when any takeoff catalogue is out of step with the code, and names
 * that catalogue. A split catalogue the check does not extract, or whose drift it does not look at,
 * would let a stale or English-less message reach the screen unnoticed.
 *
 * It runs in a copy of `web/` in a temporary folder, its own git repository, so the checkout is never
 * touched: a message no code asks for is added to each takeoff catalogue, committed, and the check is run.
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, cpSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { takeoffCatalogues, WEB } from './po'

const NOT_COPIED = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', 'coverage', '.vitest'])

function git(cwd: string, ...args: string[]): void {
  const done = spawnSync('git', ['-c', 'user.name=acceptance', '-c', 'user.email=acceptance@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
  })
  expect(done.status, `git ${args.join(' ')}: ${done.stderr}`).toBe(0)
}

const STALE = '\n#: src/takeoff/NoSuchFile.tsx\nmsgid "A message no code asks for"\nmsgstr "A message no code asks for"\n'

describe('the catalogue check covers every takeoff catalogue (S15-W0)', () => {
  it('fails on a stale message in any takeoff catalogue and names each one', { timeout: 300_000 }, () => {
    const catalogues = takeoffCatalogues()
    expect(catalogues, 'takeoff catalogues on disk').not.toEqual([])
    const copy = mkdtempSync(join(tmpdir(), 'ts15w0-'))
    cpSync(WEB, copy, {
      recursive: true,
      filter: (source) => !NOT_COPIED.has(source.slice(WEB.length).split('/')[0] ?? ''),
    })
    symlinkSync(join(WEB, 'node_modules'), join(copy, 'node_modules'), 'dir')
    for (const catalogue of catalogues) appendFileSync(join(copy, catalogue.fromWeb), STALE)
    git(copy, 'init', '--quiet')
    git(copy, 'add', '--', '.')
    git(copy, 'commit', '--quiet', '-m', 'a stale message in each takeoff catalogue')

    // As web.yml runs it: Vitest's NODE_ENV=test would send Lingui to its development-only workers.
    const { NODE_ENV: _test, ...env } = process.env
    const run = spawnSync(process.execPath, ['scripts/check-messages.mjs'], { cwd: copy, env, encoding: 'utf8' })
    const said = `${run.stdout}\n${run.stderr}`

    expect(run.status, said).not.toBe(0)
    const unnamed = catalogues.map((c) => c.fromWeb).filter((path) => !said.includes(path))
    expect(unnamed, `takeoff catalogues the check did not name:\n${said}`).toEqual([])
  })
})
