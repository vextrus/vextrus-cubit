# Design Decision — S-Settings · Site facts (`/t/{tenant}/p/{project}/settings/site-facts`)

```
┌R─┬─────────────────┬────────────────────────────────────────────────────────────────────────────────────────┐
│▲ │ ws › Trace Survey ▾ › Settings › Site facts                                            ⌘K ⟳ ✉ ◉          │  topbar 40
│  ├─────────────────┼────────────────────────────────────────────────────────────────────────────────────────┤
│▦ │ Project settings│ Site facts ⓘ                                                                           │  header 40
│▤ │  Rule set       │ Earthwork is unpriceable from drawings alone until the deferred site facts             │  face 28 — the one
│⚙ │  Participants   │ below are entered.                                                              y=48   │  statement (I-441)
│  │ ▌Site facts   ◂ │ ┌────────────────────────────┬──────────┬───────────┬─────────────┬────────┬─────────┐ │
│  │  Author edition │ │ Fact                       │  Value   │ Basis     │ Source note │ Entered│         │ │  28 sticky y=92
│  │                 │ │ Existing ground level      │      —   │ —         │ —           │ —      │    Enter│ │  28  y=120 (I-439:
│  │                 │ │ ┌────────────────────────────────────────────────────────────────────────────────┐ │ │  every row 28)
│  │                 │ │ │ No existing ground level has been entered for this project, so earthwork…      │ │ │  deferral
│  │                 │ │ │ Enter the site's existing ground level with the note it was read from, …       │ │ │  sub-row,
│  │                 │ │ │ Enter this site fact  (opens this row's entry form)                            │ │ │  the row's
│  │                 │ │ └────────────────────────────────────────────────────────────────────────────────┘ │ │  measure
│  │                 │ │ Water table level          │      —   │ —         │ —           │ —      │    Enter│ │
│  │                 │ │ ┌ No water table level has been entered for this project, so earthwork…          ┐ │ │
│  │                 │ │ Earthwork working allowance│ 1.5 ft   │ ƒ Derived │ Stated by t…│ —      │    Enter│ │  DERIVED (I-327);
│  │                 │ │ Earthwork extra depth      │ 0.5 ft   │ ƒ Derived │ Stated by t…│ —      │    Enter│ │  names: the Rule
│  │                 │ │ Blinding projection        │   3 in   │ ƒ Derived │ Stated by t…│ —      │    Enter│ │  set's (I-438);
│  │                 │ │ Blinding thickness         │   3 in   │ ƒ Derived │ Stated by t…│ —      │    Enter│ │  chip: Basis (I-440)
│  │                 │ └────────────────────────────────────────────────────────────────────────────────────┘ │
│  │       160       │                      1184 wide                                                         │
└──┴─────────────────┴────────────────────────────────────────────────────────────────────────────────────────┘

(Amended 2026-09-23, I-327: over the SAMPLE pin a fresh project defers the ground level and the water
table only — the four earthwork lengths read the pinned edition's figures under DERIVED, which is
what the earthwork rail reads for them — and all six rows stand above the fold at both viewports.)
(Amended session 8, I-438/b/c: the four facts the pin may state are named exactly as the Rule set
screen names their parameters; the basis chip stands in its own column after the figure, so every
name starts at the column's edge; every row stands at 28; the door stands at the row's trailing edge.)

GROUND_LEVEL entered (the `fact-entered` leg) — the deferral is gone from that row alone:
 │ Existing ground level │    -1.2 m │ ✎ Entered │ Survey sheet S-01 │ 8e8d2f ⎘ │  Restate │   data-basis="ENTERED"

The entry form, open under the row it belongs to (the deferral still standing above it):
 │ ┌ [  -1.2  ] m │ Metre (m) ▾ │ [ Survey sheet S-01              ] │ Cancel ● Enter this fact ┐ │
```

Route `/t/{tenant}/p/{project}/settings/site-facts` (tree spelling `…/settings/site-facts`), drawn
in the project settings layout (`docs/design/s-settings-project-sub-navigation.md`) inside
`SettingsPane` — the one settings template, s-settings I-198. Increment inc-304b-site-facts-panel.
Law: AM-06, L-MEA-06, L-ACT-01/02/03, L-FRM-04, R-UI-001/003/004/005/010/012/020/021/050/060/
080–086, B-17, B-19, C-05, Q-11, Q-17. Direction `00-direction.md` §3.6 rules the geometry and
outranks this file where the two disagree. Every earlier convention binds: `cx-` classes,
tokens-only colour and motion, `cx-reticle` from its single home, no `[data-theme]` selector in
authored CSS, model values verbatim in mono, identifiers through `IdChip` (R-UI-082). Chrome is
shipped primitives only — core Button, NumberInput, Input, Select, Skeleton, Tooltip, Popover,
BasisChip, IdChip, EmptyState; data DataTable v2; the one `RefusalState`; the one
`ConsequenceDialog` — plus the `cx-site-facts-*` classes this file rules. Copy lives in
`src/modules/takeoff/site-facts-ui/strings.ts`, export `siteFactsStrings`, keys `site_facts_…`;
JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (numbering continues the highest recorded, I-272)

- **I-273 — one row element per fact, and no `<tr>` is ever taller than 28.** A deferred fact must
  show its refusal in place (R-UI-020) and the grid law fixes the row at `--row-h`. Both hold: each
  fact is one `<tbody data-testid="site-facts-row">` holding a 28 px `<tr>` of cells and, when
  deferred, a second `<tr>` whose one cell spans the table and carries `site-facts-row-deferral`.
  One element per fact carries `data-fact` and `data-basis`; every `<tr>` keeps its lawful height.
  Rejected: a taller refused row (breaks R-UI-083), and a single refusal block for all six (that is
  the screen-local block B-17 forbids, and it would not name which fact is absent).
- **I-274 — the deferral stands while the form is open.** Opening the entry form mounts a third
  `<tr>` beneath the deferral; the refusal is dismissed by resolving it, never by hiding it
  (R-UI-020). It unmounts when the act commits and the row re-reads as ENTERED.
- **I-275 — ABSENT is not a basis.** *(Amended by I-327: `data-basis` carries `ABSENT`, `ENTERED`
  or `DERIVED` — the last for a fact nobody entered that the pinned edition states, wearing the
  DERIVED glyph ƒ. Amended by I-440: the chip stands in the Basis column, not at the name's leading
  edge; an ABSENT row's Basis cell says its absence with the row's dash.)* `data-basis` carries
  `ABSENT` or `ENTERED` — the two readings
  the ledger can answer. The `BasisChip` (ENTERED, ✎, R-UI-002) renders only on an entered row; an
  absent row wears no chip and no grey stand-in, because a fact nobody entered has no basis at all.
- **I-276 — the value cell is the reading as written.** `{valueAsWritten} {unitAsWritten}`, one
  space, mono, `tabular-nums slashed-zero`, right-aligned — no lakh/crore grouping, no re-spelled
  unit, no `UnitBadge` case-folding: a ground level of `-1.2 m` is a reading, and L-QTY-03 carries a
  reading as it was written. The canonical metres the canon made of it are not on this screen.
- **I-277 — `partial` is impossible, and six deferrals are `ready`.** The roster is a compile-time
  constant of six and the store answers all of it or none, so no row can be refused *by the read*.
  R-UI-050's "some rows refused: shown, not hidden" is satisfied by construction — every absent fact
  is shown with its named deferral — and the screen's `data-state` on a fresh project is `ready`.
- **I-278 — the roster is enumerated, so it widens without an edit here.** The panel maps
  `SITE_FACTS` (`src/core/site-facts/law.ts`); a seventh fact appears with its label key and its
  deferral entry and no change to this rendering (B-19). No placeholder row stands for a fact the
  ledger cannot hold (Q-17) — soil bearing, lead, lift and the rest are not promised chrome here.
- **I-279 — `SITE_FACT_DEFERRALS` lives in the module.** The map fact → refusal code is a rendering
  decision of this panel (I-B), not a rule of the ledger, and `src/core/site-facts/law.ts` is not
  this increment's to edit: it is `src/modules/takeoff/site-facts-ui/deferrals.ts`, a total map over
  `SITE_FACTS` (a fact without a deferral is a compile error), read by the panel only.
- **I-280 — the deferral's code is read off `data-code`, and no code chip is built.** The registry
  lists `refusal-code`, and `TESTIDS.refusal.code` is spelled; the shipped `RefusalState` renders no
  such element — its own Decision withdrew the chip and rules the code machine-readable only, on
  `data-code`. `src/ui/patterns/**` is not this increment's to change, and a code element added by
  this screen would be the second spelling of a refusal B-17 forbids. Ruling: the panel renders the
  one `RefusalState` unmodified and the journey reads the code from `refusal-state[data-code]`.
  Recorded as a contract conflict in §7 — the Builder does not invent a chip to close it.
- **I-281 — one form open at a time, and one act per fact.** `site-facts-enter` on any row closes a
  form open on another. Each entry is its own act over its own subject (AM-06 §1); no bulk row is
  offered, because six facts read from six different notes are not one group (R-UI-023).
- **I-282 — the entry is stated to the dialog, and the dialog answers it.** `site-facts-submit`
  opens the one `ConsequenceDialog`, which computes its own preview (R-UI-021, the pattern's I-41)
  and renders either the consequence or — through the one `RefusalState` in its own slot — the
  reason there is none. A refusal of the entry is therefore read where the entry is being carried,
  and is not also written into `site-facts-refusal`: a refusal said in two places is the second
  spelling B-17 forbids, and the panel's own slot keeps the one refusal that is about the panel
  rather than about an entry (`PERMISSION_NOT_HELD`). Rejected: previewing at the panel first and
  opening the dialog only over a consequence — it puts the same refusal in a second home and asks
  the seam the same question twice for one act.
- **I-283 — the act carried stands on its row at once.** A commit answers with the act it wrote;
  the ledger is append-only and that act is the latest entry of its fact, so the row it moved
  renders ENTERED with the reading, the note and the act id from that moment — the revalidated read
  arrives behind it naming the same act and replaces it. Rejected: leaving the row deferred until a
  read comes back, which shows a reader the absence of a fact they have just entered.
- **I-327 — a fact is deferred exactly where the rail defers it (session 7 craft pass, R-UI-020,
  L-MEA-06 "site overrides, edition otherwise states", Q-07).** The look of 2026-09-23 found four
  false deferrals on the demo project: Working allowance, Depth extra, Blinding projection and
  Blinding thickness each said "Neither this project's rule-set edition nor its site facts state
  this earthwork parameter" while the Rule set screen one nav row away showed the pinned edition
  stating all four (1.5 ft, 0.5 ft, 3 in, 3 in), and the earthwork rail binds them from the edition
  (`enteredOrDerived`, basis DERIVED) — it defers nothing for them. The panel had rendered a deferral
  for every ABSENT ledger row unconditionally, so it contradicted the product one screen away; I-B's
  own warning ("a reader told X is unentered would go look at an X that is already there") was the
  defect. Ruling: the page reads the pin beside the ledger (`editionStatedFactsOf`, through
  `projectRulesetView`, the Rule set screen's own read) and hands the panel `editionStated` — what
  the pin states of each fact, by the rail's own parameter keys (`EDITION_PARAMETER_OF` in
  `site-facts-ui/edition.ts`, importing the rail's constants, never re-spelling them). A row then
  reads, in precedence: ENTERED (the ledger — the site overrides); else DERIVED (the pin's figure as
  `{value} {unit}` in the Value cell in `--ink-secondary`, the BasisChip ƒ on the fact, the Source
  note cell `site_facts_edition_source` as a link to the Rule set screen, Entered by `—`, the door
  still `Enter` — entering overrides it); else ABSENT with its named deferral. The face line counts
  what actually defers: `site_facts_face` while anything does, `site_facts_face_complete` when
  nothing does. The deferral card spans the row rather than an 880 box, so the register's message
  stands on one line at 1440 (R-UI-083, the grid law; cited R-UI-084 until session 8). "Enter this site fact", the evidence of the two on-screen
  deferrals, opens that row's entry form — the same door as the row's `Enter` — instead of jumping to
  a fragment already in view (R-UI-020: a refusal's evidence leads onward); for a reader without
  `AUTHOR_PROJECT_FACT` it stays a plain link and the standing refusal says why. Rejected: showing the
  edition's figure under ABSENT (a basis the row does not have), and leaving the deferral with an
  amended message (a refusal about a figure the rail reads is still not true). Unit proof:
  `tests/takeoff/site-facts-ui/edition-stated.test.tsx` over the SAMPLE edition; J-305 is amended to
  derive each row's expected basis from the pin (TEST_AMENDED, in the spec). *(The ƒ chip "on the
  fact" stands in the Basis column since I-440.)*
- **I-438 — a fact the pinned edition may state is named as the Rule set screen names its
  parameter (session 8, C7; s-settings-ruleset-author I-268, B-17).** Session 7's re-look found the
  same pinned figures under two names one nav row apart: the Rule set screen read "Earthwork working
  allowance 1.5 ft" and "Earthwork extra depth 0.5 ft", and this screen's DERIVED rows — each beside a
  "Stated by the pinned rule set" link to that screen — read "Working allowance" and "Depth extra"; a
  reader who followed the link could not find a row by the name they left, and "Depth extra" was the
  key's word order rather than English. The four facts `EDITION_PARAMETER_OF` pairs with a parameter
  ARE edition parameters, and a parameter has one name in the settings area — `parameterLabel(key)`,
  I-268's one home. Ruling: the route builds, on the server beside the read of the pin,
  `parameterLabel(EDITION_PARAMETER_OF[fact])` for each such fact
  (`settings/site-facts/parameter-labels.ts`) and hands the map to the panel as `parameterLabels`
  through the screen; `factLabel(fact, parameterLabels)` names the fact on its row, in its form's
  three field names, in the status sentence and in the ConsequenceDialog the Enter opens — the seam
  names its one subject by the fact's id, the whole of what the digest binds, and the panel's preview
  adapter attaches the name as the subject's `subjectLabel` (presentation the digest is blind to,
  the participants screen's idiom), so the reader never confirms a dialog headed
  `WORKING_ALLOWANCE`. The module's own table keeps words only for the two
  facts no rule set states (the ground level and the water table, Q-07); the four
  `site_facts_fact_*` keys for the edition's lengths are retired, blinding projection and thickness
  with them, though their words happened to agree — two tables that agree are still two homes. It is
  built on the server because the pairing's home, the rail, reaches the store's schema through the
  offer contract, and a value import of it into the client screen would carry the rail into the
  browser (the panel's type-only import of the edition map exists to prevent exactly that); ARCH-01
  bars the panel from the app's table, so the words arrive as data. Types keep it total both ways:
  `SiteFactParameterLabels` is keyed by the rail's `DerivableSiteFact` and the module's table by the
  rest of the roster, so a seventh fact is a compile error until it is named in one home or the other
  (B-19). Rejected: copying the Rule set's words into this table (the second spelling this ruling
  removes), and importing the rail into the client screen. Unit proof:
  `tests/takeoff/site-facts-ui/one-name.test.tsx`.
- **I-439 — the door yields the row's hairline, so every row stands at 28 (I-273, R-UI-083).** The
  re-look measured every fact row at a 29 px pitch while the sticky header stood at 28: a row cell is
  `--row-h` tall including its hairline, and the door's ghost Button is a control at `--control-h`,
  which at the compact density is also 28. Ruling: the door's cell spends no block padding, and the
  door stands at `min(var(--control-h), calc(var(--row-h) - 1px))` — never taller than a control,
  never taller than the row can hold beside its 1 px hairline, and at least 24 at both densities
  (27 compact, 32 comfortable) so it stays a target SC 2.5.8 admits. That is the height the
  DataTable's in-cell controls already stand at. The cell rule is named with the row rule it
  outranks, which is also why the door now stands at the row's trailing edge: the old
  `.cx-site-facts-door { text-align: end }` lost to `.cx-site-facts-line > td`'s `start`, the same
  class-versus-class-plus-element fault the Value column's alignment once had. The door's cell does
  not clip (`overflow: visible`): with no block padding the door stands 0 px (compact) and 1.5 px
  (comfortable) inside its cell, and the focus reticle's ticks stand 4 px outside it (R-UI-012), so
  the row rule's `overflow: hidden` cut the corner ticks down to stubs; the door's word is short and
  its column fixed, so nothing else in the cell can spill. The first row's top ticks still pass under
  the sticky header, and a door row at the table's foot loses its bottom ticks to the table's own
  scroller — the vertical arms stay visible in both. Unit proof:
  `tests/takeoff/site-facts-ui/row-pitch.test.ts`, which does the row's arithmetic with each
  density's tokens and reads the reticle's outset off its single home.
- **I-440 — the basis has its own column, after the figure (amends I-275's "leading edge" and
  §1.1).** The chip stood in front of the name inside the row's header, so an ENTERED or DERIVED
  name began ~80 px right of an ABSENT one and the key column read as a ragged edge (session 7's
  ledger IOU). Ruling: a **Basis** column of 108 between Value and Source note — the register's own
  order, value then basis then source — holds `BasisChip` ENTERED ✎ or DERIVED ƒ; the row's header
  is the fact's name and nothing else, so every name starts at the column's edge. An ABSENT row's
  Basis cell holds `site_facts_absent_value`, the dash every other cell of that row already says its
  absence with — no chip and no grey stand-in, so I-275 holds. The Fact column gives 40 px of its
  260 to the new column (220 holds "Earthwork working allowance" with room at either density), so
  the Source note keeps its measure at 1280. The rowheader's accessible name is now the name alone.
  Rejected: a fixed empty slot in front of every name (an indent with nothing in it on ABSENT rows,
  and the name column still spent on a chip), and a chip after the name (it moves with the name's
  length, which is the ragged edge again). Unit proof: `one-name.test.tsx` and `row-pitch.test.ts`.
- **I-441 — the face is the one statement of the consequence this screen writes (L-MEA-06).**
  Session 7's re-look lowered `copyDiet` because a fresh project read the consequence three times:
  the face line, then the ground level's deferral ("…so earthwork is structurally unpriceable from
  drawings alone until SITE facts are entered") and the water table's ("…so earthwork below it is
  unpriceable from drawings alone"). L-MEA-06 binds the FACE — "Consequence stated plainly on the
  face" — not the refusal's message, so the face line stays, in one sentence, only while something
  defers (I-327), and it is the only string of this panel's own that says it. The two cards are the
  register's messages rendered verbatim by the one `RefusalState` (R-UI-020, B-17); this screen may
  neither respell nor hide them. Their restatement is therefore the register's to diet, and the copy
  diet completes there (the session-8 map's L3): with the face keeping the statement, the product
  never stops stating the consequence on the face, so rewording `GROUND_LEVEL_UNSTATED`'s message
  departs from no clause — the reading the map's critic gave L3, which records it in the register's
  own home.
  Rejected: withdrawing the face line while the ground level's card happens to quote the clause (the
  face would fall silent the day the register is reworded), and a screen-local deferral block with
  shorter words (the second refusal spelling B-17 forbids). Guarded by
  `tests/takeoff/site-facts-ui/deferrals.test.ts`.

## 1. Regions (1440×900; the content pane is 1184 × 812, per the sub-navigation Decision)

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| section nav | the project's four settings areas, `Site facts` current (`aria-current="page"`) | `--drawer-w-min` 160 × 100 % | the sub-navigation Decision's | — (its own Decision) |
| header | `<h1 id>` `site_facts_heading` at `--text-20` `--weight-heading`, then the `(i)` — a ghost Popover trigger one `--control-h` square holding `site_facts_caption`. No subtitle | 100 % × 40 | `--ink`, `--text-20`, `--weight-heading`, `--control-h` | — |
| face | `site-facts-face`, one `<p>` — the screen's one helper line (R-UI-081), stating L-MEA-06's consequence while any fact defers (`site_facts_face`) and that nothing defers when nothing does (`site_facts_face_complete`, I-327); the one statement of the consequence this screen writes (I-441) | 100 % × 28, `--space-2` above; `max-inline-size` 880 | `--ink-muted`, `--text-13`, `--space-2` | — |
| table (primary) | `site-facts-table`, the grid law's own table (I-273: a `<tbody>` per fact, not DataTable v2 — that primitive renders a row's refusal as a SIBLING of the row, and this screen's contract requires the deferral INSIDE the fact's row element), sticky 28 px header, frozen Fact column, one `site-facts-row` per fact in `SITE_FACTS` order (§1.1) | 1184 wide × **as tall as its rows** and never taller than the height the screen has left (the pane less the header and face: ≤ 720 at 1440×900) — *amended in place (session 7, wave 3), the settings area's own ruling (s-settings-ruleset-author I-326): grown to the pane, the hairline frame stood as an empty bordered well of ~200 px at 1440 (~100 at 1280) under six rows and two deferral cards, one nav row from the screen that withdrew that well; the column's bound itself is corrected by s-settings-ruleset I-349 (no tool row; `shell-main`'s padding)*; `--gap-section` 16 above; past the bound it scrolls inside itself, never the page | `--row-h` 28, `--cell-px`, `--cell-py`, `--text-13`, `--font-mono`, `--ink`, `--ink-muted`, `--ink-code`, `--line` | never — the roster is six (I-278) |
| deferral sub-row | `site-facts-row-deferral`, one `RefusalState` (inline surface), on every ABSENT row — nobody entered the fact and the pin does not state it (I-327) | cell spans the table; the card spans the row (I-327 withdraws the 880 cap, under which the register's message wrapped inside the table); padding-block `--space-2` | RefusalState's own | absent on an ENTERED or DERIVED row |
| entry sub-row | the row's form: `site-facts-value` · `site-facts-unit` · `site-facts-source-note` · Cancel · `site-facts-submit` | cell spans the table; row-flex, gap `--space-3`, controls `--control-h` 28, submit `--control-h-lg` 32 | `--surface-sunken`, `--space-2/3`, `--control-h`, `--control-h-lg`, `--accent` (the primitive's) | mounted only while open (I-281) |
| refusal slot | `site-facts-refusal`, exactly one `RefusalState` for a refusal of the panel itself — the standing `PERMISSION_NOT_HELD` (I-282: an entry's own refusal is answered where the entry is being carried, inside the dialog) | 100 % × auto, `--space-3` above the table; `max-inline-size` 420 | RefusalState's own | absent |
| status line | `<p role="status" aria-live="polite">` under the table: pending, then done | 100 % × `--text-13` min-height, `--space-3` above | `--ink-muted`, `--text-12` | empty string, height kept |
| right column | none. Nothing on this screen is selectable, so the shell's inspector slot stays at width 0 (R-UI-080) | 0 | — | — |

Above the fold: 40 header + 8 + 28 face + 16 = the sticky header at **y = 92**, the first row at
**y = 120** below the top of `shell-main`, at 1440×900 and at 1280×800 alike (pane 1024 × 712 there;
table 1024 × 620 = 63 % of `shell-main`) — inside R-UI-081's 240 and inside the rubric's ≤ 120 band.
Six deferral sub-rows would be ~826 px against 720 of pane, and the table scrolls inside itself and
the page does not (C10); over the SAMPLE pin a fresh project has two (I-327), so all six rows stand
in the fold at both viewports. Exactly one primary per region; no second right column.

### 1.1 The table's columns

- **Fact** — 220 (260 until I-440), the frozen key column, the row's `rowheader`: the fact's name
  and nothing else, `--text-13`, one line, ellipsis, the grid's tooltip on truncation. The name is
  `factLabel(fact, parameterLabels)` (I-438): for a fact the pinned edition may state, the settings
  area's `parameterLabel` of its parameter, handed in by the route — the Rule set screen's own words;
  for the ground level and the water table, this screen's §3 words.
- **Value** — 180, right-aligned: `site-facts-row-value`, exactly `{valueAsWritten} {unitAsWritten}`
  in mono (I-276); on a DERIVED row the pin's own `{value} {unit}`, verbatim as the edition stores
  it, in `--ink-secondary` (I-327). On an ABSENT row the cell holds `site_facts_absent_value` and no
  testid. The column keeps a `--cell-px` + `--space-4` trailing gutter, so its right-aligned dash
  and the start-aligned cell beside it read as two cells, never as one "— —" (R-UI-085).
- **Basis** — 108 (I-440): on an ENTERED row the `BasisChip` for `ENTERED` (✎, I-275), on a
  DERIVED row the `BasisChip` for `DERIVED` (ƒ, I-327); on an ABSENT row `site_facts_absent_value` —
  no chip, because an absent fact has no basis at all. 108 holds the wider chip, "✎ Entered", with
  the cell's padding at either density.
- **Source note** — flex, the remainder: about 400 at 1440 and about 250 at 1280 once the five fixed
  columns (768) are drawn — the "≥ 360" this bullet once promised had not held at 1280 since the
  first edition (about 300 there), and the DERIVED link and a short survey reference read whole in
  either (I-440): `site-facts-row-source`, the note verbatim, `--text-13`, one line,
  ellipsis + tooltip. DERIVED: `site_facts_edition_source` as a link to the Rule set screen, no
  testid (I-327). ABSENT: `site_facts_absent_value`, no testid.
- **Entered by** — 140: `site-facts-row-act`, the act id through `IdChip` (short form, copy, full in
  the tooltip) — the 36-char id is body text nowhere (R-UI-082). ABSENT and DERIVED:
  `site_facts_absent_value` — no act entered the fact.
- **Act** — 120, trailing: the row's ghost core Button `site-facts-enter`, label `site_facts_enter`
  on an ABSENT or DERIVED row (entering a stated fact overrides the pin, L-MEA-06) and
  `site_facts_restate` on an ENTERED one, standing at the row's trailing edge. Its cell spends no
  block padding and the door stands at `min(--control-h, --row-h − 1px)` — it yields the row's
  hairline, so the row keeps its 28 — and the cell does not clip, so the door's focus reticle draws
  whole (I-439).

## 2. The states, cell by cell

Declared in the one enumerable home `src/modules/takeoff/site-facts-ui/states.ts`, export
`SITE_FACTS_STATES` (the `PARTICIPANTS_STATES` cell shape); the suite reflects over it (B-19), and
`data-state` on `site-facts` carries the name of the cell rendered.

- **Loading** — `loading.tsx`, frame and nav intact: core Skeletons keeping the layout the answer
  will take, gap `var(--space-2)` — one 24 × 240 bone for the title, one 16 × 420 for the face, then
  the table's real 28 px header over six pairs of bones, 28 × min(1088, 100 %) and 72 ×
  min(880, 100 %). No spinner ever stands on this table (R-UI-004).
- **Empty** — impossible (I-278): `SITE_FACTS` is a constant of six, and a project that has entered
  none of them is not empty — it is six named deferrals, which is what the reader needs to read.
  Recorded in the matrix as a reason, not as a rendering; no `EmptyState` is built.
- **Partial** — impossible as a read (I-277). Its duty is discharged in `ready`: an entered fact and
  a deferred one stand side by side in roster order, and nothing is hidden for being refused.
- **Error** — a render, read or action fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned here), which shows **Try again** and the report id; the nav survives the fault, so a
  reader can leave by clicking another area (sub-navigation §2).
- **Refusal** — in place, never a toast (R-UI-020), through the one renderer in three homes, each
  the place the thing refused is being done (I-282): the row's `site-facts-row-deferral` for an
  absent fact (codes per §3); the dialog's own refusal slot for the refusals of the entry being
  carried — `REQUEST_MALFORMED`, `SITE_FACT_UNKNOWN`, `SITE_FACT_SOURCE_UNSTATED`, `UNIT_UNMAPPED`
  and a `PERMISSION_NOT_HELD` answered at the door — since `site-facts-submit` states the entry to
  the one `ConsequenceDialog`, which previews it itself (R-UI-021) and shows either the consequence
  or the reason there is none; and `site-facts-refusal` for the refusal of the panel itself, the
  standing `PERMISSION_NOT_HELD` (evidence: participants). No refusal is said in two places.
  `CONSEQUENCES_NOT_CARRIED` renders as the dialog's own stale notice and is never in either slot.
  A refusal clears when the next preview is asked for, and clears no typed field.
- **Busy** — while the entry is being checked `site-facts-submit` takes core's loading state
  (`aria-busy`, no spinner), `site-facts` reads `data-state="busy"` and the status line reads
  `site_facts_status_pending`; the dialog stands over it holding the pattern's own bones, and the
  fields stay enabled, because nothing is committed. While the commit is in flight the dialog's
  confirm takes the loading state (the pattern's own) and the status line speaks the same pending
  line.
- **Ready** — six rows in roster order, each ENTERED with value, note and act chip, DERIVED with the
  pin's figure and no deferral (I-327), or ABSENT with its deferral; the doors armed. After a commit: the dialog closes, that row stands ENTERED at once
  with no deferral while the others keep theirs — the act carried is the latest entry of its fact,
  so the row shows it without waiting to be told (I-283) — the route revalidates behind it and
  answers with the same act, and the status line reads `site_facts_status_done`.
- **Offline** — a fault of reachability (shell I-20): a failed navigation or action surfaces the
  error path or the registered refusal; no invented banner, and no figure ages on screen pretending
  to be current.
- **Permission-denied** — nothing is hidden (R-SPINE-006): a reader without `AUTHOR_PROJECT_FACT`
  sees the whole panel, every row, every deferral. Each `site-facts-enter` renders as the shut-door
  idiom (I-272) — a focusable `span` in `cx-btn` chrome, `role="button"`, `tabIndex={0}`,
  `aria-disabled="true"`, `data-permission="AUTHOR_PROJECT_FACT"`, `aria-describedby` on a standing
  `PERMISSION_NOT_HELD` `RefusalState` in `site-facts-refusal` naming the act type
  `AUTHOR_SITE_FACT`, the permission `AUTHOR_PROJECT_FACT` and who holds it — the project's MEASURER
  and PRINCIPAL participants — with the participants screen as the place it is granted.

## 3. Copy, verbatim (`strings.ts`, export `siteFactsStrings`)

`site_facts_heading` **Site facts** ·
`site_facts_face` **Earthwork is unpriceable from drawings alone until the deferred site facts
below are entered.** (I-327 — "these site facts" had claimed all six) ·
`site_facts_face_complete` **Every site fact earthwork reads is entered here or stated by the
pinned rule set.** (I-327 — the face when nothing defers) ·
`site_facts_caption` **A site fact is a reading no drawing carries. Each one is entered as its own
act, with the note it was read from, and is restated by entering it again.** ·
`site_facts_column_fact` **Fact** · `site_facts_column_value` **Value** ·
`site_facts_column_basis` **Basis** (I-440) ·
`site_facts_column_source` **Source note** · `site_facts_column_act` **Entered by** ·
`site_facts_absent_value` **—** · `site_facts_row_value` **{value} {unit}** (the entered reading as
one cell: the figure as it was written and the unit it was written in) ·
`site_facts_edition_source` **Stated by the pinned rule set** (I-327 — the Source note of a DERIVED
row) ·
`site_facts_fact_ground_level` **Existing ground level** · `site_facts_fact_water_table` **Water
table level** — the two facts no rule set states, and the only fact names this table holds
(I-438). The four the pinned edition may state are named by the settings area's
`parameterLabel(EDITION_PARAMETER_OF[fact])`, the Rule set screen's own words, handed in by the
route: today **Earthwork working allowance** · **Earthwork extra depth** · **Blinding projection** ·
**Blinding thickness** (`settings/ruleset/strings.ts`, not spelled here). Retired by I-438:
`site_facts_fact_working_allowance` "Working allowance", `site_facts_fact_depth_extra` "Depth
extra", `site_facts_fact_blinding_projection` and `site_facts_fact_blinding_thickness` ·
`site_facts_enter` **Enter** · `site_facts_restate` **Restate** ·
`site_facts_value_label` **Value for {fact}** · `site_facts_unit_label` **Unit for {fact}** ·
`site_facts_source_label` **Source note for {fact}** ·
`site_facts_source_placeholder` **Where this reading was read from** ·
`site_facts_submit` **Enter this fact** · `site_facts_cancel` **Cancel** ·
`site_facts_status_pending` **Checking what this entry changes.** ·
`site_facts_status_done` **Done. {fact} now reads {value}.** ·
`site_facts_evidence_enter` **Enter this site fact** ·
`site_facts_evidence_ruleset` **Open the pinned rule set** ·
`site_facts_evidence_participants` **Open participants**.

Unit options (`site-facts-unit`, the canon's LENGTH units in `UNITS` order, human labels, the metre
chosen): `site_facts_unit_m` **Metre (m)** · `site_facts_unit_mm` **Millimetre (mm)** ·
`site_facts_unit_ft` **Foot (ft)** · `site_facts_unit_in` **Inch (in)**. The option's value is the
canon's own spelling, which is what `unitAsWritten` carries.

The deferrals (`SITE_FACT_DEFERRALS`, I-279): `GROUND_LEVEL` → `GROUND_LEVEL_UNSTATED`,
`WATER_TABLE` → `WATER_TABLE_UNSTATED`, and `WORKING_ALLOWANCE` · `DEPTH_EXTRA` ·
`BLINDING_PROJECTION` · `BLINDING_THICKNESS` → `EARTHWORK_PARAMETER_UNSTATED`. Message and remedy
are the register's and render as registered; the evidence link is `site_facts_evidence_enter` to
this screen's own row anchor for the first two — pressed, it opens that row's entry form, the same
door as the row's `Enter` (I-327) — and `site_facts_evidence_ruleset` to
`settings/ruleset` for the four the edition may also state (I-B). `WATER_TABLE_UNSTATED` is
appended to `src/core/errors/foundations.ts` by this increment, in the register's voice: message
**No water table level has been entered for this project, so earthwork below it is unpriceable
from drawings alone.** · remedy **Enter the water table level with the note it was read from, then
measure the campaign again.** · severity `error` · surface `inline`.

Voice: calm, concrete, professional; nouns on the nav row and the column heads, verbs on buttons;
no exclamation marks; no build vocabulary — "act", "consequence", "site fact" and "source note" are
the product's own user-facing law. No clause id and no enum spelling appears in any sentence.

## 4. Motion (R-UI-004)

The ghost button's fill transitions over `var(--motion-state)` `var(--ease)` on hover and focus. The
ROW wears no hover state: the one pointer target a row holds is its door, so a fill under the pointer
would paint a row the reader cannot act on — and it would make every picture of this table a function
of where the pointer came to rest rather than of what the panel holds. The deferral card, the entry form and the status line mount with **no** entrance — no height
tween, no fade, no stagger: an answer and a form both arrive instantly, and theatre in front of a
refusal reads as apology. The ConsequenceDialog's entrance is the pattern's own. Skeleton pulse and
the reticle draw live in their single homes. Every duration is a token zeroed at source under
`prefers-reduced-motion`, so `site-facts.css` carries no reduced-motion branch.

## 5. Tokens

Semantic aliases and density/layout tokens only (Direction §4; a `--graphite-*`/`--beam-*` reference
here is a `cubit/no-primitive-token` failure): `--surface-app` · `--surface-panel` ·
`--surface-sunken` (the entry sub-row) · `--ink` / `--ink-muted` / `--ink-code`
· `--ink-secondary` (a DERIVED figure, I-327) · `--ink-link` (the DERIVED source link) ·
`--ink-disabled` (the shut door) · `--line` through `--hairline` · `--accent` (the submit, the
primitive's own) · `--row-h` · `--control-h` · `--control-h-lg` · `--cell-px` / `--cell-py` ·
`--drawer-w-min` · `--gap-section` · `--space-2/3/4` · `--text-12/13/20` · `--font-mono` /
`--font-ui` · `--weight-heading` / `--weight-body-medium` · `--radius-4` · `--motion-state` /
`--ease`. Px literals, closed set: the column measures 220 / 180 / 108 / 140 / 120 (I-440: the
Fact column's 260 became 220 and the Basis column's 108), the two
`max-inline-size` measures 880 (the face) and 420 (the refusal slot; the deferral card's 880 is
withdrawn by I-327), the 1 of the row's own hairline the door yields (`--row-h − 1px`, I-439), and
the loading bones 24 × 240, 16 × 420, 28 × 1088, 72 × 880. Any other literal is a defect. Copper appears exactly once on this screen — the dialog's
confirm — and the basis amber arrives only through `BasisChip`.

## 6. Themes

Dark is the default and light is complete; `site-facts.css` carries no `[data-theme]` selector and
every difference arrives through token values (R-UI-001). What differs is the flip of the graphite
scale behind the aliases: in dark the pane is the lighter plate on the app ground and the entry
sub-row's `--surface-sunken` recedes below it, in light the same two exchange roles — the seam, the
sticky header and the frozen column keep their meaning in both. Contrast held in both themes:
`--ink` on `--surface-panel` ≥ 4.5:1, `--ink-muted` (the face line, the `—` cells, the 12 px status
line — size earns no carve-out) ≥ 4.5:1, `--ink-disabled` on the shut door ≥ 3:1, the RefusalState
tints and its `beam-600` link per that Decision, the `IdChip` and `BasisChip` their own. Nothing is
colour-only: ENTERED carries its ✎ glyph, DERIVED its ƒ glyph and the words of its source cell, and
an absent fact is named in words.

## 7. Test hooks (closed contract, C-05)

Route: `/t/{tenant}/p/{project}/settings/site-facts` (tree `…/settings/site-facts`), built by
`S_SITE_FACTS.route(tenantId, projectId)` / `siteFactsRoute`, crumbs declared in
`src/ui/shell/routes.ts` — page crumb `PROJECT_SETTINGS_PAGES["site-facts"]` = **Site facts**
(I-270's one home, also the nav row's label). Test ids, exactly these, on the elements §1 rules:

- `site-facts` — the route's root region, carrying `data-state` (§2's cell name).
- `site-facts-section` — the module's `<section aria-labelledby>` inside it, carrying
  `data-rendered-region`.
- `site-facts-face` · `site-facts-table` (carrying `data-rows-rendered`) ·
  `site-facts-row` (one `<tbody>` per fact, `data-fact`, `data-basis`) · `site-facts-row-value` ·
  `site-facts-row-source` · `site-facts-row-act` · `site-facts-row-deferral` · `site-facts-enter` ·
  `site-facts-value` · `site-facts-unit` · `site-facts-source-note` · `site-facts-submit` ·
  `site-facts-refusal`.
- Borrowed, unchanged, from their own Decisions: `settings-area` (`data-area`, and on this area now
  an `<a>` with `href` and no `data-unbuilt`) · `refusal-state` / `refusal-message` /
  `refusal-evidence-link` · `consequence-dialog` (`data-act-type="AUTHOR_SITE_FACT"`) ·
  `consequence-digest-line` · `consequence-effect-lines` · `consequence-confirm`.

Behavioural hooks without new ids: `aria-current="page"` on exactly the `settings-area` row with
`data-area="site-facts"`, read as the whole list; the **absence** of `data-unbuilt` on it, asserted
rather than assumed; `data-basis` `ABSENT` | `ENTERED` | `DERIVED` per row (I-327); the absence
of `site-facts-row-deferral` on an entered or derived row and of `site-facts-row-value` on an
absent one; `site-facts-row-value` on a derived row reading the pin's `{value} {unit}`;
`aria-disabled="true"` and `data-permission="AUTHOR_PROJECT_FACT"` on a shut `site-facts-enter`;
`data-theme` on the document root (the shell's); `cx-reticle` on every focusable.

Proof: J-305 (`tests/e2e/site-facts.spec.ts`, page object
`tests/e2e/pages/s-settings-site-facts.page.ts`) at checkpoints
`s-settings-site-facts/panel-absent`, `panel-absent-light` and `fact-entered`; axe serious/critical
= 0 at each; baselines under `tests/e2e/baselines/design-dark/s-settings-site-facts/` with the
`-light` suffix for the light twin (I-D). Unit: `tests/takeoff/site-facts-ui/**` over the roster,
the deferral map and `SITE_FACTS_STATES`; `one-name.test.tsx` (I-438, I-440: each name is the Rule
set screen's, on the row, in the form's field names, in the consequence dialog and in the status
sentence; the chip under
Basis) and `row-pitch.test.ts` (I-439, I-440: the door's arithmetic at both densities, the
columns' measures). Baselines this screen moves, in their own `baseline:`
commit (B-20): `tests/e2e/baselines/design-dark/s-settings-ruleset-author/*.png`, because the nav
row's ink moves from disabled to link.

## Additional test hooks

Two conflicts in the closed surface, recorded rather than spelled around:

1. **`refusal-code` names no element the shipped renderer draws** (I-280). The registry lists it and
   `TESTIDS.refusal.code` spells it, but `RefusalState` withdrew the code chip and carries the code
   on `data-code`; `src/ui/patterns/**` is not this increment's. The journey reads
   `refusal-state[data-code]` inside `site-facts-row-deferral`. No screen-local code element is
   built — that would be the second refusal spelling B-17 forbids.
2. **The RENDERED read contract's attributes are still unregistered.** `data-rendered-region` and
   `data-rows-rendered` are required of every screen by `tests/e2e/support/retrying-read.ts` and are
   used here with exactly those names, the tree's existing support contract; only `data-state` is in
   the registry. The gap is the same plan defect recorded in `s-settings-ruleset-author.md` §
   Additional test hooks, not a spelling this Decision invents.

## Changelog

- 2026-09-19 — inc-304b-site-facts-panel: first edition. The project Site facts panel for
  `AUTHOR_SITE_FACT` under the existing `AUTHOR_PROJECT_FACT` (AM-06 §1): the closed roster of six
  by enumeration, each absent fact a named deferral through the one `RefusalState`, entry through
  the one `ConsequenceDialog`. I-273–I-281 recorded; the sub-navigation's `site-facts` row gains its
  route and its `data-unbuilt` is withdrawn.
- 2026-09-20 — inc-304b-site-facts-panel: where an entry's refusal is read, and when its row moves.
  I-282: `site-facts-submit` states the entry to the one `ConsequenceDialog`, which previews it and
  answers a refusal in its own slot — `site-facts-refusal` keeps only the panel's own standing
  `PERMISSION_NOT_HELD`. I-283: the act a commit answers with stands on its row at once. `§ 3` gains
  `site_facts_row_value`, so the entered cell is composed from the copy table like every other
  string this panel shows. No region, token or picture moves.
- 2026-09-20 — inc-304b-site-facts-panel: the deferral's 880 measure is the screen's box, not the
  card's. The sub-row's cell holds a `cx-site-facts-deferral` box carrying the measure and the one
  `RefusalState` inside it, so no rule of the refusal card is written outside
  `src/ui/patterns/refusal-state/refusal-state.css` (R-UI-020, B-17). The rendered geometry is
  unchanged — the card is a block-level flex box and fills the 880 either way — so no picture moves.
- 2026-09-20 — inc-304b-site-facts-panel: the Value column is right-aligned as § 1.1 states, and the
  row wears no hover. The alignment rule named a class only and lost to the cell and header rules,
  which each name an element, so the column painted start-aligned; the rule now names the element
  too. The row hover fill is withdrawn (§ 4): a row is not a target, and the fill made the table's
  pictures a function of where the pointer rested after the last click. `--surface-hover` leaves § 5.
  Both checkpoints of this screen move by these two changes and are the gate's to re-take.
- 2026-09-23 — session 7 craft pass (the look put this screen below the bar: `rowHeight` 3 → 2,
  `copyDiet` 5 → 3): I-327. A fact is deferred exactly where the earthwork rail defers it — the
  page reads the pin beside the ledger and a fact the pinned edition states reads its figure under
  DERIVED, with no deferral; four false deferrals leave the demo project. The face line says what
  actually defers (`site_facts_face` reworded, `site_facts_face_complete` added); the DERIVED source
  cell is `site_facts_edition_source`. The deferral card spans the row (its 880 cap withdrawn) so the
  register's message stands on one line at 1440; "Enter this site fact" opens the row's form; the
  Value column keeps a wider trailing gutter so two absent dashes never read as one. J-305's
  expectations are derived from the pin (TEST_AMENDED in the spec). The three `s-settings-site-facts`
  pictures move and are the gate's to re-take.
- 2026-09-23 — session 7, wave 3 (the craft re-look): §1's table region amended in place. The table
  is as tall as its rows (`flex: 0 1 auto`), never an empty bordered well under them — the settings
  area's own ruling on wells (s-settings-ruleset-author I-326) — and still scrolls inside itself past
  the column's bound, which loses the tool row the frame never renders (s-settings-ruleset I-349).
  The status line now follows the table's last row. The deferral card's sentence (the register's
  `GROUND_LEVEL_UNSTATED` message, "…structurally unpriceable … until SITE facts are entered") is
  the register's to reword under a Deviation and is not this screen's to spell a second way. The
  three `s-settings-site-facts` pictures move and are the gate's to re-take.
- 2026-09-23 — session 8, C7 (session 7's re-look: one parameter under two names beside the Rule
  set screen, every row at a 29 px pitch, the basis chip moving names 80 px, and `copyDiet` lowered
  5 → 4 for the consequence said three times): I-438 — the four facts the pinned edition may state
  are named as the Rule set screen names their parameters ("Earthwork working allowance",
  "Earthwork extra depth", …), built by the route on the server with `parameterLabel` and handed to
  the panel as `parameterLabels`; the names reach the row, the form's three field names and the
  status sentence and the consequence dialog's subject, and the module's four `site_facts_fact_*`
  keys for them are retired. I-439 — the
  door yields the row's hairline, so every row stands at 28, the door stands at the row's
  trailing edge as its stylesheet always said, and its cell does not clip the focus reticle. I-440 — a Basis column (108) after Value holds the
  chip, the Fact column (220) holds the name alone. I-441 — the face stays the one statement of
  L-MEA-06's consequence this screen writes; the restatement inside the deferral cards is the
  register's message and completes its diet there (the map's L3); because the face keeps the
  statement, that rewording departs from no clause. §0's grid-law citation reads R-UI-083 (it cited
  the breadcrumb law, R-UI-084). The three `s-settings-site-facts` pictures move and are the gate's
  to re-take.
