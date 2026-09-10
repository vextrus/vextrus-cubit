# Design Decision — EvidenceLink (the Trace affordance) and its gallery entry

Not a routed screen: one pattern in `src/ui/patterns/evidence-link` — `evidence-link.tsx`, barrel
`index.ts` exporting `EvidenceLink` and the type `EvidenceLinkProps`, stylesheet
`evidence-link.css` beside them — plus the `patterns/evidence-link` barrel section the `/design`
gallery derives from it. Increment inc-215-trace. Law: R-UI-002, R-UI-003, R-UI-004, R-UI-010,
R-UI-011, R-UI-012, R-UI-022, R-UI-050, R-UI-060, R-TO-011, X-2, B-17, B-19, B-20, C-05, Q-11,
J-004. Consumers this increment (R-UI-011 — a pattern ships with its consumer): the register's
`source` cell (docs/design/s-takeoff-register.md) and the viewer inspector's Trace and Cited-by
blocks (docs/design/s-viewer-inspector.md). Every convention of primitives-core and refusal-state
binds: `cx-` classes, variants on data-attributes, tokens-only colour and motion, `cx-reticle`
solely from `src/ui/primitives/core/reticle.css`, the glyph table solely from
`src/ui/primitives/core/basis.ts`, no `[data-theme]` selector in authored CSS, identifiers whole
(I-26). The pattern owns no product copy beyond the one title string §3 fixes.

## 0. Interpretations (numbering continues the global chain's highest, s-takeoff's I-175)

- **I-176 — the basis colours the glyph and the rule; the key itself reads in graphite.** The link's
  label is a source key, which is text, and R-UI-012 puts text at ≥ 4.5:1. Measured on the R-UI-001
  founder values against `--graphite-0`, six basis tokens clear it in light (measured 4.74,
  transcribed 4.76, derived 6.07, imported 5.66, entered 4.63, interpreted 5.83) and all seven clear
  it in dark; `--basis-defaulted` (#6B7280) measures **4.42:1** in light and cannot be made to clear
  it, because R-UI-001's values are founder-final law. Ruling: the anchor's `color` is
  `var(--basis-<basis>)` and nothing else — that token is the only colour this pattern's basis
  channel ever takes — and it is spent where the ≥ 3:1 UI floor governs: the glyph and the underline,
  which every basis clears in both themes. The label rides `var(--graphite-900)`, ≥ 4.5:1 in both
  themes for all seven. This is BasisChip's own ruling applied unchanged (primitives-core §3: colour
  on glyph and border, the word in graphite), so the two surfaces of R-UI-002 agree rather than each
  inventing a contrast policy. Rejected: basis-coloured label text, which ships one gallery cell that
  axe grades serious in light and no lawful actor may clear (B-20); rejected: carving DEFAULTED out
  alone, which teaches that one basis is drawn by different rules than the other six.
- **I-177 — the underline stands at rest, and thickens on hover and focus.** A graphite key with no
  rule under it is indistinguishable from the plain mono keys beside it in the same table (R-UI-060's
  ban on colour-only meaning applies to affordance as surely as to state). Ruling: 1 px underline in
  the basis colour always, 2 px on `:hover` and `:focus-visible` — the interfaces' "underline on
  hover/focus" read as an intensification, not as an appearance from nothing.
- **I-178 — the link is a place, never a door.** `EvidenceLink` is a bare `<a href>`: it holds no
  state, opens nothing itself, calls no router and knows nothing of the viewer. Activating it is a
  browser navigation, which is what makes Back a real history step (R-UI-022's "back returns to the
  origin"). Everything a consumer needs beyond that — the origin stamp, `data-line`, `data-origin`,
  an `onClick` — arrives through the spread rest props and stays the consumer's business. Rejected:
  a `Trace` component that takes a lineId and composes its own address, which would put the route's
  spelling in `src/ui`, where no address may live.

## 1. Anatomy, geometry, hierarchy

```
<a data-testid="evidence-link" class="cx-evidence-link cx-reticle" data-basis={basis}
   href={href} title={evidence_link_title} {...rest}>
  <span data-testid="evidence-link-glyph" class="cx-evidence-link-glyph" aria-hidden="true">◆</span>
  <span class="cx-evidence-link-label">DXF_HANDLE:1A4</span>
</a>
```

Props are exactly `{ href, basis, label } & ComponentPropsWithRef<'a'>`; `rest` spreads onto the
anchor after the three fixed attributes, so a caller adds `data-line`, `data-origin`, `aria-current`
or an `onClick` and may never re-id or re-class the element. The label rides its own span so I-176's
graphite can be stated without touching the anchor's basis colour; `anchor.textContent` is still the
glyph followed by the label, and the accessible name is still the key.

- Box: `display: inline-flex`, `align-items: baseline`, `gap: var(--space-1)`, no padding, no fill,
  no border, no radius — it is a word in a cell, not a chip beside one. It wraps rather than
  truncates: `overflow-wrap: anywhere` (I-26 — evidence is never ellipsised behind something a
  reader cannot open).
- Type: `var(--font-mono)` `var(--text-12)` with `font-variant-numeric: tabular-nums slashed-zero`
  (R-UI-003 — a source key is a key, not prose). Weight is inherited; the pattern sets none.
- Colour: `.cx-evidence-link[data-basis="MEASURED"] { color: var(--basis-measured) }` and its six
  siblings, one rule per basis in R-UI-002's order — the whole colour surface of this file. The glyph
  and the underline inherit it (`text-decoration-color` comes from the decorating anchor, so the rule
  stays basis-coloured under the graphite label). `.cx-evidence-link-label { color:
  var(--graphite-900) }`. No hex, no `[data-theme]`, no second palette.
- Rule (I-177): `text-decoration-line: underline`, `text-decoration-thickness: 1px`,
  `text-underline-offset: 3px`; `:hover`/`:focus-visible` take 2 px.
- Glyph: `display: inline-block`, so the propagated underline does not strike through it, and its
  text comes only from `BASIS_GLYPHS[basis]` (◆ ▣ ƒ ⇩ ✎ ▦ ○) — `aria-hidden`, because it is the
  colour's greyscale twin and not a second announcement.
- Focus: `cx-reticle` and nothing else; the four corner ticks are drawn by the reticle's one home.
  The pattern authors no focus rule (B-17).

Density (R-UI-005): the pattern sets no height and no block padding, so it takes the line box of the
36 px or 28 px row it sits in; nothing here re-keys on `[data-density]`.

## 2. States (R-UI-050)

A pattern, not a screen: the seven screen states belong to the composing screens' Decisions
(refusal-state §4's ruling stands). What this file owes is every state the component itself can be
in, and the component is deliberately total — both `href` and `label` are required by type, so
**loading, empty, partial, offline, error, refusal and permission-denied are impossible by
construction**: there is no EvidenceLink without a place to go and a word to show. A consumer that
cannot name a destination — a defaulted quantity, a line whose sheet is not resolvable, a repudiated
line — renders the key as plain text and no anchor; withholding the link is the consumer's ruling
(s-takeoff-register I-181), never a disabled variant here. A disabled link would be a place that is
not a place.

Its enumerable variants, which the gallery renders and the suite reflects over: seven bases × the
rest state, plus hover, focus-visible and active on any one of them. There is no visited styling —
whether a reader has traced this key before is not a fact about the drawing.

## 3. Copy, verbatim

`src/ui/strings/evidence-link.ts` exports `evidenceLink`, aliased `"evidence-link"` in the registry:

`evidence_link_title` **Trace to the sheet**

It is the anchor's `title` — the purpose, shown on hover, for a reader who meets a mono key in a
table and needs to know what following it does. It is not the accessible name: the name stays the
key itself, so a screen reader announces "DXF_HANDLE:1A4 link" inside a cell its column header
already calls Source. The basis is not spoken by this element (the glyph is `aria-hidden`); it is
carried by `data-basis` for machines and by the BasisChip that stands in the same row or the same
block for people, so nothing here is colour-only meaning (R-UI-060).

Gallery sample data, authored in `src/ui/gallery-derivation` beside every other sample string
(s-design I-17, s-design-gallery I-123): label **DXF_HANDLE:1A4** in every state — one key across
the seven cells, so the row compares colour and glyph and nothing else — and href **/design**, the
gallery's own idiom for a sample destination that stays on the current route.

Voice: calm, concrete, professional; no exclamation marks; no build vocabulary. "Trace" is the
product's own word for the moment (X-2, R-UI-022), not an internal one.

## 4. Motion (R-UI-004)

Two properties transition, both on the same pair: `color` and `text-decoration-thickness` over
`var(--motion-state)` `var(--ease)` — the state change the clause's 120–200 ms band is for. The
reticle draws in `var(--motion-reticle)` in its single home. Nothing enters, nothing bounces,
nothing pulses: the pulse of the Trace belongs to the canvas at the other end of the link. Both
durations are tokens zeroed at source under reduced motion, so `evidence-link.css` carries no
`prefers-reduced-motion` branch (B-17).

## 5. Tokens

`--basis-measured` · `--basis-transcribed` · `--basis-derived` · `--basis-imported` ·
`--basis-entered` · `--basis-interpreted` · `--basis-defaulted` · `--graphite-900` · `--space-1` ·
`--font-mono` · `--text-12` · `--motion-state` / `--ease` (and `--motion-reticle` inherited from the
reticle's home). Px literals, closed set (primitives-core I-1's mandated class): the 1 px and 2 px
underline thicknesses and the 3 px underline offset. Any other literal is a defect. No beam except
through the reticle, no copper, no graphite surface fill: the link paints on whatever ground its
consumer stands it on.

## 6. Themes

No `[data-theme]` selector is authored; every light/dark difference arrives through token values
(R-UI-001). Contrast facts kept true on the founder values, in both themes and on both grounds this
pattern is stood on (`--graphite-0`, the register's field, and `--graphite-50`, the inspector's
panel): the graphite-900 label clears 4.5:1 everywhere; each basis glyph and rule clears the 3:1 UI
floor everywhere, the tightest being `--basis-defaulted` at 4.42:1 light on graphite-0 and 4.28:1
light on beam-100 (the register's origin mark) — both above the floor that governs them (I-176).
Dark reverses the pairs by value alone: every basis token there sits at 7:1 or better on
`--graphite-0`. In greyscale the seven cells still differ by glyph, which is the point of R-UI-002's
pair.

## 7. Test hooks (closed contract, C-05)

Routes: none — the pattern composes no address. Test ids, exactly these two, on the elements ruled
in §1: `evidence-link` (the anchor; its `href` is the `href` prop, its text the glyph then the
label) · `evidence-link-glyph`. Behavioural hooks without new ids: `data-basis` on the anchor;
`title`; the `cx-evidence-link` and `cx-reticle` classes; the caller-supplied `data-line` /
`data-origin` / `aria-current` proving the rest spread; and the asserted absences — no hex in
`evidence-link.css`, no `[data-theme]` selector, no focus rule, no `BASIS_GLYPHS` second spelling,
no `onClick` and no router import in the component.

Gallery (R-UI-011, B-19): the barrel `patterns/evidence-link` enters `galleryBarrels` by existing as
a barrel index file, sorting between `patterns/dropzone` and `patterns/job-timeline`; the entry
`patterns/evidence-link/EvidenceLink` is compelled by `componentExports` (`EvidenceLinkProps` is a
type and is erased), and `missingEntries()` stays empty. Its `gallery-state` cells are **derived from
the basis roster** — `Object.keys(BASIS_GLYPHS)`, one cell per basis, named by the basis verbatim
(`MEASURED`, `TRANSCRIBED`, `DERIVED`, `IMPORTED`, `ENTERED`, `INTERPRETED`, `DEFAULTED`, s-design
I-17) — never a frozen list of seven. Addressed as
`gallery-barrel[data-barrel="patterns/evidence-link"]` and
`gallery-entry[data-entry="patterns/evidence-link/EvidenceLink"]`; the page's own four ids stand
unchanged and none is added.

Suites: `tests/ui/evidence-link/**` renders the seven bases under jsdom inside a default root and a
`[data-theme="dark"]` ancestor, asserting the §1 anatomy against `BASIS_GLYPHS` by enumeration and
the stylesheet facts as authored CSS text (jsdom does not lay out — primitives-core's precedent).
J-004 (`tests/e2e/journeys/j-004-gallery.spec.ts`) renders `/design` in light and dark with axe
serious/critical = 0, never widened (Q-11). Baselines (Q-06, B-20):
`tests/e2e/baselines/design/gallery-shell-light.png` and `-dark.png` capture the header alone and are
re-baselined **only if their bytes move**, in their own `baseline:` commit naming the proof; the
pattern's own pictures are `tests/e2e/baselines/design/evidence-link-*`.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

EvidenceLinks on queue items, certificate cells and BOQ lines — owner: those screens' leaves
(R-UI-022 names four surfaces; two ship here). A `--basis-defaulted` pairing that clears 4.5:1 as
text in light, which would let a future consumer colour a key by basis — owner: the node that owns
`src/ui/tokens.ts` and R-UI-001's founder values; until then I-176 stands and no consumer may
override it. A shared `title`/tooltip treatment through the core Tooltip rather than the native
attribute — owner: the node that owns the Tooltip's portalling in dense tables (a Tooltip per row of
a virtualised table is a measurement cost this pattern will not take on today).
