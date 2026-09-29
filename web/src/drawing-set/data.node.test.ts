/*
 * The Drawing Set's data rules (m0-screens §4.5): which acts a row offers, the table's order, the
 * progress share and a Discipline's name in the language shown.
 */
import { describe, expect, it } from 'vitest'
import { disciplineName, progressShare, rowActs, tableOrder, type FileOut } from './data'

const msg = (code: string, params: Record<string, string | number> = {}) => ({ code, params })

let n = 0
function f(over: Partial<FileOut>): FileOut {
  n += 1
  return {
    id: `f${n}`,
    name: `F${n}.dwg`,
    format: 'dwg',
    size: 1,
    discipline: null,
    state: 'read',
    status: msg('drawings.files.read'),
    finding: null,
    sheets_found: null,
    plot_for: [],
    added_at: '2026-09-26T05:00:00Z',
    added_by_name: 'Nusrat Jahan',
    added_by_vextrus: false,
    ...over,
  }
}

describe('rowActs', () => {
  it.each([
    ['waiting', ['cancel']],
    ['reading', ['cancel']],
    ['retrying', ['cancel']],
    ['stopping', []],
    ['cancelled', ['read_again']],
    ['failed', ['try_again']],
    ['unreadable', []],
    ['read', ['open_step1']],
    ['held', []],
    ['refused', []],
    ['a state the web does not know', []],
  ])('offers a QS on a %s file %j', (state, acts) => {
    expect(rowActs({ state, format: 'dwg' }, true)).toEqual(acts)
  })

  it('offers the MD and a Guest only "Open in Step 1", never a change', () => {
    for (const state of ['waiting', 'reading', 'retrying', 'cancelled', 'failed', 'held']) expect(rowActs({ state, format: 'dwg' }, false)).toEqual([])
    expect(rowActs({ state: 'read', format: 'dwg' }, false)).toEqual(['open_step1'])
  })

  it('never opens a PDF in Step 1: its pages are its DWG sheets', () => {
    expect(rowActs({ state: 'read', format: 'pdf' }, true)).toEqual([])
  })
})

describe('tableOrder', () => {
  it('keeps the order added, and moves a PDF whose pages match a DWG under that DWG', () => {
    const dwg = f({})
    const other = f({})
    const pdf = f({ format: 'pdf', plot_for: [dwg.id] })
    const loose = f({ format: 'pdf' })
    const rows = tableOrder([dwg, other, loose, pdf])
    expect(rows.map((r) => [r.file.id, r.under])).toEqual([
      [dwg.id, false],
      [pdf.id, true],
      [other.id, false],
      [loose.id, false],
    ])
  })

  it('never loses a PDF whose DWG is not in the list', () => {
    const pdf = f({ format: 'pdf', plot_for: ['gone'] })
    expect(tableOrder([pdf]).map((r) => r.file.id)).toEqual([pdf.id])
  })
})

describe('progressShare', () => {
  it('is the share counted in the status, else none (a sweep)', () => {
    expect(progressShare({ status: msg('drawings.files.reading_sheet', { position: 12, total: 38 }) })).toBeCloseTo(12 / 38)
    expect(progressShare({ status: msg('drawings.files.reading_drawing') })).toBeUndefined()
    expect(progressShare({ status: msg('x', { position: 1, total: 0 }) })).toBeUndefined()
  })
})

describe('disciplineName', () => {
  const d = { key: 'plumbing', labels: { en: 'Plumbing and sanitary', bn: 'প্লাম্বিং' } }
  it('reads the language shown, then its base language, then any', () => {
    expect(disciplineName(d, 'bn')).toBe('প্লাম্বিং')
    expect(disciplineName(d, 'en-XB')).toBe('Plumbing and sanitary')
    expect(disciplineName({ key: 'x', labels: { fr: 'X' } }, 'en')).toBe('X')
    expect(disciplineName({ key: 'x', labels: {} }, 'en')).toBe('x')
  })
})
