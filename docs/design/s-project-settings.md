# Design Decision — S-Project-Settings (ruleset pane: edition, digest, lineage, parameters)

`/t/{tenantSlug}/p/{projectId}/settings/ruleset` is the rule-set pin made visible
(R-SPINE-012, L-REG-07, J-003): a read-only, fully server-rendered pane showing the edition a
project pinned at creation — its key, its digest, its platform → workspace → project lineage,
and all seventeen L-MEA-01 parameters with units. It renders inside the shell
(`docs/design/shell.md`) in `shell-main`'s centred 720 px column. Token names are
`docs/design/datum-tokens.md`; state anatomy is `datum-patterns.md`; no colour literal
anywhere (R-UI-001). Every other pane of project settings — project fields, participants,
roles, method files, authoring — is a later increment and is not designed anywhere yet; this
file grows those panes when they ship.

Interpretations recorded:

1. **The screen performs no act.** Authoring a new edition is M3 (R-SPINE-012) and its own
   permission (L-MEA-01); nothing here writes. No ConsequenceDialog, no form, no client
   component — the page is a server component with zero interactive elements of its own.
   `EDITION_IMMUTABLE` guards the database trigger and is reachable from no control on this
   screen, so no refusal is ever minted here (§6).
2. **Units are string-table text, never UnitBadge.** `formatUnit`'s closed enum (L-FMT-02)
   carries m/m²/m³/kg/nos and cannot spell sft, ft, in or cm²; extending the format seam is
   not this screen's to do. Unit cells render `project.ruleset.unit.*` verbatim (§5).
3. **Dimensionless parameters show `ratio`.** Seven parameters (the two scale tolerances, the
   five placement shares) carry no unit in L-MEA-01. An empty unit cell is silence, and
   silence is never lawful — the cell says `ratio` (§5).
4. **One grouping rule for every value** (increment risk note 8): split the canonical string
   at the decimal point, pass the integer part through `formatNumber(intPart, 'count')`
   (L-FMT-01 — the sole Intl caller; en-IN grouping, ASCII digits), reattach the fraction
   verbatim. `'20000'` → `20,000`; every other seed value is unchanged by the rule. No float
   exists anywhere in the path (B-07).
5. **Seventeen flat rows, contract order.** AC-3 fixes exactly seventeen parameter rows;
   visual group headers (deductions, finish, scale, earthwork, blinding, placement) were
   considered and rejected because they would add rows to `ruleset-params`. The order is the
   contract's listing order (§5).
6. **The breadcrumb stays the tenant crumb alone.** Navigation-shell changes are out of scope
   this increment; shell §3's derivation knows no project areas, so the top bar shows the
   tenant name and no rail item carries `aria-current`. The page names its project itself
   (§2's lead). The project crumb and rail treatment arrive with the J-003 project increment.
7. **Non-member, cross-tenant and unknown project ids all answer the standard 404**
   (s-auth Interpretation 4, Q-12). RLS makes a foreign project row invisible, so the seam
   read finds nothing and the page notFounds — indistinguishable from a project that does not
   exist. No permission-denied is minted: every member of the tenant may read this pane.
8. **Lineage rows carry full digests.** All three editions of a fresh fork chain share one
   digest — the fork copies its parent verbatim — and showing all three in full makes that
   equality a readable fact instead of a claim. Truncated digests were rejected.

## 1. Layout and hierarchy

Inside `shell-main`'s centred 720 px column, padding `--space-6` (shell §1). Wrapper
`data-testid="project-ruleset"`. Stacked: the `h1` `project.ruleset.title` (`--text-20`,
`--weight-heading`, `--graphite-950` — the area's one h1), `--space-2`, the lead (§2),
`--space-6`, the pin card (§3), `--space-8`, the lineage section (§4), `--space-8`, the
parameters section (§5). Each section is a `<section>` labelled by its `h2` (`--text-16`,
`--weight-heading`, `--graphite-950`), `--space-3` above its content. The parameter table
dominates; chrome recedes — no icons, no illustration, no hover fills (nothing is
interactive). The route is guarded by `tenantContext(slug)` before any byte (shell §4);
no `loading.tsx` exists under `/t` (shell Interpretation 4 stands).

## 2. The lead

`project.ruleset.lead` (`--text-13`, `--graphite-600`), with `{name}` the project's name and
`{code}` its code, the code rendered in `--font-mono` `--text-12` `--graphite-600` — an
identifier, the slug treatment. This line is where the reader learns which project they are
looking at (Interpretation 6).

## 3. The pin card

A list card (the s-settings §2 idiom): background `--graphite-0`, hairline border
`--graphite-200`, `--radius-8`, rows divided by hairlines, row padding
`var(--space-2) var(--space-3)`. Three definition rows, each a 96 px label
(`--text-12`, `--graphite-600`) beside its value:

1. **Edition** — label `project.ruleset.edition`; value `data-testid="ruleset-edition"`:
   the edition key rendered exactly `name + ' @ ' + version` — visible text
   `IS1200_IN @ 2026.08` — in `--font-mono` `--text-16` `--weight-body-medium`
   `--graphite-950`. The headline fact of the screen.
2. **Digest** — label `project.ruleset.digest`; value `data-testid="ruleset-digest"`: the
   project edition's full 64-hex digest, `--font-mono` `--text-12` `--graphite-800`,
   `overflow-wrap: anywhere` so it never clips. Selectable text; no copy button
   (Interpretation 1 — no client machinery).
3. **Methods** — label `project.ruleset.methods`; value `project.ruleset.methodsNone`
   (`--text-13`, `--graphite-600`). Methods in force are `[]` in M0; the line says so
   plainly rather than omitting the digest's second input.

## 4. Lineage (`ruleset-lineage`)

h2 `project.ruleset.lineage.title`, then the lineage lead `project.ruleset.lineage.lead`
(`--text-13`, `--graphite-600`), `--space-3`, then the list card holding an `<ol>`
(`data-testid="ruleset-lineage"`) of exactly three entries in this DOM order — platform,
tenant, project — each an `<li>` with hairline dividers between, padding
`var(--space-2) var(--space-3)`, stacked with `--space-1` gap:

- Line 1: the scope label (`--text-13`, `--weight-body-medium`, `--graphite-800`) —
  `project.ruleset.lineage.platform` / `.tenant` / `.project` — then, gap `--space-2`, that
  edition's key `name @ version` in `--font-mono` `--text-12` `--graphite-600`.
- Line 2: that edition's full 64-hex digest, `--font-mono` `--text-12` `--graphite-600`,
  `overflow-wrap: anywhere`.

Test ids on the three `<li>`: `ruleset-lineage-platform`, `ruleset-lineage-tenant`,
`ruleset-lineage-project`. No arrows, no tree art — order and the lead carry the chain, and
the three equal digests carry the verbatim-fork fact (Interpretation 8).

## 5. Parameters (`ruleset-params`)

h2 `project.ruleset.params.title`, `--space-3`, then a semantic `<table>`
(`data-testid="ruleset-params"`) in the list-card surface (background `--graphite-0`,
hairline border `--graphite-200`, `--radius-8`, `overflow: hidden`). Not a DataTable —
seventeen static rows with no sort, no selection, no virtualisation.

- **Header** (`<thead>`, one row, 28 px, background `--graphite-50`, hairline bottom border):
  `project.ruleset.params.parameter` / `.value` / `.unit`, `--text-12`
  `--weight-body-medium` `--graphite-600`, never letter-spaced uppercase (R-UI-003). Value
  right-aligned, unit left-aligned.
- **Body** (`<tbody>`): exactly seventeen `<tr>`, one per parameter, contract order,
  `data-testid="ruleset-param-<paramId>"` on the row, hairline dividers, cell padding
  `var(--space-2) var(--space-3)`, cells top-aligned. Columns:
  1. **Parameter** (flexes): two lines — the label (`--text-13`, `--graphite-800`), then the
     parameter id verbatim in `--font-mono` `--text-12` `--graphite-600`. Two-line rows
     (~48 px) are deliberate: this is a reference table read for meaning and cited by id,
     not a density-switched data grid (R-UI-005 applies to DataTable screens).
  2. **Value** (right-aligned): the pinned value through Interpretation 4's grouping rule,
     `.numeric` `--text-13` `--graphite-900`.
  3. **Unit** (72 px, left-aligned): `project.ruleset.unit.*` verbatim, `--text-12`
     `--graphite-600`.

The seventeen rows, verbatim (label · id · displayed value · unit):

| Label (`project.ruleset.param.<id>`) | id | Value | Unit |
|---|---|---|---|
| Opening deduction minimum | `openingDeductionMinM2` | 0.1 | m² |
| Member end no-deduction maximum | `memberEndNoDeductMaxCm2` | 500 | cm² |
| Embedded duct no-deduction maximum | `embeddedDuctNoDeductMaxCm2` | 100 | cm² |
| Finish opening deduction minimum | `finishOpeningDeductionMinM2` | 0.1 | m² |
| Finish outline minimum area | `finishMinOutlineArea` | 0.2 | sft |
| Finish outline maximum area | `finishMaxOutlineArea` | 20,000 | sft |
| Scale verification tolerance | `scaleVerificationTolerance` | 0.01 | ratio |
| Scale anisotropy tolerance | `scaleAnisotropyTolerance` | 0.01 | ratio |
| Earthwork working allowance | `earthworkWorkingAllowance` | 1.5 | ft |
| Earthwork depth extra | `earthworkDepthExtra` | 0.5 | ft |
| Blinding projection | `blindingProjection` | 3 | in |
| Blinding thickness | `blindingThickness` | 3 | in |
| Placement containment merge share | `placementContainmentMerge` | 0.08 | ratio |
| Placement near-anchor share | `placementNearAnchor` | 0.9 | ratio |
| Placement footprint minimum | `placementFootprintMin` | 0.6 | ratio |
| Placement footprint maximum | `placementFootprintMax` | 2.5 | ratio |
| Placement human snap share | `placementHumanSnap` | 0.5 | ratio |

No parameter is ever omitted, filtered or collapsed; the table renders whatever the pinned
edition carries, and for `IS1200_IN @ 2026.08` that is exactly these seventeen.

## 6. States roster (R-UI-050)

- **loading** — nothing streams: the guard answers before any byte and the page renders
  synchronously from one seam read (shell Interpretation 4). Should a later increment stream
  it, the skeleton is ShellAreaState's area shape (shell §6).
- **empty** — structurally unrepresentable, and that is the design: `projects.ruleSetEditionId`
  is NOT NULL (L-REG-07 — an unpinned project cannot exist), so a project that renders at all
  has an edition, a lineage and parameters. No empty copy exists for this pane.
- **error** — a failed seam read or a broken lineage chain (a missing parent row — a data
  defect the schema forbids) throws into the shell's boundary
  (`src/app/t/[tenantSlug]/error.tsx` → ErrorState with report id and retry, shell §6).
- **refusal** — none minted (Interpretation 1). `EDITION_IMMUTABLE` lives in the register and
  the database trigger; no control on this screen can elicit it.
- **partial** — none: the pane is one edition chain read; the seam refuses whole reads, not
  rows. PartialNotice's anatomy (patterns §7) stands ready for later panes.
- **offline** — the shell's OfflineBanner mounts above the area content (shell §6); the pane
  is already read-only, so nothing further degrades.
- **permission-denied** — minted by no path: every tenant member may read the pin
  (Interpretation 7); a non-member gets the 404, never this state.

## 7. Copy, verbatim

Joins `TENANT_STRINGS` in `src/app/t/strings.ts` (frozen, typed as the table is). No string
literal in JSX except test ids. The seventeen `project.ruleset.param.<id>` labels are §5's
table, first column, keyed by the id in its third column.

| Key | Value |
|---|---|
| `project.ruleset.title` | Rule set |
| `project.ruleset.lead` | {name} ({code}) pinned this edition when the project was created. Every measurement in the project reads these values. |
| `project.ruleset.edition` | Edition |
| `project.ruleset.digest` | Digest |
| `project.ruleset.methods` | Methods |
| `project.ruleset.methodsNone` | No measurement methods are in force yet. The digest covers the parameter values alone. |
| `project.ruleset.lineage.title` | Lineage |
| `project.ruleset.lineage.lead` | This edition was forked from the workspace template, itself forked from the platform seed, when the project was created. Matching digests mean each fork copied its parent verbatim. |
| `project.ruleset.lineage.platform` | Platform seed |
| `project.ruleset.lineage.tenant` | Workspace template |
| `project.ruleset.lineage.project` | This project |
| `project.ruleset.params.title` | Parameters |
| `project.ruleset.params.parameter` | Parameter |
| `project.ruleset.params.value` | Value |
| `project.ruleset.params.unit` | Unit |
| `project.ruleset.unit.m2` | m² |
| `project.ruleset.unit.cm2` | cm² |
| `project.ruleset.unit.sft` | sft |
| `project.ruleset.unit.ft` | ft |
| `project.ruleset.unit.in` | in |
| `project.ruleset.unit.ratio` | ratio |

Calm, concrete, sentence case, no exclamation marks, no build or internal vocabulary — fork,
seed and template are the Bible's own words for the lineage and are used in their plain
English sense; tables, triggers and the seam are never named on screen. `sft` is L-MEA-01's
own spelling and is kept verbatim.

## 8. Motion (R-UI-004)

None. The pane introduces no transition, no hover fill, no fade — it is static served HTML;
the only motion on the route is shell chrome (shell §8). Reduced motion is trivially
satisfied; nothing here loops or moves.

## 9. Tokens

Only names already on the sheet: surfaces `--graphite-0/50`, hairlines `--graphite-200`,
text `--graphite-600/800/900/950`, type `--text-12/13/16/20` with `--weight-heading` /
`--weight-body-medium`, `--font-mono` + `.numeric` (edition key, digests, parameter ids,
values), spacing `--space-1/2/3/6/8`, `--radius-8`. The 96 px definition label, 72 px unit
column, 28 px header row and ~48 px parameter rows are layout dimensions, not token roles.

## 10. Both themes

Every rule reads role-stable tokens; no forked CSS under
`src/app/t/[tenantSlug]/p/**`. The list cards sit on `--graphite-0` with hairline edges in
both themes exactly as the settings lists do; the table header's `--graphite-50`, the mono
identifiers at `--graphite-600`+ (the placeholder-contrast amendment's floor) and the
`--graphite-900` values all carry their own dark values with contrast held by the token
sheet.

## 11. Test hooks (C-05)

Route: `/t/{tenantSlug}/p/{projectId}/settings/ruleset` — deep-linkable by fresh GET, fully
present in served HTML (no client render), readable with a session cookie (the inc-009/010
acceptance pattern). Test ids, all from the increment contract except the wrapper:
`project-ruleset` (§1 — the one id this document introduces); `ruleset-edition`,
`ruleset-digest` (§3); `ruleset-lineage` with `ruleset-lineage-platform`,
`ruleset-lineage-tenant`, `ruleset-lineage-project` inside, in that DOM order (§4);
`ruleset-params` and the seventeen `ruleset-param-<paramId>` rows (§5). Journey: J-003's
"rule-set pin visible" checkpoint reads this route; its spec file is a later increment.
Axe: the pane adds no interactive element, one h1, one labelled table — scans run against
the served page as-is.
