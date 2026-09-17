# Design Decision — S-Settings-Ruleset (the project rule-set settings screen)

```
┌R─┬─────────────┬──────────────────────────────────────────────────────────────┐
│  │ ws › Projects › Rule set                                  ⌘K ⟳ ✉ ◉         │
│  ├─────────────┼──────────────────────────────────────────────────────────────┤
│  │Participants │ Rule set  (i)                                                │  header 40
│  │Rule set   ◂ │ Pinned edition  (i)                                          │  section 28
│  │Taxonomy     │ project  IS1200_IN @ 2026.08   Content digest  a3f9c2d…      │  ONE line
│  │Tax          │ Lineage  (i)                                                 │  section 28
│  │             │ ┌──────────┬────────────────────────┬──────────────┐         │
│  │             │ │ Scope    │ Edition                │ Content diges│         │  28 px rows
│  │             │ │ platform │ IS1200_IN @ 2026.08    │ a3f9c2d…     │         │
│  │             │ │ tenant   │ IS1200_IN @ 2026.08    │ a3f9c2d…     │         │
│  │             │ │ project  │ IS1200_IN @ 2026.08    │ a3f9c2d…     │         │
│  │             │ └──────────┴────────────────────────┴──────────────┘         │
│  │             │ Parameters                                                   │  section 28
│  │             │ ┌────────────────────────────┬──────────┬────────┐           │
│  │             │ │ Parameter                  │    Value │ Unit   │           │  28 px rows
│  │             │ │ Opening deduction minimum  │      0.1 │ m2     │           │
│  │             │ │ Member end no-deduct max…  │      500 │ cm2    │           │
│  │             │ └────────────────────────────┴──────────┴────────┘           │
└──┴─────────────┴──────────────────────────────────────────────────────────────┘
       160                              the content pane
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| section nav | the project's settings areas; Rule set carries `aria-current` | 160 × 100 % (`--drawer-w-min`), rows `--control-h` | — (an area with no screen is shown disabled with its reason in a tooltip) | — | — |
| header | the title and the `(i)` that holds the caption | 100 % × 40 | — | — | — |
| pinned edition | ONE line: the scope, the edition L-MEA-01 spells, and the content digest as a chip | 100 % × `--row-h` | the whole screen is the unpinned notice instead (I-28) | the root boundary (`src/app/error.tsx`) | `loading.tsx` bone at the row height |
| lineage | the chain the pin was forked along, platform → tenant → project, as a 3-row grid | 100 % × 3 × `--row-h` | never — a pinned edition always has a chain, and its own step is in it | the root boundary | three bones at the row height |
| parameters (primary) | every value a measurement on this project reads | flex × `--row-h` rows | never — an edition with no parameter is not an edition | the root boundary | bones at the row height |
| unpinned (the empty state) | `ShellEmptyState`: why there is nothing, and the one way onward | centred in the pane | this IS the empty leg | — | — |

Built on Design Direction 00 §3.6's Settings template, whose geometry outranks this file where the
two disagree (§3's precedence); what the rebuild changed is recorded as I-204–I-208 below.


Route: `/t/{tenantId}/p/{projectId}/settings/ruleset` under
`src/app/(app)/t/[tenant]/p/[project]/settings/ruleset/**`, inside the shell frame and behind
the membership guard in `t/[tenant]/layout.tsx`. Increment inc-015-ruleset-editions. Law:
R-SPINE-012, L-MEA-01, L-REG-07, R-UI-001/003/004/005/012/020/031/050/060, B-17, Q-11, Q-17.
Every convention of the primitives-core Decision binds: `cx-` classes, tokens-only colour and
motion, `cx-reticle` solely from its single home, no `[data-theme]` selector in authored CSS.
Interpretations I-1–I-23 of the earlier Decisions remain in force ("workspace" is the
user-facing word for tenant, s-auth I-11). Chrome comes only from shipped primitives — core
Badge, UnitBadge, Skeleton, and the shell's `ShellEmptyState` — plus the `cx-ruleset-*`
classes this file rules. The screen is read-only: no act, no copper, no form (authoring is
M3, inc-304).

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-24 — copy lives in the route directory, by ownership.** Every earlier screen keeps its
  strings in `src/ui/strings/*`; this increment does not own that path. Ruling: all copy sits
  in `strings.ts` beside the page (keys `ruleset_…`), under the same discipline — the JSX
  carries no string literal beyond test ids and fixed attribute values. Folding these keys
  into the `src/ui/strings` barrel is owed by the node that owns it (recorded IOU, never a
  comment in src — Q-17).
- **I-25 — scope, name, version and parameter keys are model data, rendered verbatim.**
  Identity is `(scope, name, version)` and the closed key set is the contract; `tenant`,
  `IS1200_IN`, `2026.08` and `openingDeductionMinM2` are source keys, so they render in
  `var(--font-mono)` exactly as stored (the BasisChip precedent: the enum value, never
  title-cased). Prose around them says "workspace", never "tenant" (I-11); the data label
  lawfully says `tenant`, because it is data, not prose.
- **I-26 — the digest renders whole.** A digest exists to be compared; a truncated one
  compares nothing. Every digest on this screen renders in full, wrapping
  (`overflow-wrap: anywhere`), with `user-select: all` so one click selects the whole value
  for copying. Identity and digest are both labelled, side by side — L-MEA-01: surfaces show
  both and neither substitutes for the other.
- **I-27 — the unit is edition data, not screen copy.** Each parameter arrives from
  `projectRulesetView` as `{ value, unit }` — value a decimal string, unit a short display
  string; dimensionless parameters (tolerances and placement shares) carry `ratio`. The
  screen invents no unit and re-derives none from the key; it renders the view's unit in a
  UnitBadge and the value through `formatUserFigure` (`src/core/format`) — grouping is the
  seam's, precision is the edition's, verbatim.
- **I-28 — the no-pin answer is the empty state, not a refusal.** L-REG-07 makes an unpinned
  project unrepresentable, so the no-pin shape means "this address names no project here".
  The taxonomy is closed and `src/core/errors.ts` is another node's, so no code is registered
  and no RefusalState renders; the honest absence notice (§2) is this screen's empty state,
  and it says why it is empty (R-UI-020). The no-pin shape carries the `tenantId` it was
  asked about — `{ pinned: false, tenantId }` against the pinned `{ pinned: true, … }` — so
  the way onward (`/t/{tenantId}`) is buildable from the section's one prop.
- **I-29 — a static `<table>`, not DataTable.** Seventeen closed rows, fixed order, no sort,
  no filter, no edit, no virtualisation: DataTable would be machinery with none of its
  behaviour in use. A semantic `<table>` with hairline dividers, `var(--row-comfortable)`
  rows and right-aligned mono numerals satisfies R-UI-005 directly and re-implements no
  shipped behaviour (B-17 is about copying a primitive's behaviour or CSS; this copies
  neither). No density control ships here — the per-user preference seam binds to DataTable
  surfaces, and a control that restyles one static table would be theatre.

- **I-30 — the rail states the area, and it says ancestor rather than page.** This route sits
  under a workspace and names no shell area, so `areaOf` answers `projects` and the shell
  selects the Projects row. It does not claim to BE that page: `isAreaHome`
  (`src/ui/shell/routes.ts`, beside the mapping it refines, B-17) reads the address against
  the area's own home, and the row carries `aria-current="page"` only there — on this route
  it carries `aria-current="true"`, the current item of the set. The paint is the same in
  both (the selection rules key on `[aria-current]`, not on its value), so a keyboard or
  screen-reader user still has a statement of where they are; what differs is that the
  statement is true. The breadcrumb follows the same reading: at the area's home the area
  crumb is the current page, and here it is a link back to Projects, with no crumb claiming
  to be this page — naming the project and this screen in the trail is inc-011's, the same
  IOU §1 records.

- **I-204 — the screen is drawn in the settings TEMPLATE.** Design Direction 00 §3.6 rules
  settings a two-pane template, and its one home is
  `src/app/(app)/t/[tenant]/settings/settings-pane.tsx` (members' I-198). `page.tsx` renders
  `SettingsPane` with the PROJECT's areas — Participants, Rule set, and the two the product
  has promised and not built — and the section itself stays free of the frame, so the
  component a suite mounts is still the component a browser renders.
- **I-205 — I-29 is superseded: the parameter table IS the shipped DataTable.** §5 of the
  Direction makes the DataTable the one grid of the product and names this screen among its
  consumers; the rule-set table was migrated to it with its ids kept byte-identical. What
  I-29 was protecting — no machinery a screen does not use — is answered by the grid's own
  opt-ins: sorting, filtering and editing are off, and what the screen gains is the 28 px
  row, the frozen key column, the truncation contract and the remembered column furniture
  every other table in the product now has.
- **I-206 — a digest is whole in the document and a chip on the screen.** I-26 is kept where
  it matters — the element publishes the FULL 64 characters, `user-select: all`, so what a
  reader copies and what a suite reads is the digest itself — and §6's "no machine
  identifier as body text" is kept too: the element is `data-technical`, the channel the
  rubric's C6 exempts, and it is drawn at the chip measure (`8ch`, the shipped IdChip's own
  short form) with the rest clipped. The shipped `IdChip` itself is NOT used here, and the
  reason is recorded rather than hidden: this screen's acceptance reads
  `ruleset-edition-digest`'s text as EXACTLY the digest and the J-003 journey requires that
  element to be visible, and `IdChip` renders the short form as its text — so adopting it
  would require amending an acceptance this node does not own. **Owed:** either an `IdChip`
  variant that publishes the whole value as its text, or the acceptance amended to read
  `data-value`; until then the chip is this screen's own three CSS rules.
- **I-207 — the lineage is a 3-row grid, and the key column is gone.** The chain reads as
  scope · edition · digest across one 28 px row per step (§3.6), which is what makes a
  verbatim fork visible as three identical digests. The parameter table drops its `Key`
  column with it: `openingDeductionMinM2` is a machine identifier, §6 forbids one as body
  text, and the key a row is addressed by is already on the row as `data-param` — where the
  acceptance, the export and an operator read it from.
- **I-208 — the four helper sentences are behind `(i)` popovers.** §6 allows at most one
  helper line per screen and this screen has none: `ruleset_caption` is the header's
  disclosure, `ruleset_edition_hint` and `ruleset_lineage_hint` their own sections'. The
  sentences are not deleted — they are law, and they are one press away from the heading
  they explain.

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments, calls
`projectRulesetView({ tenantId, projectId })`, renders the section inside `SettingsPane` with
the project's own areas — I-204), `loading.tsx`, `ruleset-settings-section.tsx` (exports
`RulesetSettingsSection({ view })`, a client module because the grid it renders is one, and
mountable under jsdom), `strings.ts` (I-24), `states.ts` (§2), `ruleset.css`. The page passes
the raw URL segments; the view answers the no-pin shape for anything that names no pin — a
non-uuid segment included, never a driver fault (the shell's `scopedTenantId` precedent).

The screen renders in the template's content pane, one column `cx-ruleset`, gap
`var(--gap-section)`. Rail and breadcrumb are the shell's and this screen does not restyle
them: `areaOf` reads any address under a workspace that names neither `books` nor `settings`
as being in Projects, so the Projects rail row is selected and carries `aria-current="true"` —
the area it is in, not the page it is (I-30) — while the section nav beside the content is what
says which settings area a reader is standing in (I-204). The nav is also the visible
navigation between this screen and Participants, which is the debt I-30's IOU recorded.

**The header** (40 px): `<h1>` `ruleset_heading` at `var(--text-20)` `var(--weight-heading)`,
then the `(i)` holding `ruleset_caption` (I-208). No subtitle, and no second line anywhere on
the screen.

### Pinned edition (`<section aria-labelledby>`)

This section gives up its own heading, and §8 is why: "the table starts at y ≈ 88" cannot be
true of a screen that spends a heading line on naming what the line under the title already is.
The screen is called "Rule set" and the first thing under it IS the pin, so the section is named
for a screen reader (`aria-label` `ruleset_edition_heading`) and shows ONE line
(`<p class="cx-ruleset-pin">`, `--row-h` tall, flex, gap `var(--space-2)`), with the `(i)`
holding `ruleset_edition_hint` at its trailing edge:

- `<span data-testid="ruleset-edition-identity">` — the scope in `<span data-scope={scope}>`
  (`var(--font-mono)` `var(--text-12)` `var(--ink-muted)`), then the name, a ` @ ` joiner and
  the version as one mono run (`IS1200_IN @ 2026.08`, L-MEA-01's own spelling),
  `var(--text-13)` `var(--weight-body-medium)` `var(--ink-code)`. All three identity fields are
  visible text (AC-4), and the digest is NOT inside this element: identity and digest are two
  fields and neither substitutes for the other (L-MEA-01).
- `ruleset_digest_label` as a muted 12 px word, then
  `<span data-testid="ruleset-edition-digest" data-technical>` — the digest, whole in the
  document and drawn at the chip measure per I-206.

### Lineage (`<section aria-labelledby>`)

A section line with `<h2>` `ruleset_lineage_heading` and the `(i)` holding
`ruleset_lineage_hint`, then one `DataTable` (table id `ruleset-lineage`) inside
`<div data-testid="ruleset-lineage">`: exactly the steps the view answers, platform → tenant →
project, one 28 px row each carrying `data-testid="ruleset-lineage-step"` and `data-scope`,
three columns —

- **Scope** (120, the frozen key column) — the step's own scope, mono, muted: model data,
  rendered verbatim (I-25).
- **Edition** (280) — that step's `name @ version`, mono.
- **Content digest** (160, headed by `ruleset_digest_label`) — that step's digest, as I-206
  draws one. At M0 all three read identically — that sameness is the verbatim-fork fact this
  section exists to show, and the day an authored re-pin diverges a step (M3) the difference is
  visible here without a redesign.

### Parameters (`<section aria-labelledby>`)

A section line with `<h2>` `ruleset_parameters_heading`, then one `DataTable` (table id
`ruleset-parameters`) inside `<div data-testid="ruleset-parameter-table">`: one 28 px row per
parameter in exactly the view's order, each carrying `data-testid="ruleset-parameter-row"` and
`data-param={key}`, three columns (I-207) —

- **Parameter** (320, the frozen key column, so the grid names the row by it — `rowheader`,
  which is what `<th scope="row">` was in the raw markup this screen used to write) — the human
  label from §3's table (keyed `ruleset_param_{key}`; an unknown key falls back to the key
  itself, because the screen never hides a parameter it has no wording for).
- **Value** (160, right-aligned) — `formatUserFigure(value)`, mono, `tabular-nums
  slashed-zero`: grouping is the seam's and precision is the edition's (I-27, L-FMT-02).
- **Unit** (96) — the shipped UnitBadge over the view's unit string (I-27).

Nothing on this screen is interactive beyond the two disclosures, the grid's own column
furniture and the one link the empty state carries: the screen is read-only, and authoring is
M3's (inc-304).

### Unpinned (the empty state)

For `{ pinned: false, tenantId }` the header block renders unchanged, then
`<div data-testid="ruleset-unpinned">` wrapping one shipped `ShellEmptyState` (its own
`shell-empty` ids nest inside; the wrapper adds none): heading `ruleset_unpinned_heading`,
body `ruleset_unpinned_body`, and in the action slot one `next/link` `<a>` to
`/t/{tenantId}` in the evidence-link idiom (`var(--text-13)` `var(--weight-body-medium)`
`var(--beam-600)`, underlined, hover `var(--beam-500)`, `cx-reticle`), label
`ruleset_unpinned_action`. Nothing else renders — no identity, no digest, no lineage, no
table, and no skeleton pretending data is coming.

## 2. States (R-UI-050), ruled cell by cell

Declared in the enumerable home `states.ts` (route directory), export
`RULESET_SETTINGS_STATES` — one row, seven cells in the shell matrix's cell shape
(rendered / delegated / impossible, each naming its module, hook or reason);
`tests/rulesets/state-matrix.test.ts` walks it.

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the layout the grids will
  take, gap `var(--space-2)` — 24 × 240 px for the header's title, then seven bones at the row
  height (28 × min(560–640 px, 100 %)) standing for the pinned line, the three lineage rows and
  the parameter grid. A bone that kept a height the answer does not keep is a layout that moves
  under the reader (§5 rule 8).
- **Empty** — the unpinned surface (§1, I-28): what it teaches is that a project carries its
  rule set from creation, and its one action leads to Projects.
- **Error** — a render or read fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral.
- **Refusal** — delegated to the root error boundary. The screen performs no procedure and
  registers no code of its own (I-28), but it is not refusal-free: values render through
  `formatUserFigure`, which refuses `PRECISION_NOT_APPLIED` for a stored value that is not a
  well-formed decimal, and parameters arrive from a `json` column rather than from a literal.
  A store that holds such a value is inconsistent, not answering the reader, so the throw
  surfaces on `src/app/error.tsx` like any other read fault; no RefusalState renders here.
- **Partial** — impossible: one view, answered whole or as the no-pin shape; there are no
  refusable rows.
- **Offline** — a fault of reachability (shell I-20): server-rendered page, failed
  navigation surfaces the error path; no invented banner, and no data ages on screen.
- **Permission-denied** — delegated: `t/[tenant]/layout.tsx` renders the shell's frameless
  denial surface before this route mounts; an unauthenticated request is the `/sign-in`
  redirect. This screen never renders for a workspace the session does not hold.

## 3. Copy, verbatim (`strings.ts`, keys `ruleset_…`)

`ruleset_heading` **Rule set** · `ruleset_caption` **Pinned when the project was created.
Every measurement on this project reads exactly these values.** · `ruleset_edition_heading`
**Pinned edition** · `ruleset_edition_hint` **The identity names this edition; the digest
fingerprints its exact content. Two editions with one digest hold identical values.** ·
`ruleset_identity_label` **Identity** · `ruleset_digest_label` **Content digest** ·
`ruleset_lineage_heading` **Lineage** · `ruleset_lineage_hint` **The chain this pin was
forked along, platform first. A verbatim fork carries its parent's digest unchanged.** ·
`ruleset_lineage_col_scope` **Scope** · `ruleset_lineage_col_edition` **Edition** ·
`ruleset_parameters_heading` **Parameters** · `ruleset_col_parameter` **Parameter** ·
`ruleset_col_value` **Value** · `ruleset_col_unit` **Unit** ·
`ruleset_unpinned_heading` **No rule set to show** · `ruleset_unpinned_body` **This address
does not name a project in this workspace. A project pins its rule set when it is created,
so a project that exists always has one.** · `ruleset_unpinned_action` **Go to Projects**.

Parameter labels (`ruleset_param_{key}`), with the seed's display value and unit (I-27) —
this order is the render order. The area units read `m2` and `cm2`: the unit is edition
content, and L-FMT-02 refuses a character the pinned document font has no glyph for — the
covered ranges in `src/core/format` hold no U+00B2, so a superscript two stored in an
edition would be a value no bill could render.

| key | label | value | unit |
|---|---|---|---|
| openingDeductionMinM2 | **Opening deduction minimum** | 0.1 | m2 |
| memberEndNoDeductMaxCm2 | **Member end no-deduct maximum** | 500 | cm2 |
| embeddedDuctNoDeductMaxCm2 | **Embedded duct no-deduct maximum** | 100 | cm2 |
| finishOpeningDeductionMinM2 | **Finish opening deduction minimum** | 0.1 | m2 |
| finishMinOutlineArea | **Finish outline minimum area** | 0.2 | sft |
| finishMaxOutlineArea | **Finish outline maximum area** | 20,000 | sft |
| scaleVerificationTolerance | **Scale verification tolerance** | 0.01 | ratio |
| scaleAnisotropyTolerance | **Scale anisotropy tolerance** | 0.01 | ratio |
| earthworkWorkingAllowance | **Earthwork working allowance** | 1.5 | ft |
| earthworkDepthExtra | **Earthwork extra depth** | 0.5 | ft |
| blindingProjection | **Blinding projection** | 3 | in |
| blindingThickness | **Blinding thickness** | 3 | in |
| placementContainmentMerge | **Placement containment merge share** | 0.08 | ratio |
| placementNearAnchor | **Placement near-anchor share** | 0.9 | ratio |
| placementFootprintMin | **Placement footprint minimum share** | 0.6 | ratio |
| placementFootprintMax | **Placement footprint maximum share** | 2.5 | ratio |
| placementHumanSnap | **Placement human snap share** | 0.5 | ratio |

Voice: calm and concrete, no exclamation marks, no build vocabulary in prose (I-25 rules the
data labels). The 20,000 grouping is `formatUserFigure`'s, never typed into copy.

## 4. Motion (R-UI-004)

None beyond the inherited idioms: the unpinned action link's colour over
`var(--motion-state)` `var(--ease)`, the reticle draw and the Skeleton pulse in their single
homes. Sections, the table and the empty state appear with no entrance — answers arrive
instantly. Every duration is a token zeroed at source under reduced motion.

## 5. Tokens

Semantic aliases only (§4's rule 3 — no `--graphite-*`/`--beam-*` reference outside the token
source): `--ink` / `--ink-muted` / `--ink-code` · `--line` through `--hairline` · the density
and layout tokens the screen is drawn at — `--row-h`, `--control-h`, `--gap-section`,
`--drawer-w-min` · `--space-1/2` · `--text-12/13/14/20` · `--font-mono` ·
`--weight-body-medium` / `--weight-heading` · `--motion-state` / `--ease`. Px literals: NONE.
The digest's measure is `8ch` because what it fixes is a count of CHARACTERS of a fingerprint
(I-206), and every other measure on this screen is a token or a grid column's own width.
`tests/ui/craft/mechanical.test.ts` scores this file for both.

## 6. Themes

`ruleset.css` and the template's `settings.css` contain no `[data-theme]` selector; every
light/dark difference arrives through token values (R-UI-001), and dark is the default the
screen is first seen in. Nothing here differs between the themes beyond the token flips: the
ink aliases on the app surface, hairline seams, the beam of the current nav row and of the
empty state's link. Contrast holds on founder facts: every ink alias used here on the app
surface ≥ 4.5:1, `--ink-link` ≥ 4.5:1, in both themes. No basis colour, no semantic tint and
no copper appears anywhere on this screen — it carries no act.

## 7. Test hooks (closed contract, C-05)

Route: `/t/{tenantId}/p/{projectId}/settings/ruleset`. Test ids, exactly the seven of the
contract — the same closed roster, on the elements §1 now rules: `ruleset-edition-identity` ·
`ruleset-edition-digest` (the chip, whole in the document per I-206) · `ruleset-lineage` (the
grid's container) · `ruleset-lineage-step` (each grid row, three for a pinned view) ·
`ruleset-parameter-table` (the grid's container) · `ruleset-parameter-row` (each grid row,
`data-param={key}`) · `ruleset-unpinned` (the wrapper; ShellEmptyState's own ids nest inside).
No others are added; the grid's own ids are the DataTable's, ruled by its Decision.

Behavioural hooks without new ids: `data-scope` on the identity's scope span and on each
lineage row, asserting the platform → tenant → project order; `role="rowheader"` on each
parameter's label cell (what `<th scope="row">` was before the grid); `data-technical` on both
digest elements; `aria-current` on the nav's current row; the `<h1>`/`<h2>` hierarchy per §1;
the unpinned action's `href` `/t/{tenantId}`.

Acceptance (AC-4) mounts `RulesetSettingsSection` under jsdom with @testing-library/react
over two fixtures in `tests/rulesets/**`: a pinned view built from the exported seed content
and identity with its digest computed by `editionDigest` (never a spelled hex literal) and a
three-step lineage sharing that digest; and the no-pin shape, asserting the absence notice
and that no pinned-view id renders beside it. No new journey ships (the J-000/J-001 roster
is frozen); painted facts are graded by the design gallery's baselines when this screen's
consumers land, per R-UI-011.

## Changelog

- 2026-09-18 — inc-304a-ruleset-authoring-ui: this screen no longer renders `SettingsPane` itself.
  The project settings frame is `settings/layout.tsx` over `PROJECT_SETTINGS_AREAS`
  (docs/design/s-settings.md), which draws four rows where this screen drew two and reads the active
  row off the address; `projectSettingsNav` is gone (B-17). Nothing of this screen's own content,
  copy, ids or states moved — the committed picture of it moves with the nav's two new rows and is
  re-taken by the journey runner (B-20).
