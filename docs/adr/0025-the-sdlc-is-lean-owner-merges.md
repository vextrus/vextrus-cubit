# The SDLC is spec → attacked plan → tickets → PRs, run in waves, merged only by the owner

Each milestone is grilled and specified (`docs/specs/`), then planned as a committed document
(`docs/plans/`) that reviewers attack in parallel and the owner signs, then cut into vertical-slice
tickets in GitHub Issues, the only work state. `cloud` tickets (provable by committed tests) run in
cloud sessions; `local` tickets (needing real drawings) run locally and pass the real-drawing check
(ADR 0030). The harness is configuration and prose: three small hooks and the blind scorer
(docs/sdlc.md).

**The owner is the only person who merges, and it is enforced:** GitHub Pro, with a ruleset on `main`
(no direct pushes, a PR required, CI green, branches up to date, 0 required approvals, and on engine
PRs the `real-drawings` status); the guard refuses `gh pr merge` and the merge API in every agent
session; no self-hosted runner on the owner's machine. **The owner reviews evidence and behaviour,
not code:** each PR states what it did not verify, what it verified and how, real-drawing counts where
relevant and screenshots for UI; `/code-review` and the critics carry the diff, top five findings per
PR. The owner reads in full only `.github/`, `.claude/`, migrations and tests.

**Waves** (docs/research/sdlc-waves-and-cloud.md):
1. One `claude --cloud` command per cloud ticket, about two-thirds on account B (a second config
   folder). The $500 credit, reportedly expiring 4 Nov 2026, is spent from M0's first `cloud` tickets.
2. Wave 1 is four cloud and one or two local tickets, measuring cost per merged PR, time to PR, the
   owner's review minutes and second continuations. Widen to 6–8 cloud once the review queue stays
   under a day, at most one PR in four needs a second continuation, and conflicts stay trivial; the
   ceiling (about 10–12) is the owner's review.
3. Tickets in a wave own disjoint files; at most one per wave adds migrations to a given module.
4. The Workflow tool launches only unattended local tickets, as a launcher with no state; no
   orchestration code. One milestone is planned at a time.
5. Ultrareview uses only the free runs (three per account); no paid ultrareviews, no usage credits.

Why: Vextrus Builder became the product (about 23 % of its spend went on its own faults) and reported
green while the product failed (docs/postmortem.md; docs/research/sdlc-claude-code.md §5).

## History
- 25 Sep 2026: decided (plan in plan mode; two small hooks).
- 26 Sep 2026 (owner's decision): the merge is enforced and the owner reviews evidence. Evidence: plan
  review M11 (branch protection returned HTTP 403 on GitHub Free). The owner's ruling: "Agree, I'll
  buy GitHub Pro".
- 26 Sep 2026 (owner's decision): how waves run. The owner's ruling: "Agree but no paid ultraviews".
- 26 Sep 2026: the plan became a committed, attacked document (session 01 brief); the harness has
  three hooks and the blind scorer (ADR 0026), as docs/sdlc.md states.
- 26 Sep 2026 (owner's decision, M0 plan): the owner also reads in full the harness scripts and the
  sandbox (`scripts/real-drawings`, `scripts/real_drawings/`, `scripts/score/`, `scripts/owner/`,
  `scripts/cloud/`, `engine/read/sandbox.py`). The owner's ruling: "Agree with all four".
- 27 Sep 2026 (done): GitHub Pro is bought (the rulesets API answers; the ruleset is set after 01a
  merges). The cloud environments exist on both accounts: Python 3.13, Node 24, .NET 10.0, Postgres
  (5432 in the cloud) and LibreDWG 0.14 ok; the LibreDWG release asset did not download inside the
  setup script, which built it from source within its time budget; the TypeSafe credential returned
  422 on an empty body (likely attached, unconfirmed until a real-body 200).
