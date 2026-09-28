/* eslint-disable lingui/no-unlocalized-strings -- key names and developer errors; nothing here is shown in the UI */
/*
 * The one key map (docs/design/m0-screens.md §2). Features never add a `keydown` listener of their
 * own: they register bindings through `useKeys` into a scope, and the map gives each key press to the
 * highest active scope that has an active binding for it.
 *
 *   dialog (a modal, the keys overlay) → mode (a picker, an inline edit) → region (the focused list,
 *   canvas or inspector) → screen → global
 *
 * One key bound in different scopes is the design (Space on Step 1's list outranks the list's own
 * Space-to-select). Two bindings for one key in one scope is a bug: the map throws in development and
 * in tests, and `expectKeyMapSound` fails a screen's test on it (m0-screens §2.1; the review U1).
 *
 * This file is plain TypeScript (no React, no DOM) so the rules are tested in node.
 */

export type ScopeLevel = 'dialog' | 'mode' | 'region' | 'screen' | 'global'

/** Highest first. */
export const SCOPE_LEVELS: readonly ScopeLevel[] = ['dialog', 'mode', 'region', 'screen', 'global']

/** A scope instance: a level, a name for people ("list", "step1") and an id unique to the instance. */
export interface Scope {
  level: ScopeLevel
  name: string
  id: string
}

/** Where the ? overlay lists a key: "On this screen", "On the sheet", "Everywhere". */
export type KeyGroup = 'screen' | 'sheet' | 'global'

export interface Binding {
  /** As written in m0-screens §2.2: `Ctrl K`, `Shift F6`, `?`, `Space`, `↑`, `Esc`, `PageDown`. */
  key: string
  /** What the key does, from the catalogue; the ? overlay shows it. */
  label: string
  group: KeyGroup
  /** The binding is active only while this returns true; otherwise the key falls to lower scopes. */
  when?: () => boolean
  run: (event: KeyboardEvent) => void
}

export interface RegisteredBinding extends Binding {
  scope: Scope
  /** The normalised combination, such as `Ctrl+K` or `Shift+ArrowDown`. */
  combo: string
}

export class KeyMapError extends Error {
  override name = 'KeyMapError'
}

/** Keys the browser owns; the map never binds them (m0-screens §2.1). */
const BROWSER_KEYS = new Set(['Ctrl+W', 'Ctrl+T', 'Ctrl+N', 'Ctrl+L', 'Ctrl+R', 'F5', 'F11', 'F12', 'Ctrl+Tab', 'Ctrl+Shift+Tab'])

const ALIASES: Record<string, string> = {
  esc: 'Escape',
  escape: 'Escape',
  enter: 'Enter',
  return: 'Enter',
  '↵': 'Enter',
  space: 'Space',
  tab: 'Tab',
  '↑': 'ArrowUp',
  '↓': 'ArrowDown',
  '←': 'ArrowLeft',
  '→': 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  delete: 'Delete',
  backspace: 'Backspace',
  '−': '-',
}

const MODIFIERS = ['Ctrl', 'Alt', 'Shift'] as const
type Modifier = (typeof MODIFIERS)[number]

function canonicalKey(raw: string): string {
  const alias = ALIASES[raw.toLowerCase()] ?? ALIASES[raw]
  if (alias) return alias
  if (/^f\d{1,2}$/i.test(raw)) return raw.toUpperCase()
  if (raw.length === 1) return raw.toUpperCase()
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

/** A printable character other than a letter carries its own Shift (`?` is Shift / on one layout). */
function shiftIsIntrinsic(key: string): boolean {
  return key.length === 1 && !/[A-Z]/.test(key)
}

function joinCombo(mods: ReadonlySet<Modifier>, key: string): string {
  const parts: string[] = MODIFIERS.filter((m) => mods.has(m) && !(m === 'Shift' && shiftIsIntrinsic(key)))
  parts.push(key)
  return parts.join('+')
}

/** `Ctrl K`, `ctrl+k` and `Ctrl+K` are one key: `Ctrl+K`. */
export function normaliseCombo(written: string): string {
  const tokens = written.trim() === '+' ? ['+'] : written.trim().split(/[\s+]+(?=.)/)
  const mods = new Set<Modifier>()
  let key: string | undefined
  for (const token of tokens) {
    const lower = token.toLowerCase()
    if (lower === 'ctrl' || lower === 'control' || lower === 'mod' || lower === 'cmd') mods.add('Ctrl')
    else if (lower === 'alt' || lower === 'option') mods.add('Alt')
    else if (lower === 'shift') mods.add('Shift')
    else key = canonicalKey(token)
  }
  if (!key) throw new KeyMapError(`"${written}" names no key`)
  return joinCombo(mods, key)
}

export interface KeyEventLike {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}

/** The combination a key press means, matched on `event.key`; undefined for a bare modifier. */
export function comboFromEvent(event: KeyEventLike): string | undefined {
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified'].includes(event.key)) return undefined
  const key = event.key === ' ' ? 'Space' : canonicalKey(event.key)
  const mods = new Set<Modifier>()
  if (event.ctrlKey || event.metaKey) mods.add('Ctrl')
  if (event.altKey) mods.add('Alt')
  if (event.shiftKey) mods.add('Shift')
  return joinCombo(mods, key)
}

function levelRank(level: ScopeLevel): number {
  return SCOPE_LEVELS.indexOf(level)
}

/** Stable sort, highest level first; within a level the caller's order (innermost region first). */
function byPrecedence(scopes: readonly Scope[]): Scope[] {
  return scopes
    .map((scope, i) => ({ scope, i }))
    .sort((a, b) => levelRank(a.scope.level) - levelRank(b.scope.level) || a.i - b.i)
    .map((x) => x.scope)
}

function describeScope(scope: Scope): string {
  return `${scope.level} "${scope.name}"`
}

export interface KeyMapOptions {
  /** Throw on a clash (development and tests); otherwise log it and keep going (production). */
  strict: boolean
}

export class KeyMap {
  private readonly bindings: RegisteredBinding[] = []
  private readonly listeners = new Set<() => void>()
  readonly strict: boolean

  constructor(options: KeyMapOptions) {
    this.strict = options.strict
  }

  /** Registers bindings in one scope; returns the function that removes them. */
  register(scope: Scope, bindings: readonly Binding[]): () => void {
    const added: RegisteredBinding[] = []
    for (const binding of bindings) {
      const combo = normaliseCombo(binding.key)
      if (BROWSER_KEYS.has(combo)) {
        this.fail(`${combo} belongs to the browser and is never bound (m0-screens §2.1)`)
        continue
      }
      if (!binding.label.trim()) this.fail(`${combo} in ${describeScope(scope)} has no label for the ? overlay`)
      const clash = [...this.bindings, ...added].find((b) => b.scope.id === scope.id && b.combo === combo)
      if (clash) {
        this.fail(
          `${combo} is bound twice in ${describeScope(scope)}: "${clash.label}" and "${binding.label}". ` +
            'One key in one scope takes one binding (m0-screens §2.1).',
        )
      }
      added.push({ ...binding, scope, combo })
    }
    this.bindings.push(...added)
    this.emit()
    return () => {
      for (const b of added) {
        const i = this.bindings.indexOf(b)
        if (i >= 0) this.bindings.splice(i, 1)
      }
      this.emit()
    }
  }

  /** The binding that takes this combination, given the active scopes; lower scopes never see it. */
  resolve(combo: string, activeScopes: readonly Scope[]): RegisteredBinding | undefined {
    const wanted = combo.includes('+') || combo.length > 1 ? combo : normaliseCombo(combo)
    for (const scope of byPrecedence(activeScopes)) {
      const hit = this.bindings.find((b) => b.scope.id === scope.id && b.combo === wanted && (b.when?.() ?? true))
      if (hit) return hit
    }
    return undefined
  }

  /** Every key active now, each once (the binding that would take it), for the ? overlay. */
  active(activeScopes: readonly Scope[]): RegisteredBinding[] {
    const seen = new Set<string>()
    const out: RegisteredBinding[] = []
    for (const scope of byPrecedence(activeScopes)) {
      for (const b of this.bindings) {
        if (b.scope.id !== scope.id || seen.has(b.combo) || !(b.when?.() ?? true)) continue
        seen.add(b.combo)
        out.push(b)
      }
    }
    return out
  }

  /** Every registered binding, active or not. */
  all(): readonly RegisteredBinding[] {
    return this.bindings
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit() {
    for (const l of this.listeners) l()
  }

  private fail(message: string) {
    if (this.strict) throw new KeyMapError(message)
    console.error(`Key map: ${message}`)
  }
}
