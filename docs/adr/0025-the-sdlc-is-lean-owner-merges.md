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

## Amended: the merge is enforced, and the owner reviews evidence (owner's decision, 26 Sep 2026)
Branch protection on the private repo returned HTTP 403 on GitHub Free, so nothing stopped an agent's
`gh pr merge` (plan review M11). Cloud sessions open PRs under the owner's GitHub identity, and GitHub
forbids approving one's own PR, so required approvals cannot be the mechanism
(docs/research/sdlc-waves-and-cloud.md). So:
1. **GitHub Pro,** with a ruleset on `main`: no direct pushes, a PR required, CI green, branches up to
   date before merge, 0 required approvals.
2. **The guard refuses `gh pr merge` and the merge API** in every agent session, local and cloud.
3. **The owner reviews evidence and behaviour, not code.** Each PR states what it verified and how,
   what it did not verify, real-drawing counts where relevant, and screenshots for UI. `/code-review`
   and the critics carry the diff, top five findings per PR.
4. **The owner reads in full only** changes to `.github/`, `.claude/`, migrations and tests.
5. **No self-hosted runner on the owner's machine** for cloud PRs.

The owner's ruling: "Agree, I'll buy GitHub Pro".

## Amended: how waves run (owner's decision, 26 Sep 2026)
Evidence: docs/research/sdlc-waves-and-cloud.md. The Workflow tool launches only local worktrees; the
cloud credit ($500 across two Max accounts) reportedly expires on 4 November 2026, after which cloud
sessions draw on plan limits, so it is spent early rather than saved.
1. **Cloud tickets launch one `claude --cloud` command each,** about two-thirds on account B (run from
   this machine through a second config folder), since account A also carries planning and local work.
2. **Wave 1 is four cloud and one or two local tickets,** measuring cost per merged PR, time to PR,
   the owner's review minutes per PR, and second continuations.
3. **Widen to 6–8 cloud** once the review queue stays under a day, at most one PR in four needs a
   second continuation, and conflicts stay trivial. The ceiling (about 10–12) is the owner's review.
4. **Tickets in a wave own disjoint files;** at most one per wave adds migrations to a given module.
5. **The Workflow tool launches only unattended local tickets,** as a launcher with no state. No
   orchestration code (this answers refuter #1: the research's warning was against an engine).
6. **Cloud waves start as soon as M0's first `cloud` tickets exist;** one milestone is planned at a
   time.
7. **Ultrareview uses only the free runs** (three per account). No paid ultrareviews and no usage
   credits; after the free runs, `/code-review` and the critics carry risky PRs.

The owner's ruling: "Agree but no paid ultraviews".
