/*
 * What Steps 3, 4 and 6 decide without the screen (S16-W1): which proposals a key acts on, what the
 * confirmation bar says Enter does, and how a typed level or size is read. Plain TypeScript, tested
 * in node (model.node.test.ts).
 */
import type { FrameGroup, FrameProposal, StepKey, StoreyOut, TraceOut } from './api'

/** A proposal Enter may confirm: still a proposal, and no Question holds it. */
export const agreeing = (p: FrameProposal): boolean => p.state === 'proposal' && p.questions.length === 0

/** A proposal still waiting for the QS: not confirmed, not excluded. */
export const open = (p: FrameProposal): boolean => p.state !== 'confirmed' && p.state !== 'excluded'

export const confirmed = (p: FrameProposal): boolean => p.state === 'confirmed'

export type GroupState = 'confirmed' | 'excluded' | 'question' | 'proposal'

/** A group's mark: a Question wins, then all confirmed, then all excluded, else Proposals ready. */
export function groupState(g: FrameGroup): GroupState {
  const ps = g.proposals
  if (ps.some((p) => open(p) && p.questions.length > 0)) return 'question'
  if (ps.length > 0 && ps.every(confirmed)) return 'confirmed'
  if (ps.length > 0 && ps.every((p) => p.state === 'excluded')) return 'excluded'
  return 'proposal'
}

/** The proposals Enter confirms in a group: the agreeing ones (those a Question holds wait for its answer). */
export const toConfirm = (g: FrameGroup): FrameProposal[] => g.proposals.filter(agreeing)

/** The proposals X leaves out: those still open, held or not. */
export const toExclude = (g: FrameGroup): FrameProposal[] => g.proposals.filter(open)

/** The proposals Ctrl Z's act takes back: confirmed or excluded. */
export const toUndo = (g: FrameGroup): FrameProposal[] => g.proposals.filter((p) => p.state === 'confirmed' || p.state === 'excluded')

/** The first group after `from` (wrapping) that Enter could still confirm; null when none. */
export function nextOpenGroup(groups: readonly FrameGroup[], from: string | null): FrameGroup | null {
  if (groups.length === 0) return null
  const start = Math.max(0, groups.findIndex((g) => g.key === from)) + (from === null ? 0 : 1)
  for (let i = 0; i < groups.length; i++) {
    const g = groups[(start + i) % groups.length]!
    if (toConfirm(g).length > 0 || groupState(g) === 'question') return g
  }
  return null
}

/** Counts for the toolbar's "Confirmed n / N": proposals, not groups. */
export function counts(groups: readonly FrameGroup[]): { n: number; N: number; excluded: number; questions: number } {
  const all = groups.flatMap((g) => g.proposals)
  return {
    n: all.filter(confirmed).length,
    N: all.length,
    excluded: all.filter((p) => p.state === 'excluded').length,
    questions: all.filter((p) => open(p) && p.questions.length > 0).length,
  }
}

/** Storeys low to high, by `order` (the server may send them in any order). */
export const lowToHigh = (storeys: readonly StoreyOut[]): StoreyOut[] => [...storeys].sort((a, b) => a.order - b.order)

const DIGITS: Record<string, string> = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' }

/**
 * A decimal the QS typed ("3.5", "-3", "3,5", Bengali digits) as the plain decimal string the API
 * takes ("3.5"); null when it is not a number. Never a float: the text is kept, only normalised.
 */
export function readDecimal(text: string): string | null {
  const plain = [...text.trim()]
    .map((c) => DIGITS[c] ?? c)
    .join('')
    .replace(/[−–]/g, '-')
    .replace(',', '.')
  const m = /^(-?)(\d*)(?:\.(\d+))?$/.exec(plain)
  if (!m || (m[2] === '' && m[3] === undefined)) return null
  return `${m[1]}${m[2] === '' ? '0' : m[2]}${m[3] !== undefined ? `.${m[3]}` : ''}`
}

/** A size is a positive number. */
export function readSize(text: string): string | null {
  const v = readDecimal(text)
  return v !== null && !v.startsWith('-') && /[1-9]/.test(v) ? v : null
}

/** The first trace of a proposal, or of the group's first proposal that has one. */
export function firstTrace(g: FrameGroup, p?: FrameProposal): TraceOut | null {
  return (p ?? g.proposals.find((x) => x.trace.length > 0))?.trace[0] ?? null
}

/** The group a proposal is in. */
export const groupOf = (groups: readonly FrameGroup[], proposalId: string): FrameGroup | undefined => groups.find((g) => g.proposals.some((p) => p.id === proposalId))

/** The text of a value, for display only ("10" with its unit "in"). */
export const valueText = (values: Record<string, unknown>, fact: string): string | null => {
  const v = values[fact]
  if (v === null || v === undefined) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && 'text' in v && typeof (v as { text: unknown }).text === 'string') return (v as { text: string }).text
  return null
}

export const STEP_LABEL_KEYS: Record<StepKey, number> = { storeys: 3, grid: 4, columns: 6 }
