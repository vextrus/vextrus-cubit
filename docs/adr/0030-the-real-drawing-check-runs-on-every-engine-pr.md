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

## History
- 26 Sep 2026: decided. Evidence: refuter #5, plan review M12, the architecture critic's dispute
  (docs/reviews/). The owner's ruling (26 Sep 2026): "Agree".
- 26 Sep 2026 (mechanism, no new decision): the ruleset requires a `real-drawings` status on every
  PR. A CI job sets it to success ("not applicable") when the diff touches no engine path; otherwise
  it stays pending until the owner's command posts the result as the key user. The owner reads every
  change to `.github/` in full (ADR 0025), so an agent cannot quietly widen "not applicable".
- 26 Sep 2026 (owner's decision, M0 spec): each Takeoff Step's expected N values are written when that
  step's milestone starts, not all in M0. The owner's ruling: "Agree with 1–5".
- 26 Sep 2026 (owner's decision, from the M0 plan reviews): **the pipeline no longer runs as the key
  user.** It runs as the owner, inside bwrap with no network and the key user's home hidden, and
  writes its export to a drop folder; only the scorer runs as the key user, with the owner's
  password, reading that export and the keys. Running the PR's own code as the key holder would have
  let it copy a key (architecture critic #3, refuter #1). The owner's ruling: "Agree, write the
  script to remove the rule".
- 26 Sep 2026 (owner's decision, M0 plan): the `real-drawings` status is posted by a small private
  GitHub App the owner holds (commit statuses only, its key with the key user), so a forged status
  shows a different author. The owner's ruling: "Agree with all four".
- 28 Sep 2026 (owner's decision, session 02 Q24): **in M0 the check runs without Answer Keys**: the
  real-drawing command runs the pipeline on the Development Sets for every engine PR and posts the
  element-by-element change against the last merged run (regression); the blind scorer and the keys
  (the Sample Project's, Edison's at sheet and view level, the first scored run) move to M1's first wave,
  when the first Held-out Set and Edison's Hand Takeoff arrive. M0's correctness rests on the owner's walk
  and the render check against the consultant's own Plots. The owner's ruling: "Agree with your
  recommendation on Q24".
