/*
 * T-WEB-REP's acceptance tests, the real runners (issue #271; docs/specs/factory.md 3.13, row "A
 * failure's name lost"): `web/scripts/failure-reporter.mjs` named as a reporter makes the real Vitest
 * and Playwright write each failure's name to the log, and the repo's own configs name it.
 *
 * Each run is a scratch project in the system's temporary folder with a `node_modules` link to the
 * web's, so `vitest` and `@playwright/test` resolve from the scratch files. The scratch folders are
 * left there (CLAUDE.md: never delete recursively). The Playwright spec opens no browser.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '')
const REPORTER = join(WEB, 'scripts', 'failure-reporter.mjs')
const RUN = 60_000

/** A scratch project holding `files`, with the web's node_modules linked in. */
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'twebrep-run-'))
  symlinkSync(join(WEB, 'node_modules'), join(dir, 'node_modules'), 'dir')
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
  return dir
}

/** Runs one of the web's runners in `dir`, its failure log at `<dir>/f.log`, outside CI. */
function run(dir: string, bin: 'vitest' | 'playwright', args: string[]) {
  const env: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key === 'GITHUB_ACTIONS' || key === 'CI' || key.startsWith('VITEST') || key === 'NODE_ENV' || key === 'TEST') continue
    env[key] = value
  }
  env.VEXTRUS_WEB_FAILURES_LOG = join(dir, 'f.log')
  const done = spawnSync(join(WEB, 'node_modules', '.bin', bin), args, { cwd: dir, env, encoding: 'utf8', timeout: RUN - 5_000 })
  return { status: done.status, output: `${done.stdout}\n${done.stderr}` }
}

const lines = (path: string) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('\t'))

const vitestConfig = (dir: string) =>
  `export default { cacheDir: ${JSON.stringify(join(dir, '.cache'))}, test: { environment: 'node', reporters: ['default', ${JSON.stringify(REPORTER)}] } }\n`

describe('the real Vitest', () => {
  it(
    "writes a failing test's name and file to the log and exits 1",
    () => {
      const dir = project({
        'names.test.mjs': [
          "import { expect, it } from 'vitest'",
          "it('passes', () => { expect(1).toBe(1) })",
          "it('names itself', () => { expect(1).toBe(2) })",
          '',
        ].join('\n'),
      })
      writeFileSync(join(dir, 'vitest.config.mjs'), vitestConfig(dir))

      const { status, output } = run(dir, 'vitest', ['run', '--config', 'vitest.config.mjs'])

      expect(status, output).toBe(1)
      const found = lines(join(dir, 'f.log'))
      expect(found).toHaveLength(1)
      const [, kind, runner, test] = found[0] ?? []
      expect([kind, runner]).toEqual(['failed', 'vitest'])
      expect(test).toContain('names itself')
      expect(test).toContain('names.test.mjs')
    },
    RUN,
  )

  it(
    'leaves an empty log on a passing run and exits 0',
    () => {
      const dir = project({ 'passes.test.mjs': ["import { expect, it } from 'vitest'", "it('passes', () => { expect(1).toBe(1) })", ''].join('\n') })
      writeFileSync(join(dir, 'vitest.config.mjs'), vitestConfig(dir))

      const { status, output } = run(dir, 'vitest', ['run', '--config', 'vitest.config.mjs'])

      expect(status, output).toBe(0)
      expect(readFileSync(join(dir, 'f.log'), 'utf8')).toBe('')
    },
    RUN,
  )
})

describe('the real Playwright', () => {
  it(
    "writes a failing spec's title and file to the log",
    () => {
      const dir = project({
        'playwright.config.mjs': `export default { testDir: '.', testMatch: /.*\\.spec\\.mjs$/, workers: 1, reporter: [['list'], [${JSON.stringify(REPORTER)}]] }\n`,
        'throws.spec.mjs': [
          "import { test } from '@playwright/test'",
          "test('throws without a browser', () => { throw new Error('thrown on purpose') })",
          '',
        ].join('\n'),
      })

      const { status, output } = run(dir, 'playwright', ['test', '-c', 'playwright.config.mjs'])

      expect(status, output).toBe(1)
      const found = lines(join(dir, 'f.log'))
      expect(found).toHaveLength(1)
      const [, kind, runner, test] = found[0] ?? []
      expect([kind, runner]).toEqual(['failed', 'playwright'])
      expect(test).toContain('throws without a browser')
      expect(test).toContain('throws.spec.mjs')
    },
    RUN,
  )
})

/** The text of the bracketed list that starts at the first `[` at or after `from`. */
function bracketed(text: string, from: number): string {
  const start = text.indexOf('[', from)
  let depth = 0
  for (let i = start; i >= 0 && i < text.length; i++) {
    if (text[i] === '[') depth += 1
    if (text[i] === ']') depth -= 1
    if (depth === 0) return text.slice(start, i + 1)
  }
  return ''
}

interface PlaywrightConfig {
  reporter?: unknown
}

describe("the repo's configs", () => {
  it("web/vite.config.ts's test block lists default, github-actions under GITHUB_ACTIONS, and the failure reporter", () => {
    const text = readFileSync(join(WEB, 'vite.config.ts'), 'utf8')
    const block = text.indexOf('test: {')
    expect(block).toBeGreaterThan(-1)
    const at = text.indexOf('reporters', block)
    expect(at).toBeGreaterThan(-1)
    const reporters = bracketed(text, at)
    expect(reporters).toContain("'default'")
    expect(reporters).toContain('failure-reporter.mjs')
    expect(reporters).toContain('github-actions')
    expect(text.slice(block)).toContain('GITHUB_ACTIONS')
  })

  it("web/e2e/playwright.config.ts keeps ['list'] and names the failure reporter, an existing file", async () => {
    const url = new URL('../../../e2e/playwright.config.ts', import.meta.url)
    const config = ((await import(/* @vite-ignore */ url.href)) as { default: PlaywrightConfig }).default
    const reporter = config.reporter
    expect(Array.isArray(reporter)).toBe(true)
    const entries = reporter as unknown[]
    expect(entries).toContainEqual(['list'])
    const named = entries
      .map((entry) => (Array.isArray(entry) ? (entry as unknown[])[0] : entry))
      .filter((name): name is string => typeof name === 'string')
      .map((name) => resolve(WEB, 'e2e', name))
      .filter((path) => basename(path) === 'failure-reporter.mjs')
    expect(named).toHaveLength(1)
    expect(existsSync(named[0] ?? '')).toBe(true)
  })
})
