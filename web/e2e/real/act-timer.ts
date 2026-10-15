/*
 * G1's act timer, extracted from walk.spec.ts (S18-WALK1). It listens for responses before the keys are
 * pressed, so an answer that reaches Playwright in the same batch as its request is never lost. An act's `ms`
 * is measured on the monotonic clock (performance.now()): this machine's wall clock jumps forward 1.1 to 1.5 s
 * every 32.5 s (S30-W2).
 */
import type { Page, Request, Response } from '@playwright/test'

export const ACT_TIMEOUT_MS = 3 * 60 * 1000

export type ActRecord = {
  kind: string
  ms: number
  read_running: boolean
  status: number
  /** The server's own work on the act, from its answer's `Server-Timing: app;dur=<ms>` (S29-M0b). */
  app_ms?: number
  /** Its wait for Step 1's write lock, from the answer's `Server-Timing: lock;dur=<ms>`. */
  lock_ms?: number
}

/** The answer's server time: `app` and `lock` from its `Server-Timing` header, each when it is a number. */
export function serverTiming(header: string | undefined): { app_ms?: number; lock_ms?: number } {
  const found: { app_ms?: number; lock_ms?: number } = {}
  for (const metric of (header ?? '').split(',')) {
    const [name, ...params] = metric.split(';').map((part) => part.trim())
    const dur = params.find((param) => param.split('=')[0]?.trim() === 'dur')?.split('=')[1]?.trim() ?? ''
    if (!/^[0-9]+(\.[0-9]+)?$/.test(dur)) continue
    if (name === 'app') found.app_ms = Number(dur)
    if (name === 'lock') found.lock_ms = Number(dur)
  }
  return found
}

/** The answer's `server-timing` header; none from an answer that carries no headers. */
function timingHeader(response: Response): string | undefined {
  try {
    return response.headers()['server-timing']
  } catch {
    return undefined
  }
}

export type Spread = { p50: number; p95: number; max: number; count: number }
export type ActTime = { ms: Spread; app_ms?: Spread; lock_ms?: Spread }
export type ActTimes = Partial<Record<'confirm' | 'undo' | 'exclude' | 'answer', ActTime>>

/** The value at a nearest rank (`sorted[ceil(q * n) - 1]`, as scripts/walk/verdict.py's p95). */
function rank(sorted: number[], q: number): number {
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)]!
}

function spread(values: number[]): Spread | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return { p50: rank(sorted, 0.5), p95: rank(sorted, 0.95), max: sorted[sorted.length - 1]!, count: sorted.length }
}

/**
 * walk.json's act_times: per act kind, the spread of the acts the act check measures (answered 1 to 399
 * while a read ran, as verdict.py's act_p95_during_read): the request's ms, and the server's app_ms and
 * lock_ms of the acts whose answer carried them. A kind with no such act is left out.
 */
export function actTimes(acts: ActRecord[]): ActTimes {
  const times: ActTimes = {}
  for (const kind of Object.keys(ACT_PATHS) as Array<keyof ActTimes>) {
    const measured = acts.filter((a) => a.kind === kind && a.read_running && a.status > 0 && a.status < 400)
    const ms = spread(measured.map((a) => a.ms))
    if (!ms) continue
    const time: ActTime = { ms }
    const app = spread(measured.flatMap((a) => (a.app_ms === undefined ? [] : [a.app_ms])))
    const lock = spread(measured.flatMap((a) => (a.lock_ms === undefined ? [] : [a.lock_ms])))
    if (app) time.app_ms = app
    if (lock) time.lock_ms = lock
    times[kind] = time
  }
  return times
}

const ACT_PATHS: Record<string, RegExp> = {
  confirm: /\/takeoff\/step1\/confirm$/,
  undo: /\/takeoff\/step1\/undo$/,
  exclude: /\/takeoff\/step1\/exclude$/,
  answer: /\/takeoff\/step1\/questions\/[0-9a-f-]{36}\/answer$/,
}

/** The act a Step 1 request is, by its path; null for any other request. */
export function actOf(path: string): string | null {
  return Object.entries(ACT_PATHS).find(([, pattern]) => pattern.test(path))?.[0] ?? null
}

/**
 * One act by its keys, timed from the last key to the act's answer. Null when the screen made no such
 * request (nothing to act on): it is not recorded. A request that never answers is recorded at the
 * act timeout with status 0, which fails the walk.
 */
export async function timedAct(
  page: Page,
  api: { reading(projectId: string): Promise<boolean> },
  projectId: string,
  kind: string,
  keys: string[],
  options?: { timeoutMs?: number },
): Promise<ActRecord | null> {
  const timeoutMs = options?.timeoutMs ?? ACT_TIMEOUT_MS
  const before = await api.reading(projectId)
  // Any act's request: the record names the act the request was, not the one the keys aimed at.
  const isAct = (r: { method(): string; url(): string }) =>
    r.method() === 'POST' && actOf(new URL(r.url()).pathname) !== null

  // Listeners armed before any key: requests and answers are kept as they arrive, in whatever order.
  const requests: Request[] = []
  const answers = new Map<Request, { status: number; at: number; timing: { app_ms?: number; lock_ms?: number } }>()
  const sentAt = new Map<Request, number>()
  const waiters: Array<() => void> = []
  const wake = () => waiters.splice(0).forEach((w) => w())
  const onRequest = (r: Request) => {
    if (isAct(r)) {
      requests.push(r)
      sentAt.set(r, performance.now())
      wake()
    }
  }
  const onResponse = (r: Response) => {
    const req = r.request()
    if (isAct(req)) {
      answers.set(req, { status: r.status(), at: performance.now(), timing: serverTiming(timingHeader(r)) })
      wake()
    }
  }
  page.on('request', onRequest)
  page.on('response', onResponse)
  const until = (ready: () => boolean, ms: number) =>
    new Promise<boolean>((resolve) => {
      if (ready()) return resolve(true)
      const timer = setTimeout(() => {
        waiters.splice(waiters.indexOf(check), 1)
        resolve(false)
      }, ms)
      const check = () => {
        if (ready()) {
          clearTimeout(timer)
          resolve(true)
        } else waiters.push(check)
      }
      waiters.push(check)
    })

  try {
    let started = performance.now()
    for (const [i, key] of keys.entries()) {
      if (i > 0) await page.waitForTimeout(400) // the screen settles between keys (a sheet opening)
      started = performance.now()
      await page.keyboard.press(key)
    }
    let seen = await until(() => requests.length > 0, 4000)
    if (!seen && kind === 'answer') {
      // An option picked by its number may wait for Enter (the card's own key).
      started = performance.now()
      await page.keyboard.press('Enter')
      seen = await until(() => requests.length > 0, 4000)
    }
    if (!seen) return null
    const request = requests[0]!
    // Never answered within the act timeout: recorded at the timeout (status 0), which fails the walk.
    const answered = await until(() => answers.has(request), timeoutMs)
    const answer = answers.get(request)
    const after = await api.reading(projectId)
    return {
      kind: actOf(new URL(request.url()).pathname)!,
      // From the request's own send when it left on an earlier key than the last: never negative.
      ms: answered && answer ? Math.max(0, answer.at - Math.min(started, sentAt.get(request) ?? started)) : timeoutMs,
      read_running: before && after,
      status: answered && answer ? answer.status : 0,
      ...(answered && answer ? answer.timing : {}),
    }
  } finally {
    page.off('request', onRequest)
    page.off('response', onResponse)
  }
}
