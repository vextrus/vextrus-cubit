/*
 * The session's events, announced by the client (client.ts) whatever made the request: signed out
 * (the frame opens 4.1's "Signed out while working" dialog) and no Developer to work in (a revoked or
 * ended Membership: the frame clears what it held and goes to 4.1's "Access ended" or the chooser);
 * and, from the frame's watch, signed in again after being signed out (a problem that said so is gone).
 */
export type SessionEvent = 'signed-out' | 'no-developer' | 'signed-in'

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

/**
 * An act (an unsafe request) that could not reach the server, announced by the client (client.ts): the
 * frame's connectivity (app/connectivity.ts) takes it up, since an act is never tried again by itself.
 */
const actListeners = new Set<() => void>()

export function onActUnreachable(listener: () => void): () => void {
  actListeners.add(listener)
  return () => {
    actListeners.delete(listener)
  }
}

export function emitActUnreachable(): void {
  for (const listener of [...actListeners]) listener()
}
