# Design Decision — S-Design (`/design`), indirect only: the sheet changes under it

No routed screen changes this increment. Not one file under `src/app/design/**` or
`src/ui/gallery/**` is touched; `docs/design/s-design.md` remains the standing contract for
layout, the seven `?state=` surfaces, the §5–§6 roster, §7 copy and the theme toggle, every
section still binding except where AM-04/AM-05/AM-06 supersede a v1 token name (recorded
below). What this decision fixes is what the Datum v2 token re-issue does to the screen from
underneath — which repaints are lawful, which degradations are sanctioned and until when, and
what is deliberately not graded — so the tree carries no undocumented interim. The restyle
that consumes the new tokens is inc-017; the visual re-baseline is inc-018. Values named here
are `docs/specs/datum-v2-total-station.md` §2, founder-final, quoted never re-derived.

Interpretations recorded:

1. "Indirect only" means the screen changes solely because `src/ui/tokens.css`,
   `src/ui/globals.css` and `src/ui/fonts/fonts.css` change beneath it. Any edit to the
   gallery's own modules to "keep it pretty" during the transition is a defect against this
   decision, not a favour.
2. s-design.md §9 names `--cobalt-500` and "focus ring", and §11's journey sibling asserts a
   2 px cobalt outline. AM-04 and AM-06 supersede those bindings in law; their re-authored
   form arrives with inc-017's decisions. Between this commit and inc-017, the focus
   affordance on `/design` renders in the degraded-but-visible form of §3 below — designed
   here, so the gap has an owner and an end.
3. The six visual baselines at `tests/e2e/baselines/design/*.png` are knowingly stale from
   this commit: a J-004 pixel run against this tree is expected red and is evidence of the
   retint landing, not of a defect. J-004 is not this increment's gate line; inc-018 re-issues
   the baselines with a recorded reason (Q-06). Nobody "fixes" a stale baseline early.

## 1. Layout and hierarchy

s-design §1 verbatim — top bar 48 px, 200 px rail, 1040 px main column, entry cards, compact
rhythm (R-UI-005). Nothing moves, because every dimension is a layout decision and every
colour is a role: the retint is slot-for-slot with roles unchanged (AM-04), so the hierarchy
— `--graphite-0` cards seamed by `--graphite-200` hairlines on a `--graphite-50` ground —
survives the value change intact. What the reader sees change:

- **Ground and surfaces cool.** Light `--graphite-0` becomes `#F4F5F4` (instrument
  grey-white, deliberately not `#FFFFFF`); dark becomes `#0C0E11`. Every graphite text slot
  retints with its surface, and §2's contrast facts hold by construction (light 600 on
  light 0 ≈ 5.5:1, dark 600 on dark 0 ≈ 5:1, 500 keeps the ≥ 3:1 disabled floor), so every
  string on this screen stays AA through the repaint — including the placeholder/status texts
  the earlier `--graphite-600` amendment moved, which keep their role and take the new value.
- **Every letter changes family.** `--font-ui` now resolves to Spline Sans, `--font-mono` to
  Spline Sans Mono, loaded from the vendored `src/ui/fonts/` via local `@font-face`
  (`font-display: swap`) — first paint may show the 'Helvetica Neue'/Arial fallback for an
  instant; no gallery layout depends on font metrics, so nothing shifts structurally.
  `.numeric` keeps `font-family: var(--font-mono)` with
  `font-variant-numeric: tabular-nums slashed-zero`, so the entry-card export names, counts,
  sample quantities and report codes stay tabular and slashed-zero in the new mono.
- **No canvas effect here.** The four changed canvas keys (dark paper `#101216`, dark grid
  `#1B1F26`, selection, hover) have no consumer on `/design` — no viewer entry exists yet —
  so they are invisible on this screen until a viewer increment.

## 2. Screen states (R-UI-050)

All seven remain exactly s-design §2 — surfaces, copy verbatim, testids
`design-screen-state-<state>` — reachable via `?state=` as before. They repaint under the
same two indirect changes as the live sheet (graphite values, font families) and no other.
The Skeletons of the loading state keep layout and their reduced-motion stilling; the new
`--motion-reticle-duration` participates in the reduced-motion zeroing block by its
`-duration` suffix but has no consumer anywhere yet, on this screen or any other.

## 3. The sanctioned degradation — dangling `--cobalt-*` until inc-017

Deleting the cobalt group leaves every `var(--cobalt-*)` reference in
`src/ui/primitives/primitives.css`, `src/ui/patterns/patterns.css`, `src/ui/shell/shell.css`
and `src/ui/data/data.css` dangling: those files are outside this increment's ownership and
their sweep is inc-017's. On `/design` — the one screen that renders all of them at once —
the interim rendering is therefore, per CSS invalid-at-computed-value-time fallback:

- **Focus** — `outline: 2px solid var(--cobalt-500)`: the colour falls back to
  `currentColor`, so the ring renders 2 px solid in the focused element's own graphite text
  colour. Degraded from accent to graphite, but present — AM-06's "a visible focus indicator
  is never optional" holds throughout the gap. The reticle replaces it in inc-017.
- **Accent fills** — primary Button, checked Checkbox/Radio/Switch, Slider range, Progress
  bar, the active Tabs underline (`background`/`border-bottom-color` on `var(--cobalt-500)`):
  the colour falls back to transparent, so these read as outline/ghost renderings of
  themselves. Labels, hairlines and glyphs keep them legible and operable; only the accent is
  absent.
- **Accent text and tints** — EvidenceLink and link-styled text on `var(--cobalt-500)` fall
  back to inherited graphite; selected-row and hover tints on `var(--cobalt-100)` fall back
  to transparent, leaving the selection checkbox as the selected state's carrier.

This state is designed, bounded and ungated: no journey, screenshot or axe scan grades
`/design` in this increment (the gate is J-000, which never routes here), and the standing
CSS-text acceptance in those modules keeps passing because it reads text, not resolution.
Writing `var(--cobalt-500, …)` fallbacks or partial sweeps into the out-of-ownership CSS to
soften the interim is forbidden — it would smear one increment's contract across two. The two
standing axe defects on `/design` (Select placeholder contrast, empty selection columnheader)
likewise stay as recorded until inc-017's restyle.

## 4. Copy

None changes. Every string on `/design` remains s-design §7's tables, verbatim. The one
document re-authored this increment is `docs/design/datum-tokens.md` — the v2 token contract
per AC-4, whose tables must byte-agree with `tokens.ts`; this screen decision cites it and
restates none of it.

## 5. Motion (R-UI-004)

No motion changes on this screen. The theme flip stays untransitioned (s-design §3); the
primitives keep their contractual durations, all still zeroed under
`prefers-reduced-motion` by the regenerated sheet's media block — which now also zeroes
`--motion-reticle-duration` to 0ms, ahead of any consumer.

## 6. Tokens

Introduced under the screen (consumed here only through roles it already uses, or not yet at
all): `--beam-100/300/500/600/700` (light 500 `#5A4FB0`, dark 600 `#8B84E8` — no `/design`
consumer until inc-017), `--act-surface/--act-500/--act-600` (copper; consumer arrives with
the act button entry, inc-017), `--motion-reticle-duration: 120ms`, and the retinted
13-slot graphite ramp this screen repaints through. Removed: every `--cobalt-*` and every
`--color-cobalt-*` bridge mapping; the bridge gains `--color-beam-*` and `--color-act-*` as
`var()` references only. No colour literal enters any file this screen reads (R-UI-001).

## 7. Both themes

The retint lands in both themes at once through the three-block emission (`:root,
[data-theme="light"]`, `[data-theme="dark"]`, reduced-motion). Light stays the default;
`design-theme-toggle` stays the attribute's only writer. Dark is graded off the emitted sheet
via fs in the token acceptance — a jsdom `data-theme` flip proves nothing — and the paint of
both themes is inc-018's screenshot evidence, not this increment's.

## 8. Test hooks (C-05)

None introduced. No route, no testid, no page-object change enters the contract through this
decision: `/design` and its existing ids stay exactly s-design §11. This increment's gate
touching any screen is `pnpm e2e --journey J-000`, which must stay green over the retinted
sheet and the `@font-face` wiring and asserts nothing about `/design`. The acceptance file
`src/ui/__tests__/datum-v2-tokens.acceptance.test.ts` grades the emitter, the emitted CSS,
the fonts wiring and `docs/design/datum-tokens.md` in plain node — no rendering, so nothing
in it names this screen.
