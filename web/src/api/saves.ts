/*
 * The save state the status bar shows (m0-screens §4.1: "All changes saved" / "Saving…" / "Not saved: the
 * connection dropped. Trying again."), fed by the API client's acts (client.ts), the unsafe requests:
 * "Saving…" while one is on its way; "Not saved" once one could not reach the server, until a later act
 * is answered; "All changes saved" otherwise. Reads never change it.
 */
export type SaveState = 'saved' | 'saving' | 'dropped'

const listeners = new Set<() => void>()
let pending = 0
let dropped = false
let snapshot: SaveState = 'saved'

function publish(): void {
  const next: SaveState = pending > 0 ? 'saving' : dropped ? 'dropped' : 'saved'
  if (next === snapshot) return
  snapshot = next
  for (const listener of [...listeners]) listener()
}

/** An act is on its way. Returns how it ended: `answered` when the server replied, `dropped` when it could not be reached. */
export function actStarted(): (outcome: 'answered' | 'dropped') => void {
  pending++
  publish()
  let settled = false
  return (outcome) => {
    if (settled) return
    settled = true
    pending--
    dropped = outcome === 'dropped'
    publish()
  }
}

export function saveState(): SaveState {
  return snapshot
}

export function onSaveState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Tests only: a new network starts with nothing in flight and nothing lost. */
export function resetSaves(): void {
  pending = 0
  dropped = false
  publish()
}
