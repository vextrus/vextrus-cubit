# M0's screens: the behaviour spec

Draft of 26 Sep 2026, for the owner's review. It is the committed record of what the owner judged in
the private prototypes (`.private/work/session-01/{design,proto-takeoff,proto-sheet}`), written so
that `cloud` build sessions, which cannot see those prototypes, build the same thing. Terms are
`CONTEXT.md`'s. Where this page and an ADR, `docs/specs/M0.md` or `docs/design/screens.md` disagree,
those win until the owner rules; tell the orchestrator.

Inputs: docs/specs/M0.md (signed, with its amendments), docs/plans/M0.md (ticket numbers and the
folders each owns), docs/design/system.md (tokens, type, states), docs/design/screens.md (the owner's
rulings), docs/reviews/M0-plan-ux-critic.md (findings 1–15, each answered below), ADRs 0022 and 0032,
and a walk of the three prototypes at 1280×800 on 26 Sep 2026.

Every name, number, sheet and file on this page and in `m0-wireframes/` is invented. Nothing comes
from a real Drawing Set.

**Revised in session 02 (28 Sep 2026)** under the owner's delegation: "Take every necessary actions,
update and write all files to end the session." The revision follows the revised docs/specs/M0.md.

## Session 02 revision (28 Sep 2026)

What session 02 changed on these screens, each with its ruling (the owner's words are in
docs/reviews/session-02-grill.md). The English wording on this page stays as specified except where
listed here.
1. **Every string is a message in a catalogue** (Q15, ADR 0038): the wording on this page is the
   English catalogue's text; machine-written sentences arrive as a code and parameters. New rule 1.7.
2. **Drawing notation is isolated left to right, and CSS is logical** (Q15, ADR 0038): sheet numbers,
   marks, dimensions, coordinates, levels and scales sit in left-to-right isolates, titles in isolates
   of their own direction; the sheet canvas is fixed left to right. Nothing visible changes in
   English. New rule 1.8; 1.2, 3 and 4.6.
3. **The Market drives figures, dates and unit choices** (Q15, ADR 0038): nothing visible changes for
   Bangladesh, and no screen offers a market choice while there is one Market. New rule 1.9.
4. **One Building, no picker** (Q4, ADR 0036): a Project's Site and one Building are made with it, and
   no screen shows a building picker, column or name until a second Building exists. New rule 1.10.
   The Projects empty state now says "for each development", not "for each building" (4.3).
5. **Members given chosen projects; outsiders by invitation** (Q11, ADR 0034): the Members page and the
   invite dialog gain Projects and an end date for anyone; a member sees only their projects; the
   AccessChip shows for anyone with an end date (1.4, 3, 4.1, 4.3, 4.4); the seed gains such a member
   (7).
6. **MEP sheets have their own Disciplines and are not left out** (Q29, Q31; ADRs 0007, 0040):
   Electrical, Plumbing and sanitary, Fire and Other MEP join Structural and Architectural; MEP
   sheets are confirmed like the rest and their views assigned to their Discipline Part (read from
   M3); "MEP" leaves the exclusion reasons, which become six (`1`–`6`). Sections 4.5, 4.7, 5, 6.2,
   6.3, 6.4, 6.6, 6.9, 6.11, 6.15 and the seed (7), whose electrical file is now `KR-ELE-R0.dwg` and
   whose A-07 is now proposed to leave out, so the combined bulk act still has something to leave out.
7. **Words:** where "live" meant open or current, it now says so ("Step 1 is open", "a current
   invitation"), so the word stays the Live Model's (Q2, ADR 0035).
8. **The design gate** gains the checks for 1–6 (8, item 10).

The wireframes in `m0-wireframes/` predate session 02: they show MEP sheets as proposed exclusions
("Leave out, MEP"; "3 MEP sheets excluded" in `step1-shell-*`), `KR-MEP-R0.dwg` in `drawing-set-*`,
and no Projects column on the Members page. This page wins where they differ.

## What is not settled or not proven (read first)

- **Step 1's layout is settled (layout A, the owner's ruling), but not every detail.** Section 6 is
  written from the Step 1 prototype; 6.18 lists what the prototype, the rulings and sections 4–5
  leave open for the owner.
- **No QS has read any of this wording.** Every message below is my reading of a QS's words, not a
  QS's. The owner's walk and the timed Step 1 by a QS who did not build it (spec amendment 10) test it.
- **The key map is measured only on prototypes:** the Takeoff's 25 keystrokes for a whole step, and
  Step 1's 2 keystrokes for a clean set and 14 for a messy one (screens.md), on invented data, by
  the people who built them.
- **The exact AutoCAD wording for the SHX-text plot option** ("Include SHX text as comments", the
  `PDFSHX` system variable) must be checked against Autodesk's documentation by ticket 12 before the
  PDF report ships; I have not verified the dialog label.
- **The cursor readout's origin on a layout-tab sheet** (paper units or model units) is not decided;
  model-space sheets show the drawing's own coordinates.
- **The market habits are unwalked on these screens.** They were proven only in the private session-02
  global prototype (docs/research/global-markets-foundation.md). With English the only catalogue, a
  string outside the catalogue, a physical CSS property or an unisolated dimension looks right on
  every M0 screen; only the lints and the design gate's checks (8) catch them.
- **How Coverage stores an MEP view's assignment** to a Discipline Part whose Takeoff Steps are not yet
  defined (M3) is the data model's to settle (docs/specs/M0.md, `takeoff`); the screens below show it
  as the Part's name with "M3 onwards".
- **The prototypes break this spec in places** and must not be copied blindly: the sheet prototype
  showed performance readouts and a renderer string by default, entity types, layers and handles on
  hover, font file names and "SDF glyphs" in its font panel, and "Rod" for Rebar; the Takeoff
  prototype put "Answering confirms…" below the options. Each is corrected below.

## Contents
1. Rules for every screen
2. The key map (one map, owned by the app shell)
3. Shared UI (owned by ticket 03)
4. The screens: 4.1 app frame and shell · 4.2 sign-in · 4.3 projects · 4.4 members and access ·
   4.5 the Drawing Set · 4.6 the sheet viewer · 4.7 Step 1's shell
5. Step 1: what is settled regardless of layout
6. Step 1 on layout A, "List ⇄ Sheet" (from the Step 1 prototype)
7. The seeded demo project
8. The design gate
9. Open questions for the owner

Wireframes (SVG, invented data) sit beside this file in `docs/design/m0-wireframes/`, each at
1440×900 and 1280×800: `sign-in-*.svg`, `projects-*.svg`, `members-*.svg`, `drawing-set-*.svg`,
`drawing-set-empty-*.svg`, `sheet-viewer-*.svg`, `step1-shell-*.svg`, `step1-list-*.svg`,
`step1-sheet-*.svg`, `step1-question-1280.svg`, and `phone-notice-390.svg`; beside them, screenshots
of the Step 1 prototype (`step1-proto-*.png`, invented data). They fix proportions and content, not
pixels; the tokens in docs/design/system.md fix the pixels.

---

## 1. Rules for every screen

### 1.1 Words
- **CONTEXT.md's terms, exactly:** Drawing Set, Discipline, Takeoff, Takeoff Step, Proposal,
  Confirmation, Question, Check, Coverage, Trace, QS, MD, Vextrus Engineer, Display Units, Rebar, and
  from session 02 Project, Building, Site, Market, Live Model and Discipline Part (none of the last
  five is shown on an M0 screen while a Project has one Building and there is one Market, except a
  Discipline Part's name in the assign dialog, 6.9).
  "Plot" is the consultant's PDF page registered beneath a sheet. "View" is a part of a sheet (a
  plan, a section, a schedule, a detail, notes, a title block, a legend, an elevation, a key plan, a
  3D view).
- **Sentence case** for every label, button and heading. Drawing text (sheet numbers, titles, view
  titles) keeps the drawing's own case.
- **Never shown to a QS or an MD** (the design gate greps the DOM for them): handle, entity, SDF,
  DXF, LibreDWG, ACadSharp, ezdxf, pdf.js, WebGL, buffer, artefact, render (as a noun), parse, JSON,
  sandbox, worker, job, queue, hash, sha256, tenant, RLS, API, null, undefined, NaN, stack traces,
  error codes, a message code or catalogue key (1.7), UUID, locale, cell or home region, "Rod" (the
  word is Rebar), "model space" (say "laid out in the drawing"), font file
  names with extensions (`romans.shx`: say "Romans (AutoCAD lettering)"), and any path. The only
  file names shown are the QS's own uploaded files, as the label of that file. "SHX" appears only
  inside the name of the AutoCAD setting the PDF report tells the QS to ask for.
- **Messages say what happened, what it means, and what to do,** in that order, in one or two
  sentences. No "Error:", no "Oops", no exclamation marks, no apologies.

### 1.2 Figures
One formatter per kind (ticket 03, `web/src/format/`, with its table of expected strings), driven by
the Market's format profile (1.9): coordinate and length in ft-in (`42′-7½″`, never grouped); count
as n / N (`12 / 13`), unknown N as `—`; date as `26 Sep 2026` and time as `10:42`, in the Market's
time zone (stored in UTC); share as a whole percent beside what it is a share of; empty figure `—`.
Coordinates, lengths, levels and scales come out of their formatter already isolated left to right
(1.8). M0 shows no money and no quantities; their formatters exist, with rows in the table (docs/specs/M0.md).

### 1.3 The decode rule: no CAD code ever shows
All drawing text is decoded on the server, by one function in `engine/render/text.py` (ticket 11),
before it is stored, sent or drawn; tickets 13 and 21 and the export call the same function. The web
app never decodes; it shows what the API sends.

| In the drawing | On the sheet | In plain text (lists, titles, tooltips, search, export) |
|---|---|---|
| `%%C` `%%c` | Ø | Ø |
| `%%D` `%%d` | ° | ° |
| `%%P` `%%p` | ± | ± |
| `%%%` | % | % |
| `%%nnn` | the character nnn in the drawing's code page | the same |
| `%%U`, `%%O` | underline, overline on and off | dropped |
| `^J`, MTEXT `\P` | a line break | a line break in multi-line fields; one space in single-line fields |
| `^I` | a tab | one space |
| MTEXT `\~` | a non-breaking space | a space |
| MTEXT `\\`, `\{`, `\}` | `\`, `{`, `}` | the same |
| MTEXT `{…}` groups, `\f…;` `\F…;` `\H…;` `\W…;` `\Q…;` `\T…;` `\A…;` `\C…;` `\c…;` `\L` `\l` `\O` `\o` `\K` `\k` | applied as formatting | dropped |
| MTEXT `\Sa^b;` `\Sa/b;` `\Sa#b;` | stacked | `a/b` (Archivo's `frac` feature sets ½ ¼ ¾ where the pair has one) |
| `\U+XXXX`, `\M+nXXXX` | the character | the character |
| Any other `%%x` or unknown `\x` | dropped, logged for Vextrus | dropped |

Tests: ticket 11 tests every row; tickets 16, 20 and 22 each assert that no rendered string contains
`%%`, `\P`, `\f`, `\S`, `^J` or `{\`; the web's `DrawingText` component (section 3) logs any such
string in development builds. Bangla typed in a legacy ANSI font is not a code: it shows as the
drawing shows it, and the Bangla-ANSI Check flags it (4.5).

### 1.4 Roles on screen
- **QS:** everything on these screens, except inviting a QS or an MD (see open question 2).
- **A member given chosen projects** (session 02 Q11, ADR 0034; any role) sees only those projects:
  the project list, the project switcher, `Ctrl K` and every address; any other project's address
  shows 4.1's "Page not found".
- **MD: read-only everywhere except Members and access** (story 57; open question 1). Buttons that
  change the Takeoff or the Drawing Set are absent, not disabled. A key that would change something
  shows the toast "As MD you can look at the Takeoff but not change it." Every confirmed item shows
  who confirmed it and when ("Confirmed by Nusrat Jahan, 26 Sep 2026").
- **Vextrus Engineer:** works as a QS inside a current invitation (story 63). The top bar carries the
  access chip (section 3). Every act shows under their own name with "(Vextrus)" after it.

### 1.5 Desktop only
The QS screens need 1280 px (ADR 0016). Under 640 px wide every screen after sign-in is replaced by
the phone notice. From 640 to 1279 px the page keeps its 1280 px layout and scrolls sideways, with
the narrow notice above it. Sign-in works at any width.

### 1.6 Performance readouts only behind `?perf`
Adding `?perf` to any URL sets a session flag (cleared by `?perf=0` or closing the tab). Only then:
the viewer's status bar shows frame time p50/p95, GPU time, open time and the renderer's name, and
the viewer toolbar shows "Measure" (the scripted 360-frame zoom, pan and zoom out); the Drawing Set
report shows read time and peak memory per file, and upload-to-sheet-list time. Without the flag
none of these exist in the DOM; a test in each of 16 and 20 checks that (ux-critic #8; the
post-mortem's test artefacts in the demo).

### 1.7 Every string is a message (session 02 Q15, ADR 0038)
- **Every string on these screens** (labels, headings, buttons, tooltips, accessible names, toasts,
  errors, empty and loading states, status cells, the Question templates, the reports' wording, the
  keys overlay) is a message in the English catalogue, the only one shipped. The wording on this page
  is that catalogue's English text, unchanged by the move.
- **Names, numbers, dates, file names and drawing text enter a message as named placeholders,**
  formatted by their kind (1.2), never concatenated around it. A count's words come from the
  catalogue's plural rule ("1 file", "3 files"), never an "s" added by code; lists join by the
  catalogue's list pattern ("A, B and C").
- **Sentences the machine writes** (Questions, Check findings, the file reports of 4.5, exclusion
  reasons, status cells, "Who did what", the Engineer's acts, toasts naming an act) come from the API
  as a message code and parameters and are worded here from the catalogue. Nothing the machine stores
  is English prose.
- **Text a person typed** (a corrected title, a pasted drawing list, an "other" reason, a name, an
  address) and drawing text are data: shown as entered, never translated.
- **A missing message is a bug:** a test fails when a code the API can send, or a key the web app
  uses, has no English message; the DOM never shows a key. The catalogue lint (no visible string
  literal in UI code outside the catalogue) runs in CI, and the design gate checks it (8).

### 1.8 Left to right where it must be (session 02 Q15, ADR 0038)
- **Drawing notation is always isolated left to right,** whatever the language around it: feet-inch
  lengths and coordinates, levels ("EL +16′-6″"), scales ("1:100"), sheet numbers, revision marks,
  marks, grid labels and file names. The formatter, or `DrawingText` for a sheet number, wraps each in
  `<bdi dir="ltr">` (LRI…PDI in plain text, such as a tooltip or the clipboard). In English nothing
  visible changes; in a right-to-left language it stops `14′-6″` reading as `″6-′14`, as the
  session-02 global prototype measured.
- **Other drawing text** (a sheet or view title, a room name) is isolated in its own direction
  (`<bdi>`, direction from its first strong letter), so a title in another script neither reorders
  the sentence around it nor is forced left to right.
- **The sheet canvas, its thumbnails and its outlines' chips are fixed left to right** (`dir="ltr"`)
  and never mirrored; the chrome around them may mirror in a right-to-left language.
- **CSS uses logical properties only** (start and end: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`); a lint bans `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-` and their like in UI code,
  the canvases excepted. The page's `lang` and `dir` come from the language's data (`en`, `ltr`).
- "Left", "right" and "left to right" on this page describe the English layout; in the chrome's code
  they are start and end.

### 1.9 What the Market changes on screen (session 02 Q15, ADR 0038)
Every Developer and Project points to a Market. Bangladesh is the only one, and on these screens it
changes nothing a Dhaka QS would see. It sets:
- the language (English) and direction (left to right) of every page;
- figures and dates, through the formatters (1.2). Bangladesh's English borrows `en-IN`, whose short
  month for September is "Sept"; the date formatter still writes `26 Sep 2026`, and the table of
  expected strings holds that row;
- the time zone dates and times are shown in (Dhaka's), though every time is stored in UTC; no screen
  names the zone;
- the unit systems the New project dialog offers and the one it picks (4.3: Imperial, then Metric),
  and the unit system's name the status bar shows ("Imperial");
- that the Bangla-ANSI Check runs (4.5), which is Bangladesh's.

**No market choice anywhere while there is one Market:** no Market field in the New project dialog, no
Market name on any screen, and no currency (M0 shows no money).

### 1.10 One Building, no picker (session 02 Q4, ADR 0036)
- A Project holds its Site and one or more Buildings. M0 makes the Site and one Building with each new
  Project, without a word to the QS.
- **While a Project has one Building, no screen shows a building picker, a Building column or filter,
  or the Building's name,** and nothing asks the QS about it; every sheet is assigned to that Building
  silently.
- A second Building appears only in M4, which reads one; nothing in M0 makes one. M4's behaviour spec
  designs the picker and where the Building shows. The design gate checks that on the seed the DOM
  holds no building picker, column or name (8).

---

## 2. The key map (one map, owned by the app shell)

Ticket 03 owns the registry (`web/src/app/keys`); tickets 16, 20 and 22 register into it and never
add a `keydown` listener of their own. This answers ux-critic #5.

### 2.1 How the registry works
- A binding is `{key, scope, when, label, group, run}`. Scopes stack, highest first: **dialog**
  (a modal or the keys overlay) → **mode** (the exclusion picker, an inline edit) → **region** (the
  focused region: list, canvas, inspector) → **screen** → **global**. The highest scope that has an
  active binding for a key takes it; lower ones never see it.
- **Typing wins.** While focus is in a text input, textarea or contenteditable, only Esc, Enter (to
  save the field), Tab and Ctrl-shortcuts reach the registry; letters, digits and `?` type.
- **Two bindings for one key in one scope is a bug:** the registry throws in development, and a
  test mounts every screen on the seed and fails on any duplicate or any binding without a label.
- **The `?` overlay is drawn from the registry,** so it lists exactly the keys active on this
  screen now, grouped "On this screen", "On the sheet", "Everywhere". It is also opened by the
  keyboard button at the right of the toolbar (canvas screens) or in the user menu (other pages).
- Keys are matched on `event.key`, so `?` works on any layout; the overlay shows keys as Kbd chips.
- Browser keys are never bound: Ctrl W, T, N, L, R, Tab-switching, F5, F11, F12.

### 2.2 The map

| Key | Scope | What it does | Registered by | In M0 |
|---|---|---|---|---|
| `?` | global | Open or close the keys overlay | 03 | yes |
| `Ctrl K` | global | Jump to: projects; inside a project, the Drawing Set, Step 1, Members and access, and any sheet by number or title | 03 | yes |
| `Esc` | global | Close the top-most layer (overlay, dialog, popover, menu, panel); else leave a mode; else leave one-by-one review; else clear the selection. Never leaves the page, never throws away typed text without asking | 03 (each layer registers its own close) | yes |
| `F6` / `Shift F6` | global | Move focus to the next / previous region (top bar, list, canvas, inspector, status bar) | 03 | yes |
| `Ctrl Z` | screen | Undo the last act on this screen, where the screen has undo (Step 1: the last Confirmation, answer or exclusion) | 22 | yes |
| `↑` `↓` | region: list | Previous / next row. In Step 1 the rows are sheets, so the viewer follows: the arrow keys page through the sheets (story 54, finish line step 6) | 03 (list primitive), 20, 22 | yes |
| `↑` `↓` | region: canvas (Step 1) | The same as in the list: previous / next sheet, so paging works wherever focus is | 22 | yes |
| `Home` `End` | region: list | First / last row | 03 | yes |
| `Enter` | region: list (projects, Drawing Set) | Open the project; open the file's report | 20 | yes |
| `Enter` | screen (Step 1) | What the Confirmation bar says: in list mode the bulk act (proposed exclusions included) or the focused Question's answer; in sheet mode confirm the sheet and open the next one needing the QS (6.4, 6.5) | 22 | yes |
| `Space` | region: list | Add the focused row to the selection or take it out. **In Step 1 (screen scope): List ⇄ Sheet** (6.1; selection there is open, 6.18) | 03, 22 | yes |
| `Shift ↑` `Shift ↓` | region: list | Extend the selection | 03, 22 | yes |
| `→` `←` | screen (Step 1, sheet mode) | Next / previous view on the sheet, flying to it; nothing in list mode (6.15; replaces "review a group one by one") | 22 | yes |
| `[` `]`, `PageUp` `PageDown` | screen (any sheet) | Previous / next sheet in the list's order | 16 | yes |
| `F` | region: canvas | Fit the whole sheet | 16 | yes |
| `Shift F` | region: canvas | Back to the working view (the fit the sheet opened with) | 16 | yes |
| `D` | screen (any sheet) | Paper ⇄ CAD-dark | 16 | yes |
| `P` | screen (any sheet) | Engine → Plot → Compare → Engine. With no Plot for this sheet, shows why and stays on Engine | 16 | yes |
| `O` | screen (any sheet) | Show or hide the view outlines | 16 | yes |
| `Z` | region: canvas | Zoom to the selected view | 16 | yes |
| `+` `−` | region: canvas | Zoom in / out about the centre (the wheel zooms about the pointer; drag with the left or middle button pans) | 16 | yes |
| `S` | screen (Step 1, sheet mode) | Open the sheet picker (in list mode the list already has focus) | 22 | yes |
| `Q` | screen (Step 1) | Go to the next open Question | 22 | yes |
| `X` | screen (Step 1) | Exclude the focused sheet(s) or the selected view, with a reason (opens the picker) | 22 | yes |
| `E` | screen (Step 1) | Correct the focused sheet's number, title or storeys, in the inspector; `Enter` saves, `Esc` cancels | 22 | yes |
| `A` | screen (Step 1, sheet mode, a view selected) | Assign the view to one or more Takeoff Steps (6.9) | 22 | yes |
| `1`–`9` | mode: exclusion picker | Pick a reason | 22 | yes |
| `1`–`9` | screen (Step 1) | Pick an answer on the active Question card | 22 | yes |
| `V` `W` `H` `M` `L` | canvas | Select, select by window, pan tool, measure, layers | M1 | reserved |
| `←` `→` | dialog: a Trace | Step through a figure's sources | M1 | reserved |

### 2.3 Collisions this map resolves
1. **Arrows** (ux-critic #5: arrows vs `[ ]` vs `← →`). The sheet prototype paged with `[ ]` and
   stepped through Trace sources with `← →`; the Takeoff prototype moved between groups with `↑ ↓`
   and reviewed one by one with `← →`; the spec pages sheets "with the arrow keys". Now: `↑ ↓` move
   rows, and in Step 1 a row is a sheet, so `↑ ↓` page sheets from the list or the canvas; `[ ]` page
   sheets on any screen that shows one, including where there is no list; `← →` enter and leave a
   group, as in the Takeoff; Trace-source stepping moves into a Trace mode in M1, where no row
   selection is active. In Step 1 (layout A) `← →` step through the views of the open sheet instead
   (6.15).
2. **F.** The sheet prototype fitted the paper; the Takeoff prototype fitted the working view;
   screens.md ruling 6 says "F fits the whole sheet". Now: `F` whole sheet, `Shift F` working view.
3. **Enter on the sheet.** The sheet prototype confirmed a figure with Enter. In M0 only Step 1
   binds Enter (at screen scope, so it works from the list or the canvas); the viewer alone binds
   nothing to Enter.
4. **Digits.** Answers and exclusion reasons both used `1`–`4`. The picker is a mode, so it wins
   while open, and it replaces the Confirmation bar, so a Question's answer keys are never shown at
   the same time.
5. **Esc.** Both prototypes overloaded Esc (close a drawer, leave a Trace, clear the selection). Now
   one stack, in the order in 2.2.
6. **S.** The sheet prototype's `S` opened a 420 px drawer over the canvas. In Step 1 (layout A)
   `Space` swaps the list and the sheet, and `S` opens the sheet picker in sheet mode (6.15).
7. **Z and Ctrl Z.** `Z` zooms to the selected view; `Ctrl Z` only ever undoes.
8. **Letters while typing** (a sheet title with a D in it): typing wins (2.1).
9. **`?` on keyboards where it is not Shift /:** matched on `event.key`.

---

## 3. Shared UI (owned by ticket 03)

Ticket 03 owns `web/src/ui/` (ux-critic #6) and copies the accepted pieces from the design
specimen's `src/ui/` (ticket 01 brings the tokens and fonts). Later tickets import; they do not
restyle.

| Piece | What it is | States and rules |
|---|---|---|
| **Glyphs** (`glyphs.tsx`) | The 14 Takeoff Step glyphs; status marks Proposal (dashed square), Confirmed (solid square with a tick), Question (revision cloud with ?), Over Target (filled triangle, unused in M0), Excluded (circle with a slash); Cost Basis measured / allowance; Rebar Basis by ratio / from the drawing / from the drawing + rules; the Trace leader; the brand mark | Lucide's 24-unit grid, 1.5 stroke. The specimen's `Rod*Glyph` names become `Rebar*Glyph`. A glyph never stands alone: a word beside it or an accessible name |
| **StatusMark** | Glyph + word ("Proposal", "Confirmed", "Question Q3", "Excluded") in its status colour | Compact form: glyph with the word as screen-reader text and tooltip |
| **Kbd** | A key chip, 16 px high | Shows `Ctrl K`, `↵`, `Esc`, `1`; never a word longer than `PageDown` |
| **Count** | n / N with the n bold and "/ N" muted; optional label; `—` for unknown N | Never a percentage alone |
| **Empty** | Glyph, one sentence saying why, one action | Wording per screen below |
| **Skeleton** | Grey bars with a shimmer, plus one line of what is happening | Shimmer stops under reduced motion. No spinner over a table or a canvas; a spinner only inside a button that is saving |
| **ErrorBar** | A red inset bar: what went wrong and what to do, with one action | Never a red wall; field errors are a red edge and a line under the field |
| **Toast** | Dark pill at the canvas foot or page foot, 6 s, with "Undo  Ctrl Z" when the act can be undone | One at a time; a new one replaces the old; `role=status` |
| **Dialog, Popover, Menu, Tabs, Tooltip, Command** | shadcn primitives on the tokens | Every close is registered with the key map's Esc stack |
| **PhoneNotice** | Full screen under 640 px | "Vextrus needs a desktop" / "Open it on a screen 1280 px wide or more. Your work is saved; nothing is lost." / link "Sign out" (`m0-wireframes/phone-notice-390.svg`) |
| **NarrowNotice** | A 28 px bar at the top, 640–1279 px | "This screen is built for 1280 px or wider. Some of it may be cut off; scroll sideways to see it." |
| **ReadOnlyChip** | In the toolbar or page header, for the MD | "Read only: MD" with tooltip "You can look at the Takeoff but not change it." |
| **AccessChip** | In the top bar, for a Vextrus Engineer, and for anyone else whose access has an end date (session 02 Q11) | "Vextrus access to Shapla Homes Ltd until 26 Oct 2026"; amber when 3 days or fewer are left: "Vextrus access ends in 2 days". For anyone else: "Access to Shapla Homes Ltd until 26 Oct 2026" / "Access ends in 2 days" |
| **DrawingText** | Shows a drawing string (number, title, view title) in the drawing's case, ellipsis plus tooltip when cut, isolated (1.8: a number left to right, a title in its own direction) | In development builds, logs any `%%`, `\P`, `\f`, `\S`, `^J`, `{\` it is given |
| **Progress line** | A 3 px bar under a status text, plus the words | Determinate when steps are counted, else a slow indeterminate sweep; still under reduced motion |
| **Formatters** | `web/src/format/` | 1.2, driven by the Market (1.9); drawing notation isolated (1.8) |
| **Messages** | The English catalogue and its helpers | 1.7; no visible literal outside it |

---

## 4. The screens

### 4.1 The app frame and shell (ticket 03)

**Purpose.** One frame every screen sits in, so the chrome never moves between screens and later
tickets only fill regions.

**Routes.** `/sign-in`; `/projects`; `/members`; `/p/:code/drawing-set`; `/p/:code/takeoff/:step`
(Step 1 is `takeoff/1`; `?sheet=S-04` opens a sheet). The active Developer comes from the session's
Membership; the switcher changes it.

**Two layouts.**
- **Page screens** (projects, members, the Drawing Set): 40 px top bar, then a page on the grey
  background: content 1120 px wide, centred at 1440 (160 px each side) and at 1280 (80 px each
  side); a docked panel (the Drawing Set's report, 480 px) pushes the content left instead.
- **Canvas screens** (the Takeoff): 40 px top bar; 48 px step rail; 32 px toolbar; the canvas; a
  docked 320 px inspector; a 24 px status bar. Canvas at 1440×900: 1072 × 804 px (74% of the width);
  at 1280×800: 912 × 704 (71%). The inspector never floats, so selecting never moves the drawing.

**Top bar, left to right.** Brand mark; the project switcher ("Kadam Residence ▾", listing only the
projects the member may open; on `/projects` and `/members`, the Developer's name instead; no building
picker beside it, 1.10); text navigation with **only Takeoff and Drawing Set**
in M0 (ux-critic #13; Priced BOQ, Material Schedule and Project Summary appear with their milestones,
never as dead links); the AccessChip for a Vextrus Engineer; on the right, "Jump to…  Ctrl K" (220 px)
and the user menu ("Nusrat Jahan, QS ▾": the Developer switcher when the user has more than one
Membership, "Members and access", "Keys  ?", "Sign out"). No Revision label in M0: one issue only.

**Step rail (48 px, 288 px open, overlaying the canvas, never reflowing it).** All 14 Takeoff Steps
in building-first order, numbered. Step 1 is open; its state mark follows screens.md (Question wins,
then all confirmed, then Proposals ready, none for not started). Steps 2–14 are muted with the
tooltip "Step 7, Beams: not open yet"; clicking one shows the canvas empty state "Step 7, Beams, is
not open yet. It will read the sheets you confirm in Step 1." with the action "Back to Step 1". The
MEP Parts' own Takeoff Steps join the rail in M3 (ADR 0007), not before.

**Toolbar (32 px, one line at 1280, always).** Left: "Step 1", "Sheets", the step's Count
("Confirmed 0 / 24"); then the sheet label (DrawingText, cut with an ellipsis before anything else
wraps); then the regions later tickets register (the viewer's switches, 4.6). Right: the keyboard
button (`?`). At 1280 the order of giving way is: the sheet title shortens first, then the step name
hides behind its number, never the switches.

**Inspector (320 px).** Tabs "Selection" and "Questions" with the open count in an amber chip. Panels
that open over the canvas elsewhere (Coverage, the font list) open **in the inspector** instead,
replacing its content until Esc (ux-critic #14: the Coverage popover covered the Confirm button at
1280).

**Status bar (24 px, canvas screens only), left to right.** Cursor "X 42′-7½″  Y 18′-3″" (coordinate
kind; "X —  Y —" off the sheet); the stated scale ("1:100, as stated", or "Not to scale"); "Imperial"
(the name of the project's Display Units, a unit system its Market offers, 1.9); then on the right
Coverage and the save state: "All changes saved" /
"Saving…" / "Not saved: the connection dropped. Trying again." `?perf` readouts sit at the far right
(1.6).

**States.**
| State | What shows |
|---|---|
| First load | Top bar at once; the region below as Skeleton with "Opening Kadam Residence…" |
| Signed out while working | Dialog: "You were signed out. Sign in again to carry on; nothing you confirmed is lost." [Sign in] |
| Access ended (Vextrus Engineer) | Full page: "Your access to Shapla Homes Ltd has ended. Kamal Uddin revoked it on 26 Sep 2026. What you did before then is kept under your name." [Choose another Developer] [Sign out]. Expired: "…ended on 26 Oct 2026. Ask Shapla Homes Ltd to renew it." |
| No access to anything | "You have no access to any Developer at the moment. Ask your MD, or Vextrus, for an invitation." [Sign out] |
| Server unreachable | ErrorBar under the top bar: "Vextrus can't be reached. Check your connection; this page keeps trying." |
| Page not found | Empty: "There is nothing at this address. It may have been a link to another Developer's project, or to a project you have not been given." [Your projects] (the second clause added in session 02 for members given chosen projects, 1.4) |

**Keys registered:** `?`, `Ctrl K`, `Esc`, `F6`, `Shift F6`, the list primitive's keys.

**Design gate on this screen.** Toolbar on one line at 1280 with the longest seeded sheet title;
canvas width share ≥ 70% with the inspector open at both sizes; only Takeoff and Drawing Set in the
top bar; the `?` overlay lists every active key and each one works; the key-registry duplicate test
is green; focus ring visible on every control; phone notice at 390 px; narrow notice at 1100 px;
no `?perf` readout without the flag; no building picker (1.10); `lang="en"` and `dir="ltr"` on the page
from the language's data (1.8).

### 4.2 Sign-in (ticket 20; auth by 07)

**Purpose.** Email and password in, to the user's Developer's projects and no one else's (story 1).
Wireframes: `sign-in-1440.svg`, `sign-in-1280.svg`.

**Layout.** A 360 px card centred on the grey background: brand, "Sign in", Email, Password, the
primary "Sign in" (full width, 32 px), and under it "Forgot your password? Ask your MD, or Vextrus,
to set a new one." (M0 has no email; M5 brings a reset link.)

**States and wording.**
| State | Wording |
|---|---|
| Empty field on submit | Under the field: "Enter your email." / "Enter your password." |
| Wrong email or password | ErrorBar above the button: "That email and password don't match an account. Check them and try again." (never says which one was wrong) |
| Signing in | The button shows its spinner and "Signing in…"; fields locked |
| Invitation link opened | Title "Join Shapla Homes Ltd"; line "Kamal Uddin invited you as a Vextrus Engineer until 26 Oct 2026."; for a new user, Name and a Password with "At least 12 characters"; button "Join" |
| Invitation used, withdrawn or expired | "This invitation can no longer be used. Ask Shapla Homes Ltd for a new one." |
| After sign-in | One Membership: `/projects`. Several: a list "Which Developer?" with each Developer and the role in it |

**Keys.** Enter submits; Tab order Email → Password → Sign in.

**Design gate.** Both sizes and 390 px; the wrong-password message never names the field; the page
title is "Sign in · Vextrus".

### 4.3 Projects (ticket 20; data by 08)

**Purpose.** The Developer's projects in one list, only those the member may open; create one
(stories 2–4, 56, 99, 102). Wireframes: `projects-1440.svg`, `projects-1280.svg`.

**Layout.** Page header: "Projects" (text-xl) with "3 projects at Shapla Homes Ltd" under it (for a
member given chosen projects: "2 projects at Shapla Homes Ltd are open to you"); on the
right "Members and access" (ghost) and "New project" (primary; absent for the MD). The table (28 px
rows): Code · Name · Address · Drawing Set · Takeoff · Updated.

| Column | Content |
|---|---|
| Drawing Set | "No drawings yet" / "Reading 1 file, sheet 7 of 12" / "5 files read, 1 set aside" |
| Takeoff | "Not started" / "Step 1: 5 Questions open" / "Step 1 confirmed" |
| Updated | date |

**New project dialog.** Title "New project". Fields: Name (required), Code (required, unique in the
Developer: "Short, like KR-01"), Address, Display Units (segmented "Imperial (cft, sft, rft)" |
"Metric", Imperial chosen, with the line "How quantities will be billed. You can change it later.").
The Display Units offered and the one chosen are the Market's (1.9); for Bangladesh they are exactly
these. No Market, currency or Building field (1.9, 1.10). Buttons "Create project" and "Cancel".
Errors under fields: "Give the project a name." / "Give it a short code, like KR-01." / "KR-01 is
already used by Kadam Residence. Choose another code." Creating the project also makes its Site and
one Building, unseen (1.10). After create: straight to its Drawing Set (empty state).

**States.** Loading: five Skeleton rows. Empty: glyph, "No projects yet. Create one for each
development whose drawings you will take off." [New project] (MD: "No projects yet. Your QS creates
them."). *(Session 02: "each building" became "each development", since a Project may hold several
Buildings, ADR 0036.)*

**Keys.** List keys (`↑ ↓ Home End`, `Enter` opens).

**Design gate.** The empty, loading and seeded states; MD sees no create button; codes and dates
formatted; a second Developer's projects never appear (the isolation test is the API's, the walk
repeats it); a member given one project sees only it, and another project's address shows "Page not
found"; no Market or Building field or column.

### 4.4 Members and access (ticket 20; data by 07)

**Purpose.** Who can open this Developer's projects, and which; invite; see and end Vextrus access
(stories 58–62, 64, 101; finish line step 10). Wireframes: `members-1440.svg`, `members-1280.svg`
(drawn before session 02: no Projects column, and no Until column for people).

**Layout.** Header "Members and access" / "Who can open Shapla Homes Ltd's projects", "Invite" on
the right. Three sections, each a table:
1. **People at Shapla Homes Ltd:** Name · Email · Role · Projects · Since · Until. Projects reads
   "All projects" or the codes ("KR-01, BP-02"); Until reads "—" when the access has no end date.
   Someone from outside the Developer (a consultant's engineer, a contractor's QS) is listed here
   too, invited like anyone else (session 02 Q11, ADR 0034).
2. **Vextrus access**, with the line "Vextrus sees your data only while an invitation below is
   current. You can end it at any time.": Vextrus Engineer · Invited by · Projects · From · Until · Acts · actions
   "Renew 30 days" and "Revoke". "Acts" reads "12 acts, last 26 Sep 2026" and opens, in a side panel,
   the Engineer's acts from the event log in words, newest first ("Confirmed S-07 back in, excluded
   before as superseded · Kadam Residence · 26 Sep 2026, 15:42"). Ended access stays listed, muted:
   "Revoked by Kamal Uddin, 26 Sep 2026" or "Ended 26 Oct 2026".
3. **Invitations not used yet:** Email · Role · Projects · Link works until · "Copy link", "Withdraw".

**Invite dialog.** "Invite someone to Shapla Homes Ltd". Email; Role (QS | MD | Vextrus Engineer,
as allowed for the inviter); **Projects** (session 02 Q11): segmented "All projects" | "Chosen
projects", All chosen, and with "Chosen projects" a checklist of the projects by code and name (a QS
inviting sees only the projects the QS may open); for a Vextrus Engineer, "Access ends on" (required,
30 days ahead by default: "26 Oct 2026 (30 days)"); for anyone else, the checkbox "End their access
on a date", off by default, with the line "For someone from outside Shapla Homes Ltd, such as a
consultant's engineer, set an end date." "Create link". Then: "Copy this link and send it to Arif
Rahman. It works once, until 3 Oct 2026." [Copy link] → toast "Link copied". With "Chosen projects"
and none ticked, under the list: "Choose at least one project."

**Wording of acts.**
| Act | Wording |
|---|---|
| Revoke confirm | Dialog: "End Arif Rahman's access now? Their next click is refused. What they did stays under their name." [End access] [Cancel] |
| Revoked | Toast: "Arif Rahman's access has ended." |
| Renewed | Toast: "Arif Rahman's access now ends on 25 Nov 2026." |
| Withdrawn | Toast: "Invitation withdrawn. The link no longer works." |
| Email already a member | Under the field: "rumana@shapla-homes.example is already a member." |

**States.** Loading: Skeleton rows per section. No Vextrus access: "No one from Vextrus has access."
QS view: the same page; the QS's Invite offers only Vextrus Engineer (open question 2), only the
projects the QS may open, and without Revoke on access
the MD created (open question 2). Vextrus Engineer: the people section only.

**Design gate.** Finish line step 10 on the seed: invite, sign in as the Engineer, act, see the act
listed here under their name, revoke, the Engineer's next request refused with 4.1's wording; then
sign in as the seed's outside member given one project (7) and see only that project, its end date
in the AccessChip.

### 4.5 The Drawing Set (ticket 20; data by 14, the job by 09 and 21)

**Purpose.** Add the Drawing Set's files, watch them read, stop or restart one, and read what
Vextrus found about each file, in a QS's words (stories 6–20). **Sheets do not live here; they live
in Step 1** (ux-critic #13): this page lists files and their reports. Wireframes:
`drawing-set-1440.svg` and `-1280.svg` (a file's report open), `drawing-set-empty-1440.svg` and
`-1280.svg`.

**Layout.** Header "Drawing Set" with a one-line summary ("7 files: 21 sheets read, 1 file reading,
1 set aside, 1 refused") and "Add files" (primary). Under it a 36 px dashed drop strip "Drop DWG and
PDF files here to add them, or choose files." The whole page accepts a drop, showing an overlay
"Drop to add to Kadam Residence's Drawing Set". The file table (28 px rows): File · Discipline ·
Status · Sheets found. A DWG's PDF sits under it once its pages match its sheets. Selecting a row
(click or `Enter`) opens the file's report in a 480 px docked panel on the right; the table keeps at
least 752 px at 1280.

**Discipline** defaults from the file (spec amendment 8; proposed from the sheet numbers' prefix and
the file name), shown as a quiet select the QS may change on the row; Step 1 starts from it. Its
options (session 02, ADR 0040): Structural, Architectural, Electrical, Plumbing and sanitary, Fire,
Other MEP.

**The file's life, and its exact wording.** The Status cell holds the words and, while moving, a
3 px progress line; the report panel's header repeats them.

| State | Status cell | Actions on the row |
|---|---|---|
| Uploading | "Uploading, 42%" | "Cancel upload" |
| Upload stopped | "Upload stopped: the connection dropped." | "Try again" |
| Waiting | "Waiting to be read (2 files ahead)" / "Waiting to be read (next)" | "Cancel reading" |
| Reading a DWG | "Opening the file" → "Reading the drawing" → "Checking it with a second reader" → "Finding the sheets" → "Reading sheet 12 of 38" → "Finishing" | "Cancel reading" |
| Reading a PDF | "Opening the PDF" → "Reading page 12 of 57" → "Matching pages to sheets" | "Cancel reading" |
| Time left | Appended once 3 sheets are done and the rate is steady: ", about 3 min left" (the report panel always shows it) | |
| Stopping | "Stopping…" | |
| Cancelled | "Cancelled by Nusrat Jahan, 26 Sep 2026. Nothing from it is in the sheet list." | "Read again" |
| Interrupted, retrying | "Reading was interrupted. Trying again by itself (try 2 of 3)." | "Cancel reading" |
| Failed | "Could not be read after 3 tries. The file is kept." | "Try again", "Mark for Vextrus" |
| Old AutoCAD version | "Saved by a version of AutoCAD that Vextrus cannot read yet. Save it from AutoCAD as a 2018 DWG and add it again." | |
| Read, readers agree | "Read. Two readers agree" | "Open in Step 1" |
| Read, with flags | "Read. Two readers agree. 1 flag: Bangla text" | "Open in Step 1" |
| Set aside | "Set aside: the two readers disagree, so it may be misread" (amber, Question glyph) | "Open the Question" |
| MEP | *(Row removed in session 02: an MEP file reads like any other, "Read. Two readers agree", its Discipline in the Discipline column; its sheets are confirmed in Step 1, ADR 0040.)* | |
| PDF matched | "Plot: 11 of 12 pages matched" (+ "; lettering as lines" when so) | |
| PDF before its DWG | "Plot: waiting for its DWG. Its pages are matched when the DWG is read." | |
| Refused scan | "Refused: a scan, not a drawing" (muted, Excluded glyph) | |

Messages that do not make a row (a toast, or an ErrorBar for several files at once):
| Case | Wording |
|---|---|
| The same file again | "KR-STR-R0.dwg is already in this Drawing Set (added 26 Sep 2026 by Nusrat Jahan). Nothing was added." The existing row pulses once |
| Same name, other contents | Added as a new row, with the line "A file with this name is already here. This one is different, so both are kept." |
| Not a DWG or PDF | "site-plan.jpg is not a DWG or a PDF, so it was not added. Vextrus reads DWG and PDF files." |
| A zip | "drawings.zip is a zip file. Unzip it and drop the DWG and PDF files inside." |
| Too large | "KR-ARC-R0.dwg is larger than 500 MB, so it was not added. Tell Vextrus if your drawings need more." (the limit is ticket 14's; the figure here is a placeholder) |
| Several at once | "3 files added; 1 was already here." |

**The report panel for a DWG** (sections in this order, each hidden when it has nothing to say):
- **Header:** the file's name; "Architectural. Added 26 Sep 2026 by Nusrat Jahan"; "Close  Esc".
- **Readers.** Agree: "✓ Read twice, by two independent readers, and they agree. Nothing in the file
  was skipped." Disagree: "The two readers found different contents in this file: one found 212
  more items, on 3 layers. It is set aside, so nothing from it reaches the sheet list while it may be
  misread. Question Q1 asks what to do." [Open the Question]
- **Sheets.** "8 sheets found: 6 laid out in the drawing, 2 on layout tabs." [Open in Step 1]. None:
  "Vextrus found no sheet borders or layout tabs in this file. If it has sheets, mark it for
  Vextrus." [Mark for Vextrus]
- **Bangla text** (the Bangla-ANSI Check): flag, amber: "9 texts on 2 sheets are Bangla typed in an
  old Bijoy-style font (SutonnyMJ). Such fonts store Bangla as Latin letters, so these texts show as
  they do in AutoCAD and Vextrus cannot read them. Nothing else on those sheets is affected. If a
  room name or a note in Bangla matters, ask the consultant to set it in a Unicode Bangla font."
  Then the sheets, each a link into Step 1 ("A-02: 5 texts"). Found by the text's pattern only (no
  font name): "…texts look like Bangla typed in an old font…". None: the section is hidden.
- **Fonts.** "4 fonts named in the drawing. Vextrus cannot use AutoCAD's own fonts, so it draws each
  with a free font of the same shape. Positions, sizes and line breaks are the drawing's own; only the
  letter shapes differ." Table: The drawing asks for · Vextrus draws it with · How close · Sheets.
  "How close" is one of: "Same widths" · "Single-stroke, like the plot" · "A little wider: a line of
  text may run slightly long" · "A little narrower" · "Not found: drawn with Liberation Sans; letters
  may differ" · "Bangla in an old font: see above". Font names are family names without extension;
  AutoCAD's stroke fonts read "Romans (AutoCAD lettering)".
- **Plot.** "Its Plot is KR-ARC-R0.pdf: 8 of 8 sheets have a page." or "No PDF added for these
  sheets. Add the PDFs plotted from this file to compare them with what Vextrus read."

Not shown to the QS (logged for Vextrus, and under `?perf` where timed): the reader names and
versions, the attribute-style repair count, handle counts, read time, peak memory.

**The report panel for a PDF:**
- **Made by.** "Made by AutoCAD's PDF plotter." / "Made by PDF Merge Tool, not AutoCAD: it may have
  been merged or re-saved. Its lines are still the plot's, but a page may not line up exactly with
  its sheet." / "The PDF does not say what made it."
- **Pages.** "12 pages. 2 are turned; Vextrus turns them to match their sheets." Then "11 of 12 pages
  matched to a sheet." and each unmatched page with its reason: "Page 12 shows sheet S-13, which is
  not in any DWG added so far." · "Page 9: its title block could not be read." · "Pages 4 and 5 both
  show S-04; page 5 is used." · "No DWG has been added for these pages yet." Then sheets with no page:
  "S-07 (rev A) has no page in this PDF."
- **Lettering.** Kept: "The AutoCAD lettering is kept as text on every page." Partly: "…on 40 of 57
  pages." Lost: "On 8 pages the lettering is drawn as lines, not text. The Plot still looks right,
  but a machine cannot read that text. If you ask the consultant for a new PDF, ask them to plot with
  AutoCAD's PDFSHX setting at 1 (\"Include SHX text as comments\"), so the lettering stays text."
  (the setting's name and label verified by ticket 12 against Autodesk's documentation first)
- **Layers.** "The drawing's layers are kept in the PDF." / "The layers were flattened: everything
  is on one layer. The Plot is still fine to look at."
- **Pictures.** "No pictures." / "Pictures on 3 pages, covering at most 4% of a page (logos, stamps
  or photos)." / "Page 6 is mostly a picture (88%): it may be a scan."
- **Refused.** "This PDF is a scan: its pages are pictures, with no lines or text to read. Vextrus
  reads drawings, not scans. Ask the Developer or the consultant for the DWG files, or for a PDF
  plotted from AutoCAD." (ADR 0014)

**Page states.**
| State | What shows |
|---|---|
| Empty | The drop strip becomes a 300 px dashed area: "No drawings yet." / "Drop the Drawing Set's DWG files here, with the PDFs plotted from them if you have them." [Choose files] / "Vextrus reads DWG and PDF files. Scanned drawings cannot be read." |
| Loading | Header, then four Skeleton rows |
| Dragging over | The overlay above |
| MD | No drop strip, no "Add files", no Cancel or Read again; ReadOnlyChip in the header; reports readable |
| A file set aside | Its row stays in the table; the summary line counts it ("1 set aside"); Step 1 shows its Question first (section 5) |

**Keys.** List keys; `Enter` opens the report; `Esc` closes it. No single-letter keys on this page.

**Design gate.** Every row state above reachable on the seed (section 7); the report's wording
verbatim; no engineering word, font extension or path in the DOM; Cancel then Read again on a
reading file; dropping a file twice adds nothing; the table ≥ 752 px with the report open at 1280.

### 4.6 The sheet viewer (ticket 16)

**Purpose.** A sheet as the consultant plotted it, with the consultant's own PDF page one key away,
fast enough to page through a whole Discipline (stories 44–55; screens.md rulings 1–6 for the sheet).
In M0 the viewer is the canvas of Step 1; ticket 16 builds it in `web/src/sheet/` against a
development-only harness route (`/dev/sheet/:id`, absent from production builds) until ticket 22
mounts it. Wireframes: `sheet-viewer-1440.svg`, `sheet-viewer-1280.svg`.

**What the viewer is given** (so 16 does not depend on 17 or 21, ux-critic #3): the sheet's buffers,
its paper extents, an optional **working view box** (Step 1 passes the sheet's main view with its
title), its views (boxes, kinds, titles, stated scales, statuses), and its Plot or the reason there
is none.

**Toolbar items it registers (left to right, after the sheet label):** "‹ ›" (previous and next,
`[ ]`); the segmented "Paper | CAD-dark" (`D`); the segmented "Engine | Plot | Compare" (`P`;
ruling 4: opens on Engine; see open question 4 on the label); "Fit" (`F`); "Zoom to view" (`Z`,
disabled with no view selected); "Outlines" (`O`, pressed by default). Every tool button has a
tooltip with its key.

**On the canvas.**
- **Fixed left to right:** the canvas, its chips, legend and scale bar carry `dir="ltr"` and are never
  mirrored, whatever the page's direction (1.8, ADR 0038).
- **Paper (default):** white ground, all linework black at its plotted lineweight, fine lines faint
  by lineweight as plotted (ruling 2). **CAD-dark:** ground #101318, AutoCAD's layer colours.
- **Opening a sheet:** fitted to the working view box, else the whole paper with a 2% margin; the fit
  area leaves 44 px at the top for the legend and 72 px at the foot for the Confirmation bar. A sheet
  never opens as a speck: if the paper would fill less than 40% of the canvas width, it fits the
  paper's used extents instead.
- **Text** under 6 px at the current zoom is drawn as grey bars; all text is decoded (1.3).
- **View outlines** sit 2 px outside the view (ruling 3), no casing on Paper, a dark casing on
  CAD-dark: dashed cyan for a Proposal, solid green for Confirmed, an amber revision cloud with its
  tag ("Q3") for a Question, a grey hairline with the Excluded glyph for Excluded. Each carries a chip
  inside its top-left corner, "Plan · GROUND FLOOR BEAM LAYOUT · 1:100" or "Detail · TIE DETAIL · not
  to scale", hidden when the outline is under 80 px wide and shown on hover.
- **Hover** over an outline: the indigo halo and a tooltip "Plan: GROUND FLOOR BEAM LAYOUT · 1:100 ·
  assigned to Step 7, Beams". No hover on linework in M0 (picking is M1), and never an entity type,
  layer code or handle.
- **Legend strip** (top-left; Step 1 only): "Proposal 3 · Confirmed 0 · Question 1 · Excluded 0", each
  with its glyph, counting this sheet's views.
- **Scale bar** (top-right): the stated scale of the selected view, else of the working view:
  "0–10′  1:100, as stated"; "Not to scale" for a not-to-scale view; hidden when nothing is stated.
  Never a zoom factor.

**The Plot.**
| State | What shows |
|---|---|
| Engine | The engine's own drawing |
| Plot | The PDF page registered beneath; the engine's linework hidden; view outlines stay |
| Compare | The engine's linework in red (#D0342C, 55%) over the Plot in black; on CAD-dark, the Plot inverted and the engine in orange |
| Loading the Plot | The segment shows a small spinner; the line "Loading the Plot…" top-right |
| No PDF | Plot and Compare disabled; `P` shows the note "No Plot for this sheet: no PDF has been added for Structural." |
| Page not matched | "No Plot for this sheet: no page of KR-STR-R0.pdf matched it." |
| PDF refused | "No Plot for this sheet: its PDF was a scan and was refused." |
| Poor fit | On Plot and Compare: "The Plot is off by up to 6 mm on paper here. Use it to compare, not to measure." (the threshold is ticket 18's) |

**Status bar items it registers:** the cursor in ft-in (model-space sheets: the drawing's own
coordinates; layout tabs: see "not settled"), isolated left to right (1.8); the stated scale under
the cursor's view.

**Fonts on this sheet.** A "Fonts" item in the toolbar's overflow opens, in the inspector, "Fonts on
this sheet": the rows of the file's font report that this sheet uses, with a link "Font report for
KR-ARC-R0.dwg" to the Drawing Set.

**States.**
| State | What shows |
|---|---|
| First open of a sheet | The paper outline at its fit at once, Skeleton shimmer inside, and top-right "Opening S-04 for the first time…" |
| Opened before | Drawn from the browser's cache; no line (budget ≤ 1.5 s to interactive, ADR 0022) |
| Could not be drawn | ErrorBar in the canvas: "S-04 could not be drawn. The other sheets are not affected." [Try again] |
| From a file still reading | "S-04's file is still being read. It opens when reading reaches it." |
| From a file set aside | Not openable; the list shows why (section 5) |
| MD | Identical; no Confirmation bar |

**Performance** (1.6): behind `?perf` only.

**Design gate.** On the seed at both sizes: every sheet opens fitted and legible, never a speck; `D`,
`P` (including every no-Plot reason), `F`, `Shift F`, `Z`, `O`, `[ ]` work; no `%%` or `\` code in
the DOM or on the canvas's text runs; no perf readout without the flag; the canvas carries
`dir="ltr"`. **Before 16 merges, a
`local` walk on a real Development Set:** every sheet's first open is checked by eye; "no sheet
opens looking empty" (screens.md, "How M0's screens keep this quality" 5).

### 4.7 Step 1's shell (frame by 03; filled by 22)

**Purpose.** The canvas screen Step 1 lives in. Its frame is settled (4.1); what fills its list,
canvas foot and inspector is section 6 (layout A). Wireframes: `step1-shell-1440.svg`,
`step1-shell-1280.svg` (drawn before the prototype: their inspector is marked pending and their
switch says "Engine"; `step1-list-*`, `step1-sheet-*` and `step1-question-1280.svg` supersede them,
with "As read").

**Settled.**
- Toolbar: "Step 1", "Sheets", "Confirmed 0 / 24" (sheets confirmed or excluded / sheets found;
  per-Discipline N from the drawing list or the Plot sits in the list, section 5), the sheet label and
  the viewer's switches.
- The Confirmation bar floats at the canvas foot, 44 px, at most 720 px wide, centred: what ("20
  sheets agree: Structural, Architectural, Electrical"), why ("Read from their title blocks; 1 left
  out as 3D or perspective"), "Review one by one" (ghost), and the screen's one copper button
  "Confirm 19, leave out 1 ↵" (6.4's wording). *(Session 02: the example's 3 MEP sheets were
  excluded; now they are confirmed, ADR 0040.)*
- Status bar Coverage (story 43): "Coverage: 70 views — 52 assigned, 16 excluded, 2 unaccounted";
  "unaccounted" in amber while above 0; clicking opens Coverage in the inspector.
- Step states on the rail: Question glyph while any Question is open; Confirmed when every sheet is
  confirmed or excluded and every file is read or cancelled (story 36).

**States that do not depend on layout.**
| State | What shows |
|---|---|
| No files | Canvas empty state: "No sheets yet. Add the Drawing Set's files first." [Go to the Drawing Set] |
| Files still reading | Sheets from read files are workable; a row above the list: "Still reading KR-ELE-R0.dwg: sheet 2 of 3. Its sheets join the list when it is read." Step 1 cannot show confirmed until it is done |
| A file set aside | Its Question heads the Questions (section 5); its sheets are not in the list or the counts |
| All confirmed | The bar: "Every sheet is confirmed or excluded: 22 in, 2 excluded." (no button) |
| MD | ReadOnlyChip in the toolbar; no Confirmation bar; Question cards without answer controls, with "The QS answers this."; who confirmed each sheet in the inspector |
| TypeSafe unavailable | Nothing tells the QS about TypeSafe; low-confidence items simply have no pre-pick (story 86) |

---

## 5. Step 1: what is settled regardless of layout

These carry the owner's Takeoff rulings (screens.md 1–5) into Step 1 and answer ux-critic #1, #10,
#11, #12 and #15. The Step 1 prototype may change their placement, not their meaning.

**A Proposal counts toward nothing until you confirm it.** The words appear in the inspector under
an unconfirmed sheet, as in the Takeoff prototype.

**The Question card** (inspector, Questions tab; its cloud and tag on the sheet where it applies):
1. Amber header: cloud glyph, "Question Q2", and on the right "Answer once".
2. **First line: what answering does** (ruling 1, ux-critic #15), updated as the pick changes:
   "Answering confirms 2 sheets." / "Answering excludes S-07 (rev A) as superseded and confirms S-07
   (rev B)." / "Keeps 2 sheets open until the consultant replies." With nothing picked: "Pick an
   answer: 1, 2 or 3."
3. Title in plain words; the body with its figures in their kinds; the Trace line (sheet and place,
   as links).
4. Options as radio rows with their number keys, each naming its source ("Rev B, 20 Aug 2026, as
   the drawing list says"). Never a text box first; "Type a number" is always the last option but one.
5. The last option is always "Keep open, ask the consultant".
6. "Answer Q2 ↵" (primary) and "Ask later" (ghost).

**Pre-pick only when two independent sources agree** (ruling 2), and the card names them. The
sources in Step 1: a title-block attribute or the text in that title block (one source, not two);
the drawing list, on a sheet or pasted by the QS; the Plot page's title block; the file's
Discipline; the sheet number's prefix; the revision mark and date. Jev's answer is one source, and
never counts together with the facts it was given (the title it read).

**The Questions' order** (no money in M0): a file set aside first (it blocks a whole file); then the
Questions holding the most sheets; then conflicts, then missing items, then low-confidence ones; then
sheet order (natural sort: S-2 before S-10). `Q` follows this order.

**The Questions M0 raises, and their wording** (templates; names and numbers invented):
| Kind | Title | Options |
|---|---|---|
| File set aside (`file_misread`) | "KR-STR-old.dwg may be misread" | 1 "I'll re-save it from AutoCAD (open it, run AUDIT, save) and add it again" · 2 "Mark it for Vextrus to look at" · 3 "It isn't needed: leave its sheets out" · 4 "Keep open, ask the consultant" |
| Two sheets, one number (`conflict`) | "Two sheets are numbered S-07" (each with revision mark, date and file) | 1 "Keep rev B (20 Aug 2026); exclude rev A as superseded" · 2 "Keep rev A; exclude rev B" · 3 "They are different sheets: keep both" · 4 "Keep open, ask the consultant" |
| No number (`missing`) | "This sheet has no number in its title block" | 1 "A-08, the next in the drawing list" (only when the list has it) · 2 "Leave it without a number" · 3 "Type a number" · 4 "Keep open, ask the consultant" |
| Sheet kind unclear (`low_confidence`) | "What kind of sheet is A-05?" | the kinds, most likely first, none pre-picked unless a second source agrees · "Keep open, ask the consultant" |
| Drawing list against sheets (Check) | "The drawing list names S-13, but no DWG has it" | 1 "It is missing: ask the consultant (keep open)" · 2 "It was not issued: take it off the count" · 3 "It is in a file I haven't added yet" |
| Plot pages against sheets (Check) | "Page 12 of KR-STR-R0.pdf shows S-13, which no DWG has" | as above |
| Boundary storey (amendment 2) | "Does GROUND FLOOR BEAM LAYOUT mean the members at ground-floor level?" | 1 "Members at floor level" · 2 "The storey, floor to floor" · 3 "Keep open, ask the consultant" |

**Storeys.** A sheet's storeys come from its plan views as an explicit list, never an expanded
first–last (amendment 1): shown as stated and normalised, "3RD, 5TH & 7TH FLOOR → 3rd, 5th, 7th";
"not stated" when the title states none; "typical (range from Step 3)" for an untitled typical floor.

**Exclusion reasons: a fixed pick list** (amendment 9, as session 02 left it), numbered: 1
Superseded · 2 Duplicate · 3 Cover or index · 4 3D or perspective · 5 Reference only · 6 Other (type
why). "MEP" was the first reason until session 02: MEP sheets are now confirmed, and their views
assigned to their Discipline Part, read from M3 (Q29, Q31; ADR 0040). Views excluded by default
(title block, legend, key plan, 3D) carry "Reference only" or "3D or perspective". An excluded sheet
stays in the count with its reason (ruling 4, story 30). Reasons are stored as codes (1.7); an
"Other" reason's text is kept as typed.

**MEP sheets** are proposed and confirmed like any other, under their own Discipline (Electrical,
Plumbing and sanitary, Fire, Other MEP). Their views are proposed as assigned to their Discipline
Part, shown as the Part's name with "M3 onwards" ("Electrical, M3 onwards"), and Coverage counts them
assigned (6.11). Nothing reads their content in M0.

**Undo:** `Ctrl Z` undoes the last Confirmation, answer or exclusion; the toast names what it undid
("Undone: confirmed 20 sheets").

**Who did what** (ux-critic #12): every confirmed or excluded sheet shows "Confirmed by Nusrat
Jahan, 26 Sep 2026" or "Excluded by Arif Rahman (Vextrus), 26 Sep 2026: superseded" in the inspector.

---

## 6. Step 1 on layout A, "List ⇄ Sheet"

The owner judged the Step 1 prototype (private, `.private/work/session-01/proto-step1/`) and chose
layout A, then agreed five more choices (docs/design/screens.md, "Takeoff Step 1"). This section is
the behaviour spec ticket 22 builds to, written from a walk of that prototype on 26 Sep 2026 at
1280×800 and 1440×900 and from its code. **Precedence:** the owner's rulings (screens.md) first, then
sections 1–5 of this page, then the prototype. Where the prototype breaks a ruling or an earlier
section, this section says what to build and 6.17 lists the correction. What the prototype leaves
open is in 6.18, for the owner.

Examples use the prototype's invented set, "Nilachal Tower" (Basement + Ground + Mezzanine + 9 floors;
68 sheets: 40 structural including a duplicated S-19, 28 architectural; four files, one held; eight
Questions). Every UI PR is still walked on the seed (section 7). Measured on the prototype
(screens.md): a clean set's list confirmed in 2 keystrokes (1 once ruling 1 is built), a messy one
(8 Questions) in 14, no clicks; 8–35 ms key to frame, 40–146 ms at 4× CPU slowdown.

Wireframes (invented data, the rulings applied): `step1-list-1440.svg`, `step1-list-1280.svg`,
`step1-sheet-1440.svg`, `step1-sheet-1280.svg`, `step1-question-1280.svg`. Screenshots of the
prototype itself (invented data; they show the prototype's faults listed in 6.17, such as "Engine"
and "model space"): `step1-proto-list-q3-1280.png`, `step1-proto-list-q6-1440.png`,
`step1-proto-sheet-1280.png`, `step1-proto-sheet-1440.png`, `step1-proto-md-confirmed-1280.png`,
`step1-proto-reading-1280.png`.

### 6.1 The two modes
- **List mode** (Step 1 opens in it): the sheet list fills the whole canvas region (912 px wide at
  1280, 1072 px at 1440), under the toolbar, with the rail and the 320 px inspector unchanged. The
  Confirmation bar floats at its foot over a white fade.
- **Sheet mode:** the focused sheet fills the same region (912 × 704 px at 1280×800, 1072 × 804 at
  1440×900; 71 % and 74 % of the width), with the viewer of 4.6 and the bar at its foot. The list is
  not visible; the inspector still shows the sheet's facts.
- **Between them:** `Space` opens the focused sheet (with nothing focused, the first sheet row) and
  goes back; `Esc` returns to the list from a sheet (after first leaving a selected view); a
  double-click on a row opens it; the toolbar's segmented "List | Sheet" does the same by mouse.
  Focus and the selected row survive the switch, so the list scrolls back to where the QS was.
- `↑ ↓` move through rows in list mode and through sheets (sheet rows only, in list order) in sheet
  mode, so paging works in both.

### 6.2 List mode: rows and columns
Rows are 28 px; a sticky 28 px header, then sticky 26 px section headings.

Above the header, **the files band**: one chip per file, clickable to open that file's report (4.5's
wording, shown in the inspector as other panels are, 4.1): "✓ NT-STR-R1.dwg 40 sheets, two readers
agree"; "✓ NT-STR-R1.pdf Plot for 37 of 38 pages"; "✓ NT-ARCH-R1.dwg 28 sheets, two readers agree"
with an amber "Bangla font" mark when the Bangla-ANSI Check flagged it; a held file as an amber chip
"NT-ARCH-Details-R1.dwg held"; a reading file with a spinner and "reading sheet 14 of 28". It wraps
to a second line at 1280 and 1440.

| Column | 1280 (list 912 px) | 1440 (list 1072 px) | Content |
|---|---|---|---|
| (mark) | 24 | 24 | The status glyph: Proposal, Confirmed, Question, Excluded (3) |
| Number | 62 | 62 | Bold. A sheet with no number shows "none" in amber |
| Title, as drawn | the rest (about 260) | the rest (about 260) | DrawingText (3), cut with an ellipsis, tooltip with the full title |
| Discipline | 78 | 78 | "Structural"; tooltip "Structural, from the file NT-STR-R1.dwg". From session 02 also "Electrical", "Plumbing" (tooltip "Plumbing and sanitary, …"), "Fire", "Other MEP" |
| Revision and date | 106 | 106 | "R1, 14 Sep 2026"; the older copy of a duplicated number in amber |
| Storeys | 180, headed "Storeys per view" | 232, headed with the strip's key: "▮ floor to floor  ▁ at floor level" | The storey strip (6.8) and the storeys as text: "3rd, 5th, 7th"; "not stated" and "typical (range from Step 3)" in amber; "—" for a sheet with no plan view |
| Views | 40 | 40 | The number of views, title block included |
| File | not shown | 104 | The source file; tooltip adds where in it ("laid out in the drawing", "layout "A-24"") |
| State | 150 | 150 | "Proposal" (", corrected" after an edit) · "Question Q3" · "Q3 kept open" · "Leave out, cover or index" · "Confirmed" with the actor's initials chip ("RH"; a Vextrus Engineer's chip reads "TA Vextrus") · "Excluded, superseded" |

The file column appears when the list is at least 1000 px wide. An excluded sheet's number is struck
through, its title and strip muted. Rows that are not sheets use the same height: a held file
("File · NT-ARCH-Details-R1.dwg Held: the two readers disagree · Question Q1"); a drawing-list entry
with no sheet ("A-28 · Facade lighting details · Question Q2", after its answer "missing, in the
count"); while a file reads, one skeleton row per sheet still to come, with "reading…" in the State
column.

### 6.3 Grouping and order
Sections, top to bottom:
1. **Needs you** (amber band): "8 Questions open, in the order Enter takes them"; one row per row an
   open Question holds, Questions in the queue order below. A Question's rows leave the section when
   it is answered.
2. **Proposed to leave out:** "Excluded sheets stay in the count with their reason"; sheets Vextrus
   proposes to exclude (3D or perspective, cover or index), each with its reason.
3. **Each Discipline in turn,** Structural, then Architectural, then each MEP Discipline present
   (Electrical, Plumbing and sanitary, Fire, Other MEP), in the Takeoff's order (ADR 0040). MEP sheets
   are confirmed like the rest (session 02; before it they arrived as proposed exclusions). The
   heading "Structural 40 found, 39 on the drawing list on S-01 | 0 / 40 settled"
   ("settled" = confirmed or excluded); for a pasted list, "28 found, 29 on the pasted drawing list"
   and at the heading's right the link "Paste the drawing list" or "The pasted drawing list" (6.10).
   Inside, sheets in natural order of their numbers (S-2 before S-10; a sheet with no number last;
   of two copies of one number, the later revision first); a held file whose Question is answered
   heads its Discipline; drawing-list entries with no sheet close it.

**The queue Enter walks** (and `Q` follows, and the inspector's overview lists): first the bulk act
(6.4), then the Questions: the held file; the count (the drawing list or Plot against the sheets);
numbers (two sheets one number, no number); storeys (boundary storey, floors that do not run, the
typical floor, a level title). The inspector words it "Answer 8 Questions: the files and the count
first, then numbers, then storeys". (Section 5's rule orders by sheets held, then kind; see 6.18.)

### 6.4 The Confirmation bar and what Enter does
The bar is 44 px, centred at the canvas foot: a glyph, "what" on the first line, "why" on the second,
actions on the right; one copper button at most. It always says what `Enter` will do.

**Ruling 1: proposed exclusions join the bulk Confirmation.** With nothing focused, or with focus on
any agreeing sheet or proposed exclusion, the bar reads:
- what: "Confirm 56 sheets that agree, and leave out 5 as 3D or perspective, cover or index"
  (the reasons named, each once; ", S-04 among them" is added when the focused sheet is one of them);
- why: "Each has a number and title from its title block and is on its drawing list; storeys from its
  view titles. Left-out sheets stay in the count with their reason.";
- button: "Confirm 56, leave out 5 ↵"; in list mode with a sheet focused, also the ghost "Open S-04
  Space".

`Enter` confirms and excludes them in one act; the toast reads "Confirmed 56 sheets; left out 5, each
with its reason." with "Undo  Ctrl Z", and one undo reverses both. A clean set therefore confirms in
one key. (The prototype still takes two: a "Confirm 56" act, then "Leave out 5"; this wording was
not prototyped, 6.18.) While a file is still reading: why = "NT-ARCH-R1.dwg is still reading (13 of
28); confirm its sheets when they arrive".

**Other bar states** (list mode, by what is focused):
| Focus | What · why | Button |
|---|---|---|
| A Question's row | "Question Q3: Two sheets are numbered S-19" · the card's first line (6.7) | "Answer Q3 ↵"; with nothing picked, disabled and showing "Pick an answer 1 2 3" |
| A Question kept open | "Question Q5 is kept open for the consultant" · "Its sheets are not read until it is answered. Pick another answer in the card to settle it." | ghost "Next open Question Q" |
| A confirmed sheet | "S-20 is confirmed by Rafiq Hasan" (", Vextrus Engineer" after an Engineer's name) · "26 Sep 2026, 10:42. X excludes it, with a reason." | "Next open item ↵" |
| An excluded sheet | "S-19 is excluded: superseded" · "By Rafiq Hasan, 26 Sep 2026, 10:50. It stays in the count." | "Confirm back in ↵" |
| A row with nothing to act on | e.g. "On the drawing list, in no file. It stays in the count." · "Nothing to confirm here." | none |
| Nothing left, files reading | "Reading NT-ARCH-R1.dwg: sheet 14 of 28" · "Its sheets join the list as they are read." | none |
| Nothing left, Questions kept open | "2 Questions kept open for the consultant: Q5, Q7" · "Step 1 is confirmed once they are answered." | ghost "Next open Question Q" |
| Nothing left, Coverage not complete | "Coverage has a view that is neither assigned nor excluded" · "Open Coverage on the status bar to find it." | none |
| Step 1 confirmed | "Step 1 is confirmed: every sheet is confirmed or excluded, and Coverage has none unaccounted" · "Step 2, General notes and specification, comes in M1." | none |

After an act in list mode, focus moves to the first row of the next item in the queue. `Enter` on a
row with nothing to act on, a confirmed sheet or a kept Question does the queue's next item.
Answering with nothing picked shows the toast "Pick an answer to Q2 first: 1, 2, 3".

The bar is as wide as the prototype's: the canvas less 32 px, at most 820 px in list mode and 800 px
in sheet mode (4.7 said at most 720 px; 6.18). The toast sits just above it.

### 6.5 Sheet mode
- **Opening:** fitted to the working view (the plan with its title; several plans of one kind side by
  side are fitted together, never one of three), with 4.6's insets (the legend above, 72 px for the
  bar below) and 4.6's first-open state.
- **Toolbar:** "Step 1  Sheets  Confirmed 1 / 68, 1 excluded", then the sheet label as a button
  ("S-20 8th & 9th floor beam layout ▾", at most 250 px, cut first) that opens the sheet picker
  ("Sheets, in list order", grouped as the list), then "‹ ›"; on the right "List | Sheet", then the
  viewer's switches (6.14) and the keys button.
- **On the canvas:** 4.6's legend, but counting views as "Proposal 2 · Assigned 0 · Question 0 ·
  Excluded 0" (a view on a confirmed sheet is assigned, 6.11); the outlines of 4.6, with the tag
  "Plan, 1:100" or "Detail, not to scale" above each outline's top-left corner; a view held by an
  open Question is drawn with the amber revision cloud. Clicking an outline selects the view; `→ ←`
  step through the sheet's views in reading order and fly to each (the view padded to about 3×,
  screens.md sheet ruling 1); `Esc` fits back to the working view; past the last view, no view is
  selected.
- **The bar (ruling 5): Enter confirms the sheet and opens the next one needing the QS.** For an
  agreeing sheet: "S-20 agrees: number and title from the title block, on the drawing list" · "3 views;
  storeys 8th, 9th. Enter confirms it and opens the next open sheet." with the ghost "Confirm all 56
  that agree" (the bulk act of 6.4, by mouse) and "Confirm S-20 ↵". For a proposed exclusion: "Leave
  out S-39: 3D or perspective" · "It stays in the count with its reason. X picks another reason." ·
  "Leave out S-39 ↵". For a sheet a Question holds: that Question's bar. After the act, the next
  sheet in list order that is still a Proposal (wrapping to the top; skipping sheets whose Question
  is kept open) opens, and the toast names the act ("Confirmed S-20.", "Q3 answered. Confirms S-19 R1
  and excludes R0 as superseded.").

### 6.6 The inspector (320 px; tabs "Selection" and "Questions" with the open count)
**Selection, nothing focused: the overview.** "Nilachal Tower's sheets" / "Read from 2 DWG files; 1
file held." / "Enter takes them in this order": 1 "Confirm the 56 sheets that agree and leave out 5:
3D or perspective, cover or index"; 2 "Answer 8 Questions: the files and the count first, then
numbers, then storeys" / "↓ walks the list; Space opens a sheet; a Proposal counts toward nothing
until you confirm it." / "Expected sheets": "Structural: 39 on the drawing list on S-01; 40 found."
"Architectural: 29 on the drawing list pasted by Rafiq Hasan, 26 Sep 2026 09:58; 28 found (see the
list)." With nothing waiting: "Nothing is waiting."

**Selection, a sheet focused,** top to bottom:
1. The Question card holding it, if any (6.7).
2. Header: number and title; the state and when ("Confirmed RH 26 Sep 2026, 10:42"). In list mode
   only, a 294 px thumbnail of the sheet with its view outlines.
3. **Proposal**, "where each was read": Number ("S-20 title-block attribute" / "text in the title
   block" / "not found"); Title (the same); Discipline ("Structural from the file; the prefix
   agrees"); Revision ("R1, 14 Sep 2026"); File ("NT-STR-R1.dwg" / "laid out in the drawing" or
   "layout "A-24""); Storeys (text, meaning, strip); Plot ("NT-STR-R1.pdf page 20, registered to
   0.2 mm", or "None: " and the reason, 6.13); the Bangla note where flagged (6.13).
4. **Views** (their count), "→ walks them; A assigns; X excludes": per view its mark, kind ("Plan",
   "Detail inside the plan"), title, stated scale or "not to scale"; under it the storeys and meaning
   ("8th, at floor level"), then a chip per assigned step ("7 Beams") or "excluded: reference only" or
   amber "no step: unaccounted", and "proposed" until the sheet is confirmed. A selected view shows
   the buttons "Assign steps A" and "Exclude X".
5. **Who did what:** every act on the sheet, oldest first, each "what" over "name, role, time" with the
   initials chip: "Confirmed in bulk with 55 other sheets / Rafiq Hasan, QS, 26 Sep 2026, 10:42";
   "Excluded: reference only"; "Confirmed back in: Step 14 reads the driveway and boundary for external
   works / Tanvir Ahmed, Vextrus Engineer, 26 Sep 2026, 11:20". None yet: "Proposed by Vextrus from
   the file; no one has acted on it yet."
6. Actions (not for the MD): "Correct E", and "Exclude X" or, for an excluded sheet, "Confirm back in".

**Selection, a file or drawing-list row focused:** its Question card; for a held file, "Open the
file's report".

**Questions tab:** every open or kept Question's card in queue order (a click on "Question Q3" in a
card's header focuses its row), then "Answered": one line each, "Q3 Keep R1 (14 Sep 2026); leave R0
out as superseded. Rafiq Hasan, 26 Sep 2026, 10:50". None open: "No open Questions."

### 6.7 Questions
**The card** (as 5, with these details): amber header "Question Q3", the kind in words ("Two sheets,
one number"), and "Answer once" (or "Kept open"); **first, what answering does** in a grey band,
updated as the pick changes; with nothing picked, what it settles and "Pick an answer: 1, 2, 3." (a
Question holding no sheet: "Answering confirms no sheets. Pick an answer: 1, 2, 3."); the title; the
body; for a duplicate, a table of the copies; the Trace line; the options as radio rows with their
number keys; "Answer Q3 ↵" and "Ask later" (moves to the next open Question). **Pre-pick only when
two or more independent sources agree** (screens.md Takeoff ruling 2, and 5's list of sources); the
pre-picked option carries "Picked for you:" and the agreeing sources. A pick changes nothing until
Enter or "Answer". Answering records who and when and confirms or excludes what the Question held.
"Keep open, ask the consultant" keeps the Question (state "Q5 kept open", card "Kept open"); its
sheets stay unread, and Step 1 cannot be confirmed while any Question is open or kept.

The eight Questions of the prototype's messy set (the seed's Questions, section 7, follow the same
templates):
| Kind (header) | Title | Body and Trace | Options (pre-pick) | First line after the pick |
|---|---|---|---|---|
| This file may be misread (`file_misread`) | "NT-ARCH-Details-R1.dwg may be misread" | "Two readers read the file and disagree: one found 312 more items, all on one layer. Nothing from this file enters the sheet list until it reads cleanly." Trace: the file, and the two readers' counts in words | 1 "Re-save it in AutoCAD (Save As, AutoCAD 2018 DWG) and upload it again" · 2 "Send it to Vextrus to check" · 3 "Leave it out: its sheets are not part of this Takeoff" (none pre-picked; ruling 3 asks for "read anyway" and "set this file aside", 6.18) | 1, 2: "Answering confirms no sheets. The file stays held until it reads cleanly." · 3: "Answering records the file as left out (other: may be misread). It confirms no sheets." |
| On the drawing list, in no file (Check) | "A-28 is on the drawing list but in no file" | "The drawing list you pasted names 29 architectural sheets. 28 were found in NT-ARCH-R1.dwg; A-28 Facade lighting details was not." Trace: "Pasted drawing list, line 30: "A-28 FACADE LIGHTING DETAILS"". Raised only once every file is read | 1 "Not sent yet: keep it in the count and ask the consultant" · 2 "Not part of this set: take it off the list" · 3 "It is in another file: I will upload it" (none) | 2: "Answering takes A-28 off the list: 28 sheets expected." · 1, 3: "Answering keeps A-28 in the count as missing. Step 1 can still be confirmed." |
| Two sheets, one number (`conflict`) | "Two sheets are numbered S-19" | "Both are titled "4th & 6th floor beam layout". Only one can be read." A table: Copy · Date · File, where: "R1 · 14 Sep 2026 · NT-STR-R1.dwg, laid out in the drawing, x 2,460′"; "R0 · 02 Aug 2026 · NT-STR-R1.dwg, laid out in the drawing, x −1,180′". Trace: "Title blocks of both copies; the drawing list on S-01, row 19: "S-19 R1"" | 1 "Keep R1 (14 Sep 2026); leave R0 out as superseded" (pre-picked: "the later revision mark, the later date and the drawing list on S-01 agree") · 2 "Keep R0 (02 Aug 2026); leave R1 out as superseded" · 3 "Keep both: they are different sheets" · 4 "Keep open, ask the consultant" | 1: "Answering confirms S-19 R1 and excludes R0 as superseded." · 3: "Answering confirms both copies." · 4: "Answering keeps both copies open. Neither is read until the consultant replies." |
| No number (`missing`) | "This sheet has no number" | "A sheet titled "Lift pit and sump details" in NT-STR-R1.dwg has an empty number in its title block. The drawing list on S-01 names S-12 "Lift pit and sump details", and no sheet carries S-12." Trace: "Title block text (the number field is empty); the drawing list on S-01, row 12" | 1 "S-12, as the drawing list names it" (pre-picked: "the title in the title block and the title on the drawing list agree"; offered only when a list names it) · 2 "Leave it without a number" · 3 "Keep open, ask the consultant" | 1: "Answering confirms the sheet as S-12." · 2: "Answering confirms the sheet without a number." |
| Boundary storey (amendment 2) | "Does "Basement to 1st floor" include the 1st storey?" | "S-07 is a column plan, read storey by storey (floor to floor). Its columns may stop at the 1st floor slab or run through the 1st storey. S-08 "Column layout plan, 1st to 9th floor" also starts at the 1st." Trace: "S-07 title block; S-08 title block" | 1 "Basement and Ground: the columns stop at the 1st floor slab" · 2 "Basement, Ground and 1st" · 3 "Keep open, ask the consultant" (none) | "Answering confirms S-07 for Basement and Ground, storey by storey." |
| Floors that do not run | "3rd, 5th & 7th: three floors, or 3rd to 7th?" | "The title lists floors that do not run: "3rd, 5th & 7th floor beam layout". Vextrus read it as three floors. S-19 draws the 4th and 6th." Trace: "S-18 title block; the drawing list on S-01, row 18; S-19 title block" | 1 "3rd, 5th and 7th only, as written" (pre-picked: "the title and the drawing list agree, and S-19 draws the 4th and 6th") · 2 "3rd to 7th, five floors" · 3 "Keep open, ask the consultant" | "Answering confirms S-18 for the 3rd, 5th and 7th floor levels." |
| Typical floor | "Which floors are "typical" on S-21?" | "S-21 "Typical floor slab layout" names no floors." Trace: "S-21 title block; the drawing list on S-01, row 21; A-5 title block" | 1 "2nd to 8th floor" (pre-picked: "the drawing list on S-01 ("typical floor, 2nd–8th") and A-5 "Typical floor plan, 2nd to 8th floor" agree") · 2 "Typical: take the floors from Step 3 (Storeys and levels)" · 3 "Keep open, ask the consultant" | 1: "Answering confirms S-21 for the 2nd to 8th floor levels." · 2: "Answering confirms S-21 as typical; its floors come from Step 3." |
| Storey not read (an EL title) | "Which storey is EL +16′-6″?" | "S-22's title names a level, not a storey: "Beam layout plan at EL. +16′-6″". No title in the set names that level." Trace: "S-22 title block; S-38 building section" | 1 "Mezzanine: the building section on S-38 marks +16′-6″ as the mezzanine floor" · 2 "Keep "EL +16′-6″"; bind it to a storey in Step 3" · 3 "Keep open, ask the consultant" (none: one source only) | 1: "Answering confirms S-22 at the Mezzanine floor level." · 2: "Answering confirms S-22 at EL +16′-6″; Step 3 binds it to a storey." |

Every "Keep open" option's first line reads "Answering keeps S-18 open." (or the file or copies it
holds). A Plot page with no sheet ("Page 12 of … shows S-13, which no DWG has") uses the drawing-list
card's options (5).

### 6.8 Storeys and the storey strip
- **Storeys are an explicit list per plan view,** with its meaning: "at floor level" (members at that
  floor level: beam and slab layouts) or "floor to floor" (the storey: column plans, architectural
  plans, sections). A sheet's storeys are its views' storeys together; its meaning is the views'
  meaning, or "mixed". Shown compactly: a run of three or more storeys one above another reads
  "2nd–8th"; anything else is listed ("3rd, 5th, 7th"). The roofs above the roof never form a run.
- **Ruling 2: a missing storey is a Question only on plan views.** A sheet with a plan view whose title
  states no storey shows amber "not stated" (and a Question when no second source settles it); a sheet
  with no plan view (notes, details, schedules, elevations) shows "—" and raises nothing. An untitled
  typical floor shows amber "typical (range from Step 3)" until answered.
- **Ruling 4: the storey strip stays.** A row of slots, one per storey of the building, low to high:
  foundations (pile, pile cap, grade beam) as one slot, Basement, Ground, Mezzanine, 1st…9th, Roof,
  and the roofs above (stair-room, lift machine room, overhead tank) as one slot; 5 px slots with a
  1 px gap in the list (6 px in the inspector), Ground and Roof slots a shade darker as landmarks.
  **"Floor to floor" fills the slot; "at floor level" is a 3 px bar at the slot's foot;** a typical
  floor is hatched over the typical range. An excluded sheet's strip is at 40 % opacity. The
  header's key at 1440 (and its tooltip at both sizes) explains the two marks: "Each slot is a storey:
  foundations, Basement, Ground, Mezzanine, 1st to 9th, Roof, the roofs above. A full slot is floor to
  floor; a bar at its foot is members at that floor level."
- The storey vocabulary is the spec's (amendment 3).

### 6.9 Exclusion, assignment, corrections and undo
- **Exclusion (`X`), per sheet or per view.** With a view selected (sheet mode), `X` excludes the view;
  otherwise the focused sheet. The bar becomes the picker: "Exclude S-20. Why?" (or "Exclude the view
  "8th floor beam layout". Why?") with "Coverage keeps the reason. Esc cancels" at the right, and the
  six reasons as six numbered buttons in one row (at 1280 the longer labels wrap to two lines):
  1 superseded · 2 duplicate · 3 cover or index · 4 3D or perspective · 5 reference only · 6 other,
  with text (session 02 removed "MEP", 5). `1`–`6` pick; 6 opens a field "The reason, in a few words"
  with "Exclude ↵". Toasts: "S-20 excluded: superseded. It stays in the count." / ""8th floor beam
  layout" excluded: reference only. Coverage keeps the reason." An excluded view stays listed, struck
  through, "excluded: reference only".
  "Confirm back in" (or `Enter` on an excluded sheet) reverses it under the actor's name: "A-24
  confirmed back in, under Tanvir Ahmed's name."
- **Assigning a view to several Takeoff Steps (`A`,** sheet mode, a view selected; else the toast
  "Pick a view first: → moves through the views on the sheet."): a 420 px dialog "Which steps read "8th
  floor beam layout"?", "A view may feed several steps; each marks it used on its own. S-20, plan.",
  fourteen checkboxes "1 Sheets … 14 Site works and MEP allowances" with "M1 onwards" beside 2–14, then, from session
  02, one per MEP Discipline Part ("Electrical", "Plumbing and sanitary", "Fire", "Other MEP") with "M3
  onwards" beside each (a view on an MEP sheet is proposed for its own Discipline's Part; 5); with none ticked,
  "No step: Coverage will count this view unaccounted unless it is excluded."; keys `↑ ↓` move, `Space`
  ticks, `Enter` saves, `Esc` cancels; "Cancel" and "Save ↵". Toast: ""8th floor beam layout" assigned
  to 2 steps." or "… is assigned to no step and not excluded: Coverage counts it unaccounted."
- **Corrections (`E`):** "Correct the Proposal" opens in the inspector in place of the Proposal block:
  Number, Title, and for each plan view "Storeys of "<view title>", each listed" (placeholder "3rd,
  5th, 7th"); "Save ↵" and "Cancel Esc". A correction leaves the sheet a Proposal: toast "Corrected
  S-18: storeys of "3rd, 5th & 7th floor beam layout". Still a Proposal until confirmed."; the State
  column adds ", corrected"; "Who did what" records "Corrected: number — → S-12; title; storeys of
  "…"". Corrections are counted for the owner (never shown to the client).
- **Undo (`Ctrl Z`):** undoes the last act (a bulk act, a single Confirmation, an answer, an exclusion,
  an assignment, a correction, a pasted list), repeatedly; the toast names what it undid (5).

### 6.10 The drawing list (amendment 7)
Each Discipline's N comes from a drawing list: one read on a sheet ("39 on the drawing list on S-01")
or one the QS pastes or types. Where a file carries none, the Discipline's heading offers "Paste the
drawing list"; afterwards "The pasted drawing list" reopens it. The dialog "The architectural drawing
list": "NT-ARCH-R1.dwg carries no drawing list. Paste the consultant's list (the transmittal or an
email) and Vextrus checks it against the sheets found, both ways. Its source is marked as pasted."; a
text area; "29 sheet lines found; other lines are ignored."; "Close" and "Use as the drawing list".
Toast "Drawing list set: 29 architectural sheets." Its source is shown wherever N is:
"29 on the drawing list pasted by Rafiq Hasan, 26 Sep 2026 09:58". The Check against it (6.7, "On the
drawing list, in no file") runs once every file is read.

### 6.11 Coverage
- **Status bar** (right): "Coverage 170 views: 0 assigned, 0 excluded, 170 proposed, 0 unaccounted";
  amber while any view is unaccounted. A view is **proposed** while its sheet is a Proposal and it has
  a proposed step or exclusion; **assigned** once its sheet is confirmed with at least one step;
  **excluded** when its sheet or itself is excluded, with the reason; **unaccounted** when it has no
  step and no exclusion. "Used" stays 0 in M0. The views of a held file are not counted until it reads
  cleanly. A view on an MEP sheet counts as assigned once its sheet is confirmed with its Discipline
  Part (5); in the panel's "Views by the step that will read them" its Part is a row of its own
  ("Electrical, M3 onwards").
- **Coverage panel** (a click on it; in the inspector, 4.1): "Coverage, every view on every sheet
  read"; "A view counts once it is assigned to a step that will read it, or excluded with a reason.
  Used is 0: no step after Step 1 runs in M0. A view may feed several steps, so the steps below add up
  to more than the views."; "Unaccounted" (each "S-20 8th floor beam layout", in amber); "Views by the
  step that will read them, proposed or assigned" (step and count, two columns); "Excluded, by reason";
  the held-file line "NT-ARCH-Details-R1.dwg is held: its views are not counted until it reads
  cleanly."; while reading, "NT-ARCH-R1.dwg is still reading; its views join as its sheets arrive."
- **Step 1 is confirmed** when no file is reading, every sheet is confirmed or excluded, no Question is
  open or kept open, and Coverage has none unaccounted. The toolbar then reads "✓ Step 1 confirmed,
  62 / 68, 6 excluded" and the rail marks Step 1 confirmed.

### 6.12 Roles
- **The MD (read-only):** everything is visible; no act. The bar: "You are reading this as the MD." (or
  "Step 1 is confirmed. You are reading it as the MD.") / "Rafiq Hasan (QS) confirms the sheet list;
  every act shows who did it.", with the ghost "Next open Question Q" while any is open. Question cards
  show their options disabled and "Waiting for the QS. The MD reads Questions and cannot answer them."
  The paste dialog is read-only; "Correct", "Exclude", "Assign steps" and "Confirm back in" are absent.
  A key that would change something (Enter, X, E, A, digits, Ctrl Z) shows the toast of 1.4. Plus 4.7's
  ReadOnlyChip in the toolbar. The top bar shows who from Vextrus has access: "TA Vextrus Tanvir Ahmed,
  Vextrus Engineer, has access until 26 Oct 2026" with "Revoke".
- **The Vextrus Engineer (a visible act):** works as a QS. The top bar carries the AccessChip (3; the
  prototype's words: "Working in Nilachal Developers' data by their invitation, until 26 Oct 2026").
  Every act shows under their own name with the indigo "TA Vextrus" chip in the State column and in
  "Who did what", and the bar says "confirmed by Tanvir Ahmed, Vextrus Engineer". In the prototype's
  confirmed set, the QS had excluded A-24 as reference only and the Engineer confirmed it back in:
  "Confirmed back in: Step 14 reads the driveway and boundary for external works", which the MD sees.

### 6.13 States
| State | What shows |
|---|---|
| **First open of Step 1** | List mode, nothing focused: the overview in the inspector; the bar offers the bulk act |
| **Files still reading** | Sheets from read files are workable. The reading file's chip spins ("reading sheet 14 of 28"); one skeleton row per sheet to come, "reading…"; the bulk act excludes them and its why says so; the drawing-list Check waits; Step 1 cannot be confirmed |
| **First open of a sheet** | 4.6: the paper outline with a shimmer and "Opening S-04 for the first time…"; from the browser's cache next time |
| **A held file (ruling 3)** | Its row heads "Needs you" with Question Q1; nothing from it is listed or counted; Coverage says so. Step 1 may be confirmed once Q1 is answered; the file's chip and row stay marked ("Held: waiting for the re-saved file" / "Held: sent to Vextrus to check" / "Left out: may be misread") |
| **No Plot, and why** | "As read" only; Plot and Compare disabled with the reason as tooltip; `P` shows the note "No Plot for this sheet:" and the reason, top-left: "NT-ARCH-R1.dwg came with no PDF" · "the sheet has no number, so no PDF page could be matched to it" · "the PDF has no page for S-19 R0; its page 19 matched R1" · "PDF page 21 could not be matched: its title block is drawn as strokes, so there is no text to match". The inspector's Plot line repeats it ("None: …") |
| **Bangla-font flag** | The file's chip "Bangla font" (amber); on an affected sheet, a canvas note "Bangla in a legacy font reads as "…"" and in the inspector "Bangla text here is set in SutonnyMJ, a legacy ANSI font. Vextrus reads it as "…", not as Bangla. The title and number are not affected." The file's report uses 4.5's wording |
| **Kept open** | 6.7 |
| **All confirmed** | 6.11 |
| **TypeSafe unavailable** | 4.7: no pre-pick where Jev would have been a source; nothing else changes |

### 6.14 As read, Plot, Compare and CAD-dark
In sheet mode only (in list mode `D`, `P` and `F` do nothing): the toolbar's segmented **"As read |
Plot | Compare"** (the owner's ruling, 9.4: "As read", never "Engine"), `P` cycling it; on Plot and
Compare a note top-left "Plot: NT-STR-R1.pdf page 18, registered to 0.3 mm" or "Compare: what was read
in red over the Plot"; the CAD-dark toggle (`D`); Fit (`F`, 6.15). Everything else about the viewer is
4.6's.

### 6.15 The keys Step 1 registers (through the key map, 2)
| Key | Where | What it does |
|---|---|---|
| `Enter` | screen | What the bar says (6.4, 6.5) |
| `Space` | screen | List ⇄ Sheet: open the focused sheet (none focused: the first sheet row), or go back |
| `↑` `↓` | screen | List mode: previous / next row. Sheet mode: previous / next sheet in list order |
| `[` `]` | sheet mode | Previous / next sheet (16's binding) |
| `→` `←` | sheet mode | Next / previous view on the sheet; the canvas flies to it. Nothing in list mode |
| `Esc` | stack (2.2) | Close the picker, dialog, panel or overlay; else leave the selected view and fit back; else sheet → list; else clear the focus |
| `X` | screen | Exclude the focused sheet, or the selected view, with a reason |
| `1`–`6` | mode: exclusion picker | Pick a reason; `6` asks for the text (seven reasons until session 02 removed "MEP") |
| `1`–`9` | screen | Pick an answer on the focused Question |
| `A` | sheet mode, a view selected | Assign the view to Takeoff Steps (dialog: `↑ ↓` move, `Space` ticks, `Enter` saves) |
| `E` | screen | Correct the focused sheet's number, title or storeys, in the inspector |
| `Q` | screen | Next open Question (from sheet mode, a Question on a file or list row returns to the list) |
| `S` | sheet mode | The sheet picker |
| `D`, `P` | sheet mode | CAD-dark; As read → Plot → Compare |
| `F`, `Shift F` | sheet mode | The whole sheet; the working view (2.2 and screens.md sheet ruling 6; the prototype had them reversed) |
| `?` | global | The keys overlay |
| `Ctrl Z` | screen | Undo the last act |

Also kept from 2.2: `Ctrl K`, `F6`, `Home` `End`, `Z`, `O`, `+` `−`. A mouse click on a row focuses it;
a double-click opens it.

### 6.16 Performance readouts only behind `?perf`
With `?perf` (1.6) the status bar also shows "perf: 42 keys; key to frame last 12 ms, p95 31 ms" (keys
pressed on this screen, the last key-to-frame time, its p95), beside 4.6's readouts. Without the flag
none of it is in the DOM.

### 6.17 Where the prototype breaks this spec (build the corrected form)
| In the prototype | Build |
|---|---|
| "Engine" in the segmented control and "the engine in red over the Plot" | "As read"; "what was read in red over the Plot" (9.4 ruling) |
| Proposed exclusions as a second act after "Confirm 56" | One bulk act (ruling 1, 6.4) |
| `F` fits the working view, `Shift F` the whole sheet | The reverse (2.2) |
| "model space, x 2,460′" in "where" and the copies table | "laid out in the drawing, x 2,460′" (1.1) |
| "entities", "LibreDWG 48,210 entities, ACadSharp 48,522", "layer A-DETL-DOOR" in Q1 and the file report; "Drawing S-04 for the first time: 12,345 entities" | Items and readers in words (4.5's readers wording); 4.6's first-open line |
| "Two decoders agree" / "the two decoders disagree" | "two readers agree" / "the two readers disagree" (4.5) |
| "Drawing Set: first issue, 26 Sep 2026" in the top bar | No revision label in M0 (4.1) |
| Coverage as a popover over the status bar | In the inspector (4.1) |
| The file report as a modal | 4.5's report, in the inspector |
| The MD's toast "Read only: the MD views the sheet list; a QS confirms it." | 1.4's toast |
| Scale note "Stated 1:100, confirmed in Step 4" / "Not to scale: only its text is read" | 4.6's scale bar |
| "Undone." | The toast names what it undid (5) |
| The prototype's switcher pill and "Prototype: in memory only" | Absent |

### 6.18 Not settled: for the owner (the prototype, the rulings and sections 4–5 differ)
1. **The held file's answers (ruling 3).** The ruling names "read anyway" and "set this file aside" and
   says the held file's sheets "stay marked"; the prototype offers re-save, send to Vextrus, or leave
   it out, and lists none of the file's sheets; 5's template has four options including "Keep open".
   Which options, and whether "read anyway" lists its sheets marked, is open.
2. **The combined bar's exact words** (ruling 1) were not prototyped; 6.4 gives a draft.
3. **Which views are excluded by default.** 5 and the seed (7) exclude title blocks, legends, key plans
   and 3D views; the prototype assigns title blocks to Step 1 and legends to their step, and excludes
   key plans and 3D views; the plan's D0 names only 3D/perspective as excluded by default.
4. **The toolbar's count:** 4.7 counts "confirmed or excluded / found"; the prototype counts
   "confirmed / found, n excluded".
5. **The bar's width:** 4.7 says at most 720 px; the prototype's is 800–820 px, which is what lets the
   seven reasons fit on one row (six since session 02).
6. **The Questions' order:** 5 orders by the sheets a Question holds, then kind; the prototype orders
   files, count, numbers, storeys.
7. **Question wording:** the prototype's cards differ from 5's templates (the drawing-list card's
   options; the no-number card has no "Type a number" (`E` corrects instead); the boundary-storey card
   asks which storeys, not "members at floor level or the storey"). 6.7 records the prototype's.
8. **The meaning of a storey list** ("at floor level" / "floor to floor") is shown but not editable in
   the prototype's correction form; how the QS changes it is open.
9. **The storey strip's slots** are fixed to the invented building in the prototype; for a real set the
   storeys are not known until Step 3. How the slots are chosen before then is open.
10. **Multi-select:** 2.2 binds `Space` and `Shift ↑ ↓` to selection; `Space` now switches modes, and
    the prototype has no multi-select. Whether Step 1 needs one is open.
11. **The "done" wording:** 4.7 says "Every sheet is confirmed or excluded: 21 in, 3 excluded."; the
    prototype says 6.4's last row.
12. **The inspector's placement of the file report and Coverage** follows 4.1 here, but was not
    prototyped there.

---

## 7. The seeded demo project

Every UI PR is walked on this seed at 1440×900 and 1280×800 (screens.md, "How M0's screens keep this
quality" 3; ux-critic #4). All of it is invented; its DWGs and PDFs are made by the committed
synthetic-fixture script (ticket 04's `tests/fixtures/make_dwg.py`, extended) and go through the
product's real upload and read job. Where a state cannot be produced on demand (a set-aside file, a
stalled read), the seed uses the same stubs the API tests use, enabled only in development settings.
Passwords come from `VEXTRUS_DEMO_PASSWORD`; the seed never prints one. Ownership is open question 5.
Both Developers are on the Bangladesh Market, the only one; every project has its Site and one
Building, made with it (session 02).

**Developers and people.**
| Developer | Person | Email | Role |
|---|---|---|---|
| Shapla Homes Ltd | Nusrat Jahan | nusrat@shapla-homes.example | QS |
| Shapla Homes Ltd | Kamal Uddin | kamal@shapla-homes.example | MD |
| Shapla Homes Ltd | Arif Rahman | arif@vextrus.example | Vextrus Engineer, invited by Kamal Uddin, 30 days |
| Shapla Homes Ltd | Farhana Kabir | farhana@kabir-consult.example | QS given only KR-01, until 26 Oct 2026: a consultant's engineer from outside, invited by Kamal Uddin (session 02 Q11) |
| Shapla Homes Ltd | rumana@shapla-homes.example | (an unused QS invitation) | — |
| Meghna Properties Ltd | Tanvir Ahmed | tanvir@meghna.example | QS (the isolation check) |

**Projects.** KR-01 Kadam Residence (everything below); BP-02 Bokul Place (one structural DWG left
stalled at "sheet 7 of 12", for the retrier); SG-03 Shimul Garden (empty). Meghna: MG-01 Meghna
Heights (one small DWG read).

**KR-01's files.**
| File | What it carries | Its states |
|---|---|---|
| KR-STR-R0.dwg | 13 sheet borders laid out in the drawing: S-01 general notes with a drawing list naming S-01 to S-13; S-02 pile layout; S-03 pile cap layout; S-04 ground floor beam layout, with a lift pit detail drawn inside the plan and a tie detail marked N.T.S.; S-05 1st floor beam layout; S-06 "3RD, 5TH & 7TH FLOOR BEAM LAYOUT" (a non-run list); S-07 rev B "TYPICAL FLOOR SLAB LAYOUT" (an untitled typical floor) and S-07 rev A, superseded, beside it; S-08 column layout, pile cap to 2nd floor; S-09 column schedule; S-10 stair details with a burst title block (no attributes); S-11 roof beam layout; S-12 overhead tank and lift machine room. Text uses `%%C`, `%%D`, `%%P`, MTEXT `\P` and a stacked ½ | Read; two readers agree; fonts Arial, Romans (AutoCAD lettering), Swiss 721 Condensed |
| KR-STR-R0.pdf | 12 pages plotted from it: 11 match; page 12 shows S-13 (in no DWG); 2 pages turned 90°; AutoCAD lettering kept as text; layers kept; one logo | Plot: 11 of 12 matched |
| KR-ARC-R0.dwg | 8 sheets: A-01 site plan, A-02 ground floor plan, A-03 typical floor plan, A-04 roof plan, A-05 "SECTION A-A & ELEVATION" (kind unclear), a door and window schedule with no number (burst title block), and on layout tabs A-06 and A-07 (a 3D view alone on its sheet: the view excluded by default, the sheet proposed to leave out as 3D or perspective). Room names on A-02 and A-03 typed in SutonnyMJ | Read; two readers agree; 1 flag: Bangla text (9 texts on 2 sheets) |
| KR-ARC-R0.pdf | 8 pages, all matched; made by a PDF tool other than AutoCAD; lettering drawn as lines; no layers | Plot: 8 of 8 matched; lettering as lines |
| KR-ELE-R0.dwg | 3 electrical sheets, E-01 to E-03 | Read; two readers agree; Discipline Electrical; its sheets confirmed like the rest, their views assigned to the Electrical Part, "M3 onwards". (The Drawing Set wireframe shows it mid-read, under its pre-session-02 name `KR-MEP-R0.dwg`) |
| KR-STR-old.dwg | an older structural file | Set aside: the readers disagree (the planted-disagreement stub) |
| site-photos.pdf | pictures only | Refused: a scan |

**KR-01 after reading.** 24 sheets found (13 + 8 + 3); 20 agree and can be confirmed in one act
(19 in, the 3 electrical sheets among them; A-07 left out as 3D or perspective). 5 Questions open: Q1 KR-STR-old.dwg may be misread; Q2 two sheets numbered
S-07 (pre-picked "keep rev B": the revision mark and the drawing list agree); Q3 the unnumbered
architectural sheet (no pre-pick); Q4 the kind of A-05 (no pre-pick); Q5 the drawing list and the
Plot both name S-13, which no DWG has. About 70 views: 52 assigned (the electrical sheets' to the
Electrical Part), 16 excluded by default (title blocks, legends, the 3D view), 2 unaccounted (on the
burst-title-block sheet) until the QS acts. The QS's work ends with 0 unaccounted.

**The walks the seed must support:** every state in 4.2–4.7; the finish line's steps 2–8 and 10–11
in miniature, the outside member given one project included; no building picker, market or currency
anywhere (1.9, 1.10); the spec's six traps (amendment 10: a multi-plan sheet, a non-run floor list, a
superseded duplicate, an untitled typical floor, the count against the drawing list, a view excluded
now and needed later).

---

## 8. The design gate

`ux-critic` reads docs/design/system.md, docs/design/screens.md and this file before every UI PR
(screens.md, "How M0's screens keep this quality" 4), runs the PR on the seed, and walks it at
1440×900 and 1280×800 with screenshots kept private. On every UI PR it checks:
1. Each screen the PR touches against its section here: layout, every state reachable on the seed,
   the wording verbatim.
2. The key map: the `?` overlay lists every active key, each works, and the duplicate test is green.
3. No raw CAD code in the DOM (grep for `%%`, `\P`, `\f`, `\S`, `^J`, `{\`) and none on a sheet.
4. No word from the list in 1.1 in the DOM.
5. No performance readout without `?perf`.
6. The toolbar on one line at 1280; canvas ≥ 70% of the width with the inspector open.
7. Focus visible everywhere; a Lighthouse accessibility audit with no contrast failure; reduced
   motion stills every shimmer and pulse.
8. The MD's read-only state on every screen the PR touches.
9. The phone notice at 390 px and the narrow notice at 1100 px.
10. From session 02 (ADRs 0034, 0036, 0038): the catalogue lint and the logical-CSS lint green; no
    message key in the DOM; every sheet number, length, coordinate, level and scale in the DOM inside
    a left-to-right isolate, and the canvas `dir="ltr"`; no building picker, Building column or name,
    no Market name and no currency anywhere on the seed; a member given one project sees only it.

Before tickets 16 and 22 merge, a `local` walk on a real Development Set confirms that no sheet opens
looking empty (screens.md 5); its screenshots stay under `.private/`.

---

## 9. Open questions for the owner (one at a time, recommendation first)

1. **What the MD may do in M0 besides Members and access.** Recommendation: nothing else; read-only
   on projects, the Drawing Set and Step 1. Why: story 57 keeps the Takeoff the QS's, and one rule
   ("the MD looks, the QS works") is easier to trust than a list of exceptions.
2. **Who may invite whom.** Recommendation: the MD invites QSs, MDs and Vextrus Engineers; a QS
   invites only a Vextrus Engineer (the spec allows it); only the MD revokes, and the QS may revoke an
   Engineer they invited. Why: the MD buys and controls access (stories 58–61).
3. **How long an invitation link works.** Recommendation: 7 days, once. Why: it travels by chat or
   email copy-paste in M0, with no mail service to resend it.
4. **The "Engine" label on the read drawing** (ruling 4 names the state "Engine"). Recommendation:
   label it "As read" on screen and keep "Engine" as the internal name. Why: "Engine" is our word, not
   a QS's; the ruling is about which state opens first, and that stays.
5. **Who owns the seed.** Recommendation: ticket 20 writes the seed command for Developers, people,
   projects and files; ticket 21 extends it with sheets, views and Questions; ticket 03 ships a
   static copy of the same data for shell work before the API exists. Why: the plan gives the seed no
   ticket, and each piece has a natural first builder.

## The owner's rulings (26 Sep 2026)
- **§9, all five: "Agree with all five".** The MD manages members and access and is otherwise
  read-only; the MD invites QSs, MDs and Vextrus Engineers, a QS invites only a Vextrus Engineer; the
  MD revokes anyone and a QS may revoke an Engineer they invited; an invitation link works once, for
  7 days; the read drawing is labelled **"As read"** on screen (not "Engine"); the seed is written by
  ticket 20, extended by 21, with a static copy shipped by 03.
- **§6, the Step 1 layout, is settled:** layout A, "List ⇄ Sheet" (Space opens the focused sheet
  across the canvas; Esc returns), with the five choices recorded in docs/design/screens.md
  ("Takeoff Step 1"). The Step 1 prototype (private, `.private/work/session-01/proto-step1/`) is the
  reference; ticket 22 builds to it and to that section.

### 6.19 The 6.18 gaps, resolved by the orchestrator (26 Sep 2026; the owner may overrule)
Each takes the committed spec's side unless a ruling says otherwise; ticket 22's design gate checks
them, and the owner judges them at the M0 walk.
1. **A held file's Question** offers "Read it anyway" and "Set this file aside"; the held file's sheets
   carry a "held" mark in the list and their figures are flagged later (the owner's ruling 3).
2. **Views excluded by default:** title blocks, legends, key plans and 3D/perspective (§5 and the
   seed); the prototype and D0 are updated to match.
3. **The toolbar counts sheets accounted for** (confirmed or excluded), as §4.7; the bar is capped at
   720 px at 1280.
4. **Question order and wording** follow §5's templates.
5. **The combined bulk bar** uses 6.4's wording, first judged at ticket 22's gate.
6. **Editing a storey list's meaning** is a two-choice toggle in the inspector; the strip's slots before
   Step 3 come from the canonical vocabulary in title order; multi-select is Shift-click and Shift-↑↓
   in list mode only.
7. **F fits the whole sheet, Shift F returns to the working view** (§2.2; the owner's ruling 6).
8. **Coverage's "proposed"** counts views assigned but not yet confirmed. **When a read drawing list and
   a pasted one disagree,** it is a Question; until answered, N shows "—".
