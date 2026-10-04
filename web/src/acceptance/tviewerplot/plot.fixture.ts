/*
 * Ticket viewerplot's acceptance fake: a sheet's Plot as 14 serves it, laid over 22's Step 1 fake
 * (`../t22/step1.fixture.ts`). The shapes are main's (1f575b1e):
 *
 * - `GET /api/projects/{project}/drawings/sheets/{sheet}/plot` answers `PlotOut`
 *   (`vextrus/drawings/schemas/files.py`): `{file_id, page, transform, residual, none}`, the transform
 *   sheet millimetres to page points (`engine/plot/ink.py`: T(p) = k R p + o) as
 *   `{scale, rotation, offset: [x, y]}` with decimal strings, `none` a message `{code, params}`.
 * - `GET /api/projects/{project}/drawings/files/{file}/pdf` answers the PDF's bytes
 *   (`vextrus/drawings/http/files.py`).
 * - Step 1's Proposal carries `plot_file`, `plot_page`, `plot_residual` and `plot_none`
 *   (`vextrus/takeoff/schemas/step1.py`); the fake keeps them the same as the sheet's `/plot`.
 *
 * The PDF is invented here, in memory: one A5 landscape page (210 × 148 mm, the size of 16's
 * `tiny-sheet.bin`) whose left half is solid black and whose right half is blank, so a test can see
 * the page beneath the sheet without knowing where the sheet's own lines fall.
 */
import type { FakeApi } from '@/app/seed/api.fixture'
import type { FakeStep1, Msg } from '../t22/step1.fixture'

export const PLOT_PDF = { id: 'd1000000-0000-4000-8000-0000000000f1', name: 'KR-STR-R0.pdf' }

/** A5 landscape in PDF points. */
const PAGE_W = 595.28
const PAGE_H = 419.53

/** One page, its left half filled black: a valid PDF 1.4 with a correct cross-reference table. */
export function halfBlackPdf(): Uint8Array<ArrayBuffer> {
  const content = `0 g\n0 0 ${(PAGE_W / 2).toFixed(2)} ${PAGE_H.toFixed(2)} re\nf\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << >> >>`,
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const at of offsets) out += `${String(at).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}

export interface PlotOut {
  file_id: string | null
  page: number | null
  transform: { scale: string; rotation: number; offset: [string, string] } | null
  residual: string | null
  none: Msg | null
}

/** The sheet fitted onto the page: 72 / 25.4 points per millimetre, unturned, at the page's corner. */
const ON_THE_PAGE = { scale: '2.834646', rotation: 0, offset: ['0', '0'] as [string, string] }

export class FakePlot {
  /** Every `/plot` and `/pdf` request, "GET /rest" after the project's prefix. */
  seen: string[] = []
  private plots = new Map<string, PlotOut>()
  private step1: FakeStep1

  constructor(api: FakeApi, step1: FakeStep1) {
    this.step1 = step1
    // Every structural sheet has its page of KR-STR-R0.pdf, registered to 0.3 mm (page n for S-0n).
    for (const p of step1.proposals) {
      if (p.discipline !== 'structural' || !p.number) continue
      this.matched(p.number, Number(p.number.slice(2)))
    }
    const base = api.handle
    const prefix = `/api/projects/${step1.projectId}`
    api.handle = async (request: Request) => {
      const path = new URL(request.url, location.origin).pathname
      if (request.method === 'GET' && path.startsWith(`${prefix}/drawings/sheets/`) && path.endsWith('/plot')) {
        this.seen.push(`GET ${path.slice(prefix.length)}`)
        const id = path.slice(`${prefix}/drawings/sheets/`.length, -'/plot'.length)
        const plot = this.plots.get(id) ?? { file_id: null, page: null, transform: null, residual: null, none: { code: 'drawings.sheets.plot_no_pdf_any', params: {} } }
        return new Response(JSON.stringify(plot), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (request.method === 'GET' && path === `${prefix}/drawings/files/${PLOT_PDF.id}/pdf`) {
        this.seen.push(`GET ${path.slice(prefix.length)}`)
        return new Response(halfBlackPdf(), { status: 200, headers: { 'Content-Type': 'application/pdf' } })
      }
      return base(request)
    }
  }

  private proposal(number: string) {
    const p = this.step1.proposals.find((x) => x.number === number)
    if (!p) throw new Error(`no sheet ${number}`)
    return p as typeof p & Record<string, unknown>
  }

  /** The sheet's id, as Step 1 lists it. */
  sheetId(number: string): string {
    return this.proposal(number).sheet_id
  }

  /** `number` has page `page` of KR-STR-R0.pdf, registered to 0.3 mm. */
  matched(number: string, page: number): void {
    const p = this.proposal(number)
    Object.assign(p, { plot_file: PLOT_PDF.name, plot_page: page, plot_residual: '0.3', plot_none: null })
    this.plots.set(p.sheet_id, { file_id: PLOT_PDF.id, page, transform: ON_THE_PAGE, residual: '0.3', none: null })
  }

  /** `number` has no Plot, for the reason `none` (a `drawings.sheets.plot_*` message). */
  noPlot(number: string, none: Msg): void {
    const p = this.proposal(number)
    const file = typeof none.params.plot_file === 'string' ? none.params.plot_file : null
    Object.assign(p, { plot_file: file, plot_page: null, plot_residual: null, plot_none: none })
    this.plots.set(p.sheet_id, { file_id: file ? PLOT_PDF.id : null, page: null, transform: null, residual: null, none })
  }
}
