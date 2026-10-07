# M1's screens: the behaviour spec (outline)

Outline of 7 Oct 2026 (session 17), for M1-24 to finish in wave 0 (`docs/plans/M1.md`, M1-24). It is
not final copy: every string below is a first wording for a QS to read, and every section ends with
the questions M1-24 settles. Terms are `CONTEXT.md`'s. Where this page and an ADR, `docs/specs/M1.md`,
`docs/plans/M1.md` or `docs/design/screens.md` disagree, those win until the owner rules; tell the
orchestrator. Everything M0's spec settled (`docs/design/m0-screens.md`: the rules of §1, the key
map's registry of §2, the shared pieces of §3, the design gate of §8) holds here unless a section
below says otherwise; this page adds M1's screens to it.

Inputs: `docs/specs/M1.md` (signed), `docs/plans/M1.md` as amended in session 17 (the contracts C9,
C12, C13, C15, C17 and C19 fix what each screen is sent), `docs/design/screens.md` (the owner's
rulings on the Takeoff, the Priced BOQ grid, the sheet and the 3D), `docs/design/system.md`, and the
three screens the session-16 slice shipped without a spec (Steps 3, 4 and 6; the 3D Live Model; the
Priced BOQ with Market Prices), walked nine times on a Development Set. Only the conventions of those
walks are carried here: what broke and what the QS could not do, never what the drawings say.

Every name, number, mark and figure on this page is invented. Nothing comes from a real Drawing Set.
The examples use M0's seed project, KR-01, a G+9 building of Ground, 1st to 9th and Roof.

## What is not settled or not proven (read first)

- **Nothing here is prototyped as written.** The Takeoff, the Priced BOQ and the 3D were prototyped in
  sessions 01 and 02 and judged by the owner (`screens.md`); the slice built three of them without a
  spec. This outline is the first spec; the design gate (5) is its first judge.
- **What the slice's walks showed** (each is a rule below, so the next build cannot repeat it):
  - Enter confirmed nothing, because the screen and the API used two words for a Proposal's state
    (1.1, 4.1);
  - the Questions tab said "No open Questions here" while the step counted many (4.1);
  - storey keys, band keys, Attribute keys and raw Trace tuples reached the screen (1.2);
  - a Trace or Space opened the sheet with nothing highlighted (4.10);
  - a read that ended was never shown as ended on the page that started it (1.4);
  - the Gross Floor Area showed square metres in the sft box (4.15);
  - a BOQ description printed an empty strength in brackets (4.13);
  - the 3D was reachable only by typing its address (4.11).
- **The 3D's keys are not settled.** `screens.md` lists the tools' keys from the session-02
  prototype (M, A, T, D, S, B, V, C, N, P); D, P and V collide with M0's map (2.2 of m0-screens). 2
  proposes; M1-24 settles them against `web/src/ui/keys/`, with keyboard pan (#120).
- **No QS has read any of this wording,** as in M0. The owner's M1 walk and the outside QS's timed
  Takeoff test it.
- **"Awaiting answer"** is CONTEXT.md's word for Elements a closed step holds at their best candidate;
  the slice wrote "Waiting on a Question". This outline uses "awaiting answer" everywhere.

## Contents
1. Rules for every M1 screen
2. The key map: M1's additions
3. Shared UI M1 adds
4. The screens: 4.1 a Takeoff Step (the frame-step screen) · 4.2 Step 2, general notes and
   specification · 4.3 Step 3, storeys and levels · 4.4 Step 4, grid · 4.5 Step 5, piles and pile
   caps · 4.6 Step 6, columns, shear walls and core · 4.7 Steps 7 and 8, beams, slabs and slab-edge
   members · 4.8 Step 1's additions · 4.9 the Drafting Profile panel and sheet overlays · 4.10 the
   Trace, the highlight and the preview · 4.11 the 3D Live Model and the Element inspector · 4.12 the
   3D's tools · 4.13 the Priced BOQ · 4.14 Market Prices, Rate Analyses, Labour Contracts and the
   piling choice · 4.15 project settings · 4.16 the Material Schedule
5. The design gate for M1
6. Open questions for the owner

---

## 1. Rules for every M1 screen

### 1.1 Words
- **CONTEXT.md's terms, exactly,** adding to m0-screens 1.1: Takeoff Step, Element, Element Family,
  Storey Band, Live Model, Priced BOQ, BOQ Section, BOQ Item, Measurement Line, Measurement Rule,
  Rule Set, Rate Analysis, Market Price, Resource, Mix, Wastage, Labour Contract,
  Material-and-Labour Contract, Cost Basis (measured, allowance), Rebar, Rebar Ratio, Rebar Basis
  ("by ratio", "from the drawing", "from the drawing + rules"), Billing Unit, Display Units, Gross
  Floor Area, Material Schedule, Construction Stage, Drafting Profile, Attribute.
- **A Proposal's state has four words on screen,** one per state of the API's enum the QS can meet:
  "Proposal" (`open` or `blocked`), "Awaiting answer" (`held`), "Confirmed" (`confirmed`) and
  "Excluded" (`excluded`); `superseded` is never shown. The screen maps the generated enum, never a
  string it typed (M1.md C9, A12).
- **Never shown,** adding to m0-screens 1.1's list: a storey or band key (`floor_1`, `floor_1..top`),
  an Attribute key (`vx.column.section_b`, `x_m`), a Trace's raw anchor (a handle, a hash, a reader's
  name, a tuple), a grid reference as a list, a Rule Set file name or a section sign pointing into
  one, a Question code. The design gate's DOM check refuses any of them (5).
- **Messages say what happened, what it means and what to do,** in that order (m0-screens 1.1).

### 1.2 Names on screen (M1.md A17)
- A storey is named by its confirmed name from Step 3 ("Ground", "1st", "Roof"); before Step 3 is
  confirmed, by its proposed name with the Proposal mark.
- A Storey Band reads "1st to 8th", always low to high; a band of one storey reads its name.
- An Attribute is named by its Attribute Definition's label ("Section b", "Concrete strength").
- A grid reference reads "3/C"; a position off grid reads "3/C, 150 mm east" in the Display Units.
- A BOQ Item's description is its template with its params; a param it does not have is left out,
  never shown as empty brackets.
- An Element is "Column C2 at 3/C, 4th".

### 1.3 Figures
As m0-screens 1.2, adding money and quantities, which M1 first shows:
- money in the Market's currency with its grouping (৳12,34,567.89), never ৳0 for a price not
  entered: "rate not entered";
- a quantity in its BOQ Item's Billing Unit, rounded as the Rule Set says, with the unit beside it
  (1,245.37 cft); a Rebar quantity in kg, its Measurement Lines to 2 decimals (screens.md, Priced BOQ
  ruling 6);
- a level in the Display Units (+10′-0″ or +3.048 m), always signed, isolated left to right;
- a share as a whole percent beside what it is a share of ("Measured 6 % of the total").

### 1.4 The four states every M1 screen has
Each screen in 4 fills these in; the words here are the pattern.
| State | What shows |
|---|---|
| **Empty** | m0-screens' Empty: a glyph, one sentence saying why, one action ("No columns yet. They are read from the plans confirmed in Step 1." · "Read the columns") |
| **Loading or reading** | m0-screens' Skeleton with one line of what is happening ("Reading the columns from 6 plans…"); a read shows its end on the page that started it and on any page opened during it ("Read: 42 Proposals, 2 Questions") |
| **Refused** | m0-screens' ErrorBar with the refusal's words from its code (`takeoff.steps.locked`: "Step 6 opens once Steps 3 and 4 are confirmed." with "Go to Step 3"). A refusal is never a toast that vanishes |
| **Held** | What waits on a Question, marked "Awaiting answer" with the Question's number, in its rows, its figures and its 3D tint; the action is always "Answer Q4" |

### 1.5 Roles
As m0-screens 1.4. The MD and a Guest see every M1 screen read-only: no Confirmation bar acts, no
price edit, no profile confirmation; a key that would change something shows the toast "As MD you can
look at the Takeoff but not change it." The MD sees the Priced BOQ, the Material Schedule and the 3D
first; the Takeoff is one link away.

### 1.6 Every figure opens its Trace
Every figure a QS reads (a quantity, an amount, a size, a level) opens its Trace by click or by `T`
with it focused (2): the Measurement Lines behind it, the Elements behind those, the sheet each was
read on with the source highlighted (4.10). A figure typed by the QS says "typed by Nusrat Jahan, 7
Oct 2026"; a derived figure names what it was derived from.

---

## 2. The key map: M1's additions (through `web/src/ui/keys/`)
Every key below registers through m0-screens 2.1's registry; no screen adds a `keydown` listener.
The Takeoff's keys follow `screens.md`'s Takeoff ruling ("Enter confirms a group or one element; → / ←
review one by one; X excludes with a reason; E edits a size; a number key picks an answer; Ctrl Z
undoes; Esc returns from a Trace").

| Key | Scope | What it does | Ticket |
|---|---|---|---|
| `Enter` | screen (a Takeoff Step) | What the Confirmation bar says: confirm the focused group, or answer the focused Question | M1-18a |
| `↑` `↓`, `Home` `End` | region: list | Previous / next group or row | M1-18a |
| `→` `←` | screen (a Takeoff Step, a group focused) | Enter the group and review its Elements one by one; leave it | M1-18a |
| `Space` | region: list (a Takeoff Step) | Open the focused row's source sheet with its source highlighted; Space again returns | M1-18a |
| `X` | screen (a Takeoff Step) | Exclude the focused group or Element, with a reason | M1-18a |
| `E` | screen (a Takeoff Step) | Edit the focused value (a size, a level, a storey's name) | M1-18a |
| `Q` | screen (a Takeoff Step) | The next open Question of this step | M1-18a |
| `1`–`9` | screen (a Takeoff Step) | Pick an answer on the focused Question card | M1-18a |
| `Ctrl Z` | screen | Undo the last act on this step | M1-18a |
| `T` | screen (any figure focused) | Open the figure's Trace | M1-23 |
| `←` `→` | dialog: a Trace | Step through a figure's sources (reserved in M0) | M1-23 |
| `A` | screen (Step 1, sheet mode, a view selected) | Assign the view to Takeoff Steps (reserved in M0) | M1-19 |
| `F2` | region: the Priced BOQ grid, a rate focused | Open the BOQ Item's Rate Analysis inline | M1-20 |
| `Enter` | region: the Priced BOQ grid | Open or close the focused BOQ Item's Measurement Lines | M1-20 |
| `Tab` / `F6` | region: a grid | Tab stays in the grid; F6 leaves it (screens.md, Priced BOQ ruling 5) | M1-20 |
| `←` `→` `↑` `↓` | region: the 3D canvas | Orbit and tilt (proposed; keyboard pan is Shift with the arrows, #120) | M1-25 |
| `+` `−` | region: the 3D canvas | Zoom | M1-25 |
| `F` | region: the 3D canvas | Fit the Live Model (as `F` fits the sheet) | M1-25 |
| `[` `]` | screen (the 3D) | Previous / next Element in the list's order | M1-25 |
| `M`, `A`, `T`, `S`, `B`, `C` | screen (the 3D) | Measure, area, an Element's dimensions, section plane, section box, colour by Attribute (proposed; `A` and `T` collide above) | M1-26, M1-27, M1-28 |

**Collisions M1-24 settles:** `A` (Assign in Step 1, area in the 3D: different screens, so allowed by
the registry, but one letter two meanings); `T` (Trace vs an Element's dimensions in the 3D); `D`
(CAD-dark on the sheet vs placed dimensions, which are M2's); `P` (Plot vs presentation, M2's); `V`
and `H` (M0 reserved them on the canvas for select and pan; the prototype used V for derived plans, M2's).
Recommendation for M1-24: the 3D's tools take their letters at screen scope on the 3D only, `T` there
is the Trace (as everywhere) and dimensions move to `I` ("inspect sizes"); M2's letters are not
reserved yet.

---

## 3. Shared UI M1 adds
Owned by the first ticket that needs each, in `web/src/ui/`; later tickets import them.
| Piece | What it is | Owner |
|---|---|---|
| **ProposalGroupRow** | One row of a step's list: the group's name (a mark within a Storey Band, a grid line, a storey), its count as n / N, its StatusMark, its first Question's number if any | M1-18a |
| **QuestionCard** | M0's card (m0-screens 6.7), unchanged: what answering does comes first; pre-pick only when two sources agree | M0's 22; M1-18a reuses |
| **StoreyBandLabel** | "1st to 8th", low to high, from confirmed names | M1-18a |
| **MoneyCell**, **QuantityCell** | Right-aligned figures by 1.3, with "rate not entered" and the Billing Unit | M1-20 |
| **Strip** | The money summary: measured, awaiting answer, allowance, total, per area, measured share, unpriced count (M1.md C13) | M1-20 |
| **TracePopover** | A figure's sources, stepped with ← →, each opening its sheet highlighted | M1-23 |
| **BasisMark** | Cost Basis (measured, allowance) and Rebar Basis glyphs with their words | M1-20 |

---

## 4. The screens
Each section gives: the purpose; the QS's job on it; the regions; the states (1.4's four, and the
screen's own); the words that must appear; the keys; and the open design questions M1-24 settles.

### 4.1 A Takeoff Step: the frame-step screen (M1-18a; data by M1-11b, M1-11c)
- **Purpose:** the one screen for Steps 2 to 8: what the machine read for this step, grouped so a QS
  confirms what agrees in one act and answers what does not.
- **The QS's job:** read the groups; confirm the agreeing ones in bulk; answer each Question once;
  exclude or edit the exceptions; close the step, with Questions open if need be.
- **Regions:** the step rail (m0-screens 4.7, with each step's state: "Confirmed", "3 to confirm",
  "Closed, 2 awaiting answer"); the list of Proposal groups (by Storey Band or storey; M1.md C9's
  `group=`); the canvas (the source sheet, opened by Space); the inspector (tabs "Selection" and
  "Questions" with the open count); the Confirmation bar; the status bar (n / N, Coverage, the
  step's Cost Basis).
- **States:**
  - empty: "No columns yet. They are read from the plans confirmed in Step 1." · "Read the columns";
  - locked (refused): "Step 6 opens once Steps 3 and 4 are confirmed." · "Go to Step 3";
  - reading: the Skeleton, "Reading the columns from 6 plans…", and the result on any page when it
    ends;
  - held: a group with a Question reads "Awaiting answer, Q4" and is never in the bulk act;
  - nothing left: "Every column is confirmed or excluded." · "Close Step 6" (or "Close with 2
    Questions open");
  - closed with Questions open: the rail and the list read "Closed, 2 awaiting answer".
- **The Questions tab** lists exactly the step's open Questions as the API sends them (M1.md C9, A10):
  its count is the step's count, always. A row is held only by its own Questions; a step-level
  Question holds only closing the step.
- **Words:** the bar's what and why ("Confirm 5 columns of 1st to 8th that agree" · "Each size agrees
  on the plan, the schedule and the label."); "Proposal", "Awaiting answer", "Confirmed", "Excluded";
  "Answering confirms 4 columns = 300 cft" first on a card (screens.md ruling 1).
- **Keys:** 2's Takeoff rows.
- **Open questions:** the preview of a group's Measurement Lines beside it (M1-23) or under it; how a
  group reviewed one by one (→) shows its Elements on the sheet; whether the canvas shows the 3D
  instead of the sheet for a confirmed group.

### 4.2 Step 2, general notes and specification (M1-31's family on M1-18a's screen)
- **Purpose:** the strengths, covers and laps the notes state, confirmed once for the Building.
- **The QS's job:** confirm each note's value; pick the BOQ Item for each concrete strength (the
  Developer's table pre-picks it).
- **Regions:** 4.1's; the groups are note sections ("Concrete", "Cover", "Laps").
- **States:** 4.1's; empty when no notes file is confirmed in Step 1: "No general notes were found in
  Step 1. Assign the notes sheet to Step 2, or type the values." · "Type the values".
- **Words:** "Concrete strength 25 MPa, as "3600 psi" on the notes" (the verbatim text beside the
  value); the strength Question "Which BOQ Item prices 25 MPa concrete in columns?".
- **Keys:** 4.1's.
- **Open questions:** where the Developer's strength table is edited (here, or in project settings,
  4.15).

### 4.3 Step 3, storeys and levels (M1-32a, M1-32b; M1.md C19)
- **Purpose:** the Building's storeys, their order and levels, and which storeys each plan shows;
  every later step's storeys and heights stand on it.
- **The QS's job:** check the storey list read from Step 1's plans; confirm the top floor the machine
  proposes (one Question per Building, O4); check each level, typing it only where none was read
  (O3); confirm which storeys each plan shows.
- **Regions:** the storey list, low to high, each row: name, slab level, finished level, height,
  basis ("read", "typed", "derived"); a second list, "Plans and their storeys", each plan with its
  meaning ("at floor level" or "floor to floor") and its storeys; the canvas (the section or the level
  mark a level was read from); the inspector.
- **States:** 4.1's; a level with none read: "No level read. Type it in feet and inches or metres." ·
  the field; the top-floor Question held until answered: "Which is the top floor? The plans name 9th as
  the highest." with 9th pre-picked only when two sources agree.
- **Words:** "typed" beside every typed level, and in its Trace "typed by Nusrat Jahan, 7 Oct 2026";
  "derived from the 2nd's slab level" for a height; "1st to top: 1st to 9th" once the top is bound.
- **Keys:** 4.1's; `E` types a level, `Enter` saves it and moves to the next storey, `Esc` cancels
  and keeps focus on the row (the slice dropped focus to the page).
- **Open questions:** levels typed in the Display Units with the other system accepted (the slice
  asked metres on an imperial project); how a plan's storeys are corrected (a storey picker in the
  inspector, M1.md C19's `PUT view-placements`).

### 4.4 Step 4, grid (M1-33)
- **Purpose:** the grid lines, registered into one frame for the Building, so every Element stands
  where the plans put it.
- **The QS's job:** confirm the grid lines; answer where two plans disagree on a spacing; confirm each
  view's scale where it was proposed from dimensions.
- **Regions:** 4.1's; the groups are grid lines ("A", "1"), each naming the plans it was read on and
  its offset from the origin line ("B: 15′-0″ from A, on 3 plans").
- **States:** 4.1's; a grid line read on one plan only: "Read on one plan only" in its row.
- **Words:** "Grid line B, 15′-0″ from A, read on 3 plans"; a conflict "Plans 2 and 3 disagree on the
  spacing of B to C: 15′-0″ and 15′-6″".
- **Keys:** 4.1's.
- **Open questions:** whether the canvas overlays the registered grid on each plan; how the origin
  line is shown and changed.

### 4.5 Step 5, piles and pile caps (M1-34, M1-35)
- **Purpose:** the piles by type and the pile caps by outline, with the levels boring and concrete
  are measured from.
- **The QS's job:** confirm piles by type mark; answer a missing length or platform level; confirm
  caps by mark.
- **Regions:** 4.1's; groups by pile type mark, then by cap mark.
- **States:** 4.1's; the ground-level Question ("No existing ground level is stated. Boring is
  measured from it.") held until answered.
- **Words:** "Pile type P1, 20″ dia, cut-off −5′-0″, toe −70′-0″, 47 piles"; "head breaking"; the step's
  "Cost Basis: allowance until confirmed".
- **Keys:** 4.1's.
- **Open questions:** whether piles and caps share one list or two tabs; how the piling contract
  choice (4.14) is shown here.

### 4.6 Step 6, columns, shear walls and core (M1-36, M1-37, M1-38)
- **Purpose:** each column, wall and core, one Element per storey, grouped by mark within its Storey
  Band, with its size and its Rebar.
- **The QS's job:** confirm the agreeing marks in each band; type a size the label did not give (`E`);
  answer schedule-against-plan conflicts; until walls are read (M1-37), answer the one grouped
  Question that says so (O5).
- **Regions:** 4.1's; groups: band, then mark ("1st to 8th · C2 · 8 columns"); the inspector shows
  the three sources of a size (plan, schedule, label) side by side.
- **States:** 4.1's; walls not read yet: one Question per Discipline, "Shear walls are not read yet:
  9 outlines on 2 plans look like walls. They stay on the allowance until they are read." (never a
  silent zero); a size not read: "The size of this column was not read from its label. Press E to
  type it."
- **Words:** "C2, 10″ × 20″, 1st to 8th"; Rebar "8 bars 20 mm, from the drawing + rules"; a column
  measured before its slab is confirmed: "height to the slab soffit, derived from the default slab
  thickness; measured again at Step 8" (O6).
- **Keys:** 4.1's.
- **Open questions:** whether walls get their own tab once M1-37 lands; how a column's Rebar
  (M1-38) shows beside its size without crowding the row.

### 4.7 Steps 7 and 8, beams, slabs and slab-edge members (M1-39, M1-40, M1-41)
- **Purpose:** beams span by span, slab panels and the slab-edge members, storey by storey.
- **The QS's job:** confirm typical layouts in bulk; answer a missing size or support; check a sunk
  panel and a cantilever; confirm slab edges.
- **Regions:** 4.1's; groups by storey, then by mark or panel type.
- **States:** 4.1's; a floor type not read in M1 (flat slab, drop panel): "This panel has no beams
  under it. Flat slabs are not read yet; its area stays on the allowance." When Step 8 confirms a
  slab, 4.6's columns below it are measured again, and the toast says so.
- **Words:** "B12, 10″ × 18″ overall, 2/B to 3/B"; "slab S3, 5″, 324 sft".
- **Keys:** 4.1's.
- **Open questions:** spans shown on the sheet as a list or as a line overlay; how many slab-edge kinds
  fit the row.

### 4.8 Step 1's additions (M1-19)
- **Purpose:** what M0's Step 1 lacked for M1: draw a missed sheet or view, split a wrong one, confirm
  the consultant office with the sheet list, the profile's sheet part, and Assign.
- **The QS's job:** fix what the machine split wrongly, by hand, and say which steps read a view.
- **Regions:** m0-screens 6's, with the draw and split tools in sheet mode and the office in the list's
  heading.
- **States:** m0-screens 6.13's; a hand-drawn sheet or view marked "drawn by hand".
- **Words:** "Drawn by hand by Nusrat Jahan"; "Office: Arch-Struct Consultants (from 54 title blocks)".
- **Keys:** `A` assigns (2); the drawing tools' keys are M1-24's to choose.
- **Open questions:** the draw tool's interaction (drag a box, or click two corners).

### 4.9 The Drafting Profile panel and sheet overlays (M1-18b)
- **Purpose:** what the machine learnt about this office's drawings (layers, label patterns, level
  marks, schedule forms), confirmed by the QS part by part so the next set from the office reads
  better.
- **The QS's job:** confirm or correct each convention, once, in the step that first needs it.
- **Regions:** a panel opened from the step's toolbar; each part with its proposed convention, its
  evidence (the sheets it was seen on) and "Confirm"; overlays on the sheet showing what each step read.
- **States:** none learnt yet ("Nothing is learnt about this office yet. Its conventions are proposed
  as each step reads."); a convention Question asked once, never per sheet.
- **Words:** "Columns are on layer COL-OUTLINE on 18 sheets"; a layer name is drawing text, shown as
  drawn.
- **Keys:** to settle.
- **Open questions:** whether the panel is a drawer or a step-level tab; how overlays are toggled.

### 4.10 The Trace, the highlight and the preview (M1-18a highlight; M1-23 popover, picking, preview)
- **Purpose:** every figure back to where it was read, in two keys.
- **The QS's job:** check a figure against its source.
- **Regions:** the TracePopover (3) beside the figure; the sheet viewer opened with `?highlight=`
  (M1.md C9, A19): the source boxed, flown to tight (screens.md sheet ruling 1), its neighbours in
  view; the preview of a Proposal group's Measurement Lines beside the group.
- **States:** a figure with no sheet source says why ("typed", "derived from", "a Rule Set
  default"); a source on a sheet no longer current says "on S-12 R0, superseded by R1".
- **Words:** "Size 10″ × 20″, read on S-07 Column layout plan, 2nd to 9th, from the label "C2
  (10×20)""; "Measured by F3 and J1".
- **Keys:** `T` opens; `←` `→` step through sources; `Esc` returns to the figure.
- **Open questions:** whether the popover or the sheet opens first from the Priced BOQ.

### 4.11 The 3D Live Model and the Element inspector (M1-25; M1.md C17)
- **Purpose:** the confirmed frame as one Building, storey by storey, with what is still a Proposal or
  awaiting answer shown as such (screens.md 3D rulings 6–11).
- **The QS's job:** see that the frame stands where the plans put it; find a missing or doubled
  Element; open any Element's facts and Trace.
- **Regions:** the top bar's "Live Model" link (never reached by address only); the canvas; the storey
  list (isolate, plan cut); the colour legend (status or family); the inspector: the Element's name
  (1.2), its storey, grid reference, Attributes by label in the Display Units, IFC class and
  classification, Trace lines naming sheet and view.
- **States:** empty ("The Live Model has no Elements yet. Confirm a Takeoff Step and its Elements
  appear here." · "Go to the Takeoff"); loading (Skeleton over the canvas, "Building the Live Model…");
  no WebGL ("This browser cannot draw the Live Model. Picking an Element and its inspector still
  work."); held (amber tint, the Question's number in the inspector).
- **Words:** "Column C2 at 3/C, 4th"; "Section b 10″"; "Read on S-07 Column layout plan"; Proposals
  "Proposal" in cyan with dashed edges (screens.md ruling 6).
- **Keys:** 2's 3D rows.
- **Open questions:** the orthographic opening view's angle; whether the storey list and the
  Foundations toggle share one control.

### 4.12 The 3D's tools: measure, sections, properties and filters (M1-26, M1-27, M1-28)
- **Purpose:** the QS's checking tools (session 02 Q25): measure and area, an Element's dimensions with
  clear spans, section plane and box with dimensions on the cut, properties and filters by Attribute.
- **The QS's job:** check a span, a level or a quantity against the drawing without leaving the 3D.
- **Regions:** a tool bar on the canvas; the readout beside the pointer; the filter panel.
- **States:** each tool's own empty ("Pick two points"); filters with no match ("No Element matches:
  concrete strength 30 MPa").
- **Words:** lengths in ft-in with mm in brackets where the Market's profile asks; "clear span 14′-6″".
- **Keys:** 2's tool letters, once settled.
- **Open questions:** the budgets on the reference setup decide how much a section draws (M1-43).

### 4.13 The Priced BOQ (M1-20; M1.md C13)
- **Purpose:** the Building's Priced BOQ, BOQ Section by BOQ Section, with the money strip on top; the
  MD's first screen.
- **The QS's job:** read where the money is; open any BOQ Item's Measurement Lines and their Trace;
  open its Rate Analysis (F2); enter the Gross Floor Area so allowances price.
- **Regions:** the strip (measured, awaiting answer, allowance, total, per sft, measured share,
  unpriced count); the grid (BOQ Sections, BOQ Items, allowance lines hatched in their step's BOQ
  Section, screens.md Summary ruling 7); the Measurement Lines panel (each line: Element, storey,
  Nos × L × B × H, quantity, rules, Trace); the per-floor view (screens.md Priced BOQ ruling 7).
- **States:** empty ("Nothing is measured yet. BOQ Items appear here as Takeoff Steps are confirmed.");
  no Gross Floor Area ("Enter the Gross Floor Area to price the allowances and the total per area." ·
  the field); unpriced ("14 BOQ Items have no rate yet; they add nothing to the totals until prices are
  entered under Market Prices."); held (an "awaiting answer" quantity beside the measured one, never
  inside it).
- **Words:** "RCC 1:1.5:3 (25 MPa) in columns" (a missing strength left out, never "( MPa)"); "Rebar,
  Grade 500W, in columns, by ratio"; "Vextrus default, Low" on an allowance; "৳ … measured so far".
- **Keys:** 2's grid rows; `T` on a quantity opens its Measurement Lines' Trace.
- **Open questions:** the metric switch's place (the strip or settings); how the strip reads at 1280
  with every figure.

### 4.14 Market Prices, Rate Analyses, Labour Contracts and the piling choice (M1-21; M1.md C12)
- **Purpose:** the Developer's prices, the one place a price changes so every rate and amount follows.
- **The QS's job:** check the starter prices; enter or change a price; see each BOQ Item's Rate
  Analysis; choose the piling contract for this project.
- **Regions:** the price list (Resource, unit, price, changed by and when, source); a Rate Analysis
  panel (Resources per unit, quantity, price, amount, rate); the Labour Contracts list; the piling
  choice ("Labour only" or "Material and labour").
- **States:** a price not entered ("rate not entered"); a starter price ("PWD SoR 2022, p. 10, Low");
  an entered price (its editor and date, never the starter's citation); the MD's read-only view.
- **Words:** "Price of Rebar, Grade 500 saved. 3 BOQ Items repriced."; "Material-and-Labour Contract:
  its materials leave the Material Schedule."
- **Keys:** `Enter` edits the focused price and saves; `Esc` cancels.
- **Open questions:** dated price sets on screen (M1 shows the current set only?).

### 4.15 Project settings: Gross Floor Area and Display Units (M1-21, M1-44; M1.md C15)
- **Purpose:** the two project facts the money needs.
- **The QS's job:** enter the Gross Floor Area; choose the Display Units the Market offers.
- **Regions:** two fields with their unit; the switch.
- **States:** a Gross Floor Area entered shows in the Display Units, in the unit typed (the slice
  showed square metres in the sft field); switching units re-bills ("Switching to metric re-bills the
  Priced BOQ; totals may differ by rounding only").
- **Words:** "Gross Floor Area 42,000 sft, entered by Nusrat Jahan"; "Display Units: Imperial (cft,
  sft, rft)".
- **Keys:** `Enter` saves.
- **Open questions:** whether these live on a settings page or in the strip.

### 4.16 The Material Schedule and the bar-bending schedule (M1-22; M1.md C14)
- **Purpose:** what to buy and when: basic materials by floor and Construction Stage, with the
  read-only bar-bending schedule (the owner's ruling 8).
- **The QS's job:** check quantities by stage; see lead times; read Rebar by grade and diameter.
- **Regions:** the grid by stage then floor; the Rebar table with ton totals; the bar-bending table
  (bar mark, diameter, count, cutting length, laps).
- **States:** allowance rows "not yet by floor"; Material-and-Labour materials absent with a note.
- **Words:** "Cement 411 bags (398.20 net + 3 % wastage)"; "assumed split" on Rebar by ratio.
- **Keys:** 2's grid rows.
- **Open questions:** whether the bar-bending table is a tab or a drawer.

---

## 5. The design gate for M1
m0-screens §8's eleven checks hold on every M1 UI PR. M1 adds:
12. **Names on screen** (1.2): no storey or band key, Attribute key, raw anchor or Question code in the
    DOM. *Automated* (the DOM check, folded into #531's banned-word check); *by eye* on the 3D canvas.
13. **State words** (1.1): the screen's state words come from the generated enum. *Automated* (M1-00's
    contract test).
14. **The Questions tab's count equals the step's count** on the seed. *Automated* (M1-11b's contract
    test, and M1-18a's screen test).
15. **Every figure opens its Trace** and the sheet opens highlighted (1.6, 4.10). *By eye*, with M1-18a's
    and M1-23's tests.
16. **A read shows its end** on the page that started it (1.4). *Automated* (M1-18a).
17. **Money and quantities** by 1.3: no ৳0 for a price not entered, units beside every quantity, the
    Gross Floor Area in the Display Units. *Automated* (the formatters' table, M1-46); *by eye* for the
    strip at 1280.
18. **The 3D reached from the top bar,** and its keys in the `?` overlay. *Automated* (M1-25).

Each web ticket walks these by keyboard itself before its PR (`docs/plans/M1.md`, the loop's step 3).

---

## 6. Open questions for the owner (one at a time, recommendation first)
None yet: every question above is a design question M1-24 settles with `ux-critic` and `qs-critic`.
M1-24 asks the owner only what research, the code and the rulings in `screens.md` cannot answer.
