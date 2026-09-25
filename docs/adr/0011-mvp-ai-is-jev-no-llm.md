# The MVP's AI is Jev only; a System Two LLM joins at Level 3, beside Jev

AI in Vextrus comes at three levels: **Level 1** inside the Takeoff (sheet types, layer and text roles,
label binding, phrasing Questions); **Level 2**, an assistant over the confirmed dataset ("concrete on
the 3rd floor?", "what if rod rises 8%?"), where the AI chooses the question's meaning and code
computes every number with its Trace; **Level 3**, autonomous agents doing whole jobs ("what changed in
revision C, and what does it cost?"). The MVP ships Levels 1 and 2 on TypeSafe's Jev, a System One
judgment model, with no LLM. Level 3 comes after the MVP and combines Jev with a System Two LLM
(Claude), used only where reasoning or generation is genuinely needed.

**The rule for every node:** code finds the candidates and computes every number; Jev picks one with a
confidence; the QS confirms. A low-confidence answer becomes a Question. If TypeSafe is unavailable,
the QS picks; the Takeoff never stops.
1. **Code owns** counting, numeric plausibility, storey ranges, grids and detail-to-plan references.
   Jev keeps sheet types, layer roles, text roles, label binding and Ask routing.
2. **Jev is always given code-computed facts** (sizes, positions, neighbours), never raw text alone.
3. **Every Jev node ships with a spot check of about 30 real items,** a measured queue size and a
   pinned model version, in one table (counts in git, labelled items in `.private/`), re-measured when
   the model changes.
4. **Each QS override of a Jev proposal is logged** as the node's live error rate.
5. **A per-tenant answer cache** keyed by (facts, question, options, model) makes re-reads free and
   reproducible.
6. **The review queue is sorted by effect on quantity or ৳;** Questions per step is a finish-line
   metric.

Why: a closed-question model cannot invent a quantity or a rate, so AI gets the properties of code;
it keeps AI cost per project negligible; and it lets the product be quietly smart instead of
marketing "AI". Code stays the first choice wherever the logic is obvious. Caveat: it can still choose
wrongly, hence the spot checks. Evidence: docs/research/jev-system-one.md (on invented cases Ask
routing was strong in English and Bangla script; Banglish what-if phrasing weakest, :152). Jev also
helps development sessions where a closed question fits (docs/sdlc.md).

## History
- 25 Sep 2026 (the owner's decision): Levels 1 and 2 on Jev with no LLM; Level 3 after the MVP.
- 26 Sep 2026 (owner's decision): every Jev node measured on real items. Evidence: plan review M1 on
  the real Edison set (storey ranges right 19 / 38; section letters confused with grid labels; review
  queues of several hundred items), docs/reviews/plan-review-ledger.md. The owner's ruling: "Agree".
- Open: we ask TypeSafe about concurrency limits for thousands of calls per drawing.
