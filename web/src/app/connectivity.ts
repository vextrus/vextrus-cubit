/*
 * The frame's one connectivity (S15-W1, round 4; m0-screens §4.1 "Server unreachable"): the ErrorBar
 * shows iff the browser is offline, an act could not reach the server, or a read is failing as
 * unreachable (query-policy.ts `isUnreachable`: a network failure, or a 502, 503 or 504 with no body).
 * No screen and no other read decides it. While anything is down, one probe (a light read of /api/me,
 * with the policy's backoff, without end) asks whether the server answers; once it does, the acts' share
 * is cleared and every read that stopped (one that nothing tries again) is read again, so the bar goes
 * when the server answers, never later. Reads the policy keeps trying leave when they answer.
 */
import { onlineManager, type Query, type QueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { onActUnreachable } from '@/api/events'
import { backoff, isUnreachable } from './query-policy'

/** Failed tries in a row before a read being tried again counts as down (the policy keeps trying after). */
export const UNREACHABLE_AFTER = 2

const ACT = 'act'

export class Connectivity {
  private readonly down = new Set<string>()
  private readonly listeners = new Set<() => void>()
  private snapshot = false
  private attempt = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private users = 0
  private stops: (() => void)[] = []

  private readonly client: QueryClient

  constructor(client: QueryClient) {
    this.client = client
  }

  /** Whether the ErrorBar shows. */
  isDown = (): boolean => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (this.users++ === 0) this.start()
    return () => {
      this.listeners.delete(listener)
      if (--this.users === 0) this.stop()
    }
  }

  private start(): void {
    this.stops = [
      this.client.getQueryCache().subscribe((event) => {
        if (event.type === 'removed') return this.clear(event.query.queryHash)
        if (event.type !== 'updated') return
        const { query, action } = event
        if (action.type === 'success') this.clear(query.queryHash)
        else if (action.type === 'failed' && isUnreachable(action.error) && action.failureCount >= UNREACHABLE_AFTER) this.mark(query.queryHash)
        else if (action.type === 'error') {
          if (isUnreachable(action.error)) this.mark(query.queryHash)
          else this.clear(query.queryHash)
        }
      }),
      onActUnreachable(() => this.mark(ACT)),
      onlineManager.subscribe(() => this.publish()),
    ]
    this.publish()
  }

  private stop(): void {
    for (const stop of this.stops) stop()
    this.stops = []
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private mark(key: string): void {
    this.down.add(key)
    this.publish()
    this.schedule()
  }

  private clear(key: string): void {
    if (this.down.delete(key)) this.publish()
  }

  private publish(): void {
    const next = !onlineManager.isOnline() || this.down.size > 0
    if (next === this.snapshot) return
    this.snapshot = next
    if (!next) this.attempt = 0
    for (const listener of [...this.listeners]) listener()
  }

  /** The probe, while anything is down: asks, waits longer each time, never stops. */
  private schedule(): void {
    if (this.timer !== undefined || this.down.size === 0) return
    this.timer = setTimeout(() => {
      this.timer = undefined
      void this.probe()
    }, backoff(this.attempt++))
  }

  private async probe(): Promise<void> {
    let answered: boolean
    try {
      const { response } = await api.GET('/api/me')
      answered = !(response.status >= 502 && response.status <= 504 && (await response.clone().text()) === '')
    } catch {
      answered = false
    }
    if (answered) {
      this.attempt = 0
      this.down.delete(ACT)
      // Reads that stopped are read again; the ones the policy keeps trying leave as they answer.
      for (const key of [...this.down]) {
        const query = this.client.getQueryCache().get(key) as Query | undefined
        if (!query || query.getObserversCount() === 0) this.down.delete(key)
        else if (query.state.fetchStatus === 'idle') void query.fetch().catch(() => undefined)
      }
      this.publish()
    }
    this.schedule()
  }
}

const connectivities = new WeakMap<QueryClient, Connectivity>()

/** The client's one connectivity. */
export function connectivityOf(client: QueryClient): Connectivity {
  let found = connectivities.get(client)
  if (!found) {
    found = new Connectivity(client)
    connectivities.set(client, found)
  }
  return found
}
