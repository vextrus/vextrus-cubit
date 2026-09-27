# The key screens: rulings from the prototypes

Session 01 prototyped the key screens on the accepted design system (docs/design/system.md) and the
owner judged them in the browser. The prototypes are throwaway and private
(`.private/work/session-01/proto-*`); these are the rulings the product builds to.

## The Takeoff (prototype: 58 real columns on the Sample Project, 4 Questions)
Measured: a typical-floor band of 18 columns with one Question took 6 keystrokes; the whole Columns
step (58 columns, 4 Questions) took 25 keystrokes and no clicks; 51–69 ms from key to screen. A QS's
reading time was not measured. The owner's ruling on the six design choices, 26 Sep 2026: "agree
with the six Takeoff design choices".
1. **Answering a Question confirms the elements it held,** and the card says so first ("Answering
   confirms 4 columns = 300 cft").
2. **The likely answer is pre-picked only when two or more sources agree,** and the card names them;
   with no majority, nothing is pre-picked.
3. **Proposals group by mark within each Storey Band;** a "confirm all agreeing" shortcut covers the
   whole step.
4. **An excluded element stays in N,** so the count shows a gap with its reason.
5. **A rebar-only Question does not interrupt a Confirmation;** it waits in the Questions tab and the rebar
   figure stays "from the drawing + rules" until answered.
6. **A tall plan opens fitted to its busiest half** at 1280×800; F fits the whole sheet.

Keys: Enter confirms a group or one element; → / ← review one by one; X excludes with a reason; E edits
a size; a number key picks an answer; Ctrl Z undoes; Esc returns from a Trace.

## The Project Summary (prototype: variants A, B, C; invented figures, every total reconciled)
The owner's ruling on nine design choices, 26 Sep 2026: "Q49 Agree".
1. **Layout:** A's tiles on desktop; B's fixed brief as the phone's first screen; C's building section
   (floors with each slab casting's Construction Stage) as a panel.
2. **The Revision Comparison** has no "inside allowances" column: a change shows in the Estimate once
   its step is confirmed; unconfirmed steps are listed "still on allowance".
3. **"Likely over allowance"** is an amber flag when a step's measured-so-far, projected to its n / N,
   passes the step's allowance; it never changes the Estimate.
4. **Allowances follow Market Prices:** each Takeoff Step's allowance is held as consumption per sft of
   Gross Floor Area (cft of concrete, kg of rebar, bricks…) priced at current Market Prices; the same
   figures feed the consumption checks. (Refines ADR 0002's per-step allowances.)
5. **The Target Cost is tested on the full Estimate,** layers included.
6. **The Estimate's layers spread over the Construction Stages pro rata;** no buyers' instalment plan
   in the MVP.
7. An allowance sits in its step's BOQ Section and is never split.
8. **Exports default to the latest Issued Estimate;** a working export says "Working — not issued"; the
   MD may issue from the Summary.
9. **A floor's ৳/sft shows "—"** where its area is too small to mean anything, with a note.

## The Priced BOQ grid (prototype: TanStack Table v9 + Virtual; AG Grid not needed)
Measured (production build, headless Chrome): 804 items and 47,959 Measurement Lines (53,358 rows
open) scroll with no dropped frames at wheel speed; editing a rate recomputes in 6–22 ms; opening every
line costs about 20 ms. Not proven: the real Windows Excel clipboard, screen readers and IME, and a
4×-throttled fast fling (15–20 fps). The owner's rulings, 26 Sep 2026: "Agree with 1–6"; on 7, "Not
that much, we should offer a 'per floor' item layout as a view"; on 8, "Yeah you're correct, currently
most probably 10% which was 7.5% before".
1. **Paste lines up as Excel does;** headings count as cells, are skipped as read-only, and the grid
   says what it skipped.
2. **Floor rows show quantities only;** amounts at item level; the Summary's "by floor" is labelled as
   shares.
3. **No rate typed over its Rate Analysis:** F2 on a rate opens the item's Rate Analysis inline.
4. **A Lump Sum's changed amount is a price effect** unless the QS marks it a scope change.
5. **Tab stays in the grid;** F6 leaves it.
6. **Rebar Measurement Lines to 2 decimals of a kg; the item total in whole kg.**
7. **About 270 items per building is right;** a "per floor" item layout is offered as a view.
8. **The tax layer:** VAT and AIT deducted on Labour Contract bills. VAT at 10 % (7.5 % before);
   the AIT rate is to be confirmed from NBR and held as dated data.

## The sheet (prototype: 38 real structural sheets from engine buffers) and the 3D Building Model
## (prototype: 1,269 elements from the real read)
The owner judged both in the browser and ran them on the reference setup (integrated GPU, low
performance): "still it's managing to hold up and it'll do the work" (26 Sep 2026; the figures of that
run were not captured). The owner's ruling on eleven design choices: "Agree with all eleven: This two
prototypes' design choices is the biggest achievement I would say for this session and if we can
actually implement this in our actual product this will be phenomenon".

The sheet:
1. **A Trace flies tight to its source,** neighbours in view: the source's box padded to about 3×, never
   under 100 mm of paper.
2. **Fine lines at fit draw as plotted,** faint by lineweight.
3. **A Proposal's outline sits 2 px outside the element,** no white casing (a casing only in CAD-dark).
4. **The sheet opens on Engine;** Plot and Compare one key away (P).
5. **A sheet opens fitted to its working view** (the plan and its title).

The 3D Building Model:
6. **Proposals are opaque cyan with dashed edges,** never translucent.
7. **A column is one Element per Storey Band,** drawn and measured storey by storey, selected and
   confirmed as one.
8. **The QS's view opens orthographic;** the MD's share link opens in perspective.
9. **Piles are shown;** the opening fit frames the building above ground; a Foundations toggle.
10. **A Question tints every element it holds amber;** its origin carries the revision-cloud marker.
11. **Cut faces are coloured by material:** concrete grey, brick hatched terracotta.

## How M0's screens keep this quality (the owner's ruling on the M0 plan's UX review, 26 Sep 2026: "Agree")
1. A committed behaviour spec, `docs/design/m0-screens.md`, written from the prototypes with
   wireframes on invented data: every key (one key map owned by the app shell), state, empty and
   loading view, and piece of wording (reports in a QS's words).
2. A Step 1 prototype on invented sheets, judged by the owner before ticket 22 is cut.
3. A committed seed of an invented demo project for walking every UI PR.
4. `ux-critic` checks this file and the behaviour spec, not only the tokens.
5. A `local` walk on a real set before tickets 16 and 22 merge: no sheet opens looking empty.
6. Performance readouts only behind a `?perf` flag, never on by default.

## Takeoff Step 1, "Sheets" (prototype: invented G+9 set, layouts A, B, C)
The owner's ruling, 26 Sep 2026: "I was checking out the Step 1 prototype and really loved the 'A'".
**Layout A, "List ⇄ Sheet":** the sheet list and the sheet swap places; Space opens the focused sheet
across the whole canvas (912 px at 1280, 71 %; 1072 px at 1440, 74 %) with the inspector and rail
unchanged; Esc returns to the list. Measured: a clean set's sheet list confirmed in 2 keystrokes, a
messy one (8 Questions) in 14, no clicks; 8–35 ms key to frame (40–146 ms at 4× CPU slowdown).
The owner's ruling on five more choices, 26 Sep 2026: "Agree with all five".
1. **Proposed exclusions join the bulk Confirmation** (the bar names them; Undo reverses): a clean set
   confirms in one key.
2. **A missing storey is a Question only on plan views.**
3. **Step 1 may be confirmed while a file is held by the decoder check,** once its Question is answered
   ("read anyway" or "set this file aside"); the held file's sheets stay marked.
4. **The storey strip stays,** showing "floor to floor" and "at floor level" differently.
5. **In sheet view, Enter confirms the sheet and opens the next one needing the QS.**

## Session 02 prototypes (27 Sep 2026; private, `.private/work/session-02/`)

### The whole building, read and live (read-structural + read-architectural, port 5301)
The Sample Project read from its DWGs through all fourteen Takeoff Steps into one Live Model of 3,450
Elements with 45 Questions; the viewer is an inspector of the read, not the destination. The owner's
judgement: "yes it's good as the first prototype … liked most of it but the 3D functionality and
features are lacking here than the first session 3D prototype we created, hopefully this is not the
final prototype." Ruling taken: the product's 3D keeps every capability of session 01's (rulings 6–11
above) and adds the tools.

### The component store (port 5320)
A query bar that reads plain words into a structured query, a result grid, an inspector grouping an
Element's Attributes by cost, construction and O&M with each value's Life Phase and source, a History tab
showing one identity through As designed, As built and As maintained, "Record a floor cast", and "Add
attribute" (live at once in the grid, the inspector and "Colour the model by"). The owner's judgement:
"yes, the inspector, the query and the three-phase history read as I'd want, looks good."

### Global in miniature (port 5330)
One shell rendered for Bangladesh in English and in Bangla (Bengali or Latin digits), the Gulf in Arabic
(right to left) and English, and a 3-decimal-currency test market, switched by data alone; the chrome
mirrors, the drawing never does; switching units re-bills. The owner's judgement: "Both read well, global
and priced look right." Rulings follow ADR 0038; two wait until a Bangla screen ships (৳ before or after
the figure in Bangla; the Bangla word for Rebar).

### The whole Takeoff priced (port 5340)
The Priced BOQ (BOQ Sections, items, Measurement Lines naming their Element and rules, Cost Basis,
Benchmark), the Material Schedule by floor and Construction Stage, the Project Summary, the allowance
cross-check and an Element's working cost, from the real read with placeholder prices. The owner's
judgement: "Both read well, global and priced look right."
