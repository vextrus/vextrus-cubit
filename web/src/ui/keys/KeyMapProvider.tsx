/*
 * The key map's React side: one `keydown` listener for the whole app, scopes as components, and
 * `useKeys` for features to register through (docs/design/m0-screens.md §2.1).
 *
 *   <KeyMapProvider>                         the listener and the global scope
 *     <KeyScope level="screen" name="step1">  active while mounted
 *       <KeyRegion name="list">               active while focus is inside it (a <div>)
 *         useKeys([{ key: 'Space', label: t`Open the sheet`, group: 'screen', run }])
 *     <KeyScope level="mode" name="exclusion-picker">   active while mounted, above regions
 *     <KeyScope level="dialog" name="keys-overlay">     while mounted, the only scope keys reach
 *
 * Rules the listener applies before the map:
 * - Typing wins: in a text field only Esc, Enter, Tab and Ctrl shortcuts reach the map.
 * - A widget owns its own keys: arrows, Home, End, PageUp, PageDown, Space and Enter inside a menu,
 *   tab list, radio group, slider or a listbox that is not a KeyRegion go to the widget (Radix and
 *   cmdk handle them); Space and Enter on a focused button or link press it.
 * - A dialog is modal for keys too: while one is open, only the top-most dialog's bindings run.
 */
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { comboFromEvent, KeyMap, type Binding, type Scope, type ScopeLevel } from './registry'

interface KeyRuntime {
  map: KeyMap
  global: Scope
  mount(scope: Scope): () => void
  activeScopesFor(target: Element | null): Scope[]
}

const RuntimeContext = createContext<KeyRuntime | null>(null)
const ScopeContext = createContext<Scope | null>(null)

// eslint-disable-next-line lingui/no-unlocalized-strings -- key names, not prose
const WIDGET_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Space', 'Enter'])
// A radio group takes the arrows and Space, never Enter (WAI-ARIA's radio group): Enter on a radio, or
// in a field inside the group, reaches the map (#156's review: Enter on a Question's option answers it).
const ENTER_WIDGETS =
  '[role=menu],[role=menubar],[role=tablist],[role=slider],[role=spinbutton],[role=tree],' +
  '[role=listbox]:not([data-key-region]),[role=grid]:not([data-key-region]),[cmdk-root]'
const WIDGETS = `${ENTER_WIDGETS},[role=radiogroup]`
const PRESSABLE = 'button,a[href],summary,input[type=checkbox],[role=button],[role=checkbox],[role=switch]'
const RADIO = 'input[type=radio],[role=radio]'
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'time', ''])

function isTyping(target: Element | null): boolean {
  if (!target) return false
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(target.type)
  return target instanceof HTMLElement && target.isContentEditable
}

function reachesMapWhileTyping(combo: string): boolean {
  return combo === 'Escape' || combo === 'Enter' || combo === 'Tab' || combo === 'Shift+Tab' || combo.startsWith('Ctrl+')
}

function ownedByWidget(target: Element | null, combo: string): boolean {
  if (!target || !WIDGET_KEYS.has(combo)) return false
  if (combo === 'Space') return target.closest(`${PRESSABLE},${RADIO}`) !== null || target.closest(WIDGETS) !== null
  if (combo === 'Enter') return target.closest(PRESSABLE) !== null || target.closest(ENTER_WIDGETS) !== null
  return target.closest(WIDGETS) !== null
}

export function KeyMapProvider({ map: given, children }: { map?: KeyMap; children: ReactNode }) {
  const [map] = useState(() => given ?? new KeyMap({ strict: import.meta.env.DEV || import.meta.env.MODE === 'test' }))
  const runtime = useMemo<KeyRuntime>(() => {
    const global: Scope = { level: 'global', name: 'global', id: 'global' }
    const mounted = new Map<string, Scope>()
    const order: string[] = []
    return {
      map,
      global,
      mount(scope) {
        mounted.set(scope.id, scope)
        order.push(scope.id)
        return () => {
          mounted.delete(scope.id)
          order.splice(order.lastIndexOf(scope.id), 1)
        }
      },
      activeScopesFor(target) {
        const latestFirst = [...order].reverse().map((id) => mounted.get(id)).filter((s): s is Scope => !!s)
        const dialog = latestFirst.find((s) => s.level === 'dialog')
        if (dialog) return [dialog]
        const regions: Scope[] = []
        for (let el = target?.closest('[data-key-region]'); el; el = el.parentElement?.closest('[data-key-region]')) {
          const scope = mounted.get(el.getAttribute('data-key-region') ?? '')
          if (scope) regions.push(scope)
        }
        return [
          ...latestFirst.filter((s) => s.level === 'mode'),
          ...regions,
          ...latestFirst.filter((s) => s.level === 'screen'),
          global,
        ]
      },
    }
  }, [map])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return
      const combo = comboFromEvent(event)
      if (!combo) return
      const target = event.target instanceof Element ? event.target : null
      if (isTyping(target) && !reachesMapWhileTyping(combo)) return
      if (ownedByWidget(target, combo)) return
      const binding = map.resolve(combo, runtime.activeScopesFor(target))
      if (!binding) return
      event.preventDefault()
      binding.run(event)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [map, runtime])

  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>
}

function useRuntime(): KeyRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error('Keys are registered inside <KeyMapProvider>')
  return runtime
}

/** The map itself, for the ? overlay and for tests (`expectKeyMapSound`). */
export function useKeyMap(): KeyMap {
  return useRuntime().map
}

/** The bindings a key press on `target` would reach now, each key once: what the ? overlay lists. */
export function useActiveKeys(): (target: Element | null) => ReturnType<KeyMap['active']> {
  const runtime = useRuntime()
  return (target) => runtime.map.active(runtime.activeScopesFor(target))
}

function useScope(level: ScopeLevel, name: string): Scope {
  const runtime = useRuntime()
  const id = useId()
  const scope = useMemo<Scope>(() => ({ level, name, id: `${level}:${name}:${id}` }), [level, name, id])
  useLayoutEffect(() => runtime.mount(scope), [runtime, scope])
  return scope
}

/** A screen, mode or dialog scope: active while mounted. */
export function KeyScope({ level, name, children }: { level: 'screen' | 'mode' | 'dialog'; name: string; children: ReactNode }) {
  const scope = useScope(level, name)
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>
}

/** A region scope (list, canvas, inspector): a <div> whose keys are active while focus is inside. */
export function KeyRegion({ name, children, ...rest }: { name: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const scope = useScope('region', name)
  return (
    <div {...rest} data-key-region={scope.id}>
      <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>
    </div>
  )
}

/**
 * Registers bindings in the nearest scope (the global scope outside any). Labels come from the
 * catalogue; `run` and `when` may change on every render without re-registering.
 */
export function useKeys(bindings: readonly Binding[]): void {
  const runtime = useRuntime()
  const scope = useContext(ScopeContext) ?? runtime.global
  const latest = useRef(bindings)
  useLayoutEffect(() => {
    latest.current = bindings
  })
  const signature = bindings.map((b) => `${b.key}\u0001${b.label}\u0001${b.group}`).join('\u0002')
  useLayoutEffect(() => {
    const stable: Binding[] = latest.current.map((b, i) => ({
      key: b.key,
      label: b.label,
      group: b.group,
      when: () => latest.current[i]?.when?.() ?? true,
      run: (event) => latest.current[i]?.run(event),
    }))
    return runtime.map.register(scope, stable)
    // The signature stands for the bindings' keys, labels and groups.
  }, [runtime, scope, signature])
}
