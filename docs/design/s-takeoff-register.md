# Design Decision — S-Takeoff register: the `source` cell and the origin row

## The workspace this cell stands in, as it is built (Design Direction 00 §3.2)

The `source` cell this Decision rules is the grid's last column (`Src` below), and the Trace it
carries is also the inspector's last line. **Amended by s-takeoff I-reg-3 (session 7):** the cell is
now the SIXTH of eight columns, after Coverage and before Formula, at `size` 168 — the evidence a
reader must reach without scrolling at 1440 and at 1280 — and Calibration and Engine are the line
inspector's. **Amended by s-takeoff I-468 (session 8):** 208, measured for `S-10 · C1 · Layout
plan`, with Formula 132 and Variables 120; everything else this Decision rules about the cell stands. The workspace around it is the one s-takeoff.md rules and
the one Design Direction §3.2 fixes — reproduced here whole, because a Decision that amends a cell
must open on the composition that cell lives in. Grid first: inside `shell-main` exactly two things
stand above the lines table, the 36 px filter bar and nothing else, because the tabs row is the
frame's own tool track and the inspector is the frame's one right column.

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Register             ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.co… │
│  │ Register · Coverage                    rev a3f9c2 ⎘  ● Measure │ 0.405 m³│
│  ├───────────────────────────────────────────────────────────────┤ ▣ T / D │
│  │ Class·All ▾ Kind·All ▾ Level·All ▾ Basis·All ▾ Cov·All ▾  3 of 3 │ ■ 100 %│
│  ├──────┬────────────────────────────────────────────────────────┤ Formula │
│  │ tree │ Kind ▸ │ Value ▸│Unit│ Bases │ Cov │Formula│Var│Cal│Eng│Src│ live   │
│  │ ▾STR │ ▾ GF · column (4)                          1.620 m³    │ vars     │
│  │  ▾GF │ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C1·#1F │ ─────── │
│  │   col│ rcc.concrete  0.405  m³  ▣ T ■100 % H×(…) S-101·C2·#2A │ Trace ↗ │
│  │   C1 │ …                                                      │ ▸Technical│
│  │──────│ 28 px rows · 13 px · frozen Kind · sticky header        │         │
│  │ 0 rep│                                                        │         │
│  │──────│                                                        │         │
│  │ refus│                                                        │         │
│  │ offers├───────────────────────────────────────────────────────┤         │
│  │      │ (sticky footer)                            1.620 m³    │         │
└──┴──────┴────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tabs row (frame's tool track) | Register · Coverage area tabs + right: pinned revision `IdChip` + the ONE primary (Measure) | 100 % × `--toolbar-h` 32, **above `shell-main`** | the revision pair is absent with no campaign; the primary stands | — | — |
| filter bar | five chips, each `Label · Value ▾` (Combobox), then the live count | 100 % × 36 | a chip whose column produced nothing offers its all-option alone | — | five 28 px chip bones |
| index rail | the object tree (discipline › level › class › object), the struck count, every sighting that produced no line, and the level-stack offers | 240 (min 160, max 320), scrolls on its own | the tree is empty and the two sections state their own zero | `RefusalState` per sighting | one rail bone |
| grid (primary) | the shipped `DataTable`: 28 px rows, sticky header, frozen Kind, group rows with per-unit subtotals, sticky totals footer | flex; ≥ 60 % of `shell-main` at both viewports | `EmptyState` in the grid's own place — no campaign, nothing registered, or nothing matching the filters | the read's fault is the screen's error cell (`register-empty`, with the report id and the retry) | the header is real, the body is bones |
| footer | the visible set's totals, exactly and per unit (B-07) — every unit's total on the face, starting under Value and running on across the footer's empty cells where they outgrow it (s-takeoff I-350) | 100 % × 28, sticky | no footer cell where the set adds to nothing | — | — |
| job strip | the shipped `JobTimeline`, **present only while a run is being watched** (R-UI-080) | 100 % × the pattern's own | absent — never an empty "Measure runs" block | the step carries its own refusal | the pattern's own |
| inspector (frame's one slot) | the selected LINE (kind, value, bases, coverage, source chips, the formula expanded with its live variables, the Trace, the Technical disclosure) or the selected OBJECT (basis, role, corroboration, Technical, Repudiate, the attributes and their two doors) | `--inspector-w` 320 (280–480) | **absent — width 0**, never a sentence saying nothing is selected | `RefusalState` in the answer slot | — |

Above the fold at 1440×900 and at 1280×800: the grid's first row is 88 px below the top of main
(24 px of the frame's padding, the 36 px bar, the 28 px header) — inside §3.2's hard rule of 240 and
inside §7 C2's own 120.

---

The origin half of the Trace (R-UI-022, R-TO-011, X-2), on the register workspace of inc-214.
Route (unchanged path, widened query) `/t/{tenant}/p/{project}/takeoff/register?line={lineId}`.
Increment inc-215-trace. This Decision amends `docs/design/s-takeoff.md` for exactly two things —
the lines table's `source` cell becomes an `EvidenceLink`, and the register learns to be returned
to — and re-decides nothing else: that file's layout, tree, inspector, filters, refusals, level
stack, copy, motion, tokens, themes and its one `REGISTER_STATES` matrix stand as it rules them, and
its I-170–I-175 remain in force (I-170 chrome is injected · I-171 the `display: contents` mount ·
I-172 the five filters are the screen's · I-173 a repudiated object's lines are withheld · I-174
SUSPENDED shows as such · I-175 the acts are doors on the object). Files touched:
`src/modules/takeoff/register-ui/{index.tsx,view.ts,server.ts,copy.ts}`,
`src/app/(app)/t/[tenant]/p/[project]/takeoff/register/{register-screen.tsx,page.tsx,
route-address.ts,actions.ts,register.css}`. Law: R-UI-022, R-TO-011, X-2, J-021, R-UI-002/003/004/
005/012/030/031/050/060, B-17, B-19, B-20, C-05, ARCH-01, Q-11. The link itself is ruled by
`docs/design/evidence-link.md` (I-176–I-178) and is never re-implemented or re-styled here (B-17) —
it is only PLACED in its cell, no wider than the cell with its label ellipsised (s-takeoff I-350 (c),
§1 below).

## 0. Interpretations (numbering continues evidence-link.md's I-178)

- **I-179 — the cell is the link, and only this cell.** The `source` column's whole content becomes
  one `EvidenceLink` — not a key followed by a Trace icon, not a row action, not a second column.
  **Amended by v22 (Direction §6, s-takeoff.md I-234):** its visible label is no longer the raw key
  but the chips a person reads it as — `S-101 · C1 · #…`, the sheet the line stands on, the mark it
  was read for and the extractor's handle, composed by `sourceChips`. The key itself is not
  abbreviated away: it is whole in the `href` the link carries (`s=`), whole in the inspector's
  Technical disclosure, and whole in the chips themselves wherever `parseSourceKey` (L-CAD-02) finds
  no scheme to read a handle out of, because a key of an unknown grammar is data and is never
  shortened into a shape the product invented (I-26). What §6 forbids is a MACHINE NAME on the face
  of a screen — `DXF_HANDLE:1F` is one, `#1F` beside the sheet and the mark is the same fact said to
  a quantity surveyor. The accessible name of the anchor is that same label, so nothing a reader
  hears differs from what they see. A number's evidence is the key it
  was read at, so the key is the affordance; anything beside it would be a second control saying the
  same thing. Scope holds exactly here: no other cell, no queue item, no refusal row, no inspector
  reading and no attribute row grows a link in this increment (R-UI-022's other surfaces belong to
  their own screens, §8). The register's own `register-source-key` in the object inspector stays
  select-all text.
- **I-180 — Back is a real history step, and the origin is stamped before leaving.** The link is a
  plain anchor navigation (a push), so the browser's Back button — not a rebuilt one — returns the
  reader (R-UI-022). What Back must land on is the *row*, so the workspace `history.replaceState`s
  the register's own address plus `?line={lineId}` onto the current entry in the anchor's `onClick`,
  before the navigation is allowed to proceed: never `preventDefault`, never `pushState`, never a
  router call. The stamp runs on modified clicks too (⌘/Ctrl/middle, which open a new tab): the
  reader named an origin either way, and a register that marks the row you traced from is right in
  both windows. Rejected: pushing the origin as its own entry, which would put a second Back between
  the sheet and the register.
- **I-181 — a link is offered only where there is somewhere to go.** The cell renders the key as
  plain text — today's `cx-register-source` span, unchanged — and no anchor at all when the line
  cannot name a place: when the reading resolves no sheet for it (`drawingId`/`layoutName` null), and
  when its quantity basis is `DEFAULTED`, because a defaulted figure was never read from a drawing
  and a Trace from one would fly to nothing (R-UI-022's "came from a drawing" is the condition, not
  a formality). A repudiated line raises no case: I-173 already withholds it from the table entirely,
  and that absence is asserted here rather than re-derived. Rejected: a disabled or dead link, which
  offers a place that is not a place (evidence-link I-178).
- **I-182 — the origin is restored where the reader can see it, and an unknown `line` is a fact.**
  On mount with `?line=`, the workspace marks that row's link `data-origin="true"`
  `aria-current="true"` and focuses it once per address, scrolling the table's viewport to it when
  the virtualiser has not yet rendered it. Being the origin is a two-valued fact about every drawn
  link, not a badge only the winner wears: every other link carries `data-origin="false"`, so a
  reader — and a test — can tell "not this row" from "this screen has no origin at all" without
  knowing which rows the table happens to have drawn. `aria-current` is the other kind of statement
  and stays on the one current row alone. A `line` this register does not show — a stale address, a
  foreign line, a withheld one — focuses nothing, marks nothing and says nothing: no refusal code is
  invented and no filter is silently cleared (s-viewer-inspector I-88's idiom, and I-172's rule that
  the reader's filters are the reader's). Rejected: re-sorting or unfiltering to surface the origin,
  which would answer Back by rewriting the screen the reader set.
- **I-287 — the words are the layout, the mark and the view's class; the key is the element's data.**
  Amends I-179's chips and I-182's cell, and s-takeoff.md's I-234 with them. I-179 kept the key whole
  in the chips "wherever `parseSourceKey` (L-CAD-02) finds no scheme to read a handle out of", and
  that clause was written for a key of an UNKNOWN grammar — but the key every published line in fact
  carries is a VIEW key (`v:{view class}:{caption-anchor source key}`, L-REG-04;
  `register-ui/server.ts` fills each line's `sourceKey` from it), which `parseSourceKey` refuses
  because it has three colons and not one. So the clause written for the exception fired on the rule,
  and the source cell read `Model · B1 · v:LAYOUT_PLAN:DXF_HANDLE:424` — a machine name on the face
  of a screen, which is what §6 forbids and what R-UI-082 names: a DXF handle, a version key and a
  source key never render as body text; they render through `IdChip` or stand on the element's data
  and tooltip. Ruling, in three parts. **(a)** `sourceChips` gains ONE reading and no more: a key
  that is `v:`, a non-empty class and a rest `parseSourceKey` accepts renders its class through
  `humaniseEnum` — `Layout plan`, the same rule `EnumLabel` says every other SCREAMING value on this
  screen by (B-17) — so the cell reads `Model · B1 · Layout plan`. An entity key of the extractor's
  grammar still reads `#424` (I-179 unchanged); a key of any other grammar still stands whole
  (I-234's last clause, I-26); and a `v:` prefix over a rest of no grammar is NOT a view key and is
  not taken apart on a guess. `sourceChips` still composes no address and still shortens no datum —
  what it drops from the face of the screen is carried whole on the element beside it. **(b)** The
  key is not dropped, it moves: both `EvidenceLink` call sites carry `data-key={line.sourceKey}`
  through the pattern's rest spread (evidence-link I-178, §7), so the whole key stands on the element
  that IS the evidence — one hover, one click and one copy away — besides being whole in the `href`'s
  `s=` and in the inspector's Technical disclosure, which is where I-179 already put it. The shipped
  `EvidenceLink` is untouched: a caller's `data-*` is exactly what its rest spread is for. Nothing is
  rendered to satisfy a score — the disclosure is the same disclosure and the address is the same
  address; what left the screen is a text node, not a fact. **(c)** The index rail's refusal rows
  carry a PLACEMENT key (`view key|mark|x,y`), which is an identifier under the same clause and was
  printed as bare mono text. It renders through the shipped `IdChip`: whole in `data-value` and in
  the chip's own tooltip, short on the face of the rail — the mark where the rail knows one, the
  chip's own leading characters where it does not, the shortening the chip's and never this screen's
  (B-17). Its `data-testid` is read from the registry through `chrome.testIds.refusalObject` rather
  than spelled, which is one literal fewer under `src/modules` (AM-09 §1's ratchet). Rejected: a
  native `title` of the raw key on the label, which is a second identifier surface where the chip
  already is one; rejected: shortening the view key by hand into `v:…:424`, which is the invented
  shape I-26 refuses; rejected: keeping the key as the anchor's accessible name, because the name is
  the label and a name that differs from what is read is what I-179's own last sentence forbids.
- **I-425 — the chip names the sheet by its NUMBER, and the link opens that sheet at the member
  (I-179 as viewer.md's I-421 applies it; s-takeoff.md I-234's "the source cell states the sheet
  the line stands on" is read the same way).** Walk-0 found every chip reading `Model · P1 · Layou…`
  and every link opening a sheet called `Model` that the drawing does not hold — the sheet was
  resolved once per DRAWING and fell back to a constant, and F-RCC6-BNBC's lines stand on S-04, S-06,
  S-10 and S-13..S-15 of one file. The sheet is now resolved per LINE, by the Trace's own reading
  (`tracedLineOf` over the record the pin measured, I-422), so the chip and the link cannot
  disagree: the chip's first part is the number the sheet's title block states (`S-10`), never the
  layout's whole title the 168 px column cut short; a line that stands on model space (a view no
  sheet's window frames) says **Model space** in words rather than printing the extractor's name for
  it (R-UI-082); and the link opens the very layout the chip names — `…/viewer/{drawing}/S-10%20COLUMN
  %20LAYOUT%20PLAN?s={outline},{mark}&line=…` — selecting the member the line was measured off, not
  every key it cites. A line whose record cannot be read names no sheet and keeps its chips as plain
  text (I-181, unchanged). Rejected: resolving the label in this screen's server beside the Trace's
  resolver (a second answer to one question, B-17); the layout's title in the chip (the relook saw it
  truncate to `Layou`).
- **I-426 — what a line CITES and what its Trace SELECTS are two readings under two names.**
  `ViewLine.sourceKeys` stays every key the line cites (`citedKeysOf`), and `ViewLine.traceKeys` (with
  `LineEvidence.traceKeys` in the Trace) is what the Trace selects. The register JSON export mirrors
  `ViewLine` field for field and has published `lines[].sourceKeys` since 1.0 as "every source key the
  line cites" (docs/api/register-json.md). Under I-421 the Trace selects a placed member's outline
  and mark, which the line cites nowhere. If that selection were carried as `sourceKeys`, the export
  would change a field's meaning under an unchanged name. Its own versioning rule makes that a
  breaking 2.0, and integrations would get it without notice. So the export publishes the same keys
  it always did, the selection stays a screen reading that 1.0 does not publish, and the API page
  says so. Rejected: redefining the export's `sourceKeys` as the selection (the breaking change
  above); computing the cited keys a second time inside the export (the export adds nothing and
  rewrites nothing, AC-1); publishing `traceKeys` as an additive 1.1 field (integrations have no
  viewer to select in, so nobody has asked for it).

## 1. Layout and hierarchy — what moves

Nothing about the workspace's regions, widths, order or density is decided HERE: the tabs row, the
answer slot, the filter bar, the index rail beside the grid, the grid, its footer and the frame's one
inspector are exactly as s-takeoff.md §1 rules them — as v22's rebuild rewrote it under Design
Direction §3.2, whose region table opens this file. Two things change inside the lines table.

**The `source` cell.** Still `enableSorting` on `sourceKey` (the sort control is also the keyboard
way into a virtualised scroll box); since s-takeoff I-reg-3 the sixth column at `size` **168**, not
the last at 180. **Amended by s-takeoff I-468 (session 8):** at `size` **208**, with Formula 132 and
Variables 120 — the chip measured 177 px in the product's Chromium, and 168 cut it. **Amended by v22:** it
no longer wraps — §5 rule 2 says no cell in the one grid wraps, so the cell is one line, clipped with
an ellipsis, and the shipped table states the whole of it in its own Tooltip when it is in fact
clipped. **Amended by s-takeoff I-350 (c) (session 7's re-look):** the link is one atomic box to the
table's text box, and the first atomic box on a line is clipped, never ellipsised — so the cell read
`Model · P27 · Layou` with no mark and the ellipsis this paragraph promised never drew. The link is
now PLACED in its cell: `.cx-register-trace` is a flex line, the link a flex item no wider than the
cell (`min-width: 0`), and its label (`.cx-evidence-link-label`) `overflow: hidden; text-overflow:
ellipsis; white-space: nowrap` on a `--space-6` line box, the link's own 24 px target, so the clip
never takes the underline. That is the whole of it — the glyph, the rule, the basis ink, the type and
the target are the pattern's, restated nowhere (B-17), and the viewer's cited line places the same
link in its grid the same way (`.cx-viewer-cited-line .cx-evidence-link`). Because the ellipsis is
now inside the link, the table's Tooltip no longer fires on this cell: the chips stand whole in the
link's accessible name, beside the key on `data-key`, and in the line inspector's Source row, one
selection away (evidence-link I-26: never ellipsised behind something a reader cannot open). A
hover statement of the label is recorded in s-takeoff §8 against the pattern's owner. The cell
renders:

```
<span class="cx-register-source cx-register-trace">
  <EvidenceLink href={traceAddress(tenantId, projectId, line)} basis={line.quantityBasis}
                label={sourceChips(line, markOf(line.objectKey), humaniseEnum)} data-line={line.lineId}
                data-key={line.sourceKey} data-origin={isOrigin ? "true" : "false"}
                aria-current={isOrigin ? "true" : undefined} onClick={stampOrigin} ref={originRef} />
</span>
```

The same link stands once more, and in one more place only: the shell inspector's line panel, under
the formula it expands, because the inspector IS the selected row said at length and a Trace from a
row a reader has selected is the same affordance, not a second one (R-UI-022's four surfaces, §8).
The Decision's asserted absence — "no `evidence-link` outside `register-lines`" — is amended to
"none outside `register-lines` and the frame's inspector slot", and every other absence stands.

`EvidenceLink` arrives through `chrome` like every other shipped component (I-170: `RegisterWorkspace`
is a module and may not import `src/ui`), and the jsdom acceptance binds the shipped one, so what a
test mounts is what the route renders. The address is composed by `traceAddress` in
`src/modules/takeoff/trace` — spelled once (B-17) — as
`/t/{tenant}/p/{project}/viewer/{drawingId}/{layoutName}?s={sourceKeys comma-joined}&line={lineId}`,
`layoutName` and each key percent-encoded, and **no `v` parameter**: the absence is what makes the
viewer fly (s-viewer-inspector I-85). `originAddress(tenantId, projectId, lineId)` in the same module
is the one spelling of this screen's own address, and `route-address.ts`'s `registerRoute` becomes
`originAddress(tenantId, projectId, null)` so the register path keeps one home.

`sourceChips` is the module's own, spelled once: the layout name the reading resolved, the mark of
the object the line was measured from (read off the view's own objects, never looked up), and the
word the key reads as, joined by ` · `. **Amended by I-287:** that third part is a VIEW key's class
said in words through `humaniseEnum` (`Layout plan`) where the key is a view key, `#` and the key
part where `parseSourceKey` accepts it, and the whole key where it is of neither grammar. It composes
no address and shortens no datum: the key it does not print stands whole on the anchor's `data-key`,
in the `href` and in the inspector's Technical disclosure.

`ViewLine` gains three readings the cell needs, filled server-side: `drawingId` and `layoutName`
(the ingest's recorded sheet, `sheetOfView`) and `sourceKeys` — the line's own `sourceKey` followed
by each binding's `source` in binding order, duplicates collapsed to their first occurrence,
calibration keys excluded, which is `citedKeysOf`. `sourceKey` stays the visible label; `sourceKeys`
is the selection the address carries. **Amended by VD-1:** `layoutName` is the sheet the Trace opens
for THIS line (`tracedLineOf`, viewer.md I-421) over the record its pinned revision measured, read
once per drawing; `sheetLabel` beside it is how a reader names that sheet — its title block's number,
or null for model space, which the chip says in words; and `traceKeys` is what the Trace selects
there — the member's outline and mark where its placement resolves — never the whole list of cited
keys, two of which a column line reads on other sheets. It is the selection the address carries
(`traceAddress` reads it, and falls back to `citedKeysOf` for a line that states none). `sourceKeys`
keeps its meaning, every key the line cites (`citedKeysOf`), because the register JSON export
publishes it under that meaning (I-426).

**The origin mark.** `register.css` styles the cell, never the pattern:
`.cx-register-source [data-origin="true"]` takes `background: var(--beam-100)`, `box-shadow: inset
2px 0 0 0 var(--beam-500)`, `padding-inline: var(--space-1)`, `border-radius: var(--radius-2)` — the
rail's selection idiom (R-UI-030: a 2 px inset beam bar over a beam-100 fill), the one place in this
workspace it is spent. Exactly one such element exists at a time. The mark is never the only channel:
`aria-current="true"` announces it, and the focus reticle stands on it the moment Back lands
(I-182). Row-level marking is not attempted — the row belongs to the shipped DataTable, and a
consumer that repainted its rows would be the B-17 defect; the cell the reader left from is the cell
the reader returns to.

**Restoring focus.** The row is NAMED, not hunted for: the workspace hands the shipped table
`scrollToRowId={originLine}` and the table answers with that row scrolled to and drawn, whatever its
virtualiser's window had reached (DataTable v2, §8's paid IOU). The reticle is then taken by the
anchor itself as it mounts, through a ref callback and at most once per address: if the browser
refuses the focus — the row is still being laid out under a viewport that is scrolling — nothing is
claimed that did not happen and the next paint of that row takes it; if the row re-mounts while it
held the reticle, the restoration is owed again, because a reticle that stood on the element the row
left behind is a reader standing on the document body answering no key. A row the table does not
show mounts no anchor, so nothing is focused and nothing is said (I-182). The workspace reads
nothing of the primitive's insides to do this.

## 2. States (R-UI-050) — this Decision's cells only

`REGISTER_STATES` in `takeoff/register/states.ts` stays the one enumerable home the suite reflects
over; no second matrix is declared, and `register-workspace[data-state]`'s precedence is unchanged
(`loading · denied · offline · error · refused · empty · partial · ready`). What the Trace changes,
cell by cell:

- **Loading** — unchanged in substance; the bones themselves are s-takeoff.md §2's, which v22 re-cut
  to the regions this screen in fact has (five 28 × 128 chips and a count bone over a rail bone and a
  grid bone). Never a spinner on the table. No link, no origin mark and no focus is attempted while
  the route is loading — `?line=` is honoured after the table's first paint, once.
- **Empty** — unchanged copy and unchanged single action. A `?line=` on an empty register focuses
  nothing (I-182); the empty state teaches the same next step it always did.
- **Error** — unchanged but for the report id, which s-takeoff.md §2 now renders through an `IdChip`:
  `takeoff_register_error_heading` / `_body`, the id under `takeoff_register_report_label`, and
  `register-retry`. A Trace address is not retried here;
  the viewer at the other end owns its own read (`viewer-inspector-trace-retry`).
- **Refusal** — unchanged: the one RefusalState in `register-answer` and in each `register-refusal`
  row. The Trace introduces no code: a line the project does not hold is a fact, answered at the
  viewer end as `missing` (I-88's idiom), never a registry entry.
- **Partial** — widened by I-181 and rendered, never hidden: a line whose sheet cannot be resolved,
  and a DEFAULTED line, keep their chips as plain text in the same cell beside rows that carry links.
  The difference is visible (a rule and a glyph, or neither) and it is honest — those figures did not
  come from a place this register can open. Repudiated lines stay withheld and counted at the index
  rail's foot (I-173), and no `evidence-link` exists for them anywhere.
- **Offline** — unchanged banner (`takeoff_register_offline`, `role="status"`, info chrome) and
  unchanged disabling of the three act doors and the group confirm. The link is **not** disabled:
  following it is a read, the address is the state, and the viewer answers for its own connection.
- **Permission-denied** — unchanged: `data-state="denied"`, the act doors absent, the standing
  `takeoff_register_denied_permission` / `_holder` pair over the `PERMISSION_NOT_HELD` RefusalState.
  The links render in this cell too — reading the register and tracing a line need membership and
  nothing more, which the shell guard settled before the route mounted.

## 3. Copy, verbatim

One visible word enters this screen, by I-425: `takeoff_register_source_model_space` **Model space**,
the chip's first part for a line that stands on no numbered sheet (`src/ui/strings/takeoff.ts`,
mirrored in `register-ui/copy.ts` under `tests/takeoff/register-ui/copy-mirror.test.ts`). Otherwise
no new sentence enters this screen. The cell's words are model data — the sheet, the mark and
the handle, each verbatim, in mono (I-25, I-26), the whole key one disclosure away — and the column
keeps `takeoff_register_col_source` **Source** as its header, which is what names the link for a reader and for a screen reader. The one string the
cell shows beyond data is the pattern's own, on hover: `evidence_link_title` **Trace to the sheet**
(`src/ui/strings/evidence-link.ts`, quoted here as it renders, owned there). `src/ui/strings/
takeoff.ts` and the module's mirrored `copy.ts` are untouched, so
`tests/takeoff/register-ui/copy-mirror.test.ts` still passes on an unchanged pair.

Voice, unchanged and re-affirmed: calm, concrete, professional; no exclamation marks; no build
vocabulary — "rail", "gate", "seam", "ingest", "manifest" and every clause id appear nowhere a
reader can see. The word *Trace* is the product's own name for the moment (X-2), and it appears only
in the tooltip.

## 4. Motion (R-UI-004)

Nothing new eases. The link's colour and underline transition over `var(--motion-state)`
`var(--ease)` in the pattern's own stylesheet; the reticle draws in its single home. The origin mark
appears with the row, untweened — a mark that faded in would perform an arrival the reader already
made. Restoring focus never animates: the viewport is set, not scrolled (`scrollTop` assignment, no
`behavior: "smooth"`), because a register that glides on Back is theatre in front of a fact, and a
smooth scroll under `prefers-reduced-motion` would be a second thing to zero. Every duration reached
is a token zeroed at source, so `register.css` still carries no `prefers-reduced-motion` branch.

## 5. Tokens

Added to s-takeoff.md §5's set, and nothing else: `--beam-100` and `--beam-500` (the origin mark),
`--radius-2`, `--space-6` (the placed label's line box, s-takeoff I-350 (c)), and the seven basis
colours reached only through `EvidenceLink` — never named in
`register.css`, which spells no basis and no hex. Px literals, added to that file's closed set: the
column's 180 (a `size`, the class its nine siblings already belong to) and the mark's 2 px inset bar.
The `rowHeight` used to restore the origin is read from `--row-comfortable` / `--row-compact` at
runtime and is never a literal. No copper anywhere: tracing commits nothing.

## 6. Themes

`register.css` gains no `[data-theme]` selector; every light/dark difference arrives through token
values (R-UI-001). The origin mark holds in both: beam-100 (#E8E6F7 / #1A1830) sits one step off the
table's graphite-0 field in either theme, the beam-500 bar clears the 3:1 UI floor on both, the
graphite-900 key clears 4.5:1 on beam-100 in both, and each basis glyph and underline clears 3:1 on
beam-100 in both — the tightest, `--basis-defaulted` light, at 4.28:1 (evidence-link §6). The mark
survives greyscale as a fill plus a bar plus `aria-current`, and the link survives it as a glyph, so
neither is colour-only meaning (R-UI-002, R-UI-060).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/takeoff/register?line={lineId}` (`originAddress`, `LINE_PARAM`
= `"line"`), and the address this screen composes and links,
`/t/{tenant}/p/{project}/viewer/{drawing}/{layout}?s={KEY,…}&line={lineId}` (`traceAddress`) — `s`
in cited order, `line` last, no `v`. `registerRoute` keeps its name and its spelling.

Test ids: **none are added to this screen.** The cell is addressed through the pattern's own
`evidence-link` and `evidence-link-glyph` inside `register-lines`, and the workspace's twenty-eight
ids (s-takeoff.md §7) stand unchanged. Attributes under test, all on the anchor: `data-line`
(the lineId), `data-basis` (the line's `quantityBasis`), `data-key` (the line's `sourceKey`, whole —
I-287), `data-origin="true"` on exactly one link
when the address names a line the table shows, `aria-current="true"` beside it, and `href` = the
`traceAddress` for that line. The refusal row's object key is addressed at the registry's own
`register-refusal-object`, now carried by an `IdChip` whose `data-value` is the placement key whole
(I-287 (c)) — a read of that row asserts the datum, never the text.

Asserted absences, which are the substance of I-179 and I-181: no `evidence-link` on a repudiated
line (it is not a row at all, I-173); no `evidence-link` on a DEFAULTED line or a line with no
resolvable sheet; no `evidence-link` outside `register-lines` anywhere under `register-workspace`
— not in the object inspector, not on a refusal row, not on a reading; exactly one `evidence-link`
per rendered row; no `v=` in any `href`; no `pushState` call; `history.replaceState` called with the
origin address **before** the click's default is allowed to proceed, and `preventDefault` never
called.

Suites: `tests/ui/takeoff-register/**` (jsdom mounts of `RegisterWorkspace` over the existing
`registerFixture()` / `linesFixture(n)`, chrome bound to the shipped components including
`EvidenceLink`, per I-170) for the cell, the stamp, the withheld cases and the origin restore;
`identifier-exposure.test.ts` in the same directory for I-287, staging the keys the product in fact
derives (`viewKeyOf` / `placementKeyOf` in the suite's own `support/fixtures.ts`, spelled by the
contract and never imported from the product) and reading the craft rubric's own three patterns over
every text node of the workspace; `tests/takeoff/trace/**` for `traceAddress`, `originAddress`,
`citedKeysOf` and the two doors.
Journey: `tests/e2e/journeys/j-021-column-slice.spec.ts` through
`tests/e2e/pages/s-takeoff.page.ts` and `tests/e2e/pages/s-viewer-trace.page.ts`, staged by
`tests/e2e/takeoff/register-stage.ts`. **Amended by VD-1:** the stage cites production's key shapes
— a view anchored at the drawn plan's caption, each member's placement key for its count, the
schedule's entities for its section and height — and writes each member's placement row naming the
outline and the mark the plan draws, on a sheet spelled `model` as the extractor spells it; the
`cite` option and its layer-feed handles are gone, and J-021 asserts the Trace selects exactly the
member and that holding its outline lists its line alone. J-000's `m3-measure-and-register` follows a
real BNBC column line to S-10 (checkpoint `j-000/bnbc-traced`). Checkpoints `j-021-column-slice/traced` and `/cited`, axe
serious/critical = 0 at each, never widened; `masks()` keeps s-takeoff.md §7's per-run texts, which
v22 narrows to the ones still painted (`register-campaign`, `register-refusal-object`,
`register-timeline`, the shell breadcrumb, `shell-user`, `shell-tenant-switcher`) — the inspector's
`register-source-key` and `register-object-key` now stand inside a disclosure that is closed at rest. Re-baselined under B-20 only where bytes move:
`tests/e2e/baselines/design/j-021-column-slice/**` and the gallery shell pair.

## 8. Recorded IOUs (owner named, never a comment in `src/`)

s-takeoff.md §8's Trace IOU is **paid** by this Decision and is struck in the same commit that lands
it. New and carried: EvidenceLinks on queue items, certificate cells, BOQ lines and the register
inspector's readings — owner: those surfaces' own leaves (R-UI-022 names four; this is one).
`scrollToRow` on the shipped DataTable is **paid**: v2 takes `scrollToRowId` and draws the row it is
named, so §1's restoration no longer reads `datatable-viewport`, measures `datatable-row`s or
announces a scroll it made itself — the screen names the row and the table answers with it drawn
(B-17). An origin that survives a reload beyond
the `?line=` address, and pushState history for the register — deliberately absent: the address is
the state. A `layout` column on partition views, so a line names its sheet without `sheetOfView`
falling back to the ingest's single recorded layout — **paid by VD-1 without one**: the sheet is read
per line off the pinned record's frames (viewer.md Part 2 §8). The queue items' Trace (R-TO-011's
"queue item") stays unpaid — owner: VD-3. Column pin, resize and sort persistence are **paid** by DataTable v2's own
per-user furniture (`cubit.datatable.v1:takeoff-register-lines`); the index rail's remembered width
is not — owner: the prefs seam's node, unchanged. The inspector's width IS remembered, by the frame.
