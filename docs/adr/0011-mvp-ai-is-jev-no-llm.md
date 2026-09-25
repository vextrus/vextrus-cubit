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
  nodes where a fixed rule would be dumb (a smarter default, a sensible match, a plausibility check),
  so users feel the product is smart. Code stays the first choice wherever the logic is obvious.

Caveat, stated plainly: a closed-question model cannot invent, but it can still choose wrongly.
Each Jev node needs its own measured accuracy on real drawings before it is trusted, and a
low-confidence answer becomes a Question for the QS. Which nodes use Jev, code alone, or an LLM is
settled in docs/research/jev-system-one.md.

The owner also asks that Jev help the development sessions themselves, where it fits (the SDLC
design).
