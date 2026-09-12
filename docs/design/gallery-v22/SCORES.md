# v22 craft rubric — the scores

Direction 00 §7. Twelve criteria, 0–5 each, Σw = 12, weighted score to one decimal. The bar is
**≥ 4.0 per screen and no criterion below 3**. Both viewports (1440×900, 1280×800) and both themes
are measured, and a screen's score is the **minimum** of them. **Nothing here is rounded up.**

## How each number below was obtained — and what is not yet a number

The rubric splits cleanly in two, and only one half could be measured in this session.

**Measured (source-mechanical).** Four criteria are read from the stylesheets and grids a screen is
drawn by, not from a picture: **C8** (tokens-only colour, the 4-pt grid, the type scale) and the half
of **C4**/**C5** a stylesheet states outright, by `tests/ui/craft/mechanical.test.ts`; and **C1**/**C2**
for the viewer, by `tests/ui/shell/work-surface-share.test.ts`, which computes the canvas share and
the fold from `.cx-shell`'s own `grid-template-columns` and `.cx-shell-body`'s own
`grid-template-rows` resolved through the root tokens they name. A picture can only tell you the law
broke after someone drew it; these name the declaration that broke it.

**NOT MEASURED — and therefore NOT SCORED.** Eight criteria "can only be read from a rendered DOM
after `settled()`" (mechanical.test.ts's own words): C3, C6, C7, C9, C10, C11, C12, and the DOM half
of C4/C5. Reading them is the picture run's job, and the picture run is the re-baseline lease's, and
**the lease is written and unexercised** (see `README.md`): both heavy slots were held by other nodes
for the whole of 2026-09-12's session, so no journey walked and no still was taken.

A score with eight of twelve criteria guessed is not a score, it is a number that would be quoted
later as if it had been measured. So this table carries `—` where nothing was measured, and no
weighted total is stated for any screen. **No screen in this file has been shown to clear the 4.0
bar.** The run that fills the dashes is the one named in `README.md`.

| Screen | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | Score | Before (§8) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Viewer | 5 | 5 | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 2.7 |
| Drawings | — | — | — | — | — | — | 5 | 5 | — | — | — | — | **not scored** | 1.8 |
| Register | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 1.5 |
| Coverage | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 2.3 |
| Home / Project | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 2.9 |
| Members | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 2.1 |
| Auth | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 3.6 |
| Settings — rule set | — | — | — | — | — | — | — | 5 | — | — | — | — | **not scored** | 2.5 |

### What the measured cells rest on

- **Viewer C1 = 5.** §1 fixes the canvas at ≥ 70 % of the viewport. With the inspector out of the
  work area and absent at width 0 until something is selected, the canvas at 1440×900 is
  1440 − 48 (rail) − 200 (layers drawer) − 0 (inspector) = 1192 wide × 900 − 40 − 32 − 24 = 804 tall
  = **74.0 %**; at 1280×800, 1032 × 704 = **71.0 %**. Both are `≥ target`, which is the 5 anchor.
  Before this node's commit the inspector was a third resizable panel *inside* the work area and
  stood whether or not anything was selected — §8 scored C1 = 1.
- **Viewer C2 = 5.** The canvas begins where the 32 px tool row ends: 0 px into `shell-main`, 72 into
  the page. The 5 anchor is ≤ 120.
- **Drawings C7 = 5.** §7 C7 counts `p`/`.cx-*-lede` in main outside EmptyState/RefusalState/popover;
  5 is ≤ 1. The screen carried five helper sentences (§8 scored it 0) and now carries none.
- **C8 = 5 everywhere.** `tests/ui/craft/mechanical.test.ts` reports zero findings per screen sheet:
  no screen spells a colour and no screen spells a primitive ramp position. This was already true at
  the v22 baseline (§8: "Tokens (C8) are 5 everywhere; composition is where every point is lost") and
  U2 did not spend it.

### The three lowest criteria per screen — the next fixes

Not derivable without the eight unmeasured criteria. §8's own top-3 lists stand as the working order
until the picture run replaces them.
