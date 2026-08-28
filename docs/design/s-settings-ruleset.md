# Design Decision — S-Settings-Ruleset (the project rule-set settings screen)

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

## 1. Layout and hierarchy

Files in the route directory: `page.tsx` (thin server component: reads the two segments,
calls `projectRulesetView({ tenantId, projectId })`, renders the section), `loading.tsx`,
`ruleset-settings-section.tsx` (exports `RulesetSettingsSection({ view })`, mountable under
jsdom), `strings.ts` (I-24), `states.ts` (§2), `ruleset.css`. The page passes the raw URL
segments; the view answers the no-pin shape for anything that names no pin — a non-uuid
segment included, never a driver fault (the shell's `scopedTenantId` precedent).

The page renders in `shell-main`, one column `cx-ruleset`: `max-width: 800px`, column flex,
`gap: var(--space-6)` between sections. Rail and breadcrumb are the shell's; no rail row
matches a project-level route, so none carries `aria-current` here. Recorded IOU: visible
navigation to this screen (project switcher, project crumbs, a settings link inside the
project) is owed by inc-011, which ships the project surfaces and adopts the `p/[project]`
base — until then the route is test- and URL-reachable, and that debt is inc-011's, not this
screen's (R-UI-031, the /sessions precedent).

Header block (`gap: var(--space-2)`): `<h1>` `ruleset_heading` — `var(--text-20)`
`var(--weight-heading)` `var(--graphite-900)`, margin 0 — over the caption `ruleset_caption`
in `var(--text-13)` `var(--graphite-600)`.

### Pinned edition (`<section aria-labelledby>`)

`<h2>` `ruleset_edition_heading` (`var(--text-16)` `var(--weight-heading)`
`var(--graphite-900)`, margin 0), hint `ruleset_edition_hint` (`var(--text-12)`
`var(--graphite-600)`), then a `<dl>` of two rows (each row grid
`160px minmax(0, 1fr)`, column gap `var(--space-4)`, row padding-block `var(--space-2)`):

- `<dt>` `ruleset_identity_label` — `var(--text-13)` `var(--weight-body-medium)`
  `var(--graphite-700)`. `<dd data-testid="ruleset-edition-identity">`, margin 0, inline
  flex gap `var(--space-2)`, baseline-aligned: the scope in
  `<span data-scope={scope}>` — `var(--font-mono)` `var(--text-12)` `var(--graphite-600)` —
  then the name, a ` @ ` joiner, and the version as one mono run, `var(--text-16)`
  `var(--weight-body-medium)` `var(--graphite-900)` `tabular-nums slashed-zero`
  (`IS1200_IN @ 2026.08`, per L-MEA-01's own spelling). All three identity fields are
  visible text (AC-4).
- `<dt>` `ruleset_digest_label`, same style. `<dd data-testid="ruleset-edition-digest">`:
  the full digest, `var(--font-mono)` `var(--text-12)` `var(--graphite-700)`
  `tabular-nums slashed-zero`, wrapped and selectable per I-26.

### Lineage (`<section aria-labelledby>`)

`<h2>` `ruleset_lineage_heading`, hint `ruleset_lineage_hint`, then
`<ol data-testid="ruleset-lineage">` — list-style none, margin 0, padding 0 — of exactly the
steps the view answers, platform → tenant → project. Each
`<li data-testid="ruleset-lineage-step" data-scope={scope}>`: padding-block `var(--space-2)`,
border-top `var(--hairline)` on every item after the first, two lines:

- Line one, flex gap `var(--space-3)`, baseline: the scope
  (`var(--font-mono)` `var(--text-12)` `var(--graphite-600)`, min-width 88 px so the three
  scopes column-align) then that step's `name @ version` (`var(--font-mono)`
  `var(--text-13)` `var(--graphite-900)`) — the step shows its own (scope, name, version),
  per the contract.
- Line two: that step's digest, `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`,
  whole and wrapping per I-26. At M0 all three read identically — that sameness is the
  verbatim-fork fact this section exists to show, and the day an authored re-pin diverges
  a step (M3), the difference is visible here without a redesign.

### Parameters (`<section aria-labelledby>`)

`<h2>` `ruleset_parameters_heading`, then `<table data-testid="ruleset-parameter-table"
aria-labelledby={the h2 id}>` — width 100 %, `border-collapse: collapse`. Header row: `<th
scope="col">` cells `ruleset_col_parameter` / `ruleset_col_key` / `ruleset_col_value` /
`ruleset_col_unit`, `var(--text-12)` `var(--weight-body-medium)` `var(--graphite-600)`,
text-align left (Value right), padding-inline `var(--space-3)`, border-bottom
`var(--hairline)`. Body: one `<tr data-testid="ruleset-parameter-row" data-param={key}>` per
parameter, in exactly the view's order (the seed renders the closed 17 in the §3 order),
height `var(--row-comfortable)`, border-bottom `var(--hairline)`, no hover fill (nothing here
is interactive):

- **Parameter** — `<th scope="row">`, the human label from §3's table (keyed
  `ruleset_param_{key}`; an unknown key falls back to the key itself — the screen never
  hides a parameter it has no label for), `var(--text-13)` `var(--weight-body-medium)`
  `var(--graphite-900)`, text-align left.
- **Key** — the key verbatim, `var(--font-mono)` `var(--text-12)` `var(--graphite-600)`.
- **Value** — `formatUserFigure(value)`, right-aligned, `var(--font-mono)` `var(--text-13)`
  `var(--graphite-900)` `tabular-nums slashed-zero`.
- **Unit** — the shipped UnitBadge over the view's unit string (I-27).

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

- **Loading** — `loading.tsx`, frame intact: core Skeletons keeping the page's layout, gap
  `var(--space-3)` — 24 × 240 px (heading), 16 × 360 px (identity), 16 × min(640 px, 100 %)
  (digest), then five 24 × min(800 px, 100 %) bones standing for lineage and table.
- **Empty** — the unpinned surface (§1, I-28): what it teaches is that a project carries its
  rule set from creation, and its one action leads to Projects.
- **Error** — a render or read fault surfaces the root error boundary
  (`src/app/error.tsx`, unowned here); its Decision rules retry and records the report-id
  deferral.
- **Refusal** — impossible: the screen performs no procedure and reaches no registered code
  (I-28). The registry stays untouched.
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
`ruleset_parameters_heading` **Parameters** · `ruleset_col_parameter` **Parameter** ·
`ruleset_col_key` **Key** · `ruleset_col_value` **Value** · `ruleset_col_unit` **Unit** ·
`ruleset_unpinned_heading` **No rule set to show** · `ruleset_unpinned_body` **This address
does not name a project in this workspace. A project pins its rule set when it is created,
so a project that exists always has one.** · `ruleset_unpinned_action` **Go to Projects**.

Parameter labels (`ruleset_param_{key}`), with the seed's display value and unit (I-27) —
this order is the render order:

| key | label | value | unit |
|---|---|---|---|
| openingDeductionMinM2 | **Opening deduction minimum** | 0.1 | m² |
| memberEndNoDeductMaxCm2 | **Member end no-deduct maximum** | 500 | cm² |
| embeddedDuctNoDeductMaxCm2 | **Embedded duct no-deduct maximum** | 100 | cm² |
| finishOpeningDeductionMinM2 | **Finish opening deduction minimum** | 0.1 | m² |
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

`--graphite-600/700/900` · `--beam-500/600` · `--hairline` · `--space-2/3/4/6` ·
`--text-12/13/16/20` · `--font-mono` · `--weight-body-medium/--weight-heading` ·
`--row-comfortable` · `--motion-state/--ease`. Px literals, closed set (core I-1's class):
the 800 px page measure, the 160 px `<dt>` and 88 px scope columns, and the skeleton bones
24/16 × 240/360/640/800. Any other literal is a defect.

## 6. Themes

`ruleset.css` contains no `[data-theme]` selector; every light/dark difference arrives
through token values (R-UI-001). Nothing on this screen differs between themes beyond the
token flips: graphite text roles on the graphite-0 main field, hairline seams, the beam link.
Contrast holds on founder facts: graphite-600 and 700 on graphite-0 ≥ 4.5:1, graphite-900
likewise, beam-600 on graphite-0 ≥ 4.5:1, in both themes. No basis colour, no semantic tint
and no copper appears anywhere on this screen.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/t/{tenantId}/p/{projectId}/settings/ruleset`. Test ids, exactly the
seven of the contract, on the elements ruled in §1: `ruleset-edition-identity` ·
`ruleset-edition-digest` · `ruleset-lineage` (the `<ol>`) · `ruleset-lineage-step` (each
`<li>`, three for a pinned view) · `ruleset-parameter-table` (the `<table>`) ·
`ruleset-parameter-row` (each `<tr>`, `data-param={key}`) · `ruleset-unpinned` (the wrapper;
ShellEmptyState's own ids nest inside). No others are added.

Behavioural hooks without new ids: `data-scope` on the identity's scope span and on each
lineage step, asserting the platform → tenant → project order; `<th scope="row">` on each
parameter's label cell; the `<h1>`/`<h2>` hierarchy per §1; the unpinned action's `href`
`/t/{tenantId}`.

Acceptance (AC-4) mounts `RulesetSettingsSection` under jsdom with @testing-library/react
over two fixtures in `tests/rulesets/**`: a pinned view built from the exported seed content
and identity with its digest computed by `editionDigest` (never a spelled hex literal) and a
three-step lineage sharing that digest; and the no-pin shape, asserting the absence notice
and that no pinned-view id renders beside it. No new journey ships (the J-000/J-001 roster
is frozen); painted facts are graded by the design gallery's baselines when this screen's
consumers land, per R-UI-011.
