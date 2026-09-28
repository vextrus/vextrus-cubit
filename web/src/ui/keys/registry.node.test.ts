import { describe, expect, it, vi } from 'vitest'
import { KeyMap, KeyMapError, comboFromEvent, normaliseCombo, type Scope } from './registry'
import { expectKeyMapSound, keyMapProblems } from './testing'

const globalScope: Scope = { level: 'global', name: 'global', id: 'global' }
const screen: Scope = { level: 'screen', name: 'step1', id: 'screen:1' }
const list: Scope = { level: 'region', name: 'list', id: 'region:1' }
const canvas: Scope = { level: 'region', name: 'canvas', id: 'region:2' }
const picker: Scope = { level: 'mode', name: 'exclusion-picker', id: 'mode:1' }
const overlay: Scope = { level: 'dialog', name: 'keys-overlay', id: 'dialog:1' }

const noop = () => {}
const ev = { preventDefault() {} } as unknown as KeyboardEvent
const b = (key: string, label = `Do ${key}`) => ({ key, label, group: 'screen' as const, run: noop })

describe('the key map: two bindings for one key in one scope is a bug (m0-screens §2.1)', () => {
  it('refuses a second binding for the same key in the same scope', () => {
    const map = new KeyMap({ strict: true })
    map.register(list, [b('Space', 'Select the row')])
    expect(() => map.register(list, [b('Space', 'Open the sheet')])).toThrow(KeyMapError)
  })

  it('refuses two bindings for one key inside one registration', () => {
    const map = new KeyMap({ strict: true })
    expect(() => map.register(screen, [b('Enter'), b('Enter')])).toThrow(/Enter/)
  })

  it('treats spellings of one key as the same key (Ctrl k, Ctrl K, ctrl+k)', () => {
    const map = new KeyMap({ strict: true })
    map.register(globalScope, [b('Ctrl K')])
    expect(() => map.register(globalScope, [b('ctrl+k')])).toThrow(KeyMapError)
  })

  it('reports the clash to a test even when the map does not throw (production mode)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(noop)
    const map = new KeyMap({ strict: false })
    map.register(list, [b('Space', 'Select the row')])
    map.register(list, [b('Space', 'Open the sheet')])
    expect(keyMapProblems(map)).toEqual([expect.stringMatching(/Space.*region "list"/)])
    expect(() => expectKeyMapSound(map)).toThrow(/Space/)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('allows one key in different scopes: that is the design, not a bug', () => {
    const map = new KeyMap({ strict: true })
    map.register(screen, [b('Enter', 'Confirm')])
    map.register(list, [b('Enter', 'Open the file report')])
    map.register(list, [b('ArrowDown', 'Next row')])
    map.register(canvas, [b('ArrowDown', 'Next sheet')])
    expect(keyMapProblems(map)).toEqual([])
    expect(() => expectKeyMapSound(map)).not.toThrow()
  })

  it('allows the key again once the first binding is unregistered', () => {
    const map = new KeyMap({ strict: true })
    const off = map.register(list, [b('Space', 'Select the row')])
    off()
    expect(() => map.register(list, [b('Space', 'Open the sheet')])).not.toThrow()
  })

  it('refuses a binding without a label, since the ? overlay lists every key', () => {
    const map = new KeyMap({ strict: true })
    expect(() => map.register(screen, [b('X', '')])).toThrow(/label/)
    const lax = new KeyMap({ strict: false })
    const error = vi.spyOn(console, 'error').mockImplementation(noop)
    lax.register(screen, [b('X', '  ')])
    expect(keyMapProblems(lax)).toEqual([expect.stringMatching(/no label/)])
    error.mockRestore()
  })

  it('never binds the browser’s own keys', () => {
    const map = new KeyMap({ strict: true })
    for (const key of ['Ctrl W', 'Ctrl T', 'Ctrl N', 'Ctrl L', 'Ctrl R', 'F5', 'F11', 'F12', 'Ctrl Tab']) {
      expect(() => map.register(globalScope, [b(key)]), key).toThrow(/browser/)
    }
  })
})

describe('the key map: the highest active scope takes a key', () => {
  it('gives the key to the highest active scope and never to the lower ones', () => {
    const map = new KeyMap({ strict: true })
    const order: string[] = []
    map.register(globalScope, [{ ...b('Escape'), run: () => order.push('global') }])
    map.register(screen, [{ ...b('Escape'), run: () => order.push('screen') }])
    map.register(picker, [{ ...b('Escape'), run: () => order.push('mode') }])
    map.register(overlay, [{ ...b('Escape'), run: () => order.push('dialog') }])

    map.resolve('Escape', [overlay, picker, screen, globalScope])?.run(ev)
    map.resolve('Escape', [picker, screen, globalScope])?.run(ev)
    map.resolve('Escape', [screen, globalScope])?.run(ev)
    map.resolve('Escape', [globalScope])?.run(ev)
    expect(order).toEqual(['dialog', 'mode', 'screen', 'global'])
  })

  it('orders scopes by level whatever order they are passed in', () => {
    const map = new KeyMap({ strict: true })
    map.register(screen, [b('Space', 'Screen space')])
    map.register(list, [b('Space', 'Open the focused sheet')])
    expect(map.resolve('Space', [screen, list, globalScope])?.label).toBe('Open the focused sheet')
  })

  it('passes a key down when the higher binding’s `when` is false', () => {
    const map = new KeyMap({ strict: true })
    map.register(screen, [{ ...b('Enter', 'Confirm'), when: () => false }])
    map.register(globalScope, [b('Enter', 'Global enter')])
    expect(map.resolve('Enter', [screen, globalScope])?.label).toBe('Global enter')
  })

  it('ignores scopes that are not active', () => {
    const map = new KeyMap({ strict: true })
    map.register(canvas, [b('F', 'Fit the whole sheet')])
    expect(map.resolve('F', [list, screen, globalScope])).toBeUndefined()
  })

  it('lists exactly the keys active now, each once, for the ? overlay', () => {
    const map = new KeyMap({ strict: true })
    map.register(globalScope, [{ ...b('?', 'Keys'), group: 'global' }, b('Escape', 'Close')])
    map.register(screen, [b('Escape', 'Leave the mode'), { ...b('Q', 'Next Question'), when: () => false }])
    map.register(canvas, [b('F', 'Fit the whole sheet')])
    const active = map.active([screen, globalScope]).map((x) => `${x.combo}: ${x.label}`)
    expect(active.sort()).toEqual(['?: Keys', 'Escape: Leave the mode'])
  })

  it('tells subscribers when bindings change', () => {
    const map = new KeyMap({ strict: true })
    const seen = vi.fn()
    map.subscribe(seen)
    const off = map.register(screen, [b('Q')])
    off()
    expect(seen).toHaveBeenCalledTimes(2)
  })
})

describe('keys are matched on event.key (m0-screens §2.1)', () => {
  it('normalises the written form of a combination', () => {
    expect(normaliseCombo('Ctrl K')).toBe('Ctrl+K')
    expect(normaliseCombo('shift f6')).toBe('Shift+F6')
    expect(normaliseCombo('Esc')).toBe('Escape')
    expect(normaliseCombo('↑')).toBe('ArrowUp')
    expect(normaliseCombo('Shift ↓')).toBe('Shift+ArrowDown')
    expect(normaliseCombo('f')).toBe('F')
    expect(normaliseCombo('Shift F')).toBe('Shift+F')
    expect(normaliseCombo('?')).toBe('?')
    expect(normaliseCombo('Space')).toBe('Space')
    expect(normaliseCombo('PageDown')).toBe('PageDown')
  })

  it('reads ? from event.key, so it works on any keyboard layout', () => {
    expect(comboFromEvent({ key: '?', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false })).toBe('?')
    expect(comboFromEvent({ key: '/', shiftKey: false, ctrlKey: false, metaKey: false, altKey: false })).toBe('/')
  })

  it('keeps Shift for letters and named keys, and reads Space and Ctrl', () => {
    const e = (key: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
      comboFromEvent({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods })
    expect(e('F', { shiftKey: true })).toBe('Shift+F')
    expect(e('f')).toBe('F')
    expect(e('F6', { shiftKey: true })).toBe('Shift+F6')
    expect(e('ArrowDown', { shiftKey: true })).toBe('Shift+ArrowDown')
    expect(e(' ')).toBe('Space')
    expect(e('k', { ctrlKey: true })).toBe('Ctrl+K')
    expect(e('k', { metaKey: true })).toBe('Ctrl+K')
    expect(e('Shift', { shiftKey: true })).toBeUndefined()
  })
})

