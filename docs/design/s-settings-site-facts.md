# Design Decision — S-Settings · Site facts (`/t/{tenant}/p/{project}/settings/site-facts`)

```
┌R─┬─────────────────┬──────────────────────────────────────────────────────────────────┐
│▲ │ ws › Trace Survey ▾ › Settings › Site facts                      ⌘K ⟳ ✉ ◉          │  topbar 40
│  ├─────────────────┼──────────────────────────────────────────────────────────────────┤
│▦ │ Project settings│ Site facts ⓘ                                                     │  header 40
│▤ │  Rule set       │ Earthwork is unpriceable from drawings alone until these site     │  face 28
│⚙ │  Participants   │ facts are entered.                                        y=48   │
│  │ ▌Site facts   ◂ │ ┌──────────────────────┬───────────┬──────────────┬────────┬───┐ │
│  │  Author edition │ │ Fact                 │     Value │ Source note  │ Entered│   │ │  28 sticky y=92
│  │                 │ │ Existing ground level│         — │ —            │ —      │Ent│ │  28  y=120
│  │                 │ │ ┌──────────────────────────────────────────────────────────┐ │ │
│  │                 │ │ │ No existing ground level has been entered for this…      │ │ │  deferral
│  │                 │ │ │ Enter the site's existing ground level with the note…    │ │ │  sub-row
│  │                 │ │ │ Enter this site fact                                     │ │ │
│  │                 │ │ └──────────────────────────────────────────────────────────┘ │ │
│  │                 │ │ Water table level    │         — │ —            │ —      │Ent│ │
│  │                 │ │ ┌ No water table level has been entered for this project…  ┐ │ │
│  │                 │ │ Working allowance    │         — │ —            │ —      │Ent│ │
│  │                 │ │ ┌ Neither this project's rule-set edition nor its site…    ┐ │ │
│  │                 │ │ Depth extra · Blinding projection · Blinding thickness      │ │ │  (scrolls
│  │                 │ └──────────────────────────────────────────────────────────────┘ │   inside)
│  │       160       │                       1184 wide                                  │
└──┴─────────────────┴──────────────────────────────────────────────────────────────────┘

GROUND_LEVEL entered (the `fact-entered` leg) — the deferral is gone from that row alone:
 │ ✎ Existing ground level │    -1.2 m │ Survey sheet S-01 │ 8e8d2f ⎘ │ Restate │   data-basis="ENTERED"

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
- **I-275 — ABSENT is not a basis.** `data-basis` carries `ABSENT` or `ENTERED` — the two readings
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

## 1. Regions (1440×900; the content pane is 1184 × 812, per the sub-navigation Decision)

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| section nav | the project's four settings areas, `Site facts` current (`aria-current="page"`) | `--drawer-w-min` 160 × 100 % | the sub-navigation Decision's | — (its own Decision) |
| header | `<h1 id>` `site_facts_heading` at `--text-20` `--weight-heading`, then the `(i)` — a ghost Popover trigger one `--control-h` square holding `site_facts_caption`. No subtitle | 100 % × 40 | `--ink`, `--text-20`, `--weight-heading`, `--control-h` | — |
| face | `site-facts-face`, one `<p>` — the screen's one helper line (R-UI-081), stating L-MEA-06's consequence | 100 % × 28, `--space-2` above; `max-inline-size` 880 | `--ink-muted`, `--text-13`, `--space-2` | — |
| table (primary) | `site-facts-table`, one DataTable v2 (table id `site-facts`), sticky 28 px header, frozen Fact column, one `site-facts-row` per fact in `SITE_FACTS` order (§1.1) | 1184 × 720 = **71 % of `shell-main`**; `--gap-section` 16 above; scrolls inside itself, never the page | `--row-h` 28, `--cell-px`, `--cell-py`, `--text-13`, `--font-mono`, `--ink`, `--ink-muted`, `--ink-code`, `--line` | never — the roster is six (I-278) |
| deferral sub-row | `site-facts-row-deferral`, one `RefusalState` (inline surface), on every ABSENT row | cell spans the table; `max-inline-size` 880; padding-block `--space-2` | RefusalState's own | absent on an ENTERED row |
| entry sub-row | the row's form: `site-facts-value` · `site-facts-unit` · `site-facts-source-note` · Cancel · `site-facts-submit` | cell spans the table; row-flex, gap `--space-3`, controls `--control-h` 28, submit `--control-h-lg` 32 | `--surface-sunken`, `--space-2/3`, `--control-h`, `--control-h-lg`, `--accent` (the primitive's) | mounted only while open (I-281) |
| refusal slot | `site-facts-refusal`, exactly one `RefusalState` for a panel-wide refusal (permission, malformed, act) | 100 % × auto, `--space-3` above the table; `max-inline-size` 420 | RefusalState's own | absent |
| status line | `<p role="status" aria-live="polite">` under the table: pending, then done | 100 % × `--text-13` min-height, `--space-3` above | `--ink-muted`, `--text-12` | empty string, height kept |
| right column | none. Nothing on this screen is selectable, so the shell's inspector slot stays at width 0 (R-UI-080) | 0 | — | — |

Above the fold: 40 header + 8 + 28 face + 16 = the sticky header at **y = 92**, the first row at
**y = 120** below the top of `shell-main`, at 1440×900 and at 1280×800 alike (pane 1024 × 712 there;
table 1024 × 620 = 63 % of `shell-main`) — inside R-UI-081's 240 and inside the rubric's ≤ 120 band.
Six deferral sub-rows are ~826 px against 720 of pane: the table scrolls inside itself and the page
does not (C10). Exactly one primary per region; no second right column.

### 1.1 The table's columns

- **Fact** — 260, the frozen key column, the row's `rowheader`: the human label (§3), `--text-13`,
  one line, ellipsis, the grid's tooltip on truncation; on an ENTERED row the `BasisChip` for
  `ENTERED` stands at the leading edge (I-275).
- **Value** — 180, right-aligned: `site-facts-row-value`, exactly `{valueAsWritten} {unitAsWritten}`
  in mono (I-276). On an ABSENT row the cell holds `site_facts_absent_value` and no testid.
- **Source note** — flex (≥ 360): `site-facts-row-source`, the note verbatim, `--text-13`, one line,
  ellipsis + tooltip. ABSENT: `site_facts_absent_value`, no testid.
- **Entered by** — 140: `site-facts-row-act`, the act id through `IdChip` (short form, copy, full in
  the tooltip) — the 36-char id is body text nowhere (R-UI-082). ABSENT: `site_facts_absent_value`.
- **Act** — 120, trailing: the row's ghost core Button `site-facts-enter`, label `site_facts_enter`
  on an ABSENT row and `site_facts_restate` on an ENTERED one.

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
- **Refusal** — in place, never a toast (R-UI-020), through the one renderer in two homes: the row's
  `site-facts-row-deferral` for an absent fact (codes per §3), and `site-facts-refusal` for a
  refusal of the panel's own — `PERMISSION_NOT_HELD` (evidence: participants), `REQUEST_MALFORMED`,
  `SITE_FACT_UNKNOWN`, `SITE_FACT_SOURCE_UNSTATED` and `UNIT_UNMAPPED` (evidence: this screen; the
  preview refuses these before any row exists, so the dialog never opens on them).
  `CONSEQUENCES_NOT_CARRIED` renders as the dialog's own stale notice and is never in this slot.
  A refusal clears when the next preview is asked for, and clears no typed field.
- **Busy** — while a preview is in flight `site-facts-submit` takes core's loading state
  (`aria-busy`, no spinner) and the status line reads `site_facts_status_pending`; the fields stay
  enabled, because nothing is committed. While the commit is in flight the dialog's confirm takes
  the loading state (the pattern's own) and the status line speaks the same pending line.
- **Ready** — six rows in roster order, each ENTERED with value, note and act chip or ABSENT with
  its deferral; the doors armed. After a commit: the dialog closes, the route revalidates, that row
  re-renders ENTERED with no deferral while the others keep theirs, and the status line reads
  `site_facts_status_done`.
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
`site_facts_face` **Earthwork is unpriceable from drawings alone until these site facts are
entered.** ·
`site_facts_caption` **A site fact is a reading no drawing carries. Each one is entered as its own
act, with the note it was read from, and is restated by entering it again.** ·
`site_facts_column_fact` **Fact** · `site_facts_column_value` **Value** ·
`site_facts_column_source` **Source note** · `site_facts_column_act` **Entered by** ·
`site_facts_absent_value` **—** ·
`site_facts_fact_ground_level` **Existing ground level** · `site_facts_fact_water_table` **Water
table level** · `site_facts_fact_working_allowance` **Working allowance** ·
`site_facts_fact_depth_extra` **Depth extra** · `site_facts_fact_blinding_projection` **Blinding
projection** · `site_facts_fact_blinding_thickness` **Blinding thickness** ·
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
this screen's own row anchor for the first two, and `site_facts_evidence_ruleset` to
`settings/ruleset` for the four the edition may also state (I-B). `WATER_TABLE_UNSTATED` is
appended to `src/core/errors/foundations.ts` by this increment, in the register's voice: message
**No water table level has been entered for this project, so earthwork below it is unpriceable
from drawings alone.** · remedy **Enter the water table level with the note it was read from, then
measure the campaign again.** · severity `error` · surface `inline`.

Voice: calm, concrete, professional; nouns on the nav row and the column heads, verbs on buttons;
no exclamation marks; no build vocabulary — "act", "consequence", "site fact" and "source note" are
the product's own user-facing law. No clause id and no enum spelling appears in any sentence.

## 4. Motion (R-UI-004)

Row ink and the ghost button's fill transition over `var(--motion-state)` `var(--ease)` on hover and
focus. The deferral card, the entry form and the status line mount with **no** entrance — no height
tween, no fade, no stagger: an answer and a form both arrive instantly, and theatre in front of a
refusal reads as apology. The ConsequenceDialog's entrance is the pattern's own. Skeleton pulse and
the reticle draw live in their single homes. Every duration is a token zeroed at source under
`prefers-reduced-motion`, so `site-facts.css` carries no reduced-motion branch.

## 5. Tokens

Semantic aliases and density/layout tokens only (Direction §4; a `--graphite-*`/`--beam-*` reference
here is a `cubit/no-primitive-token` failure): `--surface-app` · `--surface-panel` ·
`--surface-sunken` (the entry sub-row) · `--surface-hover` · `--ink` / `--ink-muted` / `--ink-code`
· `--ink-disabled` (the shut door) · `--line` through `--hairline` · `--accent` (the submit, the
primitive's own) · `--row-h` · `--control-h` · `--control-h-lg` · `--cell-px` / `--cell-py` ·
`--drawer-w-min` · `--gap-section` · `--space-2/3/4` · `--text-12/13/20` · `--font-mono` /
`--font-ui` · `--weight-heading` / `--weight-body-medium` · `--radius-4` · `--motion-state` /
`--ease`. Px literals, closed set: the column measures 260 / 180 / 140 / 120, the two
`max-inline-size` measures 880 and 420, and the loading bones 24 × 240, 16 × 420, 28 × 1088,
72 × 880. Any other literal is a defect. Copper appears exactly once on this screen — the dialog's
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
colour-only: ENTERED carries its ✎ glyph, and an absent fact is named in words.

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
rather than assumed; `data-basis` `ABSENT` | `ENTERED` per row; the absence of
`site-facts-row-deferral` on an entered row and of `site-facts-row-value` on an absent one;
`aria-disabled="true"` and `data-permission="AUTHOR_PROJECT_FACT"` on a shut `site-facts-enter`;
`data-theme` on the document root (the shell's); `cx-reticle` on every focusable.

Proof: J-305 (`tests/e2e/site-facts.spec.ts`, page object
`tests/e2e/pages/s-settings-site-facts.page.ts`) at checkpoints
`s-settings-site-facts/panel-absent`, `panel-absent-light` and `fact-entered`; axe serious/critical
= 0 at each; baselines under `tests/e2e/baselines/design-dark/s-settings-site-facts/` with the
`-light` suffix for the light twin (I-D). Unit: `tests/takeoff/site-facts-ui/**` over the roster,
the deferral map and `SITE_FACTS_STATES`. Baselines this screen moves, in their own `baseline:`
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
