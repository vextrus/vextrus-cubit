# M1's screens: the behaviour spec

Written 12 Oct 2026 (session 24) by M1-24, from the outline of 7 Oct 2026 (session 17). It is the
committed record of what M1's screens do, so that `cloud` build sessions, which cannot see the
private prototypes, build the same thing, and so that every M1 web ticket and the design gate judge
against one page. Terms are `CONTEXT.md`'s. Where this page and an ADR, `docs/specs/M1.md`,
`docs/plans/M1.md` or `docs/design/screens.md` disagree, those win until the owner rules; section 8
lists each place this page found them to disagree or to be silent, for the orchestrator. Everything
M0's spec settled (`docs/design/m0-screens.md`: the rules of §1, the key map's registry of §2, the
shared pieces of §3, Step 1's layout of §6, the design gate of §8) holds here unless a section below
says otherwise; this page adds M1's screens to it and does not repeat M0's.

Inputs: `docs/specs/M1.md` (signed: stories 1–121 and the web app section), `docs/plans/M1.md` as
amended in session 17 (the contracts C9, C12, C13, C15, C17 and C19 fix what each screen is sent;
C6, C7, C8, C10, C11 and C14 fix what it shows), `docs/design/screens.md` (the owner's rulings on the
Takeoff, the Priced BOQ grid, the sheet, the 3D, and the session-02 prototypes' judgements),
`docs/design/system.md`, `web/src/ui/keys/` (the registry as built), M0's screens as shipped in
`web/src/takeoff/` and `web/src/sheet/`, and the evidence of the session-16 slice's three screens
(Steps 3, 4 and 6; the 3D Live Model; the Priced BOQ with Market Prices), walked nine times on a
Development Set. Only the conventions of those walks are carried here: what broke and what the QS
could not do, never what any drawing says.

Every name, number, mark, sheet, level and figure on this page is invented. Nothing comes from a real
Drawing Set. The examples use M0's seed project, KR-01 Kadam Residence of Shapla Homes Ltd, a G+9
building of Ground, 1st to 9th and Roof; its QS is Nusrat Jahan, its MD Kamal Uddin, its Vextrus
Engineer Arif Rahman. Sheet numbers are the seed's style (S-08 column layout plan); marks, grid lines,
sizes and ৳ figures are made up for this page and are not the seed's rows. Where a figure is shown as
arithmetic (a column's volume, the strip's total, a Rate Analysis's sum, cement rounded up) it is
worked so that it can be checked by hand.

## What is not settled or not proven (read first)

- **Nothing here is prototyped as written.** The Takeoff, the Priced BOQ and the 3D were prototyped
  in sessions 01 and 02 and judged by the owner (`screens.md`); the slice built three screens from
  them without a spec. This page is the first spec; the design gate (7) is its first judge, and the
  owner's M1 walk the second.
- **The session-02 prototypes themselves are not on disk** in the main checkout's `.private/`. This
  page carries their behaviour and words through `screens.md`'s record of them (rulings, the keys the
  prototype used, what the owner said) and through the slice's built screens; nothing was re-walked
  in a prototype. Where `screens.md` is silent about a detail of a prototype, this page chose and says
  so ("settled here"), open to the owner's reversal at the M1 walk.
- **What the slice's walks showed** (each is a rule below, so the next build cannot repeat it):
  - Enter confirmed nothing, because the screen and the API used two words for a Proposal's state
    (1.1, 4.1);
  - the Questions tab said "No open Questions here" while the step counted many (4.1);
  - storey keys, band keys, Attribute keys and raw Trace tuples reached the screen (1.2, 5);
  - a Trace or Space opened the sheet with nothing highlighted (4.10);
  - a read that ended was never shown as ended on the page that started it (1.4);
  - the Gross Floor Area showed square metres in the sft box (4.15);
  - a BOQ description printed an empty strength in brackets (1.7, 4.13);
  - the 3D was reachable only by typing its address (4.11).
- **Where the contracts are silent.** Several things this page specifies a screen for have no route
  or no field in C9–C17 (editing a Rate Analysis's lines, listing Labour Contracts, the piling choice,
  editing allowances, reading the Rule Set, the Material Schedule's and the bar-bending schedule's
  routes, correcting the consultant office, what reopening does to later steps, and a few small
  fields). Section 8 lists each with the ticket that must add it and what the screen does meanwhile;
  until then that part is "specified, route open", and the ticket's builder cuts it by name under
  `## Cut` or finishes BLOCKED on that part alone.
- **The 3D's keys are settled here** (2.3), against `web/src/ui/keys/` as built and M0's reservations.
  The owner has not seen them; the prototype's own letters are kept wherever they do not meet a key
  the sheet or the Takeoff already owns.
- **No QS has read any of this wording,** as in M0. Every message below is my reading of a QS's
  words, not a QS's. `qs-critic` and `ux-critic` read this page before it merges; the owner's M1 walk
  and the outside QS's timed Takeoff test the words.
- **Not measured:** how many keystrokes a whole frame step takes in M1 (the prototype: 25 keystrokes
  for 58 columns and 4 Questions, screens.md); the strip at 1280 with every figure at lakh-and-crore
  width; the 3D's keys by anyone but the prototype's builders; the preview's reading time.
- **"Awaiting answer"** is CONTEXT.md's word for Elements a closed step holds at their best
  candidate; the slice wrote "Waiting on a Question". This page uses "awaiting answer" everywhere.

## Contents
1. Rules for every M1 screen
2. The key map: M1's additions (2.1 the registry's rules that bind M1 · 2.2 the Takeoff's keys ·
   2.3 the canvas and the 3D · 2.4 the grid and the panels · 2.5 collisions settled · 2.6 keyboard
   pan, #120)
3. Shared UI M1 adds
4. The screens: 4.1 a Takeoff Step (the frame-step screen) · 4.2 Step 2, general notes and
   specification · 4.3 Step 3, storeys and levels · 4.4 Step 4, grid · 4.5 Step 5, piles and pile
   caps · 4.6 Step 6, columns, shear walls and core · 4.7 Steps 7 and 8, beams, slabs and slab-edge
   members · 4.8 Step 1's additions · 4.9 the Drafting Profile panel and sheet overlays · 4.10 the
   Trace, the highlight and the preview · 4.11 the 3D Live Model and the Element inspector · 4.12 the
   3D's tools · 4.13 the Priced BOQ · 4.14 Market Prices, Rate Analyses, Labour Contracts and the
   piling choice · 4.15 project settings · 4.16 the Material Schedule and the bar-bending schedule
5. Names on screen: the web test that refuses a key (A17)
6. The seed M1's walks need (KR-01 after M1)
7. The design gate for M1 (7.1 its checks · 7.2 the keyboard walk each ticket does and the gate does
   again)
8. Where this page and the plan disagree or are silent
9. Open questions for the owner

---

## 1. Rules for every M1 screen

### 1.1 Words
- **CONTEXT.md's terms, exactly,** adding to m0-screens 1.1: Takeoff Step, Element, Element Family,
  Storey Band, Live Model, Priced BOQ, BOQ Section, BOQ Item, Measurement Line, Measurement Rule,
  Rule Set, Rate Analysis, Market Price, Resource, Mix, Wastage, Labour Contract,
  Material-and-Labour Contract, Cost Basis (measured, allowance), Rebar, Rebar Ratio, Rebar Basis
  ("by ratio", "from the drawing", "from the drawing + rules"), Billing Unit, Display Units, Gross
  Floor Area (never "GFA" on a screen), Material Schedule, Construction Stage, Drafting Profile,
  Attribute, Coverage, Trace.
- **"Live Model"** is the 3D's name on every screen and in the top bar; never "Building Model", "BIM",
  "3D view" or "digital twin" (CONTEXT.md). The route's page title is "Live Model".
- **A Proposal's state has one word on screen per state of the API's enum the QS can meet:**

  | `ProposalState` (generated union, A12) | On screen | Mark |
  |---|---|---|
  | `open` | "Proposal" | dashed square |
  | `blocked` | "Question Q4" (an open Question holds it and its step is open) | revision cloud with ? |
  | `held` | "Awaiting answer, Q4" (its step is closed with the Question open) | revision cloud, amber fill |
  | `confirmed` | "Confirmed" | solid square with a tick |
  | `excluded` | "Excluded" (with its reason where room allows) | circle with a slash |
  | `superseded` | never shown; such a Proposal is not in any list | — |

  The screen maps the generated union through one exhaustive `switch` (a missing case fails the
  typecheck); it never compares with a string it typed (M1.md C9, A12).
- **A Takeoff Step's state has one word, from `StepStatus` (generated union), through the same kind of
  exhaustive map:**

  | `StepStatus` | The word | Where it shows |
  |---|---|---|
  | `not_started` | "Not started"; "Opens after Step 3" while a step it needs is not closed | rail |
  | `reading` | "Reading" | rail |
  | `in_review` | "25 to confirm" (and ", 4 Questions" while any is open) | rail, toolbar |
  | `confirmed` | **"Closed"** (a tick) | rail, bar, toasts, the Priced BOQ's inspector |
  | `closed_with_questions` | "Closed, 2 awaiting answer" | rail, list heading |
  | `confirmed` with `none_found` (a step closed with nothing to read: no piles, no core) | "Closed, none" | rail, Who did what |
  | `reopened` | "Reopened, 4 to confirm" | rail |

  **A step is closed; Proposals and Elements are confirmed.** The word "confirmed" is never said of
  a step, and "closed" never of a Proposal. The slice's defect class (one state, two words) is
  refused by check 13 (7.1), which covers both unions and greps every screen's text for "confirmed" said
  of a step ("Steps 3 and 4 are confirmed", "Step 8 confirmed"). M0's Step 1 sentences "Step 1 is confirmed" are
  reworded "Step 1 is closed" by M1-18a's rail change (8, item 16).
- **A Takeoff Step's name** is the Library's name for it, from `web/src/app/steps.ts`'s catalogue
  messages ("Sheets", "Notes", "Levels", "Grid", "Foundations", "Columns", "Beams", "Slabs"). The rail
  shows the number and the name; a heading may say the long form ("Step 6, columns, shear walls and
  core") once, in the step's inspector overview.
- **Never shown,** adding to m0-screens 1.1's list: a storey or band key (`floor_1`, `floor_1..top`),
  an Attribute key (`vx.column.section_b`, `x_m`), a family key (`shear_wall`, `slab_edge`), an item
  code (`RCC-COL-1:1.5:3`), a Resource code (`cement_opc`), a stage code (`slab_casting`), a basis
  code (`from_drawing_rules`, `by_ratio`), a Trace's raw anchor (a handle, a hash, a reader's name,
  a sheet or view id, a bounding box, a tuple), a grid reference as a list or a pair of numbers, a Rule
  Set file name or a section sign pointing into one, a Question code (`engine.column.size_missing`),
  a message key, an act name (`close_with_questions`, `confirm_convention`). Section 5 is the test
  that refuses each shape in the DOM.
- **Messages say what happened, what it means and what to do,** in that order (m0-screens 1.1), in
  one or two sentences; no "Error:", no exclamation marks, no apologies. A refusal (`takeoff.steps.locked`)
  says which step and what to close first, and its action goes there.
- **Sentence case** for every label, button and heading. Drawing text (a mark, a sheet title, a layer
  name, a note's sentence) keeps the drawing's own case and is shown as drawn through `DrawingText`.

### 1.2 Names on screen (M1.md A17)
Every name a QS sees is a catalogue message or a confirmed name; it is never a key, an id or a value
the screen built by cutting a string.

| Thing | How it reads | Where the name comes from | Never |
|---|---|---|---|
| A storey | "Ground", "1st", "9th", "Roof"; before Step 3 is confirmed, the proposed name with its Proposal mark | Step 3's confirmed storey name (C19 `storeys[].name`; every API object sends `{id, name}`) | `floor_1`, "Floor 1", an index, an elevation used as a name |
| A Storey Band | "1st to 8th", low to high, from names; a band of one storey reads its name | the band's two storey ids resolved to names by `StoreyBandLabel` | `floor_1..floor_8`, "floors 1-8", a reversed pair |
| An Attribute | "Section b", "Concrete strength", "Cover to the sides" | `AttributeDefinition.labels` (C8; the API sends `label`) | `vx.column.section_b`, `strength_mpa` |
| An Attribute's value | in the Display Units with its unit: "10″", "500W"; **a strength in the drawing's own words in every project** ("3600 psi", also in a metric project; MPa in its Trace) | the API's formatted `value` and `unit` (C17) | a stored metre figure in a feet-inch field |
| A grid reference | "3/C" | C17's `grid_ref`; two plans' names for one line are one name once Step 4 is confirmed | `[3, "C"]`, "C3", "x=4.572" |
| An off-grid position | "3/C, 150 mm east" in the Display Units: "3/C, 6″ east" | the Element's `grid_offset` | raw metres |
| An Element | "Column C2 at 3/C, 4th" (family word, mark, grid reference, storey) | the family's catalogue noun + C17 fields | an Element id, "C2_floor_4" |
| A BOQ Item | its description (1.7) and its number "2.1.1" | the description template with its params | `RCC-COL-1:1.5:3`, a template with an empty param |
| A Resource | "Cement (OPC)", "Rebar, Grade 500W", "Sand (F.M. 2.2)" | the Library row's `labels` | `cement_opc` |
| A Construction Stage | "Piling", "Substructure", "2nd floor slab casting", "Masonry" | catalogue words + the confirmed storey name | `slab_casting`, `floor_2` |
| A Trace's source | "S-08 Column layout plan, 2nd to 9th" with the figure's own words | C17 `trace[].sheet {number, title}` + the view's title | a handle, a bounding box, a file id |
| A Question | its card's title in words ("Which BOQ Item prices 3600 psi concrete in columns?") and "Q4" | the code's message + params | `engine.spec_note.strength_item` |
| An act | "Confirmed 14 columns of 2nd to 8th", "Typed by Nusrat Jahan" | the act's catalogue message | `confirm`, `edit`, `close_with_questions` |

A description template **leaves out a param it lacks** (1.7); a name that cannot be resolved (a
storey id the page has not loaded) shows a skeleton bar, never its id; a name the catalogue lacks
fails the catalogue test (m0-screens 1.7) and, in a production build, shows the Question mark glyph
with "Unnamed", never the key. In the 3D canvas, where the DOM check cannot see, every label is
produced by one function (`canvasLabel`, 4.11) that accepts only named objects, with its own unit
test over the seed.

### 1.3 Figures
As m0-screens 1.2, adding money and quantities, which M1 first shows. Every figure comes out of its
kind's formatter in `web/src/format/` (M1-46's table `web/src/format/tests/expected-strings.json`,
checked by the server's `figure()` formatter, C16), already isolated left to right and marked
`data-notation` (m0-screens 1.8).

| Kind | Form | Notes |
|---|---|---|
| Money | one rule: **a grid cell carries paisa and no symbol** (its header says "Amount (৳)" or "Rate (৳)"): 3,68,247.77; **the strip carries whole taka with the symbol** (৳9,81,21,666) and under each figure its short form in the Market's words ("9.81 crore"; the MD reads it first); a figure in prose carries the symbol and paisa where it is a rate or an amount ("৳276.67") and whole taka where it is a total; lakh-and-crore grouping throughout | never ৳0 for a price not entered: "rate not entered" (4.13); the currency word is "taka" (the minor unit "paisa"), never "rupee"; a total's whole-taka rounding is for display only and the three parts add up as displayed |
| Quantity | 1,331.00 cft; 4,792.00 sft; 47 nos; 8,350 kg | in the BOQ Item's Billing Unit, rounded as the Rule Set says (each Measurement Line to 2 decimals; nos, bags whole; a Rebar line to 2 decimals of a kg and the item in whole kg, screens.md Priced BOQ ruling 6); the unit always beside the figure, in the cell or its header |
| Rate | 276.67 (header "Rate (৳) per unit") | "per cft" is the Billing Unit's word; a rate shows its unit once in its column header and in its Rate Analysis |
| Level | +10′-0″ or +3.048 m, always signed | isolated left to right, in the Display Units; a Display Units switch re-forms every level |
| Length and size | 14′-6″; 10″ × 20″; metric "4420 mm" or "4.420 m" | ft-in never grouped; **metric lengths in whole mm are never grouped** ("4420 mm", never "4,420 mm"); the Display Units pick feet-inches or metres with mm; an imperial project never shows a metric length except in brackets where the Market's profile asks, and a Rule Set parameter shows as it was set (a lap "2′-7½″", an over-cast "2′-0″", bar diameters in mm as Dhaka writes them) |
| Area, volume | 324 sft; 13.31 cft | grouped by the Market |
| Share | "Measured 7% of the total" | a whole percent written as the formatter writes it ("7%"), beside what it is a share of; never a percent alone |
| Count | 5 / 7 (n / N), `—` for an N the drawing does not give | M0's Count; "5 / 7" never "71%" |
| Date | 12 Oct 2026 | m0-screens 1.2; times in the Market's zone, never named |
| Ratio | "1:1.5:3" | a Mix; "0.22 cft per sft" for an allowance's consumption, with its unit |
| Rebar Ratio | "5.1 kg per cft" | the Rebar Basis "by ratio" always shows its ratio (4.1.3, 4.10.2, 4.13); a whole-building "3.53 kg per sft" beside the usual range (4.13.1) |

**Money and quantities are grouped as the Market groups them; coordinates, dimensions and marks
never** (CONTEXT.md, Display Units). A number typed by the QS is accepted in either grouping
("1,24,56,780" and "12456780") and echoed in the formatter's form on blur.

### 1.4 The four states every M1 screen has
Each screen in 4 fills these in; the words here are the pattern.

| State | What shows |
|---|---|
| **Empty** | m0-screens' Empty: a glyph, one sentence saying why, one action ("No columns yet. They are read from the plans confirmed in Step 1." · "Read the columns") |
| **Loading or reading** | m0-screens' Skeleton with one line of what is happening ("Reading the columns from 6 plans…"); a read shows its end on the page that started it and on any page opened during it ("Read: 42 Proposals, 2 Questions"); the line stays until the QS acts or presses Esc, so a read that finished while the QS looked away is still announced |
| **Refused** | m0-screens' ErrorBar with the refusal's words from its code (`takeoff.steps.locked`: "Step 6 opens once Steps 3 and 4 are closed." with "Go to Step 3"). A refusal is never a toast that vanishes. A write refused by the API (a 4xx `{code, params}`) shows its words in the ErrorBar at the act's own place and keeps what the QS typed |
| **Held** | What waits on a Question, in its rows, its figures and its 3D tint, with the action "Answer Q4": while its step is open it reads "Question Q4" (`blocked`); once the step is closed with the Question open it reads "Awaiting answer, Q4" (`held`) |

Two more states belong to every screen that shows money or a model:
- **Out of date:** a figure the API says rests on a Rule Set or price set that has changed since the
  page loaded (a changed `figures_hash` on a response, which C13 does not yet carry: section 8, item 8) shows the quiet bar
  "Figures changed while you were away. Refresh to see them." with "Refresh"; the page never
  refreshes itself under the QS's hands.
- **Offline or refused session:** M0's (m0-screens 4.1); typed text is kept.

Every M1 page that has a read-only form shows M0's ReadOnlyChip ("Read only: MD" / "Read only: Guest")
in its toolbar or page header, and an act's key shows the toast of 1.5 for that screen family.

### 1.5 Roles
As m0-screens 1.4. The MD and a Guest see every M1 screen read-only: no Confirmation bar acts, no
price edit, no profile confirmation, no tool that writes; a key that would change something shows the
toast of that screen family: "As MD you can look at the Takeoff but not change it." (a Guest: "As a
Guest you can look at the Takeoff but not change it."); on the Priced BOQ "…the Priced BOQ…", on Prices
"…the prices…", on Project settings "…the project settings…", on the Material Schedule "…the Material
Schedule…". **Undo is per page:** an act made in the 3D is undone in the 3D until the QS leaves it, then
on the step it belongs to; Prices and Project settings undo their own last save. The MD sees the Priced BOQ, the Material Schedule and the 3D
first; the Takeoff is one link away. M1's additions:
- **The MD's landing** from the project page is the Priced BOQ (the strip first). It reads for the
  MD as a document, with no field and no action the MD cannot take: "The Gross Floor Area is not
  entered yet. Nusrat Jahan (QS) enters it." and "14 BOQ Items have no rate yet; the QS enters
  prices." (the names are the project's QS and Vextrus Engineers, by role).
- **A Guest is money-blind until the owner rules** (9, item 5): the Priced BOQ, Prices, the Material
  Schedule's amounts and the project settings' allowances show "Ask the Developer for access to costs"
  in place of any amount, quantity-only views excepted; the Takeoff and the Live Model are open to
  read.
- **The Vextrus Engineer** works as a QS: every act, price edit and typed level shows under their own
  name with "(Vextrus)" after it (m0-screens 1.4); "Who changed this price" says so.
- **Typed values name who typed them** ("typed by Nusrat Jahan, 7 Oct 2026"), for every role.
- **The viewer tools** (measure, sections, filters) are read-only acts on the picture, not on the
  Takeoff: the MD and a Guest may use them and are not refused by the toast above.

### 1.6 Every figure opens its Trace
Every figure a QS reads (a quantity, an amount, a size, a level, a count) opens its Trace by click or
by `T` with it focused (2): the Measurement Lines behind it, the Elements behind those, the sheet each
was read on with the source highlighted (4.10). A figure typed by the QS says "typed by Nusrat Jahan,
7 Oct 2026"; a derived figure names what it was derived from ("derived from the 2nd's slab level"; "a
Rule Set default: slab 127 mm"); a figure supplied by a Question says "from Q4, answered by Nusrat
Jahan, 7 Oct 2026". A figure with no Trace is a defect, never an empty popover: the popover of a
figure the API sent no Trace for says "No source was recorded for this figure." and the page reports
it in development builds.

### 1.7 Descriptions, units and the catalogue
- **A BOQ Item's description is its template filled by its params, and an optional param that is
  missing takes its whole fragment with it.** The API sends `description: {code, params}`; the web's
  `describe(code, params)` (owned by M1-20, `web/src/boq/`) builds it from the catalogue's fragments:
  each optional param has one fragment message holding its words, brackets, unit and the space
  before it ("f′c {strength_text},"); a param that is absent, `null`, empty or only whitespace drops
  its fragment. **The strength shows in the drawing's own words** (`strength_text`, "3600 psi"; the
  other unit is in its Trace), because a rounded unit that differs from the drawing invites "who
  changed the grade?"; a description names what a Dhaka QS signs: mix, aggregate, cement, strength,
  class, and "excl. formwork and Rebar". A table test covers every template with every optional
  param present and absent: `RCC {mix}, {strength_part} in {class} ({chips}, {cement}), excl. formwork
  and Rebar` with no strength reads "RCC 1:1.5:3 in columns (stone chips 20 mm down, OPC), excl.
  formwork and Rebar", never "RCC 1:1.5:3, f′c  in columns"; the Rebar item with no grade reads "Rebar
  in columns, by ratio". The names check (5) also refuses an empty bracket or a bracket holding only a
  unit in any visible text.
- **Every string is a message in the English catalogue** (m0-screens 1.7), and machine-written
  sentences arrive as `{code, params}`: the Question cards, Check findings, Measurement Rule words, the
  Rate Analysis's source line, the refusals. Each ticket words its codes in `web/src/messages/` and a
  backend ticket that words codes there gets a `ux-critic` words review (CLAUDE.md).
- **Units come from the project's Display Units** (CONTEXT.md): imperial "cft, sft, rft, bags, ton"
  or metric "m³, m², m, kg, ton"; a unit's word comes from the catalogue with its plural rule, and a
  switch re-forms every figure from SI by the API, never by the page multiplying.

### 1.8 Left to right, logical CSS, one Market
M0's rules 1.8–1.10 hold unchanged: drawing notation isolated left to right with `data-notation`
(a grid reference `grid`, a mark `mark`, a level `level`, a length `length`); logical CSS only; the
canvases (`LtrCanvas`, the 3D canvas) fixed left to right and never mirrored; one Market (no Market
name ("Bangladesh", "the Market"), no currency choice anywhere while there is one: a Rule Set reads
"Standard rules, version 1", its Library label; a DOM grep for the Market's names is in check 12);
one Building, no picker and no "Building 1".
M1 adds two notations: **money** and **quantity** are not drawing notation and follow the page's
direction, but their unit and symbol sit inside one isolate with the figure (`<bdi>`), so a figure
and its unit never separate in a right-to-left language; the pseudo right-to-left test (m0-screens
1.8) runs M1's Priced BOQ, the strip and the 3D's chrome too.

### 1.9 Desktop only, widths, and the performance flag
The QS screens need 1280 px (ADR 0016); M0's phone and narrow notices hold. M1's width budgets:
- the frame-step list is 912 px at 1280 and 1072 px at 1440 (M0's list), with the rail and the 320 px
  inspector unchanged;
- the Priced BOQ grid uses the same canvas (912 px at 1280, 1072 px at 1440; the inspector stays,
  there is no drawer): its fixed columns total 484 px at 1280 and 602 px at 1440 and the Description
  takes the rest, 428 px and 470 px, never under 330 px (4.13.2);
- the 3D's canvas is at least 70% of the width with the inspector open at 1280.

`?perf` and `?bench` show readouts only behind the flag (m0-screens 1.6); the 3D's meter and the
frame-step screen's key-to-frame line are in the DOM only with it.

### 1.10 The web computes no figure and compares no state string
The web shows what the API sends: it never sums Measurement Lines, multiplies quantity by rate,
converts units, or builds a Storey Band's name from keys; a test that finds `*` or `+`
between two API figures in `web/src/boq/` is a lint (M1-20 adds it). The only arithmetic is layout.
The one exception is the 3D's measuring tools (4.12), whose results are geometry on the picture and
say so ("on the model, not a BOQ figure"). A share is the API's part and whole, which the formatter
rounds and writes ("7%"); nothing is derived on the page.

---
## 2. The key map: M1's additions (through `web/src/ui/keys/`)

Every key below registers through the registry (`useKeys`, m0-screens 2.1); no screen adds a
`keydown` listener, and no screen adds a key without a label (the registry's test fails on both).

### 2.1 What the registry as built does, and what M1 needs it to do
Read from `web/src/ui/keys/registry.ts` and its provider (12 Oct 2026):
- **Scopes, highest first:** dialog → mode → region → screen → global. A `modal` mode scope takes
  every key. The highest scope with an active binding takes the key; lower scopes never see it.
- **A binding** is `{key, label, group, when?, run}` with `group` one of `screen`, `sheet`, `global`
  (the overlay's three headings: "On this screen", "On the sheet", "Everywhere"). Keys match on
  `event.key`, letters are case-folded, `Shift` is a written modifier (`Shift F`, `Shift ↑`,
  `Shift Enter`), `Esc` and `Escape` are one key, and browser keys (Ctrl W, T, N, L, R, Tab-switching,
  F5, F11, F12) cannot be bound. Typing wins in a text field, **except that every `Ctrl` combination,
  and `Esc`, `Enter`, `Tab` and `Shift Tab`, still reach the map** (`reachesMapWhileTyping`): so a
  form with fields (4.1.2's "Add an Element", `E`'s edit) is a scope of its own, binding `Enter` and
  `Esc` above the screen's, or an `Enter` typed in its field would confirm the group; and `Ctrl Z`, `Ctrl C` and `Ctrl V` carry
  `when: () => !editingField` on every screen that binds them, **and so does every other `Ctrl`
  combination a region binds** (`Ctrl A`, `Ctrl Home`, `Ctrl End`, `Ctrl Enter`, `Ctrl K` excepted:
  that one is global and opens the jump list from a field): the field's own undo, select-all, caret
  moves, copy and paste win while a price, a level or a size is being typed, and the walk has a line for it (7.2, KW-P1).
- **What it does not yet have, and M1 adds** (the first M1 ticket that needs each, as a four-line
  change with its test, so no two tickets edit the file in parallel):
  - two more overlay headings, `model` ("On the Live Model") and `grid` ("In the grid"), added to
    `KeyGroup` and the overlay's order by **M1-25** (wave 3), which M1-20 and M1-26 to M1-28 import;
  - nothing else: region scopes, `when` guards and modes are enough for everything below.
- **The F6 order** gains the rail: top bar, **rail**, list or grid, canvas, inspector, status bar
  (m0-screens 2.2 had no rail stop, so a keyboard-only QS could not open a step). In the rail
  `↑ ↓` move, `Enter` opens the focused step, `Home` `End` the first and last; the rail opens to its
  288 px state while it has focus, showing the words of 4.1.1, and collapses to 48 px on leaving.
  **`Ctrl K`** lists "Step 2, Notes" to "Step 8, Slabs" (and Step 1), "Priced BOQ", "Live Model",
  "Material Schedule", "Prices", "Project settings" and "Drafting Profile".
- **Tool modes are not `modal`:** a tool in the 3D (4.12) is a mode scope with `modal` false, so it
  binds only its own keys and the tool-switching letters, `Delete`, `I`, `R`, Shift + an arrow and
  `[ ]` still act; only a dialog is modal.
- **Widget regions:** the view cube, the storey list and the grid are `data-key-region` regions that
  own their arrows and `Space` (as a radiogroup, a menu or a tablist would), not bare `role=grid` or
  `listbox`; a tablist takes `← →` when it has focus and is the first stop of its page's region order.
- **One key in two scopes is the design; two in one scope is a bug** (m0-screens 2.1). Where this
  page binds one letter on two screens (`A`, `S`, `O`, `Z`), the two screens never share a keymap:
  the overlay lists only the keys active on the screen in front of the QS.

### 2.2 The Takeoff's keys (a frame step, Steps 2 to 8)
They follow `screens.md`'s Takeoff ruling ("Enter confirms a group or one element; → / ← review one by
one; X excludes with a reason; E edits a size; a number key picks an answer; Ctrl Z undoes; Esc
returns from a Trace") and extend M0's Step 1 map (m0-screens 6.15). "Region: list" means the list of
Proposal groups has focus; "canvas" means the source sheet is open across the canvas (4.1).

| Key | Scope | What it does (the `?` overlay's label) | Ticket |
|---|---|---|---|
| `↑` `↓`, `Home` `End`, `Enter` | region: the rail | Move over the steps and open the focused one (the rail is a stop in the F6 order and opens to its words while focused; 2.1) | M1-18a |
| `Enter` | screen | What the Confirmation bar says: confirm the focused group or Element; answer the focused Question; close the step when nothing is open; **after a close, go to the next step** (4.1's bar table). A repeat is ignored | M1-18a |
| `Ctrl Enter` | screen (a group focused) | Confirm everything that agrees on this step, the bar's "Confirm all 86 that agree" (the chip reads "Ctrl ↵") | M1-18a |
| `Shift Enter` | screen | Close the step with its open Questions: only when the bar says "Close with 2 Questions open" (the chip reads "Shift ↵"). Nothing else uses it | M1-18a |
| `↑` `↓`, `Home` `End` | region: list | Previous / next row: a group, an Element in review, a Question's row. In the canvas, `↑ ↓` page to the previous / next **group's** first source (Step 1's paging) | M1-18a |
| `→` | region: list (a group focused) | Review one by one: open the group, focus its first Element, and (canvas open) fly to its source; then `→` is the next Element | M1-18a |
| `←` | region: list (in a group's review) | The previous Element; before the first, stay. `Esc` leaves the review | M1-18a |
| `→` `←` | region: canvas (the sheet open, a group in review) | The same: next / previous Element, the canvas flying to its source and the bar's counter ("Column 3 of 14") following. **Focus:** `Space` from a row moves focus into the canvas; `→` from the list with the sheet closed keeps focus in the list; either way the review's keys work where focus is | M1-18a |
| `Space` | region: list and region: canvas | List ⇄ Sheet: open the focused row's source sheet across the canvas with its source boxed (`?highlight=`); again, return to the list with the same row focused (m0-screens 2.3 item 10). A row with no sheet source shows its Trace's words instead and does not open a sheet | M1-18a |
| `X` | screen | Exclude the focused group or Element, with a reason: the picker of 4.1 (a mode that claims every digit) | M1-18a |
| `E` | screen | Edit the focused value in the inspector: a size, a level, a storey's name, a count (4.1's form); `Enter` saves and moves to the next value, `Esc` cancels | M1-18a |
| `Q` | screen | Focus the group row the next open Question holds, in the queue's order (4.1); its card shows in the inspector, and `1`–`9` then pick | M1-18a |
| `1`–`9` | screen (the focused group's Question, shown in its card) | Pick that answer on the card; a pick changes nothing until `Enter` or "Answer". When the picker (X) is open it claims every digit | M1-18a |
| `Ctrl Z` | screen (not while a field is being edited) | Undo the last act on this step, naming it in the toast. An answer that confirmed or excluded Elements is never undone, nor anything before it (m0-screens 6.9) | M1-18a |
| `Enter`, `Esc` | form: Add an Element (its own scope, above the screen's) | `Enter` adds, from any of its fields; `Esc` closes the form, a second `Esc` leaves the pick mode | story 125 |
| `Shift A` | screen (a frame step in review) | Add an Element not read from the drawing: pick its entity on the sheet, name the family, `Enter` adds (4.1.2); `Ctrl Z` removes it | story 125 |
| `T` | screen (a figure focused) | Open the focused figure's Trace (4.10); `T` again, or `Esc`, closes it | M1-23 |
| `←` `→` | dialog: a Trace | Step through the figure's sources: the sheet flies to each in turn | M1-23 |
| `G` | screen | Go to the same Element in the Live Model (the 3D opens with it selected); from the 3D, the same key goes to its row in its step | M1-18a, M1-25 |
| `Shift O` | region: canvas | Show or hide what this step read on the sheet (the overlays of 4.9) | M1-18b |
| `Shift P` | screen | Open the Drafting Profile panel (replaces the inspector's content; `Esc` closes) | M1-18b |
| `A` | screen (Step 1, sheet mode, a view selected) | Assign the view to Takeoff Steps (M0 reserved it; 4.8) | M1-19 |
| `W` | screen (Step 1, sheet mode) | Draw a view or, in a file's drawing, a sheet: a window of two corners (a mode; `Esc` cancels) | M1-19 |
| `Shift W` | screen (Step 1, sheet mode, a view selected) | Split the selected view: a window inside it becomes its own view | M1-19 |
| `D` `P` `F` `Shift F` `Z` `O` `+` `−` `[` `]` | sheet | As M0 (the sheet's own keys): CAD-dark, Plot, fit, working view, zoom to the view, outlines, zoom, page sheets | M0 |

**`Esc`'s stack in a frame step** (m0-screens 2.2, unchanged, listed for the walk): the Trace
popover; a dialog or the Profile panel; the exclusion picker, an inline edit or the Add an Element form (then its pick mode); one-by-one review;
the open sheet (back to the list); the selection. Never the page; never typed text without asking.

### 2.3 The canvas and the 3D
The sheet canvas keeps M0's keys. The 3D (the `/p/{code}/model` route, 4.11) registers at **screen
scope on that route** (group `model`), because the tools are modes of one canvas and the route has no
sheet; a letter the sheet owns can therefore be used again here without a clash. Where the 3D opens a
sheet (a Trace, `Space`), it navigates to the sheet route with `?highlight=`, and `Esc` from there
returns: the two keymaps are never mounted together.

| Key | Scope | What it does (the overlay's label) | Notes | Ticket |
|---|---|---|---|---|
| `V` | screen (the 3D) | Select (the default tool): click picks an Element; `Ctrl` click adds; double-click on a column or wall picks its whole Storey Band | M0 reserved `V` for select on the canvas: kept | M1-25 |
| `Shift V` | screen (the 3D, an Element selected) | Select the whole Storey Band of the selected column, wall or core | the inspector's "Select the whole band" button does the same | M1-25 |
| `H` | screen (the 3D) | Hand: a left drag pans for as long as the tool is on | M0 reserved `H` as the pan tool: kept. On the sheet a left drag already pans, so `H` is unbound there | M1-25 |
| `M` | screen (the 3D) | Measure a distance: two points, snapping; `Enter` ends a chain | prototype's key kept | M1-26 |
| `A` | screen (the 3D) | Measure an area on a face | prototype's key kept; Assign's `A` is Step 1's, a different screen | M1-26 |
| `L` | screen (the 3D) | Lengths: show the selected Element's own dimensions and a beam's clear spans | the prototype's `T`; moved so `T` is the Trace everywhere. M0's reservation of `L` for "layers" is released: no M1 ticket draws a layers panel | M1-26 |
| `S` | screen (the 3D) | Section plane: on a grid line or at a level; `← →` (with the plane focused) step it | prototype's key kept; Step 1's `S` (sheet picker) is a different screen | M1-27 |
| `B` | screen (the 3D) | Section box | prototype's key kept | M1-27 |
| `C` | screen (the 3D) | Colour by: opens the Attribute menu (Status, Family, Storey, Mark, Grade, Mix, Construction Stage, a Developer's own); `↑ ↓` and `Enter` | prototype's key kept | M1-28 |
| `I` | screen (the 3D) | Isolate the selection (everything else hidden) | | M1-25 |
| `Shift I` | screen (the 3D) | Ghost the rest: isolate with the others faint | | M1-25 |
| `Delete` | screen (the 3D) | Hide the selection (not delete: the chip "3 hidden" appears; `R` shows them) | `Backspace` the same, for laptop keyboards | M1-25 |
| `R` | screen (the 3D) | Show all: clear isolate, hide, ghost, colour-by and filters | | M1-25 |
| `Z` | screen (the 3D) | Zoom to the selection | as `Z` zooms to the selected view on the sheet | M1-25 |
| `F` | region: canvas | Fit the Live Model (the opening view's framing: the building above ground) | as `F` fits the sheet | M1-25 |
| `Shift F` | region: canvas | Back to the opening view | as `Shift F` goes back to the working view | M1-25 |
| `O` | screen (the 3D) | Orthographic ⇄ perspective | the QS opens orthographic, the MD's link perspective (screens.md ruling 8); `O` on the sheet is outlines, a different screen | M1-25 |
| `←` `→` `↑` `↓` | region: canvas | Orbit and tilt, 5° a press (ortho: the view rotates about the model's centre) | the sheet's arrows page and step; the 3D has no list | M1-25 |
| `Shift` + arrow | region: canvas | Pan by a tenth of the view (2.6) | #120 | M1-25 (and the sheet: M1-18a) |
| `+` `−` | region: canvas | Zoom about the centre | as the sheet | M1-25 |
| `[` `]` | screen (the 3D) | Previous / next Element in the list order (storey, family, mark); the inspector follows | as `[ ]` page sheets | M1-25 |
| `Q` | screen (the 3D) | Select the next Element held by an open Question and open its card | | M1-25 |
| `Enter`, `X`, `E`, `Ctrl Z`, `1`–`9` | screen (the 3D; `Ctrl Z` not while a field is edited) | The Takeoff's, on the selected Proposal or its Question: the same bar, the same picker, the same undo | session 01's Confirm bar kept (spec: "the Confirm bar with Enter and Undo") | M1-25 |
| `Space` | screen (the 3D) | Open the selected Element's source sheet, highlighted | | M1-25 |
| `T` | screen (a figure in the inspector focused) | Open that figure's Trace | everywhere | M1-23 |
| `G` | screen (the 3D) | Go to the Element's row in its Takeoff step | | M1-25 |
| `Esc` | stack | Close the Trace or a menu; leave the tool (back to Select); clear the selection; nothing else | | M1-25 |
| `?` | global | The overlay, with the 3D's keys under "On the Live Model" | | M0 |

**The storey list** (a region on the 3D route; the `List` primitive): `↑ ↓ Home End` move; `Enter`
isolates the focused storey (again, shows all); `Space` cuts the plan at it (again, un-cuts); the
first row, "Foundations", is a toggle that `Enter` or `Space` flips. The list opts out of the
primitive's selection-by-Space, as Step 1 does (m0-screens 2.3 item 10).

**The view cube** is focusable (`F6` reaches it as part of the canvas region): `← → ↑ ↓` move over
its faces and corners, `Enter` snaps the view to the focused one.

### 2.4 The grid, the panels and the pages
| Key | Scope | What it does | Ticket |
|---|---|---|---|
| `↑` `↓` `←` `→` | region: the Priced BOQ grid (group `grid`) | Move the cell focus. A heading row is one cell wide | M1-20 |
| `Home` `End` | region: the grid | First / last cell of the row. `Ctrl Home` `Ctrl End` (not while a field is edited): first / last row | M1-20 |
| `PageUp` `PageDown` | region: the grid | A screenful up / down | M1-20 |
| `Enter` | region: the grid (a BOQ Item row) | Open or close the item's Measurement Lines under it (4.13) | M1-20 |
| `F2` | region: the grid (a rate focused) | Open the BOQ Item's Rate Analysis inline; `Esc` closes. Never an editor for the rate (screens.md Priced BOQ ruling 3) | M1-20 |
| `T` | region: the grid (a quantity, rate or amount focused) | The figure's Trace: the Measurement Line's, the rule's, the sheet's | M1-23 |
| `Shift` + arrow | region: the grid | Extend the selected range by a cell; `Ctrl A` (not while a field is edited: the field's select-all wins) selects every figure of the focused column, `Shift Space` the focused row | M1-20 |
| `Ctrl C` | region: the grid, the Material Schedule's grid, the bar-bending table (not while a field is edited) | Copy the selected range as tab-separated plain numbers, headings as text ("Copied 12 values.") | M1-20, M1-22 |
| `Ctrl V` | region: the grid (typed cells only; not while a field is edited) | Paste lines up as Excel does; read-only cells are skipped and the grid says what it skipped | M1-20 |
| `Tab` | region: the grid | Stays in the grid: next cell (screens.md Priced BOQ ruling 5); the grid's foot says "Tab moves between figures. F6 leaves the grid." (WCAG 2.1.2's documented exit) | M1-20 |
| `F6` | global | Leaves the grid for the next region (that a page can intercept F6 on Windows Chrome is **unproven** here; the owner's Windows walk checks it, and `Shift F6` and `Ctrl K` are the fallbacks) | M0 |
| (the arrows above) | region: the grid | **One `↓` handler**, so the registry never sees two bindings: it moves to the next row, or, from a figure that has an awaiting-answer second line, to that line first (its own focus stop; `Enter` there opens its Question). The overlay's label: "Next row, or the awaiting-answer line" | M1-20 |
| `S` | region: the grid | Switch the view: By item ⇄ By floor | M1-20 |
| `E` | region: the grid (a typed cell: an allowance consumption, a Lump Sum amount) | Edit it; `Enter` saves, `Esc` cancels | M1-20 |
| `Enter` | region: a price list row (4.14) | Edit the focused price; `Enter` saves and moves to the next row, `Esc` cancels (the field restores the old price) | M1-21 |
| `Ctrl Z` | region: the Prices page (not while a field is edited) | Undo the last save on this page, naming it in the toast | M1-21 |
| `←` `→` | region: a page's tablist (Prices, Material Schedule) | Switch tab; the tablist is the page's first region stop | M1-21, M1-22 |
| `F2` | region: a price list row | Show which BOQ Items use this Resource (the used-by list) | M1-21 |
| `Enter` | region: the Material Schedule's grid | Open the cell's BOQ Items (4.16) | M1-22 |
| `Enter` | region: the Profile panel (a convention focused) | Confirm that convention; `E` corrects it; `↑ ↓` move; `Esc` closes the panel | M1-18b |

The grid's `Enter` and `F2` are region scope in the grid; `Enter` as the Confirmation bar's key is
screen scope on Takeoff screens, which have no grid, so the two never meet.

### 2.5 The collisions this page settles
| Collision | Settled as | Why |
|---|---|---|
| `V` and `H` (M0 reserved them on the canvas for select and pan; the session-02 prototype used `V` for derived plans) | **`V` select, `H` hand, on the 3D only.** Derived plans are M2's and take another letter then; M2's spec chooses it | The owner's judgement of session 01's 3D kept every capability; M0's reservation was for the canvas; the sheet's left drag already pans, so the sheet needs neither letter |
| `D` (prototype: placed dimensions; sheet: Paper ⇄ CAD-dark) | **`D` is the sheet's CAD-dark and nothing in the 3D.** Placed dimensions are M2's and take another letter | `D` is already registered on the sheet (`web/src/sheet/LookSwitches.tsx`); one letter, one meaning wherever it is live |
| `P` (prototype: presentation; sheet: As read → Plot → Compare) | **`P` is the sheet's and nothing in the 3D in M1.** Presentation (M2) takes another letter | as `D` |
| `T` (prototype: an Element's dimensions; M0: Trace) | **`T` is the Trace everywhere**; dimensions are `L` ("lengths") | A figure's Trace must be one key on every screen (1.6) |
| `A` (Assign in Step 1; the prototype's area) | **Both**, on screens that never share a keymap (4.8, 4.12); the overlay shows only the live one | Moving either loses the prototype's judged key or M0's reservation; neither screen mounts the other's keys |
| `S` (Step 1's sheet picker; the prototype's section plane) | **Both**, same reason | as `A` |
| `O` (outlines on the sheet; ortho ⇄ perspective on the 3D) | **Both**, same reason | as `A` |
| `Z` | Zoom to the selected view (sheet) or Element (3D) | the same idea on each canvas |
| `W` (M0: select by window), `L` (M0: layers) | `W` is the window that draws a view in Step 1's sheet mode (4.8) and unbound elsewhere; `L` is the 3D's lengths (above) | the window is the reservation's own gesture; no M1 ticket draws a layers panel |
| `G` | Go to the same Element in the other view (Takeoff ⇄ Live Model) | free on both |
| `N` (prototype's note pins) | Unbound; M2's | |
| `1`–`9` | Pick an answer on the focused Question card; the picker (a mode) claims every digit while open (m0-screens 2.3 item 4); in the 3D digits do nothing unless a held Element's card has focus | no digit shortcut for views or storeys: the storey list is the way |
| `Delete` | Hides on the 3D; nowhere else deletes anything in M1 | "Delete" never destroys in this product; the chip says so |
| Inside a tool: `Backspace` (hide, 2.3) and "remove the last point" (4.12.1) | the tool's own binding wins while the tool is on (a mode outranks the screen) | tools are modes, not modal (2.1) |
| Inside a tool: `R` (show all, 2.3) and "reset the box" (4.12.3) | `R` resets the box while the box tool is on and shows all otherwise | same |
| Inside Measure: `Enter` (the Takeoff's confirm, 2.3) and "end the chain" | ends the chain while Measure is on | same |
| Inside the section tool: `← →` (orbit) and "step the plane" | step the plane while the plane has focus; orbit otherwise | same |

### 2.6 Keyboard pan (#120)
The sheet viewer's adversary finding (#120): "Keyboard-only users cannot pan (arrows are reserved for
paging)". Settled for both canvases: **`Shift` with an arrow pans by a tenth of the visible span**
(`Shift ←` moves the view's centre left by that step; held, it repeats at the OS's rate), and the
bare arrows keep their meaning: paging and stepping on the sheet (m0-screens 2.2), orbit and tilt in
the 3D. The sheet binds it at region scope on the canvas (M1-18a, as a small addition to
`web/src/sheet/SheetViewer.tsx`'s bindings, since the sheet is the viewer's; ownership: section 8, item 11); the 3D binds it in M1-25. `Shift ↑`/`Shift ↓`
in Step 1's list still extend the selection: the list is a different region, and the canvas is not
focused then. The overlay lists "Pan the view" under "On the sheet" and "On the Live Model".
The walk (7.2) checks that a QS can reach every part of a sheet and of the model with the keyboard
alone.

---

## 3. Shared UI M1 adds
Owned by the first ticket that needs each, in `web/src/ui/` (or the folder named), imported by later
tickets; none restyles another's. Each is judged at the design gate on `/dev/specimen` with invented
data first (m0-screens 3), then on the seed.

| Piece | What it is | States and rules | Owner |
|---|---|---|---|
| **ProposalGroupRow** | One row of a step's list: the group's name (a mark within a Storey Band, a grid line, a storey), the n / N count of its Elements, its StatusMark, its first Question's number, its quantity and its basis | 28 px; focus survives re-render; a blocked row shows "Question Q4" and is never in the bulk act; a held row "Awaiting answer, Q4"; columns by 4.1 | M1-18a |
| **ElementRow** | One Element inside a group's review: "C2 at 3/C, 4th", its size, its state | indented 16 px under its group; excluded Elements struck through with their reason | M1-18a |
| **QuestionCard** | M0's card (m0-screens 6.7), unchanged: "what answering does" first in the grey band, options as radio rows with number keys, "Answer Q4 ↵" and "Ask later"; the pre-pick rule of 4.1 | in the inspector's Questions tab; a held Question shows "Awaiting answer" in its header | M0's 22; M1-18a reuses |
| **StoreyBandLabel** | "1st to 8th", low to high, from confirmed names; one storey reads its name | takes `{id,name}` pairs, never keys; a band whose names are not loaded is a skeleton bar | M1-18a |
| **MoneyCell**, **QuantityCell** | Right-aligned figures by 1.3, with "rate not entered", "—" and the Billing Unit; a second muted line for "awaiting answer" | tabular figures; `T` focus ring; the unit sits in the header on the grid, beside the figure elsewhere | M1-20 |
| **BasisMark** | Cost Basis (measured, allowance) and Rebar Basis (by ratio, from the drawing, from the drawing + rules) glyphs with their words | never a glyph alone (m0-screens 3): the word is always shown, on the Description's second line in the grid at both widths; tooltips open on focus as well as on hover | M1-20 |
| **Strip** | The money summary of 4.13: measured, awaiting answer, allowance, total, per area, measured share, unpriced count | two rows at 1280, one at 1440; each figure focusable and Trace-able; whole taka with its short form beneath (1.3) | M1-20 |
| **TracePopover** | A figure's sources, stepped with `← →`, each opening its sheet highlighted; the derived and typed forms (1.6) | a dialog scope; focus returns to the figure on close | M1-23 |
| **ProfilePart** | One part of a Drafting Profile with its convention, evidence and "Confirm" | 4.9 | M1-18b |
| **PreviewTable** | A group's Measurement Lines in Billing Units, not stored, with their total | 4.10 | M1-23 |
| **DrawingText, formatters** | M0's, used for every drawn string and figure | no change | M0 |

### 3.1 Routes, page titles and the top bar
Proposed here; the owning ticket fixes each in `web/src/app/` and its `paths`.

| Screen | Route | Page title | Ticket |
|---|---|---|---|
| A Takeoff Step | `/p/{code}/takeoff/{step number}` (M0's), with `?sheet=` and `?highlight=` | "Step 6 Columns" | M1-18a |
| Priced BOQ | `/p/{code}/boq` | "Priced BOQ" | M1-20 |
| Material Schedule | `/p/{code}/materials` (tab `?tab=bars`) | "Material Schedule" | M1-22 |
| Live Model | `/p/{code}/model` (`?select=`) | "Live Model" | M1-25 |
| Prices | `/p/{code}/prices` (tab `?tab=rates`, `?tab=labour`; `?filter=not-entered`) | "Prices" | M1-21 |
| Project settings | `/p/{code}/settings` | "Project settings" | M1-21 |

The 40 px top bar at 1280 holds, left to right, the brand, the project switcher, the five links
"Takeoff · Drawing Set · Priced BOQ · Material Schedule · Live Model" (M0's Drawing Set kept; the
width of five links beside the switcher, the AccessChip and "Jump to Ctrl K" is tested at 1280 by
M1-25), the AccessChip where it applies, "Jump to Ctrl K" and the user menu; **Prices and Project
settings are in the user menu and `Ctrl K`, and "Prices" is also a link on the Priced BOQ's toolbar and
in its unpriced line** (a sixth and seventh bar link do not fit at 1280). The MD's top bar shows the same links.

---
## 4. The screens

Each section gives: the purpose; the QS's job; the regions and their widths; the rows and columns;
the bar, the inspector and the Questions where there are any; the states (1.4's four and the
screen's own); the words that must appear, verbatim; the keys; the roles; what this page **settled**
from the outline's open questions, and what it left to the owner (listed again in 9). Wording in
quotation marks is the English catalogue's text.

### 4.1 A Takeoff Step: the frame-step screen (M1-18a; data by M1-11b, M1-11c)

- **Purpose:** the one screen for Steps 2 to 8: what the machine read for this step, grouped so a QS
  confirms what agrees in one act and answers what does not. Steps 3 (storeys) and 4 (grid) are this
  screen with their own groups and forms (4.3, 4.4); the families differ only in the rows' facts,
  which come from each family's manifest (the Takeoff screen is generic, spec "The web app").
- **The QS's job:** read the groups; confirm the agreeing ones in bulk; answer each Question once;
  exclude or edit the exceptions; close the step, with Questions open if need be.

#### 4.1.1 Regions (layout A of M0, the same frame)
At 1440×900 and 1280×800 the screen keeps M0's frame: top bar, the rail (the fourteen steps; the MEP
Parts join it in M3, ADR 0007), the canvas region (here the list of Proposal groups; the source sheet, when opened),
the 320 px inspector, the status bar. The canvas is 912 px at 1280 and 1072 px at 1440.
- **The rail** (m0-screens 4.7), each step: number, glyph, name, then its state word from 1.1's
  `StepStatus` table ("Not started", "Opens after Step 3" with a lock glyph (by the API's refusal
  data, not the page's table), "Reading" with a thin progress line, "25 to confirm", "Closed",
  "Closed, 2 awaiting answer" in amber, "Reopened, 4 to confirm"); steps 9 to 14 read "On allowance"
  (muted; the money is in the Priced BOQ). The collapsed rail (48 px) shows the mark only, with the
  word as a tooltip that opens on focus; the words show in the open rail, which opens while the rail
  has focus (2.1: the rail is an F6 stop, `↑ ↓` and `Enter` move and open).
- **The toolbar:** "Step 6 Columns", the Count "Confirmed 14 / 110, 2 excluded" (an excluded element
  stays in N, screens.md Takeoff ruling 4; the Count is m0-screens 6.18 item 4's; **an Element the QS
  added (4.1.2) is counted in n and grows N by one, the reason beside it: "Confirmed 14 / 111, 2
  excluded · 1 added by you"**, so n never passes N), then on the right
  "List | Sheet" (the segmented control of M0, 6.1), the Drafting Profile button (4.9: icon-only at
  1280, "Drafting Profile" at 1440), the overlays toggle (4.9), the keys button. The width budget
  of m0-screens 4.1 holds: the toolbar on one line at 1280 with the longest step name, "Profile" and
  "Overlays" moving into More first.
- **The list** (the `List` primitive, 28 px rows, a sticky 28 px header, sticky 26 px section
  headings): sections, top to bottom:
  1. **Needs you** (amber band): "4 Questions open, in the order Enter takes them"; one row **per
     Question** (its title and the number of Elements it holds, "Q4 Which size is C5? · 4 columns"),
     in the queue's order (below); `Enter` on one does what the bar says: it answers the Question once an answer is picked and, with none picked, focuses its card (`Q` and `1`–`9` reach the same, so the owner's 25-keystroke path gains no key). Empty
     when none: the section is absent. A group is thus listed once (a row per group, never two).
  2. **To confirm**: groups under **band headings** ("1st to 8th", "9th", "Ground") low to high, each
     group a row by mark (4.6) or the step's own unit (a grid line, a storey, a pile type, a slab
     panel type); a group blocked by a Question reads "Question Q4" here.
  3. **Awaiting answer** (only after the step is closed with Questions open): the held groups, tinted
     amber, "Awaiting answer, Q4".
  4. **Confirmed**: collapsed, "14 confirmed" with a chevron; `→` opens, `←` closes; its rows are
     the same group rows, muted.
  5. **Excluded**: collapsed, "2 excluded, with their reasons"; they stay in N.
- **Columns of a group row:**

  | Column | 1280 (list 912 px) | 1440 (1072 px) | Content |
  |---|---|---|---|
  | (mark) | 24 | 24 | StatusMark glyph (1.1) |
  | Group | the rest (276) | the rest (386) | The group's name: "C2 · 2nd to 8th" (a mark within a Storey Band), "Grid line B", "Pile type P1", "Slab panel S3"; a typed name in its own direction |
  | Elements | 72 | 72 | n / N of the Elements this group holds that are confirmed or excluded: "0 / 14" |
  | Size or fact | 150 | 190 | The group's defining fact in the Display Units: "10″ × 20″"; "20″ dia, cut-off −5′-0″"; "5″ thick"; "—" where the Elements differ ("2 sizes: click to see") |
  | Quantity | 110 | 120 | What confirming would add, in the Billing Unit, from the preview (M1-23): "186.34 cft"; absent (column hidden, not "—") until previews are wired; "—" where the preview refused |
  | Basis | 130 | 130 | BasisMark with its words at both widths ("by ratio", "from the drawing + rules" fit in 130 px) |
  | State | 150 | 150 | "Proposal" · "Question Q4" · "Awaiting answer, Q4" · "Confirmed" with the actor's initials chip ("NJ"; a Vextrus Engineer "AR Vextrus") · "Excluded, duplicate" |

  The first row of a band holds the band's own roll-up in its heading: "2nd to 8th · 3 groups · 0 / 77".
- **Group review one by one** (`→`): the group's Element rows appear indented under it, "C2 at 3/C,
  2nd", "C2 at 5/C, 2nd", each with its size and state; focus is on the first. With the sheet open,
  the canvas flies to the focused Element's source (box padded to about 3×, screens.md sheet ruling 1)
  and shows the group's other sources as thin dashed outlines (the focused one a 2 px copper box). The
  counter in the bar "Column 3 of 14".

#### 4.1.2 The Confirmation bar and what Enter does
The bar is M0's (m0-screens 6.4): 44 px, at the canvas foot, a glyph, "what" over "why", actions on
the right, at most one copper button; it always says what `Enter` will do. At most 820 px wide.

| Focus | What · why | Button |
|---|---|---|
| A group that agrees | "Confirm 14 C2 columns of 2nd to 8th that agree = 186.34 cft" · "Each size agrees on the plan, the schedule and the label, and each sits on a grid point." | "Confirm 14 ↵"; ghosts "Review one by one →", "Confirm all 86 that agree Ctrl ↵" |
| Nothing, or the heading "To confirm" | "Confirm 86 columns that agree, in 6 groups = 1,144.66 cft" · "Each agrees on the plan, the schedule and the label. The 8 that need you are not included." | "Confirm 86 ↵" |
| One Element in review | "C2 at 3/C, 4th agrees: 10″ × 20″ on the plan, the schedule and the label" · "Column 3 of 14. Enter confirms this one and opens the next." | "Confirm this column ↵"; ghosts "Exclude X", "Edit E" |
| A group blocked by a Question | "Question Q4: Which size is C5?" (the card's title) · the card's first line (what answering does, 4.1.4) | "Answer Q4 ↵"; with nothing picked, disabled and showing "Pick an answer 1 2 3" |
| A group whose Question asks only about its bars (ruling 5) | the Confirmation as above, with the why's last line "Q9 asks about the bars; it does not hold this Confirmation. The Rebar stays from the drawing + rules until it is answered." | as above |
| A confirmed group | "14 C2 columns are confirmed by Nusrat Jahan" · "12 Oct 2026, 10:42. X excludes one; Ctrl Z takes back the last change." | "Next open item ↵" |
| An excluded Element | "C7 at 5/D, 4th is excluded: duplicate" · "By Nusrat Jahan, 12 Oct 2026, 10:50. It stays in the count." | "Confirm back in ↵" |
| Nothing left, Questions open | "Every column that agrees is confirmed" · "2 Questions are open: Q4, Q7. Closed with them open, their 8 columns are priced as read and marked awaiting answer." | "Next open Question Q ↵"; ghost "Close with 2 Questions open Shift ↵" |
| Nothing left, nothing open | "Every column is confirmed or excluded" · "Close Step 6 to measure the frame from it." | "Close Step 6 ↵" |
| The step is closed, nothing held | "Step 6 is closed" · "Closed by Nusrat Jahan, 12 Oct 2026, 11:20. Later steps stand on it." | "Go to Step 7 ↵" (after Step 8, "Go to the Priced BOQ ↵"); ghost "Reopen Step 6" (opens the dialog below) |
| The step is closed with Questions open | "Step 6 is closed with 2 Questions open" · "8 columns are awaiting answer: ৳1,25,572 of the total rests on them (T2)." | "Answer Q4 ↵"; ghosts "Go to Step 7", "Reopen Step 6" |
| There is nothing to read (no piles, no core, a raft) | "No piles were found on the plans read" · "If this building has none, say so and close the step." | "There are none ↵" (an act under the QS's name; the step closes "Closed, none"); ghost "Open Step 1" |
| Reading | "Reading the columns: plan 4 of 6" · "Proposals join the list as they are read." | none |
| A read ended | "Read: 42 Proposals, 2 Questions" · "This line stays until you act." | none |
| A read found nothing | "No columns were found on the 6 plans read" · "Check that the column plan is assigned to Step 6 in Step 1." | "Open Step 1" |
| Locked | the ErrorBar: "Step 6 opens once Steps 3 and 4 are closed." | "Go to Step 3" |

- **Closing.** `Enter` closes a step only when nothing is open (the "Close Step 6 ↵" row). With
  Questions open, `Enter` does "Next open Question"; closing needs `Shift Enter` and the bar has said
  what it does first. `close` / `close_with_questions` is refused by the API with
  `takeoff.steps.close_refused {failed}` when an element with no candidate is neither typed nor
  excluded (spec story 65): the ErrorBar says "Step 6 cannot close yet: 2 columns have no size. Type
  them (E) or exclude them (X)." and focuses the first.
- **Reopening** opens a dialog (a dialog scope whose **default focus is "Cancel Esc"**: `Enter`
  reopens only when the focus is on "Reopen Step 6"): "Reopen Step 6?" / "Steps 7 and 8 stand on its
  columns. They stay as they are, and each is measured again when you close Step 6." (settled here;
  the contract is silent on dependents, section 8 item 9). Closing then reopening can therefore never
  be one habitual `Enter`: after a close the bar offers the next step, not the undo.
- **After an act** focus moves to the first row of the next item in the queue (as M0 6.4); the toast
  names the act with "Undo  Ctrl Z": "Confirmed 14 C2 columns of 2nd to 8th." / "Q4 answered.
  Confirms 4 columns = 63.89 cft." / "Closed Step 6."
- **Add an Element the QS finds the drawing read missed** (story 125; the owner's Q15, 13 Oct 2026;
  the cause's name is the ticket's to choose in `CONTEXT.md` first). In a step in review, "Add an
  Element" (`Shift A`, a frame step's screen; settled here, `A` being Assign in Step 1 and Measure
  area in the 3D) puts the sheet into a pick mode (`Esc` leaves it, as `W`'s mode does): the QS clicks
  the entity on the sheet, or moves a crosshair by 8 px and presses `Enter`, which picks the entity
  under it. The picked entity is boxed on the sheet, and the inspector shows the form "Add an
  Element" with what a QS reads: the sheet ("S-09, Column layout") and the view, never a layer name
  or a handle (1.1; the handle stays in the Trace's anchor). It asks **Family** (the step's families,
  named, never typed free), **Mark** (the schedule's marks, the nearest label pre-picked, so the
  Element has its size and Rebar from the schedule's row) and **Storeys** (the view's, defaulting to
  its whole band; a plan that serves 2nd to 8th adds 7 Elements, and the form says "7 columns"
  before "Add ↵"). The quantity follows E1 to E3's basis, like any column's. **One act, one Confirmation:**
  C9's act list has none for it, so it is named here (8, item 19): a Confirmation act `add` carrying
  the picked entity's anchor, the Family, the Mark and the Storeys; the API makes one Element per
  Storey, all in that one Confirmation, with one Trace anchor, one toast and one `Ctrl Z`. Each
  Element joins the list in the band its Storey names, marked "Added by Nusrat Jahan: not read from
  the drawing", and **counts in n and grows N by itself** (the toolbar's Count of 4.1.1: "14 / 110"
  becomes "14 / 111 · 1 added by you"; a group's "13 / 14" becomes "14 / 15"), so the Count never
  reads n above N; the plan-against-schedule difference is shown there and not as a separate Check.
  The toast names the act with "Undo  Ctrl Z": "Added a C2 column at 3/C, 4th." (for
  a band: "Added 7 C2 columns at 3/C, 2nd to 8th.") **Undo removes it** (the step's last act: the usual `Ctrl Z` rule). A re-read (a Revision or
  a reader upgrade) keeps it as added, never proposing it "removed"; only a Revision whose sheet no
  longer carries the entity proposes its removal (M1.md, Takeoff). Closing the step then never drops
  it from the Priced BOQ unpriced. A second tenant never sees it; the MD is offered no such act (1.5).
  **For the ux-critic:** pick mode's crosshair steps with the arrows alone, `Shift` ×8 being 2.6's
  pan; the same collision stands in `W`'s mode (4.8).
- **Quantities that change** after a later step's act: "Step 8 closed. 14 C2 columns are measured
  again: 186.34 cft is now 184.72 cft (height to the slab soffit, a 6″ slab)." as a toast and a line in
  the group's Who did what (spec stories 66, 80; O6).

#### 4.1.3 The inspector (320 px; tabs "Selection" and "Questions (4)")
**Selection, nothing focused: the overview.**
1. "Step 6, columns, shear walls and core" / "Confirmed 14 / 110, 2 excluded" / "Read from 6 plans." /
   "110 on the column schedule on S-09; 110 found." (G3; with one Element added, "110 on the column schedule on S-09, 1 added by you; 111 found") (the N's source; `—` and "no schedule: N comes from
   the plan alone" where the drawing gives none, story 55).
2. "Enter takes them in this order": 1 "Confirm the 86 columns that agree" · 2 "Answer 4 Questions:
   the largest quantity first" · 3 "Close Step 6".
3. Cost Basis: "Allowance until this step is closed: ৳1,00,46,919.54 (columns ৳83,03,563.80; shear walls and lift core
   ৳17,43,355.74). Measured so far, 14 confirmed columns: ৳2,19,751.11 (X1)"
   (story 98; no flag, no projection: "likely over allowance" is the Summary's, M2).
4. "Rebar: 81% from the drawing, the rest laps and hooks from rules" (the Rebar of the confirmed columns).
5. "A Proposal counts toward nothing until you confirm it."
6. With nothing waiting: "Nothing is waiting."

**Selection, a group focused,** top to bottom:
1. The Question card holding it, if any (4.1.4).
2. Header: the group's name and band ("C2 · 2nd to 8th"), the state and when.
3. **What it adds** (the preview, 4.10): a table of Measurement Lines in Billing Units with the total
   ("14 columns · 186.34 cft").
4. **Where each fact was read:** per fact a row "Size 10″ × 20″" with three sources side by side as
   chips, each opening its Trace: "plan", "schedule S-09, row C2", "label C2 (10×20)" (the sources
   agreeing are shown ticked; a disagreeing one shows its value in amber). The labels are drawing text
   as drawn.
5. **Rebar** (when the family has it): "8 bars 20 mm, from the drawing + rules" with Rebar Basis;
   "Laps: 8 × 1 × 2′-7½″ (40 × 20 mm), a Rule Set default" as the separate lap line (R3, C7).
6. **Elements** (their count, "→ walks them; X excludes"): a compact list of the group's Elements.
7. **Who did what** (each act "what" over "name, role, time"): "Proposed by Vextrus from the plan on
   S-08"; "Confirmed in bulk with 85 other columns / Nusrat Jahan, QS, 12 Oct 2026, 10:42"; "Typed:
   size 10″ × 20″ / Nusrat Jahan, 7 Oct 2026".
8. Actions (not for the MD or a Guest): "Edit E", "Exclude X", and for a confirmed Element "Confirm
   back in" after exclusion.

**Selection, one Element focused:** its name (1.2), storey and grid reference, facts with Traces,
its Question, and a link "Show in the Live Model G" (4.11).

**The edit form (`E`)** replaces the Proposal block: one field per editable fact with its unit as a
suffix chip ("10 in"), the Display Units' system first. A bare number is read in the field's unit; a
unit typed overrides it ("254 mm", "0′-10″"); the page echoes the reading under the field before
save ("Reads as 10″ = 254 mm"), so a metres-for-inches slip is seen. `Enter` saves and moves to the
next field, `Esc` cancels and keeps focus on the row (the slice dropped focus to the page). The
edit is an `edit` act: a QS-typed figure shown "typed by Nusrat Jahan" in its Trace, never
re-derived by a later read (story 39). A typed unit the page cannot parse shows "Not a length. Try
10″, 0′-10″, 254 mm or 0.254 m." and keeps the text.

**The exclusion picker (`X`)** is a mode (it claims every digit, as M0's, so no digit falls through to
a card): the bar becomes it: "Exclude C7 at 5/D, 4th. Why?" with "Coverage keeps the reason. Esc
cancels" and five numbered buttons: 1 Not a column (the family's noun) · 2 Duplicate of another · 3 By
others (not in this Priced BOQ) · 4 Existing, to remain · 5 Other. `5` opens the field "The reason, in a
few words" with "Exclude ↵". The same picker serves a whole group ("Exclude the 3 C7 columns of 4th.
Why?"). Settled here: five reasons, because the Element's reasons differ from a sheet's seven; the API
stores a reason with no enum in C9 (section 8 item 10).

#### 4.1.4 Questions
**The Questions tab** lists exactly the step's open Questions as the API sends them (C9, A10): its count
is the step's `open_questions`, always (the design gate checks it on the seed, 7). A row is held only
by its own Questions; a step-level Question holds only closing the step and says so ("This Question
holds closing the step, not any column."). A Question kept open is listed as "Q5 kept open". An
answered Question moves to "Answered": one line, "Q3 Size of C5: 10″ × 20″. Nusrat Jahan, 12 Oct
2026, 10:50".

**The card** is M0's (m0-screens 6.7), with its first line also for a kept-open answer ("Answering keeps Q4 open. 4 columns stay unconfirmed."): amber header "Question Q4" and "Answer once"; **first, what
answering does** in a grey band ("Answering confirms 4 columns = 63.89 cft"; with nothing picked, what
it settles and "Pick an answer: 1, 2, 3."); the title in plain words; the body with its figures in
their kinds; for a conflict a small table of the sources; the Trace line; options as radio rows with
their number keys; "Answer Q4 ↵" and "Ask later" (moves to the next). **Pre-pick only when two or more
independent sources agree** (screens.md Takeoff ruling 2), the card naming them ("Picked for you: the
plan and the label agree"); with no majority, nothing is pre-picked. A pick changes nothing until
`Enter` or "Answer".

**The queue** (the order `Enter` and `Q` take): (1) Questions that hold Confirmations, by the
quantity they hold, largest first (in ৳ where priced, else in cft or the item's unit, never mixed
within one list), ties by the number of Elements they hold, then by number; (2) Questions that hold
only a figure (rebar-only, "bars only", `RAISES = question_rebar_only`), in the same order; (3)
step-level Questions. Story 54: "the exceptions sorted by their effect on quantity or ৳".

**Words by kind** (each Question's title and options are the code's catalogue messages with its
params; the page owns only the card). The kinds M1 raises, with an invented example for each, are:

| Kind | Title (example) | Body and Trace | Options (pre-pick) |
|---|---|---|---|
| `conflict`, size differs (`engine.schedule_plan.size_differs`) | "Which size is C5?" | "The plan draws 10″ × 20″ and the schedule on S-09 gives 10″ × 24″. The label reads C5 (10×24)." Trace: the plan's outline, the schedule row, the label | 1 "10″ × 24″, as the schedule and the label say" (pre-picked: "the schedule and the label agree") · 2 "10″ × 20″, as the plan draws" · 3 "Type a size" · 4 "Keep open, ask the consultant" |
| `missing`, blank schedule cell (`engine.column.schedule_cell_blank`) | "What is the size of C8 on the 5th to 8th?" | "The column schedule on S-09 leaves the size blank for C8 at 5th to 8th. 4 columns wait on it." | 1 "Type a size" · 2 "Same as C8 at 2nd to 4th: 10″ × 18″" (offered only when a neighbouring band has one; never pre-picked alone) · 3 "Keep open" |
| `low_confidence`, top floor (`engine.storey.top_proposed`, Step 3) | "Which is the top floor?" | "The plans name the 9th as the highest. A tank room and a stair head sit above it." | 1 "9th" (pre-picked only when two sources agree) · 2 "Roof" · 3 "Keep open" |
| `check` (rebar only) (`engine.bars_fit.does_not_fit`) | "Do 12 bars of 25 mm fit in C4?" | "The section is 10″ × 20″ with 1½″ cover. With 4 bars across the 10″ face, 40 mm clear between them and 8 mm ties inside 1½″ of cover, the bars as read need 12¼″ across it." | 1 "Use the callout as read" · 2 "Type the bars" · 3 "Keep open" |
| `missing`, unread walls (`engine.shear_wall.not_read_yet`, O5) | "Shear walls are not read yet" | "9 outlines on 2 plans look like walls. They stay on the allowance until they are read." | none: it is a notice row ("Keep open" only), not an answer; closing the step is not held by it |

Each kind's wording is its ticket's to word in `web/src/messages/engine/<check>/en.po`, in this shape
(the title a question the QS can answer, the body the evidence in the QS's figures, the Trace line as
links), and gets a words-only `ux-critic` read (CLAUDE.md).

#### 4.1.5 States
| State | What shows |
|---|---|
| **First open** | The list holds what the read made; nothing focused; the overview in the inspector; the bar offers the bulk act |
| **Empty, never read** | "No columns yet. They are read from the plans confirmed in Step 1." · "Read the columns" |
| **Locked** | the ErrorBar of the refusal (1.4) |
| **Reading** | the Skeleton, "Reading the columns from 6 plans…", Proposals joining as read; the toolbar Count "Confirmed 0 / —" until N is known |
| **Read ended** | "Read: 42 Proposals, 2 Questions" in the bar and in the status bar until the QS acts |
| **Blocked** | a group with an open Question reads "Question Q4" and is never in the bulk act |
| **Second read** (A9) | a Proposal the new read proposes again keeps the QS's decision and takes the new values; one it no longer proposes leaves the list ("1 Proposal is no longer read and was removed. See Who did what."); an answered Question stays; a Question not raised again is withdrawn and leaves the tab |
| **Nothing left** | the bar table above |
| **Closed, held** | the rail and the list read "Closed, 2 awaiting answer"; held rows amber; the strip shows the money apart (4.13) |
| **Reopened** | "Reopened, 4 to confirm" |
| **Jev unavailable** | no pre-pick where Jev would have been a source; nothing else changes; a small line in the Questions tab: "Answers are not pre-picked just now. Choose one on each Question." (story 62) |
| **A file held by the decoder check** (`engine.decoders.differ_for_step`) | the Question appears in the step that needs it, with M0's wording (m0-screens 6.7) |

#### 4.1.6 Roles
The MD and a Guest: every row, the inspector, the preview and the Trace are readable; the bar reads
"You are reading this as the MD." (a Guest: "…as a Guest.") / "Nusrat Jahan (QS) confirms the
frame; everything is shown under the name of whoever did it." with the ghost "Next open Question Q"; Question cards show their
options disabled with "Waiting for the QS. The MD reads Questions and cannot answer them."; "Edit",
"Exclude", "Reopen" are absent; a key that would change something shows 1.5's toast.

#### 4.1.7 Settled here, and what is left
- **The group's quantity** (story 56) shows in its row and bar from `boq`'s preview (C13), so M1-18a
  ships without the column until M1-23 wires it (the column is hidden, never "—" for "not built").
- **The preview's place:** in the inspector under the group header ("What it adds"), not beside the
  list, so the canvas stays the sheet and the list keeps its 912 px.
- **How a one-by-one group shows on the sheet:** the focused Element's source is the 2 px box, flown
  to; the group's other sources are thin dashed outlines; `Esc` leaves the review and fits back.
- **The canvas never shows the 3D** for a confirmed group: the sheet is the evidence; the 3D is its
  own route, reached by `G` or the top bar's "Live Model" (4.11).
- **Left to the owner:** none from this section; the exclusion reasons, "There are none" and the
  closing-with-dependents words are listed in 8 for the orchestrator.

### 4.2 Step 2, general notes and specification (M1-31's family on M1-18a's screen)
- **Purpose:** the strengths, covers, laps, grades and pile data the notes state, confirmed once for
  the Building, with the BOQ Item each concrete strength is built as.
- **The QS's job:** confirm each note's value; pick the BOQ Item for each concrete strength (the
  Developer's table pre-picks it).
- **Regions:** 4.1's. The groups are the note sections: "Concrete", "Cover", "Laps", "Rebar grade",
  "Piles"; each row is one fact.
- **Row columns:** (mark) | Fact ("Concrete strength, columns") | Value ("3600 psi", the drawing's own
  unit; "24.8 MPa" in its Trace) | As written (the notes' own words, verbatim, as drawn: "3600 psi") | Where ("S-01, note 4") | State.
- **States:** 4.1's; **empty** when no notes file is confirmed in Step 1: "No general notes were
  found in Step 1. Assign the notes sheet to Step 2, or type the values." · "Type the values";
  a fact the notes do not state, proposed as "not stated": "Clear cover, beams: not stated. The Rule
  Set's 40 mm applies." with the default's source ("a Rule Set default") and a ghost "Type it"; notes in
  columns with free-text tables read into the same rows (story 14), shown as read.
- **Words:** "Concrete strength 3600 psi, as written on S-01" (the verbatim text beside the value; the
  other unit is in its Trace, "24.8 MPa");
  "Lap length 40 × bar diameter, compression, columns: from the notes" / "…not stated: 40 × bar
  diameter, a Rule Set default"; the strength Question "Which BOQ Item prices 3600 psi concrete in
  columns?" with options from the port: "RCC 1:1.5:3, f′c 3600 psi, site mix" · "Ready-mix concrete 3600 psi,
  pumped (Material-and-Labour)" · "Keep open, ask the consultant".
- **Pre-pick:** the Developer's own table (`StrengthItemChoice`: "Shapla Homes chose this on its last
  project") pre-picks the option and the card says "Picked for you: your table, from KR-00" (the
  Developer's standing choice is one named source, the plan's pre-pick-and-remember rule, M1.md C11,
  taking story 12; open question 9.1).
- **Cost effects shown:** until Step 2 is closed, a BOQ Item priced from the strength choice is
  "awaiting answer" in the Priced BOQ (C13); the inspector says so: "Concrete in columns is priced
  once this is closed."
- **Keys:** 4.1's; `E` on a strength row opens its BOQ Item choice again (the remembered table is
  rewritten by the new answer; there is no table editor in M1).
- **Settled here:** the Developer's table is not edited in project settings in M1; it is written by
  answering and read by the next project's pre-pick (no route for it exists, section 8 item 5).

### 4.3 Step 3, storeys and levels (M1-32a, M1-32b; M1.md C19)
- **Purpose:** the Building's storeys, their order and levels, and which storeys each plan shows;
  every later step's storeys and heights stand on it.
- **The QS's job:** check the storey list read from Step 1's plans; confirm the top floor the machine
  proposes (one Question per Building, O4); check each level, typing it only where none was read
  (O3); confirm which storeys each plan shows.
- **Regions** (4.1's frame): two lists in the canvas region, stacked with a splitter at 60 / 40:
  - **Storeys**, low to high as the M0 strip runs (Foundations, Ground, 1st … 9th, Roof): columns (mark) | Name | Slab level | Finished level | Height | Basis | State, with
    Basis "read" (from a level mark or a section), "typed" or "derived" (from the next storey's slab
    level, or the plinth defaulted); widths at 1280: 24 | 120 | 110 | 110 | 90 | 90 | 150;
  - **Plans and their storeys:** each plan view of the confirmed sheets: Sheet and view (DrawingText)
    | Meaning ("at floor level" | "floor to floor" | "at ceiling level") | Storeys ("2nd to 8th") and the
    M0 strip | State.
  - the canvas shows, on Space, the section or level mark a level was read from, boxed.
- **The bar:** as 4.1's, with: "Confirm 11 storeys that agree" · "Each has a name from its plans and a
  level from a section or level mark. The 9th's top is asked in Q1." A typed level is never in the
  bulk act's "agree" (it is the QS's own); the bar names it: "The 2nd's finished level is typed by
  you."
- **Typing a level (`E`):** on a storey row `E` opens the row's two level fields inline (slab, finished)
  in the Display Units' form with the echo (4.1.3): "Reads as +10′-0″ above Ground"; `Enter` saves and
  moves to the next storey, `Esc` cancels and keeps focus on the row. A typed level reads "typed" in its
  Basis and "typed by Nusrat Jahan, 12 Oct 2026" in its Trace; a later read of the same level offers
  itself as a Proposal and never replaces a typed one without a confirmation (O3, "a read level
  replaces the typed fallback only through a Proposal the QS confirms"). Either unit system is
  accepted in either project ("3.048 m" in an imperial project reads as +10′-0″ and echoes so).
- **Names:** a storey's name is editable (`E` on the Name field); renaming changes every screen at once
  (they take `{id, name}`); a tank or a roof structure is never listed as a storey ("Tanks are
  structures for Step 10").
- **Correcting a plan's storeys:** `E` on a plan row opens a storey picker in the inspector: the
  storeys as checkboxes (`↑ ↓` move, `Space` ticks, `Enter` saves, `Esc` cancels), the Meaning as a
  two-choice toggle; saving is `PUT view-placements/{view_id}` (C19) and shows the resulting row.
  "typical" and "top" are bound at confirm: until then the row reads "typical (range from this step)".
- **Questions** (Step 3's, C10): top floor (`engine.storey.top_proposed`); a level mark that disagrees
  with its level line (`engine.level_lines.label_differs`: "The 9th's level line is +90′-6″ and its
  label +90′-0″"); a finished level that differs from the slab by other than the stated finish
  (`engine.finished_level.finish_differs`: "The 3rd's finished level is 2″ above its slab; the notes
  state a 1″ finish"); a plan placed on a storey not confirmed (`engine.views_on_storey.unconfirmed_storey`);
  no ground level (`engine.storey.ground_level_missing`: "No existing ground level is stated. Boring
  and sand filling are measured from it."); a basement below the ground storey
  (`engine.storey.below_ground_with_basement`). Each is a card as 4.1.4.
- **States:** 4.1's; "No level read. Type it in feet and inches or metres." in the empty Level cell
  with the field; the top-floor Question open until answered; "1st to top: 1st to 9th" once bound.
- **Words:** "Ground +0′-0″ · slab +0′-0″"; "derived from the 2nd's slab level" for a height; "typed" beside
  every typed level.
- **Keys:** 4.1's plus `E` as above.
- **Settled here:** levels typed in either system with the Display Units' echo; a plan's storeys are
  corrected in the inspector's picker (C19's PUT). **Left:** none.

### 4.4 Step 4, grid (M1-33)
- **Purpose:** the grid lines, registered into one frame for the Building, so every Element stands
  where the plans put it, and each view's scale confirmed.
- **The QS's job:** confirm the grid lines; answer where two plans disagree on a spacing; confirm each
  view's scale where it was proposed from dimensions.
- **Regions:** 4.1's. The groups are **grid lines** in two sets, "Lines 1 to 8" and "Lines A to E"
  (a line's name is its bubble text, as drawn: `DrawingText` marked `grid`), then **View scales**.
- **Row columns:** (mark) | Line ("Grid line B") | From the previous ("15′-0″ from A") | Read on ("3
  plans") | Extent ("A to E on every plan") | State. A scale row: View ("S-08 Column layout plan") |
  Scale ("1:100") | From ("its dimensions, 12 of 12 agree") | State.
- **States:** 4.1's; a line read on one plan: "Read on one plan only" in the Read-on cell, amber;
  "bubbles present, line missing on S-12" proposed with that evidence (story 23).
- **Words:** "Grid line B, 15′-0″ from A, read on 3 plans"; a conflict: "S-08 and S-12 disagree on the
  spacing of B to C: 15′-0″ and 15′-6″"; a scale: "Scale 1:100, from 12 dimensions that agree";
  `engine.view_scale.no_fit`: "No one scale fits S-14's dimensions. Pick the closest or type it."
- **The canvas** on Space shows the sheet with the **registered grid overlay**: the confirmed grid
  lines drawn over each plan in the QS's own colour, with their names, so a mis-registration is
  seen at once; `Shift O` toggles it (4.9).
- **The origin:** the step's overview says "The Building's origin is where line 1 meets line A. Every
  position is measured from it." It is shown, not editable in M1 (settled here: nothing a QS measures
  depends on it, it only anchors the metres; revisit at the owner's request).
- **Keys:** 4.1's.
- **Left:** none.

### 4.5 Step 5, piles and pile caps (M1-34, M1-35)
- **Purpose:** the piles by type and the pile caps by outline, with the levels boring and concrete
  are measured from.
- **The QS's job:** confirm piles by type mark; answer a missing length or platform level; confirm
  caps by mark; choose the piling contract (4.14).
- **Regions:** 4.1's. **One list, two sections** ("Piles" then "Pile caps"), settled here (a QS reads
  a cap's piles beside its caps, and a second tab would hide the count mismatch). Piles are grouped by
  type mark; caps by mark.
- **Row columns:** piles: Type ("P1") | Count ("47 / 47") | Diameter ("20″") | Levels ("cut-off −5′-0″,
  toe −70′-0″", **from the datum, Ground +0′-0″**; existing ground level −2′-0″ is held against it) | Length
  ("65′-0″" cut-off to toe) | Quantity (boring in rft and concrete in cft: two figures, "boring 3,196 rft
  from existing ground · concrete 6,664.98 cft") | State. Caps: Mark ("PC3") | Count | Outline ("5′-0″ × 8′-6″") | Depth
  ("3′-0″") | Piles held ("4 piles inside, 4 on the type") | Quantity | State.
- **States:** 4.1's; the ground-level Question ("No existing ground level is stated. Boring is
  measured from it.") open until answered; `engine.pile.length_missing`: "The length of pile type P2 is
  not stated. Type it (E) or read it from the schedule."; `engine.piles_in_cap.count_differs`: "PC5 holds 3
  piles on the plan and its type says 4".
- **The datums, said once** (P1): **boring is measured from the existing ground level** (or the working
  platform where one is stated) **to the toe** (47 piles × 68′-0″ = 3,196 rft here); **pile concrete
  from the cut-off level to the toe** (47 × 65′-0″ × 2.18166 sft = 6,664.98 cft) **plus the over-cast**;
  every pile level on screen names its datum ("−5′-0″ from the datum", "existing ground −2′-0″").
- **Words:** "Pile type P1, 20″ dia, cut-off −5′-0″, toe −70′-0″, 47 piles"; "head breaking" as its own item;
  "over-cast 2′-0″ above cut-off, broken off": **concrete bought**, its own line under the pile
  concrete item at that item's rate, 205.08 cft here (47 × 2.18166 sft × 2′-0″), with its cement and chips in
  the Material Schedule (P1; shown as a separate visible line, story 28); the
  step's Cost Basis in two parts: "Piles and pile caps: measured. The rest of foundations: on
  allowance" (C13, story 101).
- **The piling contract** appears as a line at the foot of the inspector's overview: "Piling is priced
  as: Labour only (change)" opening 4.14's choice; with Material-and-Labour: "Piling is priced as a
  Material-and-Labour Contract: boring, concrete, Rebar and head breaking are one rate."
- **Keys:** 4.1's.
- **Rebar for piles and caps** is by ratio in M1 (the owner's ruling 10): its Basis reads "by ratio"
  and the card never offers bars.

---
### 4.6 Step 6, columns, shear walls and core (M1-36, M1-37, M1-38)
- **Purpose:** each column, wall and core, one Element per storey, grouped by mark within its Storey
  Band, with its size and its Rebar.
- **The QS's job:** confirm the agreeing marks in each band; type a size the label did not give (`E`);
  answer schedule-against-plan conflicts; until walls are read (M1-37), answer the one grouped
  Question that says so (O5); close the step, with Questions open if need be.
- **Regions:** 4.1's. Groups: band, then mark ("2nd to 8th · C2 · 14 columns"); sections in the
  list: "Columns" always, then "Shear walls" and "Lift core" once M1-37 lands (settled here: sections
  of one list, not tabs, so the step's Count and Enter order stay one; until then the one grouped
  Question below stands where they will be).
- **The stub below the plinth:** the column from the cap top to the plinth is its own storey row,
  "Foundations, cap top to plinth", with its Storey Band label, and bills to Sub-structure (M1.md: a
  Rule Set section rule); the By floor view's "Foundations" heading holds it.
- **Row facts:** column: Size ("10″ × 20″", or "Ø 18″" for a round one), Position ("3/C", "3/C, 6″ east"
  off grid), Rebar (BasisMark: "from the drawing + rules"); wall: Thickness ("8″"), Length ("14′-6″"),
  Openings ("2, 1 over 1 sft"); core: Walls ("4").
- **The inspector** shows the three sources of a size (plan, schedule, label) side by side (4.1.3),
  with the **Rebar block**: "8 bars 20 mm; ties 8 mm at 6″ and 12″", "Rebar Basis: from the drawing +
  rules", the net bars and the lap line apart ("Laps: 8 × 1 × 2′-7½″"), and the share "from the
  drawing" of the step beside it. The Rebar never crowds the row: a group row carries only the Basis
  mark; the bars are the inspector's.
- **States:** 4.1's, and:
  - closing Step 6 replaces its columns allowance by the measured columns and **keeps the "Shear walls
    and lift core" allowance part, hatched, until M1-37 reads the walls** (4.13.2);
  - walls not read yet (O5): one Question per Discipline, "Shear walls are not read yet: 9 outlines
    on 2 plans look like walls. They stay on the allowance until they are read." (never a silent
    zero); the row for it reads "Question Q6" in the Needs you section;
  - a size not read: "The size of this column was not read from its label. Press E to type it.";
  - an off-grid column: "3/C, 6″ east" with its Trace "placed by its offset from the nearest grid
    intersection" (story 34);
  - a column whose height waits on its slab: the Element's height fact reads "9′-7″, to the
    slab soffit, derived from the default slab thickness 5″; measured again at Step 8" (O6; the word
    "derived" in the Trace, never a stored note);
  - a lift core: "Lift core L1: 4 walls, never a column mark" (story 35) and a label bound to another
    kind raising "Label C1 sits on the lift core. Is it a column?" (`engine.label_kind.wrong_kind`);
  - two layers: "Columns are on two layers of S-08 at different sizes. Which layer is current?"
    (`engine.stale_layer.two_layers`; the layer names are drawing text as drawn).
- **Words:** "C2, 10″ × 20″, 2nd to 8th"; "Column C2 at 3/C, 4th"; "8 bars 20 mm, from the drawing + rules";
  "Rebar from the drawing: 81% of this step".
- **Keys:** 4.1's.
- **Settled here:** walls and the core are sections of the one list; Rebar is a block in the
  inspector, one Basis mark in the row. **Left:** none.

### 4.7 Steps 7 and 8, beams, slabs and slab-edge members (M1-39, M1-40, M1-41)
- **Purpose:** beams span by span, slab panels, and the slab-edge members, storey by storey.
- **The QS's job:** confirm typical layouts in bulk; answer a missing size or support; check a sunk
  panel and a cantilever; confirm slab edges.
- **Regions:** 4.1's. **Groups by storey, then by mark or panel type**, and one **Typical layout** row
  per layout the machine applied to several storeys ("Beam layout of S-11, applied to 2nd to 8th:
  7 storeys · 112 spans"); confirming it confirms its storeys' beams in one act (story 49) and the bar
  says which storeys.
- **Row facts:** beam: Mark and spans ("B12 · 6 spans"), Size ("10″ × 18″ overall, 13″ below the slab": the overall
  depth includes the slab, C8; F4 measures the 13″ below its soffit, and both show so that a hand check
  of the line agrees), the row's Ends ("2/B to 3/B"); slab: Panel ("S3"), Thickness ("5″"),
  Area ("324 sft"), Level; voids, sunk panels ("sunk 2″"), upstands as chips; slab-edge members group
  by kind, "Sunshades · 2nd to 8th · 28", then storey.
- **The inspector** for a beam adds **Clear span** ("clear span 14′-6″ between column faces"), derived by
  the same function the measurer uses (spec, "Measuring"), with its Trace "derived from the faces of
  C2 at 2/B and C3 at 3/B".
- **States:** 4.1's, and:
  - an unlabelled beam: "B? at 2/B to 3/B has no size on its label or the schedule. Press E to type it."
    (`engine.beam.size_missing`; one Question per size, never one per beam: A11);
  - a missing support: "The 3rd end of B7 rests on nothing the columns or walls explain."
    (`engine.beam.support_missing`);
  - a section against the plan: "S-14 shows B12 spanning 14′-6″; the plan draws 15′-0″."
    (`engine.section_span.differs`);
  - a floor type not read in M1 (flat slab, drop panel): "This panel has no beams under it. Flat
    slabs are not read yet; its area stays on the allowance." (`engine.slab.floor_type_unsupported`);
  - an unstated thickness: "The thickness of slab panel S3 is not stated. One answer covers its 14
    panels." (`engine.slab.thickness_missing`; it never blocks the beams, story 51);
  - when Step 8 confirms a slab, Step 6's columns below it are measured again, and the toast says so
    (4.1.2).
- **Words:** "B12, 10″ × 18″ overall (13″ below the slab), 2/B to 3/B"; "slab S3, 5″, 324 sft"; "Sunshade, projection 2′-0″,
  average thickness 3″" (a projection of 4″ or less in average thickness classes as a sunshade,
  story 52: the card never says "class (d)"; the BOQ Item's wording does).
- **Keys:** 4.1's.
- **Settled here:** spans are rows first, and the overlay (4.9) draws them as lines on the sheet when
  asked; slab-edge kinds are groups, not columns. **Left:** none.

### 4.8 Step 1's additions (M1-19)
- **Purpose:** what M0's Step 1 lacked for M1: draw a missed sheet or view, split a wrong one, confirm
  the consultant office with the sheet list, the profile's sheet part, and Assign.
- **The QS's job:** fix what the machine split wrongly, by hand, and say which steps read a view.
- **Regions:** m0-screens 6's, with the draw and split tools in sheet mode and the office in the
  files band.
- **The office:** the first chip of the files band, "Office: Arch-Struct Consultants (from 54 title
  blocks)" with the state "to confirm" or "confirmed by Nusrat Jahan, 12 Oct 2026". It is focusable:
  `Enter` confirms it (an act of Step 1's Confirmation, so the bulk act's "why" adds "and the office
  is Arch-Struct Consultants"), `E` corrects it in the inspector: a choice among the Developer's
  known offices and a typed name; a corrected office never carries another office's Drafting Profile
  (story 7). Its profile reads "Arch-Struct Consultants, Structural: version 2, confirmed 3 Sep 2026
  on KR-00" or "No profile yet".
- **The sheet part of the profile** (story 6) is confirmed with the sheet list: the Profile panel (4.9)
  opens on its "Sheet" part from the same band ("Sheet conventions: 3 to confirm"); confirming it is a
  separate act from confirming the sheets, and the bulk act's bar names it when it is unconfirmed.
- **Draw a view (`W`, sheet mode):** a mode; the canvas shows a crosshair at its centre. With the
  pointer: click the first corner, move, click the opposite corner (two clicks, settled here: it is
  what a keyboard can do too, and a drag on a trackpad slips). With the keyboard: `← → ↑ ↓` move the
  crosshair by 8 px (`Shift` ×8), `Enter` fixes the first corner, then the second. A rubber box shows;
  `Esc` cancels. The inspector then shows the form "Draw a view": Kind (Plan, Section, Elevation,
  Detail, Schedule, Notes, Legend), Title (typed, shown in its own direction), Storeys (the picker of
  4.3), Scale (typed or "not to scale"), and "Draw ↵". The view is marked "Drawn by hand by Nusrat
  Jahan" and its Trace says so (kind `qs_typed`).
- **Split a view (`Shift W`, a view selected):** the same two corners inside the view; the part
  inside becomes its own view and the rest keeps the original, both listed; "Split ↵" names both and
  undo (`Ctrl Z`) reverses it.
- **Draw a sheet:** from a file chip's menu in the files band, "Draw a sheet in this file": the file's
  drawing opens in sheet mode as one unnumbered region; `W` boxes the sheet's border; the form asks
  Number, Title, Discipline, Revision. A hand-drawn sheet is a Proposal like any other and is marked
  "drawn by hand".
- **Assign (`A`, sheet mode, a view selected):** M0's kept dialog (m0-screens 6.9) — a 420 px dialog
  "Which steps read "8th floor beam layout"?" / "A view may feed several steps; each marks it used on
  its own. S-20, plan." — with checkboxes for the fourteen steps in the rail's order (M1's Steps 2 to
  8 first), (the MEP Parts join the list in M3, ADR 0007); `↑ ↓` move, `Space` ticks, `Enter` saves, `Esc`
  cancels. Steps 9–14 are enabled (they only mark Coverage: "assigned to a later step").
- **States:** m0-screens 6.13's; a hand-drawn sheet or view marked "drawn by hand" in the State column;
  Coverage's status bar counts each as a view. Saving a drawn view shows "Saving…" on the form's
  button; a refused save keeps the form and shows the refusal's words in the inspector. **Read-only:**
  the MD and a Guest see none of "Draw a view", "Split", "Assign", "Correct the office" (absent, not
  disabled), and `W`, `Shift W`, `A`, `E` show 1.5's toast.
- **Words:** "Drawn by hand by Nusrat Jahan"; "Office: Arch-Struct Consultants (from 54 title blocks)";
  "Split S-08's plan into two views."
- **Keys:** `W` draw a view, `Shift W` split, `A` assign, plus M0's; each registers at screen scope
  in Step 1's sheet mode with `when` for its precondition. The draw modes are mode scopes: `Esc`
  cancels, and while one is active only its own keys act.
- **Settled here:** two clicks, not a drag; `W` (the reservation "select by window") is the window
  that draws. **Left:** the route for correcting the office (section 8 item 8).

### 4.9 The Drafting Profile panel and sheet overlays (M1-18b)
- **Purpose:** what the machine learnt about this office's drawings (layers, label patterns, level
  marks, schedule forms), confirmed by the QS part by part so the next set from the office reads
  better; and, on the sheet, what each step read.
- **The QS's job:** confirm or correct each convention, once, in the step that first needs it.
- **Where:** the panel **replaces the inspector's content** until `Esc` (as M0's file report and
  Coverage do, m0-screens 6.18 item 12), opened from the toolbar's Profile button, `Shift P`, `Ctrl K`
  ("Drafting Profile") or a convention Question's "Open the Profile". It keeps the 320 px width
  (settled here: a drawer would cover the list; the evidence scrolls).
- **Content, top to bottom:**
  1. Header: "Drafting Profile: Arch-Struct Consultants, Structural"; the line "Confirmed once, kept for
     this office's next set." and "version 2, confirmed 3 Sep 2026 by Nusrat Jahan" or "No version
     confirmed yet".
  2. **The parts**, each a collapsible row in the order Sheet, Notes, Levels, Grid, then one per family
     ("Columns", "Beams"…): name, state ("Confirmed", "3 to confirm", "Not needed yet: Step 7 opens it")
     and a copper dot on the parts this step needs.
  3. An open part lists its **conventions**, each: the sentence ("Columns are on layer COL-OUTLINE";
     "Column labels read C2 (10×20)"; "Levels are marked with the symbol and a value in parentheses";
     "The schedule is drawn as sections"), the **evidence** ("seen on 18 sheets: S-08, S-09 and 16
     more", each a link that opens that sheet with the instance highlighted), its state, and "Confirm ↵"
     and "Correct E". A layer name, label pattern or note is drawing text, shown as drawn.
  4. **Asked once:** "This applies to all 18 sheets; you are not asked again on each."
- **A part's confirmation** is `confirm_convention` with its convention keys (C9); a confirmed version
  is immutable, so a correction after confirming says "Correcting makes version 3. Version 2 stays as
  it was, and the sheets read with it keep their Trace." (C6.) The Question kind `convention`
  (`takeoff.profile.convention`) is asked once per convention and shows in the Questions tab with
  "Open the Profile".
- **States:** none learnt yet: "Nothing is learnt about this office yet. Its conventions are proposed
  as each step reads."; loading: "Reading what was learnt about this office…"; a failed read: "The
  Drafting Profile could not be read. Nothing is lost." with "Try again"; **read-only** (the MD, a
  Guest): ReadOnlyChip, "Confirm" and "Correct" absent, the evidence still opens; no office confirmed: "Confirm the office in Step 1 first." with "Go to Step 1";
  reused: "Reused from KR-00: columns on layer COL-OUTLINE (confirmed 3 Sep 2026)" (a profile is
  never shown from another Developer: a Library profile reads "From the Library: Arch-Struct
  Consultants, version 4").
- **Keys:** `↑ ↓` move through parts and conventions; `Enter` confirms the focused convention (or opens
  the part); `E` corrects; `→ ←` open and close a part; `Esc` closes the panel (the Esc stack of 2.2).
- **Overlays** (what each step read, on the open sheet): a toolbar menu "Overlays" with a check per
  step that has read this sheet and `Shift O` toggling the current step's; drawn over the sheet in the
  Proposal / Confirmed / held styles of 4.11 (confirmed: grey 1 px; Proposal: cyan dashed 2 px outside
  the element; held: amber with the revision cloud at the Question's origin); each overlay shape is
  focusable by `Tab` in canvas focus and `Enter` selects its group in the list. A legend at the
  canvas's top-left counts: "Proposal 14 · Confirmed 31 · 4 Questions · Excluded 2".
- **Settled here:** the panel replaces the inspector; overlays are one toggle per step plus the
  menu. **Left:** none.

---
### 4.10 The Trace, the highlight and the preview (M1-18a highlight; M1-23 popover, picking, preview)

- **Purpose:** every figure back to where it was read, in two keys; and, before a group counts, what
  it would add.
- **The QS's job:** check a figure against its source; check a group's quantity before confirming it.

#### 4.10.1 The highlight (M1-18a, A19)
Space on a row, or a Trace's "Open the sheet", opens the sheet viewer with `?highlight=` (the anchor's
sheet, view and `bbox_sheet_mm`, C7). On open: the sheet fitted to the source's box padded to about 3×
and never under 100 mm of paper (screens.md sheet ruling 1), the neighbours in view; the source boxed
by a 2 px copper outline two pixels outside the element, with one 400 ms pulse (none under reduced
motion); the sheet's title and the view's title in the toolbar's label. The address holds only the
ids; no id or box is ever visible text. A source on a sheet that is no longer current says in the
canvas's top-left note "On S-12 R0, superseded by R1" and still opens. A Trace with no sheet source
(typed, derived, a Rule Set default) does not open a sheet: it says why in the popover (4.10.2).

#### 4.10.2 The Trace popover (M1-23)
- **Opens** by click or `T` on any figure (1.6): beside the figure on the grid and lists, and at the
  inspector's top over the Selection tab where the figure is in the inspector. A dialog scope: `Esc`
  closes and focus returns to the figure.
- **Content, level one: the figure's lines.** A BOQ quantity: "Quantity 186.34 cft · 14 Measurement
  Lines" over a table (Element, Nos × L × B × H, quantity, rules) in the grid's own columns; a
  Measurement Line: "Column C2 at 3/C, 2nd · 1 × 10″ × 20″ × 9′-7″ = 13.31 cft · column height"; a size or
  a level: its sources directly.
- **Level two: the sources of the focused fact,** one per line in the order the engine recorded them,
  stepped by `← →`; each by its kind (C7's Trace kinds, one enum):

  | Kind | Words (examples) | `Enter` / its link |
  |---|---|---|
  | read from a sheet (`sheet_entity`) | "Size 10″ × 20″, read on S-08 Column layout plan, 2nd to 9th, from the label "C2 (10×20)"" | opens the sheet at the source |
  | supplied by a Question (`question`) | "From Q4, answered by Nusrat Jahan, 12 Oct 2026: 10″ × 24″" | focuses the answered Question in the Questions tab |
  | typed (`qs_typed`) | "Typed by Nusrat Jahan, 12 Oct 2026" (with "(Vextrus)" for an Engineer) | none |
  | derived (`derived`) | "Derived from the 2nd's slab level +20′-0″ and the 3rd's +30′-0″"; "A Rule Set default: slab 5″" | focuses the facts it came from |
  | best candidate (`best_candidate`) | "Awaiting answer, Q4: priced as read, the plan's 10″ × 20″" | focuses the Question |

- **The rules** a Measurement Line names appear as "Measured by: Column height" with the rule's words and
  its code and source on a second line, as the Rule Set prints them ("F1 · From the top of the pile
  cap or footing, then from the top of each floor slab, to the underside of the slab above · IS 1200
  Part 2, cl. 4.2.2.1"; a height taken before the slab above is confirmed adds "J1 · a column with no slab above yet is measured to a default slab thickness of 5″ and
  measured again when the slab is confirmed" (J1 is not a rule of `docs/research/qs-defaults.md`: it is
  the one rule M1 adds, `docs/plans/M1.md` C11 and O6, which M1-07 gives its code and words and the
  owner signs with the Rule Set); a rule's words are Rule Set data, shown as
  given. The rules are never a section sign into a file.
- **What the popover never shows:** a handle, a file or sheet id, a bounding box, a reader's name, a
  raw tuple (1.1, 5).
- **States:** a figure the API sent no Trace for: "No source was recorded for this figure." (1.6); a
  source whose sheet is gone from the Drawing Set: "The sheet this was read on is no longer in the
  set." with the figure's own words kept; loading: one Skeleton line "Finding where this was read…".
- **Keys:** `T` opens and closes; `← →` step the focused fact's sources, the sheet flying to each when
  it is already open; `↑ ↓` move between lines or facts; `Enter` opens the focused source's sheet
  highlighted; `Esc` closes. From the Priced BOQ the popover opens first and the sheet second
  (settled here: the popover names the facts and the rules, and `Enter` goes on to the sheet; the
  sheet route's `Esc` returns to the grid with the row focused).
- **Picking** (M1-23's R-tree over the sheet's primitives): a click on the open sheet on an element
  that is a source of a Proposal or Element selects it in the list and the inspector; the list row
  scrolls into view and the canvas boxes the source. A click on empty paper does nothing. A pick that
  hits several (overlapping sources) selects the smallest box and `Tab` cycles the others.

#### 4.10.3 The preview of a group (M1-23; C13's endpoint)
- **Where:** the inspector's "What it adds" under the group's header (4.1.3). It is not stored and
  says so: "This is what confirming adds. Nothing counts until you confirm."
- **Columns:** Element ("C2 at 3/C, 2nd") | Nos × L × B × H in the Display Units ("1 × 10″ × 20″ × 9′-7″") |
  Quantity ("13.31 cft") | Rules (the rule's words: "Column height"; the code in the Trace); for a Rebar line: Bars ("8 × 20 mm") | Net length | Laps |
  Quantity in kg to 2 decimals. The total row: "14 columns · 186.34 cft". A held Element's lines
  are marked "awaiting answer" and totalled apart. Rows open their Trace (`T`).
- **Refreshes** when the focus moves to another group and after any act that changes it; the group's
  row quantity and the bar's "= 186.34 cft" come from the same call.
- **States:** loading, "Working out what this adds…"; refused or failed: "The quantity could not be
  worked out for this group. The Elements are still readable." with "Try again" (the Confirmation is
  not blocked by it); an empty group: nothing.

### 4.11 The 3D Live Model and the Element inspector (M1-25; M1.md C17)
- **Purpose:** the confirmed frame as one Building, storey by storey, with what is still a Proposal or
  awaiting answer shown as such (screens.md 3D rulings 6–11).
- **The QS's job:** see that the frame stands where the plans put it; find a missing or doubled
  Element; open any Element's facts and Trace.
- **How it is reached:** the top bar's project navigation reads "Takeoff · Drawing Set · Priced BOQ ·
  Material Schedule · Live Model" for every role, never reachable by address only (a slice walk defect); the rail
  and the Priced BOQ's Elements link to it; `G` on a selected Element goes to it with `?select=`.
  The page title is "Live Model".

#### 4.11.1 Regions (1280×800 and 1440×900)
```
┌ top bar ───────────────────────────────────────────────────────────────────────────────┐
│ rail │ ┌ canvas (ortho, 912 px at 1280) ────────────────────────┐ ┌ inspector 320 px ┐ │
│ 56   │ │ tool bar (icons + key chips)           [view cube]      │ │ Selection │ Qs   │ │
│      │ │ chips: "3 hidden"  "Isolated: 4th"     ┌ storeys ┐      │ │ Column C2 at     │ │
│      │ │                                        │ Roof    │      │ │ 3/C, 4th         │ │
│      │ │            the frame                   │ 9th …   │      │ │ facts, Trace     │ │
│      │ │                                        │ Ground  │      │ │ Counts in 3 BOQ  │ │
│      │ │ legend (Status | Family)               │ Found.  │      │ │ items            │ │
│      │ │ Confirmation bar (Proposals only)      └─────────┘      │ │                  │ │
│      │ └─────────────────────────────────────────────────────────┘ └──────────────────┘ │
│ status bar: 1,260 Elements · 38 Proposals · 4 awaiting answer                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
- **The canvas** takes at least 70% of the width with the inspector open (1.9). It is `dir="ltr"` and
  never mirrored (m0-screens 1.8).
- **The storey list** is a panel at the canvas's left edge, 200 px, collapsible by its header chevron
  (`F6` reaches it as its own region): "Foundations" first (a toggle), then Roof down to Ground (a
  storey above another is listed above it); each row: name, its Element count, the isolate and plan-cut
  marks. A second section "Elements" below it lists the filtered Elements by storey, family, mark; it is
  also the way to every Element without the canvas (the no-drawing state below). Settled here: the
  Foundations toggle and the storey list are one control.
- **The tool bar** (top, centre): Select `V`, Hand `H`, Measure `M`, Area `A`, Lengths `L`, Section
  plane `S`, Section box `B`, Colour by `C`; each an icon button with its key chip and a tooltip, the
  tool in use filled. At 1280 the bar fits one line (eight 32 px buttons).
- **The view cube** (top-right): faces and corners focusable (2.3); an "ortho | perspective" toggle
  below it (`O`).
- **The legend** (bottom-left): by Status, "Confirmed · Proposal · Awaiting answer" with the three
  styles, or by Family, "Columns · Beams · Slabs · Piles …" with each family's catalogue noun; a row's
  count; a click isolates its Elements.
- **The Confirmation bar** (foot, only while a Proposal or its group is selected): the same bar as 4.1.2
  with the same words, `Enter`, `X`, `E`, `Ctrl Z`; for a confirmed Element it is absent and the
  inspector speaks.
- **The inspector** (below).
- **The status bar:** "1,260 Elements · 38 Proposals · 4 awaiting answer"; with `?perf` the meter.

#### 4.11.2 What is drawn (the owner's session-01 rulings 6–11)
| Thing | Drawn as |
|---|---|
| Confirmed Element | concrete grey, solid |
| Proposal | opaque cyan with dashed edges, never translucent (ruling 6) |
| Held by a Question (`blocked` or `held`) | amber tint, pulsing once on arrival (none under reduced motion); the Question's origin carries the revision-cloud marker (ruling 10) |
| Excluded | not drawn (it stays in the Elements list, struck through) |
| A step not yet read | absent: no geometry exists |
| Piles | shown; the opening fit frames the building above ground and the Foundations toggle shows or hides them (ruling 9) |
| Cut faces | coloured by material: concrete grey; brick hatched terracotta (when M2's walls exist) (ruling 11) |
| A confirmed Element's volume and bounds | equal `live_model`'s primitives per Element (CI geometry test, ADR 0022): members drawn as measured, a column stopping at the slab soffit, a beam between column faces (story 70) |

A column is one Element per storey, drawn and measured storey by storey; picking one offers its whole
Storey Band ("Select the band: 14 columns"); selecting and confirming the band is one act (ruling 7,
refined: one Element per storey, the Storey Band a fact and the group).

#### 4.11.3 Opening, selection and sync
- **Opens orthographic for the QS,** an isometric from the south-east (azimuth 45°, elevation 30°; settled
  here, open to the owner's walk) framing the building above ground; the MD's role opens in
  perspective (screens.md ruling 8); `O` toggles either and is remembered per person.
- **Selection** is shared: a pick selects in the inspector, highlights the Element's row in its step's
  list (`G`), and in the Priced BOQ the inspector's "Counts in" lists its BOQ Items, each a link that
  opens the grid at that item with its lines open (story 68). The selection lives in the address
  (`?select=<id>`), never in text.
- **Selecting a band** (inspector button "Select the whole band", `Shift V`, or double-click with the
  Select tool): the Elements of the band, one inspector showing the band's facts.

#### 4.11.4 The Element inspector (C17's `GET …/model/elements/{id}`)
Top to bottom:
1. **Header:** the Element's name by 1.2 ("Column C2 at 3/C, 4th") and its StatusMark; with a held
   Element the Question's card is the first block ("Awaiting answer, Q4").
2. **Where:** "Storey 4th · Storey Band 2nd to 8th · Grid 3/C" and "Level +40′-0″ to +49′-7″".
3. **Facts** (the Attributes, from `attrs`): one row each, "Section b 10″", "Section d 20″", "Concrete
   strength 3600 psi", "Cover to the sides 1½″", the value in the Display Units with its unit; every row a
   figure: `T` opens its Trace (the row says "read on S-08" or "typed by Nusrat Jahan" in a muted second
   line). M1-28 adds the grouping and the filters (4.12).
4. **Classification:** "IFC class: Column" (the Library's label, never the schema's identifier) and its Uniclass reference as the Library gives it (a
   number the Library supplies, shown as is).
5. **Counts in:** the BOQ Items this Element's lines are in, each "2.1.1 RCC 1:1.5:3, f′c 3600 psi, in
   columns · 13.31 cft", a link.
6. **Trace:** the sources by fact ("Size: S-08 Column layout plan, 2nd to 9th"), each `T`-able; "typed"
   and "derived" in their words.
7. **Who did what** (as 4.1.3): proposed, confirmed, typed, answered.
8. **Actions** (not for the MD or a Guest): "Show on the sheet Space", "Show in Takeoff G", "Exclude
   X", "Edit E" (the edit form of 4.1.3).

#### 4.11.5 States
| State | What shows |
|---|---|
| **Empty** | "The Live Model has no Elements yet. Confirm a Takeoff Step and its Elements appear here." · "Go to the Takeoff" |
| **Loading** | the Skeleton over the canvas and "Building the Live Model…"; the storey list and the inspector still work from the Elements list as it arrives |
| **No drawing available** | the canvas area becomes the Elements list across its width and a bar "This browser cannot draw the Live Model. You can still pick an Element and read its facts." (never the graphics interface's name); a lost connection that does not return shows "The Live Model's picture was lost. Try again." with "Try again" (#120: a lost context never leaves a silent blank canvas: the error shows after 5 s with no restore) |
| **Held** | amber tint and the Question's number in the inspector; `Q` goes to the next |
| **Read-only** | the MD and a Guest: no Confirmation bar, no edit; the tools work |
| **Out of date** | 1.4's "Figures changed while you were away. Refresh to see them." |

#### 4.11.6 Words
"Column C2 at 3/C, 4th"; "Section b 10″"; "Read on S-08 Column layout plan"; "Proposal" (cyan, dashed);
"Awaiting answer, Q4" (amber); "3 hidden · Show all R"; "Isolated: 4th"; "Foundations"; "Select the
whole band (14 columns)". Canvas labels (storey tags on the cube, dimension sprites, the section's
cut labels) come through `canvasLabel()`, which takes `{id, name}` pairs and catalogue messages only;
its unit test runs the seed.

#### 4.11.7 Settled here, and what is left
- The opening view's angle (south-east isometric); the storey list and Foundations as one control; the
  Elements list as the fallback and the keyboard's route to every Element; the MD opens perspective.
- **Left:** the budgets on the reference setup decide how much a section draws (M1-43, the owner's
  run); nothing else.

### 4.12 The 3D's tools: measure, sections, properties and filters (M1-26, M1-27, M1-28)
- **Purpose:** the QS's checking tools (session 02 Q25): measure and area, an Element's dimensions
  with clear spans, section plane and box with dimensions on the cut, properties and filters by
  Attribute.
- **The QS's job:** check a span, a level or a quantity against the drawing without leaving the 3D.
- **Rules for all tools:**
  - a tool is a **mode** (a mode scope, not `modal`, 2.1): while it is on, its own keys act and
    `Esc` returns to Select;
    the tool bar's filled button shows which;
  - every readout says it is on the model, not a BOQ figure ("on the model"), because the BOQ's
    figures are measured by the Rule Set and these are geometry (1.10);
  - lengths in ft-in with mm in brackets where the Market's profile asks (the Display Units' choice);
    levels signed; a measured distance equals the model's to the display precision (a CI test);
  - every tool holds ADR 0022's budgets while in use (a section drag, a measure hover), checked by
    `?bench` (M1-43);
  - the MD and a Guest may use every tool (they change nothing stored).

#### 4.12.1 Measure and area (M1-26)
- **`M` distance:** the pointer shows a snap marker (corner, midpoint, edge, face, a grid intersection,
  a cut face's edge) and its kind in words ("corner", "midpoint", "grid intersection 3/C"); click
  sets the first point, the next click the second; the readout beside the pointer: "14′-6″ (4420 mm)
  · ΔX 14′-6″ · ΔY 0′-0″ · ΔZ 0′-0″ · on the model". **Chains:** continuing clicking adds segments and
  the readout adds "Total 29′-0″ over 2 segments"; `Enter` ends the chain, `Backspace` removes the last
  point.
- **Axis lock:** `X`, `Y`, `Z` (inside the tool) lock to that axis; again releases; `Shift` held locks to
  the nearest axis. These letters mean those axes only while the Measure tool is on (a mode outranks
  the screen's `X` exclude and `Z` zoom).
- **By keyboard:** select an Element first (`[` `]`); then, with the canvas focused, `Tab` steps through the snap points of the selected
  Element (its corners and edge midpoints), `Enter` sets the point, so every measurement a mouse can
  make between Elements a keyboard can.
- **`A` area:** pick a face (click, or `Enter` on the focused face): "324 sft · perimeter
  72′-0″ · on the model"; further faces add and show "Total 648 sft".
- **States:** each tool's own empty: "Pick two points" / "Pick a face"; nothing to snap: "No corner
  near here." as a quiet pointer note.

#### 4.12.2 An Element's dimensions (`L`, M1-26)
Toggles dimension labels on the selection: a column "10″ × 20″ × 9′-7″, +10′-0″ to +19′-7″" (the 1st floor's); a beam
"10″ × 18″ overall (13″ below the slab) · clear span 14′-6″" with the extension lines between column faces; a slab "5″ ·
324 sft · +20′-0″"; labels thin as the model zooms out. Where the Element has a Trace the label is a
figure: `T` on the focused label opens it.

#### 4.12.3 Section plane and box (M1-27)
- **`S` plane:** a first panel asks where: a list of the grid lines ("Line 3", "Line C") and of the
  levels (the storeys' names with their slab levels); picking one places the plane; dragging snaps to
  grid lines and levels, and `← →` step it to the previous / next line; a small field takes a typed
  position ("C", "3", "+20′-0″"). The cut face is coloured by material (concrete grey), its outline
  drawn, and **dimensions on the cut**: storey heights, slab thickness, beam depth with its mark
  ("B12 18″"), thinned when zoomed out. The side of the plane that is cut away can be flipped by `Shift S`.
- **`B` box:** six faces; drag a face, or focus it (`Tab` steps through the faces) and move it with
  `↑ ↓` by 1′-0″ (`Shift` 1″); `R` resets the box to the building.
- **States:** "Pick a grid line or a level" until placed; a plane that cuts nothing: "This plane cuts
  nothing. Move it into the building."

#### 4.12.4 Properties, colouring and filters (M1-28)
- **The properties** extend the inspector's Facts (4.11.4): Attributes grouped as the session-02
  component store did ("Cost", "Construction", "Operation and maintenance"), each value with its
  source line; the Life Phase heading reads "As designed" once (it is the only phase in M1); the
  Storey Band, geometry (length, width, height, levels), quantities ("Counts in", 4.11.4), IFC class,
  classification, Trace.
- **`C` colour by:** a menu: Status (default), Family, Storey, Mark, Concrete strength, Mix,
  Construction Stage, and any Attribute the Developer added (labels only); the legend lists values
  with counts ("3600 psi · 312 Elements"); a legend row's `Enter` isolates its Elements, `Delete` hides
  them, `Shift I` ghosts the rest.
- **Filters** (the left panel's third section "Filter"): a structured query built from rows "Family
  is Columns", "Storey is 2nd to 8th", "Concrete strength is 3600 psi" (the Attribute chosen by label, the
  operator by words "is", "is not", "is at least", "is at most", the value typed in the Display Units);
  the result count "42 Elements match" and the Elements list narrows; `R` clears; the filters run on
  `live_model`'s structured query (C7).
- **States:** "No Element matches: concrete strength 4500 psi" (the filter's own words back); a
  Developer's added Attribute with no values: "No Element has a value for Fire rating yet."
- **Keys:** 2.3's.
- **Settled here:** the tools are modes with their own letters; readouts say "on the model"; every
  tool is reachable by keyboard. **Left:** the budgets (M1-43).

---
### 4.13 The Priced BOQ (M1-20; M1.md C13)

- **Purpose:** the Building's Priced BOQ, BOQ Section by BOQ Section, with the money strip on top; the
  MD's first screen.
- **The QS's job:** read where the money is; open any BOQ Item's Measurement Lines and their Trace;
  open its Rate Analysis (F2); enter the Gross Floor Area so allowances price; switch the Display
  Units; see what is awaiting an answer.
- **The MD's job:** the same, read-only: where the money is, how firm it is, what rests on open
  Questions, and which steps are still on allowance.

#### 4.13.1 Regions (1280×800 and 1440×900)
```
┌ top bar: Takeoff · Drawing Set · Priced BOQ · Material Schedule · Live Model ─────────────────┐
│ rail │ ┌ strip ─────────────────────────────────────────────────────────────┐ ┌ inspector ┐ │
│      │ │ Total ৳9,81,21,666 (9.81 crore) │ ৳2,336 per sft │ Measured 7% of total │ │ BOQ Item  │ │
│      │ │ Measured ৳67,56,094 │ Awaiting answer ৳1,25,572 │ Allowance ৳9,12,40,000 │ │ facts,    │ │
│      │ ├ toolbar: By item | By floor   Show: All ▾   Prices   Imperial | Metric ┤ │ Questions,│ │
│      │ │ No.   Description                    Unit  Quantity   Rate (৳) Amount (৳) ▪ │ │ Rule Set, │ │
│      │ │ 2.1   Columns                                                              │ │ Rebar kg/ │ │
│      │ │ 2.1.1 RCC 1:1.5:3, f′c 3600 psi, in columns (stone chips 20 mm down, OPC),  │ │ sft       │ │
│      │ │       excl. formwork and Rebar                                              │ │           │ │
│      │ │       Measured                        cft  1,331.00   276.67  3,68,247.77 ▪ │ │           │ │
│      │ │       + 106.48 · Q4, Q7                                       + 29,459.82   │ │           │ │
│      │ │ 2.1.2 Formwork to columns, plywood    sft  4,792.00    96.50  4,62,428.00 ▪ │ │           │ │
│      │ │ 2.1.3 Rebar, Grade 500W, in columns   kg       8,350    88.50  7,38,975.00 ▪ │ │           │ │
│      │ │       from the drawing + rules                                              │ │           │ │
│      │ │   ▾ 100 Measurement Lines …                                                 │ │           │ │
│      │ │ 2.9.1 Casting labour (Labour Contract),  sft 42,000.00  170.00 71,40,000.00 ░│ │           │ │
│      │ └─────────────────────────────────────────────────────────────────────┘ └────────────┘ │
│ status bar: Rule Set: Standard rules, version 1 · 14 BOQ Items have no rate yet               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```
- **The strip** (C13) at the top of the canvas, two rows at 1280 and one at 1440. Row one (the
  headline): **Total** (measured + awaiting answer + allowance, each Element once), **per area** ("৳2,336
  per sft of 42,000 sft, entered"), and **the measured share** ("Measured 7% of the total", with a
  three-part bar: measured solid, awaiting answer amber hatched, allowance grey hatched, a legend by
  words and never by colour alone). Row two: **Measured**, **Awaiting answer**, **Allowance**, and the
  **unpriced count** ("14 BOQ Items have no rate yet, from 9 prices not entered"; a link, below).
  **Money in the strip is whole taka** with its short form in the Market's words beneath ("9.81
  crore", "1.26 lakh"), the figures adding as displayed (1.3). Each figure is focusable; `T` opens
  its Trace: its breakdown by BOQ Section, each row focusing that section in the grid.
- **Heights (one budget):** the strip is 72 px at 1280 (two rows of 36 px, each figure with its short
  form beside or beneath it in a smaller size) and 48 px at 1440; the toolbar 32 px; **a grid row is
  40 px, two lines** (line one the description cut with an ellipsis and whole in the tooltip and the
  inspector; line two the Basis words, and for a held item the awaiting-answer line); a heading row
  28 px. The grid's line one uses the short description for the grid ("RCC 1:1.5:3 in columns, f′c
  3600 psi"); the full words with the aggregate, cement and "excl. formwork and Rebar" are the
  inspector's and the tooltip's, and what a BOQ export would print (M2).
- **The toolbar:** the view segmented control "By item | By floor" (`S` switches), the filter "Show:
  All, Unpriced, Awaiting answer, Allowance, Rebar" (a menu), a "Prices" link (the page where a price
  changes, 4.14; QS and Engineer) and the Display Units "Imperial |
  Metric" (QS and Engineer, with the confirmation of 4.13.5; the MD and a Guest see the words "Display
  Units: Imperial (cft, sft, rft)", settled here: switching re-bills the project for everyone, so it is
  not a view toggle a reader may flip; open question 9.3).
- **The grid** (TanStack Table with Virtual, screens.md; M1.md plan item 12), rows below.
- **The inspector** (320 px, kept as the frame's): nothing focused, "Priced BOQ of Kadam Residence" /
  "Rule Set: Standard rules, version 1" with "Read the rules" (4.15) / "5 of 7 steps measured: 4
  closed, 1 closed with a Question open; 2 on allowance" / "Measured Rebar: 38% read from the drawing,
  62% by ratio" / **"Rebar 3.53 kg per sft of Gross Floor Area so far (usual range 4.5 to 6 for the whole
  Building)"** with its second line **"Measured: piles, pile caps, column stubs and columns (23,056
  kg, 668 kg awaiting answer); on allowance: beams, slabs, core, stairs, tanks, lintels, roof room
  and the rest of foundations (124,362 kg)"**,
  flagged in amber and never blocking where it falls outside (the whole-building check, over
  measured, awaiting-answer and **every** allowance row's Rebar, A4's included: 148,086 kg ÷ 42,000
  sft (T8); a light measured frame is shown against the whole-building range with that said, never
  alone); an item focused, its facts
  (description, Billing Unit, Cost Basis, Rebar Basis and, for Rebar by ratio, its ratio "5.1 kg per
  cft" and its from-the-drawing share, the Rate Analysis's source line, its Questions with their
  cards).
- **Width budget (one, 1.9):** the canvas is 912 px at 1280 and 1072 px at 1440, the inspector kept.
  Fixed columns, 1280: Number 56 + Unit 48 + Quantity 112 + Rate 92 + Amount 128 + Basis mark 24 +
  Trace 24 = 484 px, leaving the Description 428 px (never under 330); 1440: Number 56 + Unit 48 +
  Quantity 120 + Rate 100 + Amount 140 + Basis mark 24 + Share 90 + Trace 24 = 602 px, leaving 470 px.

#### 4.13.2 Rows and columns
| Column | 1280 | 1440 | Content |
|---|---|---|---|
| Number | 56 | 56 | "2.1.1", section.group.item, derived by the API and never typed (a Lump Sum's too) |
| Description | 428 (flex, at least 330) | 470 | Line one: the grid's short description of 1.7 (ending in the group when its section row is collapsed); allowance lines "Beams: RCC in beams, allowance". **Line two, muted, always: the Basis in words** ("Measured", "Allowance", "by ratio", "from the drawing + rules") |
| Unit | 48 | 48 | The Billing Unit's word: "cft", "sft", "rft", "kg", "nos" |
| Quantity | 112 | 120 | Right-aligned (`QuantityCell`): the measured quantity "1,331.00"; a second muted line "+ 106.48 · Q4, Q7" (never inside the figure; its own focus stop, `↓`; the full words in the tooltip and the inspector: "106.48 cft awaiting an answer to Q4 and Q7") |
| Rate (৳) | 92 | 100 | `MoneyCell`: "276.67", header "Rate (৳) per unit"; "rate not entered" in amber; never an editor (screens.md ruling 3: F2) |
| Amount (৳) | 128 | 140 | `MoneyCell`: "3,68,247.77" (M12); "—" for an unpriced item; a second muted line "+ 29,459.82" for the awaiting answer (W1) |
| Basis | 24 | 24 | `BasisMark` glyph (the words are line two of the Description) |
| Share | — | 90 | Rebar items only: "81% from the drawing"; at 1280 it is in the inspector |
| Trace | 24 | 24 | the leader glyph; `T` on the row's figure opens it |

- **Every quantity, rate and amount printed in 4.13 to 4.16 is a row of 6.1** (the rows are cited:
  M12 to M14 for the column items, W1 to W3 for what is awaiting an answer, A1 to A4 for allowances,
  T1 to T8 for the strip, C1 to C9 for cement).
- **Sections and groups:** the seven BOQ Sections in CONTEXT.md's order (Sub-structure,
  Super-structure, Masonry, Finishes, Doors & Windows, Services, External works), each a heading row
  with its amount, then groups ("Columns", "Beams", "Slabs"), then items. **Within each RCC class the
  order is concrete (cft), formwork (sft, "contact area") and Rebar (kg), together** (G4; story 84):
  "2.1.1 RCC … in columns · 2.1.2 Formwork to columns · 2.1.3 Rebar, Grade 500W, in columns". Headings
  expand and collapse with `Enter` (when focused) and `→ ←`; the grid opens with Sub-structure and
  Super-structure expanded and the rest collapsed to their amounts. **A Labour Contract's casting-area
  line** (CA1: each slab's area over beams and columns, per floor) sits at the end of the BOQ Section
  whose items it covers ("2.9.1 Casting labour, per sft of casting area (Labour Contract)", sft, rate
  170.00), its Measurement Lines one per floor with their Trace. **Between Step 6 and Step 8 it is
  carried, never "—":** the slabs step's allowance holds a casting-labour row at 1.00 sft of casting
  area per sft of floor, 42,000 sft × 170.00 = ৳71,40,000.00 (A2), hatched and worded "Allowance"; Step 8's
  close replaces it whole by the measured area (story 99). The **shutter hire** line beside it reads
  "rate not entered" until the project's shutter setting (4.14.3) is set; with "Hired" it **replaces**
  the shutter material lines of the Formwork Rate Analyses (4.14.2), never adds to them.
- **An allowance line** sits inside its step's BOQ Section and is never split (screens.md Summary
  ruling 7): hatched, with the word "Allowance", **one row per BOQ Item** the step will bring, each
  its consumption × the Gross Floor Area at current Market Prices, and the step's heading the sum of
  its rows. Every consumption here is G9's, which is B.2 of `docs/research/tax-and-allowances.md` at G+9
  (6.1). Beams (A1), from its rows: concrete 0.22 cft per sft = 9,240 cft × 276.67 = ৳25,56,430.80;
  formwork 0.68 sft per sft = 28,560 sft × 96.50 = ৳27,56,040.00; Rebar 1.14 kg per sft = 47,880 kg ×
  88.50 = ৳42,37,380.00; **Beams: allowance ৳95,49,850.80**, "Nothing measured yet" while the step is on
  allowance. Slabs (A2): concrete 0.486 cft per sft (0.465 slab, 0.021 edge members) = 20,412 cft
  (৳56,47,388.04); formwork 0.88 sft per sft = 36,960 sft (৳35,66,640.00); Rebar 1.22 kg per sft =
  51,240 kg (৳45,34,740.00); casting labour 1.00 sft per sft = 42,000 sft (৳71,40,000.00); **Slabs:
  allowance ৳2,08,88,768.04**. A step in review shows "Measured
  so far ৳2,19,751.11 of an allowance of ৳1,00,46,919.54" on its heading row (Step 6 at Moment A: its
  14 confirmed columns, X1: 186.34 cft × 276.67 + 670.88 sft × 96.50 + 1,169 kg × 88.50; A6; story 98); its source
  reads "Vextrus default, low confidence" (editable: 4.15). **Step 6's allowance has two parts, as Step 5
  has two:** the columns part (concrete 0.17 cft per sft = 7,140 cft × 276.67 = ৳19,75,423.80; formwork
  0.47 sft per sft = 19,740 sft × 96.50 = ৳19,04,910.00; Rebar 1.19 kg per sft = 49,980 kg × 88.50 =
  ৳44,23,230.00; ৳83,03,563.80) and **"Shear walls and lift core"** (concrete 0.041 cft per sft = 1,722
  cft = ৳4,76,425.74; formwork 0.12 sft per sft = 5,040 sft = ৳4,86,360.00; Rebar 0.21 kg per sft =
  8,820 kg = ৳7,80,570.00; ৳17,43,355.74). Closing the step replaces the columns part whole by the
  measured items (story 99); **the walls-and-core part stays, hatched, until M1-37 reads the walls**
  (4.6), so unread walls never drop out of the total. Items outside the casting-area contract (pile
  caps, grade beams, the column stub from cap top to plinth) carry their own casting labour, RCC
  308.17 per cft (276.67 + the starter's 31.50) and formwork 114.50 per sft (96.50 + 18.00); their
  Rebar binding labour has no starter figure and reads "rate not entered", counted among the unpriced.
  A step closed replaces its allowance whole by its measured items (story 99), except a part that is
  not read.
- **"Unclassified":** a BOQ Item with no Rate Analysis is shown unpriced under a heading "Unclassified:
  no Rate Analysis" at the end of its BOQ Section (story 89); each says "rate not entered".
- **A Lump Sum** (unit "LS") shows its typed amount; an amount changed is a price effect unless
  marked a scope change (screens.md ruling 4), which M1 stores but the Revision Comparison (M2) uses.
- **Quantity × rate = amount** holds on every row (the row's Trace says so: "1,331.00 × 276.67 =
  3,68,247.77"); the web shows the API's three figures and checks nothing (1.10).
- **Rebar by ratio shows its ratio.** A Rebar quantity by ratio is a derived figure: its Trace reads
  "Concrete in piles 6,664.98 cft × 1.7 kg per cft (the Rebar Ratio for bored piles, a Rule Set
  default) = 11,330 kg; split by diameter as assumed" and the row's second line says "by ratio · 1.7 kg per cft".

**A BOQ Item opened (`Enter`):** its Measurement Lines expand under it: "100 Measurement Lines"
over a virtualised table: Element ("C2 at 3/C, 2nd") | Storey | Nos | L | B | H (Display Units) |
Quantity | Rules (the rule's words) | Trace; a Formwork line shows Perimeter or Sides × H ("1 × 5′-0″ ×
9′-7″ = 47.92 sft · column perimeter and height"); lines group by storey when sorted so; a Rebar item's
lines show Bars, Net length, Laps and kg; a held line is marked "awaiting answer, Q4". (Measured:
47,959 lines open with no dropped frame, screens.md.) A line's `T` opens its Trace (4.10.2); `Enter` on
its Element selects it and `G` goes to the Live Model.

#### 4.13.3 By floor (the view, screens.md ruling 7)
"By floor" regroups the same data: a heading per storey ("Roof", "9th" … "Ground", "Foundations"),
under it the BOQ Items with their **quantity for that storey only** and no amounts ("Floor rows show
quantities only; amounts at item level", ruling 2); the header says "Amounts are at item level. Switch
to By item to see them." A floor has the item's quantity share beside it as a whole percent of that
item's quantity. Allowance lines have no floor ("not yet by floor", 4.16). `Enter` opens a floor's
item lines as in By item.

#### 4.13.4 Copy, paste and typed figures
- **Copy (`Ctrl C`):** the selected range as tab-separated text with plain numbers (no grouping, no
  symbol: `1331.00`, `276.67`, `368247.77`) so Excel sums them; headings are copied as text; the toast
  "Copied 12 values." The range is chosen with `Shift` and the arrows, `Ctrl A` (the column) or `Shift
  Space` (the row); the Material Schedule's grid and the bar-bending table copy the same way.
- **Paste (`Ctrl V`)** (screens.md ruling 1): lines up as Excel does; **headings count as figures, are
  skipped as read-only, and the grid says what it skipped** ("Pasted 6 values. Skipped 4: 2 headings and
  2 that cannot be typed."). Only typed figures accept it: an allowance consumption (4.15) and a Lump
  Sum's amount; a rate or a quantity never does.
- Not proven: the real Windows Excel clipboard, screen readers and IME (screens.md); the owner's
  Windows walk includes one paste (7.2).

#### 4.13.5 The Display Units switch
`Imperial | Metric` first asks (a dialog; `Enter` confirms, `Esc` cancels; default focus "Cancel"):
"Re-bill the Priced BOQ in metric? This changes it for everyone on this project." / "Re-bill ↵". It then
calls the project's display-units endpoint (C15) and re-bills: each BOQ Item from its SI quantity and
exactly converted rate, rounded once per item (C13). After a switch the strip's foot says "Re-billed
in metric. The total differs from imperial by ৳12.40, from rounding each item once." until dismissed
(`Esc`); switching back restores the previous figures exactly. A system the Market does not offer is
refused (`projects.units.not_offered`) with "This project can be billed in imperial only."

#### 4.13.6 States
| State | What shows |
|---|---|
| **Empty** | "Nothing is measured yet. BOQ Items appear here as Takeoff Steps are closed." and, while the Gross Floor Area is not entered, the allowance lines are absent and the strip says so |
| **Loading** | the Skeleton over the strip and the grid with "Pricing the Building…" |
| **No Gross Floor Area** | QS: "Enter the Gross Floor Area to price the allowances and the total per area." with the field in the strip (type "42,000", unit chip "sft"); the MD and a Guest: "The Gross Floor Area is not entered yet. Nusrat Jahan (QS) enters it." with no field. Until then the Allowance shows "—" and the Total's label reads "Total, measured and awaiting answer only" |
| **Unpriced** | QS: "14 BOQ Items have no rate yet; they add nothing to the totals until prices are entered." with "Enter prices", which opens Prices with the filter "Not entered (9)" on and its first row focused, so `Enter`, type, `Enter` walks the list; the MD and a Guest: "14 BOQ Items have no rate yet; the QS enters prices." with no action |
| **Held** | an "awaiting answer" quantity and amount beside the measured, never inside; a click opens its Question |
| **Step closed with Questions** | the strip's Awaiting answer figure is non-zero and amber |
| **Out of date** | 1.4's bar |
| **Error** | the ErrorBar "The Priced BOQ could not be worked out. Nothing is lost." with "Try again"; a BOQ the API refuses shows its words and keeps the page |
| **Read-only** | the MD and a Guest: ReadOnlyChip in the toolbar; no editor, no Display Units switch, no "Enter prices"; a Guest, until ruled, sees "Ask the Developer for access to costs" (1.5) |

#### 4.13.7 Words
"RCC 1:1.5:3, f′c 3600 psi, in columns (stone chips 20 mm down, OPC), excl. formwork and Rebar" (a
missing strength left out with its fragment, never "f′c  in columns"); "Formwork to columns, plywood
shuttering"; "Rebar, Grade 500W, in columns, by ratio"; "Rebar, Grade 500W, in columns, from the drawing
+ rules" with "81% from the drawing"; "Casting labour, per sft of casting area (Labour Contract)"; "Vextrus
default, low confidence" on an allowance; "Measured so far ৳… of an allowance of ৳…"; "rate not
entered"; "Awaiting answer, Q4"; "Total", "Measured", "Awaiting answer", "Allowance", "Per sft",
"Measured 7% of the total"; "Display Units: Imperial (cft, sft, rft)".

#### 4.13.8 Keys
2.4's grid rows; `T` on a quantity opens its Measurement Lines' Trace; `G` on a line's Element goes to
the Live Model; the Esc stack of 2.2.

#### 4.13.9 Settled here, and what is left
- **The metric switch** sits in the toolbar and in project settings (4.15): one endpoint, two places.
- **The strip at 1280:** two rows; each figure reachable by `Tab` in the strip's own region and by
  the grid's focus order.
- **By floor:** quantities only.
- **Left:** the strip's `measured_share` definition and `figures_hash` (8, item 8); the "Unclassified"
  marker field (8, item 12).

### 4.14 Market Prices, Rate Analyses, Labour Contracts and the piling choice (M1-21; M1.md C12)

- **Purpose:** the Developer's prices, the one place a price changes so every rate and amount follows;
  and how labour and piling are bought.
- **The QS's job:** check the starter prices; enter or change a price; see each BOQ Item's Rate
  Analysis; set up Labour Contracts; choose the piling contract for this project.
- **Where:** one page "Prices" under the project navigation with three tabs: "Market Prices" ·
  "Rate Analyses" · "Labour Contracts" (the piling choice is the Labour Contracts tab's first block).
  The Priced BOQ's F2 shows the same Rate Analysis inline.

#### 4.14.1 Market Prices
- **Columns** (the `List` primitive, 28 px; 912 px at 1280): Resource ("Cement (OPC)") 220 | Group
  ("Cement") 110 | Unit ("bag") 60 | Price ("৳560.00") 110 | Changed ("12 Oct 2026, Nusrat Jahan") 190
  | Source 150 | Used by ("12 BOQ Items") 70 (at 1440 the Source reads in full and the column widens).
- **Source:** a starter price: "PWD SoR 2022, 2nd Revised, Dhaka, p. 10"; a starter labour rate:
  "Vextrus default, low confidence" (story 92); an entered price: "Entered by Nusrat Jahan, 12 Oct 2026" and
  never the starter's citation (the slice kept the printed source beside an edited price). A price not
  entered: "rate not entered" in amber, never ৳0. A price's `T` opens its history: "Changed from
  ৳560.00 to ৳585.00 by Nusrat Jahan, 12 Oct 2026" (a Vextrus Engineer's "…(Vextrus)").
- **Editing:** `Enter` on a price opens the field in place with the number selected; typing accepts
  the Market's grouping and none; `Enter` saves and moves to the next row (so a column of prices is
  typed in one pass), `Esc` cancels and the field restores the old price. An empty field with `Enter`
  clears the price ("Price removed. BOQ Items using it show rate not entered." with Undo). The save is
  one write; the row's date and name update from the reply; the toast reads "Price of Rebar, Grade
  500W saved. 4 BOQ Items repriced." with Undo `Ctrl Z`. A write refused shows the ErrorBar at the row
  and keeps the text.
- **Effects shown:** after a price change the page notes "Allowances follow:" and one line per step whose allowance moved
  (story 114; 8, item 13), as lines under the toast's. On KR-01, Rebar 88.50 to 89.50 is ৳1.00 on
  each kg (6.1): the toast reads "4 BOQ Items repriced" (M5, M8, M11, M14: 23,056 kg, ৳23,056.00,
  with W3's 668 kg awaiting answer, ৳668.00), and the lines read Beams +৳47,880.00 (A1), Slabs
  +৳51,240.00 (A2), "Shear walls and lift core" +৳8,820.00 (A3), the other steps +৳16,422.00 (A4):
  ৳1,24,362.00 of allowance; with the measured ৳23,724.00 the strip's total moves ৳1,48,086.00.
- **States:** loading "Reading prices…"; error "The prices could not be read. Nothing is lost." with
  "Try again"; read-only (the MD): ReadOnlyChip and no field, a Guest "Ask the Developer for access to
  costs"; filter chips include "Not entered (9)" (where "Enter prices" from the Priced BOQ lands, with
  its first row focused; 4.13.6); empty list: "No prices yet. Enter the first price here, or ask Vextrus to load the starter prices." (a defect state);
  filtered by group chips ("All", "Cement", "Rebar", "Labour"…); search by Resource name (the
  Resource's label; a typed query never matches a code, 5).
- **Keys:** 2.4's price-list rows; `F2` shows which BOQ Items use the Resource.

#### 4.14.2 Rate Analyses
- **The list:** one row per BOQ Item (by number and description) with its rate and "per cft" (the
  analysis below is per 100, as PWD quotes it).
  Selecting one opens its analysis; from the grid, `F2` opens the same inline (a panel under the row,
  full width, `Esc` closes).
- **The analysis, as PWD quotes it: per 100 cft or 100 sft.** A table: Resource | Quantity per 100 |
  Unit | Wastage | Price | Amount, then the rate per 100 and the rate per unit (the BOQ's), with the
  coefficients as the Library holds them (PWD SoR 2022, 2nd Revised, p. x: RCC 1:1.5:3 is 21.8 bags
  cement, 40.9 cft sand and 81.8 cft stone chips per 100 cft; wastage cement 2%, sand 5%, chips 3%).
  Example, "RCC 1:1.5:3, f′c 3600 psi, in columns, per 100 cft", with the casting labour covered by
  the project's Labour Contract:

  | Resource | Per 100 cft | Unit | Wastage | Price (৳) | Amount (৳) |
  |---|---|---|---|---|---|
  | Cement (OPC) | 21.8 | bag | 2% | 560.00 | 12,452.16 |
  | Sand (F.M. 2.2) | 40.9 | cft | 5% | 60.00 | 2,576.70 |
  | Stone chips | 81.8 | cft | 3% | 150.00 | 12,638.10 |
  | Labour: casting | 100 | cft | | covered by Casting labour (Labour Contract) | 0.00 |
  | **Rate per 100 cft** | | | | | **27,666.96** |
  | **Rate per cft** | | | | | **276.67** |

  (invented prices; each amount is quantity × (1 + wastage) × price, and the sum is exact. Outside a
  Labour Contract the starter's casting labour, 31.50 per cft, sits on the labour line instead and the
  rate is 308.17.) **A labour line says whether it is paid here or by a contract** (labour is paid
  once, ADR 0006): "covered by Casting labour (Labour Contract)" at 0.00, or the item's own; **pile
  concrete's casting line reads "covered by Piling (labour only)"** while that contract is chosen; the
  rate is the sum without a covered line. Each price is a link to that Resource's Market Price (the
  one place a price changes); the page says "A price is changed under Market Prices; every rate and
  the Material Schedule follow." where a QS might try to type here.
- **Formwork has its own analysis, per 100 sft of contact area** (G4: formwork is its own item), so a
  QS can see what ৳96.50 per sft covers. Example, "Formwork to columns, plywood shuttering, per 100
  sft":

  | Resource | Per 100 sft | Unit | Price (৳) | Amount (৳) |
  |---|---|---|---|---|
  | Shuttering plywood, 18 mm, per use (4 uses) | 100 | sft | 55.00 | 5,500.00 |
  | Battens and props, per use | 100 | sft | 30.00 | 3,000.00 |
  | Nails, binding wire, form oil | 100 | sft | 11.50 | 1,150.00 |
  | Labour: shuttering | 100 | sft | covered by Casting labour (Labour Contract) | 0.00 |
  | **Rate per 100 sft** | | | | **9,650.00** |
  | **Rate per sft** | | | | **96.50** |

  (invented prices.) **Shutter and props are paid once:** with the project's shutter setting
  "Included in the contract" the first three lines read "covered by Casting labour (Labour Contract)"
  at 0.00; with "Hired, priced separately" they read "covered by Shutter hire" at 0.00 and the
  shutter-hire BOQ Item carries them; with "Not set" they stay as shown and the shutter-hire line
  says "rate not entered". The rate is always the sum of what is not covered.
- **Editing the lines** (story 93: "edit a Rate Analysis's lines (quantity per unit, wastage), recorded
  under my name"): specified as `E` on a line's quantity or wastage, `Enter` saves, recorded under the
  editor's name, **but C12 has no write route for it** (8, item 1): until it has, the lines are
  read-only and the page does not draw an editing affordance.
- **States:** "This BOQ Item has no Rate Analysis. It is priced by a Lump Sum or not at all." for an
  unclassified item; the source line "Vextrus default, PWD SoR 2022 coefficients" or "Entered by".

#### 4.14.3 Labour Contracts and the piling choice
- **The piling choice** (first block, the owner's "let both ways", 26 Sep 2026): a card with two radio
  options and the words of each:
  - 1 **Labour only:** "Boring and casting ৳450 per rft, head breaking ৳345 per pile (Vextrus default,
    low confidence). The casting labour is this contract's; pile concrete and Rebar are priced through
    their Rate Analyses (materials only) and appear in the Material Schedule."
  - 2 **Material and labour:** "One rate per rft of pile, or per pile. Its materials stay out of the
    Material Schedule. Rate not entered." with the rate field and its basis ("per rft of pile" | "per
    pile").
  Changing the choice opens a dialog (`Enter` confirms, `Esc` cancels): "Priced as a
  Material-and-Labour Contract? 4 BOQ Items (boring, concrete, Rebar and head breaking) are replaced by
  1, and their materials leave the Material Schedule. Nothing is counted twice." / "Change ↵". The
  result shows in the Priced BOQ at once; switching back restores them exactly.
- **The Labour Contracts list:** Contract ("Casting labour, per sft of casting area") 260 | Kind
  ("Labour only" | "Material and labour") 130 | Covers ("9 BOQ Items") 100 | Rate ("৳170.00 per sft of casting
  area") 170 | Source ("Vextrus default, low confidence" | "Entered by Nusrat Jahan, 12 Oct 2026") 160 |
  Project override 92 (912 px at 1280).
  A contract's detail lists the BOQ Items it covers; "Each BOQ Item it covers takes no other labour:
  their own labour lines are dropped" (CONTEXT.md, Labour Contract). Covering one item twice or none
  raises the labour-source Question: "Casting labour is paid twice for RCC in slabs: by Casting labour
  (Labour Contract) and by the item's own labour line." (`boq.labour_source.two`) / "No labour is priced for brickwork in 4 BOQ
  Items." (`boq.labour_source.none`), each a card with options "Use this contract" … and "Keep open".
- **Shutter and props** (the owner's ruling 7, "Ask per project"): a per-project field on the casting
  contract, three radios "Included in the contract" · "Hired, priced separately" · "Not set"; with
  "Not set" the shutter-hire line shows in the Priced BOQ as "rate not entered".
- **Roles:** the QS and a Vextrus Engineer invited by the Developer edit (story 116); the MD and a
  Guest read.
- **States:** "No Labour Contract is set up. Every item carries its own labour." (the starter list is
  never empty on a Market that ships starters); a refused write at the row; the dialog above.
- **Left:** the HTTP for the contracts list, the override and the piling choice (8, items 2 and 3).

#### 4.14.4 Settled here, and what is left
Prices are one page of three tabs; the piling choice is the Labour Contracts tab's first block and is
linked from Step 5 (4.5); dated price sets are **not** on screen in M1: the page shows and edits the
current set, with each price's change history (`T`); Issued Estimates' frozen sets are M2's.

### 4.15 Project settings: Gross Floor Area, Display Units, rules and allowances (M1-21, M1-44; M1.md C15)

- **Purpose:** the project facts the money needs, in one place the QS can find.
- **The QS's job:** enter the Gross Floor Area; choose the Display Units the Market offers; see the
  Rule Set the project is measured by; check and, where they know better, change the allowances.
- **Where:** "Project settings" in the project navigation (QS, Engineer, MD read-only) with four
  blocks, each a labelled form section:
  1. **Gross Floor Area:** a field with its unit chip ("sft" or "m²" by the Display Units; the other
     system's unit typed with the number is accepted: "3,900 m²" reads and echoes "41,979 sft"); "Gross
     Floor Area 42,000 sft, entered by Nusrat Jahan, 12 Oct 2026"; the basis word "entered" (it is
     "measured" in M2 when the Live Model gives it); a changed value shows "Saved. Allowances and the
     total per sft follow." The field **shows the unit it was typed in**: the slice showed the stored
     square metres in the sft box (A18: the API sends `{value_m2, display: {value, unit}}` and the box
     shows `display`).
  2. **Display Units:** a segmented "Imperial (cft, sft, rft) | Metric (m³, m², m)" listing exactly the
     systems the Market offers; switching says "Switching to metric re-bills the Priced BOQ; totals may
     differ by rounding only." and the Priced BOQ's note (4.13.5).
  3. **Rules:** "Measured by Standard rules, version 1" and "Read the rules": a
     list of the Measurement Rules in words with each one's source ("F1 · … · IS 1200 Part 2, cl. 4.2.2.1"), searchable by
     words (story 4). **Specified, route open** (8, item 6).
  4. **Allowances:** **one row per Takeoff Step and BOQ Item** it will bring, not yet closed (the MEP
     Parts' lines join in M3): Step | BOQ Item | Consumption with its unit per sft ("Beams · RCC in beams ·
     0.22 cft per sft"; "Beams · Formwork to beams · 0.68 sft per sft"; "Beams · Rebar · 1.14 kg per
     sft") | Source ("Vextrus default, low confidence" | "Entered by
     …") | Quantity and amount at the Gross Floor Area; the foundations step in its two parts ("Piles and pile caps", "The rest of
     foundations"); a consumption is a typed cell (`E`, `Enter` saves, `Ctrl V` pastes down a column).
     **Specified, route open** (8, item 4).
- **States:** loading "Reading the project settings…"; error "The project settings could not be read.
  Nothing is lost." with "Try again"; Gross Floor Area empty: "Not entered. The Priced BOQ shows the
  measured and awaiting amounts only." ; a value refused (`projects…`): its words under the field;
  **read-only** (the MD): ReadOnlyChip and the values as text, no field; a Guest: the Gross Floor Area
  and Display Units as text, the allowances "Ask the Developer for access to costs" (1.5).
- **Words:** "Gross Floor Area 42,000 sft, entered by Nusrat Jahan"; "Display Units: Imperial (cft, sft,
  rft)".
- **Keys:** `Enter` saves a field and moves to the next; `Esc` cancels; `Tab` moves; the form's own
  region.
- **Settled here:** the Gross Floor Area and the Display Units live on this page and the strip carries
  the GFA field only while it is empty; the Display Units switch is in both places. **Left:** none.

### 4.16 The Material Schedule and the bar-bending schedule (M1-22; M1.md C14)

- **Purpose:** what to buy and when: basic materials by floor and Construction Stage, with the
  read-only bar-bending schedule (the owner's ruling 8, 30 Sep 2026).
- **The QS's job:** check quantities by stage; see lead times; read Rebar by grade and diameter; open
  any cell to the BOQ Items behind it.
- **Where:** one page "Material Schedule" with two tabs: "Materials" · "Bar-bending schedule" (a tab,
  not a drawer, settled here: the bar-bending table is hundreds of rows and wants the canvas's
  width).

#### 4.16.1 Materials
- **Layout:** a grid with the Resources down the side (sticky: Resource and Unit, 200 + 56 px),
  grouped by the Library's groups ("Cement", "Sand", "Stone chips", "Rebar", "Bricks"…), and the
  Construction Stages across the top in building order, **one name form**, a stage being a pour: "Piling"
  · "Substructure" · "Ground floor slab (on grade)" · "1st floor slab casting" … "9th floor slab
  casting" · "Roof slab casting" · "Masonry" · "Finishes" · "Services" · "External works" · "Not yet by
  floor" · "Total". A stage holds the columns of the storey below with the beams and slab of its own
  floor (M1.md: a column belongs to the casting of the slab above it): a focused stage header shows
  that in the inspector ("1st floor slab casting: the columns of Ground, and the beams and slab of
  the 1st floor") and the same words are the tooltip, which opens on focus. It scrolls sideways under
  a sticky first column and a sticky header; a stage column is 84 px at 1280, so about 8 fit before
  scrolling.
    A segmented control switches the cells between **Quantity** and **Amount (৳)** (story 103).
- **A cell** shows the **gross** quantity, rounded up in the Resource's unit, per cell (C14). Cement,
  from the seed (C1 to C9, 6.1): **Piling 1,528 bags** (6,870.06 cft of pile concrete × 0.218 = 1,497.67
  net; × 1.02 = 1,527.63, up to 1,528), **Substructure 277**, and the columns **in the slab casting
  above them** (story 107: the casting of the 1st floor slab holds the columns of Ground): 27, 33, 33,
  33, 27, 24, 30, 30, 30 and 33 bags in the 1st to the Roof slab castings, 300 in all (each cell rounded
  up, the total their sum). A cell's Trace (`T`) reads "Cement 1,528 bags (1,497.67 bags net + 2%
  wastage)" with the BOQ Items behind it; `Enter` opens that list: each item "1.1.2 RCC 1:1.5:3 in
  piles · 1,497.67 bags of cement net", a link to the Priced BOQ at that item. While Slabs is on
  allowance its row is in "Not yet by floor"; a Developer's own typed wastage changes every figure.
- **Lead time:** each Resource row carries "Lead 7 days" (editable by the QS, `E`; the Resource's
  procurement lead) and the focused stage header's inspector line says what to order before it:
  "Order cement 7 days before the 3rd floor slab casting" (a sequence, not a date: Construction Stage,
  CONTEXT.md).
- **Rebar** rows by grade and diameter ("Rebar, Grade 500W, 20 mm") with ton totals per grade and
  diameter in a footer block "Rebar, in ton"; a row from Rebar by ratio carries "assumed split" (with
  a tooltip "The diameters are assumed for Rebar by ratio."), one from the drawing none; the footer
  repeats the split: "From the drawing: 8.766 ton · Assumed (by ratio): 14.290 ton" (T8).
- **Allowance rows** sit in the "Not yet by floor" column, hatched, "allowance".
- **Material-and-Labour materials never appear:** a note row at the foot lists them: "Not in this
  schedule: ready-mix concrete (a Material-and-Labour Contract); piling when its contract is Material
  and labour." (C14; story 96.)
- **States:** empty: "Nothing to buy yet. Materials appear here as BOQ Items are measured." ; refused;
  out of date (1.4).
- **Keys:** the grid's arrows move cells; `Enter` opens a cell's BOQ Items; `T` its Trace; `E` on a
  lead time; `S` switches Quantity ⇄ Amount; `F6` leaves.

#### 4.16.2 The bar-bending schedule (read-only, M1)
A table over the Element's bars as a QS checks a bar-bending schedule, each row computable by hand
(a column C2 of one storey, 10′-0″ floor to floor, section 10″ × 20″, 1½″ cover):
Element | Bar mark | Diameter | Shape | Members × bars | Cutting length, net of laps | Total length | kg
per m (BDS 1313) | Weight.

| Row | Diameter | Shape | Members × bars | Cutting length | Total length | kg per m | Weight |
|---|---|---|---|---|---|---|---|
| Main bars m1 | 20 mm | straight, floor to floor | 1 × 8 | 10′-0″ (3048 mm) | 80′-0″ (24.384 m) | 2.466 | 60.13 kg |
| Laps of m1 | 20 mm | 40 × d, 2′-7½″ each | 8 laps | 2′-7½″ (800 mm) | 21′-0″ (6.400 m) | 2.466 | 15.78 kg |
| Ties t1 | 8 mm | tie, 135° hooks, 3″ (75 mm) | 1 × 14 | 4′-6″ (1372 mm) | 63′-0″ (19.202 m) | 0.395 | 7.59 kg |

Worked: 8 × 3.048 m = 24.384 m × 2.466 = 60.13 kg; 8 laps × 0.800 m = 6.400 m = 21′-0″ (8 × 2′-7½″),
× 2.466 = 15.78 kg; a tie's cutting length is its perimeter inside the cover, 2 × (7″ + 17″) = 48″,
plus two hooks of 3″ (75 mm, the usual minimum) = 54″ = 4′-6″; 14 ties = 63′-0″ = 19.202 m × 0.395 =
7.59 kg. **Ties
are their own rows and their count follows the stated spacing zones:** 20″ end zones at 6″ (4 ties
each) and the 75″ between at 12″ (6 ties), 14 in the storey; the page never prints a count a zone
rule cannot give. A column's bars total 83.50 kg. **Laps are their own row** beside the net bars, as R3
and C7 say. Grouped by storey then Element, with a diameter total in ton at the foot; filters by
storey and member ("2nd", "Columns"). The words: "Bars are read for columns in M1. Piles, caps, beams
and slabs carry Rebar by ratio, with no bars to schedule." (the owner's ruling 10). Read-only: no print
or export in M1 (M2); `Ctrl C` copies the table (2.4).

**States** (4.16 as a whole): loading "Reading the Material Schedule…" (and "Reading the bars…");
error "The Material Schedule could not be worked out. Nothing is lost." with "Try again"; read-only
(the MD, a Guest): ReadOnlyChip, no lead-time edit, a Guest money-blind (1.5): quantities show, the
Amount switch and the totals in ৳ show "Ask the Developer for access to costs".

#### 4.16.3 Settled here, and what is left
The bar-bending schedule is a tab; the grid's stage columns scroll under sticky first columns;
Quantity ⇄ Amount is a switch, not two screens. **Left:** the routes (8, item 7).

---
## 5. Names on screen: the web test that refuses a key (A17)

The slice leaked storey keys, band keys, `vx.` names, raw Trace tuples and an empty strength in
brackets to the screen. This section is the check that makes each a failing test. It is **folded into
#531's banned-word check** (one list, one DOM check: `web/src/test/never-shown.ts`, its list
`never-shown.json`, and the words lint `tools/lint/words.py` over the catalogues), not a second
mechanism.

### 5.1 What it refuses
Text a QS can see or hear (the DOM's visible text, and `aria-label`, `title`, `alt`, `placeholder`
and `aria-description` of every element) containing any of:

| Shape | Pattern (informative; the test file is the source) | A leak it catches |
|---|---|---|
| An Attribute key | `\bvx\.[a-z0-9_]+(\.[a-z0-9_]+)*` | `vx.column.section_b` |
| A snake_case token | `\b[a-z][a-z0-9]*(_[a-z0-9]+)+\b` | `floor_1`, `slab_casting`, `from_drawing_rules`, `x_m` |
| A band key | `\bfloor_\d+\.\.(top\|floor_\d+)\b`, or two storey tokens joined by `..` | `floor_1..top` |
| A module's code or act code | `\b(engine\|takeoff\|boq\|rates\|live_model\|measurement\|platform\|projects\|drawings)\.[a-z0-9_]+(\.[a-z0-9_]+)+\b` (digits allowed, no underscore needed) | `engine.column.size_missing`, `boq.item.rcc`, `takeoff.step1.confirmed`, `takeoff.step1.undone` |
| An item or Resource code | the codes the API sent (5.2) | `RCC-COL-1:1.5:3`, `cement_opc` |
| An identifier | a UUID; `sha256:` or a hex run of 32 or more; `[0-9A-F]{4,6}` handles are caught by 5.2 | a sheet, view or file id |
| A Trace tuple or box | a bracketed list of two or more numbers **bare or quoted** (decimals travel as strings), `\[\s*"?-?\d+(\.\d+)?"?\s*(,\s*"?-?\d+(\.\d+)?"?\s*){1,}\]`; a `{"` or `":` JSON fragment; and the values of the fields `anchor`, `bbox_sheet_mm`, `handle`, `trace` of any fixture (5.2) | `["412.0", "198.5", …]`, `[412.0, 198.5]`, a JSON object with an anchor in it |
| An empty fragment | `\(\s*\)`, `\(\s*(MPa\|psi\|mm\|kg\|cft\|sft\|rft\|m)\s*\)`, `\[\s*\]`, `f′c\s*[,)]` | "RCC 1:1.5:3 ( psi) in columns" |
| A Market name | the Market's names from its data and the whole phrase "the Market", with the page's own "Market Prices" exempt (it is a CONTEXT.md term, a tab and a heading) | "Rule Set: Bangladesh default" |
| A grouped metric length | `\d{1,3},\d{3} mm\b` | "4,420 mm" |
| An internal enum or schema identifier | Pascal-case identifiers beginning `Ifc`, and the generated enum values the catalogue maps (5.2) | "IfcColumn" |
| A raw number where a figure should be | a bare `NaN`, `undefined`, `null` (M0's list) | an unformatted missing value |
| A message key | the catalogue's ids | a missing message |

### 5.2 The known-values rule (what the API actually sent)
The shapes catch what a key looks like. The second half catches what the API sent: a screen test
passes its fixtures to `expectNamesOnScreen(container, fixtures)`, which walks the JSON and collects
every string at a field named `key`, `code`, `family`, `group`, `section`, `stage`, `item_code`,
`resource_code`, `fact`, `ifc_class`, `act`, `anchor`, `bbox_sheet_mm`, `handle`, any `*_key` or `*_code`, and every key of an `attrs` object,
keeping those that are not plain words (they hold `_`, `.`, `:`, `-` or a digit). The visible text
must contain none of them as a whole token. A plain-word enum value (`confirmed`, `held`, `allowance`)
is not in this list, because it is legitimately a word: those are judged by the state-words rule
(check 13, 7.1), which makes the screen map the generated union through the catalogue.

### 5.3 Where it runs, what it exempts, who writes it
- **Exempt** (they are the QS's or the drawing's own words): any element marked
  `data-notation="file-name"`; `DrawingText` (`data-drawing-text`); a value a person typed
  (`data-user-text`), so a typed storey name or an "other" reason may hold an underscore; the
  `<title>` of a QS's uploaded file as the label of that file.
- **Runs** in every M1 web screen test on the seed's fixtures at both widths, in the keyboard
  Takeoff test (M1-18a), in the 3D's inspector test (M1-25), in the grid test (M1-20), in the Prices,
  Settings and Material Schedule tests, and on the `/dev/specimen` route; and as the design gate's
  check 12 on the running seed.
- **The catalogue side:** `tools/lint/words.py` also fails a shipped message that contains a `vx.`
  name or a snake_case token outside a `{placeholder}`; the machine-words files (`web/src/messages/
  engine/**/en.po`) are held to it, so a code is never worded with a key in the sentence.
- **Written by** whichever of M1-25 (wave 3) and M1-18a (wave 4) merges first (M1-25 is first on the
  plan): `web/src/test/names-on-screen.ts` with its list of shapes, extending `never-shown.ts`
  without changing the M0 list, and `web/src/test/names-on-screen.node.test.ts`; the other imports
  it. M1-20, M1-21, M1-22 import it.
- **Its own tests** (the check is a trust boundary for words): each shape of 5.1 planted into a
  fixture fails; a fixture's `item_code` planted as a visible string fails; a typed value with an
  underscore under `data-user-text` passes; a file name under `data-notation="file-name"` passes;
  the seed passes untouched.
- **What it cannot see:** the 3D canvas and the sheet canvas (pixels). Their labels go through
  `canvasLabel()` (4.11.6), unit-tested over the seed with the same shapes; the rest is judged by
  eye at the design gate.

### 5.4 This page's own words
Every quoted string on this page is catalogue wording and must pass the words lint
(`tools/lint/words.py`: the never-shown list, and the engine terms process, stage, reader, candidate,
cache, token, timeout, viewport, paper space; `reinforcement` and `add it again`) and the DOM check. The
session's self-check over this file (`.private/work/M1-24/quoted-words.txt`) lists only these
descriptions of the lint. CONTEXT.md's own term Construction Stage, which the lint's list catches, is
let off by `tools/lint/words_allowlist.toml` entries the first ticket that words them adds
(M1-22, M1-25), each with its reason; no other word on this page needs one.

### 5.5 The description rule's test
`describe(code, params)` (1.7) has a table test in `web/src/boq/describe.test.ts`: every template
the API can send (M1-07's `description_template` list) × every optional param present and absent,
expecting the string with the fragment gone and no doubled space, comma or bracket: the Rebar and
concrete templates are the table's first rows (4.13.7).

---

## 6. The seed M1's walks need (KR-01 after M1)

Every UI PR is walked on the seed at 1440×900 and 1280×800 (m0-screens 7), and each M1 ticket extends
its own module's part of the seed (m0-screens 7's per-module rule: the `takeoff` part by M1-18a, M1-11b
and the family tickets as they land; the `boq` part by M1-15a; `rates` by M1-14; `projects` by M1-44). All of
it is invented.

**One table holds every quantity.** 6.1 is the only place a count, a per-element measure, a rate or
an amount of KR-01 is derived; every other section of this page that prints one names its row (for
example "(M12)") and a figure there that disagrees with the table is the page's defect. A seed ticket
or a test builds the table's rows and the page's figures are read from it; a reviewer checks the
table once, by hand, and the citations by grep. The seed ticket's test builds every row; until
it exists a reviewer checks the rows by hand.

### 6.1 KR-01's quantities (the one table)
| Id | What | Derivation | Value |
|---|---|---|---|
| **Given** | | | |
| G1 | Gross Floor Area | entered | 42,000 sft |
| G2 | Storeys | Ground, 1st … 9th, Roof; 10′-0″ floor to floor; 5″ slabs; datum Ground +0′-0″; existing ground −2′-0″ | the level table of 6.2 |
| G3 | Columns on the schedule | 11 per storey × 10 storeys (Ground to 9th); every column 10″ × 20″ (the held C5's plan size too) | 110 |
| G4 | Columns by state, Moment B | measured by storey Ground to 9th: 9, 11, 11, 11, 9, 8, 10, 10, 10, 11; awaiting answer 8 (Q4: 2 in 4th and 2 in 5th; Q7: 1 each in 5th to 8th); excluded 2 (Ground, duplicates) | 100 + 8 + 2 = 110 |
| G5 | Columns by state, Moment A | confirmed 14 (one group); excluded 2; agreeing 86 (6 groups); blocked by Q4 and Q7 8 | 14 + 2 + 86 + 8 = 110 |
| G6 | Piles | type P1, 20″ dia; cut-off −5′-0″, toe −70′-0″ from the datum; over-cast 2′-0″; head breaking per pile | 47 |
| G7 | Pile caps | given totals | 1,184.00 cft; sides 1,056.00 sft |
| G8 | Column stubs, cap top to plinth | one per column position, 10″ × 20″ × 4′-0″ | 11 |
| G9 | Allowance consumptions per sft of floor: **the one seed table**, `docs/research/tax-and-allowances.md` B.2 at G+9 (Library defaults, bd-defaults 116-118; an allowance's Rebar is **kg per sft only**, B.2's printed row, never a ratio: B.2's concretes are printed to two places, so no ratio times them reproduces it) | Beams (Step 7): concrete 0.22 cft, formwork 0.68 sft, Rebar 1.14 kg; Slabs (Step 8): concrete 0.465 + edge members 0.021 = 0.486 cft, formwork 0.88 sft, Rebar 1.22 kg, casting area 1.00 sft; Step 6 columns: 0.17 cft, formwork 0.47 sft, Rebar 1.19 kg; Step 6 shear walls and lift core: 0.041 cft, formwork 0.12 sft (0.041 × 2 faces ÷ 8″, B.2's "core both faces"), Rebar 0.21 kg (B.2's core ratio, 0.041 cft × 5.1, to two places); Step 6's B.2 totals 0.59 sft and 1.40 kg are the sums (columns formwork and Rebar are the totals less the core's); the rest of Step 5: Rebar 0.181 kg; stairs 0.05, tanks 0.10, lintels 0.03, roof stair and lift room 0.03 kg | as listed |
| **Per element** | | | |
| E1 | Column concrete | 10″ × 20″ = 1.3889 sft × 9′-7″ (10′-0″ less the 5″ slab, J1 until Step 8) | 13.31 cft |
| E2 | Column formwork | 2 × (10″ + 20″) = 5′-0″ × 9′-7″ | 47.92 sft |
| E3 | Column Rebar | net 8 × 3.048 m = 24.384 m × 2.466 = 60.13 kg; laps 8 × 0.800 m × 2.466 = 15.78 kg; ties 14 × 1.372 m × 0.395 = 7.59 kg | 83.50 kg |
| E4 | Pile cross-section | π ÷ 4 × (20 ÷ 12)² | 2.18166 sft |
| E5 | Cement, per cft of RCC 1:1.5:3 | 21.8 bags per 100 cft; wastage 2% | 0.218 bag net |
| **Rates** (৳) | | | |
| R1 | RCC per cft | the Rate Analysis of 4.14.2: 27,666.96 per 100 cft; outside the casting-area contract + 31.50 casting labour | 276.67; 308.17 |
| R2 | Formwork per sft | the Rate Analysis of 4.14.2: 9,650.00 per 100 sft; outside the contract + 18.00 shuttering labour | 96.50; 114.50 |
| R3 | Rebar per kg | the starter price | 88.50 |
| R4 | Piling | boring per rft; head breaking per head; casting area per sft | 450.00; 345.00; 170.00 |
| **Measured** (Steps 2 to 6) | | | |
| M1 | Boring | G6 47 × 68′-0″ (existing ground to toe) = 3,196 rft × R4 450.00 | 14,38,200.00 |
| M2 | Pile-head breaking | G6 47 × R4 345.00 | 16,215.00 |
| M3 | RCC in piles, cut-off to toe | 47 × 65′-0″ × E4 = 6,664.98 cft × R1 276.67 | 18,44,000.02 |
| M4 | RCC in piles, over-cast | 47 × 2′-0″ × E4 = 205.08 cft × R1 276.67 | 56,739.48 |
| M5 | Rebar in piles, by ratio | M3 6,664.98 × 1.7 = 11,330 kg × R3 88.50 | 10,02,705.00 |
| M6 | RCC in pile caps | G7 1,184.00 cft × R1 outside 308.17 | 3,64,873.28 |
| M7 | Formwork to pile-cap sides | G7 1,056.00 sft × R2 outside 114.50 | 1,20,912.00 |
| M8 | Rebar in pile caps, by ratio | M6 1,184 × 2.5 = 2,960 kg × R3 88.50 | 2,61,960.00 |
| M9 | RCC in column stubs | G8 11 × 1.3889 sft × 4′-0″ = 61.11 cft × 308.17 | 18,832.27 |
| M10 | Formwork to column stubs | G8 11 × 5′-0″ × 4′-0″ = 220.00 sft × 114.50 | 25,190.00 |
| M11 | Rebar in column stubs, from the drawing + rules | 416 kg × R3 88.50 | 36,816.00 |
| M12 | RCC in columns | G4 100 × E1 13.31 = 1,331.00 cft × R1 276.67 | 3,68,247.77 |
| M13 | Formwork to columns | G4 100 × E2 47.92 = 4,792.00 sft × R2 96.50 | 4,62,428.00 |
| M14 | Rebar in columns, from the drawing + rules | G4 100 × E3 83.50 = 8,350 kg × R3 88.50 | 7,38,975.00 |
| **T1** | **Measured** | M1 to M14 | **67,56,093.82** |
| **Awaiting answer** (8 columns, Q4 and Q7) | | | |
| W1 | RCC | G4 8 × E1 = 106.48 cft × R1 | 29,459.82 |
| W2 | Formwork | G4 8 × E2 = 383.36 sft × R2 | 36,994.24 |
| W3 | Rebar | G4 8 × E3 = 668 kg × R3 | 59,118.00 |
| **T2** | **Awaiting answer** | W1 to W3 | **1,25,572.06** |
| **Allowance** (parts not yet measured) | | | |
| A1 | Beams | G9 × G1: 9,240 cft × 276.67 = 25,56,430.80; 28,560 sft × 96.50 = 27,56,040.00; 47,880 kg × 88.50 = 42,37,380.00 | 95,49,850.80 |
| A2 | Slabs | 20,412 cft = 56,47,388.04; 36,960 sft = 35,66,640.00; 51,240 kg = 45,34,740.00; casting area 42,000 sft × 170.00 = 71,40,000.00 | 2,08,88,768.04 |
| A3 | Step 6, shear walls and lift core | 1,722 cft = 4,76,425.74; 5,040 sft = 4,86,360.00; 8,820 kg = 7,80,570.00 | 17,43,355.74 |
| A4 | The remaining allowance lines (Steps 9 to 14, the rest of Step 5, the MEP template) | **an invented remainder, not B.2 priced:** T3 is held at a round 9,12,40,000.00 and A4 is what is left of it after A1 + A2 + A3, so a seed writes A4's rows to sum to it; raising A1 to A3 to B.2 took ৳22,35,705.78 from Steps 9 to 14, and B.4's priced Steps 9 to 14 would move T3, T4 to T7 (the owner's call, not this page's). Its Rebar rows (G9): the rest of Step 5 0.181 × G1 = 7,602 kg; stairs, tanks, lintels, roof room (0.05 + 0.10 + 0.03 + 0.03) × G1 = 8,820 kg; 16,422 kg in all | 5,90,58,025.42 |
| **T3** | **Allowance** | A1 to A4 | **9,12,40,000.00** |
| A5 | Step 6, columns part (Moment A only) | 7,140 cft = 19,75,423.80; 19,740 sft = 19,04,910.00; 49,980 kg = 44,23,230.00 | 83,03,563.80 |
| A6 | Step 6 as a whole at Moment A | A5 + A3 | 1,00,46,919.54 |
| **Totals** | | | |
| T4 | Total | T1 + T2 + T3 = 67,56,093.82 + 1,25,572.06 + 9,12,40,000.00 | 9,81,21,665.88 |
| T5 | Per sft | T4 ÷ G1 | 2,336.23 |
| T6 | Measured share | T1 ÷ T4 | 6.89% |
| T7 | The strip, whole taka | 67,56,094 + 1,25,572 + 9,12,40,000 (adds as displayed) | 9,81,21,666 |
| T8 | Rebar so far, per sft (the whole-building check, bd-defaults 59-60: 4.5 to 6) | measured: read M11 + M14 = 8,766 kg; by ratio M5 + M8 = 14,290 kg (23,056 kg); awaiting answer W3 668 kg; allowance Rebar, every row: A1 47,880 + A2 51,240 + A3 8,820 + A4 16,422 = 124,362 kg; whole Building 23,056 + 668 + 124,362 = 148,086 kg ÷ G1. Day one on G9 alone: 0.94 + 1.40 + 1.14 + 1.22 + 0.05 + 0.10 + 0.03 + 0.03 = 4.91 kg per sft (B.3 prints 4.90). What is measured (piles, caps, stubs, 100 columns, with the 8 awaiting: 23,724 kg, 0.56 kg per sft) stands where their allowances (0.759 + 1.19 = 1.95 kg per sft, 81,858 kg) would have been, so a light measured frame pulls the figure below the range; the screen says which steps are measured | 38% of the measured read, 62% ratio; 3.53 kg per sft, amber |
| **Moment A** | | | |
| X1 | Step 6, measured so far | G5 14 × E1 = 186.34 cft × R1 = 51,554.69; 14 × E2 = 670.88 sft × R2 = 64,739.92; 14 × E3 = 1,169 kg × R3 = 1,03,456.50 | 2,19,751.11 |
| **Cement** (C14: net × 1.02, rounded up per cell; E5) | | | |
| C1 | Piling | M3 + M4 = 6,870.06 cft × 0.218 = 1,497.67 net | 1,528 bags |
| C2 | Substructure | M6 + M9 = 1,245.11 cft × 0.218 = 271.43 net | 277 bags |
| C3 | 1st floor slab casting (columns of Ground) | 9 × 13.31 = 119.79 cft → 26.11 net | 27 bags |
| C4 | 2nd, 3rd, 4th floor slab casting (columns of 1st, 2nd, 3rd) | 11 × 13.31 = 146.41 cft → 31.92 net each | 33 bags each |
| C5 | 5th floor slab casting (columns of 4th) | 9 × 13.31 = 119.79 cft → 26.11 net | 27 bags |
| C6 | 6th floor slab casting (columns of 5th) | 8 × 13.31 = 106.48 cft → 23.21 net | 24 bags |
| C7 | 7th, 8th, 9th floor slab casting (columns of 6th, 7th, 8th) | 10 × 13.31 = 133.10 cft → 29.02 net each | 30 bags each |
| C8 | Roof slab casting (columns of 9th) | 11 × 13.31 = 146.41 cft → 31.92 net | 33 bags |
| C9 | Columns, all pours | the sum of the rounded cells (C3 to C8) | 300 bags |

### 6.2 Moments, levels and roles
**The storeys every example draws from** (the Dhaka way: Ground, then 1st above it; G2):
| Storey | Slab level | | Storey | Slab level |
|---|---|---|---|---|
| Ground | +0′-0″ | | 5th | +50′-0″ |
| 1st | +10′-0″ | | 6th | +60′-0″ |
| 2nd | +20′-0″ | | 7th | +70′-0″ |
| 3rd | +30′-0″ | | 8th | +80′-0″ |
| 4th | +40′-0″ | | 9th | +90′-0″ |
| | | | Roof | +100′-0″ |

**Moment A, the frame step in review** (the Takeoff screens, 4.1–4.9, the 3D):
| What | State |
|---|---|
| Steps 1 to 4 | Closed; Step 5 closed with one Question open (the ground level) |
| Step 6, columns | N = 110 on S-09's schedule (G3); 14 confirmed, 2 excluded, 86 agree in 6 groups (the bulk act "Confirm 86"), 8 held by two Questions (G5: Q4's size, plan against schedule, 4 columns = 63.89 cft; Q7: a blank schedule cell, 4 columns); one rebar-only Question (Q9, bars of C4); one grouped Question that shear walls are not read yet (Q6); measured so far X1, allowance A6 |
| Steps 7, 8 | Locked ("Opens after Step 6" / "Opens after Step 7") |
| A held file or Question in Step 2 | the strength Question open once with the Developer's table pre-picking it |
| The Profile | Structural of "Arch-Struct Consultants": Sheet confirmed; Notes confirmed; Levels, Grid confirmed; Columns 3 to confirm |
| The Live Model | the confirmed Elements of Steps 3 to 5 and 14 columns, 86 column Proposals, 8 held (amber), piles shown, 11 storeys |

**Moment B, the money** (4.13–4.16):
| What | State |
|---|---|
| Steps | 2 to 5 closed, 6 closed with Q4 and Q7 open (8 columns awaiting answer), 7 and 8 on allowance |
| Strip (whole taka, 1.3) | Measured T1 ৳67,56,094 (67.56 lakh) · Awaiting answer T2 ৳1,25,572 (1.26 lakh) · Allowance T3 ৳9,12,40,000 (9.12 crore) · Total T7 ৳9,81,21,666 (9.81 crore) · T5 ৳2,336 per sft · Measured T6 7% of the total · 14 BOQ Items have no rate yet, from 9 prices not entered |
| Items | M1 to M14, W1 to W3 and A1 to A4 as 6.1; also an "Unclassified" item, an unpriced item, the casting-area line carried by A2 and the shutter-hire line "rate not entered" |
| Prices | starter prices with their citation; one entered by Nusrat Jahan; one labour rate "low confidence"; one not entered (9 in all) |
| The piling choice | Labour only (the starter), switchable to Material and labour (rate not entered) |
| The Material Schedule | cement C1 to C9: 1,528 bags in Piling, 277 in Substructure, 300 across the 1st to Roof slab castings (the columns of the storey below each); no slab concrete while Slabs is on allowance; Rebar T8 8.766 ton from the drawing and 14.290 ton assumed, by diameter; one allowance row; a Material-and-Labour note |
| Roles | Nusrat Jahan (QS), Kamal Uddin (MD), Arif Rahman (Vextrus Engineer), Farhana Kabir (Guest) as M0's |

The seed's M1 totals are asserted by M1-49's whole-chain test in miniature where the chain runs, and
by the per-module seed tests otherwise (a total on the page equals its parts: T4 = T1 + T2 + T3).

---

## 7. The design gate for M1

`ux-critic` reads `docs/design/system.md`, `docs/design/screens.md`, `docs/design/m0-screens.md` and
this file before every M1 UI PR, runs it on the seed, and walks it at 1440×900 and 1280×800 with
screenshots kept private; in a cloud session the browser walk is not done and the report says so
under "Not verified". The `design-gate` status is posted as M0's (m0-screens 8).

### 7.1 The checks
m0-screens 8's eleven checks hold on every M1 UI PR. M1 adds (numbering continues):

| # | Check | How |
|---|---|---|
| 12 | **Names on screen** (1.2, 5): no storey or band key, Attribute key, item or Resource code, raw anchor, Question code or empty fragment in the DOM | *Automated* (5's check, on the seed, both widths, including the DOM grep for the Market's names and for a grouped metric length); *by eye* on the 3D canvas and the sheet |
| 13 | **State words** (1.1): each state word comes from the generated union through one exhaustive map, for both `ProposalState` and `StepStatus`; a step is "Closed" and a Proposal "Confirmed" everywhere (rail, bar, toasts, inspector, the Priced BOQ); the web compares no state string | *Automated* (M1-00's contract test; each screen's test that every value of both unions has its catalogue word and that no screen text says "confirmed" of a step) |
| 14 | **The Questions tab's count equals the step's `open_questions`** on the seed; a held row is held only by its own Questions | *Automated* (M1-11b's contract test; M1-18a's screen test) |
| 15 | **Every figure opens its Trace** and the sheet opens highlighted (1.6, 4.10) | *Automated* for the popover's content kinds and the highlight's address; *by eye* for the flight and the box |
| 16 | **A read shows its end** on the page that started it (1.4) | *Automated* (M1-18a) |
| 17 | **Money and quantities** by 1.3: no ৳0 for a price not entered; the unit beside every quantity; lakh-and-crore grouping; the Gross Floor Area in the unit it was typed in; the strip's figures add up (Total = Measured + Awaiting answer + Allowance as the API sends them) | *Automated* (the formatters' table, M1-46; the strip test); *by eye* for the strip at 1280 |
| 18 | **The 3D is reached from the top bar** for every role, and its keys are in the `?` overlay under "On the Live Model" | *Automated* (M1-25) |
| 19 | **Keys as 2 says:** the overlay lists exactly the keys active on the screen; no binding without a label; nothing binds `D` or `P` in the 3D; `Shift` + an arrow pans on the sheet and in the 3D; every action on the screen is reachable without a pointer | *Automated* (the registry's test and each screen's key test); *by eye* (the keyboard walk, 7.2) |
| 20 | **A description never has an empty fragment** (1.7) | *Automated* (`describe`'s table) |
| 21 | **Awaiting answer is apart:** an awaiting-answer quantity or amount is never inside the measured figure, in the grid, the strip, the Material Schedule or the 3D's legend | *Automated* (M1-20's grid test and M1-22's) |
| 22 | **Read-only roles** (1.5): the MD and a Guest are offered no act on any M1 screen (a field they cannot use is absent, not disabled), may use the viewer's tools, and see the Display Units as words; a Guest is money-blind until the owner rules (9.5); each page shows the ReadOnlyChip | *Automated* (the API refuses; each screen's role test); *by eye* (chips, toasts) |
| 23 | **The 3D draws Proposals, held and confirmed as 4.11.2 says** and the browser's volumes equal the server's per Element | *Automated* (M1-25's geometry test); *by eye* (cyan dashed, amber, concrete grey) |
| 24 | **Words:** every new message under `web/src/messages/**` is read by `ux-critic` (words-only gate) and each Question's card has what-answering-does first | *By eye* |
| 25 | **Budgets** (ADR 0022) on the reference setup | *Owner's run* (M1-43), `?bench`; the `design-gate` status posts this check as not applicable on every PR until M1-43 |
| 26 | **States complete:** every screen has its empty, loading, error and read-only form (1.4; each screen's States) | *By eye*, with each screen test asserting the four |

### 7.2 The keyboard walk
Each M1 web ticket walks the part that is its own on the seed **by keyboard only, before its PR**,
ticks the lines in its PR body, and `ux-critic` walks them again on the PR's head. A line is "do →
expect"; a screen the ticket does not touch is not walked. Walk at 1280×800 first. The ids carry the
prefix KW- so that a failed line named in a PR (`KW-F6`) is never taken for the key `F6` or a ticket.

**Everywhere (every M1 screen)**
- [ ] KW-K1 `?` → the overlay lists the screen's keys under its headings; every key listed works; `Esc`
  closes it and focus returns.
- [ ] KW-K2 `F6` → focus moves region to region (top bar, rail, list or grid, canvas, inspector, status
  bar) and
  every region shows its focus ring; `Shift F6` the reverse.
- [ ] KW-K3 `Tab` is never a trap that is not documented: it stays inside the grid and the grid's foot
  says "Tab moves between figures. F6 leaves the grid."; `F6` leaves it, `Esc` leaves a dialog.
- [ ] KW-K4 Type a letter that is a key while a field has focus → the field takes it; no tool changes.
- [ ] KW-K5 `Ctrl K` → "Step 2, Notes" to "Step 8, Slabs", "Priced BOQ", "Live Model", "Material
  Schedule", "Prices", "Project settings" and "Drafting Profile" are in the jump list.
- [ ] KW-K2b From the list, `Shift F6` goes back to the rail (the F6 order is top bar, rail, list, canvas,
  inspector, status bar, so `F6` from the list goes on to the canvas); the rail opens to its words;
  `↓` `Enter` opens Step 7 without a pointer.
- [ ] KW-K6 Reduced motion on → no shimmer, no pulse, no flight animation beyond a jump.
- [ ] KW-K8 Sign in as a Guest → the money screens say "Ask the Developer for access to costs" and no
  amount shows; the Takeoff and the Live Model read.
- [ ] KW-K7 Sign in as the MD → no act is offered on any screen walked; `Enter`, `X`, `E`, `Ctrl Z` show the
  toast of 1.5; the viewer's tools work.

**A frame step (4.1–4.7), on Step 6**
- [ ] KW-F1 Open Step 6 (`Ctrl K`, or from the top bar `F6` to the rail, `↓` to Step 6, `Enter`) → the list shows "Needs you" first, then the bands; the Count reads n / N with
  excluded; the Questions tab count equals the step's.
- [ ] KW-F2 `↓` to a group that agrees, `Enter` → "Confirmed 14 C2 columns…" toast with Undo; focus moves to
  the next row.
- [ ] KW-F3 `Ctrl Z` → the group is a Proposal again and the toast names what it undid.
- [ ] KW-F3a `Shift A`, pick an entity on the sheet, choose a Family, `Enter` → the Element joins the list marked "Added by" and n / N counts it; `Ctrl Z` → it is gone and n / N is as before.
- [ ] KW-F4 `→` on a group, `→` `→`, `Esc` → Elements step in order, the counter reads "Column 3 of 14",
  `Esc` leaves the review.
- [ ] KW-F5b `Space` on a group, then `→` `→` in the canvas → the sheet flies to each Element in turn,
  the bar's counter follows, `Esc` leaves the review.
- [ ] KW-F5 `Space` on a group → the sheet opens fitted to the source, the source boxed; `Space` returns with
  the same row focused.
- [ ] KW-F6 `X`, `2`, → the exclusion picker claims every digit (`8` does nothing); the Element is "Excluded,
  duplicate" and stays in N.
- [ ] KW-F7 `E` on an Element → the field with its unit; type `10 in`, `Enter` → saved, "typed by", focus on
  the row; `Esc` in another edit restores.
- [ ] KW-F8 `Q` → the next Question in queue order (largest quantity first); `1`–`9` pick; `Enter` answers
  and the held group is confirmed; the toast says how many columns.
- [ ] KW-F9 A rebar-only Question → the group still confirms with `Enter`; the card is in the tab only.
- [ ] KW-F10 `Enter` with Questions open → goes to the next Question, never closes; `Shift Enter` closes
  with them open and the strip shows the awaiting-answer money.
- [ ] KW-F10b `Enter` after "Close Step 6" → "Go to Step 7", never "Reopen"; "Reopen Step 6" opens a
  dialog whose focus starts on "Cancel".
- [ ] KW-F15 A step with nothing to read (no piles) → "There are none ↵" closes it "Closed, none".
- [ ] KW-F11 `T` on a size → the popover; `←` `→` step the sources; `Enter` opens the sheet highlighted; `Esc`
  returns to the figure.
- [ ] KW-F12 `G` → the Live Model opens with the Element selected.
- [ ] KW-F12b `G` in the 3D → back to the Element's row in its step.
- [ ] KW-F13 Locked step → the ErrorBar with its action; no toast that vanishes.
- [ ] KW-F14 `Shift` + arrows on an open sheet → the view pans; bare arrows page and step.

**Steps 2, 3, 4, 5**
- [ ] KW-L1 Step 3: `E` on a storey → slab then finished level; the echo "Reads as +10′-0″" while typing; a metres
  value in an imperial project is accepted and echoed; `Enter` moves to the next storey.
- [ ] KW-L2 Step 3: the top-floor Question is pre-picked only when two sources agree; the plans list's `E` opens
  the storey picker (`Space` ticks, `Enter` saves).
- [ ] KW-L3 Step 4: `Space` shows the registered grid over the plan; `Shift O` toggles it.
- [ ] KW-L4 Step 2: `E` on a strength row reopens its BOQ Item choice; the Developer's table is named as the
  source of the pre-pick.
- [ ] KW-L5 Step 5: piles and caps in one list; the piling line in the overview opens the choice.

**Step 1's additions and the Profile panel (4.8, 4.9)**
- [ ] KW-H1 Sheet mode: `W` → crosshair, arrows move it, `Enter` `Enter` fix two corners, the form appears;
  `Esc` cancels at each stage.
- [ ] KW-H2 `A` → the Assign dialog; `Space` ticks, `Enter` saves; `Esc` cancels.
- [ ] KW-H3 `Shift P` → the panel replaces the inspector; `↑ ↓ → ←` move and open; `Enter` confirms a
  convention; `Esc` closes and returns focus.
- [ ] KW-H4 `Shift O` → what the step read is drawn over the sheet; `Tab` visits the shapes.

**The Live Model (4.11, 4.12)**
- [ ] KW-V1 From the top bar → the 3D opens orthographic (the MD: perspective); the building above ground is
  framed; the storey list's first row is "Foundations".
- [ ] KW-V2 Arrows orbit, `Shift` + arrows pan, `+` `−` zoom, `F` fits, `Shift F` returns, `O` toggles; the
  view cube is reachable by `F6`.
- [ ] KW-V3 `[` `]` step through Elements; the inspector follows; `Space` opens the sheet highlighted.
- [ ] KW-V4 `I` isolates, `Shift I` ghosts the rest, `Delete` hides ("3 hidden"), `R` shows all.
- [ ] KW-V5 `[` selects an Element, then `M` + `Tab` through its snap points + `Enter` twice → a distance "on the model"; `X` locks the axis;
  `Enter` ends a chain; `Esc` returns to Select.
- [ ] KW-V6 `A` area, `L` lengths (beam clear span), `S` plane (typed "C"), `B` box (a face moved by
  `↑ ↓`), `C` colour by strength with the legend and counts.
- [ ] KW-V7 A Proposal selected → `Enter` confirms, `X` excludes, `Ctrl Z` undoes: the same bar as the step.
- [ ] KW-V8 No drawing available (drawing disabled in the test) → the Elements list across the canvas and
  the bar's words.
- [ ] KW-V9 No key or `vx.` name anywhere in the inspector, the legend, the filter or the chips.

**The Priced BOQ (4.13)**
- [ ] KW-B1 Open from the top bar → the strip first; Total = Measured + Awaiting answer + Allowance; the unpriced
  count links to the unpriced items.
- [ ] KW-B2b In an open allowance field `Ctrl A` selects the field's text, `Ctrl Home` and `Ctrl End` move
  the caret, `Ctrl C` and `Ctrl V` copy and paste text; none of them reaches the grid.
- [ ] KW-B2 Arrows move cells; `Home` `End`, `Ctrl Home`; `PageDown`; `Tab` stays in the grid; `F6` leaves.
- [ ] KW-B3 `Enter` on an item → its Measurement Lines; `T` on a line → the popover, `Enter` → the sheet at the
  Element, `Esc` → the grid with the row focused.
- [ ] KW-B4 `F2` on a rate → the Rate Analysis inline, its sum equal to the rate; no field to type a rate;
  `Esc` closes.
- [ ] KW-B5 `S` → By floor: quantities only, "Amounts are at item level"; back.
- [ ] KW-B6 An item with an awaiting-answer line → the second line is apart from the measured figure; `Enter` on
  it opens its Question.
- [ ] KW-B7 `Shift` + arrows select a range, `Ctrl C` → plain numbers on the clipboard ("Copied 12
  values."); `Ctrl V` on an allowance figure → the grid says what it skipped (the Windows Excel
  paste is walked by the owner at the M1 walk, not in the cloud gate).
- [ ] KW-B8 Display Units: Imperial → Metric → back; the totals differ by the stated rounding only.
- [ ] KW-B9 Gross Floor Area empty → the field in the strip; entering it prices the allowances.
- [ ] KW-B10 A description with a missing strength reads without brackets.
- [ ] KW-B11 As the MD → everything readable; the Display Units shown as words; no editor, no field, no
  "Enter prices"; the unpriced line says the QS enters prices.
- [ ] KW-W1 (the owner's Windows walk) `F6` and `Shift F6` reach every region in Windows Chrome without
  the browser taking them; one `Ctrl V` of a column of figures from Excel lines up in an allowance
  column.
- [ ] KW-B12 Formwork, Rebar by ratio ("1.7 kg per cft") and the casting-area line are present; the
  inspector's "Rebar 3.53 kg per sft so far" is there, with the steps it was measured on.

**Prices, settings, Material Schedule (4.14–4.16)**
- [ ] KW-P1 `Enter` on a price → field; type; `Enter` saves and moves down; `Esc` restores; the toast names the
  Resource and "BOQ Items repriced"; `Ctrl Z` and `Ctrl V` inside the open field act on the typing, not on
  the last save or the grid.
- [ ] KW-P1b "Enter prices" on the Priced BOQ → Prices with "Not entered (9)" on and the first row
  focused.
- [ ] KW-P2 An edited price's source reads "Entered by …", never the starter's citation.
- [ ] KW-P3 Piling choice: change → the dialog states what is replaced; `Enter` confirms; the BOQ and the
  Material Schedule follow; change back restores.
- [ ] KW-P4 A price not entered reads "rate not entered" everywhere it is used, never ৳0.
- [ ] KW-S1 Gross Floor Area typed in m² in an imperial project → echoed in sft; the field keeps the unit
  typed.
- [ ] KW-M1 Material Schedule: arrows move cells under sticky columns; `Enter` on a cell lists its BOQ Items;
  `S` switches Quantity ⇄ Amount; a Material-and-Labour note is present.
- [ ] KW-M2 The Bar-bending schedule tab: read-only; totals per diameter; no edit affordance.

Each line that fails is a finding scored like any other (CLAUDE.md: a serious finding leaves a
committed check).

---

## 8. Where this page and the plan disagree or are silent
For the orchestrator. Each item says what the screen does until it is settled, the ticket that must
add or decide it, and a recommendation. None blocks a screen's other parts. Where this page and the
plan or the spec disagree, those win until the owner rules.

| # | The gap | Screen meanwhile | Ticket | Recommendation |
|---|---|---|---|---|
| 1 | **Editing a Rate Analysis's lines (story 93).** C12's HTTP has `GET rates/{item_code}` and `PUT prices/…` only | Lines read-only; no editing affordance (4.14.2) | M1-14 | Add `PUT rates/{item_code}/lines/{resource_code} {quantity, wastage_pct}` writing an event under the editor's name, or the owner defers story 93 (9.2) |
| 2 | **Listing Labour Contracts and a per-project override (story 94).** C12 has the tables, no route | The tab is specified, route open (4.14.3) | M1-14 | `GET contracts`; `PUT contracts/{id}/override {rate, scope, shutter}` |
| 3 | **The piling choice's route.** `ProjectContractChoice` exists; no HTTP | Specified, route open | M1-14 or M1-15b | `GET`/`PUT contract-choice/piling {contract}`, its answer carrying the BOQ Items replaced and the rows leaving the Material Schedule (the dialog's counts) |
| 4 | **Editing allowance consumptions (story 100)**; the allowance line in C13's `GET boq` carries `consumptions` but nothing writes them | Read-only allowances (4.15) | M1-15a | `PUT boq/allowances/{step}/{part} {consumptions}`, "typed" as its source, under the editor's name; or defer with 9.2 |
| 5 | **The Developer's strength-to-BOQ-Item table** (`StrengthItemChoice`) has no read or edit route | Settled: no editor in M1; written by answering a strength Question (4.2) | M1-07 | none needed; a QS corrects a remembered choice by answering again |
| 6 | **Reading the Rule Set (stories 3 and 4):** name, version and each Measurement Rule in words with its source | The project settings' "Rules" block and the BOQ's inspector link are absent until a route exists (4.15) | M1-07 / M1-45 | `GET rule-set {name, version, rules: [{code, words, cites}]}` (the data `print_rule_set` prints) |
| 7 | **The Material Schedule's routes, the bar-bending schedule's route, and the lead-time write (story 106).** C14 fixes a row, not a path | Specified, routes open (4.16) | M1-16 | `GET materials`, `GET rebar/bars?storey=&member=`, `PUT resources/{code}/lead-days`, under the base of C9 |
| 8 | **Three small fields:** (a) correcting the consultant office has no route (story 7); (b) `GET boq` has no `figures_hash` for the out-of-date bar (1.4); (c) `measured_share` is not defined | (a) office correction specified, route open (4.8); (b) the bar is off; (c) this page uses measured / total, "Measured 7% of the total" | M1-12 / M1-19; M1-15a | (a) `confirm_convention` with `part: "sheet"` carrying the office; (b) `figures_hash` on `GET boq` and `GET materials`; (c) define it as measured ÷ total |
| 9 | **What reopening a step, or undoing a Confirmation, does to steps that stand on it.** C9 is silent | The reopen dialog says later steps stay as they are and are measured again at the next close (4.1.2) | M1-11a | State it in C9: later steps keep their Confirmations; their figures are re-measured; undo of a group a later step stands on is refused with a code and words |
| 10 | **Element exclusion reasons.** C9's `reason?` is free text; this page offers five (4.1.3) | The picker's five, stored as the catalogue message's English text | M1-11b | A `reason: {key, text?}` of five keys, so nothing the machine stores is English prose (m0-screens 1.7) |
| 11 | **File ownership of edits the screens need:** the sheet's keyboard pan is in `web/src/sheet/`; the top bar's links (Priced BOQ, Material Schedule, Live Model) and the project navigation are in `web/src/app/`; M1-18a owns `web/src/takeoff/steps/` only | M1-18a does the pan edit; M1-20, M1-22, M1-25 add their own link | the plan | Add both to the owning tickets' "Owns" lines |
| 12 | **"Unclassified" (story 89):** nothing in C13 says an item has no Rate Analysis | The heading is drawn for items whose `rate` is null and whose analysis route says none | M1-15a | an `analysis: true | false` on a BOQ Item as billed |
| 13 | **Price writes:** `PUT prices/{code}` returns the row only; the toast "4 BOQ Items repriced", the "Used by" column, "Allowances follow" and clearing a price (`price: null`) need more | The toast says "Price of … saved." only; "Used by" absent | M1-14 | Return `repriced_items: n`, `allowance_changes: [{step, delta}]`; add `used_by` to `GET prices`; accept `price: null` |
| 14 | **Coverage's M1 meaning:** M0's "used" is 0; M1 needs per step "used by this step / assigned to later steps / excluded / unaccounted" (story 59) | The status bar words of 4.1.1 | M1-11b | extend the Coverage response by step, as M0's contract does |
| 15 | **Address forms:** `?highlight=` is C9's; the 3D's `?select=<element_id>` and every M1 route and page title of 3.1 are this page's | the routes of 3.1 are used | each owning ticket | C17, C13, C14 and C15 name their route and its title |
| 16 | **Step 1's words:** M0's "Step 1 is confirmed" and the rail's "Confirmed" for a step become "Closed" (1.1, one word per state) | the rail and bars say "Closed" from M1-18a | M1-18a | change M0's catalogue messages in the same PR, with their tests |
| 17 | **"There are none" (4.1.2):** closing a step that has nothing to read (no piles, no core) is an act the API must accept with zero Elements and a recorded name | the bar's action is drawn; until accepted the step cannot close | M1-11a | `close` accepted with `elements: 0` and `act: none_found`, shown "Closed, none" |
| 19 | **Adding an Element the drawing read missed (story 125; the owner's Q15).** C9's act list and `POST confirmations` carry no picked entity, family, mark or storeys, and M1.md names none of them | The act is not drawn until the route exists (never disabled) | M1-18a with the takeoff API's ticket | a Confirmation act `add` with the entity's anchor, `family`, `mark` and `storeys`: one Confirmation, one Element per storey, one Trace anchor; undone whole by `Ctrl Z`; the Count's N grows by it |
| 18 | **Rebar by ratio's Trace and the whole-building check** (QS 6): the Trace needs the ratio and the volume it multiplied; the check needs the Building's Rebar kg and Gross Floor Area | the Trace and the inspector line of 4.13 are drawn from the lines' own fields; the check is absent until sent | M1-15a | a derived Trace entry `{volume, ratio, kg}` and `rebar_kg_per_area` on `GET boq` |

---

## 9. Open questions for the owner (one at a time, recommendation first)

1. **Is the Developer's own strength table a pre-pick source?** (4.2) Recommendation: **yes, name it on
   the card ("Picked for you: your table, from KR-00")**, though screens.md's rule is "pre-pick only
   when two sources agree". Why: the table is the Developer's standing instruction, not the machine's
   guess; the plan and spec (story 12) already pre-pick from it; the card names the source so the
   QS can see why.
2. **Stories 93 and 100 (editing a Rate Analysis's lines; editing allowance consumptions): in M1 or
   M2?** Recommendation: **keep both in M1 by adding the two routes (8, items 1 and 4), each small**,
   because the starter coefficients and allowances are low confidence and a Developer's QS will want their own on
   the first project. Why: prices already change in one place (story 91); coefficients and consumptions
   are the other two things that move a figure, and without them the first Developer cannot make the
   BOQ theirs. If time forces a cut, defer allowances' editing first (the allowance is replaced as steps
   close).
3. **May the MD switch the Display Units?** (4.13) Recommendation: **no; QS and Vextrus Engineer only;
   the MD sees the unit system in words.** Why: the switch re-bills the project for everyone, so it is
   a setting, not a way of reading.
4. **Does the MD's 3D open in perspective?** (4.11) Recommendation: **yes, perspective for the MD
   role, orthographic for the QS, `O` toggles and is remembered.** Why: screens.md ruling 8 says the
   MD's link opens in perspective, and M1 has no share link, so the role stands in for it.

5. **May a Guest see money?** (1.5, 4.13 to 4.16) A Guest is "a consultant's engineer, a contractor's
   QS" (CONTEXT.md), and M1.md says nothing about a Guest and cost. Recommendation: **no: a Guest
   reads the Takeoff and the Live Model, and every screen with ৳ (the Priced BOQ, Prices, the Material
   Schedule's amounts, the project settings' allowances) says "Ask the Developer for access to
   costs"; the MD may later grant it per Project.** Why: a contractor's QS reading the Developer's
   prices, Labour Contract rates and allowances is the commercial exposure the Guest role exists to
   limit. Until the owner rules, builders build the Guest money-blind.

Everything else on this page is a design choice settled here and open to the owner's reversal at the
M1 walk; the keys of 2 are the likeliest to change after a QS uses them.
