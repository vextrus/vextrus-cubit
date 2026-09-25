# The real-drawing check runs on every engine PR, as the key user, and posts aggregates only

Any PR that touches `engine/**` or the reading modules needs a `real-drawings` status before it can
merge (a required check in the ruleset, ADR 0025): chosen by path, not by label. The owner starts it
with one command. It runs as `vxkeys` (ADR 0026): it reads every Development Set and Held-out Set on
the PR's head, diffs against the last merged run element by element, and posts only aggregates: n / N
per Takeoff Step, the change in each, and the count of elements with changed attributes per family.
The guard refuses agents posting commit statuses. The expected N values are Answer Keys, counted by
a route independent of the reader and confirmed by the owner, written per Development Set in M0 for
the steps M0 and M1 need. A `local` reading ticket stops when its n / N stops improving, not after a
fixed number of continuations. Lessons go into `docs/knowledge/lessons.md` by area, in the same PR as
the fix.

Why: the plan had a check with no expectations and no one to write them (refuter #5); a `cloud` PR
touching shared engine code could regress reading with CI green (plan review M12); counts alone miss a
resized column (architecture critic's dispute). Vextrus Cubit's failure was green CI over a product
that did not read real drawings (docs/postmortem.md, cause 1).

Considered: a self-hosted GitHub runner on the owner's machine. Rejected: agents write the workflows
it would run, beside `.private/` and the secrets (docs/research/sdlc-waves-and-cloud.md).

The owner's ruling (26 Sep 2026): "Agree".
