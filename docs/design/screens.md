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
5. **A rod-only Question does not interrupt a Confirmation;** it waits in the Questions tab and the rod
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
   Gross Floor Area (cft of concrete, kg of rod, bricks…) priced at current Market Prices; the same
   figures feed the consumption checks. (Refines ADR 0002's per-step allowances.)
5. **The Target Cost is tested on the full Estimate,** layers included.
6. **The Estimate's layers spread over the Construction Stages pro rata;** no buyers' instalment plan
   in the MVP.
7. An allowance sits in its step's BOQ Section and is never split.
8. **Exports default to the latest Issued Estimate;** a working export says "Working — not issued"; the
   MD may issue from the Summary.
9. **A floor's ৳/sft shows "—"** where its area is too small to mean anything, with a note.
