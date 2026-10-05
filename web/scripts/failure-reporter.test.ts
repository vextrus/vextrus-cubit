import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

interface Reporter {
  onInit(vitest: unknown): void
  onTestRunStart(specifications: unknown[]): void
  onTestRunEnd(modules: unknown[], unhandledErrors: { message: string }[]): void
}

interface ReporterModule {
  default: new (options?: { logPath?: string }) => Reporter
  failureLine: (kind: string, runner: string, test: string, message: string | undefined, now?: Date) => string
}

const load = async () => (await import(/* @vite-ignore */ new URL('./failure-reporter.mjs', import.meta.url).href)) as ReporterModule

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
