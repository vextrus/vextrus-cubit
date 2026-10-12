/*
 * The save state the status bar shows (m0-screens §4.1: "All changes saved" / "Saving…" / "Not saved: the
 * connection dropped. Trying again."), fed by the API client's acts (client.ts), the unsafe requests:
 * "Saving…" while one is on its way; "Not saved" once one could not reach the server; "All changes saved"
 * otherwise. Reads never change it.
 *
 * Each act has a sequence number, taken as it starts. A lost act's change is unsent, and only an act that
 * started after it and is answered carries the screen's state past it: "Not saved" holds while the last lost
 * act started after the last answered one, so an earlier act's answer never clears a later act's loss, and
 * the connection coming back does not either (nothing here sends the change again). The words are
 * m0-screens' own: "Trying again." is the connection's probe (app/connectivity.ts), not a resend.
 */
export type SaveState = 'saved' | 'saving' | 'dropped'

const listeners = new Set<() => void>()
let pending = 0
let started = 0
/** The sequence number of the latest lost act, and of the latest act answered, among those started so far. */
let lastLost = 0
let lastAnswered = 0
let snapshot: SaveState = 'saved'

function publish(): void {
  const next: SaveState = pending > 0 ? 'saving' : lastLost > lastAnswered ? 'dropped' : 'saved'
  if (next === snapshot) return
  snapshot = next
  for (const listener of [...listeners]) listener()
}

/** An act is on its way. Returns how it ended: `answered` when the server replied, `dropped` when it could not be reached. */
export function actStarted(): (outcome: 'answered' | 'dropped') => void {
  pending++
  const sequence = ++started
  publish()
  let settled = false
  return (outcome) => {
    if (settled) return
    settled = true
    pending--
    if (outcome === 'dropped') lastLost = Math.max(lastLost, sequence)
    else lastAnswered = Math.max(lastAnswered, sequence)
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
  started = 0
  lastLost = 0
  lastAnswered = 0
  publish()
}
