From the owner, for outcome 2.

Budget: outcome 1 closed at $105. Outcome 2 has the rest of the session, a cap of $195 in total, and no
raise after that. Spend it on the prototype itself: no more environment work, reuse outcome 1's inventory,
relations, storeys, grid, quantities v2 and renders as they are, and plan for at most two grading rounds.
If you must cut, cut in this order, and record each cut in CHECKPOINT.md: the 4D/5D and Life Phase
previews' polish first, then extra screens' polish, never the Live Model's Traces and states, the model
tree and its tools, or the Priced BOQ computed from geometry.

My rulings on outcome 1's questions, for the prototype (they are not yet ADRs):
1. The name: yes, "BIM Live Model", with your conditions: the read / inferred / placeholder counts and a
   per-element LOD shown wherever the name appears.
2. The browser files by Discipline Parts as CONTEXT.md has them, with MEP as a filter group and the Site
   under the Project, not the design model's Interiors / MEP / Site.
3. Use Category, Element Type, Type Mark, Tag and Model Basis as your glossary delta proposes.
4. Placeholders are shown, visibly different, and kept out of the confirmed totals (they sit in
   allowances).
5. No furniture, cars or trees as Elements; leave presentation items out of this prototype.
6. Fire shows as an empty Part with its Question and the storey-count allowance.
8. Spun piles are billed per metre, supplied and driven.
(7, the render check, is an engine ticket for later; ignore it here.)

Carry outcome 1's deferred QS items as visible open Questions in the Takeoff flow, not as silent gaps.
Keep draw calls inside ADR 0022's budget by merging per storey; the design model's 6,943 per frame is
what not to copy.
