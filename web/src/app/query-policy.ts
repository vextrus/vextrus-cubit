/*
 * The one retry rule of every query and mutation (S15-W1; m0-screens §4.1: "this page keeps trying").
 * A query that sets no `retry` of its own has this one, from the query client's defaults.
 *  - A refusal (4xx) is an answer: never tried again.
 *  - A fault (5xx) is tried a few more times, each wait longer, then it is the error.
 *  - A server that cannot be reached keeps being tried, without end: a TypeError, or a 502, 503 or 504
 *    with no body (a proxy or gateway with nothing behind it; `isUnreachable`): the frame's ErrorBar shows from
 *    the first failed try on (it reads the cache's error) and goes when one answers.
 *  - An act (a mutation) is never tried again by itself: its refusal is the answer.
 */
import { ApiRefused } from '@/api/client'
import { NoDeveloper } from './session'

/** Tries of a 5xx after the first. */
export const FAULT_RETRIES = 3

/**
 * The server cannot be reached: the browser's TypeError, or a gateway's 502, 503 or 504 with no body at
 * all (a proxy with nothing behind it answers nothing). A 503 that carries a refusal is Vextrus's own
 * answer, and a 5xx page with a body of its own stays a fault: tried a few times, then shown.
 */
export function isUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) return true
  return error instanceof ApiRefused && error.empty && error.refusal === null && (error.status === 502 || error.status === 503 || error.status === 504)
}

/** Retry rule for queries. No Developer is an answer of ours, not a failure: never tried again. */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (isUnreachable(error)) return true
  if (error instanceof ApiRefused) return error.status >= 500 && failures < FAULT_RETRIES
  if (error instanceof NoDeveloper) return false
  return failures < FAULT_RETRIES
}

/** Exponential wait, never shortening: 1 s, 2 s, 4 s … to 30 s. */
export function backoff(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000)
}

export const queryPolicy = { retry: shouldRetry, retryDelay: backoff } as const
export const mutationPolicy = { retry: false } as const
