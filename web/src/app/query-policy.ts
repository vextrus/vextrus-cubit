/*
 * The one retry rule of every query and mutation (S15-W1; m0-screens §4.1: "this page keeps trying").
 * A query that sets no `retry` of its own has this one, from the query client's defaults.
 *  - A refusal (4xx) is an answer: never tried again.
 *  - A fault (5xx) is tried a few more times, each wait longer, then it is the error.
 *  - A server that cannot be reached (a TypeError) keeps being tried: the frame's ErrorBar shows from
 *    the first failed try on (it reads the cache's error) and goes when one answers.
 *  - An act (a mutation) is never tried again by itself: its refusal is the answer.
 */
import { ApiRefused } from '@/api/client'
import { NoDeveloper } from './session'

/** Tries of a 5xx after the first. */
export const FAULT_RETRIES = 3

/** Retry rule for queries. No Developer is an answer of ours, not a failure: never tried again. */
export function shouldRetry(failures: number, error: unknown): boolean {
  if (error instanceof TypeError) return true
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
