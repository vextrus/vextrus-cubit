/*
 * G1's act timer, extracted from walk.spec.ts (S18-WALK1). It listens for responses before the keys are
 * pressed, so an answer that reaches Playwright in the same batch as its request is never lost.
 */
import type { Page, Request, Response } from '@playwright/test'

export const ACT_TIMEOUT_MS = 3 * 60 * 1000

export type ActRecord = { kind: string; ms: number; read_running: boolean; status: number }

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
  const answers = new Map<Request, { status: number; at: number }>()
  const waiters: Array<() => void> = []
  const wake = () => waiters.splice(0).forEach((w) => w())
  const onRequest = (r: Request) => {
    if (isAct(r)) {
      requests.push(r)
      wake()
    }
  }
  const onResponse = (r: Response) => {
    const req = r.request()
    if (isAct(req)) {
      answers.set(req, { status: r.status(), at: Date.now() })
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
    let started = Date.now()
    for (const [i, key] of keys.entries()) {
      if (i > 0) await page.waitForTimeout(400) // the screen settles between keys (a sheet opening)
      started = Date.now()
      await page.keyboard.press(key)
    }
    let seen = await until(() => requests.length > 0, 4000)
    if (!seen && kind === 'answer') {
      // An option picked by its number may wait for Enter (the card's own key).
      started = Date.now()
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
      ms: answered && answer ? answer.at - started : timeoutMs,
      read_running: before && after,
      status: answered && answer ? answer.status : 0,
    }
  } finally {
    page.off('request', onRequest)
    page.off('response', onResponse)
  }
}
