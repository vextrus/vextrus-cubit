// The vextrus-factory mod's state contract (docs/specs/factory.md 4(b)).

/** The poll's last reading of .private/work/factory/status.json, kept for the band to draw. */
export type Reading = {
  /** The file's text as read; null when the read failed (missing, unreadable). */
  text: string | null
}

declare module 'claude-code' {
  interface PluginState {
    'vextrus-factory': { reading: Reading }
  }
}
