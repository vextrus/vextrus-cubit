/*
 * Domain glyphs (docs/design/system.md §5), carried from the session-01 specimen: drawn on Lucide's
 * 24-unit grid with a 1.5 stroke so they sit beside Lucide icons. Status marks use drafting line
 * types: dashed = Proposal, solid = Confirmed, revision cloud = Question, hatch = allowance. Colour
 * repeats the meaning; it never carries it alone.
 *
 * A glyph never stands alone (m0-screens §3): give it a word beside it, or a `title` from the
 * catalogue, which makes it an image with that accessible name. Without a title it is hidden from
 * assistive technology. The specimen's `Rod*Glyph` are `Rebar*Glyph` here (CONTEXT.md: Rebar).
 */
import type { ReactNode, SVGProps } from 'react'
import { useLingui } from '@lingui/react/macro'

export type GlyphProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number; title?: string }

function G({ size = 16, title, children, ...rest }: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/** A revision cloud around a rectangle: scallops bulging outward. Shared by the glyph and the sheet. */
export function cloudPath(x: number, y: number, w: number, h: number, step: number): string {
  const pts: [number, number][] = []
  const nx = Math.max(2, Math.round(w / step))
  const ny = Math.max(2, Math.round(h / step))
  for (let i = 0; i < nx; i++) pts.push([x + (w * i) / nx, y])
  for (let i = 0; i < ny; i++) pts.push([x + w, y + (h * i) / ny])
  for (let i = 0; i < nx; i++) pts.push([x + w - (w * i) / nx, y + h])
  for (let i = 0; i < ny; i++) pts.push([x, y + h - (h * i) / ny])
  const r = Math.max(w / nx, h / ny) * 0.62
  const [first] = pts
  let d = `M${first![0].toFixed(2)} ${first![1].toFixed(2)}`
  for (let i = 1; i <= pts.length; i++) {
    const [px, py] = pts[i % pts.length]!
    d += ` A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${px.toFixed(2)} ${py.toFixed(2)}`
  }
  return d + 'Z'
}

/* ── Status marks ───────────────────────────────────────────────────────────────────────── */
export const ProposalGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" strokeDasharray="3 2.4" />
  </G>
)
export const ConfirmedGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="1.5" fill="currentColor" stroke="currentColor" />
    <path d="M8.2 12.3l2.6 2.6 5-5.4" stroke="var(--paper)" strokeWidth={2} />
  </G>
)
const QUESTION_CLOUD = cloudPath(4.2, 5.2, 15.6, 13.6, 4.6)
export const QuestionGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d={QUESTION_CLOUD} strokeWidth={1.4} />
    <path d="M10.3 10.2a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.3" strokeWidth={1.6} />
    <circle cx="12" cy="15.4" r="0.35" fill="currentColor" strokeWidth={1.2} />
  </G>
)
/** Over Target Cost: unused in M0 (M0 shows no money), kept for the set. */
export const OverTargetGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M12 4.5 20.5 19h-17z" fill="currentColor" />
    <path d="M12 10v4" stroke="var(--paper)" strokeWidth={2} />
    <circle cx="12" cy="16.6" r="0.4" stroke="var(--paper)" strokeWidth={1.6} />
  </G>
)
export const ExcludedGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="12" cy="12" r="7.5" />
    <path d="M6.8 17.2 17.2 6.8" />
  </G>
)

/* ── Cost Basis ─────────────────────────────────────────────────────────────────────────── */
export const MeasuredGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" />
  </G>
)
export const AllowanceGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="5" y="5" width="14" height="14" rx="1" />
    <path d="M5 11 11 5M5 17 17 5M9 19 19 9M15 19l4-4" strokeWidth={1.2} />
  </G>
)

/* ── Rebar Basis: a bar's cross-section ─────────────────────────────────────────────────── */
export const RebarRatioGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="12" cy="12" r="6" strokeDasharray="2.2 2" />
  </G>
)
export const RebarDrawingGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="12" cy="12" r="6" fill="currentColor" />
  </G>
)
export const RebarDrawingRulesGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="12" cy="12" r="4.2" fill="currentColor" />
    <circle cx="12" cy="12" r="7.8" />
  </G>
)

/* ── Trace: a leader from a figure to where it was read ─────────────────────────────────── */
export const TraceGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="6" cy="18" r="2" fill="currentColor" />
    <path d="M7.5 16.5 16 8M12 8h4v4" />
    <rect x="15" y="3.5" width="5.5" height="5.5" rx="0.5" strokeDasharray="1.6 1.4" />
  </G>
)

/* ── Takeoff Step glyphs (element families), in the 14 steps' building-first order ─────── */
export const SheetsGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="0.5" />
    <path d="M12 15.5h7M12 15.5v5M8 7h8M8 10h6" />
  </G>
)
export const NotesGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M6 3.5h9l3.5 3.5v13.5H6z" />
    <path d="M9 10h6M9 13h6M9 16h4" />
  </G>
)
export const LevelGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 17h18" />
    <path d="M9 17 6.5 12.5h5z" fill="currentColor" />
    <path d="M13 10h7M13 7h5" strokeWidth={1.2} />
  </G>
)
export const GridGlyph = (p: GlyphProps) => (
  <G {...p}>
    <circle cx="6" cy="5" r="2.5" />
    <circle cx="16" cy="5" r="2.5" />
    <path d="M6 7.5V21M16 7.5V21M3 15h18" strokeDasharray="4 1.6 1 1.6" />
  </G>
)
export const FoundationGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="4" y="8" width="16" height="5" rx="0.5" />
    <path d="M8 13v8M16 13v8" />
    <path d="M12 3v5" strokeWidth={2.4} />
  </G>
)
export const ColumnGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="8" y="3.5" width="8" height="17" rx="0.5" />
    <path d="M5 3.5h14M5 20.5h14" />
  </G>
)
export const BeamGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="3" y="7" width="18" height="6" rx="0.5" />
    <path d="M5 13v6M19 13v6" />
  </G>
)
export const SlabGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 10 9 6h12l-6 4z" />
    <path d="M3 10v3h12l6-4V6M15 10v3" />
  </G>
)
export const StairGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 20h4v-4h4v-4h4V8h4V4h2" />
  </G>
)
export const TankGlyph = (p: GlyphProps) => (
  <G {...p}>
    <rect x="4" y="6" width="16" height="13" rx="0.5" />
    <path d="M4 11c2.7 1.3 5.3 1.3 8 0s5.3-1.3 8 0" />
  </G>
)
export const WallGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 6h18v12H3z" />
    <path d="M3 10h18M3 14h18M9 6v4M15 6v4M6 10v4M12 10v4M18 10v4M9 14v4M15 14v4" strokeWidth={1.1} />
  </G>
)
export const RoomGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M4 13h6v7M14 4v6h6" />
  </G>
)
export const RoofGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 12h18M5 12v8h14v-8" />
    <path d="M8 12V8h8v4" />
  </G>
)
export const SiteGlyph = (p: GlyphProps) => (
  <G {...p}>
    <path d="M3 20h18" />
    <path d="M6 20v-5h5v5M14 20v-9l3-2 3 2v9" />
  </G>
)

/** The 14 Takeoff Steps' glyphs by family key, in building-first order. */
export const STEP_GLYPHS = {
  sheets: SheetsGlyph,
  notes: NotesGlyph,
  level: LevelGlyph,
  grid: GridGlyph,
  foundation: FoundationGlyph,
  column: ColumnGlyph,
  beam: BeamGlyph,
  slab: SlabGlyph,
  stair: StairGlyph,
  tank: TankGlyph,
  wall: WallGlyph,
  room: RoomGlyph,
  roof: RoofGlyph,
  site: SiteGlyph,
} as const

/* ── Brand: the Ascent, a faceted peak; the copper spark only at 32 px and larger ───────── */
export function BrandMark({ size = 22 }: { size?: number }) {
  const { t } = useLingui()
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={t`Vextrus`} focusable="false">
      <path d="M3 27 14 5l5 10-5 12z" fill="var(--indigo-500)" />
      <path d="M14 27l5-12 3 6-2 6z" fill="var(--indigo-700)" />
      <path d="M20 27l2-6 2-4 5 10z" fill="var(--indigo-300)" />
      {size >= 32 ? <circle cx="25.5" cy="8" r="2.4" fill="var(--copper-500)" /> : null}
    </svg>
  )
}
