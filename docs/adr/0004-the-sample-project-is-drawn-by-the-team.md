# The Vextrus team drafts its own Sample Project, the way a Dhaka consultant does

The owner's decision: the Vextrus team, who are practising civil engineers, drafts a typical Dhaka
RCC-framed Developer project as a complete Drawing Set in AutoCAD (DWG, with PDF prints). It is the
Sample Project. Vextrus owns it outright, so it is free of permission issues. It is a test set from
the first day, and it is the sample project clients see first in the MVP.

It is drafted the way a Dhaka consultant drafts, with the ordinary irregularities of real practice,
and **not exported from Revit**. A Revit export is unusually clean (consistent layers per category,
true geometry), and almost no consultant's set in our market looks like one. Our product exists
because Revit is rare in Bangladeshi practice.

The team may also model the project in Revit. That RVT/IFC is **kept out of development**: it is not
given to coding agents or placed where they can read it, because an agent that can see the answer
will fit its reader to the answer. Whether and how it later serves as an owner-held check is the
owner's call.

Considered and rejected: a polished Revit project with DWGs exported from it as the test set. It
would have repeated Vextrus Cubit's cause 1, "we proved the product against ourselves"
(docs/postmortem.md).

## Amended: what the Sample Project is (26 Sep 2026)
Its first read (docs/research/sample-project-first-read.md) found about 20 s of editing time per DWG
against months to years for the Edison set, a default creation date, files saved 24 s apart, geometry
exact to the inch and about 25 planted contradictions, with none of a consultant's real mess (layer
sprawl, dozens of fonts, nested blocks, broken outlines). The owner confirmed it was made with another
agent's help. So:
- It is a clean set with planted contradictions: a Development Set (ADR 0005) and the regression set
  for the Checks (ADR 0027).
- It is never evidence that Vextrus reads real drafting mess; Edison and the Held-out Sets are.
- It stays the sample clients see first, where clean is an advantage.
- The generating agent's inputs (script, data or model) are its Answer Key and are kept with the
  other keys (ADR 0026).
- The team does not redraft it; engineers' hours go to Hand Takeoffs and to obtaining Held-out Sets.

The owner's answer: "Tbh I took help from another agent". The relabelling follows the Q1 ruling
(ADR 0005) and stands unless the owner rules otherwise.
