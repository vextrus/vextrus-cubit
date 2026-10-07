/*
 * T-WEB-REP's acceptance tests, the reporter's seam (issue #271; docs/specs/factory.md 3.13, row "A
 * failure's name lost"): `web/scripts/failure-reporter.mjs` default-exports a class `FailureReporter`
 * carrying both runners' hooks, and each run leaves a log of one tab-separated line per failure, the
 * pytest log's shape (vextrus/testing/failures.py):
 *
 *   <ISO UTC time, seconds>\t<failed|error>\t<runner>\t<file relative to web/>::<full test name>\t<first error line>
 *
 * The hooks are called here with hand-made objects of the shapes Vitest 5's and Playwright's reporter
 * APIs give; runners.node.test.ts runs the real runners. The reporter is a plain .mjs loaded by URL, so
 * this file compiles while it is missing and fails at run time.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

interface ErrorLike {
  message: string
}

interface Reporter {
  onInit(vitest: unknown): unknown
  onTestRunStart(specifications: unknown[]): unknown
  onTestRunEnd(modules: unknown[], unhandledErrors: ErrorLike[], reason: string): unknown
  onBegin(config: unknown, suite: unknown): unknown
  onTestEnd(test: unknown, result: unknown): unknown
  onEnd(result: unknown): unknown
}

interface ReporterModule {
  default: new (options?: { logPath?: string }) => Reporter
  defaultLogPath: (env: Record<string, string | undefined>) => string
}

const REPORTER = new URL('../../../scripts/failure-reporter.mjs', import.meta.url)
const WEB = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '')

const load = async () => (await import(/* @vite-ignore */ REPORTER.href)) as ReporterModule

const scratch = () => mkdtempSync(join(tmpdir(), 'twebrep-'))

const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|\+00:00)$/

/** The log's lines, each split at its tabs; an empty file is no lines. */
function lines(path: string): string[][] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.split('\t'))
}

type State = 'passed' | 'failed' | 'skipped' | 'pending'

interface FakeTest {
  fullName: string
  result: () => { state: State; errors: ErrorLike[] }
}

const fakeTest = (fullName: string, state: State, errors: ErrorLike[] = []): FakeTest => ({
  fullName,
  result: () => ({ state, errors }),
})

/** A test module as Vitest 5 hands it to `onTestRunEnd`: `allTests(state)` keeps to the state asked. */
function fakeModule(moduleId: string, tests: FakeTest[], errors: ErrorLike[] = []) {
  return {
    moduleId,
    children: {
      *allTests(state?: State) {
        for (const test of tests) if (state === undefined || test.result().state === state) yield test
      },
    },
    errors: () => errors,
  }
}

/** One Vitest run through the reporter's hooks, in the order Vitest calls them. */
async function vitestRun(reporter: Reporter, root: string, modules: unknown[], unhandled: ErrorLike[] = []) {
  await reporter.onInit({ config: { root } })
  await reporter.onTestRunStart([])
  await reporter.onTestRunEnd(modules, unhandled, modules.length || unhandled.length ? 'failed' : 'passed')
}

type Status = 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'

const fakeSpec = (title: string, file = join(WEB, 'e2e', 'walk.ts')) => ({
  title,
  location: { file, line: 3, column: 1 },
  titlePath: () => ['', 'chromium', 'walk.ts', title],
})

const fakeResult = (status: Status, message?: string) => ({
  status,
  error: message === undefined ? undefined : { message },
  errors: message === undefined ? [] : [{ message }],
})

/** One Playwright run through the reporter's hooks: onBegin, one onTestEnd per spec, onEnd. */
async function playwrightRun(reporter: Reporter, ends: [ReturnType<typeof fakeSpec>, ReturnType<typeof fakeResult>][]) {
  await reporter.onBegin({ rootDir: join(WEB, 'e2e') }, { allTests: () => ends.map(([test]) => test) })
  for (const [test, result] of ends) await reporter.onTestEnd(test, result)
  await reporter.onEnd({ status: ends.some(([, r]) => r.status !== 'passed' && r.status !== 'skipped') ? 'failed' : 'passed' })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the Vitest hooks', () => {
  it('write one line per failed test: time, failed, vitest, file relative to the root and full name, first error line', async () => {
    const { default: FailureReporter } = await load()
    const dir = scratch()
    const logPath = join(dir, 'f.log')
    const root = join(dir, 'web')
    const module = fakeModule(join(root, 'src', 'foo', 'bar.test.ts'), [
      fakeTest('Suite > passes', 'passed'),
      fakeTest('Suite > does a thing', 'failed', [{ message: 'expected  1\tto be   2\n    at src/foo/bar.test.ts:3:5' }]),
    ])

    await vitestRun(new FailureReporter({ logPath }), root, [module])

    const found = lines(logPath)
    expect(found).toHaveLength(1)
    const [time, kind, runner, test, error] = found[0] ?? []
    expect(time).toMatch(TIME)
    expect([kind, runner, test, error]).toEqual(['failed', 'vitest', 'src/foo/bar.test.ts::Suite > does a thing', 'expected 1 to be 2'])
    expect(found[0]).toHaveLength(5)
  })

  it("names a module's collection error as an error line with the module's relative path", async () => {
    const { default: FailureReporter } = await load()
    const dir = scratch()
    const logPath = join(dir, 'f.log')
    const root = join(dir, 'web')
    const module = fakeModule(join(root, 'src', 'foo', 'broken.test.ts'), [], [{ message: 'boom' }])

    await vitestRun(new FailureReporter({ logPath }), root, [module])

    const found = lines(logPath)
    expect(found).toHaveLength(1)
    const [time, kind, runner, test, error] = found[0] ?? []
    expect(time).toMatch(TIME)
    expect([kind, runner, error]).toEqual(['error', 'vitest', 'boom'])
    expect(test?.startsWith('src/foo/broken.test.ts')).toBe(true)
  })

  it('names an unhandled error as an error line whose test field is "unhandled"', async () => {
    const { default: FailureReporter } = await load()
    const dir = scratch()
    const logPath = join(dir, 'f.log')

    await vitestRun(new FailureReporter({ logPath }), join(dir, 'web'), [], [{ message: 'late' }])

    const found = lines(logPath)
    expect(found).toHaveLength(1)
    const [time, kind, runner, test, error] = found[0] ?? []
    expect(time).toMatch(TIME)
    expect([kind, runner, test, error]).toEqual(['error', 'vitest', 'unhandled', 'late'])
  })
})

describe('the Playwright hooks', () => {
  it('write one line for a failed spec: failed, playwright, file relative to web/ and the title path', async () => {
    const { default: FailureReporter } = await load()
    const logPath = join(scratch(), 'f.log')

    await playwrightRun(new FailureReporter({ logPath }), [[fakeSpec('opens the list'), fakeResult('failed', 'locator not found\nCall log:')]])

    const found = lines(logPath)
    expect(found).toHaveLength(1)
    const [time, kind, runner, test, error] = found[0] ?? []
    expect(time).toMatch(TIME)
    expect([kind, runner, error]).toEqual(['failed', 'playwright', 'locator not found'])
    expect(test?.startsWith('e2e/walk.ts::')).toBe(true)
    expect(test).toContain('opens the list')
    expect(found[0]).toHaveLength(5)
  })

  it('count timedOut and interrupted as failed and write nothing for passed or skipped', async () => {
    const { default: FailureReporter } = await load()
    const logPath = join(scratch(), 'f.log')

    await playwrightRun(new FailureReporter({ logPath }), [
      [fakeSpec('passes'), fakeResult('passed')],
      [fakeSpec('is skipped'), fakeResult('skipped')],
      [fakeSpec('runs out of time'), fakeResult('timedOut', 'Test timeout of 120000ms exceeded.')],
      [fakeSpec('is cut short'), fakeResult('interrupted', 'Test was interrupted.')],
    ])

    const found = lines(logPath)
    expect(found.map(([, kind, runner]) => `${kind} ${runner}`)).toEqual(['failed playwright', 'failed playwright'])
    const tests = found.map(([, , , test]) => test ?? '')
    expect(tests.some((test) => test.includes('runs out of time'))).toBe(true)
    expect(tests.some((test) => test.includes('is cut short'))).toBe(true)
  })
})

describe('the log', () => {
  it('is fresh per Vitest run: a second run with no failures leaves it empty', async () => {
    const { default: FailureReporter } = await load()
    const dir = scratch()
    const logPath = join(dir, 'f.log')
    const root = join(dir, 'web')
    const failing = fakeModule(join(root, 'src', 'a.test.ts'), [fakeTest('fails', 'failed', [{ message: 'no' }])])

    await vitestRun(new FailureReporter({ logPath }), root, [failing])
    expect(lines(logPath)).toHaveLength(1)

    await vitestRun(new FailureReporter({ logPath }), root, [fakeModule(join(root, 'src', 'a.test.ts'), [fakeTest('fails', 'passed')])])
    expect(readFileSync(logPath, 'utf8')).toBe('')
  })

  it('is fresh per Playwright run: a second run with no failures leaves it empty', async () => {
    const { default: FailureReporter } = await load()
    const logPath = join(scratch(), 'f.log')

    await playwrightRun(new FailureReporter({ logPath }), [[fakeSpec('opens the list'), fakeResult('failed', 'no')]])
    expect(lines(logPath)).toHaveLength(1)

    await playwrightRun(new FailureReporter({ logPath }), [[fakeSpec('opens the list'), fakeResult('passed')]])
    expect(readFileSync(logPath, 'utf8')).toBe('')
  })

  it('that cannot be written never fails a Vitest run and is said once on stderr, not once per failure', async () => {
    const { default: FailureReporter } = await load()
    const dir = scratch()
    const plain = join(dir, 'plain')
    writeFileSync(plain, 'a regular file, not a folder\n')
    const root = join(dir, 'web')
    const module = fakeModule(join(root, 'src', 'a.test.ts'), [
      fakeTest('one', 'failed', [{ message: 'no' }]),
      fakeTest('two', 'failed', [{ message: 'no' }]),
    ])
    const said = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(vitestRun(new FailureReporter({ logPath: join(plain, 'f.log') }), root, [module], [{ message: 'late' }])).resolves.toBeUndefined()

    expect(said).toHaveBeenCalledTimes(1)
  })

  it('that cannot be written never fails a Playwright run and is said once on stderr, not once per failure', async () => {
    const { default: FailureReporter } = await load()
    const plain = join(scratch(), 'plain')
    writeFileSync(plain, 'a regular file, not a folder\n')
    const said = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await expect(
      playwrightRun(new FailureReporter({ logPath: join(plain, 'f.log') }), [
        [fakeSpec('one'), fakeResult('failed', 'no')],
        [fakeSpec('two'), fakeResult('timedOut', 'no')],
      ]),
    ).resolves.toBeUndefined()

    expect(said).toHaveBeenCalledTimes(1)
  })

  it("defaults to web/test-results/failures.log, from the reporter's own place, not the working folder; web/.gitignore ignores it", async () => {
    const { defaultLogPath } = await load()
    expect(readFileSync(join(WEB, '.gitignore'), 'utf8').split('\n')).toContain('test-results/')
    const before = process.cwd()
    process.chdir(tmpdir())
    try {
      expect(defaultLogPath({})).toBe(join(WEB, 'test-results', 'failures.log'))
    } finally {
      process.chdir(before)
    }
  })

  it('is the path VEXTRUS_WEB_FAILURES_LOG names when it is set', async () => {
    const { defaultLogPath } = await load()
    const named = join(scratch(), 'named.log')
    expect(defaultLogPath({ VEXTRUS_WEB_FAILURES_LOG: named })).toBe(named)
  })
})
