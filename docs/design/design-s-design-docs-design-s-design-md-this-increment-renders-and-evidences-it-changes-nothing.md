# Design Decision — S-Design as gate evidence (J-004: baselines, axe, keyboard)

The screen is already decided: `docs/design/s-design.md` fixes every region, state, string and
token of `/design`, and this increment changes none of it — no file under `src/**` moves. What
AM-03(4) now demands, and this document decides, is the **evidence**: which framings of that
screen become the 40 committed Linux baselines, what each of the 36 journey checkpoints must
show when it is photographed and axe-scanned, and the exact keyboard grammar that proves
R-UI-012/R-UI-060 operability. Two builders following this document produce the same journey,
the same PNG roster, the same gestures.

Interpretations recorded:

1. AM-03(1) requires a Design Decision for an increment that "ships or changes a screen". This
   increment renders and evidences S-Design without changing it, so this decision governs only
   the evidence and defers every rendering question to `s-design.md`. If a photographed pixel
   contradicts `s-design.md` (or an axe/keyboard checkpoint fails on a merged primitive), that
   is a defect of the owning surface: it blocks per AM-03 and is cured by a spliced fix node
   (C-03) — it is never re-decided, filtered or masked here.
2. "Both themes" at a checkpoint means: light is the fresh navigation (`data-theme` absent is
   the light default, `s-design.md` §10) and dark is entered by operating
   `design-theme-toggle` after that navigation — the attribute is in-memory only
   (`s-design.md` §3), so dark is re-entered after every `goto`, never assumed to persist.
3. R-UI-011's "the visual baseline suite screenshots it" is read as the 20-name roster of §2
   per theme — three module-section element shots, seven forced-state viewports, ten
   open-overlay viewports — not one full-page PNG. A single full-page baseline would report
   every drift as the same undiagnosable diff; a per-section, per-surface shot names the
   component that moved.

## 1. Frame — what one shot contains

- Every shot renders in the lane's chromium project: Desktop Chrome, 1280 × 720 viewport,
  fonts through `tests/e2e/setup/fonts.conf`. Comparison is the committed config unchanged —
  `maxDiffPixelRatio: 0.002`, `updateSnapshots: 'none'` — so a missing baseline or a drifted
  render fails the lane (Q-06). No masks: sample data is deterministic (`s-design.md` §4) and
  motion is reduced (§5 below).
- **Section element shots** (`primitives.png`, `patterns.png`, `data.png`): the element
  screenshot of one `main`-column module section — its `h2` heading, the hairline under it,
  and every entry card of that module in roster order (`s-design.md` §5), full height even
  past the viewport. Taken on the live gallery only.
- **Viewport shots** (the seven states, the ten overlays): the 1280 × 720 viewport as the
  journey's own gesture left it. State shots are taken immediately after navigation, scroll at
  the top — top bar, rail, and the forced surface (for partial and offline, the notice bar
  with the live gallery visible beneath it, shown not hidden). Overlay shots are taken the
  moment the polled surface is visible, with whatever scroll the keyboard focus travel
  produced — deterministic because the gestures are fixed and the lane runs one worker.
- Snapshot names are always the array `['design', <theme>, <name>]`, which the config's
  `snapshotPathTemplate` routes to `tests/e2e/baselines/design/<theme>/<name>` — a string name
  loses its directory.

## 2. The checkpoint roster — 36 axe scans, 40 baselines

Every checkpoint below runs in both themes (light per Interpretation 2, then dark via the
toggle) and calls `expectNoAxeViolations` from `tests/e2e/axe.ts` — zero violations of any
impact, which subsumes Q-11's zero serious/critical. Nothing is narrowed or excepted.

| Checkpoint | Route / gesture | Shots per theme |
|---|---|---|
| `live-gallery` | `/design`, no query | `primitives.png` · `patterns.png` · `data.png` |
| `state-loading` | `/design?state=loading` | `state-loading.png` |
| `state-empty` | `/design?state=empty` | `state-empty.png` |
| `state-error` | `/design?state=error` | `state-error.png` |
| `state-refusal` | `/design?state=refusal` | `state-refusal.png` |
| `state-partial` | `/design?state=partial` | `state-partial.png` |
| `state-offline` | `/design?state=offline` | `state-offline.png` |
| `state-permission-denied` | `/design?state=permission-denied` | `state-permission-denied.png` |
| `overlay-<entry>` ×10 | live gallery, §3's gesture on that entry | `overlay-<entry>.png` |

2 themes × (1 + 7 + 10) = 36 axe checkpoints; 2 × (3 + 7 + 10) = 40 PNGs, identical filename
sets under `light/` and `dark/`. The journey takes one test per checkpoint (workers = 1, so
order is deterministic and each test fits the 60 s budget); every test title path contains the
literal `J-004`.

## 3. The overlay checkpoints — gesture and photographed surface

All triggers and copy are `s-design.md` §5 verbatim; anatomy is `datum-primitives.md` §§6–12
and `datum-patterns.md` §9. The gesture column is the decided grammar — one gesture per entry,
keyboard only, focus placed by Tab/gesture, never by mouse. Every open **polls** for the
visible surface (`toBeVisible` under the 10 s expect timeout); no synchronous open assertion.

| Entry | Open gesture (on the focused trigger) | The shot must show |
|---|---|---|
| `dialog` | Enter on "Rename sheet" | Scrimmed dialog: title "Rename sheet", description "The new name appears everywhere this sheet is cited.", Input holding "Ground floor plan" |
| `sheet` | Enter on "Open sheet details" | Side panel: title "Sheet details", body "Scale 1:100. Calibrated against grid line A–B." |
| `consequence-dialog` | Enter on the danger trigger "Void signatures" | Title "Void signatures"; consequence lines "Signatures voided" 3, "Estimate lines reopened" 14 |
| `dropdown-menu` | ArrowDown on "Sheet actions" | Menu: "Rename sheet", "Duplicate sheet", destructive "Delete sheet" |
| `context-menu` | Shift+F10 on the focused "Sheet B-2" region | The same three items beside the region |
| `popover` | Enter on "Sheet details" | Body "Scale 1:100. Calibrated against grid line A–B." |
| `tooltip` | Focus alone on the "Snap settings" IconButton | Tip "Snap to grid intersections" |
| `select` | ArrowDown on the placeholder trigger | Listbox: "Wall" "Column" "Beam" "Slab" |
| `combobox` | ArrowDown in "Search layers" | List: "S-COL" "S-BEAM" "S-SLAB" |
| `toaster` | Enter on "Show a notification" | The fired toast "Measurement saved." visible |

The toast auto-dismisses (~4 s): fire, poll visible, photograph and axe-scan immediately, in
that order. The axe scan at each overlay checkpoint runs **with the surface open** — the
overlay's own contrast and labelling are the evidence, not the page beneath it.

## 4. The keyboard journey (R-UI-012, R-UI-060, Q-11)

- **Theme toggle.** The top bar precedes the rail and main column in DOM order and holds the
  sheet's one chrome control, so a single Tab from the loaded document lands on
  `design-theme-toggle`. While focused, its computed outline is visible — `outline-style` not
  `none`, `outline-width` ≥ 2 px — the R-UI-012 focus ring, whose colour is the token sheet's
  `--cobalt-500` and is graded by the baselines, not by a computed-colour assertion. Space
  flips `document.documentElement`'s `data-theme` to `"dark"`; Space again returns it to
  `"light"`. Both directions are asserted.
- **Escape and focus return.** Every dismissible surface of §3 closes on Escape. For `dialog`,
  `sheet` and `consequence-dialog` — real Radix triggers, so return is native — focus is
  asserted back on the trigger after Escape. Menus, popover, tooltip, select and combobox are
  dismissed by Escape without a focus-return assertion; the toast is left to expire.
- **Rail anchor.** The first rail entry — the anchor "Button", `#button` — is focused and
  activated by Enter; the URL fragment becomes `#button`. One anchor proves the rail's
  activation grammar; the rest share its markup.
- A gesture that fails here — an unfocusable trigger, a stranded focus, a missing outline —
  is a primitive defect: it blocks per AM-03 and routes to a fix node against the owning
  surface (Interpretation 1). The journey never works around it.

## 5. Motion under the camera (R-UI-004)

The page object calls `page.emulateMedia({ reducedMotion: 'reduce' })` after every navigation:
the token sheet zeroes every `--motion-*-duration` under that media (`datum-tokens.md` §1) and
the loading state's Skeleton pulse is stilled, so the skeleton, panel and toast pixels are
stable. `toHaveScreenshot`'s default `animations: 'disabled'` covers anything that slips
through. The theme flip is untransitioned by design (`s-design.md` §3). This is why the roster
declares no masks: a volatile region, if one ever appears, is a spec revision with a recorded
reason, never an improvised mask.

## 6. Tokens

None introduced. Every pixel the baselines grade is `s-design.md` §9's token set rendered
through `src/ui/tokens.css`; the 20 dark PNGs are the standing proof that the
`[data-theme="dark"]` block of `datum-tokens.md` §2 actually paints — the flip strands
nothing, per the J-004 checkpoint that token decision already names.

## 7. Both themes

Light is the fresh navigation; dark is entered by operating `design-theme-toggle` after every
`goto` (Interpretation 2). The two baseline directories carry byte-identical filename sets —
`tests/e2e/baselines/design/light/**` and `.../dark/**`, 20 PNGs each — so a checkpoint that
exists in one theme and not the other is structurally impossible to commit.

## 8. Test hooks (C-05)

No new routes, test ids or strings: the journey consumes exactly the hooks `s-design.md` §11
already registered (`design-gallery-root`, `design-theme-toggle`,
`design-screen-state-<state>`, `gallery-entry-<entry-id>-<state>`, and the `/design?state=…`
routes). What this increment adds to the contract instead:

- `tests/e2e/pages/design.ts` — named exports `DesignPage` (`gotoLive(theme)`,
  `gotoState(state, theme)`, `toggleThemeByKeyboard()`, `openOverlayByKeyboard(entryId)`),
  `SCREEN_STATES` (the seven state names), `OVERLAY_ENTRIES` (§3's ten entry ids, in that
  order), and `DESIGN_BASELINES` (the 20 filenames of §2).
- `tests/e2e/j-004-design.spec.ts` — the journey; every test title path contains `J-004`.
- `tests/e2e/baselines/design/<theme>/<name>` — the 40 committed PNGs.

Nothing else in the lane — `scripts/e2e.mjs`, `playwright.config.ts`, `tests/e2e/axe.ts`, the
fonts, the smoke/harness/red specs — is touched (C-03, C-09).
