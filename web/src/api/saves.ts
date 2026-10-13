/*
 * The save state the status bar shows (m0-screens §4.1: "All changes saved" / "Saving…" / "Not saved: the
 * connection dropped. Trying again."), fed by the API client's acts (client.ts), the unsafe requests:
 * "Saving…" while one is on its way; "Not saved" once one could not reach the server; "All changes saved"
 * otherwise. Reads never change it.
 *
 * One monotone clock ticks at every act's start and at every loss, when the loss is seen. A lost act's change
 * is unsent, and only an act that started after that loss was seen, and is answered, carries the screen's
 * state past it: "Not saved" holds while the last loss's tick is later than the start of every answered act,
 * so an answer that arrived before the loss was seen never clears it, nor does an earlier act's answer, nor
 * the connection coming back (nothing here sends the change again). The words are
 * m0-screens' own: "Trying again." is the connection's probe (app/connectivity.ts), not a resend.
 */
export type SaveState = 'saved' | 'saving' | 'dropped'

const listeners = new Set<() => void>()
let pending = 0
let clock = 0
/** The clock tick at which the latest loss was seen, and the latest start among the acts answered. */
let lastLostAt = 0
let lastAnsweredStart = 0
let snapshot: SaveState = 'saved'

function publish(): void {
  const next: SaveState = pending > 0 ? 'saving' : lastLostAt > lastAnsweredStart ? 'dropped' : 'saved'
  if (next === snapshot) return
  snapshot = next
  for (const listener of [...listeners]) listener()
}

/** An act is on its way. Returns how it ended: `answered` when the server replied, `dropped` when it could not be reached. */
export function actStarted(): (outcome: 'answered' | 'dropped') => void {
  pending++
  const startedAt = ++clock
  publish()
  let settled = false
  return (outcome) => {
    if (settled) return
    settled = true
    pending--
    if (outcome === 'dropped') lastLostAt = ++clock
    else lastAnsweredStart = Math.max(lastAnsweredStart, startedAt)
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
  clock = 0
  lastLostAt = 0
  lastAnsweredStart = 0
  publish()
}
