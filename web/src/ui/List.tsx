/*
 * The keyboard list every table uses (docs/design/m0-screens.md §3, §2.2): 28 px rows, one focused
 * row, ↑ ↓ Home End, and, on lists that opt in, selection by Space, Shift ↑ ↓ and Shift-click. Its
 * keys are registered in the key map at region scope ("list"), so they work while focus is in the
 * list and a feature's own region keys join them through `keys`. Space-to-select is an opt-in: Step 1
 * leaves it off and binds Space itself (the review U1); a list that selects with Space and a feature
 * that claims Space fail the key-map test.
 *
 * Focus survives a re-render (the focused row is held by key, and a row that goes takes focus to its
 * neighbour); the focused row scrolls into view.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLingui } from '@lingui/react/macro'
import { cn } from './cn'
import { KeyRegion, useKeys } from './keys/KeyMapProvider'
import type { Binding } from './keys/registry'

export interface ListProps<T> {
  /** The list's accessible name, from the catalogue. */
  label: string
  items: readonly T[]
  getKey: (item: T) => string
  renderItem: (item: T, state: { focused: boolean; selected: boolean }) => ReactNode
  focusedKey?: string | null
  onFocusedKeyChange?: (key: string | null) => void
  /** Selection by Space, Shift ↑ ↓ and Shift-click. Off unless the list opts in. */
  selectable?: boolean
  selectedKeys?: ReadonlySet<string>
  onSelectedKeysChange?: (keys: ReadonlySet<string>) => void
  /** More keys for this list's region, such as Step 1's Space or a list's Enter. */
  keys?: readonly Binding[]
  className?: string
  rowClassName?: string
}

function useControlled<V>(value: V | undefined, onChange: ((v: V) => void) | undefined, initial: V) {
  const [inner, setInner] = useState(initial)
  const current = value === undefined ? inner : value
  return [
    current,
    (next: V) => {
      if (value === undefined) setInner(next)
      onChange?.(next)
    },
  ] as const
}

export function List<T>(props: ListProps<T>) {
  const { label, items, getKey, renderItem, selectable = false, keys = [], className, rowClassName } = props
  const base = useId()
  const [focusedKey, setFocusedKey] = useControlled<string | null>(props.focusedKey, props.onFocusedKeyChange, null)
  const [selected, setSelected] = useControlled<ReadonlySet<string>>(props.selectedKeys, props.onSelectedKeysChange, new Set())
  const anchor = useRef<string | null>(null)
  const lastIndex = useRef(0)

  const keysOf = items.map(getKey)
  let focusedIndex = focusedKey === null ? -1 : keysOf.indexOf(focusedKey)
  if (focusedKey !== null && focusedIndex < 0 && items.length > 0) focusedIndex = Math.min(lastIndex.current, items.length - 1)
  const focused = focusedIndex >= 0 ? keysOf[focusedIndex]! : null
  const optionId = (i: number) => `${base}-row-${i}`

  useEffect(() => {
    if (focusedIndex >= 0) lastIndex.current = focusedIndex
    if (focused !== focusedKey && focused !== null) setFocusedKey(focused)
    if (focusedIndex >= 0) document.getElementById(optionId(focusedIndex))?.scrollIntoView({ block: 'nearest' })
  })

  function focusAt(index: number, extend = false) {
    if (items.length === 0) return
    const i = Math.max(0, Math.min(items.length - 1, index))
    const key = keysOf[i]!
    setFocusedKey(key)
    if (extend && selectable) selectRange(anchor.current ?? focused ?? key, key)
  }

  function selectRange(from: string, to: string) {
    const a = keysOf.indexOf(from)
    const b = keysOf.indexOf(to)
    if (a < 0 || b < 0) return
    const next = new Set(selected)
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(keysOf[i]!)
    setSelected(next)
  }

  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    anchor.current = key
    setSelected(next)
  }

  const current = focusedIndex
  return (
    <KeyRegion
      name="list"
      role="listbox"
      aria-label={label}
      aria-multiselectable={selectable || undefined}
      aria-activedescendant={focusedIndex >= 0 ? optionId(focusedIndex) : undefined}
      tabIndex={0}
      className={cn('group/list outline-none', className)}
    >
      <ListKeys
        onMove={(delta, extend) => focusAt(current < 0 ? (delta > 0 ? 0 : items.length - 1) : current + delta, extend)}
        onEdge={(end) => focusAt(end ? items.length - 1 : 0)}
        onToggle={selectable && focused !== null ? () => toggle(focused) : undefined}
        selectable={selectable}
        extra={keys}
      />
      {items.map((item, i) => {
        const key = keysOf[i]!
        const isFocused = i === focusedIndex
        const isSelected = selectable ? selected.has(key) : isFocused
        return (
          <div
            key={key}
            id={optionId(i)}
            role="option"
            aria-selected={isSelected}
            data-focused={isFocused || undefined}
            onClick={(event) => {
              if (selectable && event.shiftKey) {
                selectRange(anchor.current ?? focused ?? key, key)
              } else if (selectable) {
                anchor.current = key
                setSelected(new Set([key]))
              }
              setFocusedKey(key)
            }}
            className={cn(
              'relative flex h-row items-center gap-2 border-b border-border px-2 text-sm whitespace-nowrap',
              selectable && isSelected && 'bg-selected before:absolute before:inset-y-0 before:start-0 before:w-0.5 before:bg-selection',
              'group-focus-visible/list:data-[focused]:outline-2 group-focus-visible/list:data-[focused]:-outline-offset-2 group-focus-visible/list:data-[focused]:outline-ring',
              'data-[focused]:bg-hover',
              rowClassName,
            )}
          >
            {renderItem(item, { focused: isFocused, selected: isSelected })}
          </div>
        )
      })}
    </KeyRegion>
  )
}

function ListKeys({
  onMove,
  onEdge,
  onToggle,
  selectable,
  extra,
}: {
  onMove: (delta: number, extend: boolean) => void
  onEdge: (end: boolean) => void
  onToggle?: () => void
  selectable: boolean
  extra: readonly Binding[]
}) {
  const { t } = useLingui()
  const own: Binding[] = [
    { key: '↑', label: t`Previous row`, group: 'screen', run: () => onMove(-1, false) },
    { key: '↓', label: t`Next row`, group: 'screen', run: () => onMove(1, false) },
    { key: 'Home', label: t`First row`, group: 'screen', run: () => onEdge(false) },
    { key: 'End', label: t`Last row`, group: 'screen', run: () => onEdge(true) },
  ]
  if (selectable) {
    own.push(
      { key: 'Space', label: t`Select the row, or take it out`, group: 'screen', run: () => onToggle?.() },
      { key: 'Shift ↑', label: t`Extend the selection up`, group: 'screen', run: () => onMove(-1, true) },
      { key: 'Shift ↓', label: t`Extend the selection down`, group: 'screen', run: () => onMove(1, true) },
    )
  }
  useKeys([...own, ...extra])
  return null
}
