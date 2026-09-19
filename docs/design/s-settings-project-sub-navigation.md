# Design Decision — S-Settings project sub-navigation (`settings/layout.tsx` over `PROJECT_SETTINGS_AREAS`)

```
┌R─┬─────────────────┬──────────────────────────────────────────────────────────────────┐
│▲ │ ws › Trace Survey ▾ › Settings › Rule set                        ⌘K ⟳ ✉ ◉          │  topbar 40
│  ├─────────────────┼──────────────────────────────────────────────────────────────────┤
│▦ │ Project settings│                                                                  │
│▤ │ ▌Rule set     ◂ │                                                                  │  28 px row, current
│⚙ │  Participants   │            the area's own screen renders here                    │
│  │  Site facts   ⓘ │            (children of this layout)                             │
│  │  Author edition │                                                                  │
│  │                 │                                                                  │
│  │       160       │                       ~1184 wide                                 │
└──┴─────────────────┴──────────────────────────────────────────────────────────────────┘
   48                 the section nav                     the content slot

Site facts, hovered — no href, aria-disabled, the reason in the tooltip:
   │  Site facts   ⓘ │┌──────────────────────────────────────────────┐
   │                 ││ Site facts are not open yet. Each fact is    │
   │                 ││ entered as its own act, with the note it     │
   │                 ││ was read from.                               │
   │                 │└──────────────────────────────────────────────┘
```

Not a routed screen of its own: the project's settings **frame**, at
`src/app/(app)/t/[tenant]/p/[project]/settings/layout.tsx` over the roster
`src/app/(app)/t/[tenant]/p/[project]/settings/areas.ts` (`PROJECT_SETTINGS_AREAS`), drawn inside
`SettingsPane` — the one settings template (`src/app/(app)/t/[tenant]/settings/settings-pane.tsx`,
s-settings I-198). It wraps `/t/{tenant}/p/{project}/settings/ruleset`,
`/settings/participants` and `/settings/ruleset-author`. Increment inc-304a. Law: R-SPINE-012,
AM-04, AM-06, R-UI-030/031/050/060/084/086, B-17, C-05, Q-11. Direction `00-direction.md` §3.6
rules the geometry and outranks this file where the two disagree. Every earlier convention binds:
`cx-` classes, tokens-only colour and motion, `cx-reticle` from its single home, no `[data-theme]`
selector in authored CSS, copy by key with no string literal in JSX beyond test ids and fixed
attribute values. Copy lives in `src/app/(app)/t/[tenant]/p/[project]/settings/strings.ts`, export
`projectSettingsStrings`, keys `project_settings_…` (s-settings-ruleset I-24).

## 0. Interpretations (numbering continues the highest recorded, I-257)

- **I-258 — the frame is a layout, and `projectSettingsNav` is deleted.** Three screens rendered
  the same nav by each calling `SettingsPane` with a roster of its own; that is the second
  spelling B-17 forbids and it is why the nav could disagree with itself between two areas. The
  frame moves once, into `settings/layout.tsx`, which renders `SettingsPane` over
  `PROJECT_SETTINGS_AREAS` with `children` in the content slot; each area's `page.tsx` renders its
  section and no frame. The `projectSettingsNav` export goes with it.
- **I-259 — availability is read off `route`, and an area with none is shown, never hidden.** An
  entry is `{ area, labelKey, route }` where `route` is a builder `(tenant, project) => string` or
  `null`. A `route` builds an `<a>`; `null` builds a `<span data-unbuilt="true"
  aria-disabled="true">` in a Tooltip carrying the reason (Direction §3.3 — disabled with a
  tooltip, never inline grey prose, never absent). The roster is one ordered constant and the order
  it declares is the order rendered: `ruleset`, `participants`, `site-facts`, `ruleset-author` —
  what the project reads, who reads it, what it is told, then what mints the next edition.
- **I-260 — the current row is decided by the segment, in a client component.** A layout cannot
  read the address on the server, so `ProjectSettingsNav` (client) takes the rendered rows and
  calls `useSelectedLayoutSegment()`; the row whose `area` equals the segment carries
  `aria-current="page"`, `--surface-selected` and R-UI-030's 3 px inset beam bar. No row carries
  `aria-current` when the segment names no area of the roster — the nav states where a reader is
  or says nothing, and never guesses. The disabled row can never be current, because no address
  reaches it.
- **I-261 — the nav is the only door, and the breadcrumb is the other statement of place.** These
  three screens are reachable by visible navigation from here and from the S-Home row menu's
  `s-home-project-ruleset` door (not this file's element), never by a typed URL (R-UI-031). Each
  area declares its crumbs in `src/ui/shell/routes.ts`, so `shell-crumb-page` names the page while
  the nav names the set — two statements, one truth, neither restated by the other.

## 1. Regions

| Region | What it holds | Width / height rule | Tokens | Empty |
|---|---|---|---|---|
| section nav | `<nav aria-label>` = `project_settings_nav_label`, then one `<li>` per roster entry, in the roster's order | `var(--drawer-w-min)` 160 × 100 %; each row `var(--control-h)` 28, padding-inline `var(--space-3)`, radius `var(--radius-4)` | `--surface-panel`, `--ink`, `--ink-muted`, `--ink-disabled`, `--surface-hover`, `--surface-selected`, `--line-accent`, `--text-13`, `--radius-4`, `--control-h`, `--drawer-w-min`, `--motion-state`/`--ease` | impossible — the roster is a constant of four (§2) |
| nav row, built | `<a>` (next/link) `data-testid="settings-area"` `data-area={area}`, label from `projectSettingsStrings` | 160 × `--control-h` | as above; `cx-reticle` on focus | — |
| nav row, current | the same `<a>` with `aria-current="page"`, `--surface-selected` fill and the 3 px inset beam bar at its leading edge | 160 × `--control-h` | `--surface-selected`, `--line-accent`, `--ink` | — |
| nav row, unbuilt | `<span data-testid="settings-area" data-area="site-facts" data-unbuilt="true" aria-disabled="true" tabindex="0">` — and `data-testid="site-facts"` on the same element — inside a Tooltip holding `project_settings_unbuilt`. No `href`, no `<a>` | 160 × `--control-h` | `--ink-disabled` (≥ 3:1), no fill, no hover | this row IS the promise-not-yet-kept state |
| content slot | `children` — the area's own screen, which draws its own 40 px header and renders no frame | `1fr` × 100 %; column flex, gap `var(--gap-section)`; pane padding `var(--space-6)` | `--surface-app`, `--gap-section`, `--space-6` | the area's own empty state, never the frame's |

At 1440×900 the content slot is 1440 − 48 rail − 160 nav − 2 × 24 pane padding = **1184** wide and
900 − 40 topbar − 2 × 24 = **812** tall; at 1280×800 it is **1024 × 712**. The nav holds its 160 at
both viewports — four 28 px rows are 112 px of a 812 px column, so nothing in it ever scrolls and
nothing in it ever wraps (one line, ellipsis, tooltip on truncation).

## 2. States (R-UI-050), ruled cell by cell

Declared in `src/app/(app)/t/[tenant]/p/[project]/settings/states.ts`, export
`PROJECT_SETTINGS_NAV_STATES`, in the shell matrix's cell shape; the suite reflects over it (B-19).

- **Loading** — none of its own: the nav is static chrome built from a compile-time roster and
  renders with the layout. While a child area loads, the nav stands complete with
  `aria-current="page"` already on the row being navigated to, and the content slot shows that
  area's `loading.tsx` bones. A skeleton for four known words would be theatre.
- **Empty** — impossible: `PROJECT_SETTINGS_AREAS` is a constant of four entries, and a roster of
  none is a compile error, not a render.
- **Partial** — rendered, and it is the row of any area whose `route` is `null`: an area the product
  has promised and not built stands in its place, disabled, with its reason one hover or one focus
  away. Nothing is hidden because it is not ready. Since inc-304b **no area is in that state**:
  `site-facts` — the roster's one unbuilt entry — has its address, so the state is declared and
  carried by the rendering, and the first area promised after it wears it with no edit here.
- **Error** — delegated: a fault inside a child area surfaces that segment's error boundary inside
  this layout's content slot, so the nav survives the fault and a reader can leave the broken area
  by clicking another one. A fault in the layout itself surfaces the root boundary
  (`src/app/error.tsx`), whose Decision rules retry and the report id.
- **Refusal** — impossible here: the layout reads nothing and calls no procedure, so it can be
  refused nothing. A child's refusal renders in that child's own in-place slot.
- **Busy** — none: every row is a link, and a link is not a pending operation. No row takes a
  loading state, and no row is disabled while a navigation is in flight.
- **Ready** — four rows, one current, one disabled, the content slot filled by the area's screen.
- **Offline** — a fault of reachability (shell I-20): a failed navigation surfaces the error path;
  the nav invents no banner and no row goes grey for the connection.
- **Permission-denied** — delegated to `p/[project]/layout.tsx`, which renders the shell's
  frameless denial before this layout mounts. The nav never hides an area from a reader who lacks
  a permission (R-SPINE-006): every area is listed to everyone who can see the project, and the
  screen behind it answers in place — `settings/ruleset-author` shows its registered
  `PERMISSION_NOT_HELD` with the permission named and the participants link beside it.

## 3. Copy, verbatim (`strings.ts`, export `projectSettingsStrings`)

`project_settings_nav_label` **Project settings** ·
`project_settings_area_ruleset` **Rule set** ·
`project_settings_area_participants` **Participants** ·
`project_settings_area_site_facts` **Site facts** ·
`project_settings_area_ruleset_author` **Author edition** ·
`project_settings_unbuilt` **Site facts are not open yet. Each fact is entered as its own act,
with the note it was read from.**

Nouns on nav rows, never verbs — **Author edition** names the page, and the verb lives on that
page's own button (Direction §6). No exclamation marks, no build vocabulary: the tooltip says what
is true of the product, never when a session will ship it. The four labels are also the crumb page
names in `routes.ts`, one home for the words (B-17).

## 4. Motion (R-UI-004)

Row fill and ink over `var(--motion-state)` `var(--ease)` on hover and on the current row's arrival
— the 3 px bar does not slide between rows, because a navigation is a new document and a bar that
travels claims a continuity the page does not have. The Tooltip uses the shipped primitive's own
motion. No entrance on the nav, no stagger, no bounce. Every duration is a token zeroed at source
under `prefers-reduced-motion`, so `settings.css` carries no reduced-motion branch.

## 5. Tokens

Semantic aliases and density/layout tokens only (Direction §4 rule 3; a `--graphite-*`/`--beam-*`
reference here is a `cubit/no-primitive-token` failure): `--surface-panel` · `--surface-app` ·
`--surface-hover` · `--surface-selected` · `--ink` / `--ink-muted` / `--ink-disabled` ·
`--line` through `--hairline` (the seam between nav and pane) · `--line-accent` (the current row's
bar) · `--drawer-w-min` · `--control-h` · `--gap-section` · `--space-2/3/6` · `--text-13` ·
`--radius-4` · `--motion-state` / `--ease`. Px literals, closed set: R-UI-030's 3 px selection bar.
Any other literal is a defect; the nav adds no rule to `settings.css` beyond the roster's own
disabled row, and the template's existing chrome is not re-declared.

## 6. Themes

Dark is the default and light is complete; the difference arrives only through token values
(R-UI-001), and no authored selector reads `[data-theme]`. What differs between them is the flip of
the graphite scale behind the aliases: in dark the nav's `--surface-panel` is the lighter plate on
the app ground, in light it is the quieter one — the seam, the fill and the beam bar keep their
roles in both. Contrast facts held in both themes: `--ink` on `--surface-panel` ≥ 4.5:1, the current
row's ink on `--surface-selected` ≥ 4.5:1, the disabled row's `--ink-disabled` on
`--surface-panel` ≥ 3:1 (the UI floor — a disabled row is still a statement a reader must be able
to read), the beam bar ≥ 3:1 against the row it marks. Both themes are captured: the nav is inside
`s-settings-ruleset-author/authoring-open` and its light twin `authoring-open-light`.

## 7. Test hooks (closed contract, C-05)

Routes: `/t/{tenant}/p/{project}/settings/ruleset` · `/t/{tenant}/p/{project}/settings/participants`
· `/t/{tenant}/p/{project}/settings/ruleset-author` (tree spelling
`/t/[tenant]/p/[project]/settings/ruleset-author`). Test ids, exactly two, on the elements §1 rules:

- `settings-area` — every nav row, built or not, in the roster's order; each carries `data-area`
  with one of `ruleset`, `participants`, `site-facts`, `ruleset-author`.
- `site-facts` — the site facts row, which is the same element as its `settings-area` row. It was
  the unbuilt one; since inc-304b it is an `<a>` to `/t/{tenant}/p/{project}/settings/site-facts`,
  and the id is kept because the journeys enter that screen by clicking this row (R-UI-031).

`shell-crumb-page` is the shell's own, read here only to name the area a reader landed in. The
S-Home door `s-home-project-ruleset` is s-home's element and is not added by this file.

Behavioural hooks without new ids: `data-unbuilt="true"` and `aria-disabled="true"` on the row of
an area with no `route` — carried by no row today, since `site-facts` has its address (inc-304b) and
every entry of the roster is an `<a>`; `aria-current="page"` on exactly the
row matching `useSelectedLayoutSegment()`; each built row's resolved `href`; `aria-label` on the
`<nav>`; `cx-reticle` on every focusable row, the disabled one included (it is `tabindex="0"` so
its reason is reachable by keyboard, Q-11).

Proof: J-304 (`tests/e2e/ruleset-author.spec.ts`) walks the nav at checkpoint
`s-settings-ruleset-author/authoring-open` — four rows in the declared order, `site-facts`
disabled and hrefless, `ruleset` current on arrival, then the `ruleset-author` row activated as a
customer activates it. `tests/ui/project-settings/**` mounts `ProjectSettingsNav` under jsdom over
the roster for each segment and walks `PROJECT_SETTINGS_NAV_STATES`;
`src/ui/shell/routes.test.ts` pins the crumbs. Baseline moved by the nav's two new rows:
`tests/e2e/baselines/design-dark/j-003/ruleset-pin-visible.png`, re-taken in its own `baseline:`
commit (B-20).

## Additional test hooks

The registry names no attribute for the RENDERED read contract this tree's `retrying-read` support
requires of every screen region (`data-state`, `data-rendered-region`, `data-rows-rendered`). The
layout itself needs none — it renders no read — but the screen inside it does; the gap is recorded
under the same heading in `docs/design/s-settings-ruleset-author.md` §7 and is a plan defect, not a
spelling to invent here.

## Changelog

- 2026-09-16 — inc-304a-ruleset-authoring-ui: first edition. The project settings frame becomes a
  layout over `PROJECT_SETTINGS_AREAS`; `projectSettingsNav` is deleted (I-258); `site-facts` ships
  as the roster's one `route: null` entry (I-259), addressed by inc-304b.
- 2026-09-19 — inc-304b-site-facts-panel: the `site-facts` entry gains its `route`, so its row is an
  `<a>` with no `data-unbuilt` and no `aria-disabled`, and `project_settings_unbuilt` no longer says
  site facts are unopened — it is the reason ANY promised area carries, read by whichever row has no
  address. No row is in that state today. The Author edition baselines were re-taken for the ink the
  live row changed (B-20).
