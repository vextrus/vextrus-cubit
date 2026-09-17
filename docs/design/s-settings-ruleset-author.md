# Design Decision — S-Settings-Ruleset-Author (`/t/{tenant}/p/{project}/settings/ruleset-author`)

```
┌R─┬─────────────────┬──────────────────────────────────────────────────────────────────┐
│▲ │ ws › Trace Survey ▾ › Settings › Author edition                  ⌘K ⟳ ✉ ◉          │  topbar 40
│  ├─────────────────┼──────────────────────────────────────────────────────────────────┤
│▦ │ Project settings│ Author edition ⓘ                                                 │  header 40
│▤ │  Rule set       │ Forked from  project IS1200_IN @ 2026.08  a3f9c2d…  Version [   ] │  28  y=96
│⚙ │  Participants   │ ┌───────────────────────────────┬───────────┬───────────┬──────┐ │
│  │  Site facts   ⓘ │ │ Parameter                     │Pinned val.│Authored v.│ Unit │ │  28 sticky
│  │ ▌Author edit. ◂ │ │ Opening deduction minimum     │       0.1 │[   0.1   ]│ m2   │ │  28  y=152
│  │                 │ │ Member end no-deduct maximum  │       500 │[   500   ]│ cm2  │ │
│  │                 │ │ Embedded duct no-deduct max…  │       100 │[   100   ]│ cm2  │ │
│  │                 │ │ Finish opening deduction min. │       0.1 │[   0.1   ]│ m2   │ │
│  │                 │ │ … 17 rows, the pin's own order, frozen Parameter column …     │ │
│  │                 │ └───────────────────────────────┴───────────┴───────────┴──────┘ │
│  │                 │                                            ● Author this edition │  28
│  │                 │                                                                  │  status 20
│  │       160       │                       ~1184 wide                                 │
└──┴─────────────────┴──────────────────────────────────────────────────────────────────┘

One value authored (the `value-changed` checkpoint) — the row alone is marked, nothing else moves:
   │ Opening deduction minimum     │       0.1 │[  0.25  ]✎│ m2   │   data-changed="true"
                                     muted        --ink

Committed (the `edition-minted` leg) — the status line speaks, the way onward stands beside it:
   │ Done. The project now reads version 2026.09.   See the pinned rule set →            │
```

Route `/t/{tenant}/p/{project}/settings/ruleset-author` (tree spelling
`/t/[tenant]/p/[project]/settings/ruleset-author`), drawn in the project settings layout
(`docs/design/s-settings-project-sub-navigation.md`) inside `SettingsPane` — the one settings
template, s-settings I-198. Increment inc-304a-ruleset-authoring-ui. Law: R-SPINE-012, L-MEA-01,
L-ACT-02, L-ACT-03, AM-04, AM-11, R-UI-001/003/004/005/010/012/020/021/050/060/080–086, B-17,
C-05, Q-11. Direction `00-direction.md` §3.6 rules the geometry and outranks this file where the
two disagree. Conventions of the earlier Decisions bind: `cx-` classes, tokens-only colour and
motion, `cx-reticle` from its single home, no `[data-theme]` selector in authored CSS, model
values verbatim in mono (s-settings-ruleset I-25), digests whole in the document (I-26/I-206).
Chrome is shipped primitives only — core Button, Input, NumberInput, Skeleton, Tooltip, Popover,
BasisChip, UnitBadge, QuantityText, EmptyState; data DataTable v2; the one RefusalState and the
one ConsequenceDialog — plus the `cx-ruleset-author-*` classes this file rules. Copy lives in
`src/modules/spine/ruleset-authoring/strings.ts`, export `rulesetAuthorStrings`, keys
`ruleset_author_…`; JSX carries no string literal beyond test ids and fixed attribute values.

## 0. Interpretations (numbering continues the highest recorded, I-261)

- **I-262 — the parent is one line, and it is the pin.** The screen opens on what is being forked,
  not on a form: `ruleset-author-parent` is a single `--control-h` line holding the label, the
  scope in `data-scope`, `name @ version` as one mono run, and the parent's content digest — whole
  in the document, `user-select: all`, drawn at the `8ch` chip measure under `data-technical`
  (s-settings-ruleset I-206's exact ruling, its owed `IdChip` variant still owed and not discharged
  here). The digest is also on `data-digest` so a walk compares the fork's parent to the pin
  without reading a text node.
- **I-263 — typing changes nothing; only the door is a door.** Every `ruleset-author-value` is a
  NumberInput pre-filled with the pinned decimal (s-schedules I-254). Editing it moves no record
  and mints nothing: it re-computes the row's `data-after` and `data-changed`, and that is all.
  `ruleset-author-submit` calls `previewAuthorEdition` and opens the one ConsequenceDialog, whose
  copper confirm calls `commitAuthorEdition` with the digest it rendered. No cell is
  `meta.editable`; the grid's own inline-edit machinery is not used, because the authored column is
  a field on every row at once, not a cell a reader opens.
- **I-264 — the diff is the whole pin, always, and an unchanged row is shown.** One
  `ruleset-author-diff-row` per parameter of the pin, in the pin's own order, whatever the reader
  has typed. A diff that hides what did not move cannot be read against the screen beside it and
  cannot be checked for the thing a reader actually fears: a value moved by accident. Changed rows
  are marked, never filtered, never floated to the top.
- **I-265 — units, keys and methods are the pin's and are never authored.** The authored input
  carries the pin's unit as its suffix and the row's `data-unit`; there is no unit control, no key
  column (s-settings-ruleset I-207 — the key is `data-param`, not body text), and nothing on this
  screen states a method. `AuthorRulesetEditionInput` carries `values` only, so a verbatim fork —
  every field left as pinned — is a lawful submission that the seam answers `ACT_CHANGES_NOTHING`.
- **I-266 — the door stands for a reader who cannot walk through it, and says why in place.**
  R-SPINE-006 forbids hiding: a reader without `AUTHOR_RULE_SET` sees the whole screen, the parent,
  the version field and every row. `ruleset-author-submit` renders with `aria-disabled="true"` and
  `aria-describedby` pointing at the message of a `PERMISSION_NOT_HELD` RefusalState already
  standing in `ruleset-author-refusal` — the registered entry, naming the act type
  `AUTHOR_RULESET_EDITION` and the permission `AUTHOR_RULE_SET`, with the participants screen as
  its evidence. The same code is what `authorize()` and the act seam answer if the door is reached
  another way, so the screen and the server say one sentence.
- **I-267 — a preview that is refused is answered in place; only a consequence opens a dialog.**
  `ACT_CHANGES_NOTHING`, `EDITION_VERSION_TAKEN` and `REQUEST_MALFORMED` (an unstated or
  ill-formed version) are refusals of the preview: they render as one RefusalState in
  `ruleset-author-refusal` and **no dialog opens** (s-levels I-245, s-schedules I-255). The field
  the refusal is about keeps what the reader typed — a refusal that clears the form makes the
  reader do the work twice. `CONSEQUENCES_NOT_CARRIED` is the dialog's own stale path
  (consequence-dialog I-44) and never reaches this slot.
- **I-268 — parameter labels have one home, and it is the settings area's.** The words that name a
  parameter are the same words on the rule-set screen, so they move to the area's shared table
  `settings/strings.ts` as `parameterLabel(key)`, which both screens call; an unknown key falls
  back to the key itself, because a parameter with no wording is still shown. **Owed:** the
  rule-set screen's own `ruleset_param_*` keys are folded into that one home by the node that owns
  its `strings.ts`; until then the table there is the source the shared function is built from,
  byte-identical, pinned equal by a test (recorded IOU, never a comment in `src` — Q-17).
- **I-269 — the rendering lives at the route, and the module keeps what a module may hold.** ARCH-01
  lets `src/modules/**` import core and its own module only, so a section that consumes `src/ui`
  primitives cannot live there. `ruleset-author-section.tsx`, `ruleset-author.css` and `states.ts`
  are therefore the route directory's, beside the page that mounts them;
  `src/modules/spine/ruleset-authoring` keeps the two things that are not renderings — the copy
  (`strings.ts`) and the pure diff over a pin (`diff.ts`, `diffParameters`/`authoredValues`), which
  is where the rule this screen is graded on actually lives and what the unit lane can grade without
  a DOM.
- **I-270 — an area's word has one home, and both the nav and the crumb read it.**
  `PROJECT_SETTINGS_PAGES` in `src/ui/shell/routes.ts` is the single spelling of each area's name
  (Rule set · Participants · Site facts · Author edition). The frame's roster
  (`settings/areas.ts`) takes its labels from it and the screen declares its crumb with the same
  string through `useShellPage`, so the row a reader clicks and the crumb they land on cannot drift
  apart (R-UI-084).
- **I-271 — an area key is not a test id.** `settings-area` is registered, and it is the one id every
  nav row carries; the area keys themselves (`ruleset`, `participants`, `site-facts`,
  `ruleset-author`) stay unregistered and are read off `data-area`. Registering `ruleset-author` and
  `site-facts` as ids would make the page object's own use of them as **keys** a literal id outside
  the registry, which `src/ui/testids.test.ts` rule 2 forbids — the registry spells elements, and the
  roster (`PROJECT_SETTINGS_AREA_NAMES`) spells areas.
- **I-272 — a door shut for a reason of this screen's own is the screen's own affordance.** The
  shipped `Button` reports `aria-disabled` for busy and for nothing else and overrides a caller's,
  so I-266's shut door renders as a focusable `span` wearing the `cx-btn` chrome with
  `role="button"`, `tabIndex={0}`, `aria-disabled="true"`, `aria-describedby` on the standing
  refusal and `data-permission="AUTHOR_RULE_SET"` — the idiom the BOQ and levels screens already
  keep (I-247, R-UI-010). It keeps its test id and its place, carries no press at all, and stays in
  the tab order so the reason is one focus away.

## 1. Regions (1440×900)

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| section nav | the project's four settings areas, `Author edition` current | `--drawer-w-min` 160 × 100 %, rows `--control-h` | the sub-navigation Decision's | — (its own Decision) |
| header | `<h1>` `ruleset_author_heading` at `--text-20` `--weight-heading`, then the `(i)` — a ghost Popover trigger one `--control-h` square holding `ruleset_author_caption` and `ruleset_author_version_hint`. No subtitle anywhere | 100 % × 40 | `--ink`, `--text-20`, `--weight-heading`, `--control-h` | — |
| identity line | `ruleset-author-parent` (I-262) at the leading edge; at the trailing edge the version label and `ruleset-author-version`, a core Input, `--control-h`, 160 measure, `inputMode="text"`, `aria-label` `ruleset_author_version_label` | 100 % × `--control-h`; `--gap-section` above | `--ink-muted` (label, scope), `--ink-code` (identity, digest), `--font-mono`, `--text-12/13`, `--space-2/3` | the unpinned state replaces the whole pane |
| diff grid (primary) | `ruleset-author-diff`, one DataTable (table id `ruleset-author-diff`), sticky 28 px header, frozen Parameter column, one `ruleset-author-diff-row` per pinned parameter in the pin's order (§1.1) | flex × `--row-h` 28 rows; `--gap-section` above; **1184 × 640 = 63 % of `shell-main`** at 1440×900, 1024 × 540 = **59 %** at 1280×800 | `--row-h`, `--cell-px`, `--cell-py`, `--text-13`, `--font-mono`, `--ink`, `--ink-muted`, `--line` | never — an edition with no parameter is not an edition |
| refusal slot | `ruleset-author-refusal`, exactly one RefusalState, `max-inline-size` 420 (the s-settings row-refusal measure), mounted only while a refusal stands | 100 % × auto, `--space-3` above | RefusalState's own | absent |
| act row | the screen's ONE primary at the trailing edge: core Button `ruleset-author-submit`, label `ruleset_author_submit` | 100 % × `--control-h-lg` 32; `--space-4` above | `--accent` (the primitive's), `--control-h-lg` | — |
| status line | `<p role="status" aria-live="polite">` at the leading edge of the act row: pending, then done; after a commit the `ruleset-author-see-ruleset` link stands beside it | 100 % × `--text-13` min-height | `--ink-muted`, `--text-12`, `--ink-link` (the link) | empty string, height kept |
| unpinned | `ruleset-unpinned` wrapping one `EmptyState`: glyph, heading, one sentence, one action | centred in the pane | EmptyState's own | this IS the empty leg |

Above the fold: the first diff row stands at **y = 152 px** below the top of `shell-main` at both
viewports — 24 pane padding, 40 header, 16, 28 identity line, 16, 28 sticky grid header — inside
R-UI-081's 240 and inside the rubric's 120…240 band. Nothing on the page scrolls sideways; the grid
scrolls inside itself. Exactly one primary, no second right column, no inspector (nothing on this
screen is selectable).

### 1.1 The diff grid's columns

- **Parameter** — 360, the frozen key column, the row's `rowheader`: `parameterLabel(key)` (I-268),
  `--text-13`, one line, ellipsis, the grid's tooltip on truncation.
- **Pinned value** — 180, right-aligned: `QuantityText` over the pin's decimal — grouping is the
  figure seam's, precision is the edition's — mono, `tabular-nums slashed-zero`. Read-only, and on
  a changed row it goes `--ink-muted`: what was true recedes behind what will be.
- **Authored value** — 220: the shipped `NumberInput` `ruleset-author-value`, `--control-h`,
  decimal-only, pre-filled with the pinned decimal, its blur display the same grouped reading as
  the column beside it (the primitive's own lakh/crore-on-blur rule, R-UI-010 — one home for the
  figure seam), `aria-label` `ruleset_author_value_label` filled with the row's parameter label,
  the pin's unit as the muted suffix (I-265). On a changed row the field's ink is `--ink` at
  `--weight-body-medium` and the shipped `BasisChip` for `ENTERED` (✎, R-UI-002) stands at the
  cell's trailing edge — Direction §5 rule 7's edited-cell glyph, so the mark survives greyscale.
- **Unit** — 96: the shipped `UnitBadge` over the pin's unit string, muted.

Each row carries `data-param` (the pin's key), `data-unit`, `data-before` (the pinned decimal,
verbatim as stored), `data-after` (the field's current decimal, verbatim as typed) and
`data-changed` — `"true"` exactly when `data-after` differs from `data-before` as a decimal
comparison through the figure seam, so `0.10` against `0.1` is not a change and does not mark a
row. The row's fill does not change; the mark is the glyph, the ink and the attribute.

## 2. The states, cell by cell

Declared in the one enumerable home `src/modules/spine/ruleset-authoring/states.ts`, export
`RULESET_AUTHOR_STATES` (the `PARTICIPANTS_STATES` cell shape); the suite reflects over it (B-19).

- **Loading** — `loading.tsx`, frame and nav intact: core Skeletons keeping the layout the answer
  will take, gap `var(--space-2)` — one 24 × 240 bone for the title, one 28 × 360 for the identity
  line, then the grid's real 28 px header over 17 bones at 28 × min(880, 100 %). No spinner ever
  stands on this table (R-UI-004).
- **Empty** — `ruleset-unpinned`: a project that pins nothing has nothing to fork. One `EmptyState`
  — heading `ruleset_author_unpinned_heading`, one sentence `ruleset_author_unpinned_body`, one
  action, the `ruleset-author-see-ruleset` link to `settings/ruleset`. No version field, no grid,
  no disabled door, no skeleton pretending an answer is coming.
- **Partial** — impossible, and the reason is the store: the pin is one immutable row read as one
  document, so every parameter of it is answered or none is. There are no refusable rows and no row
  is ever hidden. (Recorded in the matrix as a reason, not as a rendering.)
- **Error** — a render, read or action fault surfaces the root error boundary (`src/app/error.tsx`,
  unowned here), which shows **Try again** and the report id; the nav survives the fault, so a
  reader can leave by clicking another area (sub-navigation §2).
- **Refusal** — `ruleset-author-refusal`, one RefusalState with code (`data-code`), message, remedy
  and evidence link, never a toast (R-UI-020). Reachable codes, in the seam's judging order:
  `PERMISSION_NOT_HELD` (evidence: the participants screen), `REQUEST_MALFORMED` (no version
  stated, or one the schema does not accept — evidence: this screen),
  `EDITION_VERSION_TAKEN` (evidence: `ruleset_author_see_ruleset` → the rule set screen, where the
  versions this project already holds are listed), `ACT_CHANGES_NOTHING` (evidence: this screen).
  `CONSEQUENCES_NOT_CARRIED` renders as the dialog's own stale notice and is never in this slot
  (I-267). The refusal clears when the next preview is asked for and never clears a typed field.
- **Busy** — while a preview is in flight the submit takes core's loading state (`aria-busy`, no
  spinner) and the status line reads `ruleset_author_status_pending`; the grid, the fields and the
  version stay enabled and editable, because nothing has been committed. While the commit is in
  flight the dialog's confirm takes the loading state (the pattern's own) and this screen's status
  line speaks the same pending line. No control is disarmed by a refusal — a retry is always
  reachable.
- **Ready** — the parent line, a version field, seventeen rows with their marks, the door armed.
  After a commit: the dialog closes, the route revalidates, the grid re-renders against the **new**
  pin (every row `data-changed="false"` again, `ruleset-author-parent` now the minted edition), the
  status line reads `ruleset_author_status_done` with the version, and
  `ruleset-author-see-ruleset` stands beside it.
- **Offline** — a fault of reachability (shell I-20): a failed navigation or action surfaces the
  error path or the registered refusal; no invented banner, and no figure ages on screen pretending
  to be current.
- **Permission-denied** — I-266: the whole screen renders, the door carries `aria-disabled="true"`
  and is described by the standing `PERMISSION_NOT_HELD` entry, which names the act type
  `AUTHOR_RULESET_EDITION`, the permission `AUTHOR_RULE_SET` and who holds it — the project's LEAD
  and PRINCIPAL participants — with the participants screen as the place it is granted. Nothing is
  hidden from anyone who can see the project.

## 3. Copy, verbatim (`strings.ts`, export `rulesetAuthorStrings`)

`ruleset_author_heading` **Author edition** ·
`ruleset_author_caption` **Authoring mints a new edition and never changes the one pinned before
it. The project reads the newest edition from the moment it is minted.** ·
`ruleset_author_version_hint` **A version names this edition beside its scope and name, and must
be one this project has not used.** ·
`ruleset_author_parent_label` **Forked from** ·
`ruleset_author_digest_label` **Content digest** ·
`ruleset_author_version_label` **Version** ·
`ruleset_author_col_parameter` **Parameter** ·
`ruleset_author_col_pinned` **Pinned value** ·
`ruleset_author_col_authored` **Authored value** ·
`ruleset_author_col_unit` **Unit** ·
`ruleset_author_value_label` **Authored value for {parameter}** (the slot is data — the row's own
label) ·
`ruleset_author_submit` **Author this edition** ·
`ruleset_author_status_pending` **Carrying the act out…** ·
`ruleset_author_status_done` **Done. The project now reads version {version}.** (the slot is data
— the version the act carried) ·
`ruleset_author_see_ruleset` **See the pinned rule set** ·
`ruleset_author_unpinned_heading` **No rule set to author** ·
`ruleset_author_unpinned_body` **A project pins its rule set when it is created, and this address
names no project with one. There is nothing here to fork.**

Registered refusal copy is the register's and renders verbatim, re-worded nowhere:
**EDITION_VERSION_TAKEN** · error · inline · *This project already holds an edition with that
version, so nothing was minted.* / *Give this edition a version the project has not used, then
author it again.* The three other reachable codes are registered by their own areas and are not
re-spelled here. Voice: calm, concrete, present tense about what will be true; no exclamation
marks; scope, name, version, parameter keys and digests are data, never woven into a sentence
(s-settings-ruleset I-25); "act", "consequence", "digest" and "edition" are the product's own
user-facing law, while "mint", "seam" and "store" appear in no text a reader can see.

## 4. Motion (R-UI-004)

None of the screen's own beyond the inherited idioms: Button, link and nav-row colour over
`var(--motion-state)` `var(--ease)`; the NumberInput's border on focus over the same; the `(i)`
Popover, the Tooltip and the Dialog's entrance in the shipped primitives' own motion; the Skeleton
pulse and the reticle draw in their single homes. A row's `data-changed` mark appears with **no**
transition — a value that fades in reads as a value still being decided — and the refusal, the
status line and the see-ruleset link mount with no entrance. No bounce, no shimmer, no row
reordering. Every duration is a token zeroed at source under `prefers-reduced-motion`, so
`ruleset-author.css` carries no reduced-motion branch.

## 5. Tokens

Semantic aliases and density/layout tokens only (Direction §4 rule 3; a `--graphite-*`/`--beam-*`
reference here is a `cubit/no-primitive-token` failure): `--ink` / `--ink-muted` / `--ink-code` /
`--ink-disabled` / `--ink-link` · `--surface-app` / `--surface-sunken` (the fields) /
`--surface-hover` · `--line` through `--hairline` · `--line-focus` (the reticle's stroke) ·
`--accent` (the one primary, the primitive's own) · `--row-h` · `--control-h` / `--control-h-lg` ·
`--cell-px` / `--cell-py` · `--drawer-w-min` · `--gap-section` · `--space-2/3/4/6` ·
`--text-12/13/20` · `--font-mono` · `--weight-body-medium` / `--weight-heading` · `--radius-4` ·
`--motion-state` / `--ease`. The ENTERED glyph's colour is BasisChip's own basis token (R-UI-002,
exempt as itself semantic); the act copper appears exactly once, on the ConsequenceDialog's
confirm, and nowhere on this screen. Px literals, closed set: the 40 px header, the 160 version
measure, the refusal's 420, the digest's `8ch` chip measure (I-206), and the grid's four column
widths 360/180/220/96 — every one a multiple of 4. Any other literal is a defect and
`tests/ui/craft/mechanical.test.ts` scores this file for it.

## 6. Themes

Dark is the default this screen is first seen in and light is complete; every difference arrives
through token values (R-UI-001) and `ruleset-author.css` contains no `[data-theme]` selector. What
differs is only the graphite flip behind the aliases: the fields sit on `--surface-sunken`, which
is the darker well in dark and the lighter one in light, and the grid's hairlines read as seams in
both. Contrast facts held in both themes: every ink alias used on the app surface ≥ 4.5:1,
`--ink-link` ≥ 4.5:1, the muted pinned value on a changed row ≥ 4.5:1 (recession is ink weight, not
a drop below the floor), the disabled door's label ≥ 3:1, act-600 on act-surface inside the dialog
≥ 4.5:1. Nothing means anything by colour alone: a changed row is marked by `data-changed`, by the
✎ glyph and by ink weight together. Both themes are captured in the same lane —
`s-settings-ruleset-author/authoring-open` dark, then `authoring-open-light` through
`emulateTheme(page, "light")` and `restoreLaneTheme` (the gallery walk's precedent).

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/settings/ruleset-author` (tree spelling
`/t/[tenant]/p/[project]/settings/ruleset-author`); reached from
`/t/{tenant}/p/{project}/settings/ruleset` through the `settings-area` row, itself reached from
S-Home's `s-home-project-ruleset` door. Test ids, exactly these nine, on the elements §1 rules:

- `ruleset-author` — the screen root in the content pane, the region a retrying read targets.
- `ruleset-author-section` — the `<section>` `RulesetAuthorSection` renders: identity line, grid,
  refusal slot, act row and the `role="status"` line.
- `ruleset-author-parent` — the parent line, carrying `data-digest` (the pin's content digest) and
  `data-technical`; its scope span carries `data-scope`.
- `ruleset-author-version` — the version Input.
- `ruleset-author-diff` — the grid's container.
- `ruleset-author-diff-row` — each row, carrying `data-param`, `data-unit`, `data-before`,
  `data-after`, `data-changed`.
- `ruleset-author-value` — each row's NumberInput.
- `ruleset-author-submit` — the one primary; `aria-disabled="true"` for a reader without the
  permission (I-266).
- `ruleset-author-refusal` — the answer slot; RefusalState's own ids and `data-code` nest inside.
- `ruleset-unpinned` — the empty state's wrapper (EmptyState's own ids nest inside).

`shell-crumb-page` (reading **Author edition**) and `settings-area` are the shell's and the
layout's, read here and added by neither. The dialog is the pattern's own
`consequence-dialog[data-act-type="AUTHOR_RULESET_EDITION"]` with `consequence-subject-row`,
`consequence-digest-line` and `consequence-confirm`; no id of this screen's is added inside it.
Behavioural hooks without new ids: `role="status"` `aria-live="polite"` on the status line;
`aria-busy` on the submit while a preview is in flight; `aria-label` on every NumberInput and on
the version Input from the strings table; `aria-current="page"` on the nav's `ruleset-author` row;
`data-theme` on the document root, set by `emulateTheme` for the light capture; the `<h1>`
hierarchy; `cx-reticle` on every focusable.

Proof: J-304 (`tests/e2e/ruleset-author.spec.ts`, page object
`tests/e2e/pages/s-settings-ruleset-author.page.ts`) at the three checkpoints —
`authoring-open` and its light twin `authoring-open-light`, `value-changed`, `edition-minted` —
axe serious/critical = 0 at each, against committed baselines. `tests/rulesets/ruleset-author-section.test.tsx`
mounts `RulesetAuthorSection` under jsdom over a staged pin and walks `RULESET_AUTHOR_STATES`;
`db/__tests__/authz/ruleset-author-door.live.test.ts` proves the `PERMISSION_NOT_HELD` this screen
renders is the one `authorize()` and the act seam answer.

## Additional test hooks

Two gaps in the registry, recorded rather than spelled around:

1. **The RENDERED read contract has no attribute in the registry.** `tests/e2e/support/retrying-read.ts`
   reads `data-state`, `data-rendered-region` and `data-rows-rendered` on every screen (CLAUDE.md,
   Tests and lanes), and this screen must carry them — `data-state` on `ruleset-author` with the
   value of the state §2 names (`loading` · `empty` · `error` · `refused` · `busy` · `ready`;
   `partial` is impossible here), `data-rendered-region` on `ruleset-author-diff` and
   `data-rows-rendered` on it with the count of rendered rows. The registry names none of the
   three. This is a plan defect in the closed surface, not a spelling this Decision invents; the
   three are used with exactly those names because they are the tree's existing support contract.
2. **`authoring-open-light` is a capture name, not an element.** The registry lists it among test
   ids; AC-1 uses it as the name of the light twin of the `authoring-open` checkpoint. No element
   on this screen carries it and none is invented to.

## Changelog

- 2026-09-16 — inc-304a-ruleset-authoring-ui: first edition. The authoring screen for
  `AUTHOR_RULESET_EDITION` under `AUTHOR_RULE_SET` (AM-04): the pinned parent, a version field, the
  whole-pin diff grid, the act through the one ConsequenceDialog. I-262–I-268 recorded; I-268
  leaves the parameter-label fold as an owed IOU for the rule-set screen's own node.
- 2026-09-18 — inc-304a-ruleset-authoring-ui, as built. I-269 records where each file came to live:
  the section, its stylesheet and its state matrix are the route directory's, because ARCH-01 does
  not let a module import `src/ui`, and `src/modules/spine/ruleset-authoring` keeps the copy and the
  pure diff. I-270 names `PROJECT_SETTINGS_PAGES` as the one home of an area's word, read by the
  nav and by the crumb alike. I-271 records that an area key is not a test id. I-272 records the
  shut door as the screen's own focusable affordance, the attribute the shipped Button drops. §2's
  cells are enumerated in `states.ts` and walked by
  `tests/rulesets/ruleset-author-section.test.tsx`; the figure conventions are handed to
  `QuantityText` explicitly, because the settings frame mounts no `FigureProvider` (SEAM-FORMAT).
