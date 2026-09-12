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

**DERIVED FROM GEOMETRY, NOT FROM A CAPTURE.** The other eight criteria "can only be read from a
rendered DOM after `settled()`" (mechanical.test.ts's own words). No browser ran in this session: the
journey port (3211) is one port shared by every worktree, and it was held by another node throughout.
Where a screen's writer could compute a criterion from the grid, the tokens and the DOM the screen
declares — a table's first row from the bands above it, a region's share from the tracks it sits in —
the number is stated and is marked below wherever it rests on arithmetic rather than on a picture.
Where nothing could be computed, the cell is `—` and NO WEIGHTED TOTAL IS CLAIMED.

Two consequences, stated plainly rather than buried:
1. **Viewer and Drawings carry no score.** The viewer's C1/C2 are real (they are proved as arithmetic
   over the shell's own grid, below) but nine of its twelve are unread.
2. **Every scored number above is provisional until the picture run replaces it.** C9 in particular
   is a 4 everywhere and is unearned: **axe has not been run on any screen this session.** It is
   written as 4 rather than 5 for that reason, and it may only go down.

| Screen | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | Score | Before (§8) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Viewer | 5 | 5 | — | — | — | — | — | 5 | — | — | — | — | *pending capture* | 2.7 |
| Register | 4 | 5 | 4 | 4 | 4 | **3** | 4 | 5 | 4 | 4 | 4 | 4 | **4.0** | 1.5 |
| Coverage | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | 4 | **4.3** | 2.3 |
| Home | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **4.3** | 2.9 |
| Project | 4 | 4 | 4 | 4 | 4 | 5 | 5 | 5 | 4 | 5 | 4 | 4 | **4.3** | 2.9 |
| Drawings | — | — | — | — | — | — | 5 | 5 | — | — | — | — | *pending capture* | 1.8 |
| Members | 4 | 5 | **3** | 4 | 4 | 5 | 4 | 5 | 4 | 4 | 4 | 4 | **4.2** | 2.1 |
| Auth | **1** | 5 | 5 | 5 | 4 | 4 | 5 | 5 | 4 | 5 | 4 | **3** | **4.0** | 3.6 |
| Settings — rule set | **3** | **3** | **3** | 4 | 5 | **3** | 5 | 5 | 4 | 4 | 4 | 4 | **3.8** ⚠ | 2.5 |

⚠ **One screen is under the 4.0 bar and it is not rounded up.**

### S-Settings-Ruleset — 3.8, and the four criteria that cost it

- **C2 = 3.** §3.6's own stacking (pin line → lineage → parameters) puts the parameter table's first
  row ≈ 316 px below the top of main; the anchor for 4 is ≤ 240. Only re-ordering — parameters before
  lineage — reaches it, and §3.6 fixes the order. **This is a Direction question, not a build defect.**
- **C1 = 3.** At 1280×800 the parameter grid is ≈ 47 % of `shell-main` (≈ 53 % at 1440×900). §7 takes
  the minimum across viewports, so the smaller one is the score.
- **C6 = 3.** `IS1200_IN` is SCREAMING-snake body text in the identity line. L-MEA-01 and the
  acceptance require the edition verbatim and visible, and **the product has no human label for an
  edition**. The remedy is a name, not a chip.
- **C3 = 3.** The breadcrumb does not name the page. Shared with Members, and §7 is explicit that "a
  repeated cross-screen finding (breadcrumb, dead inspector, native select) is owned by the
  foundation node, not recorded forever" — so it belongs to `routes.ts`, not to these two screens.

### S-Register — 4.0, and the one SCREAMING word that caps EVERY grid screen

C6 = 3, and it is a foundation debt rather than this screen's. Every identifier the criterion names is
gone: uuids into `IdChip`, object and source keys under `[data-technical]`, `MEASURED`/`NONE`/coverage
/engine/role/standing/discipline through `EnumLabel`. What is left is **`BasisChip`'s own copy** — the
shipped primitive renders `{basis}` as a bare text node, once per row. Re-wording it at the call site
is exactly the B-17 defect it exists to prevent, so the register cannot fix it and did not try.

**Until `BasisChip` reads like `EnumLabel` — words on the face, the raw value under `data-technical` —
no grid screen in the product can score C6 above 3.** That is S-Takeoff, S-Coverage and, in M3,
S-BOQ, S-BBS, S-Levels and S-Schedules. It is the single highest-leverage craft fix left, and it is
one primitive.

### S-Auth — 4.0, clearing the bar only because C1 cannot be won

§3.7 fixes the card at 360 wide. §7 C1 wants a focused screen's primary at ≥ 40 % of the viewport. A
360 × 365 card is **10.1 %** at 1440×900 and 12.8 % at 1280×800; reaching 40 % needs roughly 760×760.
The pre-v22 560 column scored ~20 % — a 2 — so **the anchor is unreachable for any centred auth card**,
not merely for this one. §3 outranks the screen Decision, so the template was obeyed and C1 took a 1.
**This needs a ruling:** either C1's focused-screen denominator becomes the content column rather than
the viewport, or the anchor drops for the Auth template. C12 = 3 is honest too: the seven states are
enumerated in `src/ui/screen-states/matrix.tsx`, but no `?__state=` instrument exists in the tree yet.

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
