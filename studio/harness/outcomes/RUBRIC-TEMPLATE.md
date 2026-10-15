# Outcome NN: <name>

**What done means, in one sentence:** <the owner-visible result>.
**Scope:** <Disciplines, storeys, screens, files>. **Out of scope:** <what this outcome leaves alone>.
**Rounds:** at most 3. **Budget:** <elapsed / budget, agents>.

Every criterion is judged on the live files by the grader. Keep each one checkable by a named check or
a named look; "looks good" is not a criterion. Delete the sections that don't apply.

## A. Geometry, judged by code (`checks/`)
- A1. `checks/<name>.py` exits 0: <invariant, with tolerance, e.g. every beam end bears on a column,
  wall or beam within 25 mm>.
- A2. ...

## B. Fidelity to the drawings, judged by looking
- B1. For storeys <list>, the <Discipline> plan view of the model matches the drawing's sheet: every
  <Element kind> present in the sheet is in the model within <tolerance>, none extra; checked by the
  grader on at least 20 Elements and by `checks/compare_plan.py` where it exists.
- B2. In 3D, from the two named views, no Element of <kinds> hangs in the air, pokes through another or
  stops short of what it should meet.

## C. Figures a QS would sign
- C1. <figure> equals the sum over its cited Elements (`checks/totals.py`), and the method follows
  <PWD / IS 1200 rule>.

## D. The screen
- D1. <screen>: <what the QS can do, in steps>, with no console error; screenshot at 1440×900 and 1280×800.

## E. Budgets
- E1. <budget from docs/research/viewer-3d-budgets.md>: measured <how>.

## F. Honesty
- F1. Every Element touched keeps its Trace; its state (`read`, `inferred` with rule, `placeholder`) is
  correct; counts per state are shown where the name "BIM Live Model" appears.

## G. Regression
- G1. Every check in `checks/` that passed before this outcome still passes.
- G2. Each defect fixed has a check that fails on the code before the fix (the builder showed it).
