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

## What is not settled or not proven (read first)

- **Step 1's layout is not settled.** Step 1 was never prototyped (ux-critic #2). Its screen waits on
  the Step 1 prototype being built now and the owner's judgement of it; section 6 lists the
  questions that prototype must answer. Ticket 22 is not cut until then.
- **No QS has read any of this wording.** Every message below is my reading of a QS's words, not a
  QS's. The owner's walk and the timed Step 1 by a QS who did not build it (spec amendment 10) test it.
- **The key map is designed, not measured.** Only the Takeoff prototype's keys were measured
  (screens.md: 25 keystrokes for a whole step). The Step 1 keystroke count is still unknown.
- **The exact AutoCAD wording for the SHX-text plot option** ("Include SHX text as comments", the
  `PDFSHX` system variable) must be checked against Autodesk's documentation by ticket 12 before the
  PDF report ships; I have not verified the dialog label.
- **The cursor readout's origin on a layout-tab sheet** (paper units or model units) is not decided;
  model-space sheets show the drawing's own coordinates.
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
6. Step 1 layout: pending the owner's judgement of the Step 1 prototype
7. The seeded demo project
8. The design gate
9. Open questions for the owner

Wireframes (SVG, invented data) sit beside this file in `docs/design/m0-wireframes/`, each at
1440×900 and 1280×800: `sign-in-*.svg`, `projects-*.svg`, `members-*.svg`, `drawing-set-*.svg`,
`drawing-set-empty-*.svg`, `sheet-viewer-*.svg`, `step1-shell-*.svg`, and `phone-notice-390.svg`.
They fix proportions and content, not pixels; the tokens in docs/design/system.md fix the pixels.

---

## 1. Rules for every screen

### 1.1 Words
- **CONTEXT.md's terms, exactly:** Drawing Set, Discipline, Takeoff, Takeoff Step, Proposal,
  Confirmation, Question, Check, Coverage, Trace, QS, MD, Vextrus Engineer, Display Units, Rebar.
  "Plot" is the consultant's PDF page registered beneath a sheet. "View" is a part of a sheet (a
  plan, a section, a schedule, a detail, notes, a title block, a legend, an elevation, a key plan, a
  3D view).
- **Sentence case** for every label, button and heading. Drawing text (sheet numbers, titles, view
  titles) keeps the drawing's own case.
- **Never shown to a QS or an MD** (the design gate greps the DOM for them): handle, entity, SDF,
  DXF, LibreDWG, ACadSharp, ezdxf, pdf.js, WebGL, buffer, artefact, render (as a noun), parse, JSON,
  sandbox, worker, job, queue, hash, sha256, tenant, RLS, API, null, undefined, NaN, stack traces,
  error codes, "Rod" (the word is Rebar), "model space" (say "laid out in the drawing"), font file
  names with extensions (`romans.shx`: say "Romans (AutoCAD lettering)"), and any path. The only
  file names shown are the QS's own uploaded files, as the label of that file. "SHX" appears only
  inside the name of the AutoCAD setting the PDF report tells the QS to ask for.
- **Messages say what happened, what it means, and what to do,** in that order, in one or two
  sentences. No "Error:", no "Oops", no exclamation marks, no apologies.

### 1.2 Figures
One formatter per kind (ticket 03, `web/src/format/`, with its table of expected strings): coordinate
and length in ft-in (`42′-7½″`, never grouped); count as n / N (`12 / 13`), unknown N as `—`; date as
`26 Sep 2026`; share as a whole percent beside what it is a share of; empty figure `—`. M0 shows no
money and no quantities.

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
- **MD: read-only everywhere except Members and access** (story 57; open question 1). Buttons that
  change the Takeoff or the Drawing Set are absent, not disabled. A key that would change something
  shows the toast "As MD you can look at the Takeoff but not change it." Every confirmed item shows
  who confirmed it and when ("Confirmed by Nusrat Jahan, 26 Sep 2026").
- **Vextrus Engineer:** works as a QS inside a live invitation (story 63). The top bar carries the
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
| `Enter` | screen (Step 1) | Confirm the focused group, sheet or selection, from the list or the canvas; with an answer picked on the active Question card, answer it | 22 | yes |
| `Space` | region: list | Add the focused row to the selection or take it out | 03, 22 | yes |
| `Shift ↑` `Shift ↓` | region: list | Extend the selection | 03, 22 | yes |
| `→` `←` | region: list (Step 1) | On a group: review its sheets one by one; `←` back to the group | 22 | yes |
| `[` `]`, `PageUp` `PageDown` | screen (any sheet) | Previous / next sheet in the list's order | 16 | yes |
| `F` | region: canvas | Fit the whole sheet | 16 | yes |
| `Shift F` | region: canvas | Back to the working view (the fit the sheet opened with) | 16 | yes |
| `D` | screen (any sheet) | Paper ⇄ CAD-dark | 16 | yes |
| `P` | screen (any sheet) | Engine → Plot → Compare → Engine. With no Plot for this sheet, shows why and stays on Engine | 16 | yes |
| `O` | screen (any sheet) | Show or hide the view outlines | 16 | yes |
| `Z` | region: canvas | Zoom to the selected view | 16 | yes |
| `+` `−` | region: canvas | Zoom in / out about the centre (the wheel zooms about the pointer; drag with the left or middle button pans) | 16 | yes |
| `S` | screen (Step 1) | Put focus in the sheet list | 22 | yes |
| `Q` | screen (Step 1) | Go to the next open Question | 22 | yes |
| `X` | screen (Step 1) | Exclude the focused sheet(s) or the selected view, with a reason (opens the picker) | 22 | yes |
| `E` | screen (Step 1) | Edit the focused sheet's number, title, Discipline or storeys in place; `Enter` saves, `Esc` cancels | 22 | yes |
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
   selection is live.
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
6. **S.** The sheet prototype's `S` opened a 420 px drawer over the canvas. In Step 1 the sheet list
   is always there (layout pending), so `S` moves focus to it.
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
| **AccessChip** | In the top bar, for a Vextrus Engineer | "Vextrus access to Shapla Homes Ltd until 26 Oct 2026"; amber when 3 days or fewer are left: "Vextrus access ends in 2 days" |
| **DrawingText** | Shows a drawing string (number, title, view title) in the drawing's case, ellipsis plus tooltip when cut | In development builds, logs any `%%`, `\P`, `\f`, `\S`, `^J`, `{\` it is given |
| **Progress line** | A 3 px bar under a status text, plus the words | Determinate when steps are counted, else a slow indeterminate sweep; still under reduced motion |
| **Formatters** | `web/src/format/` | 1.2 |

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

**Top bar, left to right.** Brand mark; the project switcher ("Kadam Residence ▾"; on `/projects`
and `/members`, the Developer's name instead); text navigation with **only Takeoff and Drawing Set**
in M0 (ux-critic #13; Priced BOQ, Material Schedule and Project Summary appear with their milestones,
never as dead links); the AccessChip for a Vextrus Engineer; on the right, "Jump to…  Ctrl K" (220 px)
and the user menu ("Nusrat Jahan, QS ▾": the Developer switcher when the user has more than one
Membership, "Members and access", "Keys  ?", "Sign out"). No Revision label in M0: one issue only.

**Step rail (48 px, 288 px open, overlaying the canvas, never reflowing it).** All 14 Takeoff Steps
in building-first order, numbered. Step 1 is live; its state mark follows screens.md (Question wins,
then all confirmed, then Proposals ready, none for not started). Steps 2–14 are muted with the
tooltip "Step 7, Beams: not open yet"; clicking one shows the canvas empty state "Step 7, Beams, is
not open yet. It will read the sheets you confirm in Step 1." with the action "Back to Step 1".

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
(the project's Display Units); then on the right Coverage and the save state: "All changes saved" /
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
| Page not found | Empty: "There is nothing at this address. It may have been a link to another Developer's project." [Your projects] |

**Keys registered:** `?`, `Ctrl K`, `Esc`, `F6`, `Shift F6`, the list primitive's keys.

**Design gate on this screen.** Toolbar on one line at 1280 with the longest seeded sheet title;
canvas width share ≥ 70% with the inspector open at both sizes; only Takeoff and Drawing Set in the
top bar; the `?` overlay lists every active key and each one works; the key-registry duplicate test
is green; focus ring visible on every control; phone notice at 390 px; narrow notice at 1100 px;
no `?perf` readout without the flag.

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

**Purpose.** The Developer's projects in one list; create one (stories 2–4, 56). Wireframes:
`projects-1440.svg`, `projects-1280.svg`.

**Layout.** Page header: "Projects" (text-xl) with "3 projects at Shapla Homes Ltd" under it; on the
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
Buttons "Create project" and "Cancel". Errors under fields: "Give the project a name." / "Give it a
short code, like KR-01." / "KR-01 is already used by Kadam Residence. Choose another code."
After create: straight to its Drawing Set (empty state).

**States.** Loading: five Skeleton rows. Empty: glyph, "No projects yet. Create one for each
building whose drawings you will take off." [New project] (MD: "No projects yet. Your QS creates
them.").

**Keys.** List keys (`↑ ↓ Home End`, `Enter` opens).

**Design gate.** The empty, loading and seeded states; MD sees no create button; codes and dates
formatted; a second Developer's projects never appear (the isolation test is the API's, the walk
repeats it).

### 4.4 Members and access (ticket 20; data by 07)

**Purpose.** Who can open this Developer's projects; invite; see and end Vextrus access (stories
58–62, 64; finish line step 10). Wireframes: `members-1440.svg`, `members-1280.svg`.

**Layout.** Header "Members and access" / "Who can open Shapla Homes Ltd's projects", "Invite" on
the right. Three sections, each a table:
1. **People at Shapla Homes Ltd:** Name · Email · Role · Since.
2. **Vextrus access**, with the line "Vextrus sees your data only while an invitation below is live.
   You can end it at any time.": Vextrus Engineer · Invited by · From · Until · Acts · actions
   "Renew 30 days" and "Revoke". "Acts" reads "12 acts, last 26 Sep 2026" and opens, in a side panel,
   the Engineer's acts from the event log in words, newest first ("Confirmed S-07 back in, excluded
   before as superseded · Kadam Residence · 26 Sep 2026, 15:42"). Ended access stays listed, muted:
   "Revoked by Kamal Uddin, 26 Sep 2026" or "Ended 26 Oct 2026".
3. **Invitations not used yet:** Email · Role · Link works until · "Copy link", "Withdraw".

**Invite dialog.** "Invite someone to Shapla Homes Ltd". Email; Role (QS | MD | Vextrus Engineer,
as allowed for the inviter); for a Vextrus Engineer, "Access ends on" (required, 30 days ahead by
default: "26 Oct 2026 (30 days)"). "Create link". Then: "Copy this link and send it to Arif Rahman.
It works once, until 3 Oct 2026." [Copy link] → toast "Link copied".

**Wording of acts.**
| Act | Wording |
|---|---|
| Revoke confirm | Dialog: "End Arif Rahman's access now? Their next click is refused. What they did stays under their name." [End access] [Cancel] |
| Revoked | Toast: "Arif Rahman's access has ended." |
| Renewed | Toast: "Arif Rahman's access now ends on 25 Nov 2026." |
| Withdrawn | Toast: "Invitation withdrawn. The link no longer works." |
| Email already a member | Under the field: "rumana@shapla-homes.example is already a member." |

**States.** Loading: Skeleton rows per section. No Vextrus access: "No one from Vextrus has access."
QS view: the same page; the QS's Invite offers only Vextrus Engineer (open question 2) and without Revoke on access
the MD created (open question 2). Vextrus Engineer: the people section only.

**Design gate.** Finish line step 10 on the seed: invite, sign in as the Engineer, act, see the act
listed here under their name, revoke, the Engineer's next request refused with 4.1's wording.

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
the file name), shown as a quiet select the QS may change on the row; Step 1 starts from it.

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
| MEP | "Read. MEP: listed, not measured" | "Open in Step 1" |
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
coordinates; layout tabs: see "not settled"); the stated scale under the cursor's view.

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
the DOM or on the canvas's text runs; no perf readout without the flag. **Before 16 merges, a
`local` walk on a real Development Set:** every sheet's first open is checked by eye; "no sheet
opens looking empty" (screens.md, "How M0's screens keep this quality" 5).

### 4.7 Step 1's shell (frame by 03; filled by 22)

**Purpose.** The canvas screen Step 1 lives in. Its frame is settled (4.1); what fills its list,
canvas foot and inspector waits on the Step 1 prototype (section 6). Wireframes:
`step1-shell-1440.svg`, `step1-shell-1280.svg` (the inspector's content is marked pending).

**Settled.**
- Toolbar: "Step 1", "Sheets", "Confirmed 0 / 24" (sheets confirmed or excluded / sheets found;
  per-Discipline N from the drawing list or the Plot sits in the list, section 5), the sheet label and
  the viewer's switches.
- The Confirmation bar floats at the canvas foot, 44 px, at most 720 px wide, centred: what ("20
  sheets agree: Structural, Architectural, MEP"), why ("Read from their title blocks; 3 MEP sheets
  excluded"), "Review one by one" (ghost), and the screen's one copper button "Confirm 20 ↵".
- Status bar Coverage (story 43): "Coverage: 70 views — 52 assigned, 16 excluded, 2 unaccounted";
  "unaccounted" in amber while above 0; clicking opens Coverage in the inspector.
- Step states on the rail: Question glyph while any Question is open; Confirmed when every sheet is
  confirmed or excluded and every file is read or cancelled (story 36).

**States that do not depend on layout.**
| State | What shows |
|---|---|
| No files | Canvas empty state: "No sheets yet. Add the Drawing Set's files first." [Go to the Drawing Set] |
| Files still reading | Sheets from read files are workable; a row above the list: "Still reading KR-MEP-R0.dwg: sheet 2 of 3. Its sheets join the list when it is read." Step 1 cannot show confirmed until it is done |
| A file set aside | Its Question heads the Questions (section 5); its sheets are not in the list or the counts |
| All confirmed | The bar: "Every sheet is confirmed or excluded: 21 in, 3 excluded." (no button) |
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

**Exclusion reasons: a fixed pick list** (amendment 9), numbered: 1 MEP · 2 Superseded · 3
Duplicate · 4 Cover or index · 5 3D or perspective · 6 Reference only · 7 Other (type why). Views
excluded by default (title block, legend, key plan, 3D) carry "Reference only" or "3D or
perspective". An excluded sheet stays in the count with its reason (ruling 4, story 30).

**Undo:** `Ctrl Z` undoes the last Confirmation, answer or exclusion; the toast names what it undid
("Undone: confirmed 20 sheets").

**Who did what** (ux-critic #12): every confirmed or excluded sheet shows "Confirmed by Nusrat
Jahan, 26 Sep 2026" or "Excluded by Arif Rahman (Vextrus), 26 Sep 2026: superseded" in the inspector.

---

## 6. Step 1 layout: pending the owner's judgement of the Step 1 prototype

Ticket 22 is not cut until the owner has judged the Step 1 prototype on invented sheets
(`.private/work/session-01/proto-step1/`, in progress) and the rulings are added here. The prototype
must answer, with measurements where a number exists:

1. **Where the sheet list lives,** and what the canvas keeps. Options: a docked list beside the
   canvas (at 1280 with a 360 px list, the canvas falls to about 552 px, 43%); the list inside the
   inspector's Selection tab (the canvas keeps 71%); or a list-first page with the sheet as a large
   preview. The accepted rule is canvas ≥ 70% of the width with the inspector open (system.md);
   ux-critic #2 measured about 490 px of sheet at 1280 with a 420 px drawer.
2. **What a 28 px row shows** of: number, title, Discipline, storeys (stated → normalised), revision
   mark, date, source file, "read from" (attribute or title-block text), status; and what moves to
   the inspector.
3. **Grouping:** exceptions first, then by Discipline in natural sheet order; or Disciplines with
   their exceptions inside. Where each Discipline's n / N shows, and how N's source ("from the
   drawing list on S-01", "from the Plot's pages", "—") is marked.
4. **Bulk scope:** one "Confirm 20 ↵" for the whole set, or one per Discipline group; whether a
   proposed MEP exclusion rides in the bulk Confirmation.
5. **Edit in place (`E`):** in the row or in the inspector; the storey-list editor with the "members
   at floor level / storey" choice (amendments 1–3).
6. **Views:** how the QS sees a sheet's views (outlines only, or a list in the inspector too), how
   the keyboard moves between views (no key is assigned yet; `,` and `.` are free), and how a view is
   assigned to several Takeoff Steps (amendment 5).
7. **The Question card's place:** the inspector's Questions tab, or inline under the sheet it holds.
8. **The drawing list:** where the QS pastes or types it (amendment 7) and how its source is marked.
9. **The exclusion picker at 1280:** seven reasons do not fit one row of the 720 px bar; two rows, or
   a numbered menu.
10. **Coverage in the inspector:** per sheet, then views with their status and Takeoff Steps.
11. **The MD's view** of the list and of an answered Question.
12. **Keystrokes and clicks for the whole of Step 1 on the seed** (the Takeoff prototype's measure:
    25 keystrokes for a whole step), and key-to-screen time.
13. **Whether the Step 1 keys in section 2 survive** (`↑ ↓` paging, `→ ←` groups, `S`, `X`, `E`, `Q`,
    digits), or which change.

---

## 7. The seeded demo project

Every UI PR is walked on this seed at 1440×900 and 1280×800 (screens.md, "How M0's screens keep this
quality" 3; ux-critic #4). All of it is invented; its DWGs and PDFs are made by the committed
synthetic-fixture script (ticket 04's `tests/fixtures/make_dwg.py`, extended) and go through the
product's real upload and read job. Where a state cannot be produced on demand (a set-aside file, a
stalled read), the seed uses the same stubs the API tests use, enabled only in development settings.
Passwords come from `VEXTRUS_DEMO_PASSWORD`; the seed never prints one. Ownership is open question 5.

**Developers and people.**
| Developer | Person | Email | Role |
|---|---|---|---|
| Shapla Homes Ltd | Nusrat Jahan | nusrat@shapla-homes.example | QS |
| Shapla Homes Ltd | Kamal Uddin | kamal@shapla-homes.example | MD |
| Shapla Homes Ltd | Arif Rahman | arif@vextrus.example | Vextrus Engineer, invited by Kamal Uddin, 30 days |
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
| KR-ARC-R0.dwg | 8 sheets: A-01 site plan, A-02 ground floor plan, A-03 typical floor plan, A-04 roof plan, A-05 "SECTION A-A & ELEVATION" (kind unclear), a door and window schedule with no number (burst title block), and on layout tabs A-06 and A-07 (a 3D view, excluded by default). Room names on A-02 and A-03 typed in SutonnyMJ | Read; two readers agree; 1 flag: Bangla text (9 texts on 2 sheets) |
| KR-ARC-R0.pdf | 8 pages, all matched; made by a PDF tool other than AutoCAD; lettering drawn as lines; no layers | Plot: 8 of 8 matched; lettering as lines |
| KR-MEP-R0.dwg | 3 MEP sheets, M-01 to M-03 | Read; proposed excluded: MEP. (The Drawing Set wireframe shows it mid-read) |
| KR-STR-old.dwg | an older structural file | Set aside: the readers disagree (the planted-disagreement stub) |
| site-photos.pdf | pictures only | Refused: a scan |

**KR-01 after reading.** 24 sheets found (13 + 8 + 3); 20 agree and can be confirmed in one act
(17 in, 3 MEP excluded). 5 Questions open: Q1 KR-STR-old.dwg may be misread; Q2 two sheets numbered
S-07 (pre-picked "keep rev B": the revision mark and the drawing list agree); Q3 the unnumbered
architectural sheet (no pre-pick); Q4 the kind of A-05 (no pre-pick); Q5 the drawing list and the
Plot both name S-13, which no DWG has. About 70 views: 52 assigned, 16 excluded by default (title
blocks, legends, the 3D view), 2 unaccounted (on the burst-title-block sheet) until the QS acts. The
QS's work ends with 0 unaccounted.

**The walks the seed must support:** every state in 4.2–4.7; the finish line's steps 2–8 and 10–11
in miniature; the spec's six traps (amendment 10: a multi-plan sheet, a non-run floor list, a
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
