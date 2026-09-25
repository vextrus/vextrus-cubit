# Checks against the source drawings raise Questions, at reading and at every Confirmation

The engine gains a catalogue of Checks. A Check compares what was read or confirmed with the source
drawings, never with the pipeline's own output: schedule vs plan, section span vs plan span, level
lines vs level labels, drawn spacing vs spacing text, bars inside concrete, each room enclosed, owned
volumes summing to the whole. Checks are pure functions over (the read artefacts, the confirmed
state). They run when a Drawing Set is read and again at every Confirmation, since a changed beam depth
moves slab and wall heights. A Check that fires becomes a Question, as does a low-confidence reading.
Every count shows as n / N with N taken from the drawing ("86 / 89 columns placed"), and the Coverage
of a Drawing Set accounts for every view on every sheet: used, or excluded with a reason. The
catalogue is versioned, and each Check names the milestone that brings it; M0 brings Coverage.

Why: bulk Confirmation passes errors that look right. The plan review (C2,
docs/reviews/plan-review-ledger.md) lists the laboratory's: bars exact at every vertex but outside the
concrete, a cleaning step that passed QA because QA compared against the cleaned plan, a whole
reinforcement sheet never read. Each was caught only by a check of a different kind. Our prototype
found the same: every wrong binding was caught by a cross-sheet size check
(docs/research/2d-to-bim-prototype-lessons.md). The architecture critic (docs/reviews/) added that
Checks must re-run after Confirmation, not only at reading.

Considered: Questions from low confidence only, with the QS's Confirmation as the one safeguard.
Rejected: it is exactly where plausible, systematic errors pass.

The owner's ruling (26 Sep 2026): "yes, agree on the check catalogue".
