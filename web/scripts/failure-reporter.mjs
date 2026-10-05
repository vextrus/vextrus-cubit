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

/** One log line, newline included: the error's first non-blank line; tabs and line breaks become spaces. */
export function failureLine(kind, runner, test, message, now = new Date()) {
  const time = now.toISOString().replace(/\.\d{3}Z$/, 'Z')
  const lines = String(message ?? '').split('\n')
  const first = collapse(lines.find((line) => line.trim() !== '') ?? '').slice(0, ERROR_CAP)
  return [time, kind, runner, collapse(test), first].join('\t') + '\n'
}

export default class FailureReporter {
  constructor(options = {}) {
    this.logPath = options.logPath ?? defaultLogPath()
    this.root = WEB
    this.seen = new Set()
    this.running = false
    this.warned = false
  }

  // Vitest. Each line is appended when its test or module ends, so a run cut short keeps what it
  // found; onTestRunEnd writes only what the earlier hooks did not.

  onInit(vitest) {
    this.root = vitest?.config?.root ?? WEB
  }

  onTestRunStart() {
    this.start()
  }

  onTestCaseResult(test) {
    if (test.result?.().state === 'failed') this.vitestTest(test, test.module?.moduleId)
  }

  onTestModuleEnd(module) {
    this.vitestModule(module)
  }

  onTestRunEnd(modules = [], unhandledErrors = []) {
    this.start()
    for (const module of modules) this.vitestModule(module)
    for (const error of unhandledErrors) this.append(failureLine('error', 'vitest', 'unhandled', error?.message))
    this.running = false
  }

  vitestModule(module) {
    if (this.seen.has(module)) return
    this.seen.add(module)
    const file = shown(module.moduleId, this.root)
    for (const error of module.errors?.() ?? []) this.append(failureLine('error', 'vitest', file, error?.message))
    for (const suite of module.children?.allSuites?.() ?? []) {
      for (const error of suite.errors?.() ?? []) this.append(failureLine('error', 'vitest', `${file}::${suite.fullName}`, error?.message))
    }
    for (const test of module.children?.allTests('failed') ?? []) this.vitestTest(test, module.moduleId)
  }

  vitestTest(test, moduleId) {
    const key = test.id ?? test
    if (this.seen.has(key)) return
    this.seen.add(key)
    const error = test.result?.().errors?.[0]
    this.append(failureLine('failed', 'vitest', `${shown(moduleId ?? '', this.root)}::${test.fullName}`, error?.message))
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
    this.start()
    const title = test.titlePath?.().filter(Boolean).join(' > ') ?? test.title
    const message = result.error?.message ?? result.errors?.[0]?.message
    this.append(failureLine('failed', 'playwright', `${shown(test.location?.file ?? '', WEB)}::${title}`, message))
  }

  /** An error outside any test: a spec that fails to load, a top-level throw, a failing globalSetup. */
  onError(error) {
    this.start()
    const message = error?.message ?? error?.value
    // A module that fails to import is located at '<anonymous>'; Node's message names the importer.
    const located = error?.location?.file
    const file = located && isAbsolute(located) ? located : /imported from (\S+)/.exec(String(message ?? ''))?.[1]
    this.append(failureLine('error', 'playwright', file ? shown(file, WEB) : 'unhandled', message))
  }

  onEnd() {
    this.start()
    this.running = false
  }

  // The log: emptied once when a run starts, then appended to line by line.

  start() {
    if (this.running) return
    this.running = true
    this.seen = new Set()
    this.write(() => writeFileSync(this.logPath, ''))
  }

  append(line) {
    this.write(() => appendFileSync(this.logPath, line))
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
