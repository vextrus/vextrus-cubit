# 00 — Design Direction, v22: the Datum Instrument

Status: binding for v22 (U1 foundation, U2 rebuild). Author: Design Director, 2026-09-11. Inputs: F-uiux
(the audit: composition fails, tokens hold, craft ≈ 2.5/5), the Bible's `<frontend>` (R-UI-001…070), the
founder's direction of 2026-09-11, and ten real captures viewed at 1440×900 / 1280×720.

What does not change: **R-UI-001 is final** — no token is renamed or revalued; the logo, the two Spline
faces, the graphite scale, the beam, the copper, the basis/element/canvas palettes stand. What changes:
**composition, density, posture**. The founder's sentence is the brief: *"our audience navigates
AutoCAD and Revit: the view is highlighted the most, tools are ribbons and bars much smaller than
regular web pages … modern-futuristic and utmost professional, balanced … compact, professional,
eye-catching, user-friendly, no AI slop."* This file is the one place that says how.

Precedence: Bible > this file > every `docs/design/s-*.md`. Where a screen Decision's geometry
disagrees with §3 here, §3 wins and U2 amends the Decision in place.

---

## 1. Datum Instrument — the language on one page

**What a QS sees first.** The drawing. Or the grid. Never a heading with a sentence under it. Within
one second of landing on any takeoff screen the eye is on the work surface (canvas or grid), the chrome
is a thin dark frame around it, and one line of mono readout at the bottom says where you are and what
is selected. The product should photograph like a surveying instrument's display: a large calibrated
field, a narrow band of controls, numbers in tabular mono, one indigo line meaning "you can act here",
one copper dot meaning "this commits".

**The CAD posture, in numbers.**
- **View-dominant.** On S-Viewer and S-Measure the canvas is ≥ 70 % of a 1440×900 viewport
  (≥ 906 000 px²); on every grid screen the grid is ≥ 55 % of `shell-main`. Nothing else may be larger
  than the work surface.
- **Rail 48 px**, icons only, labels in tooltips (expand to 220 on hover-hold or pin; remembered). The
  quiet mark at 26 px at the top of the rail (R-UI-070). Selection = 3 px inset beam bar + beam-100 fill
  (R-UI-030, unchanged).
- **Top bar 40 px**: breadcrumb `workspace › project ▾ › area › page`, ⌘K, jobs tray, notifications,
  user. Every crumb is a real location (F-uiux §1.2 — "Workspace › Projects" on the viewer ends).
- **Toolbar / ribbon 32 px**: a single row of 28 px icon buttons in 32 px height, grouped by hairline
  separators, tooltip = label + `Kbd`. AutoCAD's ribbon is the reference for *placement* (tools live
  above the view, in groups, small), not for its size: we use one row, never tabs of tabs. Where a tool
  has a mode (snap, ortho, measure kind) the button is a toggle with a 2 px beam underline, not a filled
  pill.
- **One inspector, shell-hosted, 320 px (min 280, max 480), appears on selection.** The shell owns one
  right slot; a screen mounts its inspector into it (`useInspector`) and the slot is absent — width 0,
  not a placeholder sentence — when nothing is selected. No screen renders a second right column, ever.
- **Status readout 24 px**: one line of mono cells with fixed min-widths, `overflow: hidden`,
  ellipsis; it never wraps. Cells: sheet · scale · coords (drawing units | SI) · snap · selection ·
  layers · a job dot.
- **Grid rows 28 px** (compact is the default; comfortable 36 is the user's choice). 13 px body,
  hairline dividers, frozen key column, sticky header, no wrapping cell anywhere.
- **Mono is for numbers, codes, keys, formulas, coordinates** — and nothing else. "1 sheet", "0
  selected", "TYPICAL FLOOR PLAN" are words: Spline Sans. A mono word is a rubric defect (§7 C11).
- **Controls 28 px** in compact (32 comfortable); primary/secondary/ghost identical height; no native
  `<select>`; filters are chips ("Class · All ▾") not labelled dropdown rows.

**Modern-futuristic + utmost professional — the balance, concretely.**
| Axis | The futuristic half (eye-catching) | The professional half (trust) | Rule |
|---|---|---|---|
| Ground | Dark by default; the canvas paper is `--canvas-paper` dark; the sheet glows against graphite | Light theme complete on instrument grey-white, never pure white | Dark is default; per-user toggle beside density; both baselined |
| Glass vs flat | Overlays only (palette, popover, inspector-on-canvas) may use `--surface-overlay` at 92 % with `backdrop-filter: blur(12px)` | Every docked panel is flat graphite with a hairline seam | Glass is a z-overlay privilege; it never appears in a docked region |
| Accent | Beam is *the* light source: selection outline, reticle, active tool underline, the fly-to pulse | Beam never fills large areas; ≤ 1 primary button per region | If it is indigo you can act on it (Bible law 2). A page with two primary buttons fails C11 |
| Copper | The act dot + spark; the confirm in every ConsequenceDialog | Never on hover, never in a chart, at most one act colour per screen | Unchanged (Bible law 3) |
| Motion | Fly-to 320 ms with the flyto ease; pulse in basis colour; reticle draws in 120 ms; panel slide 240 ms | No bounce, no parallax, no shimmering gradients; skeletons keep layout; reduced-motion zeroes all | Motion only tells you *where something went* |
| Contrast | Dark ground lets the drawing ink (`--canvas-ink` dark #D5D9DF) read like a lit instrument | Text ≥ 4.5:1, UI ≥ 3:1, both themes; graphite-600 captions are the floor | Mechanical (axe) |
| Empty states | One glyph (icon set, 20 px, graphite-500), one sentence, one primary action; the SAMPLE offer | No illustration, no "Welcome!", no paragraph | `EmptyState` primitive only |
| Iconography | One vendored stroke set (Lucide, 1.5 px, 16/20), consistent in every toolbar | No emoji, no unicode glyph stand-ins (▣ ◆ etc. stay only as basis glyphs, R-UI-002) | Icon + tooltip + Kbd on every tool button |
| Type | Spline Sans, tight, small; 12–13 px density where data lives | 20/600 page title once per screen; 14/600 sections; 13 body | Word-spacing rendering rule (§4.4) |

"No AI slop" here means: no gradient hero, no illustrated empty states, no rounded 12 px cards for
everything, no sentence under every heading, no emoji, no three button styles on one screen, no
identifiers as prose. The product's personality is *restraint plus precision*.

---

## 2. Reference moves — named, not copied

**Bluebeam Revu.** Adopt: the *Markups List* docked under the document, live-linked — click a row, the
view flies; click a markup, the row highlights (our Trace, R-UI-022, already conceptually stronger);
the dark UI with a light sheet; the tool chest as small icon groups with shortcut letters. Refuse: the
ribbon-of-ribbons with hundreds of tools, the tab strip of open documents (we are URL-first), modal
property dialogs.

**Togal.AI.** Adopt: detected regions rendered as translucent colour overlays *with a legend chip per
class* on the canvas edge; a per-class count that updates as you toggle; "confidence" shown as a state,
not a percentage bar. Refuse: opaque auto-detection with no provenance — every Cubit overlay carries a
basis glyph and an EvidenceLink, and INTERPRETED is a colour, not a promise.

**Kreo.** Adopt: dark canvas as the norm; the measurement list as a narrow side grid with group
subtotals and the unit as a muted suffix; auto-count offered as a *group you confirm*, which is our
Offered-group pattern (R-UI-023) — Kreo proves it reads well at 28 px rows. Refuse: the spreadsheet
sprawl of columns that the user must hide themselves; we ship a column chooser with a sane default.

**CostX.** Adopt: dimension-to-cell live linking — a BOQ cell that knows its drawing (ours does, by
construction: the formula with live variables), and the "workbook" mental model for S-BOQ: sections
left as a tree, lines right, totals sticky at the bottom. Refuse: desktop chrome (title bars, MDI
windows, OK/Cancel dialogs), and the audit-trail as a separate report — ours is the act log, in place.

**STACK.** Adopt: the plan list as a *thumbnail grid with a table toggle*, discipline tabs, revision
badges; the project dashboard as four stat tiles above a table, not cards with prose; a one-click
onboarding sample. Refuse: marketing-style cards with big rounded corners and shadows, spinners on
tables, the light-only theme.

---

## 3. Page templates

Notation: widths in px at 1440×900 unless a token is named. `R` = rail 48, `T` = top bar 40,
`I` = inspector 320 (present only with a selection), `S` = status 24, `B` = toolbar 32. Every region
table lists the four R-UI-050 states this template renders itself (the other three — refusal,
partial, permission-denied — render through `RefusalState` in the region named "primary").

### 3.1 The Viewer (S-Viewer, S-Scale, later S-Measure)

```
┌R─┬────────────────────────────────────────────────────────────────┬─ I ─────┐
│▲ │ ws › Trace Survey ▾ › Drawings › S-101 Foundation Plan    ⌘K ⟳ ✉ ◉ │(only on │
│  ├──────────────────────────────────────────────────────────────────┤ select) │
│▦ │ ⌖ ✋ │ ⟂ ⌒ ◻ │ ⊕ ◈ │ ⊞ ▤ │ ⛶ +  −  │ Snap ▾  Ortho  Angle    L≡ V≡ │ Entity  │
│▤ ├───┬───────────────────────────────────────────────────────────┤ LWPOLY..│
│⚙ │ L │                                                           │ S-TITLE │
│  │ a │                                                           │ #678  ⎘ │
│  │ y │                  CANVAS  (≥ 70 % of viewport)             │ ─────── │
│  │ e │                  fitted on open; dark paper               │ Cited by│
│  │ r │                                                           │ 3 lines │
│  │ s │                                                           │ ▸ rcc…  │
│  │200│                                                           │ Trace   │
│  ├───┴───────────────────────────────────────────────────────────┤ formula │
│  │ S-101 │ 1:100 ✓ │ x 12 340.0  y 2 250.0 dwg │ 12.34 m │ ◆ end │ 1 sel │ 4/4 │ ● │
└──┴────────────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| rail | app areas | `--rail-w` 48 × 100 % | — | — | — |
| topbar | location, ⌘K, jobs, notifications, user | 100 % × `--topbar-h` 40 | crumb shows the sheet name | — | crumb skeleton 120 px |
| toolbar | tools V/H · M(L/A/C) · snap/ortho · views/grid · fit/zoom · panel toggles L≡ V≡ | 100 % × `--toolbar-h` 32; 28 px IconButtons | tools disabled with tooltip reason | — | — |
| layers (left drawer) | layers, views, grid — three stacked collapsible groups; hidden by `L≡` | 200 (min 160, max 320), remembered | "No layers drawn yet" one line | inline RefusalState | 6 skeleton rows |
| canvas (primary) | the sheet, fitted on open, `--canvas-paper` | flex; ≥ 70 % of viewport | EmptyState: "This sheet has no drawable layers" + *Open the drawings list* | RefusalState with fidelity facts (R-UI-043) | progressive by layer; paper + grid visible at once |
| inspector (shell slot) | Selection · Scale tabs; entity header (type · layer · `#handle` IdChip); Cited-by; Trace formula | `--inspector-w` 320 (280–480) | absent (width 0) | RefusalState in the tab | tab skeleton |
| status | mono readout, 7 fixed-min-width cells, never wraps | 100 % × `--status-h` 24 | cells show `—` | — | — |

Above the fold at 1440×900: everything — the canvas is 1440−48−200−(320 if selected) = 872–1192 wide
× 900−40−32−24 = 804 tall; with no selection 1192×804 = 74 %. At 1280×800: canvas 1032×704 = 71 %
with no selection; with a selection the layers drawer auto-collapses to keep ≥ 66 % (the one lawful
dip; the readout says `L≡` is collapsed).

Toolbar tool groups, left to right: **Select V · Pan H** | **Linear L · Area A · Count C** (M4 arms
them; M2/M3 show them disabled with "Measurement tools arrive with S-Measure") | **Snap S ▾ · Ortho ·
Angle** | **Views · Grid** (partition overlay) | **Fit F · + · −** | right-aligned **L≡** (layers
drawer) **V≡** (inspector pin). Every button: 28 px, icon 16, tooltip "Fit to sheet  F".

### 3.2 The Register / grid workspace (S-Takeoff; the template for S-BOQ, S-BBS, S-Levels, S-Schedules)

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Register             ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ Line    │
│  │ Register · Coverage                    rev a3f9c2 ⎘  ● Measure │ C1 col. │
│  ├───────────────────────────────────────────────────────────────┤ 0.405 m³│
│  │ Class·All ▾ Kind·All ▾ Level·All ▾ Basis·All ▾ Cov·All ▾  ⌕   3 of 3 │ ▣ Trans.│
│  ├──────┬────────────────────────────────────────────────────────┤ Formula │
│  │ tree │ Kind        │ Value ▸ │ Unit │ Basis │ Cov │ Formula │ Src │ live vars│
│  │ ▾STR │ ▾ GF · column (4)             1.620 m³                 │ ─────── │
│  │  ▾GF │   rcc.concrete   0.405   m³   ▣ T   ■ 100 %  H×(…)  S-101·C1│ Trace ↗ │
│  │   col│   rcc.concrete   0.405   m³   ▣ T   ■ 100 %  H×(…)  S-101·C2│ Repudi..│
│  │   C1 │   …                                                      │         │
│  │      │ 28 px rows · 13 px · frozen Kind · sticky header         │         │
│  ├──────┴────────────────────────────────────────────────────────┤         │
│  │ 3 lines · 1.620 m³ · 2 refused (show)                    ● job │         │
└──┴──────────────────────────────────────────────────────────────┴─────────┘
```

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tabs row | Register · Coverage (area tabs, 32 px) + right: pinned revision `IdChip` + the one primary (Measure) | 100 % × 40 | — | — | — |
| filter bar | chips, each `Label · Value ▾` (Combobox), search, live count | 100 % × 36 | chips disabled with count 0 | — | — |
| tree | objects by discipline › level › class; 200 (160–320), collapsible | remembered | "No objects registered" + *Measure this campaign* | RefusalState | 8 skeleton rows |
| grid (primary) | DataTable, group rows with subtotals, frozen Kind | flex; ≥ 55 % of main | EmptyState with the refusal that explains it (never silent) | ErrorState retry + report id | skeleton rows, header real |
| footer | totals for the visible set, refused count as a link, job dot | 100 % × 28 | — | — | — |
| inspector (slot) | the line: kind, value, basis chip, formula with live variables, EvidenceLink, source `S-101 · C1 · #678`, "Technical" disclosure (object key, uuid) | 320 | absent | — | — |

Above the fold at 1440×900: grid header at y ≈ 40+40+36 = 116 from top; ≥ 24 rows visible. At
1280×800: tree collapses to 160; ≥ 20 rows. Rule: **the grid's first row is within 240 px of the top
of main on both** (§7 C2).

### 3.3 Dashboard / Home (S-Home = the projects list; S-Project = the project home)

```
┌R─┬──────────────────────────────────────────────────────────────────────┐
│  │ ws › Projects                                              ⌘K ⟳ ✉ ◉ │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ Projects                                   ⌕ filter…    ● New project │
│  ├────────────┬────────────┬────────────┬────────────────────────────────┤
│  │ 12 projects│ 84 sheets  │ 3 campaigns│ ৳ 4,20,00,000 estimated        │  stat tiles 64 px
│  ├────────────┴────────────┴────────────┴────────────────────────────────┤
│  │ Name ▸        │ Client   │ District │ Sheets │ Coverage │ Last act │ ⋯ │
│  │ Trace Survey  │ —        │ Dhaka    │   12   │ ■■■■□ 82%│ 2 h ago  │   │  28 px rows
│  │ Sattva Tower  │ Sattva   │ Ctg      │   40   │ ■■□□□ 41%│ Tue      │   │
└──┴──────────────────────────────────────────────────────────────────────┘
```
S-Project (the project home) is the same template with the project as subject: title row = name +
client · district → zone badges · GFA (one line of `Stat`-style facts, not four labelled paragraphs);
**area tabs** Drawings · Takeoff · Assure · Estimate · Bid · Activity · Settings; four stat tiles
(sheets, campaigns, AI spend, participants); then **Recent activity as a 28 px table** (act, who, when,
subject) — not a card with a sentence. "Not available yet" tabs render disabled with a tooltip, not
inline grey text.

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| title row | h1 20/600 + the one primary | 100 % × 48 | — | — | — |
| stat tiles | 4 `Stat` (value 20 mono, label 12) | 4 × 1fr × 64 | `—` values | — | skeleton |
| table (primary) | projects / activity | flex | EmptyState: "No projects yet" + *Add the SAMPLE project* (R-UI-033) | ErrorState | skeleton rows |

Above the fold: at both viewports the table's first row is at y ≈ 40+48+64+8 = 160.

### 3.4 Drawings list (S-Drawings)

```
┌R─┬──────────────────────────────────────────────────────────────────────┐
│  │ ws › Trace Survey ▾ › Drawings                             ⌘K ⟳ ✉ ◉ │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ Drawings   All · Structural 8 · Architectural 3 · MEP 1   ⌕  ▦ ≡  ↑ Add │  32 px
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ ┌ S-101 ──────┐ ┌ S-102 ──────┐ ┌ S-103 ──────┐ ┌ A-201 ──────┐       │
│  │ │  thumbnail  │ │  thumbnail  │ │  thumbnail  │ │  thumbnail  │       │  cards 200×150
│  │ │ Foundation  │ │ Typical fl. │ │ Roof plan   │ │ Elevation   │       │
│  │ │ STR · r2 · 1:100 ✓ · ◆ 270  │ …                                     │
│  │ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│  ├──────────────────────────────────────────────────────────────────────┤
│  │ Offered: "2 sheets read as CIVIL from the title block"  Preview ▸     │  offered-group strip
└──┴──────────────────────────────────────────────────────────────────────┘
```
The dropzone is the **empty state** and, once sheets exist, the `↑ Add` button (the whole main is a
drop target with a 2 px beam dashed overlay while dragging). The job timeline appears **inline above
the grid only while a job runs**, then collapses to the jobs tray.

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| header | title, discipline tabs with counts, search, grid/table toggle, Add | 100 % × 40 | tabs disabled | — | — |
| job strip | `JobTimeline` while ingesting | 100 % × 40, only while a job runs | absent | RefusalState inline | — |
| sheet grid (primary) | `SheetCard` 200×150 thumb + title + badges (discipline `EnumLabel`, revision, scale state, entity count); or the 28 px table | flex, wrap | Dropzone EmptyState: "Drop DWG, DXF, PDF, PNG, JPG or TIFF" + Choose files | ErrorState | 8 skeleton cards |
| offered strip | discipline confirmation groups (R-UI-023) | 100 % × 36 per group, max 3 then "+N" | absent | — | — |

Above the fold: first card row at y ≈ 88 at both viewports; 4 cards per row at 1440, 3 at 1280.

### 3.5 Coverage grid (S-Coverage, X-3)

```
┌R─┬──────────────────────────────────────────────────────────────┬─ I ─────┐
│  │ ws › Trace Survey ▾ › Takeoff › Coverage              ⌘K ⟳ ✉ ◉ │(on sel) │
│  ├──────────────────────────────────────────────────────────────┤ rcc.con.│
│  │ Register · Coverage        rev a3f9c2 ⎘   ● Preview certificate │ column·L1│
│  ├──────────────────────────────────────────────────────────────┤ ⊖ Held  │
│  │ ● published ◐ partial ○ absent ⊘ declared out ⊖ held ⋯ no class │ out by  │
│  ├──────────┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┤ act 8e8d│
│  │ kind ▸   │ col GF│col L1│bm GF │bm L1 │slab GF│slab L1│ …        │ ⎘       │
│  │ rcc.conc │  ●   │  ⊖▨  │  ●   │  ◐▧  │  ●   │  ○    │            │ Remedy: │
│  │ rebar    │  ●   │  ●   │  ○   │  ○   │  ◐▧  │  ⊘▩   │            │ Measure │
│  │ formwork │  ●   │  ●   │  ●   │  ●   │  ●   │  ●    │            │ this…   │
│  │ 28 px cells · sticky kind column · sticky class/level header      │ Sighted │
│  ├──────────┴────────────────────────────────────────────────────┤ in ▸    │
│  │ 42 cells · 31 published · 6 absent · 3 held · 2 partial          │         │
└──┴──────────────────────────────────────────────────────────────┴─────────┘
```
| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| tabs row | as 3.2 | 40 | — | — | — |
| legend | one horizontal key line, 7 glyph+word pairs; hover → the one-sentence meaning | 100 % × 28 | — | — | — |
| heat grid (primary) | kinds × (class · level) matrix, `CoverageCell` 28×28 with glyph + ramp fill + hatch (§4.5) | flex; ≥ 55 % of main | EmptyState: "No campaign measured yet" + *Measure* | RefusalState | skeleton matrix |
| footer | counts by mark | 28 | — | — | — |
| inspector (slot) | the cell: kind · class · level, mark + cause sentence, the act `IdChip`, remedy (one sentence + one button), Sighted-in list, observations | 320 | absent | — | — |

Above the fold: the grid at y ≈ 108; a 40-kind × 12-column matrix fits at 1440×900 without scrolling;
at 1280×800 the kind column freezes and the matrix scrolls horizontally *inside* the grid (never the
page).

### 3.6 Settings / Members (S-Settings, S-Settings-Participants, rule set)

```
┌R─┬────────┬─────────────────────────────────────────────────────────────┐
│  │ ws › Settings › Members                                    ⌘K ⟳ ✉ ◉ │
│  ├────────┼─────────────────────────────────────────────────────────────┤
│  │General │ Members                          ⌕            ● Invite       │
│  │Members◂│ ┌──────────────────┬────────┬──────────────┬─────────┬────┐ │
│  │Books   │ │ Member           │ Role   │ Last active  │ Projects│ ⋯  │ │  28 px rows
│  │Rule set│ │ ○ j002-owner@…   │ Owner ▾│ 2 h ago      │ 3       │ ⋯  │ │
│  │Taxonomy│ │ ○ j002-member@…  │ Admin ▾│ Tue          │ 1       │ ⋯  │ │
│  │Tax     │ │   ⚠ Holds acts on open campaigns — cannot be removed. Go to Projects │  partial row
│  │        │ └──────────────────┴────────┴──────────────┴─────────┴────┘ │
│  │        │ Invitations (2)                                            │
│  │        │ │ Email            │ Role   │ Sent     │ Resend · Withdraw │ │
└──┴────────┴─────────────────────────────────────────────────────────────┘
```
Settings is a **two-pane** template: a 160 px section nav (a vertical list, 28 px items) and a content
pane whose primary is a table or a key-value form. Rule set = "Pinned edition" as *one* line
(`project · IS1200_IN @ 2026.09 · digest a3f9c2 ⎘`), lineage as a 3-row 28 px table (scope · edition ·
digest chip), then the parameter table (already the best table in the product — keep it, 28 px rows).

| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| section nav | settings areas | 160 × 100 % | — | — | — |
| header | title, search, the one primary | 100 % × 40 | — | — | — |
| table (primary) | roster / invitations / parameters | flex | "No invitations pending" one line | ErrorState | skeleton rows |
| row refusal | `RefusalState` compact variant under the refused row (partial state) | row × 2 | — | — | — |

Above the fold: first row at y ≈ 88 at both viewports. Role change is an inline `Select` in the row
(28 px); Remove lives in the `⋯` row menu as the single danger item — one danger style on the screen.

### 3.7 Auth (S-Auth: sign in · sign up · magic link · reset · accept invitation)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                       ✦  VEXTRUS CUBIT   (spark mark 40 px)            │
│                  ┌──────────────────────────────┐                      │
│                  │ Sign in                      │  360 wide            │
│                  │ Email          ┌───────────┐ │  card on graphite-50 │
│                  │                └───────────┘ │  hairline, radius 8  │
│                  │ ● Send a sign-in link        │                      │
│                  │ ──────── or ────────         │                      │
│                  │ Password                     │                      │
│                  └──────────────────────────────┘                      │
│                  build a1b2c3 · status ●   (10 px mono overline)       │
└────────────────────────────────────────────────────────────────────────┘
```
| Region | Purpose | Size | Empty | Error | Loading |
|---|---|---|---|---|---|
| mark | the full spark mark (R-UI-070: sign-in is one of its two homes) | 40 px, centred, 48 above the card | — | — | — |
| card (primary) | one form, one primary, ≤ 1 line of helper | 360 × auto, centred at 1/3 height | — | RefusalState inside the card (fault card with id) | button loading |
| foot | build + status overline | 10 px mono | — | — | — |

Accept-invitation: "Join **Foundry**" as the title, role as `EnumLabel` ("Member", not `MEMBER`), one
act button. Above the fold: entire screen at both viewports (card ≤ 480 tall). Dark by default: the
first thing a new user sees is the dark instrument with the copper spark.

---

## 4. The semantic token layer

Rules: (1) **nothing in R-UI-001 is renamed or revalued**; (2) aliases are emitted from the same
`tokens.ts` in a new group `semantic-alias` *after* `shadow`, in both theme blocks, referencing the
primitive tokens by `var()`; (3) after U1, **components consume only aliases and density/layout
tokens** — a `--graphite-*`/`--beam-*` reference outside `tokens.ts`, `tokens.css` and the alias group
is a lint failure (`cubit/no-primitive-token`), with the canvas/basis/element palettes exempt because
they *are* semantic; (4) both themes carry identical key sets (R-UI-001 unchanged).

### 4.1 Surfaces, ink, lines, accent, state

| Alias | Light | Dark | Use |
|---|---|---|---|
| `--surface-app` | graphite-0 | graphite-0 | the frame ground |
| `--surface-panel` | graphite-50 | graphite-50 | rail, drawers, inspector, status, tree |
| `--surface-raised` | graphite-0 + `--shadow-1` | graphite-100 | cards, stat tiles (hairline always) |
| `--surface-overlay` | graphite-0 | graphite-100 | popover, palette, dialog (glass: 92 % + blur 12) |
| `--surface-sunken` | graphite-100 | graphite-50 | inputs, wells, grid group rows |
| `--surface-hover` | graphite-100 | graphite-100 | row/item hover |
| `--surface-active` | graphite-200 | graphite-200 | pressed |
| `--surface-selected` | beam-100 | beam-100 | selected row, rail item (R-UI-030) |
| `--surface-canvas` | canvas-paper | canvas-paper | the sheet |
| `--ink` | graphite-900 | graphite-900 | primary text |
| `--ink-secondary` | graphite-700 | graphite-700 | secondary |
| `--ink-muted` | graphite-600 | graphite-600 | captions, helper (≥ 4.5:1 floor) |
| `--ink-disabled` | graphite-500 | graphite-500 | ≥ 3:1 floor |
| `--ink-inverse` | graphite-0 | graphite-1000 | text on `--accent` fills (flips index, not value) |
| `--ink-link` | beam-600 | beam-600 | links, active tool label |
| `--ink-act` | act-600 | act-600 | text on act-surface |
| `--ink-code` | graphite-800 | graphite-800 | mono values in tables |
| `--line` | graphite-200 | graphite-200 | = `--hairline` colour |
| `--line-strong` | graphite-300 | graphite-300 | resizable handles, input borders on hover |
| `--line-accent` | beam-500 | beam-500 | selection outline, active tool underline |
| `--line-focus` | beam-500 | beam-500 | the reticle stroke |
| `--line-act` | act-500 | act-500 | act button border, the 7 px dot |
| `--accent` | beam-500 | beam-500 | primary fill |
| `--accent-hover` | beam-600 | beam-600 | |
| `--accent-active` | beam-700 | beam-700 | |
| `--accent-subtle` | beam-100 | beam-100 | selected fills, chips |
| `--accent-muted` | beam-300 | beam-300 | secondary marks, sparkline |
| `--act` / `--act-surface` | act-500 / act-surface | act-500 / act-surface | unchanged meaning |
| `--state-success(-surface)` | success(-surface) | success(-surface) | |
| `--state-warn(-surface)` | warn(-surface) | warn(-surface) | |
| `--state-danger(-surface)` | danger(-surface) | danger(-surface) | the one danger style |
| `--state-info(-surface)` | info(-surface) | info(-surface) | |
| `--glass-alpha` / `--glass-blur` | 0.92 / 12px | 0.88 / 12px | overlays only |

### 4.2 Density and layout tokens (root, switched by `[data-density]`; compact is the default)

| Token | compact (default) | comfortable | Note |
|---|---|---|---|
| `--row-h` | `--row-compact` 28 | `--row-comfortable` 36 | one switch at the root; the 8 per-screen `[data-density]` overrides are deleted |
| `--control-h` | 28 | 32 | Button, Input, Select, Combobox, chips |
| `--control-h-lg` | 32 | 36 | the one primary per screen, dialog confirms |
| `--cell-px` | 8 | 12 | cell horizontal padding |
| `--cell-py` | 0 | 4 | cells centre vertically; padding never sets row height |
| `--text-body` | 13 | 14 | R-UI-003's "13 in dense tables" becomes the app default |
| `--text-caption` | 12 | 12 | |
| `--gap-section` | 16 | 24 | |
| `--rail-w` / `--rail-w-expanded` | 48 / 220 | same | |
| `--topbar-h` | 40 | 40 | (was `--space-12` = 48) |
| `--toolbar-h` | 32 | 32 | icon buttons 28 inside |
| `--status-h` | 24 | 24 | |
| `--inspector-w` / `-min` / `-max` | 320 / 280 / 480 | same | remembered per user (R-UI-005) |
| `--drawer-w` / `-min` / `-max` | 200 / 160 / 320 | same | layers, tree, settings nav (160 fixed) |
| `--icon-sm` / `--icon-md` / `--icon-lg` | 14 / 16 / 20 | same | 1.5 px stroke |
| `--stat-h` | 64 | 72 | stat tiles |

All values are multiples of 4 (the grid); 28 and 36 are R-UI-001's two row heights, unchanged.

### 4.3 Coverage ramp and hatch (meaning never rides on colour alone)

Sequential ramp for "share published" (cells that are partial, and the project-level heat):
`--cov-0` graphite-200 · `--cov-1` beam-100 · `--cov-2` beam-300 · `--cov-3` beam-500 · `--cov-4`
beam-600 (0 %, 1–25, 26–50, 51–75, 76–100). Colour-blind safe by construction (one hue, lightness
steps ≥ 12 L*). The seven coverage marks each carry a **glyph + a pattern + a colour**:

| Mark | Glyph | Pattern token (SVG, `currentColor` only — no literal) | Colour |
|---|---|---|---|
| published | ● | `--pattern-solid` | `--cov-4` |
| partial | ◐ | `--pattern-dots` (2 px dots, 6 px pitch) | ramp step by share |
| absent, unexplained | ○ | `--pattern-none` + hairline | `--state-danger` outline |
| declared out of scope | ⊘ | `--pattern-cross` (45°/135°, 6 px) | `--ink-disabled` |
| held out of the bill | ⊖ | `--pattern-hatch` (45°, 6 px) | `--state-warn` |
| no class sighted | ⋯ | `--pattern-none`, dotted hairline | `--ink-disabled` |
| catalogue-only kind | ▫ | `--pattern-none`, no border | `--ink-disabled` |

The patterns are geometry-only tokens (`url("data:image/svg+xml,…")` with `fill='currentColor'`), so
the colour-literal lint holds; they also print in the certificate greyscale (R-UI-060).

### 4.4 Spline Sans at 12–13 px — a rendering rule, not a font change

The word space of Spline Sans is narrow (≈ 0.22 em) and at 12–13 px on a 1× display headless Chromium
rounds it to 2–3 px: "Gotoprojects". The fix is a rule in `globals.css`, scoped by size, never a new
family:

```
.cx-text-12, .cx-text-13, [data-density="compact"] .cx-body { word-spacing: 0.08em; letter-spacing: 0.004em; }
.cx-text-14 { word-spacing: 0.04em; }
:root { font-optical-sizing: auto; text-rendering: optimizeLegibility; font-kerning: normal; }
[data-theme="dark"] { -webkit-font-smoothing: antialiased; }   /* dark ground only; light keeps subpixel */
.cx-mono { word-spacing: 0; letter-spacing: 0; font-variant-numeric: tabular-nums slashed-zero; }
```
Mechanical check: the rendered advance of a space at 13 px ≥ 3.5 px (`Range.getBoundingClientRect`
on a " " text node in the gallery's type specimen). Evidence captures add
`--font-render-hinting=none --disable-lcd-text --force-color-profile=srgb` so the suite sees what a
designer's browser sees (F-uiux §5.5.1).

### 4.5 Motion tokens: unchanged, plus two aliases
`--motion-hover` = `--motion-state`; `--motion-drawer` = `--motion-panel`. Reduced motion zeroes them
through the existing source rule. Nothing bounces; nothing shimmers longer than one skeleton cycle.

---

## 5. Table and chart standards

**DataTable (TanStack, the one grid — S-Takeoff, S-Home, S-Members, rule set, S-BOQ, S-BBS, S-Levels,
S-Schedules, documents):**
1. Rows `--row-h` (28 default); header 28 sticky; footer 28 sticky when totals exist.
2. **No wrapping cell.** `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`; a truncated
   cell gets a `Tooltip` with the full value on hover/focus; formulas get an "expand" affordance in the
   inspector, never a taller row.
3. Frozen key column (first), column pin/resize/sort/visibility **persisted per user per table id**;
   a column chooser in the header `⋯`; sane defaults (≤ 8 visible columns at 1280).
4. Group rows (`▾ GF · column (4)`) on `--surface-sunken`, 500 weight, with subtotals per kind/unit;
   collapsed state remembered.
5. Numbers: `--font-mono`, right-aligned, `tabular-nums slashed-zero`, **lakh/crore grouping**
   (`1,00,00,000`, L-FMT-01 in `src/core/format.ts`), unit as a muted `UnitBadge` suffix in its own
   narrow column, money as `MoneyText` with `৳` from the vendored Bengali subset, 2 dp, never `USD`
   chips beside a Taka figure.
6. Keyboard: arrows move the cell cursor, Enter edits/opens, Tab next cell, Esc cancels, Space selects
   row, ⇧ range; the cursor is the reticle (R-UI-012) on the cell.
7. Inline edit only where the act law permits (entered values on S-Levels, rule-set authoring,
   BOQ description/section) — an edited cell shows the ENTERED basis glyph ✎ and commits through
   ConsequenceDialog when it is an act; measured/derived cells are read-only with the Trace.
8. Row states: selected (`--surface-selected`), refused (partial: row shown with a ⚠ and a compact
   RefusalState beneath, never hidden), stale (`--ink-muted` + tooltip), loading (skeleton rows keep
   heights).
9. Virtualised past 200 rows; `data-rows-rendered` published for the suite; 50k rows at 60 fps (PB-4).
10. Row selection → the shell inspector; bulk acts only as Offered groups (R-UI-023).

**Charts** (Sparkline, the coverage heat, the M8 Bracket): one hue family per chart (beam ramp or a
basis colour), hairline axes on `--line`, mono tabular tick labels 12 px, no gradients, no 3-D, no
legend when the axis already says it; every plotted number is also a table somewhere. Status readouts
are not charts: no progress bars for unknown lengths (R-UI-010 Progress is determinate only).

---

## 6. Copy voice

- **One line of helper copy per screen, at most**, as a muted 13 px subtitle under the h1 — or none.
  Section explanations move into an `(i)` popover on the section header or into the empty state that
  needs them. The legalistic "as the extractor read it" sentences are not deleted from the product:
  they move to popovers and to the Design Decision, where they are law.
- **People see labels, never machine identifiers.** `IdChip` renders the 6-char short form with copy and
  the full value in a tooltip and in the inspector's "Technical" disclosure; `EnumLabel` renders
  `Transcribed`, `Structural`, `Owner`, `Register` with the basis glyph where the enum is a basis. The
  SCREAMING form exists only inside "Technical" and in exports. Source keys render as chips
  `S-101 · C1 · #678`.
- **Refusal copy always carries a remedy** and a link (R-UI-020, unchanged — this is the product's
  strongest voice; keep the sentences, put them in the right place: in the row, in the cell inspector,
  in the dialog slot).
- **Verbs on buttons, nouns on tabs.** "Measure this campaign", "Preview certificate", "Add drawings";
  never "Submit", never "OK". One primary per region; the act button is the only copper thing.
- **Numbers speak for themselves.** "3 of 3 lines" not "There are 3 lines of 3"; "2 sheets" (plurals
  through the string registry's `count` forms — the "1 sheets" bug ends).
- **Empty states:** title (≤ 5 words) · one sentence · one primary. "No projects yet — A project holds
  your drawings and everything measured from them. [Add the SAMPLE project]".
- No exclamation marks, no "Welcome", no "Oops", no "AI-powered".

---

## 7. The numeric craft rubric (the Surveyor scores every screen with this)

Each criterion 0–5. Anchors: **0** the property is absent or broken; **2** present but visibly wrong;
**3** acceptable, a reviewer would still note it; **4** correct and quiet; **5** exemplary, nothing to
say. Where a MECHANICAL check exists the score is *computed* and a human may only lower it. Score =
Σ(w·s)/Σw, one decimal. **The v22 bar: ≥ 4.0 per screen and no criterion below 3.** Both viewports
(1440×900, 1280×800) and both themes are measured; the screen's score is the minimum.

| # | Criterion | w | Mechanical check (from the DOM, after `settled()`) |
|---|---|---|---|
| C1 | **Work-surface share** — canvas ≥ 70 % of viewport (viewer) / primary grid ≥ 55 % of `shell-main` (grid screens) / focused screens (auth, settings form) ≥ 40 % | 1.5 | bbox(primary) ÷ bbox(viewport or main); 5 ≥ target, 4 ≥ target−5 pt, 3 ≥ −15, 2 ≥ −25, 1 ≥ −35, else 0 |
| C2 | **Above the fold** — first row / canvas top ≤ 240 px below the top of main, at both viewports | 1.5 | y(primary) − y(main); 5 ≤ 120, 4 ≤ 240, 3 ≤ 360, 2 ≤ 480, 1 ≤ 600, 0 beyond |
| C3 | **Chrome geometry** — rail ≤ 56 collapsed; one right column, present only with a selection; breadcrumb names the page | 1 | count(`aside` at right) ≤ 1 and width 0 without selection; rail width; crumb depth ≥ 3 on project screens. Each miss −2 |
| C4 | **Control height and kind** — every control 28/32 (compact) or 32/36 (comfortable); zero native `select`/`input[type=date]`; icon buttons carry tooltip + Kbd | 1 | computed heights of `button, input, [role=combobox]`; count of `select:not([data-cx])` — any native = 0; any off-height control −1 each |
| C5 | **Row height and cell discipline** — rows exactly `--row-h`; zero wrapped/clipped cells | 1 | row bbox heights; count of cells with `scrollHeight > clientHeight` and no ellipsis; any clipped-without-ellipsis = ≤ 2 |
| C6 | **Identifier exposure** — zero UUID / 64-hex digest / `DXF_HANDLE:` / `v:…@` / SCREAMING enum text nodes outside `IdChip`, `EnumLabel`, `[data-technical]` | 1.5 | regex over text nodes; 5 = 0, 4 = 1, 3 = 2, 2 = 3–4, 1 = 5–8, 0 > 8 |
| C7 | **Copy diet** — ≤ 1 helper line in main; no sentence under a section heading | 1 | count of `p`/`.cx-*-lede` in main outside EmptyState/RefusalState/popover; 5 ≤ 1, 4 = 2, 3 = 3, 2 = 4, 1 = 5, 0 > 5 |
| C8 | **Tokens and grid** — tokens-only colour; padding/margin/gap multiples of 4; font sizes in the scale; only alias/density tokens consumed | 0.5 | existing lint + computed-style sweep; 5 = 0 findings, −1 per finding |
| C9 | **Both themes, contrast, focus** — renders in dark and light; axe serious/critical 0; reticle visible on every focusable | 0.5 | `data-theme` toggled and captured; axe; tab-walk asserting `.cx-reticle` |
| C10 | **No horizontal page scroll at 1280×800** (grids may scroll inside their own container) | 0.5 | `scrollWidth ≤ clientWidth` on `html`, `body`, `shell-main`; any overflow = 0 |
| C11 | **Hierarchy and typographic discipline** — one 20/600 title, 14/600 sections, 13 body; mono only on digit/code text; ≤ 1 primary button per region; one danger style | 1 | mono elements whose text matches `^[A-Za-z ]+$` (words in mono) count; primary/danger button counts per region; judged for hierarchy |
| C12 | **States and empty-state craft** — all 7 R-UI-050 states enumerated and reachable via `?__state`; empty state = glyph + title + one sentence + one primary via `EmptyState` | 1 | states contract length = 7 and each renders; EmptyState primitive present; judged for craft |

Σw = 12. The Surveyor reports the twelve numbers, the weighted score, and the three lowest criteria as
the screen's next fixes; a screen under 4.0 blocks like a failing test (C-13), and a repeated
cross-screen finding (breadcrumb, dead inspector, native select) is owned by the foundation node, not
recorded forever.

---

## 8. Before-scores: the eight screens as they are (light, 1440×900 unless noted)

Scored from the captures listed; these are the v22 baseline the Surveyor re-measures after U2.

| Screen (capture) | C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Viewer (`inc-216 … J-000 … entity-by-its-source-key`) | 1 | 5 | 1 | 3 | 1 | 1 | 5 | 5 | 4 | 4 | 2 | 3 | **2.7** |
| Register (`inc-216 … J-021 … Measure-door`) | 1 | 0 | 1 | 1 | 1 | 0 | 2 | 5 | 4 | 3 | 3 | 3 | **1.5** |
| Coverage (`inc-216 … J-022 … bill-statement`) | 1 | 3 | 1 | 4 | 3 | 0 | 1 | 5 | 4 | 5 | 3 | 3 | **2.3** |
| Home / Project (`inc-215 project-home.light`) | 2 | 2 | 1 | 4 | 3 | 3 | 2 | 5 | 4 | 5 | 3 | 4 | **2.9** |
| Drawings (`inc-216 … J-020 … sheet-card`) | 1 | 0 | 1 | 3 | 3 | 1 | 0 | 5 | 4 | 5 | 2 | 2 | **1.8** |
| Members (`inc-216 … J-002 … MEMBER-HAS-ACTS`, 1280×720) | 1 | 3 | 1 | 1 | 1 | 1 | 1 | 5 | 4 | 5 | 3 | 4 | **2.1** |
| Auth — accept (`baselines j-001-auth/accept`, 1280×720) | 3 | 5 | 5 | 4 | 3 | 2 | 3 | 5 | 4 | 5 | 2 | 4 | **3.6** |
| Settings — rule set (`baselines j-003/ruleset-pin-visible`) | 3 | 1 | 1 | 4 | 4 | 0 | 1 | 5 | 4 | 5 | 4 | 3 | **2.5** |

Mean **2.4** — consistent with the audit's 2.5. Tokens (C8) are 5 everywhere; composition is where
every point is lost. Top 3 fixes per screen, in U2 priority order:

**Viewer (2.7).** (1) Canvas share: rail 48, retire the shell's empty inspector, layers drawer 200,
fit on open — 33 % → 74 %. (2) The status readout: 24 px, fixed-min-width mono cells, no wrap; the
toolbar: 28 px IconButtons with tooltips in one 32 px row (Fit/Zoom text buttons in a floating box
go). (3) Layer names and view keys: `LAYOUT_PLAN:DXF_HANDLE:241` → "Layout plan · #241" via
`IdChip`; names never truncate to a glyph (min 160 px + tooltip).

**Register (1.5).** (1) Grid first: the lines table starts at y ≤ 116; the "Measure runs" block becomes
the job strip that exists only while a job runs; the object inspector moves into the shell slot.
(2) Five native selects → filter chips (Combobox) in one 36 px bar. (3) Identifiers: pinned revision
→ `IdChip`; object key → source chips + Technical; `MEASURED / NONE` → `EnumLabel`; formula cell
no-wrap + ellipsis + inspector expand; "Repudiate this object" into the inspector as a secondary,
not a full-width bar.

**Coverage (2.3).** (1) A real heat grid: kinds × (class · level) matrix with 28 px cells, ramp +
hatch + glyph, sticky headers. (2) The 540 px legend → one 28 px key line with hover meanings; the
cell's cause + remedy live in the inspector slot. (3) The three UUIDs → `IdChip`; `REGISTER /
DECLARATION` → `EnumLabel`; "Sighted in" as a compact 2-row table.

**Home / Project (2.9).** (1) Project header as one fact line + stat tiles; recent activity as a 28 px
table with a real "last act" column, not a card with a sentence. (2) Tabs: disabled with tooltip
instead of "Not available yet" inline text; one button style for Edit/Archive (`⋯` menu). (3)
`PRINCIPAL` → `EnumLabel`; `0 USD` → `MoneyText` in ৳ or the honest "No model calls yet" line only.

**Drawings (1.8).** (1) Dropzone becomes the empty state + `↑ Add`; the sheet grid at y ≈ 88 with real
thumbnails (the lane renders raster, or a deterministic stub). (2) Five helper sentences → zero;
discipline pills → tabs with counts (`Structural 8`), `EnumLabel` case. (3) `SheetCard` with badges
(discipline · revision · scale state · entity count) and cited entities capped at 5 + "+N more" — the
280×5404 baseline ends.

**Members (2.1).** (1) The roster as a 28 px DataTable (member · role Select · last active · projects
· `⋯`). (2) Native selects out; one danger style, in the row menu; the refusal as the partial-row
pattern under the refused member. (3) `OWNER / ADMIN` → `EnumLabel`; helper prose to popovers.

**Auth (3.6).** (1) The spark mark above the card (R-UI-070), dark by default — the first impression.
(2) `MEMBER` → "Member"; the two-line helper → one line. (3) Card on `--surface-panel` with hairline
and radius 8; build/status overline at the foot.

**Settings — rule set (2.5).** (1) Digests → `IdChip` (six of them today as 64-char body text); the
pinned edition as one line. (2) Section nav (160 px) so Members / Rule set / Books are one click, and
the table starts at y ≈ 88. (3) Four helper sentences → popovers; lineage as a 3-row table.

---

## 9. What U1 builds first; what U2 rebuilds; the evidence stills

### 9.1 U1 — the foundation (one node, owns shell + primitives + tokens + every baseline it invalidates, B-20)
1. **Tokens:** the `semantic-alias` group (§4.1), density/layout tokens at the root switched by
   `[data-density]` (§4.2; delete the 8 per-screen overrides), icon-size tokens, the coverage ramp +
   pattern tokens (§4.3), the Spline Sans rendering rule (§4.4); the `cubit/no-primitive-token` lint;
   `tokens.css` regenerated, drift test green; R-UI-001's "consumed by Tailwind" corrected to "as CSS
   variables by `cx-` stylesheets" (Bible amendment, founder-approved wording).
2. **Theme:** dark default in `layout.tsx`; per-user theme control beside density in the user menu;
   the Surveyor's theme instrument fixed (set `data-theme`, reload, assert before capture).
3. **Shell:** 48 px icon rail (expand 220, remembered); 40 px top bar with Breadcrumb primitive fed by
   `routes.ts` (`workspace › project ▾ › area › page`), project switcher, notifications; the **single
   inspector slot** (`useInspector`) — the placeholder aside is deleted; 24 px `StatusBar` readout
   class with fixed-min-width cells; the `Toolbar` container (32 px).
4. **Primitives (R-UI-010 gaps that every template needs):** IconButton, Select, Combobox (+ the
   filter-chip variant), Checkbox, Switch, Breadcrumb, Separator, EmptyState, ErrorState, IdChip,
   EnumLabel, MoneyText, QuantityText, DateText, RelativeTime, Stat, the vendored icon set (Lucide
   subset, B-24). Each ships with its consumer (R-UI-011): the shell and the register are the first.
5. **DataTable v2:** compact default, no-wrap + ellipsis + tooltip, sticky header/footer, frozen key
   column, group rows with subtotals, persisted column state, keyboard cursor with the reticle, row
   states (§5). The rule-set raw `<table>` and every raw `<button>` in screens migrate.
6. **ConsequenceDialog:** the effects-block CSS brought to the Decision and the strings home fixed
   (`consequence-dialog.md`, the drift note); focus the first control, not the container.
7. **Evidence and suite:** global Playwright `use` (1440×900, `reducedMotion: reduce`, dark and light
   projects, `locale en-GB`, `timezoneId Asia/Dhaka`, the three Chromium font flags); `settled()`;
   `?__state=` fault injection; whole-screen height-capped captures (§9.3); the picture tenant with
   fixed names; one re-baseline of everything, both themes.
8. **Gallery:** each primitive in its richest state, both themes side by side, the rubric's mechanical
   checks run against the gallery too.

### 9.2 U2 — the rebuild, template by template
| Template (§3) | Screens U2 rebuilds | Decision amended in place |
|---|---|---|
| 3.1 Viewer | S-Viewer (+ inspector, partition, snap, scale as parts) | `viewer.md` |
| 3.2 Grid workspace | S-Takeoff register; then S-BOQ, S-BBS, S-Levels, S-Schedules are *built* on it in M3 | `s-takeoff.md`, `s-takeoff-register.md` |
| 3.3 Dashboard | S-Home, S-Project | `s-home.md`, `s-project.md` |
| 3.4 Drawings | S-Drawings, sets | `s-drawings.md`, `s-drawings-sets.md` |
| 3.5 Coverage | S-Coverage | `s-coverage.md` |
| 3.6 Settings | S-Settings, participants, members, rule set; S-Audit as a grid | `s-settings*.md`, `s-audit.md` |
| 3.7 Auth | S-Auth, accept invitation | `s-auth.md`, `s-accept-invitation.md` |

Order: Viewer → Register → Coverage → Drawings → Home/Project → Members/Settings → Auth. Each screen
lands only when its rubric score is ≥ 4.0 in both themes at both viewports; the Surveyor's twelve
numbers are in the ledger line.

### 9.3 The Bridge's evidence stills
The founder is right that the stills exaggerate: the checkpoint takes a `fullPage` capture of a frame
that scrolls *internally*, so "full page" is the viewport, long screens are cut mid-row, magenta masks
paint over variable text, dark captures are light, and the fonts are hinted differently from a
designer's browser — so a register that is merely too low on the page reads as a broken one. But the
composition faults above are real at 1440×900 in every capture, masks or not. What a v22 still should
be: **the whole screen at exactly 1440×900** (and a second at 1280×800 for the fold check), device
scale 1, dark and light as two files, taken after `settled()`, with the main scroll container expanded
to its content **capped at 2× the viewport height** (a taller capture fails the run — the 5404 px
card would have been caught), no masks because the picture tenant's data is fixed, the three font
flags on, the cursor hidden, the sheet fitted, and the file named `<screen>.<state>.<theme>.<w>x<h>.png`.
A reviewer should be able to lay the eight stills side by side and see the same frame, the same rail,
the same readout on every one — that sameness is the instrument.
