# The Vextrus design system

> **Accepted by the owner, 26 Sep 2026** ("accept"), after judging the specimen, the Takeoff frame
> and the Project Summary in the browser. The five key screens are prototyped on it next.
> Owner's rulings since: quantities group in lakh like money (ADR 0008), only coordinates and
> dimensions never group. "Canvas ≥ 70 %" is measured by width with the inspector open (≥ 90 %
> with it collapsed).

Draft of 26 Sep 2026, for the owner's judgement in the browser. The tokens are one CSS file,
`.private/work/session-01/design/src/tokens.css` (to be copied into the product's `src/ui/`). The
living specimen, a static app frame at 1440 × 900 and the Project Summary run from the same folder
(see "The specimen" at the end). Every figure in them is invented; nothing comes from a real Drawing
Set.

Inputs: docs/research/design-legacy.md (what we keep from Cubit), ADRs 0002, 0008, 0010, 0016,
0022, 0027, 0028 and 0032, docs/research/stack-frontend.md §7–8, and the post-mortem's visible
defects.

## What is not yet proven

- **No Dhaka QS or MD has seen any of it.** Density, the palette and the status grammar are my
  reading of the brief, not a user's.
- **The canvas share is 74% of the width at 1440 and 71% at 1280 (measured in the browser), but
  66.5% of the area,** because the inspector is docked. "Canvas ≥ 70%" holds by width only.
- **The 2D sheet and the 3D model in the mock are hand-drawn SVG,** not dxf-viewer, pdf.js or
  Three.js. The tokens they read are real; the rendering is not.
- **The CAD-dark overlay colours can collide with AutoCAD layer colours** (our Proposal cyan is
  close to ACI 4). The mitigation (a dark casing under every overlay stroke, and line type carrying
  the meaning) is designed but not tested on a real consultant's sheet.
- **Reduced motion** is in the tokens and the CSS but was not emulated in the walk.
- **The ৳ face at small sizes** was checked by eye at 13–32 px in Chrome on Linux only, not on
  Windows ClearType, where the owner and the QS will see it.

## 1. Principles

1. **Paper is content, graphite is chrome.** The sheet, the grid body, tiles and popovers are the
   only pure white; the bars, rail and inspector are a cool grey that steps back. Why: it is how a
   plotted sheet sits on a drafting table, and it gives surfaces a hierarchy the old product lacked
   (every border was the same hairline).
2. **Line type carries status; colour repeats it.** Dashed is a Proposal, solid is Confirmed, a
   revision cloud is a Question, hatch is an allowance. Why: drafting already means this to a QS, it
   survives greyscale printing and colour-blindness, and it works the same on the sheet, in the grid
   and in 3D.
3. **Indigo means you can act, or what you have selected. Copper appears at most once a screen,**
   on the bulk Confirm. Why: one accent keeps the page quiet; the scarce copper makes the one commit
   findable.
4. **Every figure has a kind** (money, quantity, length, section size, level, coordinate, count), and
   each kind has one formatter. Only money groups in lakh and crore. Why: the post-mortem's lakh
   grouping on coordinates came from one global number formatter.
5. **The drawing leads.** Compact chrome, 28 px rows, no explainer banners. Why: the QS works a
   Takeoff all day; Revit and AutoCAD users expect the view to dominate.

## 2. Colour

Light chrome (ADR 0032). All text pairs below were computed with the WCAG 2 formula; the specimen
recomputes them live from the CSS variables, and Lighthouse's contrast audit passes on all three
pages (Lighthouse accessibility 100 on the specimen and the frame at 1440, and on the Project
Summary at 390, after fixes).

### Neutrals, accent, commit

| Token | Value | Role | Contrast |
|---|---|---|---|
| `--graphite-0…1000` | #F4F5F4 … #101318 (14 steps) | Kept from Cubit unchanged | — |
| `--paper` | #FFFFFF | Sheet, grid body, tiles, popovers | — |
| `--background` | graphite-100 #E9EBEA | The table the paper lies on | — |
| `--chrome` | graphite-0 #F4F5F4 | Top bar, rail, toolbar, inspector, status bar | — |
| `--band` | graphite-50 #EFF0EF | Grid header, trade rows, totals | — |
| `--hover` / `--pressed` | graphite-150 / 200 | Hover and press surfaces | — |
| `--foreground` | graphite-900 #262B33 | Text | 14.2:1 paper, 13.0:1 chrome |
| `--ink-secondary` | graphite-700 #4A515B | Secondary text | 7.3:1 chrome |
| `--muted-foreground` | graphite-600 #5F6772 | Captions, units | 5.7:1 paper, 4.8:1 background, 4.8:1 selected row |
| `--ink-disabled` | graphite-500 #7F868D | Disabled text | 3.7:1 (disabled is exempt) |
| `--border` | graphite-200 | Hairline seams between docked surfaces | decorative |
| `--border-strong` | graphite-300 | Grid rules, tile edges | decorative |
| `--input` | graphite-500 #7F868D | Control edges | 3.7:1, meets WCAG 1.4.11 |
| `--primary` | indigo-500 #5A4FB0 | Primary button, focus ring, selection | white on it 6.6:1; on paper 6.6:1 |
| `--primary-hover`, `--ink-link` | indigo-600 #473E92 | Hover, links | 7.4:1 on background |
| `--selected` | indigo-100 #ECEAFA | Selected row, current step | ink on it 12.0:1 |
| `--commit` | copper-500 #A85B28 | The bulk Confirm, once a screen | white on it 5.0:1 |

shadcn's slot names are kept (`--background`, `--foreground`, `--primary`, `--accent`, `--ring`,
`--border`, `--input`, `--popover`, `--card`, `--muted`, `--destructive`, `--chart-1…5`), so its
copied components work unchanged. Note that shadcn's `--accent` is a quiet hover surface, not our
brand colour; our brand colour is `--primary`.

### Status, in CONTEXT.md's words

Each status has a glyph and a word; colour never carries it alone.

| Status | Text token | Glyph (UI) | On the sheet | In the grid | In 3D | Text contrast (paper / tint / background) |
|---|---|---|---|---|---|---|
| **Proposal** | `--status-proposal` #0A6C80 | dashed square | dashed cyan outline #0891B2 (3.7:1) | dashed mark + "Proposal" | cyan #5AB8CC at 45%, dashed edges | 6.05 / 5.28 / 5.05 |
| **Confirmed** | `--status-confirmed` #18703F | solid square with a tick | solid green outline #2E9A5C | solid mark + "Confirmed" | concrete grey #C9CCC8, solid dark edges | 6.13 / 5.45 / 5.12 |
| **Question** | `--status-question` #8A5100 | revision cloud with "?" | amber revision cloud #B86E00 (4.0:1) + tag "Q7" | cloud + "Q7" + word | amber #E7A33A, one pulse on arrival | 6.45 / 5.82 / 5.38 |
| **Over Target Cost** | `--status-over-target` #B32525 | filled triangle | — | triangle + "Over Target Cost by ৳…" | — | 6.55 / 5.63 / 5.47 |
| **Excluded** (Coverage) | `--status-excluded` graphite-600 | circle with a slash | greyed, struck through | muted + the reason in words | hidden | 5.72 |

Why Confirmed is concrete grey in 3D, not green: when the Takeoff is done the whole building would be
green. Confirmed elements should read as the building itself; what still needs the QS stands out.
The green and red were darkened from Cubit's (#1D7A46, #C22A2A) because Lighthouse measured
Cubit's green at 4.46:1 on the grey background, below AA.

Amber is the "needs a look" family: Questions, and a consumption figure outside its sanity range on
the Project Summary ("Above range", flagged, never blocked, ADR 0016).

### Cost Basis and Rebar Basis

No hue of their own; they would outshout the quantities (Cubit's basis chips did, walk P15).

| Basis | Glyph | Words, always shown |
|---|---|---|
| Cost Basis: measured | solid square | "measured" |
| Cost Basis: allowance | hatched square; hatched bar in charts | "allowance" |
| Rebar Basis: by ratio | dashed bar cross-section | "by ratio" |
| Rebar Basis: from the drawing | solid bar cross-section | "from the drawing" |
| Rebar Basis: from the drawing + rules | solid cross-section with a ring | "from the drawing + rules" |

The measured share of the Estimate is one proportion bar: indigo for measured, hatch for allowance.

### Selection: one language across grid, sheet and 3D

Indigo everywhere. Grid: `--selected` row tint plus a 2 px indigo bar on the row's left edge. Sheet:
a 2 px indigo outline that holds its width at every zoom (non-scaling stroke) over a 7 px soft halo
(`--selection-halo`). 3D: indigo tint with indigo edges. Selecting in any one selects in all three.
Hover: the halo alone (`--hover-halo`, 16% indigo), never the outline.

### The 2D sheet (ADR 0032)

- **Paper (default):** white ground, every layer plots black (`--layer-*` all resolve to
  `--canvas-ink` #000), lineweights from the drawing drawn as non-scaling strokes. Overlays sit on a
  white casing (`--overlay-casing`) so they lift off black linework.
- **CAD-dark (one switch, key D):** ground #101318, AutoCAD's layer colours back (ACI 1–7 tokens,
  plus a lifted red for 4.5:1), overlays brighter (Proposal #3FC7E0 9.3:1, Confirmed #4CC38A 8.4:1,
  Question #F2A93B 9.3:1, selection #9D95F0 7.1:1) on a dark casing. ACI hues can match ours; line
  type carries the meaning.
- **Opening a sheet:** fit to the view being worked on, not the paper, and leave room for floating
  bars (the fit area excludes the legend strip and the Confirmation bar). A sheet never opens as a
  speck. Text under 6 px at the current zoom draws as a grey bar (`--canvas-dim-greek`).
- **Drawing text** is decoded before anyone sees it (`%%C` → Ø, `%%D` → °, `%%P` → ±) and set in
  Archivo at 87.5% width, like CAD lettering.
- **Legend strip** top-left of every canvas: each status with its glyph and count.
- **Scale bar** with the confirmed drawing scale ("1:50"), never a zoom factor.

### The 3D Building Model (ADR 0032)

Light ground (gradient #F7F8F8 → #DFE3E5), "shaded with edges" (edges #262B33), coloured by
status as in the table above; context not yet taken off in pale grey #E4E7E6.

### Charts

One hue family per chart (`--chart-1` indigo, `--chart-2` light indigo, graphite, copper last),
hatch for allowance, and every plotted figure also printed as a number.

## 3. Type

- **One family: Archivo** (Omnibus-Type, SIL OFL 1.1, `@fontsource-variable/archivo`, weights
  100–900, width 62–125%). Why: a grotesque built for dense text, with tabular figures (`tnum`),
  real fractions (`frac`), the primes ′ ″, Ø, ×, superscripts and a true minus, all checked in its
  cmap and GSUB table with fontTools. Its width axis gives a narrow cut (87.5%) for grid headers and
  sheet text without a second family. Not Inter, IBM Plex or Spline Sans: Inter and Plex are the
  defaults every product ships; Spline Sans needed a word-spacing hack at 12–13 px (legacy §2).
- **৳ (U+09F3).** Checked with fontTools on every candidate's font files on 26 Sep 2026:
  - no ৳: Archivo, Inter, IBM Plex Sans, Public Sans, Mona Sans, Instrument Sans, Noto Sans,
    Schibsted Grotesk, Atkinson Hyperlegible Next, Roboto Flex, IBM Plex Mono, JetBrains Mono;
  - has ৳ (in their bengali subsets): Noto Sans Bengali, Anek Bangla, Hind Siliguri.

  **Fallback:** "Vextrus Taka", a 1.7 KB WOFF2 holding only U+09F3, subset with `pyftsubset` from
  Noto Sans Bengali (OFL 1.1), variable in weight so ৳ follows the surrounding weight, loaded through
  `unicode-range: U+09F3` behind Archivo in the stack. The browser confirmed it loaded
  (`document.fonts`: "Vextrus Taka U+9F3"). Why Noto rather than Anek Bangla: WeasyPrint embeds a
  Bengali font for the PDF (ADR 0022), and one ৳ design on screen and on paper is better; Anek's ৳
  looked slightly heavier beside Archivo, a close call.
- **Figures** use Archivo with `tabular-nums lining-nums` (the `.num` class). **No mono face
  anywhere**, not even for codes or coordinates: Cubit's mono spread to words.
- **Known weakness:** Archivo's capital I and lower-case l are close ("Ill"). Marks are upper case
  and figures, so it rarely matters; watch it in the walk.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-3xl` | 32 / 36 | 600 | The MD's hero figure, once |
| `text-2xl` | 24 / 30 | 600 | Tile figures |
| `text-xl` | 20 / 26 | 600 | Page title, once a screen |
| `text-lg` | 16 / 22 | 500 | Dialog titles |
| `text-md` | 14 / 20 | 600 | Section titles |
| `text-sm` | 13 / 18 | 400 | Body, grid cells, controls |
| `text-xs` | 12 / 16 | 400–600 | Captions, grid headers (narrow), legends |
| `text-2xs` | 11 / 16 | 400 | Status bar only |

Sentence case everywhere; no capitals for labels and no letter-spaced eyebrows. Drawing text keeps
the drawing's own case.

## 4. Density, grid, spacing, radii, elevation, motion

Compact is the default (a comfortable 36 px row is a per-user switch later).

| Token | Value | Note |
|---|---|---|
| `--row` | 28 px | Grid rows; no wrapping, ellipsis with a tooltip |
| `--control` | 28 px (`--control-lg` 32) | Buttons, inputs, tools |
| `--topbar` | 40 px | Brand, project, text navigation, search, user |
| `--toolbar` | 32 px | The canvas's own bar: step, count, sheet, view switch, tools |
| `--statusbar` | 24 px | Canvas screens only: cursor in ft-in, scale, units, snap, Coverage |
| `--rail` | 48 px | The Takeoff step rail, collapsed |
| `--rail-expanded` | 288 px | Overlays the canvas with a shadow; never reflows it |
| `--inspector` | 320 px (280–480) | Docked and always present on canvas screens, so selecting never moves the drawing |
| `--confirm-bar` | 44 px | Floating at the canvas foot |
| `--tile-min` | 72 px | Project Summary tiles |
| Spacing | 4 px step | Tailwind's own; 8 px cell padding, 12–16 between groups, 24 between sections |
| Icons | 14 / 16 / 20 px, 1.5 stroke | Inline / bars / rail |

Canvas at 1440 × 900: 1440 − 48 − 320 = 1072 × 804 px (measured). At 1280 × 800: 912 × 704. The
toolbar stays on one line at 1280 (measured by eye; Cubit's wrapped, F16).

**Radii:** `--radius-chip` 2 px (marks, grid focus), `--radius` 4 px (controls; shadcn's
`--radius`), `--radius-panel` 8 px (popovers, dialogs, tiles). No 12 px.

**Elevation:** docked surfaces are flat with hairline seams; only overlays cast a shadow.
`--elev-1` 0 1 2 (6%), `--elev-2` 0 2 8 (12%) for popovers, `--elev-3` 0 8 24 (16%) for the
Confirmation bar, the open rail and dialogs, `--elev-4` 0 16 48 (22%). z-layers: base 0, canvas
overlay 50, sticky 100, overlay 200, toast 300.

**Motion:** it only tells you where something went. `--motion-state` 160 ms (hover, press),
`--motion-panel` 240 ms (rail, popover), `--motion-flyto` 320 ms (Trace fly-to on the sheet),
`--motion-camera` 480 ms (3D camera to a selection or storey), `--motion-section` 240 ms (section
box, storey isolate), `--motion-confirm` 200 ms (dashed → solid), `--motion-pulse` 900 ms, played
once on arrival, never looping. Easing `--ease` cubic-bezier(0.2, 0, 0, 1); fly-to
cubic-bezier(0.45, 0.05, 0.25, 1). **Reduced motion:** every duration becomes 0 ms, the pulse never
plays, skeletons stop shimmering, the camera cuts.

## 5. Iconography

- **Lucide, ISC licence** (lucide-react), shadcn's default set: select, pan, fit, measure, layers,
  sheet, 3D box, search, check, undo, Excel, download, share, contrast (the CAD-dark switch). Every
  icon-only button has an accessible name and a tooltip with its shortcut (V, W, H, F, M, L, D).
- **Our domain glyphs**, drawn on Lucide's 24-unit grid with the same 1.5 stroke
  (`src/ui/glyphs.tsx`): the 14 Takeoff Step families (sheets, notes, level datum, grid bubbles,
  foundation, column, beam, slab, stair, tank, wall, room, roof, site); the status marks (Proposal,
  Confirmed, Question cloud, Over Target, Excluded); Cost Basis (measured, allowance); Rebar Basis
  (by ratio, from the drawing, from the drawing + rules); the Trace leader. The brand mark keeps
  Cubit's "Ascent", with the copper spark only at 32 px and larger.

## 6. Numbers and units

One formatter per kind (`src/lib/format.ts`); a coordinate is a different type from money, so it
cannot be passed to the money formatter. The product will run the same rules in Python against one
shared table of expected strings (stack-frontend.md §7).

| Kind | Shown as | Rule |
|---|---|---|
| Money, exact | ৳1,47,07,525.50 | `Intl.NumberFormat("en-IN", {style: "currency", currency: "BDT", currencyDisplay: "narrowSymbol"})`, two decimals. Never `en-BD` (Western grouping). |
| Money in a grid column | 1,47,07,525.50 | The ৳ lives in the header, "Amount (৳)", "Rate (৳)"; cells carry no symbol, so figures align. |
| Money, the MD's tiles | ৳18.43 Cr, ৳42.65 L | Two decimals in Cr (10⁷) or L (10⁵); the exact figure on hover or tap and in the accessible name. Never Intl's compact notation (it rounds ৳12,50,000 to "13L"). |
| Money per sft | ৳3,788 | Whole taka. |
| Money, a change | +৳42,65,400.00, −৳1,20,500.00 | Explicit + and a true minus (U+2212). |
| Quantity | 1,24,842.50 cft | Two decimals, as the Rule Set rounds (ADR 0008); lakh grouping like money (the owner's ruling). |
| Count units | 2,45,600 nos; 1,860 bags; 48,620 kg | nos, bags and kg: whole numbers (the Rule Set rounds them to 0 dp); rebar never to the gram. |
| Weight | 48.620 ton | Three decimals (ADR 0008). |
| Metric (one switch) | 108.81 m³, 4,519.80 m² | Real superscripts, never m3. |
| Length, imperial | 10′-4½″ | Feet and inches to 1/8″, inches always shown (12′-0″), primes on screen, the fraction set with the `frac` feature; plain 10'-4 1/2" in titles, the accessible name and Excel. |
| Section size | 15″ × 24″ | Inches only, as Dhaka drawings write sizes. |
| Level | +56′-6″, −3.200 m | Always signed; metric levels in m to 3 dp. |
| Metric length | 3050 mm | Integer mm, no grouping. |
| Coordinate | 42′-7½″, 152.400 m | Its own kind; no grouping ever. |
| Count, n / N | 86 / 89 columns placed; 1,184 / 1,412 | N from the drawing (ADR 0027); unknown N shows "—", never a guess; never a percentage alone. |
| Share | 62% | Whole percent, always beside what it is a share of. |
| Empty figure | — | An em dash, never 0.000. |
| Date | 22 Sep 2026 | Day, short month, year. |

Billing Units: cft, sft, rft, nos, bags, kg, ton; metric m³, m², m. The unit is a muted suffix beside
its figure, or its own column in the grid. Levels come once from Takeoff Step 3, sorted by
elevation, and every screen uses that one name ("Ground floor", "Level 4"), never a raw layer code.

## 7. Core states

| State | Treatment |
|---|---|
| **Focus** | A 2 px indigo ring (`--ring`, 6.6:1) 2 px outside every control; never removed, never a glow. **In a grid cell the ring is drawn inside the cell (outline-offset −2 px),** so no cell can clip it (Cubit's F21). |
| **Hover** | `--hover` surface on controls and rows; an indigo halo without outline on the sheet and in 3D. |
| **Selected** | Indigo: row tint + 2 px left bar; sheet outline + halo; 3D tint + edges. Shared across all three. |
| **Pressed** | `--pressed` surface, or indigo-700 on a primary button. |
| **Disabled** | Muted surface, `--ink-disabled` text, not-allowed cursor; still legible (3.7:1). |
| **Loading** | Skeleton bars (shimmer stops under reduced motion) plus a line of what is happening ("Reading S-104, sheet 12 of 38"); a spinner only inside a button that is saving. No spinner over a data table. |
| **Empty** | A glyph, one sentence saying why, one action ("No beams yet. Beams are read after columns are confirmed." [Read beams]). |
| **Error** | What went wrong and how to fix it, in the product's voice; a red inset bar, never a red wall. Inputs: red edge + a line under the field ("Enter a rate per cft, like 685.00"). |

## 8. Components

Built in the specimen as React + Tailwind v4 on the tokens; the product copies shadcn primitives
(Button, Tabs, Popover, Tooltip, Command, Sheet) and styles them with the same tokens.

- **App frame:** 40 px top bar (brand, project switcher, text navigation: Takeoff, Priced BOQ,
  Material Schedule, Project Summary, Drawing Set; Revision; search Ctrl K; user), 48 px step rail,
  32 px canvas toolbar, canvas, docked 320 px inspector, 24 px status bar on canvas screens only.
  The QS screens are desktop-only (≥ 1280 px) and say so plainly on a phone (ADR 0016).
- **Takeoff step rail:** the 14 Takeoff Steps in building-first order, numbered because they are a
  sequence. Collapsed: element glyphs with a state mark (Question wins, then all confirmed, then
  Proposals ready, none = not started). Open (288 px): number, name, n / N; overlays the canvas.
- **Bulk Confirmation bar:** floats at the canvas foot when a group or a selection is ready. Names
  what ("14 C2 columns selected on this plan") and why ("All 14 agree with the Column schedule and
  sit on grid points"), then "Review one by one" and the screen's one copper button, "Confirm 14 ↵".
  Enter confirms, Esc clears.
- **Question card:** amber header with the cloud glyph, "Question Q7" and what it unblocks; the
  question in plain words with figures in their kinds; its Trace; plain answers as radio rows
  (never a free-text box first); "Answer" and "Ask later". Lives in the inspector's Questions tab;
  its cloud and tag sit on the sheet where the conflict is.
- **BOQ grid row and cell:** 28 px rows; Item, Description (ellipsis + tooltip), Qty, Unit, Rate (৳),
  Amount (৳), Cost Basis, Rebar Basis, Status; figures right-aligned and tabular; trade rows banded
  with their Cost Basis in words; a sticky total that names its Revision; allowance trades carry the
  word and the hatch. Keys: arrows move, Enter opens the Trace, Space selects, Shift extends.
- **Inspector:** tabs Selection | Questions (count). Selection: title and status, sizes by Storey
  Band, Checks as n / N with a tick, quantities in their Billing Units with the Rebar Basis, the Trace
  as links, then secondary actions (Edit size, Exclude).
- **Trace popover:** anchored to the figure, never covering it; the figure at the top; numbered
  sources (sheet, place, the Measurement Rule named, or the Question that supplied it); Enter opens
  the sheet at the place, Esc closes.
- **Project Summary tiles:** Estimate (compact ৳, measured-share bar), per sft of Gross Floor Area,
  per sft of Saleable Area, Target Cost with "Over Target Cost by ৳42,65,400.00" and a triangle.
  Below: cost by trade in work order (hatch for allowance), the Building Model (static sketch in the
  mock), Takeoff counts, and consumption per sft of Gross Floor Area against sanity ranges. Works
  from 390 px (two-column tiles, stacked panels).
- **Also used:** segmented control (Sheet | 3D, Paper | CAD-dark), icon tool buttons with pressed
  state, legend strip, scale bar, Kbd.

## 9. How the post-mortem's visible defects become impossible

| Defect | What prevents it |
|---|---|
| One level spelled two ways | Level names come once from Takeoff Step 3; every view reads that list. |
| An unordered level tree | Levels sort by elevation, never by name. |
| Lakh grouping on coordinates | Coordinates are their own type; only the money formatter groups in lakh. |
| A sheet that opens looking empty | Fit to the working view, room left for bars, small text drawn as bars. |
| Raw CAD codes such as `%%C` | Drawing text is decoded before display. |
| Invisible keyboard focus in grid cells | The cell focus ring is inset; Lighthouse and the walk check it. |
| Meaning by colour alone | Every status and basis has a glyph or pattern and a word. |

## 10. Open questions for the owner

1. **Quantities: thousands grouping (my recommendation) or lakh grouping?** ADR 0008 keeps lakh for
   money only; a Dhaka QS may expect 1,28,450 sft in Excel. Mixing two groupings in one row could
   confuse; one ruling settles it.
2. **Is "canvas ≥ 70%" by width (met) or by area (66.5%)?** Meeting it by area needs a floating
   inspector, which Cubit's walk showed moves things under the pointer.
3. **Count units to 0 decimals** (nos, bags, kg) needs the default Rule Set to round them so;
   otherwise the shown quantity × rate stops equalling the amount.

## The specimen

Throwaway, under `.private/work/session-01/design/` (never committed): Vite 8 + React 19 +
TypeScript + Tailwind v4 (`@tailwindcss/vite`) + lucide-react + Archivo.

- Specimen: http://127.0.0.1:5230/ ; app frame at 1440 × 900: http://127.0.0.1:5230/#/frame ;
  Project Summary: http://127.0.0.1:5230/#/summary
- Restart: `cd /home/riz/vextrus-cubit/.private/work/session-01/design && npx vite` (port 5230,
  127.0.0.1, strict).
- Screenshots at 1440 × 900, 1280 × 800 and 390 × 844 in `screens/`.
