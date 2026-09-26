# A catalogue of Checks against something independent raises Questions, at reading and at every Confirmation

The engine has a versioned catalogue of Checks. A Check tests what was read, confirmed or priced
against something independent of it, never against the pipeline's own output. Three kinds:
- **Against the source drawings:** schedule vs plan, section span vs plan span, level lines vs level
  labels, drawn spacing vs spacing text, bars inside their concrete, rebar schedule totals that sum
  back (ADR 0010), each room enclosed by its walls.
- **Conservation:** owned volumes sum exactly to the union of the concrete (ADR 0009); each item's
  labour comes from exactly one source (ADR 0006).
- **Sanity range:** the MD's consumption checks per sft of Gross Floor Area (ADR 0016) and the MEP
  lump sums' ৳/sft ranges (ADR 0007).

Checks are pure functions over (the read artefacts, the confirmed state). They run when a Drawing Set
is read and again at every Confirmation, since a changed beam depth moves slab and wall heights. A
Check that fires raises a Question, as does a low-confidence reading; a sanity range raises a flag,
never a block. Every count shows as n / N with N taken from the drawing ("86 / 89 columns placed").
The Coverage of a Drawing Set accounts for every view on every sheet: used, or excluded with a
reason. Each Check names the milestone that brings it; M0 brings Coverage. The Sample Project is the
Checks' regression set (ADR 0004).

Why: bulk Confirmation passes errors that look right. The laboratory's (plan review C2): bars exact
at every vertex but outside the concrete, a cleaning step that passed QA because QA compared against
the cleaned plan, a whole reinforcement sheet never read; each was caught only by a check of a
different kind. Our prototype caught every wrong binding with a cross-sheet size check
(docs/research/2d-to-bim-prototype-lessons.md). Rejected: Questions from low confidence only, with
Confirmation as the one safeguard: exactly where plausible, systematic errors pass.

## History
- 26 Sep 2026: decided, with re-running after Confirmation from the architecture critic. Evidence:
  plan review C2, docs/reviews/plan-review-ledger.md; docs/reviews/session-01-architecture-critic.md.
  The owner's ruling (26 Sep 2026): "yes, agree on the check catalogue".
- 26 Sep 2026: "Check" widened in CONTEXT.md to conservation and sanity ranges, which ADRs 0006, 0009
  and 0016 already used; this ADR now says so (docs/data-model.md §1.3).
