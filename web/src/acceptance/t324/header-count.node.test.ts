/*
 * Ticket T-W324's acceptance tests for the header's count (gh issue #324, G1 #1 findings f-16 and f-38):
 * Step 1's found count N is the sum of the Discipline rows (and the no-Discipline remainder), and a sheet
 * the server leaves out of N is in neither N nor "k excluded".
 *
 * The rule mirrored is the server's `_counted_sheet` (vextrus/takeoff/services/step1.py): a sheet is
 * counted unless the read proposed it out (`proposed_exclusion`) and it has no number (null or ''), and
 * the QS has not confirmed it in. m0-screens 4.7's Count and 6.18 row 4; M0.md: a blank is "never
 * counted as a phantom sheet". Each fixture's progress rows are server-shaped: `found` counts only the
 * sheets `_counted_sheet` keeps.
 *
 * Every literal is invented. The `sheet`/`data` helpers are copied from src/takeoff/model.node.test.ts.
 */
import { describe, expect, it } from 'vitest'
import type { DisciplineProgress, ProposalOut, Step1Data } from '@/takeoff/data'
import { step1Model } from '@/takeoff/model'

let n = 0
function sheet(number: string | null, over: Partial<ProposalOut> = {}): ProposalOut {
  n += 1
  return {
    id: `t324p${n}`,
    sheet_id: `t324s${n}`,
    number,
    title: `SYNTH PLATE ${n}`,
    revision_mark: 'R2',
    revision_mark_source: 'file_name',
    issue_date: '',
    discipline: 'structural',
    file_id: 'f9',
    file_name: 'QX-STR-R2.dwg',
    kind: null,
    jev_pick: null,
    held: false,
    proposed_exclusion: null,
    decision: null,
    confirmed_kind: null,
    excluded_reason: null,
    excluded_text: '',
    decided_by: null,
    decided_at: null,
    decided_act: null,
    agrees: true,
    decided_by_role: null,
    decided_with: 0,
    number_source: 'title_block_attribute',
    title_source: 'title_block_attribute',
    storeys_as_stated: '',
    layout: null,
    plot_file: null,
    plot_page: null,
    plot_residual: null,
    plot_none: null,
    views: [],
    ...over,
  }
}

function data(proposals: ProposalOut[], disciplines: DisciplineProgress[] = []): Step1Data {
  return {
    proposals,
    questions: [],
    // 21c adds `unaccounted_views` and `unread_sheets`; cast so this compiles before and after its merge.
    coverage: { views: 0, assigned: 0, excluded: 0, proposed: 0, unaccounted: 0, used: 0, by_step: {}, by_reason: {}, unaccounted_views: [], unread_sheets: 0 } as Step1Data['coverage'],
    progress: { disciplines, not_received: [], qs: [] } as Step1Data['progress'],
    lists: {},
  }
}

/** A progress row as the server sends it: `found` and `confirmed` count only the sheets `_counted_sheet` keeps. */
function row(discipline: string | null, found: number, confirmed = 0): DisciplineProgress {
  return { discipline, confirmed, found, listed: null, lists_disagree: false, total: found, open_questions: 0, status: '', outstanding: [], plots: [] } as DisciplineProgress
}

const QS = { decided_by: 'Rumana Q', decided_at: '2026-10-01T04:00:00Z' }
const confirmed = { decision: 'confirmed' as const, ...QS }
const excluded = (reason: string) => ({ decision: 'excluded' as const, excluded_reason: reason, ...QS })

/** Case 1's set: Structural 6 numbered, Architectural 4 numbered and an unnumbered cover, an unnumbered blank of no Discipline. */
function proposedOutSet(): ProposalOut[] {
  return [
    ...['ST-201', 'ST-202', 'ST-203', 'ST-204', 'ST-205', 'ST-206'].map((number) => sheet(number)),
    ...['AR-501', 'AR-502', 'AR-503', 'AR-504'].map((number) => sheet(number, { discipline: 'architectural' })),
    sheet(null, { discipline: 'architectural', proposed_exclusion: 'cover_index' }),
    sheet(null, { discipline: null, proposed_exclusion: 'blank' }),
  ]
}

describe('the header counts what the Discipline rows count (#324, f-16 f-38; m0-screens 4.7)', () => {
  it('leaves an undecided sheet proposed out with no number out of N: 12 proposals, 2 such, N is 10', () => {
    const model = step1Model(data(proposedOutSet(), [row('structural', 6), row('architectural', 4)]))
    expect(model.found, 'N: the counted sheets only').toBe(10)
    expect(model.confirmed).toBe(0)
    expect(model.excluded).toBe(0)
  })

  it('keeps N equal to the Discipline rows plus the no-Discipline remainder, sheet by sheet as _counted_sheet decides', () => {
    // Each sheet with the server's verdict: counted unless proposed out with no number and not confirmed in.
    const verdicts: [ProposalOut, boolean][] = [
      [sheet('ST-310'), true],
      [sheet('ST-311', { proposed_exclusion: 'superseded' }), true], // proposed out, but it has a number
      [sheet(null, { proposed_exclusion: 'blank', ...confirmed }), true], // the QS confirmed it in
      [sheet('AR-610', { discipline: 'architectural', ...confirmed }), true],
      [sheet(null, { discipline: 'architectural', proposed_exclusion: 'cover_index', ...excluded('cover_index') }), false],
      [sheet('', { discipline: 'architectural', proposed_exclusion: 'blank' }), false], // '' is no number
      [sheet('MP-710', { discipline: null }), true],
      [sheet(null, { discipline: null, proposed_exclusion: 'cover_index' }), false],
    ]
    const proposals = verdicts.map(([p]) => p)
    const counted = verdicts.filter(([, c]) => c).map(([p]) => p)
    const rows = [row('structural', 3, 1), row('architectural', 1, 1), row(null, 1)]
    const model = step1Model(data(proposals, rows))
    expect(model.noDiscipline, 'the counted sheets of no Discipline').toBe(counted.filter((p) => p.discipline === null).length)
    expect(model.found, 'N: every counted sheet').toBe(counted.length)
    expect(model.found, 'N = the Discipline rows + the no-Discipline remainder').toBe(model.disciplines.reduce((sum, d) => sum + d.found, 0) + model.noDiscipline)
  })

  it('counts "k excluded" inside N only: an excluded unnumbered proposed-out sheet is in neither', () => {
    const numberedOut = sheet('ST-420', excluded('duplicate'))
    const coverOut = sheet(null, { proposed_exclusion: 'cover_index', ...excluded('cover_index') })
    const kept = sheet('ST-421', confirmed)
    const model = step1Model(data([numberedOut, coverOut, kept], [row('structural', 2, 2)]))
    expect(model.found, 'N holds the numbered excluded sheet and the confirmed one').toBe(2)
    expect(model.excluded, 'only the numbered sheet is excluded inside N').toBe(1)
    expect(model.confirmed).toBe(1)
    expect(model.confirmed + model.excluded, 'confirmed + excluded never passes N').toBeLessThanOrEqual(model.found)
  })

  it('counts only counted sheets in a Discipline’s found, settled and total when it has no progress row, so found − settled is never negative', () => {
    const set = () => [
      sheet('ST-530', confirmed),
      sheet('ST-531'),
      sheet(null, { proposed_exclusion: 'blank', ...excluded('blank') }),
      sheet(null, { proposed_exclusion: 'cover_index', ...excluded('cover_index') }),
      sheet('AR-830', { discipline: 'architectural' }),
      sheet(null, { discipline: 'architectural', proposed_exclusion: 'cover_index', ...excluded('cover_index') }),
    ]
    const bare = step1Model(data(set(), []))
    const of = (model: ReturnType<typeof step1Model>, d: string) => model.disciplines.find((s) => s.discipline === d)!
    expect([of(bare, 'structural').found, of(bare, 'structural').settled, of(bare, 'structural').total], 'Structural found, settled, total').toEqual([2, 1, 2])
    expect([of(bare, 'architectural').found, of(bare, 'architectural').settled, of(bare, 'architectural').total], 'Architectural found, settled, total').toEqual([1, 0, 1])
    // With the server's rows, `found` is the row's; what is settled is still counted from the counted sheets.
    const served = step1Model(data(set(), [row('structural', 2, 1), row('architectural', 1, 0)]))
    for (const model of [bare, served]) {
      for (const d of model.disciplines) expect(d.found - d.settled, `${d.discipline}: found − settled`).toBeGreaterThanOrEqual(0)
    }
    expect(of(served, 'architectural').settled, 'the excluded cover is not settled inside N').toBe(0)
  })

  it('still keeps a Discipline open on an undecided unnumbered proposed-out sheet, and counts one the QS confirmed in', () => {
    const open = step1Model(data([sheet('ST-640', confirmed), sheet('ST-641', confirmed), sheet(null, { proposed_exclusion: 'blank' })], [row('structural', 2, 2)]))
    expect(open.disciplines[0]!.confirmed, 'an undecided proposed-out sheet keeps the Discipline open').toBe(false)
    const without = step1Model(data([sheet('ST-642', confirmed), sheet('ST-643', confirmed)], [row('structural', 2, 2)]))
    expect(without.disciplines[0]!.confirmed, 'the same Discipline without it reads confirmed').toBe(true)
    const confirmedIn = sheet(null, { proposed_exclusion: 'cover_index', ...confirmed })
    const model = step1Model(data([sheet('ST-650'), confirmedIn], [row('structural', 2, 1)]))
    expect(model.found, 'a confirmed-in sheet is in N').toBe(2)
    expect(model.confirmed, 'and in confirmed').toBe(1)
  })
})
