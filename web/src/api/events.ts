/*
 * The session's events, announced by the client (client.ts) whatever made the request: signed out
 * (the frame opens 4.1's "Signed out while working" dialog) and no Developer to work in (a revoked or
 * ended Membership: the frame clears what it held and goes to 4.1's "Access ended" or the chooser).
 */
export type SessionEvent = 'signed-out' | 'no-developer'

type Listener = (event: SessionEvent) => void

const listeners = new Set<Listener>()

export function onSessionEvent(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitSessionEvent(event: SessionEvent): void {
  for (const listener of [...listeners]) listener(event)
}
