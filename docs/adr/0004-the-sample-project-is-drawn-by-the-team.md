# The Sample Project is Vextrus's own clean set: a Development Set, never proof of reading

The Sample Project is a typical Dhaka RCC-framed Developer project as a complete Drawing Set (DWG,
with PDF prints). Vextrus owns it outright, so it is free of permission issues. It was made with
another agent's help: a clean set with about 25 planted contradictions, and none of a consultant's
real mess (layer sprawl, dozens of fonts, nested blocks, broken outlines).
- It is a Development Set (ADR 0005) and the regression set for the Checks (ADR 0027).
- It is never evidence that Vextrus reads real drafting mess; the Edison set and the Held-out Sets
  are.
- It is the sample clients see first, where clean is an advantage.
- Its generating agent's inputs (script, data or model), and any Revit model the team makes of it,
  are its Answer Key, kept out of every build session's reach (ADR 0026): an agent that sees the
  answer fits its reader to the answer.
- The team does not redraft it; engineers' hours go to Hand Takeoffs and to obtaining Held-out Sets.

Rejected: a polished Revit project with DWGs exported from it as the proof set. It would have repeated
Vextrus Cubit's cause 1, "we proved the product against ourselves" (docs/postmortem.md); a Revit
export is unusually clean, and our product exists because Revit is rare in Bangladeshi practice.

## History
- 25 Sep 2026 (the owner's decision): the team drafts its own Sample Project the way a Dhaka
  consultant does, not exported from Revit; any Revit model of it is kept out of development.
- 26 Sep 2026: relabelled a clean Development Set. Evidence: docs/research/sample-project-first-read.md
  (about 20 s of editing per DWG, a default creation date, files saved 24 s apart, geometry exact to
  the inch). The owner's answer: "Tbh I took help from another agent". The relabelling follows the Q1
  ruling (ADR 0005) and stands unless the owner rules otherwise.
