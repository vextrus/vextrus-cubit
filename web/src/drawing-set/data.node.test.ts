/*
 * The Drawing Set's data rules (m0-screens §4.5): which acts a row offers, the table's order, the
 * progress share and a Discipline's name in the language shown.
 */
import { describe, expect, it } from 'vitest'
import { englishMessages } from '@/i18n/catalogues'
import { disciplineName, pdfSectionOf, pdfSections, progressShare, rowActs, saidOnce, tableOrder, type FileOut } from './data'

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
    marked_for_vextrus: false,
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
    ['held', ['open_question']],
    ['refused', []],
    ['a state the web does not know', []],
  ])('offers a QS on a %s file %j', (state, acts) => {
    expect(rowActs({ state, format: 'dwg' }, true)).toEqual(acts)
  })

  it('offers the MD and a Guest only "Open in Step 1" and "Open the Question", never a change', () => {
    for (const state of ['waiting', 'reading', 'retrying', 'cancelled', 'failed']) expect(rowActs({ state, format: 'dwg' }, false)).toEqual([])
    expect(rowActs({ state: 'read', format: 'dwg' }, false)).toEqual(['open_step1'])
    expect(rowActs({ state: 'held', format: 'dwg' }, false)).toEqual(['open_question'])
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
    expect(disciplineName({ key: 'x', labels: {} }, 'en')).toBe('—')
  })
})

describe('pdfSections', () => {
  it("puts each of the PDF report's sentences in §4.5's section, the engine's page lines before the matching", () => {
    const sections = pdfSections({
      made_by: [
        msg('engine.pdf_report.made_by_autocad'),
        msg('engine.pdf_report.pages', { pages: 12, turned: 2 }),
        msg('engine.pdf_report.lettering_kept'),
        msg('engine.pdf_report.layers_kept'),
        msg('engine.pdf_report.no_pictures'),
        msg('engine.pdf_report.scan'),
        msg('engine.pdf_report.locked'),
      ],
      pages: [msg('drawings.reports.pages_matched', { matched: 11, pages: 12 }), msg('engine.pdf_report.page_unreadable', { page: 3 })],
    })
    expect(Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, v.map((m) => m.code)]))).toEqual({
      made_by: ['engine.pdf_report.made_by_autocad'],
      pages: ['engine.pdf_report.pages', 'engine.pdf_report.page_unreadable', 'drawings.reports.pages_matched'],
      lettering: ['engine.pdf_report.lettering_kept'],
      layers: ['engine.pdf_report.layers_kept'],
      pictures: ['engine.pdf_report.no_pictures'],
      refused: ['engine.pdf_report.scan'],
      not_read: ['engine.pdf_report.locked'],
    })
  })

  it('keeps a sentence of any other code where the API put it', () => {
    expect(pdfSections({ made_by: [msg('drawings.reports.plot_refused')], pages: [] }).made_by.map((m) => m.code)).toEqual(['drawings.reports.plot_refused'])
  })
})

describe('saidOnce', () => {
  it('leaves out of each list what the header or an earlier list already said, whatever the order of its parameters', () => {
    const status = msg('drawings.files.old_version')
    const finding = msg('engine.decoders_agree.disagree', { items: 212, layers: 3 })
    const lists = saidOnce([status], [[status, finding], [msg('engine.decoders_agree.disagree', { layers: 3, items: 212 })], [msg('x', { a: 1 })]])
    expect(lists).toEqual([[finding], [], [msg('x', { a: 1 })]])
  })
})

describe('every PDF report code has its section on purpose', () => {
  it("places each code the engine's catalogue words, as §4.5 orders them", () => {
    const codes = Object.keys(englishMessages()).filter((c) => c.startsWith('engine.pdf_report.'))
    const placed: Record<string, string> = {
      made_by_autocad: 'made_by', made_by_other: 'made_by', made_by_unknown: 'made_by',
      pages: 'pages', page_unreadable: 'pages',
      lettering_kept: 'lettering', lettering_lines: 'lettering', lettering_partly: 'lettering', lettering_unconfirmed: 'lettering',
      unmapped_text: 'lettering', fonts_drawn: 'lettering', fonts_not_embedded: 'lettering', fonts_unreadable: 'lettering',
      layers_kept: 'layers', layers_flattened: 'layers',
      pictures: 'pictures', no_pictures: 'pictures', mostly_picture: 'pictures', scan_page: 'pictures',
      scan: 'refused', too_many_pages: 'refused',
      locked: 'not_read', unreadable: 'not_read', limit_reached: 'not_read', reader_failed: 'not_read',
    }
    expect(codes.length).toBeGreaterThan(0)
    // A new code fails here until it is given its section in pdfSectionOf and in this table.
    expect(Object.fromEntries(codes.map((c) => [c, pdfSectionOf(c)]))).toEqual(Object.fromEntries(codes.map((c) => [c, placed[c.slice('engine.pdf_report.'.length)]])))
  })
})
