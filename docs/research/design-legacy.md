# Design legacy: what the new design system keeps from Vextrus Cubit, and what it drops

Question: what in the old product's design work should the new Vextrus design system start from,
and what should it drop?

Researched 2026-09-26. The sources are the old design tree on branch `dev-lane-and-jev`, read with
`git show` (never checked out): `docs/design/` (44 Markdown files, 28,851 lines, and 36 gallery
PNGs), `src/ui/tokens.ts`, `src/ui/tokens.css`, `src/ui/theme/globals.css`, the Bible's
`<frontend>` section, and the session 9 critical review. I also read the session 8 walk of the
running product (`.private/work/session-8/walk0/`, which stays local) and looked at 16 screenshots:
6 gallery stills and 10 walk captures. The walk captures show our own synthetic set (`rcc6-bnbc`),
not a client's drawings, and this file describes only the UI in them. In the citations below, `B:`
means `dev-lane-and-jev:`, and `P:` means `/home/riz/vextrus-cubit/.private/work/`, which is never
committed.

## Conclusions

1. **Start from the tokens and the frame geometry; drop almost everything else.** The owner's
   reading is correct. The old audit said "composition fails, tokens hold, craft ≈ 2.5/5"
   (B:docs/design/00-direction.md:3–4), and every screen scored 5 on the tokens criterion while
   the screens averaged 2.4 (§8, 00-direction.md:554). The parts worth carrying:
   - the graphite neutral scale;
   - the one indigo accent and the copper kept scarce;
   - the semantic alias layer;
   - the compact density numbers (28 px rows, 28 px controls, 40 px top bar, 32 px toolbar, 24 px
     status bar, 48 px rail, 320 px inspector);
   - the motion values;
   - the "view-dominant" frame rules (canvas at least 70 % of the viewport, the first grid row
     within 240 px of the top).
2. **Re-express the tokens in Tailwind v4 and shadcn terms. Drop the machinery around them:**
   - the TS generator and its drift test;
   - the primitive-token lint;
   - the 12-criterion rubric;
   - the 7 R-UI-050 states contract.
   These are the "process became the product" cause (docs/postmortem.md, cause 3). The rubric
   scored screens 4.2–4.8 (B:docs/design/gallery-v22/SCORES.md) that a walk 11 days later found
   unusable: 99 defects, 22 of which blocked the demo (P:session-8/walk0/ranked.md).
3. **Drop the old domain palettes and patterns:**
   - the seven-basis palette and its glyphs;
   - the coverage ramp and heat grid;
   - the ConsequenceDialog for every act;
   - the refusal-as-wall pattern.
   They encode the machine's model, which was postmortem cause 4. Replace them with a small status
   family in the new vocabulary: Proposal, Confirmed, Question and over Target Cost
   (docs/research/stack-frontend.md §8). Keep one principle: meaning never rides on colour alone.
4. **Most of what the implemented UI lacked was never designed at all:**
   - a 3D Building Model: there is no design for it anywhere in `B:docs/design/`;
   - a priced grid: S-BOQ was the "unpriced draft", and money never appeared;
   - a ৳ font: the sign was a traced SVG;
   - CAD colour and text rendering on the canvas;
   - selection states that read at a glance;
   - a Project Summary: the project home was an activity log.
   These are the Revit-grade gaps, and the new system has to design them from zero (§5).
5. **Owner calls this file cannot make:**
   - the default theme: the old default was dark by ruling, and no Dhaka QS was ever asked;
   - whether to keep Spline Sans: it needed a word-spacing hack at 12–13 px and has no ৳ glyph;
   - whether the MD's Project Summary must work on a phone: the old work designed only 1280 px and
     wider.

## 1. The old direction in brief

- **Name and metaphor.** The design system was called "Datum", with the tagline "the total station:
  a reference everything is measured from". Its aim was a precision surveying instrument, "the best
  of Linear, Figma and a well-made surveying instrument, never … a dashboard template"
  (B:docs/specs/cubit.bible.xml:565–566). Version 22 renamed the language "the Datum Instrument":
  "a large calibrated field, a narrow band of controls, numbers in tabular mono, one indigo line
  meaning 'you can act here', one copper dot meaning 'this commits'" (00-direction.md §1, lines
  21–26).
- **Five laws** (bible:566):
  1. Graphite is the ground: hairlines join surfaces, and shadows are only for overlays.
  2. Indigo is the beam: if it is indigo, you can act on it.
  3. Copper commits: it appears only when a person commits, never on hover or in a chart, and at
     most once per screen.
  4. Focus is a reticle: four corner ticks, with no glow.
  5. Status is a readout: mono and tabular; nothing bounces, and there is no spinner on a data
     table.
- **Audience and brief.** The founder's brief, quoted in 00-direction.md:9–11: "our audience
  navigates AutoCAD and Revit: the view is highlighted the most, tools are ribbons and bars much
  smaller than regular web pages … compact, professional, eye-catching, user-friendly, no AI slop".
- **Density.** Compact was the default: 28 px rows, 13 px body text and 28 px controls. Comfortable
  (36 px rows, 14 px text) was a per-user choice (00-direction.md §4.2; R-UI-083).
- **Dark and light.** Dark was the default and light was complete. The light ground is a cool
  grey-white that is "never pure white" (bible:566; R-UI-085, bible:685). Glass (92 % opacity with
  a 12 px blur) was allowed on overlays only (00-direction.md:59).
- **References.** The direction named what to take from each product and what to refuse
  (00-direction.md §2):
  - Bluebeam: the markups list live-linked to the view, and the dark UI around a light sheet;
  - Togal: translucent class overlays with a legend chip;
  - Kreo: offering a bulk group for the user to confirm;
  - CostX: dimension-to-cell linking, and the BOQ as a workbook;
  - STACK: sheet thumbnails, and stat tiles above a table.
- **Copy voice** (§6): at most one helper line per screen, verbs on buttons, labels rather than
  machine identifiers, and no "Welcome", "Oops" or "AI-powered".

## 2. Token families, with verdicts

Values are given as light/dark and come from B:src/ui/tokens.ts (generated into
B:src/ui/tokens.css). The density and layout values come from B:src/ui/theme/globals.css:130–175.

| Family | The old values (excerpt) | Verdict | Why, and how |
|---|---|---|---|
| **Neutrals: the graphite scale, 0–1000 in 14 steps** | `0` #F4F5F4/#0C0E11 · `50` #EFF0EF/#101318 · `100` #E9EBEA/#12151A · `150` #E4E7E6/#1A1E25 · `200` #DDE0E0/#22262E (hairline) · `500` #7F868D/#66707F (disabled, ≥3:1) · `600` #5F6772/#7E8899 (captions, ≥4.5:1) · `900` #262B33/#E7EAEE (primary text) | **Keep** the values and the fixed roles (bible:568) | Tested for contrast in both themes (B:src/ui/contrast.test.ts). A slightly cool grey, never pure white. **Change:** the `150` step was added late because five surfaces had collapsed onto three values, which left menu hover at 1.00:1 (tokens.ts:31–40, 263–283). Design the surface ladder in full from day one. |
| **Accent: "beam", the brand indigo** | `100` #E8E6F7/#1A1830 · `300` #B7B1E8/#3B3478 · `500` #5A4FB0/#6E63C8 · `600` #473E92/#8B84E8 · `700` #38316F/#A7A1F0 | **Keep** | It matches the logo (B:src/ui/brand/LOGO-SPEC.md). **Change:** the dark-theme fill needed a separate `--accent-fill` (beam-600), because text on dark beam-500 measures 3.94:1 (tokens.ts:337–345). The result is a pastel-lavender primary button with dark text in dark mode and a deep indigo one in light (gallery `home.dark`, walk `boq-01`), so the brand reads as two colours. Choose one primary fill per theme and test it on real buttons first. |
| **"Act" copper** | surface #FBEFE4/#1D1610 · `500` #A85B28/#C97F4A · `600` #9A5326/#E29A68 | **Keep, and narrow its use** | It is the logo's spark (LOGO-SPEC §2), and scarcity is a good rule. **Change:** Confirmation happens hundreds of times a day, so copper cannot be the colour of "commits" in general. Keep it for the brand spark and at most the single bulk "Confirm N" button on a screen. It must never be the Confirmed-state fill. |
| **Semantic states** | success #1D7A46/#4CC38A · warn #9A5B00/#E8A33D · danger #C22A2A/#F26D6D · info #1866D1/#6CA8F5, each on a surface tint | **Keep the values; change the roles** | Map them to the new words: Confirmed = success, Question = warn, over Target Cost = danger. Proposal needs its own hue, distinct from the accent and from info, because it is the most common state on the Takeoff. |
| **Basis palette (7), with glyphs ◆ ▣ ƒ ⇩ ✎ ▦ ○** | measured teal #0E7A70 · transcribed blue #1D6FB8 · derived violet #6B3FC9 · … (bible:584) | **Drop** | This is the machine's provenance model. In the BOQ capture, every one of 1,131 rows wore two bordered basis chips and "the chips outshout the quantities" (walk P15, `boq-01`). **Keep the principle** "glyph + colour, never colour alone" for the new states and for Rod Basis (by ratio, or from the drawing). |
| **Element-class palette** | wall #3E7CB8/#6BA6DC · column #C2492F/#E07B5F · beam #B57F16/#D9A83C · slab #4F8A5D/#7FB68A · footing #7A5CC0/#A78BE0 · opening #21A0A8/#4FC4CC · rebar #B8478F/#DD7FB4 · generic #6B7280/#98A0AC | **Keep; extend and re-test** | The 3D Building Model and the Takeoff Steps need exactly this. **Change:** add pile, pile cap, stair, finishes and brickwork. The palette has only ever been used for flat UI chips, never tested as shaded 3D materials, so it must be tuned under 3D lighting. |
| **Canvas palette** | paper #FCFCFB/#101216 · grid #E9EAE7/#1B1F26 · ink #23282F/#D5D9DF · selection #5A4FB0/#8B84E8 · hover rgba(90,79,176,.18)/rgba(139,132,232,.26) · pulse #E8930C/#FFB224 · measure #C13515/#FF7A4D · snap #1D7A46/#4CC38A | **Keep as the start; change a lot** | The idea is right: the viewers read tokens, never literals (B:docs/design/viewer.md:731–757). What failed in use: a selected line was "a faint lavender stroke" (P09); pure cyan beam lines were "the faintest ink on the sheet" on light paper, because only white and black were remapped (F31); and white thumbnails were the brightest thing on the dark page (P08). The palette needs a full CAD colour mapping per paper, plus Proposal, Confirmed and Question overlay colours. |
| **Coverage ramp and hatches** | `--cov-0…4` = graphite-200 → beam-300/500/600/700; `--pattern-hatch` is a 45°, 6 px repeating gradient in `currentColor` (globals.css:177–193) | **Drop the ramp; keep the hatch technique** | The coverage heat grid is old vocabulary. A `currentColor` hatch that survives greyscale printing is useful for "open, not confirmed" regions in 2D, 3D and PDF. |
| **Type families** | `--font-ui` Spline Sans · `--font-mono` Spline Sans Mono · `--font-doc` Noto Sans (tokens.ts:163–170) | **Change** (owner call) | Spline Sans's word space collapses at 12–13 px ("Gotoprojects") and needed a `word-spacing: 0.08em` hack (00-direction.md §4.4; globals.css:196–222). Neither face has ৳. The old product never vendored one, and MoneyText drew the sign as a traced SVG (B:src/ui/primitives/core/money-text.tsx:7–20). Whatever family we keep, add a ৳-bearing subset through `unicode-range` (stack-frontend.md §7, rule 5). |
| **Mono for numbers** | "Mono is for numbers, codes, keys, formulas, coordinates, and nothing else" (00-direction.md:50) | **Change** | The rule was right but was not held. The captures set words in mono: layer names, level labels, "1 selected", source links (walk `32-viewer`, `05-column-line-inspector`). Grids with mono everywhere read like code. Recommendation: set figures in the UI face with `tabular-nums`, and keep mono for codes, coordinates and formulas. |
| **Type scale** | 12/13/14/16/20/24/32 px, 10 px mono overline as the one exception, leading 1.45, weights 400/500/600 | **Keep** | It is dense and adequate. Title 20/600 once per screen, sections 14/600, body 13 in compact (00-direction.md:66). |
| **Spacing** | a 4 px grid, `--space-1…12` = 4…48 px | **Keep** | This is Tailwind's default step too. |
| **Density and layout** | row 28/36 · control 28/32 (large 32/36) · cell padding 8/12 · rail 48 (220 expanded) · top bar 40 · toolbar 32 · status 24 · inspector 320 (280–480) · drawer 200 (160–320) · icons 14/16/20 at 1.5 stroke · stat tile 64/72 | **Keep**, with two changes | This is the most useful part of the old work. **Change 1:** the status readout goes only on canvas screens; it stood as a row of dashes on every page (P01; gallery `home.dark`). **Change 2:** the inspector must not reflow the canvas under the pointer. In the walk the clicked element jumped 180 px, and the canvas fell to 53 % of the viewport at 1280 (F23). |
| **Radii** | 2/4/8/12 px | **Keep 2/4/8; drop 12** | The direction itself banned "rounded 12 px cards for everything" (00-direction.md:68). shadcn derives its radii from one `--radius` (default 0.625 rem = 10 px), so set it to 4–6 px. |
| **Elevation** | 4 shadows, e.g. `--shadow-3` 0 8px 24px -4px rgba(16,20,26,.14) / rgba(0,0,0,.55); hairlines preferred; `--line-raised` = graphite-500 for floating edges | **Keep** | Flat docked panels with hairline seams, and shadow only on overlays, is the right register for a CAD tool. |
| **Motion** | state 160 ms · panel 240 ms · fly-to 320 ms · reticle 120 ms · ease `cubic-bezier(0.2,0,0,1)` · fly-to ease `cubic-bezier(0.45,0.05,0.25,1)`; reduced motion sets durations to 0 | **Keep; add 3D** | "Motion only tells you where something went" (00-direction.md:62). Add camera-orbit and section-box timings for the 3D model. |
| **z-layers, breakpoints** | z 0/100/200/300 · breakpoints 640/960/1280/1680 | **Keep**; add a canvas-overlay layer | Only desktop was ever designed, at 1440×900 and 1280×800 (§9.3). |
| **Focus reticle** | four corner ticks, 2 px beam stroke, 8 px arms, drawn 4 px outside the box (R-UI-012) | **Change** | It was a nice signature, but it failed where it mattered. Grid cells clip anything drawn outside their box, so "a focused BOQ cell shows nothing" (F21). Use shadcn's `ring` on controls and an inset outline on grid cells. |
| **Iconography** | vendored Lucide subset, 1.5 px stroke at 14/16/20 px, plus a traced `IconTaka` (B:src/ui/icons/index.ts; LICENSE-lucide.txt:83–87) | **Keep Lucide** (shadcn's default set); **drop `IconTaka`** | **Gap:** there are no element-type icons (column, beam, slab, stair, pile, wall, opening) and no Question glyph. Draw them on Lucide's 24-unit grid. |
| **Data viz** | one hue family per chart, hairline axes, 12 px tabular ticks, no gradients or 3D, every plotted number also in a table (00-direction.md §5) | **Keep the rules** | **Gap:** there is no categorical palette for cost by trade or by floor on the Project Summary. shadcn's `--chart-1…5` slots need our own values. |
| **Semantic alias layer** | `--surface-app/panel/raised/overlay/sunken/band/hover/selected/canvas`, `--ink/-secondary/-muted/-disabled/-inverse/-link`, `--line/-strong/-raised/-accent/-focus`, `--accent/-hover/-active/-subtle/-fill` (tokens.ts:244–380) | **Keep the ladder; rename it into shadcn's slots** | Name collision: shadcn's `--accent` means a subtle hover surface, and its brand colour is `--primary`. shadcn also switches theme with a `.dark` class, not `[data-theme]` (shadcn/ui manual installation docs, via Context7). Map `--surface-app`→`--background`, `--surface-overlay`→`--popover`, `--surface-raised`→`--card`, beam→`--primary`, `--line`→`--border`, focus→`--ring`, and add our own `--surface-sunken/band`, `--canvas-*`, `--element-*` and state slots. |
| **Brand** | "The Ascent": a faceted indigo peak with a negative-space V and a copper spark shown only at 32 px and larger (B:src/ui/brand/LOGO-SPEC.md) | **Keep** | It was approved by the CEO on 2026-05-24 (LOGO-SPEC.md:3). |

## 3. The screens and components the old work designed, mapped to the new key screens

| New key screen | What the old work designed (read it for ideas, never port it) | Carry | Drop |
|---|---|---|---|
| **The Takeoff, with bulk Confirmation and Questions** | S-Takeoff, the register workspace (B:docs/design/s-takeoff.md, 1,463 lines): tree, lines grid and inspector (00-direction.md §3.2). OfferedGroups (B:docs/design/offered-group.md): "14 columns sighted from view B-2" with a live count and one confirm button (R-UI-023, bible:598). ConsequenceDialog (929 lines). RefusalState. S-Levels and S-Schedules. | The **offered group**: a named group, a live membership count in figures, and one button. This is the seed of bulk Confirmation. Also the template: filter chips in one 36 px bar, a frozen key column, group rows with subtotals, and the inspector on selection. | One row per member per kind (1,131 rows, identical pile rows: critical review §4). A dialog before every act: its eyebrow showed the raw `CONFIRM_DISCIPLINE`, and it listed "none → STRUCTURAL" once per sheet (walk B16, `10-confirm-discipline-group`). The rule "no select-all over heterogeneous rows" (R-UI-023) fought bulk Confirmation. |
| **The 2D sheet with the Trace** | S-Viewer (B:docs/design/viewer.md, 3,729 lines): §3.1 frame, layers drawer, one-row toolbar, inspector with a "Cited by" and Trace block, a 24 px mono status readout. EvidenceLink (B:docs/design/evidence-link.md). Fly-to 320 ms with a pulse (R-UI-022). S-Measure: tool chest, gesture grammar, the running figure (2,849 lines, never shipped: walk B04). | The **frame numbers** (the canvas was 74 % at 1440×900 in arithmetic: SCORES.md, Viewer row). The **Trace round trip**: a figure opens the sheet, flies to the entities, pulses them, and Back returns. Keyboard tools V/H/F/Esc (R-UI-032). S-Measure §1's list of what a QS brings from Bluebeam, PlanSwift, OST and CostX. | The hand-rolled WebGL painter (ADR 0022 uses dxf-viewer and pdf.js). An inspector that leads with "Type CIRCLE · Layer · Handle" (F09). The Views and grid panel listing coordinates. Text toggle pills for Snap, Ortho and Angle lock, where the direction specified icon toggles (walk `32-viewer`). |
| **The 3D Building Model** | Nothing. A search of `B:docs/design/` for 3D, Three.js, GLB or IFC finds no design. | The element palette (§2) and the fly-to motion. | — |
| **The Priced BOQ grid** | S-BOQ, "the unpriced draft, by taxonomy section" (B:docs/design/s-boq.md, 876 lines). DataTable standards (00-direction.md §5; B:docs/design/primitives-data.md §3). MoneyText and QuantityText. CostX's "workbook": a section tree on the left, lines on the right, totals sticky at the bottom (00-direction.md:92–95). Budgets: 50k rows at 60 fps, filter in 200 ms or less (PB-4, bible:669). | The **grid law**: 28 px rows, no wrapping, ellipsis with a tooltip, sticky header and footer, a frozen key column, right-aligned tabular figures, lakh and crore grouping on money, the unit as a muted suffix column, and column state saved per user (R-UI-083; §5 rules 1–10). Keyboard: arrows, Enter, Tab, Esc, Space, Shift for a range (§5 rule 6). | The bill shape. Its colour chips per row. "Zero" subtotals printed as `0.000 kg` (B10). Sections in catalogue order rather than work order (F52). No Rate or Amount column was ever designed, and no Estimate screen exists (bible:634 lists S-Estimate for M6, and there is no `s-estimate.md`). |
| **The Project Summary** | S-Project, the project home (B:docs/design/s-project.md), on the Dashboard template: 4 stat tiles (value 20 px mono, label 12 px) above a 28 px table (00-direction.md §3.3). Sparkline and Stat primitives (R-UI-010). | The stat tile geometry and "four tiles above a table, not cards with prose" (STACK, 00-direction.md:97–100). | "The project home is an audit log" (critical review §4). The captures show 4 tiles (one of them "AI cost so far 0.00 USD"), one activity row and about 400 px of empty space (walk `16-project-home`). |
| Shared across all five | Shell: a 48 px rail, a 40 px top bar with breadcrumb, ⌘K, a jobs tray and the user (B:docs/design/shell.md, shell-top-bar.md). The command palette. JobTimeline for upload and reading. Dropzone as the empty state. EmptyState: a glyph, one sentence, one action. | All of them, rebuilt on shadcn (`Command`, `Sheet`, `Sidebar`). The breadcrumb must show the page. It was 2 crumbs naming the list (SCORES.md, C3 row) and truncated every crumb (F24). | The `?__state=` fault-injection harness, the gallery-as-gate, and the height budgets (gallery-v22/README.md). S-Ask (1,147 lines), since the MVP AI is Jev with no LLM (ADR 0011). S-Coverage (1,246 lines). |

## 4. Why the implemented UI was only "okay": the evidence

1. **Good tokens, weak composition.** The audit that opened version 22 scored craft at about
   2.5 of 5. The eight screens scored 1.5 to 3.6, with a mean of 2.4, while the tokens criterion
   was 5 on every one of them (00-direction.md §8, lines 543–555). The canvas used 33 % of the
   viewport and the register's first row sat below the fold (§8, "Viewer (2.7)" and
   "Register (1.5)").
2. **The rebuild's scores measured fixtures, not the product.** SCORES.md gave the rebuilt screens
   4.2 to 4.8. But 4 of the 9 addresses it captured were not the screens they named:
   - Drawings was the root error boundary;
   - the viewer was a 404;
   - Register and Coverage were empty or refusal states;
   - three more stills were an empty shell.
   (B:docs/design/gallery-v22/SCORES.md, "What the pictures turned out to be".) A rubric computed
   from DOM geometry cannot see that a BOQ does not read like a BOQ.
3. **The first walk of the running product found 99 defects.** 22 blocked the demo and 25 were in
   the foundation (P:session-8/walk0/ranked.md, result.json). The pure UI-craft ones:
   - AutoCAD control codes painted literally: `%%C` for Ø and `%%D` for ° (B06);
   - sheets that open looking empty or as specks at fit (B05);
   - filter chips that cannot open, because the listbox had no portal and sat inside a 36 px bar
     with `overflow: hidden` (B07);
   - a dialog showing raw enums and 64-character hashes (B16);
   - keyboard focus invisible in grid cells (F21);
   - the inspector reflowing the canvas under the pointer (F23);
   - every breadcrumb crumb truncated (F24);
   - offer text wrapping one word per line (F26);
   - 281×437 px sheet cards, four to a screen (F29);
   - lakh grouping on grid coordinates (F30);
   - faint cyan ink on light paper (F31);
   - the viewer status bar on every screen (P01);
   - `m3` and `m2` instead of m³ and m², and rod given to the gram (P02);
   - selection shown as a faint lavender stroke (P09);
   - marks sorted as text: P80…P89, P8, P9 (P14);
   - basis chips that outshout the quantities (P15);
   - tabs and the primary button wrapping at 1280 (F16).
4. **The domain shape made every screen noisy.** The critical review lists these
   (B:docs/handoff/session-9-critical-review.md §4–5):
   - one row per member per kind;
   - "campaign", "Author storey height" and "Transcribed / Defaulted" on screen;
   - one storey spelled two ways;
   - AI cost shown in USD;
   - a footer adding pcs, m, m³, m² and kg into one line.
5. **What I saw in the captures** (walk `01-register-dark`, `05-column-line-inspector`,
   `boq-01-dark`, `32-viewer-s10-dark`, `16-project-home`; gallery `home.dark`, `register.dark`):
   - every row carries two or three bordered chips plus an underlined indigo mono link, so nothing
     is quiet;
   - mono is used for words;
   - the tile, card and table borders are all the same hairline weight, so there is no hierarchy
     of surfaces;
   - the project home has four header buttons;
   - dark captures show the pastel primary, light ones a deep-indigo primary;
   - the test tenant and test email appear in the top bar.
   The capture pipeline itself mislabelled themes: `boq-01-dark-1440.png` is a light capture, and
   so is `levels-01-dark` (ranked.md, Caveats).
6. **Design was written far ahead of what was built.** There were 44 Design Decisions totalling
   28,851 lines, S-Measure alone 2,849, and manual measurement never shipped (walk B04). The frame
   budgets PB-3 and PB-4 (bible:668–669) appear only in source comments. `git grep` over `tests/`
   on the branch finds no test that measures them.

## 5. The gaps a Revit-grade bar exposes

These were never designed, or were designed and failed in use. Where I compare against Revit, the
claim is the brief's bar, not a measured walk of Revit. A reference walk of Revit, Bluebeam and
dxf-viewer on the Sample Project is still owed.

- **Canvas chrome for 2D and 3D.** One toolbar grammar for both viewers: icon toggles with tooltips
  and shortcut keys, zoom to fit or to the selection, and a scale bar with the drawing's real scale.
  The old "Scale 1.289 px per drawing unit" was zoom, not scale (F08). The 3D view needs a view cube
  or orbit gizmo, storey isolate, a section box, hide and isolate by element type, and a legend of
  the element colours. None of this exists for 3D.
- **Selection and state language, shared by the grid, the 2D sheet and the 3D model:**
  - hover pre-highlight;
  - a selected state with a screen-space halo or a thicker stroke that holds at every zoom (P09);
  - multi-select;
  - Proposal, Confirmed and Question, each with a colour and a glyph or pattern;
  - excluded or hidden.
  Crossing between views: a selected row highlights on the sheet and in 3D, and the reverse. A
  click on a measured element once answered "No published line cites this selection" (B15).
- **CAD rendering fidelity:**
  - a full AutoCAD Colour Index remap per paper colour, not only white and black (viewer.md I-79,
    F31);
  - lineweights;
  - text rendered in a real face, with control codes decoded (B06);
  - small text hidden below a legible size (greeking);
  - thumbnails that respect the theme (P08).
  dxf-viewer's own rendering has to be judged against this on real sheets
  (stack-frontend.md §5).
- **Dense tables that edit.** The BOQ is a tree grid:
  - section, then item, then Storey Band;
  - editable Rate cells with keyboard and paste (ADR 0022's AG Grid fallback trigger);
  - subtotals that never add unlike units (F12);
  - natural sort of marks (P14);
  - bulk selection with Shift-range for Confirmation;
  - frozen description and amount columns;
  - an empty figure shown as "—", never "0.000" (B10).
- **Units and ৳ typography:**
  - Display Units default to cft, sft, rft, bags and ton, with a unit column set as a muted suffix
    and real superscripts (m³, not `m3`: P02);
  - feet-and-inch dimensions where the drawing states them (ADR 0008);
  - money as `৳1,23,45,678.00` through `en-IN`, grouping applied to money only;
  - the compact `৳4.25 Cr` or `৳85 L` only in the MD's tiles, with the exact figure on hover
    (stack-frontend.md §7, rules 1–3);
  - a real ৳ glyph in the web font and in WeasyPrint's PDF font;
  - tabular figures aligned on the decimal point in every money column.
- **The Project Summary as an MD reads it:**
  - total cost and cost per sft as hero figures;
  - a categorical palette for cost by trade and by floor;
  - confirmed against open, shown as a proportion rather than a percentage chip;
  - the Target Cost warning;
  - a 3D thumbnail.
  Whether it must work at phone width is an open question for the owner.
- **Smoothness, as a measured budget.** Keep the old targets:
  - 60 fps pan and zoom, and hit-testing in 16 ms or less (PB-3);
  - 50k rows scrolling at 60 fps (PB-4).
  Add an INP target for Confirmation clicks and a 3D frame-time budget, and measure them in the
  chrome-devtools trace (stack-frontend.md §8) rather than writing them down.

## Sources

- B:docs/design/00-direction.md: the v22 direction, templates, alias layer, grid law, rubric and
  before-scores.
- B:docs/design/gallery-v22/README.md, SCORES.md, and the 36 PNGs (read: `home.dark`,
  `register.dark` at 1440×900).
- B:src/ui/tokens.ts, B:src/ui/tokens.css, B:src/ui/theme/globals.css, B:src/ui/contrast.test.ts.
- B:docs/specs/cubit.bible.xml:564–690: Datum, R-UI-001…086, the screens, PB-3 and PB-4.
- B:docs/design/s-takeoff.md §0.2–0.3, s-boq.md §0.3, viewer.md §5–6, offered-group.md §1,
  evidence-link.md §1, primitives-data.md, s-project.md, s-measure.md (headings).
- B:src/ui/primitives/core/money-text.tsx, B:src/ui/fonts/README.md, B:src/ui/icons/index.ts,
  B:src/ui/brand/LOGO-SPEC.md, B:src/core/format.ts.
- B:docs/handoff/session-9-critical-review.md §4–5.
- P:session-8/walk0/ranked.md and result.json: the 99 ranked defects, cited above by id.
- P:review/s8-walk0/: the captures viewed were `drawings-viewer/32-viewer-s10-dark-1440`,
  `11-viewer-s10-select-c7-light-1440`, `34-viewer-s14-select-dark-1440`;
  `register-trace/01-register-dark-1440`, `05-column-line-inspector`;
  `bill-docs-settings/boq-01-dark-1440`; and `fresh-flow/10-confirm-discipline-group`,
  `12-drawings-full`, `16-project-home-after-ingest`, all at light 1440.
- The shadcn/ui manual installation docs (Tailwind v4 `@theme inline`, the variable names and the
  `.dark` variant), read through Context7 on 2026-09-26.
- This repository: docs/postmortem.md, docs/adr/0008, docs/adr/0022,
  docs/research/stack-frontend.md §7–8, CONTEXT.md.

**Not checked:** the old component CSS beyond `globals.css`; the rest of the 1,292 walk captures;
any frame-time measurement of the old viewer (none was found under `tests/`). No Dhaka QS or MD has
been asked about the theme or about density.
