# The SDLC is spec → plan → tickets → PRs, run wide in parallel, merged only by the owner

Each milestone is grilled, specified (`docs/specs/`), planned in plan mode (`docs/plans/`) and cut
into vertical-slice tickets in GitHub Issues, the only work state. Tickets marked `cloud` (provable by
committed tests) run in cloud sessions. Tickets marked `local` (needing real drawings) run locally and
pass a real-drawing check before merge. The built-in Workflow tool may launch a whole wave of tickets
in parallel, as a launcher only.

**The owner is the only person who merges.** A milestone is done only when the owner and the team
have walked it in the running product on real drawings. The harness is configuration and prose, with
two small hooks.

We chose this over an autonomous build engine because Vextrus Builder became the product: about 23 %
of its spend went on its own faults, and it reported green while the product failed
(docs/postmortem.md; docs/research/sdlc-claude-code.md §5). Its twelve failure modes each have a rule
in docs/sdlc.md.
