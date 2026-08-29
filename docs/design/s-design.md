# Design Decision — S-Design (the living gallery at /design)

Screen: the living component gallery — `src/app/(app)/design/page.tsx` (client component,
default export, the `/design` route) rendering the derivation in
`src/ui/gallery-derivation/index.ts`. Law: R-UI-001/003/004/011/012/050, B-17, B-19, Q-06,
Q-11, C-13, J-004. Every convention of the earlier Decisions binds: tokens-only colour and
motion, `cx-` classes, no `[data-theme]` selector in authored CSS, `cx-reticle` solely from
its single home. Core's Interpretations I-1 (mandated geometry constants in px) and I-2 (no
`transparent`) remain in force. The gallery is evidence, never the consumer (R-UI-011): it
invents no component, restyles nothing, and imports only through the barrels — a
comment-stripped scan of `src/app/(app)/design/**` and `src/ui/gallery-derivation/**` finds
no barrel-internal import path and no colour literal. Stylesheet:
`src/app/(app)/design/design.css`, imported by the page, classes `cx-gallery-*`.

## 0. Interpretations (recorded per the Law section of CLAUDE.md)

- **I-15 — "every state" means every mountable state.** R-UI-011 says every component in
  every state; a `render(): ReactNode` can mount only states reachable through props, data
  and composition. Gesture states (hover, active, focus-visible) and open overlays are
  demonstrations a visitor performs live in the gallery, not static rows: a modal Dialog
  rendered open would scrim the whole page, `aria-modal` would hide every other entry from
  assistive technology and axe, and forty portalled overlays cannot share one document.
  Ruling: overlay entries render **closed** with their trigger reachable — the open state is
  one activation away and its paint is the component-level baseline IOU the increment spec
  records (owner: the component increments). Gesture-state paint stays ruled and graded in
  the owning Decisions.
- **I-16 — a family part's entry renders the family's canonical composition.** The required
  key set is `galleryBarrels` × `componentExports`, so `DialogClose`, `TabsList`,
  `ResizableHandle` each owe an entry, yet none mounts lawfully alone. Ruling: a part entry
  renders the same canonical sample composition as its family root, under the single state
  name `composed`; the visible repetition of a closed trigger is accepted as completeness
  evidence, never deduplicated away — an absent key must stay a failing test (B-19).
- **I-17 — the identifiers are the copy; the strings live once in the derivation module.**
  Barrel ids, entry keys, export names and state names render verbatim in
  `var(--font-mono)`: the page is evidence of the tree, and prose that renamed a key would
  break the correspondence the derivation exists to prove. They are machine identifiers in
  the same class as test ids and codes. The two chrome strings (§3) and every sample-data
  string are authored once in `src/ui/gallery-derivation` and referenced from JSX — no
  string literal in the page's JSX beyond test ids and fixed attribute values. Sample
  compositions reuse **verbatim** the copy their owning Decisions fixed (primitives-core §4,
  primitives-data §4, refusal-state §3); the only new copy is §3's.
- **I-18 — sample refusals are authored data, typed but never value-imported.** The
  derivation module is ui-layer, so it takes `import type { RefusalEntry }` and authors
  sample entries as data (the refusal-state ruling: `refusalOf` lookups belong to callers,
  and ARCH-01 keeps ui value-import-free of core). Where a severity has a registered code
  the sample reuses that code and **its registered copy verbatim** — and every severity has
  one: error → `PRECISION_NOT_APPLIED`, warning → `RATE_LIMITED`, info →
  `ACT_CHANGES_NOTHING` (registered at severity `info` in `src/core/errors.ts`). The gallery
  therefore spells no code and no refusal sentence the taxonomy does not already own, which
  is also what Q-07's orphan-code scan requires; growing the registry is not this screen's
  to do. Only the evidence links beside each sample are §3's.
- **I-19 — demo geometry constants are px (I-1 extended).** Sample data needs boxes no
  token measures: the Skeleton bone renders 240 px wide, the ScrollArea and Resizable demos
  160 px tall, the DataTable's virtualised viewport 240 px tall, and its pinned sample
  400 px wide (capped at `100%`). These five constants are the only px in a *declaration* in
  `design.css`; a sixth declaration in px is a defect. Two of them measure a state rather
  than a box, and are the state's evidence: a viewport **shorter** than the five-line states
  are tall is what makes the thousand-line register crop and scroll instead of repeating the
  `comfortable` picture, and a box **narrower** than the five columns are wide is what gives
  the pinned column something to hold still against. A sample geometry that hides the state
  it names is the defect the constant exists to prevent. The Resizable demo needs a definite
  inline size too — a panel group sized to its content collapses to its labels and breaks
  **Sheet list** mid-word — and it takes `var(--breakpoint-sm)` capped at `100%`, a token
  read, so it adds none. I-20 rules the one px outside a declaration.
- **I-21 — a sample toast does not expire.** The Toaster's only reachable demonstration is
  its trigger, and sonner retires a toast after four seconds, so an expiring sample leaves
  the entry blank for everyone who looks a moment later — the component's one state,
  ungradeable. The sample raises its toast with no expiry, under a fixed id so re-activating
  the trigger re-uses that toast rather than stacking a column. Duration and identity are
  the caller's arguments, not paint: nothing here restyles the Toaster (B-17).
- **I-20 — a media condition states its breakpoint in px, because CSS gives it no other
  way.** §1's ground padding steps at sm, so `design.css` carries
  `@media (min-width: 640px)`. A media condition is evaluated before the cascade and cannot
  read a custom property: `@media (min-width: var(--breakpoint-sm))` is invalid and drops the
  block, so the value of `--breakpoint-sm` (`src/ui/tokens.css`, 640px) has to be spelled at
  the condition. It is a transcription of a token, not a new constant, and the house has
  ruled it once already — `src/app/(auth)/s-auth.css` states the same breakpoint the same
  way. Ruling: exactly one media condition, carrying exactly `--breakpoint-sm`'s registered
  value, is lawful in `design.css`; a second condition, a different value, or the same value
  in any declaration is a defect. Everything a declaration paints or measures stays a token
  read (R-UI-001) or one of I-19's four constants — and if the registered value of
  `--breakpoint-sm` ever moves, this condition moves with it.

Recorded IOU — the ghost trigger's rest affordance (owner: the overlay primitive increment,
`src/ui/primitives/overlay` + core's `.cx-btn[data-variant="ghost"]`). Every overlay trigger
in §2 is the shipped ghost Button, whose rest paint is background-less and border-less, so a
column of triggers reads as prose until it is hovered or focused. That paint is the owning
Decisions', ruled and rendered in `src/ui/primitives/**`, which this screen may neither
restyle (B-17) nor wrap in chrome of its own (§1); the gallery shows the trigger exactly as
the product ships it. Recorded here so the reading is evidence, not an oversight.

Recorded IOU — the overlay surfaces' hairline (owner: the overlay and data primitive
increments, `src/ui/primitives/overlay/overlay.css` and `src/ui/primitives/data/data.css`).
`--hairline` is registered as the whole shorthand (`1px solid var(--graphite-200)`,
`src/ui/tokens.css`), so `border: 1px solid var(--hairline)` — the form both stylesheets use
for the menu, popover, dialog, sheet and the table's pinned edge and row rules — is an
invalid declaration and paints no border at all. Nothing separates an open menu from the
page in dark, where its `var(--graphite-0)` fill is the ground's own value, and a pinned
column shows no edge. The one home of that rule is the owning primitive's stylesheet
(B-17); the gallery may neither restyle a `cx-` class it does not own nor keep a corrected
copy of it, so what this screen can do it does — the pinned sample is given a box narrow
enough that the state reads from position (I-19) — and the border itself is recorded here
against its owners. Discovered from the gallery, which is what the gallery is for.

Recorded IOU — the toast's dark paint (owner: the overlay primitive increment,
`src/ui/primitives/overlay/toast.tsx` + `overlay.css`'s `.cx-toast`). With the sample toast
standing (I-21) the gallery shows what a four-second toast hid: in dark the card paints on
sonner's own light default, not on the `.cx-toast` token read, so it is the one surface on
the page that does not turn with the theme. Its one home is the Toaster's own module and
rule; this screen passes no style and keeps no corrected copy (B-17).

Recorded IOU — RefusalState's `inline` and `dialog` surfaces paint alike, by that pattern's
own ruling (owner: `src/ui/patterns/refusal-state`). Its Decision states it verbatim in
`refusal-state.css`: "`inline` and `dialog` are chrome-identical: the hint routes placement
— inside the flow that raised the refusal — not different paint, and a second dialect of the
card is what B-17 forbids." The nine severity × surface cells in §2 therefore evidence six
paints and three placements; the surface each cell carries is legible as `data-surface` on
the card, which is where the pattern publishes it. The gallery declares the states the
component takes, not the states its stylesheet happens to distinguish — collapsing the three
surfaces to two rows would hide a prop the pattern accepts, and painting the difference here
would be the second dialect its owner forbids.

Recorded IOU — visible navigation. R-UI-031 owes every shipped screen a visible path from
the shell; no shell exists yet. `/design` is journey- and URL-reachable until the shell
increment (inc-013) decides its link — that increment's debt, recorded here as S-Auth
recorded the same for `/sessions`.

## 1. Layout and hierarchy

One column on the `var(--graphite-0)` page ground: `main.cx-gallery`, max-width
`var(--breakpoint-lg)`, margin-inline auto, padding `var(--space-6)`
(`var(--space-4)` below sm), content stacked at gap `var(--space-8)`.

```
<main class="cx-gallery">
  <header data-testid="gallery-shell" class="cx-gallery-shell">
    <h1>…</h1>
    <p>…</p>
  </header>
  …one per key of galleryBarrels, in code-point order of the id…
  <section data-testid="gallery-barrel" data-barrel="<barrelId>">
    <h2><barrelId></h2>
    …one per matching galleryEntries key, in componentExports order…
    <section data-testid="gallery-entry" data-entry="<barrelId>/<ExportName>"
             aria-labelledby="gallery-entry-<barrelId>-<ExportName>">
      <h3 id="gallery-entry-<barrelId>-<ExportName>"><ExportName></h3>
      <div class="cx-gallery-states">
        …one per declared state, in declared order…
        <div data-testid="gallery-state" data-state="<name>">
          <p class="cx-gallery-state-label"><name></p>
          {state.render()}
        </div>
      </div>
    </section>
  </section>
</main>
```

- **Shell** (`gallery-shell`) — the chrome the baselines capture: `h1` `var(--text-24)`
  `var(--weight-heading)` `var(--graphite-900)`, caption `var(--text-13)`
  `var(--graphite-600)` at gap `var(--space-1)`, padding-bottom `var(--space-4)`,
  border-bottom `var(--hairline)`. Nothing else lives in it — a deterministic region whose
  bytes change only when the theme flips token values.
- **Barrel section** — `h2` is the barrel id verbatim (I-17): `var(--font-mono)`
  `var(--text-16)` `var(--weight-heading)` `var(--graphite-900)`; entries stack under it at
  gap `var(--space-5)`.
- **Entry** — a hairline card: border `var(--hairline)`, radius `var(--radius-8)`, padding
  `var(--space-4)`, no fill (the page ground shows through). `h3` is the export name
  verbatim: `var(--font-mono)` `var(--text-14)` `var(--weight-heading)`
  `var(--graphite-900)`. The `h3` carries an id and the `section` borrows it through
  `aria-labelledby`, which is what makes the card a *named* region: a family part renders its
  family's whole composition (I-16), so "Rename project" appears once per Dialog part and
  "Row actions" once per DropdownMenu part, and a reader browsing by control — not by heading
  — needs the surrounding region to say which entry it is standing in. The id is the entry key
  with its separators folded to hyphens, unique because the key is. States lay in a wrapping flex row, gap `var(--space-5)`
  `var(--space-4)`; a wide sample (DataTable, Resizable, Tabs, ScrollArea, banner-surface
  refusals) naturally takes the full row. One exception, keyed on this screen's own
  `data-entry` hook (§7) and never on a pattern's class: the **RefusalState** entry's nine
  cells lay on one track — a grid of `minmax(min(100%, var(--breakpoint-sm)), 1fr)` columns —
  because the point of that entry is comparing severity against surface, which content-sized
  cells at jumping column starts and differing widths defeat.
- **State cell** — label over sample at gap `var(--space-2)`; label `var(--font-mono)`
  `var(--text-12)` `var(--graphite-600)`, the state name verbatim, lowercase kebab-case.
  The sample is exactly `render()`'s output — the gallery wraps it in no extra chrome.

Rendering is the derivation, never a hand list: barrels from `galleryBarrels`, entries from
`galleryEntries`, order fixed above so captures are deterministic. Density (R-UI-005): the
gallery's own chrome has no rows; the DataTable samples carry their own densities.

## 2. State roster per entry (the design of the sample data)

State names and sample data, with copy per I-17 (all from the owning Decisions' §4 unless
§3 says otherwise). Today's derived key count is 42; this table binds the *states of the
entries that exist*, while existence itself stays derived (B-19) — a new export owes a new
entry designed to these rules, not an edit to a frozen list here.

- **Button** — `primary` · `secondary` · `ghost` · `danger` · `act` · `loading` (the
  loading primary) · `disabled` (the disabled secondary).
- **Input** / **Textarea** — `rest` · `invalid` (`aria-invalid`) · `disabled`.
- **Badge** — `rest`. **Kbd** — `rest`. **Skeleton** — `rest` (240 px, I-19).
- **Chip** — `rest` (interactive) · `selected` · `static` (no `onClick`).
- **BasisChip** — one state per basis, named the basis lowercase: `measured` ·
  `transcribed` · `derived` · `imported` · `entered` · `interpreted` · `defaulted`.
- **CoverageChip** — `low` (0.32 → 32%) · `mid` (0.82 → 82%) · `full` (1 → 100%).
- **Tooltip** — `rest` (closed; content one hover/focus away, I-15).
- **Dialog** / **Sheet** / **Popover** / **DropdownMenu** / **ContextMenu** — `closed`
  (the family's canonical composition in full — for Dialog that includes primitives-data
  §4's footer, secondary **Cancel** then primary **Save changes** — trigger reachable);
  every family part
  (`DialogTrigger`…`ContextMenuItem`) — `composed` (I-16).
- **Toaster** — `ready`: the mounted Toaster plus one ghost Button (§3's trigger) that
  fires the primitives-data sample toast on activation. The toast does not expire and is
  raised under a fixed id, so it stands as the entry's evidence and re-activation re-uses it
  (I-21).
- **Tabs** — `rest` (Overview active) · `disabled` (the History trigger disabled);
  `TabsList` / `TabsTrigger` / `TabsContent` — `composed`.
- **Tree** — `rest` (the §4 sample, expanded and selected). **ScrollArea** — `rest`
  (forty lines, 160 px, I-19). **ResizablePanelGroup** — `rest` (Sheet list 30 / Viewer
  70, 160 px); `ResizablePanel` / `ResizableHandle` — `composed`.
- **DataTable** — `comfortable` · `compact` · `pinned` (Item pinned left, in a 400 px box so
  the rest of the row scrolls under it, I-19) · `virtualised` (the generated 1000-row set,
  240 px viewport, I-19). Every column of the sample register carries its filter, so the
  filter row holds a labelled field per column and no column header stands empty.
- **RefusalState** — the nine severity × surface cells its Decision §4 enumerates, named
  `<severity>-<surface>`: `error-inline` · `error-dialog` · `error-banner` ·
  `warning-inline` · `warning-dialog` · `warning-banner` · `info-inline` · `info-dialog` ·
  `info-banner`. The card renders directly (its Decision: dialog is chrome-identical to
  inline; placement is the consumer's) — never inside a live Dialog here (I-15). Sample
  entries per I-18, evidence links per §3.

## 3. Copy, verbatim (only what no earlier Decision fixed)

- `h1` — **Design gallery**
- caption — **Every shipped component, rendered in every state it can hold, with sample
  data.**
- Toaster trigger (ghost Button) — **Save quantity** (activating it shows the
  primitives-data sample toast: **Quantity updated** / **Line 4 — 7.25 CUM saved to the
  register.**)
- Sample refusals (I-18) — no new copy: each severity's sample is a registered entry, message
  and remedy verbatim from `src/core/errors.ts` (`PRECISION_NOT_APPLIED` ·
  `RATE_LIMITED` · `ACT_CHANGES_NOTHING`).
- Sample evidence links — error cells `{ href: "/settings/documents", label: "Open
  document settings" }` (the refusal-state Decision's sample) · warning cells
  `{ href: "/design", label: "Try again" }` (RATE_LIMITED's idiom, current route) · info
  cells `{ href: "/", label: "Open the project" }`.

Voice: calm and concrete, no exclamation marks, no build vocabulary in prose; the mono
identifiers are data, not prose (I-17).

## 4. States (R-UI-050) — a static evidence page, ruled cell by cell

The page is compiled from static barrel imports and the derivation module; it consults no
seam, fetches nothing, awaits nothing. This section is the screen's declared matrix:

- **Default** — the only rendered state: §1 in both themes.
- **Loading** — none. Nothing is awaited; a skeleton for instant content is theatre
  (R-UI-004). (Skeleton the component appears as sample data, not as this page's state.)
- **Empty** — impossible on a shipped tree: a barrel with no components or a component
  with no entry fails the derivation suite before the page can ship (`missingEntries()`
  empty is gate law), so the gallery never renders, and never writes copy for, a bare
  section.
- **Error** — a render fault mounts the root error boundary (`src/app/error.tsx`); this
  page adds nothing to it.
- **Refusal / partial** — impossible: no request is made, nothing can be refused, there
  are no rows to partially show. No screen-local refusal block exists (the RefusalState
  instances on the page are sample data with `data-entry` ancestry, never an answer).
- **Offline** — indistinguishable by design: fully static once loaded, nothing ages.
- **Permission-denied** — none: `/design` is ungated evidence today; if a later increment
  gates the `(app)` group, that increment's Decision rules this cell.

Interactive elements on the page are the samples' own (triggers, tabs, tree items, the
table); each carries its reticle from the single home. The gallery chrome itself adds no
interactive element.

## 5. Motion (R-UI-004)

The gallery chrome has none: no entrance, no scroll effects, no stagger — evidence does not
perform. All motion on the page belongs to the mounted samples and is already ruled in
their Decisions, every duration a token zeroed at source under reduced motion. Baseline
captures run with `animations: "disabled"`, and the shell region contains nothing animated
regardless.

## 6. Tokens and themes

Named by this screen's chrome: `--graphite-900`, `--graphite-600`, `--hairline`,
`--font-mono`, `--text-24`, `--text-16`, `--text-14`, `--text-13`, `--text-12`,
`--weight-heading`, `--space-1/2/4/5/6/8`, `--radius-8`, `--breakpoint-lg`,
`--breakpoint-sm` (the Resizable demo's inline size and the RefusalState track's `minmax`,
and — as its value, per I-20 — the one media condition). Ground and body type inherit from
`globals.css`; no other value appears in `design.css` beyond I-19's five px constants and
I-20's single condition. `design.css` contains no `[data-theme]` selector and no focus rule; every
light/dark difference arrives through token values (R-UI-001) — which is exactly what makes
the two committed shell baselines differ without being told to. The theme is read off
`html[data-theme]`, set by the root document's resolver; the page offers no theme control
(out of scope) and never branches on the theme.

## 7. Test hooks (closed contract, C-05)

Route introduced: `/design`. Test ids, exactly these four, on the elements ruled in §1:
`gallery-shell` (the header holding the `h1`) · `gallery-barrel` (each barrel `<section>`,
`data-barrel` = the barrel id) · `gallery-entry` (each entry `<section>`, `data-entry` =
`"<barrelId>/<ExportName>"`) · `gallery-state` (each state cell, `data-state` = the state
name). Behavioural hooks without new ids: the samples' own contracts (roles, `data-*`,
`cx-reticle`) as ruled in their Decisions.

- Derivation suite (product-owned, inside `src/ui/gallery-derivation/`): `galleryBarrels`
  keys equal the filesystem's barrel index files (`src/ui/primitives/*/index.ts{,x}`,
  `src/ui/patterns/*/index.ts{,x}`, plus `src/ui/shell/index.ts{,x}` when it exists);
  `missingEntries()` is empty; `componentExports` filters uppercase runtime components and
  sorts by code point (never `localeCompare`).
- jsdom acceptance mounts the page's default export (client component, no server-only
  imports) and asserts the §1 structure against the derivation, never against a copied
  list (B-19).
- J-004 (`tests/e2e/journeys/j-004-gallery.spec.ts`, title containing "J-004"), page
  object `tests/e2e/pages/s-design.page.ts`: drives `/design` in light
  (`html[data-theme="light"]`) and under `prefers-color-scheme: dark` emulation with
  reload (`html[data-theme="dark"]`); asserts every `gallery-barrel` holds ≥ 1
  `gallery-entry` and every visible `gallery-entry` holds ≥ 1 `gallery-state`; axe from
  the checkout's own axe-core, serious/critical = 0 in both themes, never widened (Q-11).
- Baselines (Q-06): `toHaveScreenshot` on the `gallery-shell` locator, animations
  disabled, names `design/gallery-shell-light.png` / `design/gallery-shell-dark.png`,
  routed to `tests/e2e/baselines/` by playwright.config.ts's new `snapshotPathTemplate`
  `"tests/e2e/baselines/{arg}{ext}"` (platform-suffix-free; the only key this increment
  touches). The two committed files are not byte-identical — the token flip guarantees it.
  A re-baseline records its reason. Component-level baselines are the I-15 IOU, not files
  here.
- Journey checkpoints: **j-004-gallery-light** · **j-004-gallery-dark** per the increment
  spec. `pnpm e2e --journey J-000` still exits 0 after merge — one invocation per journey.
