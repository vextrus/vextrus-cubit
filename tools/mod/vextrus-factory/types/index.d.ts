// The vextrus-factory mod's state contract (docs/specs/factory.md 4(b)).

/** The poll's last reading of .private/work/factory/status.json, kept for the band to draw. */
export type Reading = {
  /** The file's text as read; null when the read failed (missing, unreadable). */
  text: string | null
}

/** The poll's last reading of events.log: its newest high-signal events, newest first (READY, BLOCKED, LEAK-HIT, BUDGET-PASSED, CI-RED). */
export type Events = {
  /** True when events.log exists but neither it nor events.tail could be read: the band says so. */
  unreadable?: boolean
  events: { at: string; kind: string; ticket: string; detail: string }[]
}

/** The poll's last reading of the clock's session.json (stamp.py's `start`): the spinner's elapsed/budget reads it. */
export type Session = {
  /** The file's text as read; null when missing, over 64 KiB or unreadable. */
  text: string | null
}

/** The last review's cost: `total_cost_usd` of review-cost.jsonl's last line; null when it holds none. */
export type Cost = {
  usd: number | null
}

/** The ledger's verdict of each listed review, keyed `<pr>-<head>` (ledger/<pr>-<head>.json). */
export type Verdicts = {
  byReview: Record<string, 'PASS' | 'FIX' | 'BLOCK'>
}

/** The /factory pane's tab: local UI state, set by a tab Button's press. */
export type Tab = {
  name: 'Builders' | 'Reviews' | 'Lock' | 'PR queue'
}

declare module 'claude-code' {
  interface PluginState {
    'vextrus-factory': { reading: Reading; events: Events; session: Session; cost: Cost; verdicts: Verdicts; tab: Tab }
  }
}
