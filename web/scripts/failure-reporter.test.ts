import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { configDefaults } from 'vitest/config'
import { describe, expect, it } from 'vitest'

interface Reporter {
  onInit(vitest: unknown): void
  onTestRunStart(specifications: unknown[]): void
  onTestCaseResult(test: unknown): void
  onTestRunEnd(modules: unknown[], unhandledErrors: { message: string }[]): void
  onBegin(config: unknown, suite: unknown): void
  onTestEnd(test: unknown, result: unknown): void
  onError(error: unknown): void
  onEnd(result: unknown): void
}

interface ReporterModule {
  default: new (options?: { logPath?: string }) => Reporter
  failureLine: (kind: string, runner: string, test: string, message: string | undefined, now?: Date) => string
}

const load = async () => (await import(/* @vite-ignore */ new URL('./failure-reporter.mjs', import.meta.url).href)) as ReporterModule

const WEB = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
const REPORTER = join(WEB, 'scripts', 'failure-reporter.mjs')
const RUN = 60_000

const logLines = (path: string) =>
  (existsSync(path) ? readFileSync(path, 'utf8') : '')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('\t'))

/** A scratch project with the web's node_modules linked in; left in tmp, never deleted recursively. */
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'failure-reporter-run-'))
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

const vitestConfig = (dir: string) =>
  `export default { cacheDir: ${JSON.stringify(join(dir, '.cache'))}, test: { environment: 'node', reporters: [${JSON.stringify(REPORTER)}] } }\n`

const playwrightConfig = (extra = '') =>
  `export default { testDir: '.', testMatch: /.*\\.spec\\.mjs$/, workers: 1, ${extra} reporter: [[${JSON.stringify(REPORTER)}]] }\n`

describe('failureLine', () => {
  it('keeps the fields free of tabs and line breaks and caps the error at 300 characters', async () => {
    const { failureLine } = await load()
    const line = failureLine('failed', 'vitest', 'a.test.ts::odd\tname', `${'x'.repeat(400)}\nsecond`, new Date('2026-10-05T04:58:28.123Z'))
    const fields = line.slice(0, -1).split('\t')
    expect(fields).toEqual(['2026-10-05T04:58:28Z', 'failed', 'vitest', 'a.test.ts::odd name', 'x'.repeat(300)])
    expect(line.endsWith('\n')).toBe(true)
  })

  it('writes an empty error field when a failure carries no message', async () => {
    const { failureLine } = await load()
    expect(failureLine('error', 'vitest', 'unhandled', undefined).split('\t')[4]).toBe('\n')
  })

  it("takes the error's first non-blank line", async () => {
    const { failureLine } = await load()
    expect(failureLine('failed', 'vitest', 't', '\n  \nexpected 1 to be 2\nmore').split('\t')[4]).toBe('expected 1 to be 2\n')
  })
})

describe('the Vitest hooks', () => {
  it('keep a module outside the root as its absolute path', async () => {
    const { default: FailureReporter } = await load()
    const dir = mkdtempSync(join(tmpdir(), 'failure-reporter-'))
    const logPath = join(dir, 'f.log')
    const reporter = new FailureReporter({ logPath })
    reporter.onInit({ config: { root: join(dir, 'root') } })
    reporter.onTestRunStart([])
    const outside = join(dir, 'elsewhere', 'x.test.ts')
    reporter.onTestRunEnd([{ moduleId: outside, errors: () => [{ message: 'boom' }], children: { allTests: () => [] } }], [])
    expect(readFileSync(logPath, 'utf8').split('\t')[3]).toBe(outside)
  })
})

describe('the real Vitest', () => {
  it(
    "names a describe block's beforeAll error as an error line on the suite, once",
    () => {
      const dir = project({
        'hooks.test.mjs': [
          "import { beforeAll, describe, it } from 'vitest'",
          "describe('Outer', () => { beforeAll(() => { throw new Error('set-up broke') }); it('never runs', () => {}) })",
          '',
        ].join('\n'),
      })
      writeFileSync(join(dir, 'vitest.config.mjs'), vitestConfig(dir))

      const { status, output } = run(dir, 'vitest', ['run', '--config', 'vitest.config.mjs'])

      expect(status, output).toBe(1)
      const errors = logLines(join(dir, 'f.log')).filter(([, kind]) => kind === 'error')
      expect(errors.map(([, , runner, test, error]) => [runner, test, error]), output).toEqual([['vitest', 'hooks.test.mjs::Outer', 'set-up broke']])
    },
    RUN,
  )
})

describe('the real Playwright', () => {
  it(
    'names a spec that fails to load as an error line on its file',
    () => {
      const dir = project({
        'playwright.config.mjs': playwrightConfig(),
        'broken.spec.mjs': ["import { test } from '@playwright/test'", "import './not-built-yet.mjs'", "test('never collected', () => {})", ''].join('\n'),
      })

      const { status, output } = run(dir, 'playwright', ['test', '-c', 'playwright.config.mjs'])

      expect(status, output).toBe(1)
      const found = logLines(join(dir, 'f.log'))
      expect(found.length, output).toBeGreaterThan(0)
      expect(found.every(([, kind, runner]) => kind === 'error' && runner === 'playwright')).toBe(true)
      expect(found.some(([, , , test]) => test?.includes('broken.spec.mjs'))).toBe(true)
    },
    RUN,
  )

  it(
    'names a failing globalSetup as an error line',
    () => {
      const dir = project({
        'playwright.config.mjs': playwrightConfig("globalSetup: './setup.mjs',"),
        'setup.mjs': "export default () => { throw new Error('no server') }\n",
        'ok.spec.mjs': ["import { test } from '@playwright/test'", "test('fine', () => {})", ''].join('\n'),
      })

      const { status, output } = run(dir, 'playwright', ['test', '-c', 'playwright.config.mjs'])

      expect(status, output).toBe(1)
      const found = logLines(join(dir, 'f.log'))
      expect(found.map(([, kind, runner]) => `${kind} ${runner}`), output).toContain('error playwright')
      expect(found.some(([, , , , error]) => error?.includes('no server'))).toBe(true)
    },
    RUN,
  )

  // One project for these cases: each real Playwright run costs a second of CPU while the browser projects run.
  it(
    "judges by the test's outcome and writes an expect failure without terminal colour codes",
    () => {
      const dir = project({
        'playwright.config.mjs': playwrightConfig('retries: 1,'),
        'outcome.spec.mjs': [
          "import { expect, test } from '@playwright/test'",
          "test('compares', () => { expect(2).toBe(3) })",
          "test('passes against its fail mark', () => { test.fail() })",
          "test('fails as marked', () => { test.fail(); throw new Error('as marked') })",
          "test('passes on retry', ({}, info) => { if (info.retry === 0) throw new Error('first try') })",
          '',
        ].join('\n'),
      })

      const { status, output } = run(dir, 'playwright', ['test', '-c', 'playwright.config.mjs'])

      expect(status, output).toBe(1)
      const text = readFileSync(join(dir, 'f.log'), 'utf8')
      expect(text).not.toContain('\u001b')
      const found = logLines(join(dir, 'f.log'))
        .map(([, kind, runner, test, error]) => [kind, runner, test?.split('::')[1], error])
        .sort((x, y) => String(x[2]).localeCompare(String(y[2])))
      expect(found, output).toEqual([
        ['failed', 'playwright', 'outcome.spec.mjs > compares', 'Error: expect(received).toBe(expected) // Object.is equality'],
        ['failed', 'playwright', 'outcome.spec.mjs > passes against its fail mark', 'expected failed, got passed'],
      ])
    },
    RUN,
  )
})

describe('a run cut short', () => {
  it('keeps a Vitest failure written when the test ends, before the run ends', async () => {
    const { default: FailureReporter } = await load()
    const dir = mkdtempSync(join(tmpdir(), 'failure-reporter-'))
    const logPath = join(dir, 'f.log')
    const root = join(dir, 'root')
    const reporter = new FailureReporter({ logPath })
    reporter.onInit({ config: { root } })
    reporter.onTestRunStart([])
    reporter.onTestCaseResult({
      fullName: 'S > fails',
      module: { moduleId: join(root, 'a.test.ts') },
      result: () => ({ state: 'failed', errors: [{ message: 'no' }] }),
    })

    expect(logLines(logPath).map(([, kind, , test]) => [kind, test])).toEqual([['failed', 'a.test.ts::S > fails']])
  })

  it('keeps a Playwright failure written when the spec ends, before onEnd', async () => {
    const { default: FailureReporter } = await load()
    const logPath = join(mkdtempSync(join(tmpdir(), 'failure-reporter-')), 'f.log')
    const reporter = new FailureReporter({ logPath })
    reporter.onBegin({}, {})
    reporter.onTestEnd(
      { title: 'opens', location: { file: join(WEB, 'e2e', 'w.ts') }, titlePath: () => ['', 'chromium', 'w.ts', 'opens'] },
      { status: 'timedOut', error: { message: 'too slow' } },
    )

    expect(logLines(logPath).map(([, kind, , test]) => [kind, test])).toEqual([['failed', 'e2e/w.ts::chromium > w.ts > opens']])
  })

  it('names a Playwright error with no location as unhandled', async () => {
    const { default: FailureReporter } = await load()
    const logPath = join(mkdtempSync(join(tmpdir(), 'failure-reporter-')), 'f.log')
    const reporter = new FailureReporter({ logPath })
    reporter.onBegin({}, {})
    reporter.onError({ message: 'worker died' })
    reporter.onEnd({ status: 'failed' })

    expect(logLines(logPath).map(([, kind, runner, test, error]) => [kind, runner, test, error])).toEqual([['error', 'playwright', 'unhandled', 'worker died']])
  })
})

describe('web/vite.config.ts', () => {
  it("keeps Vitest's own first reporter (minimal in an agent session, else default) ahead of the failure log", async () => {
    const { default: config } = (await import(/* @vite-ignore */ new URL('../vite.config.ts', import.meta.url).href)) as {
      default: (env: { mode: string; command: string }) => { test?: { reporters?: unknown[] } }
    }
    const reporters = config({ mode: 'test', command: 'serve' }).test?.reporters ?? []
    expect(reporters[0]).toBe(configDefaults.reporters[0])
    expect(String(reporters.at(-1))).toContain('failure-reporter.mjs')
    // Loading the config builds every plugin (no network): under 1 s alone, over 5 s on a CI runner busy with the browser projects.
  }, 30_000)
})
