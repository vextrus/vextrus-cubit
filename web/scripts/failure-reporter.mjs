/*
 * Keeps every failing web test's name in a file (issue #271; docs/specs/factory.md 3.13, row "A
 * failure's name lost"), as vextrus/testing/failures.py does for pytest: one tab-separated line per
 * failure,
 *
 *   <ISO UTC time, seconds>\t<failed|error>\t<runner>\t<file>::<full test name>\t<first error line>
 *
 * Unlike the pytest log, this one is fresh per run (truncated when the run starts), so it reads at a
 * glance. One default-exported class carries both runners' hooks: Vitest calls onInit, onTestRunStart
 * and onTestRunEnd; Playwright calls onBegin, onTestEnd and onEnd. A log that cannot be written is said
 * once on stderr and never fails the run.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const ERROR_CAP = 300
const FAILED = new Set(['failed', 'timedOut', 'interrupted'])

/** The log's path: VEXTRUS_WEB_FAILURES_LOG when set, else web/test-results/failures.log. */
export function defaultLogPath(env = process.env) {
  return env.VEXTRUS_WEB_FAILURES_LOG || join(WEB, 'test-results', 'failures.log')
}

const collapse = (text) => String(text ?? '').replace(/\s+/g, ' ').trim()

/** `file` relative to `base` when it lies inside it, else as given. */
function shown(file, base) {
  const rel = relative(base, file)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : file
}

/** One log line, newline included; tabs and line breaks inside the fields are collapsed to spaces. */
export function failureLine(kind, runner, test, message, now = new Date()) {
  const time = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const first = collapse(String(message ?? '').split('\n')[0]).slice(0, ERROR_CAP)
  return [time, kind, runner, collapse(test), first].join('\t') + '\n'
}

export default class FailureReporter {
  constructor(options = {}) {
    this.logPath = options.logPath ?? defaultLogPath()
    this.root = WEB
    this.lines = []
    this.warned = false
  }

  // Vitest

  onInit(vitest) {
    this.root = vitest?.config?.root ?? WEB
  }

  onTestRunStart() {
    this.start()
  }

  onTestRunEnd(modules = [], unhandledErrors = []) {
    for (const module of modules) {
      const file = shown(module.moduleId, this.root)
      for (const error of module.errors?.() ?? []) this.lines.push(failureLine('error', 'vitest', file, error?.message))
      for (const test of module.children?.allTests('failed') ?? []) {
        const error = test.result?.().errors?.[0]
        this.lines.push(failureLine('failed', 'vitest', `${file}::${test.fullName}`, error?.message))
      }
    }
    for (const error of unhandledErrors) this.lines.push(failureLine('error', 'vitest', 'unhandled', error?.message))
    this.flush()
  }

  // Playwright

  printsToStdio() {
    return false
  }

  onBegin() {
    this.start()
  }

  onTestEnd(test, result) {
    if (!FAILED.has(result?.status)) return
    const title = test.titlePath?.().filter(Boolean).join(' > ') ?? test.title
    const message = result.error?.message ?? result.errors?.[0]?.message
    this.lines.push(failureLine('failed', 'playwright', `${shown(test.location?.file ?? '', WEB)}::${title}`, message))
  }

  onEnd() {
    this.flush()
  }

  // The log

  start() {
    this.lines = []
    this.write(() => writeFileSync(this.logPath, ''))
  }

  flush() {
    const text = this.lines.join('')
    this.lines = []
    if (text) this.write(() => appendFileSync(this.logPath, text))
  }

  write(action) {
    try {
      mkdirSync(dirname(this.logPath), { recursive: true })
      action()
    } catch (error) {
      if (this.warned) return
      this.warned = true
      process.stderr.write(`failure log not written: ${error?.message ?? error}\n`)
    }
  }
}
