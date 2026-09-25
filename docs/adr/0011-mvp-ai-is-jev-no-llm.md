# The MVP's AI is Jev only; a System Two LLM joins at Level 3, beside Jev

AI in Vextrus comes at three levels:
1. **Level 1, inside the Takeoff.** Sheet classification and sheet-to-storey mapping, layer-to-member
   mapping, reading schedules and notes, binding labels to geometry, phrasing Questions.
2. **Level 2, an assistant over the confirmed dataset.** For example "concrete on the 3rd floor?"
   or "what if rod rises 8%?". The AI chooses the question's meaning; code computes every number,
   with its Trace.
3. **Level 3, autonomous agents doing whole jobs.** For example "what changed in revision C, and
   what does it cost?".

The owner's decision: the MVP ships Levels 1 and 2, built on TypeSafe's Jev, a System One judgment
model, with no LLM. Level 3 comes in the milestone after the MVP. It combines Jev with a System Two
LLM (Claude), so the LLM is used only where reasoning or generation is genuinely needed.

Why:
- **It gives AI the properties of code.** Jev answers closed questions (a choice among given
  options, a score), so it cannot invent a quantity or a rate. Code owns every number.
- **It is fast and cheap.** The Takeoff and the assistant are used heavily. An LLM behind every call
  would turn usage into a large API bill; Jev keeps AI cost negligible per project. Vextrus Cubit's
  measured Ask cost was under one cent.
- **Quiet intelligence.** The product does not market "AI". Jev sits inside ordinary business-logic
  nodes where a fixed rule would be dumb (a smarter default, a sensible match, a better ranking),
  so users feel the product is smart. Code stays the first choice wherever the logic is obvious.

Caveat, stated plainly: a closed-question model cannot invent, but it can still choose wrongly.
Each Jev node needs its own measured accuracy on real drawings before it is trusted, and a
low-confidence answer becomes a Question for the QS. Which nodes use Jev, code alone, or an LLM is
settled in docs/research/jev-system-one.md. Its live tests (226 invented AEC cases, about one US
cent in total) found:
- **Where Jev is strong:** sheet types, layer roles, label binding and Ask routing (in English and Bangla script; Banglish what-if phrasing was its weakest area, docs/research/jev-system-one.md:152).
- **Where it must not be used:** counting and numeric plausibility (a 150×150 column scored as
  plausible). Those checks are code.
- **The rule for every node:** code finds the candidates and computes every number, Jev picks one
  with a confidence, and the QS confirms.
- **If TypeSafe is unavailable,** the Takeoff falls back to the QS picking. It never stops.

The owner also asks that Jev help the development sessions themselves, where it fits (the SDLC
design).

## Amended: every Jev node is measured on real items (owner's decision, 26 Sep 2026)
On the real Edison set (plan review M1, docs/reviews/plan-review-ledger.md), storey ranges as Jev
choices were right 19 / 38, section-cut letters were confused with grid labels, first bar-role and
level-label passes were right about a third of the time until code-computed facts were added, and
review queues reached several hundred items per drawing. So:
1. **Code owns storey ranges, grids and detail-to-plan references.** Jev keeps sheet types, layer
   roles, text roles, label binding and Ask routing.
2. **Every Jev node ships with a spot check of about 30 real items,** a measured queue size and a
   pinned model version, in one table (counts in git, labelled items in `.private/`), re-measured
   when the model changes.
3. **Jev is always given code-computed facts** (sizes, positions, neighbours), never raw text alone.
4. **Each QS override of a Jev proposal is logged** as the node's live error rate.
5. **A per-tenant answer cache** keyed by (facts, question, options, model) makes re-reads free and
   reproducible.
6. **The review queue is sorted by effect on quantity or ৳;** Questions per step is a finish-line
   metric.
7. We ask TypeSafe about concurrency limits for thousands of calls per drawing.

The owner's ruling: "Agree".
