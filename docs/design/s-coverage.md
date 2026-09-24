# Design Decision — S-Coverage (the coverage grid)

Route `/t/{tenant}/p/{project}/takeoff/coverage`, widened by `?cell={kind}:{class}:{levelId}`, under
`src/app/(app)/t/[tenant]/p/[project]/takeoff/coverage/**`, inside the takeoff nav, the shell frame
and the membership guard. Increment inc-216-coverage-grid. Law: X-3, R-TO-052, L-QTY-05, L-QTY-07,
L-ACT-02, L-ACT-03, R-UI-001/002/003/004/005/010/012/020/021/030/031/032/050/060, J-022, J-000,
B-17, B-19, B-20, Q-11, ARCH-01, C-05. Files: `takeoff/layout.tsx` (one nav entry added),
`takeoff/coverage/{page.tsx,loading.tsx,coverage-screen.tsx,route-address.ts,states.ts,coverage.css}`
and the reading, the presentational `CoverageWorkspace`, the DOM heat grid (`grid.tsx`), the mark and
ramp vocabulary (`heat.ts`), the glyph map and `copy.ts` in `src/modules/takeoff/coverage/**`. Every
convention of the earlier Decisions binds: `cx-` classes, variants on data-attributes, tokens-only
colour and motion, no `[data-theme]` selector in authored CSS, model values verbatim in mono (I-25)
and whole (I-26), the module takes its shipped chrome as injected renderers (I-170) on a
`display: contents` mount where a shipped root fixes its own id (I-171). Interpretations I-1–I-187
remain in force. Chrome comes only from shipped primitives and patterns — core Button, Skeleton,
EmptyState, ErrorState, IdChip, EnumLabel, Tooltip; the one RefusalState; the one ConsequenceDialog;
the frame's own ShellToolbar and its three slots — plus the matrix this file rules and the
`cx-coverage-*` classes beside it.

**REBUILT under Design Direction 00 (v22 U2), which outranks this file where the two disagree (§3.5,
§4.3, §7, §8's "Coverage (2.3)").** The before-score was 2.3, and its three named fixes are what
changed: a real heat grid with sticky headers, a ramp and a hatch; the 540 px legend as one 28 px key
line with the meanings on hover; the cell's cause and remedy in the shell's ONE inspector, the three
UUIDs through `IdChip` and the SCREAMING enums through `EnumLabel`. What did not change is the law:
the residue arms, the axis rule, the act doors, the seven states and the two boundary statements are
all exactly where they stood.

## The screen at a glance — wireframe and regions (Direction §3.5)

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Coverage              ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.con.│
│  │ Pinned revision a3f9c2 ⎘            [ Hide certificate ]      │ column·L1│
│  ├──────────────────────────────────────────────────────────────┤ ⊖ Held  │
│  │ ● Published ◐ Partial ○ Absent ⊘ Out of scope ⊖ Held ⋯ No class│ A person│
│  ├──────────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┤ held…   │
│  │ Kind     │ column      │ beam        │ slab        │ …          │ act 8e8d│
│  │          │ GF │ L1 │ L2 │ GF │ L1 │ GF │ L1 │                   │ Remedy: │
│  │▍rcc.conc │ ●  │ ⊖▨ │ ○  │ ●  │ ◐▧ │ ●  │ ○  │                   │ Measure │
│  │▍rebar    │ ●  │ ●  │ ○  │ ○  │ ◐▧ │ ⊘▩ │ ○  │                   │ [Open   │
│  │▍formwork │ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │ ●  │                   │  the    │
│  │ 28 px cells · sticky kind column · sticky class/level header      │ register]│
│  ├──────────┴────────────────────────────────────────────────────┤ Sighted │
│  │ 42 cells · 31 published · 6 absent · 3 held · 2 partial          │ in ▸    │
│  ├──────────────────────────────────────────────────────────────┤ [Hold]  │
│  │ Certificate preview — measurement boundary · bill boundary      │ [Scope] │
└──┴──────────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tool row (shell slot) | the pinned revision as `IdChip`, and the one control that shuts the certificate | 100 % × 32, the frame's own track | — | absent — nothing to act on | — |
| key line | one horizontal key, 7 glyph+word pairs; hover and focus → the registry's one-sentence meaning | 100 % × `--row-h` (28 compact / 36 comfortable) | — | — | one bone of the same height |
| heat grid (primary) | kinds × (class · level) matrix; one cell per residue cell, each a glyph + the ramp fill by share published + the §4.3 hatch for its mark | flex, takes what main has left; ≥ 55 % of `shell-main` | `EmptyState`: the reason it is empty + the one action | `ErrorState`: the sentence, the report id as `IdChip`, the retry | a bone that keeps the height |
| tally (footer) | counts by mark — "42 cells · 31 published · 6 absent" | 100 % × `--row-h` | — | — | one bone of the same height |
| certificate preview | the two boundary statements as they will print, never merged | 100 % × ≤ 192, its own scroll; `display: none` when shut | its own "none" sentence per statement | absent — a statement over a read that failed is a claim nobody made | one bone |
| inspector (shell slot) | the cell: kind · class · level, the mark and its cause sentence, the act `IdChip`, the remedy as one sentence and one button, the Sighted-in table, the observations, the two doors | 320, the frame's own, resizable | absent at width 0 — no selection, no column | — | — |
| answer slot | one `RefusalState` for a door's rejection, and the standing denial of SET_BILL_BOUNDARY | 100 % × auto; `:empty` collapses to nothing | — | — | — |

## 0. Interpretations (numbering continues the global chain's highest, s-viewer-inspector's I-187)

- **I-188 — the fill is the ramp; the mark is the cause.** *(Amended by Direction §4.3, which
  outranks this file.)* The cell's FILL is now the coverage ramp — `--cov-0..4` by share published,
  off `data-cov` — and not the registry's severity tint. The severity tints said "needs attention" in
  four colours; the ramp says *how much of this is measured* in one hue, which is the question a QS
  opens this screen with, and it is colour-blind safe by construction (one hue, lightness steps
  ≥ 12 L\*). The CAUSE is still the mark, and the mark is now three things at once — a glyph, a
  pattern and a colour (I-211) — so nothing is carried by colour alone (R-UI-060) and no second table
  of cause colours exists to drift from the registry.
- **I-189 — one cell, two axes, two marks.** L-QTY-05's axes are orthogonal, so a cell may be both
  unmeasured and held out of the bill and must say both. The measurement axis is the centred glyph;
  the bill axis is the §4.3 hatch over the whole cell plus a second, smaller glyph in the lower-right
  corner. The hatch is now `--pattern-hatch` on the cell's own `::after` in `currentColor` rather than
  an SVG `<defs>` pattern — same 45°, same pitch, one home, and it prints in the certificate's
  greyscale (R-UI-060). Exactly ONE of the two marks carries `data-testid="coverage-cell-glyph"` with
  `data-code`: the axis the cell is READ under (I-198). Rejected: a single glyph showing whichever
  axis lost, which would hide a measurement cause behind a bill decision.
- **I-190 — RETIRED: the grid is DOM, so its focus reticle is the tree's own.** The drawn reticle
  existed because `cx-reticle` renders through `::after` and an SVG `<g>` hosts no pseudo-element.
  The matrix is now boxes, every cell hosts one, and every cell wears `cx-reticle` from the single
  CSS home (B-17, R-UI-012). `coverage-reticle.tsx` is deleted with the reason it existed. Three
  properties came with the move and none of them could be had in a viewBox: `position: sticky` for
  the frozen kind column and the frozen class/level header, the §4.3 `--pattern-*` hatches in
  `currentColor`, and text that ellipsises. That is why the grid is no longer drawn.
- **I-191 — a cause is a reading of the project, not a refusal of a request.** The inspector states the
  cause and its remedy as its own two lines, `coverage-inspector-cause` and
  `coverage-inspector-remedy`, taking their words verbatim from the registry entry — one home for the
  words (R-SPINE-062), never paraphrased. `RefusalState` stays the one renderer of refusals *of a
  request*: a refused door in `coverage-answer`, a refused preview or commit inside the dialog's own
  slot. No code is rendered as text and no card chrome is imitated, so this is not the screen-local
  refusal block B-17 forbids.
- **I-192 — arm order governs both axes, and a beaten declaration is marked, not hidden.** A
  declaration that a cell is absent, over a cell that now bears published lines, is beaten on its own
  axis: the cell reads `data-measurement="QUANTITY_BEARING"` (or `data-bill="IN_BILL"`) and
  `data-contradicted="true"`, the inspector states it in a sentence, and both statements omit the
  cell — a certificate never prints a boundary the lines deny. The row stays; nothing is withdrawn.
- **I-193 — a cell replaces the address, never pushes it.** Selecting a cell `history.replaceState`s
  `?cell={kind}:{class}:{levelId}`, so the address is shareable and Back leaves the screen instead of
  walking a reader backwards through fifty clicks. On mount the named cell is selected and holds the
  grid's one tab stop; a `cell` this residue does not hold selects nothing and says nothing — no code
  is invented for a stale address (s-takeoff-register I-182's idiom).
- **I-194 — a door stands only where it could be carried.** Both doors are absent — not disabled — on
  a cell whose axis already reads QUANTITY_BEARING, on a cell whose declaration of that cause is
  already in force (a second one refuses `ACT_CHANGES_NOTHING`), on a kind-grain row, and while the
  permission is not held: a door that can answer only a refusal is theatre (participants I-50). They
  render `disabled` while offline, which is a connection, not a judgement.
- **I-195 — the key line names meanings, never codes.** *(Amended by Direction §3.5 and §8: the
  legend was 540 px tall and is now ONE 28 px line.)* Codes are machine-readable only (refusal-state
  §7), so a key entry renders the mark and the WORD it is read by — Published, Partial, Absent, Out of
  scope, Held, No class, Catalogue only — while the registry's whole sentence rides on `data-meaning`
  and is rendered by the shipped `Tooltip` on hover AND on focus, which is why the entry is a tab
  stop. Seven entries, the one measured reading first and then the closed cause set in the law's own
  order: the measured reading is no longer lifted out onto a line of its own, because on one line
  there is no "above". The remedies are gone from the key and stand in the inspector, where the cell
  that needs one is.
- **I-196 — a kind with no cell is a row, and the screen is `partial` while one stands.** A work item
  no class bears, and a borne kind no sighted class bears, cannot be celled out — they are rendered
  at the head of the grid as kind-grain rows spanning the class-and-level extent, with
  `data-grain="KIND"` and `data-class=""` `data-level=""`, and the screen reads `partial`. Shown,
  never hidden (R-UI-050).
- **I-209 — a module reaches the frame's slots through injected mounts.** `useInspector`,
  `useShellToolbar` and `useShellStatus` live in `@/ui/shell` and ARCH-01 bars a module from importing
  them — but the inspector and the tool row are the frame's regions and a screen that drew its own
  would spend the work surface's height on chrome (Direction §1). So the workspace writes both nodes
  and hands them to `chrome.InspectorMount` and `chrome.ToolbarMount`, two more injected renderers
  (I-170); `coverage-screen.tsx`, the one file that may reach both trees, is where the hooks are
  called, and the tool row's STRIP is the shipped `ShellToolbar` so the 32 px is the frame's arithmetic
  and not a second copy of it. A mount nobody hands over renders the nodes in place, so the module is
  a whole screen on its own and a suite mounts what a reader meets. Rejected: the workspace publishing
  a selected-cell callback and the binding file re-rendering the inspector, which would put this
  screen's composition in two files.
- **I-210 — "share published" is a fact the residue already holds.** The ramp needs a number per cell
  (§4.3) and the residue is not a percentage, so the number is defined and never invented: a cell
  bearing published quantity is 1; a cell standing under any other cause has published nothing and is
  0; and the one reading between them — `INGESTION_TRUNCATED`, a cell whose sheet was read only in
  part — is the share of ITS OWN sightings that stand on sheets the reading does not list as
  truncated. The kind row's own header carries the row's share, published cells over borne cells,
  which is §4.3's "project-level heat" at the grain a reader scans by. Steps: 0 % → `--cov-0`, then
  1–25, 26–50, 51–75, 76–100. Nothing rounds up into "measured" (`heat.ts`, and the CoverageChip's own
  law).
- **I-211 — a mark is a glyph AND a pattern AND a colour, and the map is total.** §4.3 names seven
  marks; `MARK_OF` maps every reading a cell can hold onto exactly one of them, keyed by the union
  itself, so a reading with no mark is a compile error — the same totality `CAUSE_GLYPHS` and the act
  map already keep. The cell publishes `data-mark`, and the stylesheet reads that ONE attribute for
  the pattern and the colour; the module states no colour and the sheet computes no share. Published
  ● solid, partial ◐ dots, absent ○ hairline + danger, out of scope ⊘ cross, held ⊖ hatch, no class
  sighted ⋯ dotted hairline, catalogue-only ▫ plain.
- **I-212 — the certificate is a document, and a document is not the work surface.** The two boundary
  statements are law (L-QTY-07) and are never unmounted, but they are prose under a grid that must
  hold ≥ 55 % of main (§7 C1). So the section keeps its place beneath the tally, capped at 192 px with
  its own scroll, and the tool row carries the one control that shuts it — open by default, because a
  boundary statement nobody can see is a statement nobody reads. Rejected: a modal preview, which
  would put a certificate behind a door on the screen that exists to state it.
- **I-213 — an identifier on this screen is a chip, and an enum is a word.** The pinned revision, an
  act id and a sighting's source key are opaque values a person copies, never reads: each renders
  through `IdChip` (short on screen, whole in `data-value`, one press from the clipboard, R-UI-082),
  keeping this screen's own class for the picture mask. `REGISTER`, `PARTITION`, `LAYOUT`,
  `DECLARATION` and a rail's reason render through `EnumLabel`, which leaves the SCREAMING form inside
  `[data-technical]` for the engineer and the suite. The drawing id column is gone: a uuid that
  duplicates the sheet's own name earned no column (§6, §7 C6).
- **I-197 — coverage's copy is the coverage module's own.** `src/ui/strings/takeoff.ts` is another
  node's file and is not touched: every key here, the nav entry's included, lives in
  `src/modules/takeoff/coverage/copy.ts` and is read by the app layer, which may reach both. Rejected:
  appending to the register's string table.
- **I-297 — the cause is PROPOSED, never declared; the act judges the proposal, and only the act.**
  A cell reading `NOT_ESTABLISHED`, CELL-grain, addressable, undeclared and citable is put to the one
  model seam as the closed question `coverage-cause` (L-AI-01's one path, `MODEL_QUESTIONS`), which
  chooses among the two causes a PERSON may declare (`SCOPE_DECLARATION_CAUSES`) or the no-match
  outcome `NOTHING_TO_DECLARE`. Everything about which cell is asked, which key an answer may cite —
  the caption anchor embedded in the view key the cell was sighted at — and which causes an answer is
  read back out of is CODE's (L-AI-03): the model chooses one of two and cites what it was given.
  What comes back is a Proposal and stays one (L-AI-02). The inspector states it ABOVE the sightings
  table, in `EnumLabel` and in the register's own sentence for that cause — chosen by code from the
  chosen cause, never generated (I-191, R-SPINE-062) — and nothing is written until a person carries
  an act. Below `COVERAGE_CAUSE_CONFIDENCE_FLOOR` (`src/modules/takeoff/coverage/cause-proposal.ts`,
  the CALLER's policy, evaluated on the recorded corpus and never a number the seam routes on), and
  where the model answered the no-match, and where the seam refused, no proposal stands and the
  region is ABSENT rather than idle — which is this screen's escalation to the person, and which is
  why no copy key here says "nothing was proposed".
  Carrying `DECLARE_NOT_IN_PROJECT_SCOPE` or `HOLD_OUT_OF_BILL` with a proposal in hand writes the
  model call's outcome in the act's own transaction (L-ACT-01): CONFIRMED where the cause carried is
  the cause proposed, OVERRULED where it is the other. A person who declares unaided writes no
  outcome at all — `awaiting` on S-Audit's `coverage-cause` calibration line is the truth about a
  proposal nobody acted on — and nothing on this screen ever writes REPUDIATED or AFFIRMED, because
  there is no door that dismisses a proposal and no second reading that corroborates one, so a row
  for either would be a record nothing made.
  Rejected: a proposed cause painted into the grid's mark or into the cell's `data-code` — a boundary
  nobody drew is not a reading of the project, and the certificate would then be quoting a model
  (L-QTY-07, L-AI-03). Rejected: recording a disposition when the inspector is merely closed.
  Rejected: a test id of its own for the region — the registry is closed (§7) and the block is found
  by its heading and by the two attributes the existing `coverage-inspector` now carries.

**The craft look (session 7, 2026-09-23; R-UI-050, R-UI-080..086 — the later law).** Numbered
`I-cov-n` rather than from the global chain, because several craft implementers amended Decisions
that day. The look lowered states 5 → 3 and tokensAndGrid 5 → 3 on F-RCC6-BNBC's M3 campaign: pile-cap
concrete, excavation and blinding and column rebar GF–6F painted solid *Published* at the full ramp
although every one of their lines was kept PARTIAL_DECLARED with no quantity (the register showed
them blank and Levels at `0%` in the same run); the `pile_cap` band was clipped to `pile` beside a
`pile` band; both foundation columns stood under a blank level header; and the certificate ran
`piling.bored pile` together. Each ruling amends this Decision in place (§1, §3, §5 carry the text).

- **I-cov-1 — a published cell whose lines carry no quantity is PARTIAL, not measured (I-210
  amended; L-QTY-02, R-UI-050).** The residue reads a cell QUANTITY_BEARING when it has published
  lines at all (`src/core/residue/residue.ts`, `hasLines`), and I-210 turned that into a share of 1.
  A line kept PARTIAL_DECLARED bears no quantity, so the reading now carries the campaign's
  PARTIAL_DECLARED line ids (`CoverageView.declaredLineIds`, read off `quantity_lines` in the
  module's server), and the share a published cell is painted at is the share of ITS lines that bear
  one (`shareBorne`, `heat.ts`): a cell whose every line declared an omission is ramp step 0. A cell
  borne less than whole wears the **partial** mark (`data-mark="partial"`, the partial glyph, the
  key line's word), states `data-declared` (how many of its lines carry none) and says it in its
  `aria-label` and in the inspector — `takeoff_coverage_cell_label_declared` **{count} of its {total}
  lines carry no quantity: each names what the drawing did not state.** — while `data-measurement`
  and `data-code` still state the residue's own reading, untouched (nothing machine-read is
  re-labelled). The kind row's heat and the tally count such a cell as partial, not published.
  **What this screen cannot fix, owner named:** the certificate's measurement statement is the
  residue's (`measurementStatementOf`), and it still omits these cells as if measured; the preview
  prints what the certificate will print, so it is NOT amended here — the node that owns
  `src/core/residue` must count only COMPLETE lines as bearing quantity and enter a
  PARTIAL_DECLARED cell in the boundary with its omitted components (L-QTY-07), at which point this
  screen's `declaredLineIds` is redundant and retires.
- **I-cov-2 — a class band names its class, in words, in a band wide enough to name it (R-UI-082,
  R-UI-083).** The band says the class by the draft BOQ's own rule (`inWords`: `pile_cap` → `Pile
  cap`), its stored value on `data-class`, the text its own box so an ellipsis can reach it. The
  track list rides as `--cx-coverage-tracks` — each column `max(var(--row-h), calc((Nch + 2 ×
  --space-2) / span))`, N the name's length — so a one-level band widens its column to fit its name
  and a seven-level band stays square; `--cx-coverage-columns` remains the fallback. Still no pixel
  in the component (ARCH-01).
- **I-cov-3 — a column on no level of the stack says so.** A class sighted on no stack level (a
  foundation filed under the FOUNDATION slot; a placement no storey reads) was a blank level header;
  it now reads `takeoff_coverage_level_none` **No level**, in the header, the column's `aria-label`,
  the cell's label and the inspector's fact line. (The register says `Foundation` for the same lines
  because the register object carries the slot; the residue's sighting carries only a null level —
  the core owner above can carry the slot, and then this word gives way to it.)
- **I-cov-4 — a certificate row separates what it names.** kind · class · level, each a mono value
  with the fact line's `·` separator between them; a kind-grain row names neither class nor level, a
  level-less cell names `No level`; the values stay verbatim (the document's own words, I-25).
  **Amended by I-351:** the kind and the class are said in words, as the draft BOQ prints them; the
  level stays the stack's own label.
- **I-cov-5 — the screen names itself once, clipped.** One `<h1>` `takeoff_coverage_heading`
  **Coverage**, out of flow and clipped (`cx-coverage-title`, the register's `cx-register-title`).

- **I-336 — the relation says what a class lawfully holds, not what a rail publishes today (session 7,
  BEARS-1; L-MEA-04, R-TO-032, L-FRM-03/04, L-QTY-02/05, L-REG-07; migration 0060).** Ten rows join
  `bears` in one edit of `src/core/catalogue/bears.ts`: pile cap, footing and column × `rcc.formwork`;
  slab, shear wall and stair × `rcc.concrete` and `rcc.formwork`; slab × `pcc.blinding`. Read as the
  rebar leaf read `rcc.rebar` — a class bears what R-TO-032 forms or casts and L-FRM-03/04 states a
  figure for, whether or not a reader of it has landed. Six of the ten were already PUBLISHED: the slab
  area's rails measure a plate, a shear wall and a stair for both kinds while the relation denied them,
  so this grid drew no cell for a slab's concrete the register held lines for. The other four declare:
  until a rail lands, a sighted class's cell reads `NOT_ESTABLISHED` — the disclosure (L-QTY-05) — and
  nothing is billed; FND-3 lands the pile cap's and the footing's. The four WALL pairs F-RCC6-BNBC's
  golden states (concrete, formwork, rebar, excavation) wait for a WALL class: no row names a class the
  closed roster lacks. The rows are batched so the catalogue digest a campaign snapshots moves ONCE:
  every campaign opened before 0060 reads stale on `catalogue` once (freshness blocks signing only,
  never measuring), and a campaign opened after it snapshots the new relation. Cost: the grid of any
  project sighting a column gains a `rcc.formwork` row of `NOT_ESTABLISHED` cells until the column
  formwork rail lands, so J-022's three pictures and J-000's coverage tallies move by that row.
**The re-look (session 7, wave 3, 2026-09-23; R-UI-082, R-UI-083, R-SPINE-062).** A vision re-look of
the M3 campaign found the grid at the bar by score and not demo-ready: the kinds stood as raw keys
(`finish.paint`, `piling.bored`, `rcc.rebar`) in the row headers and the certificate while the
register, the bill and I-cov-2's class bands said the same kinds in words — two spellings of one fact
in one lane; the `No level` header over the one-level Pile band was cut on both sides (`Jo leve`);
the certificate printed "…so the residue holds no cell for it." four times to a client; and nine
28 px cells filled a third of a 1,344 px box. Its id is the central allocation's (I-351), because
the `I-cov-n` run belongs to the look above. It amends this Decision in place (§1, §3, §5 carry it).

- **I-351 — one kind, one spelling; every header read in full; no build word in a sentence; a cell
  as large as the box allows (I-25/I-cov-4 withdrawn for kinds and classes; R-UI-082, R-UI-083).**
  (a) *Kinds and classes in words, everywhere a reader meets them.* The row header says its kind
  through the shipped `EnumLabel`, its words by the draft BOQ's one rule (`kindWord` = `inWords`:
  `rcc.concrete` → `Concrete`, `piling.bored` → `Bored`), the key on the row's `data-kind` and inside
  the label's technical disclosure, in the UI face; the row header's and the cell's accessible names
  say the kind and the class in the same words (`Concrete on Pile cap, No level: …`); the inspector's
  fact line says the kind through `EnumLabel` and the class in words, the level still the stack's own
  label in mono; and the certificate's row says kind · class in words in the document's own face —
  a certificate is a document a client reads, and the draft BOQ, the other document, prints kinds and
  classes by the same rule — its keys on the row's `data-kind` and `data-class`, which is where
  J-022 reads them. I-25's "kinds verbatim in mono" is withdrawn for kinds and classes here as
  s-takeoff I-reg-2 withdrew it for the register; identifiers (act ids, source keys, report ids) still
  stand whole. (b) *Every header is measured.* `tracksOf` measured a column only by its class word
  over the band's span; it now takes each column's width as the largest of the cell (below), the
  class word shared over the span, and the column's OWN level header (`calc(Nch + 2 × --space-2)`),
  so `No level` over a one-level band is read whole; the level label rides its own box
  (`cx-coverage-level-name`) so an ellipsis can reach it should a face ever outrun its `ch`.
  (c) *The certificate says no build word.* NO_BEARER_SIGHTED's message was "…so the residue holds no
  cell for it." and CELL_NOT_IN_RESIDUE's "This campaign's residue holds no cell…" — §3's own voice
  rule bars "residue" wherever a reader can see, and the certificate prints the first to a client.
  The registry, the one home (R-SPINE-062), now says "…so no cell stands for it." and "This
  campaign's coverage holds no cell at that address…"; the grid, the inspector and the certificate
  follow it and no screen re-words it. The codes are unchanged. (d) *The cell grows with the box.*
  A column is `--cx-coverage-cell` at least: the box's share per column (`100cqi` of the grid, a
  query container, less the kind column, over `--cx-coverage-columns`) clamped between `--row-h`
  and `--row-h + --space-5` (48 px compact, 56 comfortable). The share is a length of the BOX, so
  every row resolves the same track list whatever its content; a small matrix reads at a glance, and
  a wide one keeps the 28 px cell and scrolls inside its box exactly as before. The cell's height,
  the mark's size (half the row) and the hatches are unchanged. Rejected: `1fr` tracks — each row is
  its own grid, and content-sized `fr` would let a header row and a body row resolve different
  columns; rejected: raising the row height — density is the root's (R-UI-005).

**Honest scope (session 8, HONEST-SCOPE — MEASURE-REFUSE, COV-ALL and C9a; walk-0 register-trace B11
and fresh-flow B03, both BLOCKS_DEMO).** Walk-0 found the grid and the certificate knowing only the
four classes F-RCC6-BNBC's partition placed — Beam, Column, Pile, Pile cap — while the set draws
sheets for grade beams and a slab on grade, slabs, a stair, a lift core, tanks and lintels; seventeen
absent cells and the certificate saying "nothing explains the absence"; the register's
Deferred-and-refused region empty; and, on a fresh unscaled upload, a measure run that answered
"Done 0 s" with nothing named. "Measure less, completely, and say so." Each ruling amends this
Decision in place (§1, §3, §5, §7 carry the text).

- **I-479 — the drawings DECLARE what they show, and a declaration is a sighting (L-QTY-05's
  second and third channels, read at the grain of a caption).** A view's caption and a schedule's
  title name the members the view is a drawing of: "GRADE BEAM LAYOUT & GF SLAB ON GRADE" is a
  drawing of tie beams and of a slab whether or not the partition placed a member off it. So the
  residue reads the pinned manifest's stored views (`partition_views`) and turns each caption into
  sightings of the classes it names (`src/core/residue/declared.ts`, `channels/declared.ts`) — by a
  CLOSED word table, first match per word, never a guess: BEAM (a GRADE, TIE or PLINTH beam is a tie
  beam), COLUMN, PILE (PILE CAP is a pile cap), FOOTING, SLAB, STAIR (a stair ROOF is no flight),
  LINTEL, a SHEAR, CORE, RETAINING or LIFT wall and a LIFT CORE, PIT or SHAFT (shear wall), BRICK
  wall and BRICKWORK (brick wall). A title block, a note or a legend talks ABOUT members and declares
  none; a mark ("PC1 SECTION") names a family, which the table does not read. A schedule's title is
  sighted through the partition's channel (its member-type families are read off it), every other
  caption through the layout's; both on no level, `declared: true`, read at the caption's own entity.
  On F-RCC6-BNBC this puts slab, stair, shear wall (the lift core), tie beam, lintel and footing (the
  ramp wall's F1) on the grid beside the four placed classes. A declaration is no evidence of why a
  placed member's cell went unmeasured, so it never enters I-297's question state (the recorded
  proposals keep their keys), and it is no placement, so it never enters the truncation question
  either: a schedule on a sheet read in full cannot turn a cell whose every placement stands on a
  sheet read in part from INGESTION_TRUNCATED into the fall-through. Rejected: a class inferred from a
  sheet number or a layer name — a guess dressed as a reading; rejected: a fourth channel — the law
  names three, and a caption IS the layout inventory's own statement of a view's membership.
- **I-480 — every unmeasured cell names WHY, beside its cause, and nothing says "nothing
  explains" (L-QTY-05, L-QTY-07, R-SPINE-062).** The cause stays the law's: a cell nothing was
  published for and no person declared is NOT_ESTABLISHED, the writerless fall-through, and a rail's
  report stays evidence, never a cause. Beside that cause the residue now reads a REASON
  (`ResidueCell.reason`, `src/core/residue/reasons.ts`), a registered code, asked in this order: the
  registered code the rails reported most for the cell (the views it names in their captions,
  `reasonViews`); `COVERAGE_CLASS_NOT_PLACED` where every sighting is a declaration;
  `COVERAGE_NOT_MEASURED_YET` where no run was carried over the campaign; `COVERAGE_MEMBERS_NOT_REACHED`
  where the run read this (class, kind) elsewhere and said nothing here; `COVERAGE_KIND_NOT_READ`
  where it read the pair nowhere (`src/core/errors/coverage.ts`). A report under a code the register
  does not hold stays evidence in the inspector and is never a reason. The cell's name, the inspector's
  cause sentence, its remedy and the certificate's row all say the REASON's registered words
  (`causeSentence`, `remedyEntry` in `grid.tsx`), the cause stays on `data-code`, and the reason rides
  on `data-reason`; a bill-statement row stands under the cause a person gave it and carries no
  reason. I-195 is amended for the one entry the fall-through's registered sentence contradicts: the
  "Not measured" key's meaning is this screen's own sentence (`_absent_meaning`). The residue's one
  absence clause now asks PER KIND — a column whose concrete published still owes its reinforcement
  cell the report that nobody read its schedule; asked by object alone the concrete line swallowed
  it. The registry's NOT_ESTABLISHED sentence is not re-worded (the draft BOQ's golden prints it by
  code); the draft's closing page is handed the REASON in its place wherever a row carries one
  (`boq/server.ts`, s-boq I-451's "the registry's own sentence" — now the reason's), so the draft no
  longer prints it either.
- **I-481 — a member the drawings show that no class measures is named, never dropped.** A
  water tank, a reservoir, a parapet, a sunshade, a ramp, a canopy (a second closed table of words
  the roster has no class for) is enumerated in the measurement statement by its word and the caption
  that shows it, under `COVERAGE_MEMBER_UNCLASSED` (`unclassedStatementOf`, carrying the code from
  core). It has no cell: no class bears a kind it could stand under.
- **I-482 — a level-less column says where its members stand (amends I-cov-3).** A column
  on no storey of the stack reads `Foundation` where its register rows stand in the lawful-null
  FOUNDATION slot (`Sighting.levelSlot`, the register channel's own column), `Not placed` where every
  sighting is a declaration (the `UNPLACED` reading, `src/core/residue/law.ts`), and `No level` only
  where neither holds — in the header, the cell's name, the inspector's fact line and the certificate.
- **I-483 — a partly published cell says what its lines left out, and enters the
  measurement boundary (pays I-cov-1's IOU in part).** The residue carries each published cell's
  PARTIAL_DECLARED lines as `partial` — how many lines, over how many members, the codes they left
  components out under with the variables named, most lines first (`partialOf`). The inspector and the
  cell's name say it in one sentence — "Declared partial: 23 beams, slab thickness unstated (t)." —
  where they said "Quantity is published for this cell" beside "23 of its 23 lines carry no
  quantity". The measurement statement gains its second enumeration, `partialStatementOf`: the cell or
  run of levels and the codes in words, never a count (L-QTY-07). The residue's axis still reads
  QUANTITY_BEARING (the law's arm order); the draft BOQ's not-measured page reads only the first
  enumeration until BOQ-SHAPE reads this one.
- **I-484 — every gap has one remedy and a door to where it is fixed; a run says what it
  deferred (MEASURE-REFUSE).** The remedy button goes to the sheet that shows a class nothing placed,
  flown to its caption (the Trace's `selectionAddress`, `Open the sheet`); to the drawings for a view
  with no scale of record (`Open the drawings`); to the rule set for a kind no class bears; and for
  everything else to the register NARROWED to the cell — `?class=&kind=&level=` (`registerCellHref`,
  the level as the register labels it: its label, or the FOUNDATION slot). The query has one spelling,
  `register-ui/narrowing.ts`, which the register reads back into its filter chips on mount beside
  `?line=`, so the chips a link narrowed stand chosen and clear as any other. The Sighted-in table folds behind one line — "23 sightings on
  S-13" — every row still in the DOM; "What the rails observed" is "What the measure run reported",
  one row per report with how many members it was said of, the kind and class in words and the view in
  its caption. A measure run names its deferrals BY NAME in its verdict step (`deferred`): each view
  its members were placed in that no affirmation names, grouped from the rails' own reports, and each
  storey its verticals (column, shear wall — L-MEA-09) stand on whose height stands at none
  (`runDeferralsOf`, `src/core/residue/deferrals.ts`, the levels law's `STOREY_HEIGHT_ABSENCE`). The
  register's Deferred-and-refused region leads with the same rows once a run has been carried
  (`reportedAbsencesOf` + `runDeferralsOf` in `register-ui/server.ts`), each under its registered code;
  the coverage cell of a member in an unscaled view reads VIEW_SCALE_UNAFFIRMED as its reason. A
  deferral row is no sighting and says so: it is keyed on what it is about (the view's address, the
  level's id — two views sharing a caption are two rows), labelled `View` or `Storey` rather than
  `Object`, and names the view by its WHOLE caption and the storey by its label as text — never
  through the id chip, whose seven-character face read `1ST FLOOR BEAM LAYOUT` and `1ST FLOOR SLAB
  REINFORCEMENT PLAN` alike as `1ST FLO`; a view no caption anchors reads its class in words and its
  sheet. Its door goes where the fix is made: a view's to the sheet it stands on, flown to its
  caption, where the scale panel affirms a scale (`Open the sheet`), or the drawings where the
  manifest names no sheet; a storey's to the level stack (`Open the levels`). The run's own verdict
  step carries the same `deferred` list, which no screen shows; the region is where a QS reads it.
  Applied from viewer.md's I-667 (session 9, SCALE-3): a member in the UNRESOLVED slot is
  reported `TYPICAL_RANGE_UNSTATED` against its view, so its cell reads that reason — never
  `SECTION_BAND_UNCOVERED` — and its door goes to the level stack (`Open the levels`,
  `takeoff_coverage_remedy_levels`), where the range of floors is authored; the run and the region
  name the view once, after the views with no scale.
- **I-485 — the grid leads with what the drawings carry (amends I-196, I-195).** Borne kinds
  first, in canonical order; the kind-grain rows — a kind no sighted class bears — at the FOOT, shown
  and never hidden. A position a column's class does not bear is KEYED: a faint dash
  (`.cx-coverage-void`, `data-mark="void"`, a `gridcell` with its own name and no test id, no tab stop,
  no selection) and an eighth key-line entry, `Not borne`, which is no reading of the law and carries no
  legend-entry test id. The absent mark reads `Not measured` on the key line and the tally. A row
  draws its positions in the order its columns stand (`positionsOf`) and a dash is pinned to the
  row's one line (`grid-row: 1`): a row is a grid on the sparse flow, where a dash drawn after the
  cells at a column left of them opened a second line and doubled the row.
- **C9a — the certificate reads flush and shows more rows (amends I-212's cap).** The statement list
  drops the user agent's list indent and margins; while the certificate is open the work surface
  sizes to its rows (`flex: 0 1 auto`) but never below the craft rubric's work-surface floor — the
  matrix at 55 % of main, the key line and the tally on top (AM-08) — and the certificate takes the
  height the grid does not use (`flex: 1 1 --cx-coverage-doc-h`, at least 192 where main has it);
  shut, the grid takes main back as it always did.

**F-ARCH's vocabulary (session 8, ARCH-2; migration 0062).** The grid's rows are the catalogue's
kinds and its columns the classes a campaign sights, so the vocabulary the architect's set is taken
off in lands here first: before any reader places a room or an opening, a QS sees which finishes the
product knows and that none is measured yet.

- **I-540 — the opening is a class, and it bears nothing until what it is billed as is ruled
  (L-MEA-02, L-MEA-04, R-TO-036, AM-14 §2).** `opening` joins `ELEMENT_TYPES`: a door, a window or a
  ventilator standing in a wall — what L-MEA-02's opening schedule schedules and what a face and a
  wall deduct. It is APPENDED after `surface`, never inserted: a draft numbers its groups in the
  roster's order, and an insertion would renumber every item behind it in every bill already
  drafted. It bears no kind yet and so stands in the derived unborne set; what a door or a window is
  billed as — its joinery, counted off the schedule — is a kind of its own, with its own bill row and
  taxonomy move, and lands with the rail that counts it. F-ARCH's OPENING_COUNT and OPENING_AREA
  golden rows have no product spelling until then. The class is also a word the kind law now refuses
  in a kind's name (`joinery.opening` offends the element vocabulary). Cost: nothing on this screen —
  no cell stands for an unborne class, and nothing places an opening yet.
- **I-541 — a surface bears three more finishes: flooring, tiling and skirting (AM-16(4), L-MEA-03,
  L-MEA-04, L-MEA-08, L-BD-01).** AM-16(4)'s Finishes bill names "floor and wall finishes; ceiling
  finishes" beside plaster and paint, and F-ARCH's golden carries FLOORING, WALL_TILE and SKIRTING
  rows. Three kinds join `KINDS`, appended after `rcc.rebar`: `finish.flooring` — the floor finish,
  whatever it is laid in (AREA, m², two places); `finish.tiling` — tile fixed to a wall's face, the dado
  of a kitchen or a toilet (AREA, m², two places); `finish.skirting` — the band at a wall's foot, run
  along the room (LENGTH, m, two places). Each names its trade and never spells `floor` or `wall` as a
  word of its own, for the reason the masonry kinds give. Each is borne by `surface` — a finish is
  borne by the face it is applied to — is ARCHITECTURAL (the room finish schedule states it) and is a
  `face` quantity: the skirting is the face's foot measured by its run, no member and no network. A
  ceiling finish is the plaster and the paint of a CEILING face and needs no kind of its own. The
  material (tile, mosaic, stone) selects the item, and no clause closes that set or bands it, so each
  kind carries the catalogue's one description and the closed description roster stays authored-only.
  The three reach Finishes through the taxonomy's standing `finish` division row: no row, no taxonomy
  version, no draft re-take. The relation says a surface lawfully CAN bear each; which face bears
  which, and to what height, is the room finish schedule's to state per face before anything is
  offered, and an extent nobody stated refuses rather than bills (L-QTY-04). None of the three has a
  rail yet, and the catalogue closes over them all the same: the rail roster is Partial on purpose —
  a kind with no rail is a kind nothing measures, never one measured by a default (L-MEA-08) — so the
  tests that held "every kind has a rail" now name these three as the kinds awaiting one, and the
  rail that lands for a kind takes it off that list. The floor finish and the tiling have their
  methods (I-542, I-543) and wait for the slice that measures room faces to offer them; the
  skirting has no method yet — its figure deducts opening WIDTHS, which no deduction channel
  carries. Until then a sighted surface's cell of any of the three reads `NOT_ESTABLISHED`, the
  disclosure. Cost: this grid
  gains three kind rows (Flooring, Tiling, Skirting) reading NO_BEARER_SIGHTED on a campaign that
  sights no surface — `NOT_ESTABLISHED` cells where one does — so J-022's three pictures move and the
  gate re-takes them; every campaign opened before 0062 reads stale on `catalogue` once (freshness
  blocks signing, never measuring); no item number of any drafted bill moves.
- **I-542 — a room's floor finish is the face algebra itself (L-MEA-01, L-MEA-02, L-MEA-03).**
  `finish.surface.flooring@1` is `faceMethodOf` over `A = gross − openings`, measuring
  `finish.flooring`, in a file of its own (`methods/masonry-finishes/flooring.ts`): `gross` is the
  room's clear outline, and `openings` is what the edition's `finishOpeningDeductionMinM2` deducts,
  strictly greater, of the candidates on the finish channel — the column pieces standing in the room
  (F-ARCH's A-14 applies L-MEA-02's rule to obstructions) and anything cut through the slab — the
  retained ones listed on the line. `face.ts` is imported, never edited, so L-MEA-03's sentence keeps
  one home.
- **I-543 — a room's walls are measured run by run, one run to one soffit: plaster and paint
  `A = P × (H − f) − openings`, the tiled dado `A = P × h − openings` (L-MEA-01, L-MEA-03, L-MEA-06,
  L-MEA-08, L-QTY-04).** A band of a room's walls has no outline a rail could hand over: its gross is
  a run of the room's clear outline carried up the band, and a rail computes nothing — no product and
  no difference lands in a binding. So both are the METHOD's: `methods/masonry-finishes/wall-face.ts`
  states two trees and three pairs over them — `finish.wall_face.plaster@1` and
  `finish.wall_face.paint@1` over `A = P × (H − f) − openings`, `finish.wall_face.tiling@1` over
  `A = P × h − openings` — three pairs because the gate refuses a method whose kind is not the offer's
  (`OFFER_NOT_TO_CONTRACT`), so one method cannot measure three kinds. `openings` and `threshold` are
  AREAS on the finish channel, the threshold bound and never in a tree. The readings come from three
  places, and the tree does the arithmetic between them, as `rcc.beam.concrete`'s `D − t` does:
  - `P` is the length of ONE RUN of the room's boundary — the part that stands under one soffit —
    MEASURED off the room's clear outline.
  - `H` is that run's clear height, FFL to the soffit of the slab over the room at that edge: L-MEA-06's
    fact of the STRUCTURE, which F-ARCH's A-18 reads edge by edge, splitting an edge where the panel
    over it changes. F-ARCH's section A-04 prints it by zone (the storey less the 125 slab, and notes for
    the 150 thick panels and the sunken toilet panels), and the storey less the panel cross-checks it
    (L-MEA-07). The room finish schedule states NO ceiling height: `H` is never the schedule's.
  - `f` is where the plastered band starts — the top of the skirting (4") or of the dado (5'-0" in a
    kitchen, 7'-0" in a toilet) — and `h`, the dado's own height, is the tiling's band. Both are the room
    finish schedule's.

  `P × (H − f)` holds only over a run under one soffit, and a room's boundary can stand under two.
  Path 1 of F-ARCH's golden (`fixtures/gen/arch/golden.py`, `_edges_with_heights`) finds 16 of its 101
  measured rooms under two clear heights: the LOBBY, E-KITCHEN and W-KITCHEN of 1F to 5F (2898 mm under
  the 150 thick panels, 2923 mm elsewhere) and GF-LOBBY (3202.8 and 3227.8 mm). One `H` per room
  cannot reproduce those rows. The higher over-measures plaster and paint by 0.25–0.52 m² a room, which
  is over-measurement, a hard block (L-QTY-04). The lower under-measures by 0.11–0.14 m². The line key
  admits one line per object and kind (`quantity_lines_one_per_object_kind`), so the run is the
  REGISTER's and the offer's grain, not the method's, and it is owed before any wall band is offered.
  ARCH-5, which registers a room's WALLS surface, and ARCH-78, which binds `P`, `H` and `f`, choose one
  of two ways:
  - register WALLS per (room, soffit) run, so each offer carries one `H` and the room's lines sum to the
    golden exactly — the reading this Decision recommends;
  - or keep one WALLS per room, bind the LOWEST clear height along its boundary and declare the
    shortfall on the line (L-QTY-02).

  Never the highest. `tests/takeoff/rails/masonry-finishes/wall-face-runs.test.ts` holds the recommended
  reading against the golden for 1F LOBBY and 1F E-KITCHEN: two runs sum to the plaster and paint rows,
  either single `H` misses them on its side, and the tiling closes over the whole boundary and over its
  runs alike, because the dado stands below every soffit. The trees stand for either choice, so the
  wave's edition can mint the three pairs without freezing a grain. A reading that takes the height
  from the finish schedule's "ceiling height" does not hold for F-ARCH: the schedule has none.

  `face.ts` is not edited: it is hashed into `finish.surface.plaster@1` and `paint@1`, and an edit to it
  would be a new version of both. Rejected: building the wall face on `faceMethodOf` and overriding its
  tree — a method that is not what `faceMethodOf` says it makes. Rejected: one tree `A = P × h −
  openings` for all three with `h` the band's height — for a plaster and a paint that `h` is `H − f`, a
  difference of a structural fact and a schedule value that no drawing writes, and a rail would have to
  compute it. The gate judges the threshold per candidate; F-ARCH's A-18 judges an opening by its WHOLE
  area and deducts only its overlap with the band, so the rail that offers a band owes the gate
  candidates that carry both, or a refusal. The four pairs stand in the shard and the registry and are
  cited by no edition until the wave's edition is minted; until then no pinned project measures by them.
- **I-556 — a sighting is the Trace to the place it names (pays §8's sighting IOU; evidence-link
  I-554, I-555).** A reader who opens "Sighted in" is asking where the drawings show this class,
  and the row's key was a chip they could copy and nowhere they could go. Ruling: each Sighting's
  `Read at` cell is an `EvidenceLink` with no basis (a sighting names an entity, not a figure) to the
  viewer at the sheet the row names (`selectionAddress`, no `line`), selecting what the key names ON
  that sheet — a placed member's outline and mark, a declaration's caption. The resolution is the
  server's, not the browser's: `coverageViewOf` reads the record each sighted drawing of the pinned
  revision was read on, once, and answers `sightingSelections` (drawing → key → the entities to
  select) through the Trace's one reading of a named entity (`entitySelectionOf`). A placement key is
  never put in the address, because the viewer's selection holds source keys only and would land on
  "not on this sheet". A sighting whose key resolves to nothing standing on its sheet — a sheet the
  pinned record does not hold, a view key, a placement no stored placement names — keeps the IdChip
  and offers no link (I-181: a link that cannot land is not offered). A declaration by a person
  (channel `DECLARATION`) is an act and stands on no sheet; its act id stays an IdChip. Cost: one
  read of each sighted drawing's artifact per page load, the register's own price (R-TO-050).

**The sheet a sighting stands on (session 9, RES-1; L-QTY-05, L-REG-04, L-CAD-05).** A read-back of
F-RCC6-BNBC's campaign found the inspector's View column saying `rcc6-bnbc.dxf` for every sighting —
the name the pin records the DRAWING under, taken per drawing from the manifest — so a column on S-10
and a pile on S-04 read as standing on one "sheet", which was a file; and the layout channel sighted
nothing at all: none of the stored placements met the view it was read in. Two Interpretations rule
the repair; they amend what §1's "the view verbatim" holds.

- **I-548 — a sighting names the sheet its KEY stands on, as the Trace reads it.** The manifest
  names drawings, and one drawing holds many sheets (F-RCC6-BNBC's one file carries S-00 to S-26), so
  the sheet is read per key: by the key grammar (`viewRefOf`) and core's one resolver
  (`traceCitations`, viewer.md I-421), over the record the campaign's pinned revision measured
  (viewer.md I-422). That record's reading now lives in core (`src/core/sheets/pinned.ts`) and the
  Trace, the bill's grid references and Ask ask it through the Trace's door as before, while the
  residue asks it directly, so one key is never answered two sheets. A placement sighting —
  PARTITION, and a REGISTER row the partition placed — stands where its member's Trace opens: a column
  on S-10, a pile on S-04, a cap on S-06, the beams on S-13, S-14 and S-15. A LAYOUT sighting stands
  where its view's caption does, and so does a caption's own declaration (I-479), read at its anchor.
  The register's deferred-and-refused region opens a deferred view on the same reading (I-484). The
  View column and the cause question's `layout` say the layout's own name, as the artifact spells it
  (`S-10 COLUMN LAYOUT PLAN`); model space is named `model`, as the artifact spells it. A drawing
  whose pinned bytes nobody read names no sheet, and its cell stays empty rather than showing the
  file's name (I-181); a deferral about a view on such a drawing is named by its caption and opened
  nowhere. Rejected: the manifest's name, which is a file and not a sheet. Rejected: a caption-text
  reading of the sheet, which fails the beam views captioned in model space (I-421). Cost: a residue
  reading opens each pinned drawing's artifact through the artifact door, as the Trace does; the door
  keeps four graphs, so a manifest of more than four drawings re-validates artifacts on every reading
  (BNBC's validates in well under a second). Owed by the residue's next leaf: read the records only of
  drawings that carry a sighting, or keep the standing by artifact. The heat reckons a truncated cell
  by DRAWING, as the residue attributes one (`heat.ts` `sharePublished`): matched by name, a sheet a
  sighting names and the file a truncated sheet is still named by never meet, and a cell read in part
  would paint as whole.
- **I-549 — the layout channel meets a placement's view at the view's address.** A view is
  stored under the partition's own key (`LAYOUT_PLAN:DXF_HANDLE:20B6`, L-CAD-06), and a placement names
  its view by L-REG-04's address (`v:LAYOUT_PLAN:DXF_HANDLE:20B6`). The channel compared the two
  strings, and they never matched. It now asks each stored view's address of `viewAddressOf`
  (`src/core/views`), core's one home of what a placement, a register row and an offer name a stored
  view by, which measure/setup and the levels screen already ask. A member stands in the view of its
  own record whose address it names: every one of F-RCC6-BNBC's stored placements. A LAYOUT sighting
  cites the view by that address, which the Trace and the cause question both read (`viewRefOf`). The
  channel holds no rule of its own about which views can hold members: a view no caption anchors is
  addressed by the partition's own name for it, which no placement names today (placements are read
  only in anchored views, L-CAD-07), so it holds nobody. Cost: every cell of a class a plan places now
  lists the view's LAYOUT sighting beside the partition's and the register's, one row more in the
  inspector. Not changed here: which sheets were read only in part (`truncatedSheetsOf`) is still read
  by matching the manifest's file name against a space's name, so `INGESTION_TRUNCATED` cannot yet
  fire on an uploaded drawing. Owner: the residue's next leaf, which keeps the heat's by-drawing
  reckoning (above) or changes it in the same commit.
- **I-613 — a beam a plan draws and no mark names is named on the measurement boundary, never
  counted (session 9, FRM4-AD; L-QTY-04, L-QTY-05, L-QTY-07, L-CAD-03, I-481).** The placement
  stage reads a beam off a pair of edge lines and names it by a mark. A pair it cannot name was
  dropped in silence, so a QS read a quantity-bearing beam cell and never learned that the plans drew
  more beams than it holds. L-QTY-04 answers "known scope, not measured" with a declared exclusion,
  and L-QTY-07 prints enumerations, never cardinalities. So:
  (a) the stage enumerates every pair drawn at a width a framed family's schedule states (I-344's one
  filter, `atAStatedWidth`) that no mark names — its own, a chain's (s-schedules I-612) or another
  plan's at the same grid reference. It skips pairs drawn on a layer the drawing's layer table freezes
  or turns off: those are on no sheet a reader reads (I-417), and F-RCC6-BNBC keeps its superseded
  scheme on a frozen layer;
  (b) they are stored with the partition, rebuilt with it in its one transaction
  (`placement_unnamed_pairs`, migration 0068, row-level security and the partition's grants), keyed by
  plan and edge line;
  (c) the residue reads them for the record the pin measured (`channels/unnamed-pairs.ts`), each
  with its plan's caption and the sheet that plan stands on. They are not a fourth sighting channel:
  a pair names no class, because the stage cannot say whose width it is drawn at, so it has no cell,
  like I-481's unclassed members;
  (d) the measurement statement enumerates them fourth, after the unclassed members
  (`unnamedStatementOf`), under the registered `FRAMED_PAIR_UNNAMED`, in the certificate's order
  (sheet, caption, grid reference, edge line). The statement prints each row whatever the beam cells
  read, because a cell the class's other members made quantity-bearing says nothing of these. Each
  row reads `Beam drawn, not named` · the plan's caption · `Grid A/3`, then the registry's sentence,
  and carries its first edge line (`data-source`). A statement with one stands no "none".
  - **On F-RCC6-BNBC** (the stages, `runs-sides-and-chains.test.ts`): S-08's grade-beam layout leaves
    its four slanted spans, GB4 across the chamfer and GB5 to the ramp (it left all 47 before
    s-schedules I-673 named its marks); S-14 leaves EB1d and EB2a/b, which are slanted (FRM4-E);
    S-13 leaves 1EB1d, 1EB2a/b, PB4/PB5 (slanted) and TG1 (contested, I-460); S-15's roof leaves
    REB2a/b — 15 rows where walk-2 read 58. **On F-RCC6**: none, because the chain names the 28 interior
    tie beams.
- **I-675 — each unnamed pair's row is a door to where it is drawn (session 9, GB-READ; I-613,
  I-556, I-181).** Walk-2 read the rows as one sentence repeated, with no way to see the beam a row
  meant: two pairs at one grid reference (`A/3`, `A/3`) read as a duplicate. Each row now ends, after
  its grid reference, with **Show on {sheet}**: the viewer at the sheet its plan stands on with the
  pair's two edge lines selected (`unnamedPairAddress`, over the Trace's `selectionAddress`). The
  pair's keys are the drawing's own entities, so no server resolution stands between them and the
  selection, as a sighting's key needs. A pair whose plan names no sheet keeps its row with no link,
  because a link to a sheet that cannot hold it would land on *not on this sheet* (I-181). The link
  wears the link ink (`--ink-link`, underlined), in the row's mono value face.
  - **Not done here, owed.** L-QTY-04 also asks for a queue item. `queue_items` is keyed per campaign
    and per register object, and only the gate writes it; an unnamed pair has neither a register
    object nor a campaign, so no row is written. The enumeration is the exclusion a QS reads. A queue
    row per pair needs the register to hold a drawn-but-unnamed object, and is owned by the register
    slice that gives an unnamed pair a key (M4P-6's area). The certificate document (M7) prints what
    `certificatePreviewOf` hands it and will print these rows when it renders the preview's
    enumerations.

**A run's report stands until a later run answers it (session 9, RES-OBS; L-QTY-05, L-ACT-01,
L-MEA-05).** Walk-1 N1: on a fresh upload of F-RCC6-BNBC's DWG, Measure deferred five views for want
of a scale; the QS affirmed S-10's COLUMN LAYOUT PLAN at Dimension ratio and measured again, and the
register's deferred-and-refused region still named the view, after a reload too. The affirmation and
the run were sound: the second run read the view at its affirmed scale and answered its columns with
another reason (a project with no level stack has no band of the column schedule to size a column on
no level by, `SECTION_BAND_UNCOVERED`). The fault was the reading. `rail_observations` is append-only
per campaign — a report is written once, under the natural key of what it says — and
`observationsOf` read every report the campaign ever held, so the first run's "nobody has affirmed
the scale" outlived the act that ended it (`tests/takeoff/coverage/residue-latest-run.test.ts`).

- **I-615 — a report is read as its question's latest answer.** The question a rail's report
  answers is the (class, kind, object) it speaks to — the (class, kind, view) where it names no
  object — and the answer is its code. The gate writes a run's reports in one transaction, so they
  carry one instant; a later run that answered the same question with another code wrote a row of its
  own at a later instant, and the earlier row is then history, not evidence. `observationsOf` keeps,
  per question, only the rows at the question's latest instant (a window over the campaign's reports,
  `src/core/residue/residue.ts`), so the residue's cells, the certificate, the register's
  deferred-and-refused region (`reportedAbsencesOf` + `runDeferralsOf`) and the BOQ's closing page all
  read the latest run. A question the later run answered with a line was already retired (I-480's
  own-kind clause); a question it did not speak to at all — a member no longer handed to that rail —
  keeps its last answer, because nothing answered it otherwise. The table stays append-only: nothing
  is updated or deleted, the first run's words are kept, and the reader chooses. Rejected: updating
  or deleting the retired rows (L-ACT-01, and the append-only trigger refuses it). Rejected: reading
  only the campaign's latest run as a whole, which would forget every report a narrowed roster did not
  repeat. Cost and limit: a report re-stated word for word by a later run collides with its own
  natural key and keeps its first instant, so the reading cannot tell a run that said A, then B, then A
  again from one that said A then B — it reads B — and a question answered with two codes at once,
  then with one of them alone, keeps both. Neither arises from a scale affirmation, which only ever
  moves a view to a calibration; a run identity on the report (a gate change and a migration) is what
  closes both, and is owed to the residue's next leaf.

## 1. Layout and hierarchy

**Nav.** `takeoff/layout.tsx` gains a second `next/link`, `<a data-testid="takeoff-nav-coverage">`
`takeoff_nav_coverage`, after `takeoff-nav-register`; every attribute of the entry — height, padding,
type, `aria-current="page"`, the 2 px `--beam-500` underline — is the register entry's, unchanged
(s-takeoff §1). This pays that Decision's §8 IOU.

The page renders in `shell-main` as `<div class="cx-coverage" data-testid="coverage-screen"
data-state={…} data-density={…} data-campaign={campaignId}>`, column flex, `gap: var(--space-2)`,
`height: 100%` — the screen fills main and hands what is left to the grid (§7 C1). There is no `<h1>`
and no caption: the breadcrumb names the page (§3.2, §7 C3) and a heading with a sentence under it is
the composition §1 refuses. The two px literals this screen states are held as custom properties on
this root: the kind column's 200 and the certificate's 192.

**Tool row (the frame's 32 px slot, I-209)** — `ShellToolbar` labelled `takeoff_coverage_tools_label`,
holding `takeoff_coverage_revision_label` beside the `setRevisionId` as an `IdChip` (class
`cx-coverage-revision`, §7's mask), and one core secondary Button, `takeoff_coverage_certificate_hide`
/ `_show`, which shuts and opens the certificate (I-212). Controls in the row are `calc(var(--toolbar-h)
- var(--space-1))` = 28 px, the frame's own arithmetic.

**Answer slot** — `<div data-testid="coverage-answer" aria-live="polite">`, empty until a door is
refused, then exactly one RefusalState and no chrome around it (R-UI-020); `:empty` collapses it.

**Work surface** — `<section class="cx-coverage-work" aria-label={takeoff_coverage_grid_label}>`,
column flex, `flex: 1`, holding the key line, the matrix and the tally. The section is labelled rather
than headed: a heading that exists only to be an `aria-labelledby` target is a heading nobody wanted
to read.

**The key line (I-195)** — `<div data-testid="coverage-legend" role="list">`, one row `var(--row-h)`
high on `--surface-panel`, seven `<span data-testid="coverage-legend-entry" data-code data-mark
data-meaning role="listitem" tabindex="0">`, each the mark at `--icon-md` beside its word, wrapped in
the shipped `Tooltip` whose content is the registry's sentence (the Not measured entry's the screen's
own, I-480). The mark is coloured exactly as the grid colours the cell that wears it. An
eighth entry keys the position no class bears — `<span class="cx-coverage-legend-entry
cx-coverage-legend-void" data-mark="void" data-meaning role="listitem" tabindex="0">`, its dash and
`_mark_void`, no legend-entry test id because it is no reading of the law (I-485).

**The matrix** — `<div data-testid="coverage-grid" role="grid" aria-label aria-colcount aria-rowcount
data-density>`, `flex: 1`, `overflow: auto`, hairline, radius 4. It is the ONE scroll container: the
box scrolls both ways and the page never does (§7 C10). The box is an inline-size query container
(`container-type: inline-size`, I-351). Every row is
`grid-template-columns: var(--cx-coverage-kind-w) var(--cx-coverage-tracks, repeat(var(--cx-coverage-columns), var(--cx-coverage-cell)))`,
`width: max-content`, `min-width: 100%`, where `--cx-coverage-cell` is `clamp(var(--row-h), calc((100cqi
- var(--cx-coverage-kind-w)) / var(--cx-coverage-columns)), calc(var(--row-h) + var(--space-5)))` —
the box's share per column, never under the row height and never over 48 px compact (I-351). The track
list (I-cov-2, I-351: each column the largest of the cell, its class word over the band's span, and
its own level header) and the column count are the only things the component states and they ride as
custom properties, so the stylesheet keeps every measure (ARCH-01).

- Two sticky header rows in one `role="rowgroup"` pinned `top: 0`: the class band
  (`role="columnheader"`, the class in words, spanning its levels, wide enough to name it — I-cov-2)
  over the level row (the level's `label` verbatim, or `No level` where the column stands on none —
  I-cov-3, mono 12, centred, in its own `cx-coverage-level-name` box in a column sized to read it —
  I-351 — `aria-label` = `takeoff_coverage_column_label` so a reader who
  hears one column hears both axes). The corner cell is `takeoff_coverage_kind_column`, sticky on both.
- One `<div data-testid="coverage-kind-row" role="row" data-kind>` per kind — the borne kinds in
  `compareCanonical` order, then the kind-grain rows (I-196 as amended by I-485) — opening with a sticky
  `role="rowheader"` kind cell in the UI face: a 4 px ramp bar (`data-cov`, I-210) beside the kind in
  words through the shipped `EnumLabel` (`Concrete`, the key in its disclosure and on `data-kind` —
  I-351), ellipsised, `aria-label` the kind in the same words and the row's share measured. The name
  is text on the panel and is never tinted: text keeps its contrast (R-UI-002).
- Each cell is `<div data-testid="coverage-cell" role="gridcell" class="cx-coverage-cell cx-reticle"
  data-kind data-class data-level data-grain data-measurement data-bill data-contradicted data-code
  data-mark data-cov tabindex={active ? 0 : -1} aria-selected aria-label>`, `var(--row-h)` high and its
  column's width — `var(--row-h)` square where the matrix is wide, up to 48 px wide where it has room (I-351),
  seamed by hairlines, filled from the ramp by `data-cov` and patterned by `data-mark` on its own
  `::after` (I-211). A kind-grain row's one cell spans `2 / -1`. The centred glyph is the measurement
  reading at half the cell; when the cell is held out of the bill a second glyph stands at a quarter
  of the cell in the lower-right corner (I-189). `data-contradicted="true"` draws a 1 px inset danger
  edge, which the aria-label and the inspector also state in words. Selection is a 2 px inset
  `--line-accent`; hover a 1 px inset `--accent`; focus is `cx-reticle`, from its one home (I-190).
  The cell's `aria-label` names a NOT_ESTABLISHED cell by its reason's registered words and a partly
  published cell by what its lines left out (I-480/e).
- A position a column's class does not bear is `<div class="cx-coverage-void" role="gridcell"
  data-mark="void" aria-label>` — a faint centred dash, the cell's hairlines, `_cell_label_void` as its
  name, no test id, no tab stop and no selection (I-485).

The glyphs are unchanged and still drawn geometry, never font characters, from one total map over the
reading union — a reading without a mark is a compile error — on a 16 px viewBox, 1.5 px stroke,
`currentColor`:

| reading | mark | §4.3 mark | pattern | colour |
|---|---|---|---|---|
| QUANTITY_BEARING | filled disc, r 4 | published ● | `--pattern-solid` | `--cov-4` fill, inverse ink |
| INGESTION_TRUNCATED | open ring with a 90° gap at the upper right | partial ◐ | `--pattern-dots` | the ramp step of its own share (I-210) |
| NOT_ESTABLISHED | open ring, r 4 | absent ○ | `--pattern-none` + hairline | `--state-danger` |
| NOT_IN_PROJECT_SCOPE | open ring struck by a diagonal bar | declared out of scope ⊘ | `--pattern-cross` | `--ink-disabled` |
| NOT_IN_THIS_BILL | open ring crossed by a horizontal bar | held ⊖ | `--pattern-hatch` | `--state-warn` |
| NO_BEARER_SIGHTED | open ring, dashed 2/2 | no class sighted ⋯ | `--pattern-none`, dotted hairline | `--ink-disabled` |
| KIND_NOT_YET_SEEDED | three dots in a row | catalogue-only ▫ | `--pattern-none`, no edge | `--ink-disabled` |

Keyboard (R-UI-032): the grid takes one tab stop on the active cell; arrows move focus, Home/End to
the row's ends, Enter or Space selects — arrowing never fills the inspector, because selection that
follows focus rewrites the address on every keystroke. No tooltip on a cell: the mark's words are in
the key line and the inspector, and a tooltip would be a third home.

**The tally (§3.5's footer)** — `<div class="cx-coverage-tally">`, one row `var(--row-h)` high, mono
12: `takeoff_coverage_footer_cells` then one `takeoff_coverage_footer_tally` per mark that stands in
this reading, in the marks' own order, with the marks nothing wears left out — a footer printing
"0 held" would say something about a boundary nobody moved.

**Inspector (the frame's ONE right column, I-209)** — `<aside data-testid="coverage-inspector"
data-cell="{kind}:{class}:{levelId}" data-kind data-class data-level data-proposed-cause
data-proposed-call>` (the last two empty where nothing was proposed, I-297), mounted through `useInspector`
and rendered ONLY while a cell is selected, so with no selection the column is absent at width 0
(R-UI-080, §7 C3). In order: one fact line, kind · class · level — the kind through `EnumLabel` and
the class in words, in the UI face, the level the stack's label in mono (I-351) (a kind-grain row
reads `takeoff_coverage_kind_grain_label` in place of class and level); `<h3>`
`takeoff_coverage_cause_heading` over `<p data-testid="coverage-inspector-cause" data-code data-cause
data-reason data-act>` — the mark and its word, then the registered message (I-191): the REASON's
beside a NOT_ESTABLISHED cause (`data-reason`, I-480), and on a partly published cell the
`_partial_all` / `_partial_some` sentence of what its lines left out (I-483); where the
reason names views, `<p class="cx-coverage-reason-views">` — `_reason_views_label` and each caption
verbatim in mono; the act as an `IdChip` under
`takeoff_coverage_declared_label` where a declaration is in force (I-213); `<div
data-testid="coverage-inspector-remedy">`, the registered remedy as ONE sentence and ONE button (the
reason's remedy, else the first omission's, else the cause's; a cell measured whole has none and its
button opens its lines) — `takeoff_coverage_remedy_ruleset` to the rule set for `KIND_NOT_YET_SEEDED`,
`_remedy_sheet` to the sheet that shows a class nothing placed, flown to its caption, `_remedy_drawings`
to the drawings for a view with no scale of record, `_empty_campaign_action` to the register narrowed
to the cell (`?class=&kind=&level=`) for every other cause, so a refusal always carries a remedy AND a
link (R-UI-020, I-484);
`takeoff_coverage_contradicted_note` on a contradicted cell (I-192). Then, and ONLY where a boundary
was proposed for this cell (I-297), `<section class="cx-coverage-proposal">` labelled
`takeoff_coverage_proposed_heading` — that heading as `<h3>`, the proposed cause through `EnumLabel`,
`takeoff_coverage_proposed_note`, then `takeoff_coverage_proposed_sentence_label` over the
REGISTERED message of that cause (`REFUSALS[cause].message`, I-191), and one core secondary Button
`takeoff_coverage_proposed_carry` which opens the shipped ConsequenceDialog at the door the proposed
cause names — `HOLD_OUT_OF_BILL` for `NOT_IN_THIS_BILL`, `DECLARE_NOT_IN_PROJECT_SCOPE` for
`NOT_IN_PROJECT_SCOPE` — through the same `setDoor` path the two foot buttons use, and carries the
proposal into the act so the act can judge it. With no proposal the section is ABSENT: no heading, no
sentence, no button. Then `<h3>`
`takeoff_coverage_sightings_heading` over `<details class="cx-coverage-sightings-fold">`, shut, whose
`<summary>` is `_sightings_summary_one|other` — how many, on which sheets (I-484) — over a
compact table — header row `_channel_label` / `_view_label`
/ `_source_label`, then one `<tr data-testid="coverage-inspector-sighting" data-channel data-source>`
per Sighting: the channel as an `EnumLabel`, the view verbatim, the source key as the Trace to it
(`EvidenceLink`, no basis, I-556) — an `IdChip` (class `cx-coverage-source-key`) where the key
resolves to nothing on its sheet — with each in-force declaration standing in the same table under channel
`DECLARATION`, its act as an `IdChip` (class `cx-coverage-act-id`); or
`takeoff_coverage_sightings_none`. Rows are `var(--row-h)`, nothing wraps, everything ellipsises (§5).
Then `<h3>` `takeoff_coverage_observations_heading` and one `<div
data-testid="coverage-inspector-observation" data-rail data-reason data-count>` per report said — the
rail's kind and class in words, the reason's sentence as prose, the view it names in its caption, and
`_observation_count` where it was said of more than one member (I-484; the reason is a
sentence, so I-213's EnumLabel no longer carries it) — or `takeoff_coverage_observations_none`. Foot
(I-194): core secondary Buttons `<button data-testid="coverage-hold-out">` and `<button
data-testid="coverage-declare-out-of-scope">`, each opening the shipped ConsequenceDialog at `actType`
`HOLD_OUT_OF_BILL` / `DECLARE_NOT_IN_PROJECT_SCOPE`, `container` the screen root (I-167). Neither
commits anything itself. There is no idle panel and no idle sentence: an absent column says it.

**Certificate preview (I-212)** — `<section data-testid="coverage-certificate-preview" data-open>`
beneath the tally, at least 192 px and, while open, every height the grid does not use (C9a), with its
own scroll, `display: none` when shut: `<h2>`
`takeoff_coverage_certificate_heading`, then exactly two `<section data-testid="coverage-statement"
data-axis>` in this order and never merged — `MEASUREMENT` then `BILL`, each with its own title and
never a shared cause column (L-QTY-07). Each holds a `<ul>` of `<li
data-testid="coverage-statement-row" data-kind data-class data-level data-levels data-code>` in
`compareCanonical` order over (kind, class, level): the kind and the class in words in the document's
own face (`Bored · Pile`, I-351 — the keys stay on `data-kind` / `data-class`) and the level the
stack's own label in mono, separated by `·` and a level-less cell's level said as `No level`
(I-cov-4; `Foundation` or `Not placed` where it stands so, I-482), then the registered
message as prose — the REASON's where the row carries one beside the fall-through, with the views it
names after `_reason_views_label` (`data-reason` on the row, I-480) — on one `var(--row-h)`
line that never wraps. The MEASUREMENT statement's list then holds its two further enumerations, found
by class (the id contract stays closed): `<li class="cx-coverage-statement-row
cx-coverage-statement-partial" data-kind data-class data-level data-levels data-omitted>` per cell
or run published only in part — `_statement_partial_label` and the omitted codes in words
(I-483) — and `<li class="cx-coverage-statement-row cx-coverage-statement-unclassed"
data-word data-code>` per member no class measures — its word, its caption verbatim in mono, and
`COVERAGE_MEMBER_UNCLASSED`'s message (I-481). A statement is empty only where all of its
enumerations are, and then renders
`<p data-testid="coverage-statement-none" data-code="NONE">` with its own sentence. The statements
print in `var(--font-doc)` at `var(--text-13)` on `--surface-panel` inside a hairline border — this is
document text previewed as document text. No count appears anywhere in this section (L-QTY-07),
asserted as an absence. The two hints it used to carry are gone: §6 allows one helper line in main and
this screen spends it on none.

## 2. States (R-UI-050), ruled cell by cell

Declared in `takeoff/coverage/states.ts` (`COVERAGE_STATES`) and appended to
`src/ui/screen-states/matrix.tsx` under `/t/[tenant]/p/[project]/takeoff/coverage`.
`coverage-screen[data-state]` derives in this order, first holding wins: `loading` · `denied` ·
`offline` · `error` · `refused` · `empty` · `partial` · `ready`.

- **Loading** — `loading.tsx`, frame and nav intact, core Skeletons keeping the layout, never a
  spinner: one bone `var(--row-h)` high for the key line, one filling the work surface for the matrix,
  one `var(--row-h)` for the tally and one `var(--cx-coverage-doc-h)` for the preview. The bones are
  the regions, so the screen does not jump when the reading lands.
- **Empty** — the shipped `EmptyState` (glyph, title, one sentence, one primary) carrying
  `data-testid="coverage-empty"` in the work surface's place, two truths, each saying why. No campaign
  pinned: `takeoff_coverage_empty_heading` / `_body` and one action, a core secondary Button worn as a
  link to `…/drawings/sets`, `_empty_action`. A campaign that has sighted nothing:
  `_empty_campaign_heading` / `_body` and one action to the register, `_empty_campaign_action`.
- **Error** — the shipped `ErrorState`, also under `data-testid="coverage-empty"` (the two never stand
  at once): `takeoff_coverage_error_heading` / `_body`, the report id as an `IdChip` — short on screen,
  whole in the DOM, one press from the clipboard, which is what a person reading it out to support
  needs — and its retry, `takeoff_coverage_retry`, re-running `takeoff.coverage` in place. The retry's
  id is the pattern's own `error-state-retry`; `coverage-retry` survives only in the module's house
  markup, where no chrome is injected.
- **Refusal** — the one RefusalState in `coverage-answer` for a door's rejection, and the dialog's own
  slot for a preview or commit refused while it holds focus. Never a toast, never a local block.
- **Partial** — the kind-grain rows (I-196), rendered at the foot of the grid (I-485) with their causes. Rows
  are shown, never dropped. The note that used to stand under the grid heading is gone with the
  heading: each of those rows already states its own cause in its mark, its key word and its
  accessible name, and §6 allows this screen one helper line in main — which it now spends on none.
- **Offline** — a `<p role="status">` banner at the head of the screen, `takeoff_coverage_offline`, house
  notice chrome (`--info-surface` fill, `--info` border, `var(--radius-4)`); both doors `disabled`.
  The grid reads on: a read honest about its age is not a broken screen.
- **Permission-denied** — `permitted` is the viewer's SET_BILL_BOUNDARY on this project, read
  server-side. Without it `data-state="denied"`, both doors do not render at all, and
  `coverage-answer` holds `takeoff_coverage_denied_permission` over one RefusalState from the
  registered `PERMISSION_NOT_HELD` entry, whose evidence link is the participants screen labelled
  `_denied_holder` — the sentence that used to stand beside it was the same fact said twice.
  Reading coverage needs membership only, which the shell guard settled before the route mounted.

## 3. Copy, verbatim

### 3.1 The six registry entries (`REFUSALS`, `src/core/errors.ts`), surface `inline`

- **NOT_ESTABLISHED** · warning · **No line has been published for this kind on this class and level,
  and nothing explains the absence.** · **Measure this kind on this class and level, or declare it out
  of the project scope so the certificate can state why it is unmeasured.**
- **INGESTION_TRUNCATED** · error · **Every sighting of this cell stands on a sheet that was read only
  in part, so nothing can be measured from it.** · **Upload the sheet again from its source file, then
  measure the campaign once it has been read whole.**
- **NOT_IN_PROJECT_SCOPE** · info · **A person declared this kind out of the project scope on this
  class and level.** · **Measure this kind to bring it back: published lines take precedence, and the
  declaration is then shown as contradicted.**
- **NO_BEARER_SIGHTED** · warning · **No class sighted in this campaign bears this kind, so no cell
  stands for it.** (I-351 — "residue" is a build word) · **Pin a revision whose drawings show a class
  that bears this kind, then measure the campaign.**
- **KIND_NOT_YET_SEEDED** · info · **This work item is in the catalogue, but no class has been recorded
  as bearing it.** · **Record the class that bears this work item in the ruleset, then measure the
  campaign.**
- **NOT_IN_THIS_BILL** · info · **A person held this kind out of this bill on this class and level.** ·
  **Measure this kind to bring it back into the bill: published lines take precedence, and the hold is
  then shown as contradicted.**

And the boundary refusal either door may be answered with, through the one RefusalState (R-TO-052):
**CELL_NOT_IN_RESIDUE** · error · **This campaign's coverage holds no cell at that address, so there is
nothing to declare about it.** (I-351 — the message no longer says "residue"; the code is unchanged) ·
**Open the coverage grid and choose a cell it shows: a class this campaign sighted, on a level of the
project's stack.**

The reasons beside the writerless fall-through, and the unclassed member's (`src/core/errors/coverage.ts`,
I-480/c):
- **COVERAGE_NOT_MEASURED_YET** · info · **This campaign has not been measured yet, so nothing has been
  published for this cell.** · **Measure the campaign from the register, then read each cell for what
  was published or why it was not.**
- **COVERAGE_CLASS_NOT_PLACED** · warning · **The drawings show this class, but no member of it has
  been placed off a layout plan, so there was nothing to measure.** · **Open the sheet that shows it
  and check what is drawn; the certificate names it as not measured until its members are placed.**
- **COVERAGE_KIND_NOT_READ** · warning · **The measure run does not read this kind for this class from
  the drawings yet, so nothing was offered for it.** · **Take it off by hand for now. Where the cell
  offers them, declare it out of the project scope or hold it out of this bill, so the certificate
  states the boundary you chose.** (The two doors stand only over a cell on a storey, I-194.)
- **COVERAGE_MEMBERS_NOT_REACHED** · warning · **The measure run reads this kind for this class, but it
  published and reported nothing for the members standing here.** · **Open the register for these
  members: a deferral or a refusal there says why. Where none stands, measure the campaign again, so
  they are read with the rest.** (The residue reads no queue item and no gate refusal; the register
  narrowed to the cell does.)
- **COVERAGE_MEMBER_UNCLASSED** · info · **The drawings show this member, but no class this product
  measures is it, so nothing of it is measured.** · **Take it off by hand from the sheet that draws it;
  the certificate names it as not measured.**

A rail's own reported code, where it is the reason, is said in its registered words (VIEW_SCALE_UNAFFIRMED,
REBAR_SCHEDULE_UNREAD, LINTEL_SOURCE_ABSENT, SECTION_BAND_UNCOVERED, …), never paraphrased here.

### 3.2 The screen (`src/modules/takeoff/coverage/copy.ts`, keys `takeoff_coverage_*`)

`takeoff_nav_coverage` **Coverage** · `takeoff_coverage_heading` **Coverage** (the document title; the
screen itself is named by the breadcrumb) · `_revision_label` **Pinned revision** · `_grid_label`
**Kinds by class and level** (the work surface's accessible name) · `_kind_column` **Kind** ·
`_column_label` **{class} · {level}** · `_kind_share` **{count} of {total} measured** ·
`_level_none` **No level** (I-cov-3) · `_cell_label_declared` **{count} of its {total} lines carry no
quantity: each names what the drawing did not state.** (I-cov-1) ·
`_measured_note` **A filled mark is a cell with published quantity.** · `_legend_heading` **What each
mark means** (the key line's accessible name).

The seven marks, as the key line says them: `_mark_published` **Published** · `_mark_partial`
**Partial** · `_mark_absent` **Not measured** (I-485) · `_mark_out_of_scope` **Out of scope** · `_mark_held` **Held**
· `_mark_no_class` **No class** · `_mark_catalogue` **Catalogue only**. The same seven as the tally
counts them, mid-sentence: `_tally_published` **published** · `_tally_partial` **partial** ·
`_tally_absent` **not measured** · `_tally_out_of_scope` **out of scope** · `_tally_held` **held** ·
`_tally_no_class` **no class** · `_tally_catalogue` **catalogue only**. The tally itself:
`_footer_label` **Counts by mark** · `_footer_cells_one` **{count} cell** · `_footer_cells_other`
**{count} cells** · `_footer_tally` **{count} {mark}** — the count picks its own form through
`countCoverageCopy`, so "1 cells" cannot be written here (§6).

The tool row: `_tools_label` **Coverage tools** · `_certificate_show` **Preview certificate** ·
`_certificate_hide` **Hide certificate**.

The inspector: `_level_label` **Level** · `_kind_grain_label` **Every class and level** ·
`_cause_heading` **Why this cell reads as it does** · `_declared_label` **Declared by act** ·
`_contradicted_note` **Lines have been published for this cell since this declaration was made, so the
published quantity stands and the declaration is not printed on the certificate.** ·
`_remedy_ruleset` **Open the rule set** · `_sightings_heading` **Sighted in** · `_channel_label`
**Channel** · `_view_label` **View** · `_source_label` **Read at** · `_sightings_none` **No channel
sighted this class on this level.** · `_observations_heading` **What the measure run reported** ·
`_observations_none` **The measure run reported nothing for this cell.** · `_hold_out` **Hold out of this bill** ·
`_declare_out_of_scope` **Declare out of project scope**.

Honest scope (session 8, I-480..g): `_level_foundation` **Foundation** · `_level_unplaced`
**Not placed** · `_absent_meaning` **Nothing was published for this cell. Open it for the reason and
what to do.** (the Not measured key's meaning) · `_mark_void` **Not borne** · `_void_meaning` **This
class does not bear this kind, so nothing is measured or owed here.** · `_cell_label_void` **{kind} on
{class}, {level}: this class does not bear this kind.** · `_reason_views_label` **On the drawings** ·
`_partial_all` **Declared partial: {members} {things}, {reasons}.** · `_partial_some` **Declared
partial: {count} of {total} lines carry no quantity — {members} {things}, {reasons}.** ({things} is the
class in words, lower case, an `s` past one; {reasons} each omitted code by the draft BOQ's
`reasonsInWords`, its variables in brackets) · `_remedy_sheet` **Open the sheet** ·
`_remedy_drawings` **Open the drawings** · `_sightings_summary_one` **{count} sighting on {sheets}** ·
`_sightings_summary_other` **{count} sightings on {sheets}** · `_sightings_nowhere` **no sheet named**
· `_observation_count` **{count} ×** · `_statement_partial_label` **Declared partial** ·
`_statement_unnamed_label` **Beam drawn, not named** · `_statement_unnamed_grid` **Grid {grid}**
({grid} is the pair's letter and numeral, `A/3`; I-613) · `_statement_unnamed_show` **Show on {sheet}**
({sheet} is the sheet the pair's plan stands on, `S-08`; I-675). Every count
through the format seam (`countWords`, `formatUserFigure`).

The proposed boundary (I-297; the block is absent where nothing was proposed, so no key here says so):
`_proposed_heading` **A boundary this cell may stand under** · `_proposed_note` **A model read this
cell's evidence and proposes this boundary. Nothing is declared until you carry the act.** ·
`_proposed_sentence_label` **The certificate would state** · `_proposed_carry` **Declare this
boundary**. The cause's own sentence beneath the label is the REGISTRY's (§3.1), never a key here.

The certificate: `_certificate_heading` **Certificate preview** · `_statement_measurement_title`
**Statement of the measurement boundary** · `_statement_measurement_none` **This campaign measured
every kind borne by every class it sighted, on every level.** · `_statement_bill_title` **Statement of
the bill boundary** · `_statement_bill_none` **Nothing has been held out of this bill.** ·
`_statement_measurement_none_unpinned` **No campaign is open, so there is no measurement boundary to
state yet.** · `_statement_bill_none_unpinned` **No campaign is open, so there is no bill to hold
anything out of yet.**

The cell's name: `_cell_label` **{kind} on {class}, {level}: {cause}** · `_cell_label_kind_grain`
**{kind}, every class and level: {cause}** · `_cell_label_measured` **Quantity is published for this
cell.** · `_cell_label_held` **Held out of this bill.** · `_cell_label_contradicted` **A declaration
over this cell is contradicted by published lines.**

The states: `_empty_heading` **No campaign is open on this project** · `_empty_body` **Coverage is read
from a pinned drawing set revision. Pin one, and every cell it bears appears here.** · `_empty_action`
**Browse drawing sets** · `_empty_campaign_heading` **This campaign has sighted nothing yet** ·
`_empty_campaign_body` **No class has been sighted in the pinned revision, so the grid bears no cell.
Run a measure run from the register, and the cells appear as the rails publish.** ·
`_empty_campaign_action` **Open the register** · `_loading` **Reading what this campaign measured, and
what it did not.** · `_error_heading` **Coverage could not be read** · `_error_body` **Nothing was
changed. Try again, and quote the report id if it keeps happening.** · `_report_label` **Report id** ·
`_retry` **Try again** · `_offline` **You are offline. Coverage reads as it stood when this page
loaded, and nothing can be committed until the connection returns.** · `_denied_permission` **Holding
a kind out of this bill and declaring one out of the project scope each need the SET_BILL_BOUNDARY
permission on this project.** · `_denied_holder` **A project principal can grant it on the participants
screen.**

RETIRED by the rebuild, and deleted rather than left to rot (B-19): `_caption` and `_partial_note`
(§6 allows one helper line in main and this screen spends none), `_certificate_hint`,
`_statement_measurement_hint`, `_statement_bill_hint`, `_observations_hint` and `_doors_hint` (four
sentences explaining sections that now say what they are), `_inspector_idle_heading` / `_idle_body`
(an absent column is the idle state, R-UI-080), `_kind_label` / `_class_label` (the fact line is three
model values, not three labelled fields) and `_drawing_label` (I-213).

The cell's accessible name is `_cell_label` (or `_cell_label_kind_grain`) filled with the kind and
the class in words and the level verbatim (I-351) and `{cause}` filled with the registered message, or with `_cell_label_measured`;
`_cell_label_held` and `_cell_label_contradicted` are appended, in that order, where they hold — so
the name says the kind, the class, the level and the cause in words, and never a code (AC-5, I-195).
Voice: calm, concrete, professional; no exclamation marks; no build vocabulary — "rail" survives only
where the product already names its own publishers (s-takeoff §3), and "seam", "ingest", "manifest",
"residue" and every clause id appear nowhere a reader can see — the registry's own messages included,
which is why I-351 re-worded two of them at their one home. Levels, drawings, views, source keys, act
ids, permission names and report ids are model data, rendered verbatim in mono, never woven into a
sentence (I-25); channels and reasons are enums said through `EnumLabel`; and **kinds and classes are
said in words by the draft BOQ's rule** — the row header, the cell's name, the inspector's fact line
and the certificate's row alike, the stored key kept on `data-kind` / `data-class` and in the label's
disclosure (I-351, R-UI-082: one kind, one spelling across the lane). Registry messages and remedies
are never paraphrased.

## 4. Motion (R-UI-004)

Nothing on this screen eases in. The grid paints at once, the inspector's content swaps instantly when
a cell is selected — a panel that slides while a reader is comparing cells is theatre in front of a
fact — and the statements arrive untweened. The only transitions: a cell's hover stroke and the nav
link's colour over `var(--motion-state)` `var(--ease)`; the shipped reticle's own, from its one home (I-190); the
shipped Tooltip's own delay on the key line; the Skeleton pulse while `loading.tsx` holds the route;
the ConsequenceDialog's own entrance. Horizontal scrolling of the grid box is the browser's, never
`behavior: "smooth"`. Every duration is a token zeroed at source under reduced motion, so
`coverage.css` carries no `prefers-reduced-motion` branch.

## 5. Tokens

Surfaces and ink: `--surface-app`/`--surface-panel` · `--ink`/`--ink-secondary`/`--ink-muted`/
`--ink-disabled`/`--ink-inverse` · `--line`/`--line-accent` · `--accent` · `--hairline`. The coverage
ramp: `--cov-0/1/2/3/4` (§4.3, I-210). The mark colours: `--state-danger` · `--state-warn` ·
`--danger` · `--info`/`--info-surface` (the offline notice). The hatches: `--pattern-none`/
`--pattern-solid`/`--pattern-dots`/`--pattern-hatch`/`--pattern-cross` and `--pattern-pitch` (§4.3,
I-211). Geometry: `--space-1/2/3/4` · `--space-5` (the cell's growth past the row height, I-351) ·
`--radius-4/8` · `--text-12/13` · `--row-h` (the cell's height and least width, and every row on this
screen, R-UI-005) · `--cx-coverage-cell` (the stylesheet's own clamp of the box's share per column,
`cqi` of the grid's query container — I-351) · `--toolbar-h` · `--icon-md` · `--z-sticky` · `--font-ui`/
`--font-mono`/`--font-doc` · `--leading-ui` · `--weight-body-medium`/`--weight-heading` ·
`--motion-state`/`--ease`.

Px literals, closed set (core I-1's mandated class): the kind column's 200 and the certificate's 192,
both stated once as custom properties on `.cx-coverage`; the 1 px and 2 px of an inset edge, and the
1 px hairline of the Not borne dash (I-485); the
glyph viewBox's 16 and its 1.5 px stroke, inside the drawn marks. Any other literal is a defect. No
`[data-theme]` selector, no colour, no primitive ramp position (`--graphite-N`, `--beam-N`) appears in
`coverage.css`; the mechanical half of §7's C8 reads this file and scores it. No copper appears
anywhere except on the ConsequenceDialog's confirm, which is the pattern's own — the grid commits
nothing itself, and a cause is never an act.

## 6. Themes

`coverage.css` contains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). The one reading this screen makes for itself is that the ramp's two dark steps take
`--ink-inverse` for their mark, whatever colour the mark asked for — `--cov-3` and `--cov-4` are dark
in light and light in dark, and a mark nobody can see is not a mark. Everything else inherits:
`currentColor` carries the glyph, the hatch and the pattern together, so the three of them can never
disagree about a colour. Contrast holds on the founder values in both themes: ink-muted, ink-secondary
and ink on `--surface-app` and on `--surface-panel` clear 4.5:1; the danger, warn and disabled marks
clear the 3:1 UI floor on the ramp steps they can actually stand on (0, 1 and 2 — a held or absent cell
has published nothing, so it is never painted at step 3 or 4, I-210). In greyscale the ramp collapses
and nothing is lost: the glyph, the pattern and the accessible name each say the whole reading
(R-UI-060), which is also how the certificate prints it.

## 7. Test hooks (closed contract, C-05)

Routes introduced: `/t/{tenant}/p/{project}/takeoff/coverage` (`coverageRoute`) and its widened form
`…/takeoff/coverage?cell={kind}:{class}:{levelId}` (`CELL_PARAM = "cell"`, a kind-grain row addressed
as `{kind}::`). Routes linked, all shipped: `…/takeoff/register`, `…/drawings/sets`,
`…/settings/participants` (the denial's evidence), `…/settings/ruleset` (KIND_NOT_YET_SEEDED's).

Test ids, exactly the contract's, on the elements ruled in §1 — **the rebuild added none: the registry
is closed and every new region is found by its class, its role or its name (AM-09 §1)**.
`takeoff-nav-coverage` · `coverage-screen` (`data-state`, `data-density`, `data-campaign`) ·
`coverage-grid` · `coverage-kind-row` (`data-kind`) · `coverage-cell` (`data-kind`, `data-class`,
`data-level`, `data-grain`, `data-measurement`, `data-bill`, `data-contradicted`, `data-code`,
`data-mark`, `data-cov`) · `coverage-cell-glyph` (`data-code`, on the axis the cell is READ under and
on that one only, I-198) · `coverage-legend` · `coverage-legend-entry` (`data-code`, `data-mark`,
`data-meaning`) · `coverage-inspector` (`data-cell`, `data-kind`, `data-class`, `data-level`, and, from I-297,
`data-proposed-cause` and `data-proposed-call`, both `""` where nothing was proposed) ·
`coverage-inspector-cause` (`data-code`, `data-cause`, `data-act`) · `coverage-inspector-remedy` ·
`coverage-inspector-sighting` (`data-channel`, `data-source`) · `coverage-inspector-observation`
(`data-rail`, `data-reason`) · `coverage-hold-out` · `coverage-declare-out-of-scope` ·
`coverage-answer` · `coverage-empty` (the EmptyState, and the ErrorState in its place) ·
`coverage-retry` (the house error cell only; the shipped one carries `error-state-retry`) ·
`coverage-certificate-preview` (`data-open`) · `coverage-statement` (`data-axis`) ·
`coverage-statement-row` (`data-kind`, `data-class`, `data-level`, `data-levels`, `data-code`) ·
`coverage-statement-none` (`data-code="NONE"`). `takeoff-nav`, `takeoff-nav-register`, `shell-toolbar`,
`empty-state`, `error-state-retry`, `error-state-report`, `id-chip`, `tooltip-content`,
`refusal-state`, `refusal-message`, `refusal-remedy`, `refusal-evidence-link`, `consequence-dialog`,
`consequence-confirm`, `consequence-digest-line`, `skeleton` and `screen-state` are other files' ids,
used and never redefined. The regions with no id of their own — the tool row's contents, the tally —
are reached by class (`.cx-coverage-tools`, `.cx-coverage-tally`) exactly as the picture masks are.
The proposed-boundary block (I-297) is one of those: it carries NO id and is found by its accessible
name, `section[aria-label="A boundary this cell may stand under"]` (`.cx-coverage-proposal`).

Behavioural hooks without new ids: `role="grid"`/`rowgroup`/`row`/`columnheader`/`rowheader`/
`gridcell` with `aria-label`, `aria-colcount` and `aria-rowcount` on the matrix; `aria-selected="true"`
on exactly the selected cell and `tabindex="0"` on exactly one cell; `role="list"`/`listitem` on the
key line, each entry a tab stop so its meaning is reachable without a pointer; `aria-current="page"` on
the nav's current entry; `role="toolbar"` on the frame's strip; `role="status"` on the offline banner;
`aria-live="polite"` on `coverage-answer`; `--row-h` re-keying the cell side from the reader's own
density. Asserted absences: no `NOT EXISTS` reaches the screen's words and no refusal code appears in
any text node under `coverage-screen` outside `[data-technical]`; no UUID, digest or SCREAMING enum in
a text node outside `IdChip`, `EnumLabel` or `[data-technical]` (§7 C6, I-213); no count of any kind
inside `coverage-certificate-preview`; **no `coverage-inspector` at all while nothing is selected**
(R-UI-080, §7 C3); no `coverage-hold-out` or `coverage-declare-out-of-scope` on a QUANTITY_BEARING
cell, on a kind-grain row, on a cell naming no level, or while `data-state="denied"` (I-194); no
statement row for a cell reading `data-contradicted="true"` (I-192); no `<title>`/tooltip on a cell;
**no horizontal scroll on `html`, `body` or `shell-main` at 1280×800** — the matrix is the one scroll
container (§7 C10). Honest scope (I-480..g), all without new ids: `data-reason` on
`coverage-inspector-cause` and on `coverage-statement-row` (the reason beside a NOT_ESTABLISHED
cause, `""` elsewhere); `data-count` on `coverage-inspector-observation`; the classes
`.cx-coverage-void` (`data-mark="void"`), `.cx-coverage-legend-void`, `.cx-coverage-reason-views`,
`.cx-coverage-sightings-fold`, `.cx-coverage-statement-partial` (`data-omitted`) and
`.cx-coverage-statement-unclassed` (`data-word`, `data-code`). Asserted absence: **no face of the
screen — text node, accessible name or key-line meaning — says "nothing explains"**.

Suites of this session: `tests/residue/{declared-classes,unmeasured-reasons}.test.ts` (the pure
declared axis over F-RCC6-BNBC's 54 captions, every reason, the statements — outside `coverage/`
because the refusal register's walk skips a directory of that name, and these name the new codes),
`tests/takeoff/coverage/honest-scope-screen.test.tsx` (the screen), `tests/takeoff/coverage/declared-axis.test.ts`
(db: the axis over a stored partition), `tests/takeoff/measure/{run-deferrals,measure-job}.test.ts`
(the run's named deferrals, pure and over the store, the register's region and the per-kind absence
clause); J-000's `m2-coverage-grid` asserts F-RCC6-BNBC's slab and stair Not measured under
`COVERAGE_CLASS_NOT_PLACED`.

Suites: `tests/takeoff/coverage/**` — jsdom mounts of `CoverageWorkspace` over
`coverageFixture()`/`residueFixture()` with chrome bound to the shipped components (I-170) for the
grid, the two glyphs, the key line's seven entries, the inspector, the doors, the address and the seven
state cells; and the reading and the two acts through the router. Each of the six causes is exercised
by name. Journeys: `tests/e2e/journeys/j-022-coverage.spec.ts` through
`tests/e2e/pages/s-coverage.page.ts`, staged by `tests/e2e/takeoff/coverage-stage.ts`, checkpoints
`j-022-coverage/{grid,held-out,certificate}`; `tests/e2e/journeys/j-000-coverage.spec.ts`, checkpoints
`j-000/{column-lines,coverage-grid}`. axe serious/critical = 0 at each, never widened. `masks()`
covers the shell breadcrumb, `shell-user`, `shell-tenant-switcher` and this screen's three per-run
texts by class — `.cx-coverage-revision`, `.cx-coverage-act-id`, `.cx-coverage-source-key`, each now
the class handed to the `IdChip` that renders it — which exist for that masking and are not ids,
because the contract is closed. Re-baselined under B-20, in
its own `baseline:` commit naming the nav entry as the proof: `s-takeoff/register.png`,
`s-takeoff/measure-queued.png` and the j-021 pictures that show `takeoff-nav`, whose bytes move only
because the nav gains a second entry.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

Withdrawing or superseding a scope declaration, and the REPIN consequence over one — owner: the act's
own later leaf; `in_force` is written true here and never flipped, and the screen offers no door that
would. The Part A declared-disagreement row a contradicted cell owes (L-QTY-09) — owner: M7's review
queue; here the cell is marked and omitted from the statements, and no queue row is written. *(PAID by VD-3: the
`EvidenceLink` from a sighting row to the sheet it was sighted on, I-556, once the pattern admitted
a link with no basis, evidence-link I-554.)* *(PAID by this rebuild: the frozen
kind column and the sticky class/level header, an IOU here and Direction §3.5's law — I-190.)* The
class-grain appendix (a sighted class bearing no kind), the
sheet-grain fidelity block, and the certificate document itself — owner: M7, per L-QTY-07. Bulk
declarations as an offered group (R-UI-023) — deliberately absent: a declaration is one act over one
cell. Folding `takeoff_nav_coverage` into `src/ui/strings/takeoff.ts` beside its sibling — owner: that
file's node, when it next opens (I-197).

Opened by the v22 rebuild. **The 24 px readout (`useShellStatus`) stands unused on this screen** —
§3.5's template gives coverage a 28 px tally of its own in main and no readout line, so nothing is
mounted there rather than a second copy of the tally; owner: a later leaf, if a coverage fact is ever
found that belongs to the frame rather than to the grid. **Virtualisation past 200 rows** (§5's rule
10) — owner: a later leaf; the matrix renders every row today, and a catalogue that outgrows that will
be felt before it is measured. **A column chooser and per-user column state** (§5's rule 3) — owner: a
later leaf; the matrix' columns are the residue's own sightings and a reader cannot yet hide one.
**The design baselines under `tests/e2e/baselines/design/j-022-coverage/`** — owner: the gate, in its
own `baseline:` commit (B-20): every pixel of this screen moved.

Opened by I-297. **A proposal is asked for on every inspector open and is stored nowhere** — unlike
`partition_views.proposed_type`/`proposed_call_id`, this cell carries no stored proposal, so reopening
a cell in production mints a second ledger row and a second charge; replay makes it free in every
lane, so this is a spend question and not a correctness one. Owner: a later leaf, with a stored
proposal keyed by cell and its own migration. **The corpus is hand-authored state rather than observed
state** (`scripts/model-corpus/coverage-cause-states/`): the roster test pins each state to its
recording, but nothing pins a state to what the BNBC campaign's residue actually answers. Owner: a
later leaf, with a db-lane assertion that `coverageCauseStateOf` over a measured BNBC campaign equals
one committed state. **Every asked cell outside the corpus writes a FIXTURE_MISSING row** that shows
on S-Audit's `coverage-cause` line as a refusal before a person has judged anything — the same noise
session 4 saw on `view-caption`; owner: the handoff, which must quote it so the next reader does not
read it as a model that abstains.

Opened by I-351. **The partial hatch reads as noise at a 28 px cell** — `--pattern-dots` at
`--pattern-pitch` is the token's geometry, and a stylesheet that re-drew it for one screen would be a
second hatch (B-17); the wider cell I-351 allows softens it where the matrix has room. Owner: the node
that owns `src/ui/tokens.ts` — a pitch that reads as a mark at `--row-h`. **`Bored` beside `Boring`**
in the row headers — owner and fix recorded in s-takeoff §8 (a display name per kind in the
catalogue, read by `inWords`, so every face moves together).

Opened by HONEST-SCOPE (session 8). **The register does not yet read `?class=&kind=&level=`** — the
door from a cell passes the narrowing the register's own filters use, and the register opens whole
until it reads its filters from the address (walk-0's register-trace FRICTION); owner: the register's
node (s-takeoff §1 filter bar). **The register's deferred-and-refused rows of a run's deferrals label a
view or a storey as "Object"** — the row's `objectKey` is the view's caption (else its address) or the
storey's label, rendered through the region's shared IdChip; owner: s-takeoff's region (its own label
for a view and a storey, and a door to the sheet's scale panel and to Levels rather than the region's
one evidence link). **The draft BOQ's "Not measured in this draft" page reads only the first
enumeration** — it now says each row's reason, but neither the partial nor the unclassed
enumeration; owner: BOQ-SHAPE (`partialStatementOf`, `unclassedStatementOf` are core's, ready to read). **A declared sighting names the sheet by the
manifest's first sheet of its drawing** (`layoutOf`), so "Open the sheet" may open that drawing's first
sheet rather than the caption's own until the residue's scope reads core's sheet resolver; owner: RES-1
(`channels/scope.ts`). **A caption's level is not read** — "STAIR PLAN AT GROUND FLOOR" and "1ST FLOOR
SLAB REINFORCEMENT PLAN" name a storey, and a declared class stands on no level (`Not placed`) until
the notation grammar's level reading is applied to captions; owner: a later leaf. **Captions are read
as stored** — MTEXT formatting codes, where a caption carries them, are not stripped here; owner:
REAL-1's core stripper, which this reader should call once it lands. **The measure run's timeline still
says "Done"** — the run's deferrals are in its verdict step and in the register's region, and the
job-timeline pattern shows no step detail; owner: the job-timeline pattern (`src/ui/patterns/job-timeline`).

Opened by I-541 and I-543. **The skirting has no method** — its length deducts the widths of
the openings at floor level, and no deduction channel carries a width; owner: the slice that measures
room faces (ARCH-78), with a channel or a method version of its own. **A room's walls are measured run
by run, one run to one soffit** — F-ARCH's A-18 splits a room's boundary where the panel over it
changes, and 16 of its 101 measured rooms stand under two clear heights, so one WALLS offer per room
with one `H` over-measures under the higher soffit; owners: ARCH-5 (register WALLS per (room, soffit)
run, the recommended reading) and ARCH-78 (bind each run's `H` off the structure and `f` off the
schedule, or bind the lowest `H` and declare the shortfall — never the highest). **A wall band's
threshold is judged per candidate, where F-ARCH judges an opening by its whole area and deducts its
overlap with the band** — owner: ARCH-78, which offers the bands, and which also allocates each opening
to the run it stands in. **The four finish methods are cited by no
edition** — owner: the wave's edition (OPEN-3), which mints them beside the wave's other methods.
