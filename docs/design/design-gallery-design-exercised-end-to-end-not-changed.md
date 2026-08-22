# Design Decision — design-gallery (`/design`), exercised end to end, not changed

`/design` is graded this increment, not redesigned. The standing contract is
`docs/design/s-design.md` — layout, the seven `?state=` surfaces, the §5–§6 roster, §7 copy,
motion, tokens, themes, test hooks — every section still binding, no section amended. This
decision fixes what journey J-004 does to that screen: the checkpoint order, what each baseline
frames, where axe runs, and what the keyboard step must prove. Two builders reading this and
s-design.md produce the same screen and the same journey.

Interpretations recorded:

1. J-004's clause is "Design gallery renders both themes; visual baselines; axe." The gallery
   is the live sheet; the journey therefore exercises `/design` with no `?state=` query. The
   seven forced states remain designed (s-design §2) and proven by the gallery's own
   acceptance from inc-007b — they are not J-004 checkpoints and get no baselines.
2. "Not changed" admits exactly one repaint, owned by the sibling amendment decision
   (`datum-primitives-placeholder-status-text-colour-…`): placeholder and status text move
   `--graphite-500` → `--graphite-600`. On this sheet that is visible in the input entry's
   invalid-state placeholder “Sheet name”, the select entry's placeholder “Choose an element
   class”, and the combobox entry's placeholder “Search layers” — one step darker in light,
   one step lighter in dark. Every other pixel matches s-design.md as already built.

## 1. Layout and hierarchy

s-design §1 verbatim, unchanged. The three module blocks of the main column — Primitives,
Patterns, Data, in barrel order, each a `section` headed by its `h2` from
`design.module.primitives` / `.patterns` / `.data` — are the units the journey frames: each
section's bounding box holds that module's every entry card and nothing of the chrome. The top
bar and rail are exercised by the keyboard step and swept by the full-page axe scans; they are
not separately screenshotted.

## 2. The journey's checkpoint order (fixed, so every assertion is deterministic)

1. **Open** — goto `/design`, wait for `design-gallery-root`. `document.documentElement` has
   no `data-theme` attribute; the sheet paints light (s-design §10).
2. **gallery-light** — screenshot each section (`['design', 'primitives-light.png']`,
   `['design', 'patterns-light.png']`, `['design', 'data-light.png']`), then one full-page axe
   scan. No overlay is open.
3. **Theme flip** — operate `design-theme-toggle` (the page object's `toggleTheme()`);
   `data-theme="dark"` lands on the document element. The flip is untransitioned (s-design §3),
   so no settle wait beyond the attribute.
4. **gallery-dark** — the three sections again (`['design', '<group>-dark.png']`), then the
   axe scan. No overlay is open.
5. **keyboard** — §5 below, starting in dark. No screenshot, no axe scan while any overlay
   is open.

## 3. Visual baselines (Q-06)

Six baselines at `tests/e2e/baselines/design/<group>-<theme>.png`, `<group>` ∈ {primitives,
patterns, data}, `<theme>` ∈ {light, dark} — snapshot names array-form only (a string with a
slash flattens to dashes). Compared at `maxDiffPixelRatio` 0.002; `updateSnapshots: 'none'`
stands.

- **No masks.** The sheet is deterministic by design (s-design §4: literal sample data, no
  clock, no network), and `toHaveScreenshot` disables CSS animations, so the skeleton pulse
  and the button busy bar are captured at rest.
- **Capture = lane render.** Baselines are produced by driving Playwright programmatically
  against the lane-built app with `FONTCONFIG_FILE=tests/e2e/setup/fonts.conf` and the
  chromium Desktop Chrome device, exactly as the lane replays them; a capture under the
  machine's own fonts never matches.
- A pixel drift from a committed baseline fails the lane. An intentional visual change reaches
  these files only through an approved baseline update with a recorded reason (Q-06) — this
  increment's amendment repaint is that recorded reason, and these six are its first commit.

## 4. Axe checkpoints (Q-11, R-UI-012)

At gallery-light and gallery-dark — the closed-overlay renders only — a scan built on
AxeBuilder, exported as `expectNoSeriousOrCriticalAxeViolations(page)` from
`tests/e2e/pages/design.ts`, finds zero violations of impact serious or critical. Every
finding it saw is printed, whatever its impact; lesser-impact findings (the DataTable selection
columnheader, owned by DONE inc-006) never fail the journey. Axe never runs while a menu,
select, popover or dialog surface is open — an open overlay trips unrelated rules. With the
amendment applied, the select placeholder's serious `color-contrast` finding is gone in both
themes; that is the remedy's end-to-end proof. `tests/e2e/axe.ts` (the harness's any-impact
helper) is not this journey's gate and is not edited.

## 5. Keyboard step (R-UI-012), gestures exact

Keyboard-only, starting in dark theme after checkpoint gallery-dark:

1. Tab until focus stands on `design-theme-toggle`. Assert the ring: computed `outline-width`
   2px, `outline-style` solid, `outline-color` equal to the document's resolved `--cobalt-500`
   for the active theme (resolved at run time from the token, never a literal in the test).
2. Space. The theme flips dark → light: assert `data-theme="light"` on the document element
   (the toggle writes both directions, s-design §3).
3. Reach the Select trigger inside the `gallery-entry-select-placeholder` cell by keyboard.
   Assert the ring as in step 1 (now the light `--cobalt-500`).
4. Enter or ArrowDown opens the listbox; poll for a visible overlay surface (a keyboard open
   is not synchronous).
5. Escape closes it. Poll until focus has returned to the trigger — Radix's focus return races
   the next gesture — then assert the ring is visible again.

The sheet ends light with no overlay open. No further screenshot compares against it.

## 6. Screen states (R-UI-050)

All seven remain exactly s-design §2 — surfaces, copy, testids `design-screen-state-<state>`
unchanged. J-004 does not visit them (Interpretation 1). The live sheet the journey grades is
the "everything worked" rendering; its own resilience states belong to the screen, not the
journey.

## 7. Copy

This increment adds no copy to the screen. Every string the journey encounters — “Datum”,
“Dark theme”, “Choose an element class”, module headings, entry titles — is s-design §7's
table, verbatim, unchanged. The journey asserts against testids and roles, never against copy,
so a future copy decision does not silently rewrite the test contract.

## 8. Motion (R-UI-004)

None added. The theme flip stays untransitioned (s-design §3). The screenshots capture
animations disabled; the keyboard step tolerates the primitives' contractual 160 ms overlay
arrivals by polling for visibility rather than asserting instants.

## 9. Tokens

None added, none changed on this screen. The one binding that moves (`--graphite-500` →
`--graphite-600` on three primitive texts) is the amendment decision's; `src/app/design/**`
and `src/ui/gallery/**` are untouched.

## 10. Both themes

The gesture is the contract: initial render carries no `data-theme` attribute and is light;
operating `design-theme-toggle` sets `data-theme="dark"` or `"light"` on
`document.documentElement`; the toggle is the attribute's only writer. Each theme gets the
same three section baselines and the same axe scan — the flip is total or the dark baselines
catch what it strands.

## 11. Test hooks (C-05)

Routes: `/design` only. Test ids: reused, none introduced — `design-gallery-root`,
`design-theme-toggle`, `gallery-entry-select-placeholder` (all from s-design §11).

- Journey: `tests/e2e/j-004-design.spec.ts`, titles grep-match `J-004`.
- Page object `tests/e2e/pages/design.ts` exports `DesignGalleryPage` — constructor takes the
  Playwright `Page` (field assigned in the constructor body; a TS parameter property breaks
  loading the file outside vitest), `open()`, `toggleTheme()`,
  `group(name: 'primitives' | 'patterns' | 'data')` returning the §1 section locator — and
  `expectNoSeriousOrCriticalAxeViolations(page)` (§4).
- Baselines: the six §3 files under `tests/e2e/baselines/design/`.
- Lane: `pnpm e2e --journey J-004`; exit code is the verdict; final line of the merged
  stdout+stderr stream is `e2e: ok (<seconds>s)` on success, `e2e: FAIL` on failure.
- Env: `J004_E2E=1` arms the public wrapper's lane arm (`tests/j-004-design.test.ts`); unset,
  the lane arm reports a named skip while the static arm still judges.

No other hook, route or id enters the contract through this decision.
