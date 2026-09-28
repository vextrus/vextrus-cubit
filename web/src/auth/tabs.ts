/*
 * A browser's tabs share one session cookie: signing in or out, joining, or choosing a Developer in one
 * tab changes what every other tab works in, as whom. The tab that did it tells the others, which read
 * the session again (SessionWatch) and never go on showing, or writing into, a Developer or a person
 * the session no longer has (the trust boundary; review 20a r1). One channel per app (per query
 * client), so two apps mounted in one test hear each other as two tabs do, and never themselves.
 */
import type { QueryClient } from '@tanstack/react-query'

const CHANGED = 'session-changed'
let channelName = 'vextrus-session'

const channels = new WeakMap<QueryClient, BroadcastChannel>()

/** For tests: a name of their own, so one test file's tabs never hear another file's. */
export function nameTabChannel(name: string): void {
  channelName = name
}

function channelOf(queryClient: QueryClient): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  let channel = channels.get(queryClient)
  if (!channel) {
    channel = new BroadcastChannel(channelName)
    channels.set(queryClient, channel)
  }
  return channel
}

/** Tells this browser's other tabs that the session changed: they read it again. */
export function tellOtherTabs(queryClient: QueryClient): void {
  channelOf(queryClient)?.postMessage(CHANGED)
}

/** Hears the other tabs' news; returns the way to stop listening. */
export function onOtherTabs(queryClient: QueryClient, listener: () => void): () => void {
  const channel = channelOf(queryClient)
  if (!channel) return () => undefined
  const heard = (event: MessageEvent) => {
    if (event.data === CHANGED) listener()
  }
  channel.addEventListener('message', heard)
  return () => channel.removeEventListener('message', heard)
}
