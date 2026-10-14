# The factory, reviewed beside session 27 (14 Oct 2026)

A read-only session ran beside session 27 (06:26Z to 11:30Z) and reviewed the factory against its own measures, the current
Claude Code docs, current agentic-development practice, third-party sandboxes and Anthropic's own account of removing its
development bottleneck. Seven background reports did the reading; the claims that steer session 29 were checked against
the CI logs and the review log. The reports and scripts are local (`.private/work/s27-explore/`); nothing here comes from
a drawing. The owner ruled on 28 questions from it (docs/plans/factory-s29.md).

## Where the time goes (measured)
| Sink | Measure | Source |
|---|---|---|
| The real-drawing lock | 143-233 min a session in S18-S26, 26-63 % of session wall time; flat for nine sessions | session STATE logs |
| Why the lock is wide | `.github/engine-paths.txt` names `vextrus/platform/**`, `projects/**`, `drawings/**`, `takeoff/**`: nearly every backend PR takes a 25-45 min run; every engine merge stales the next head; nothing runs on main after a merge | the file; `.github/workflows/` |
| Fix rounds | 25-52 min a round; 2.9 reviews per merged PR (S26); 77 % of later-round findings were made by the previous fix | review ledger; docs/research/2026-10-13-why-m0-dragged.md |
| CI, before every review | `ci` median 10.4 min (p90 12.3), `web` 7.2 (p90 11.2); setup is under a minute, the rest is tests | `gh run list`, 14 Oct |
| A duplicated shard | the `rest` shard, told to skip `scripts/` and `engine/`, ran 7,503 tests in 697 s including both (run 38526912157): CI's critical path (#864) | the run's log |
| Cloud verify | about 20 min reported; never timed per check. It runs CI's whole web chain twice (one pass slowed) beside pytest and crosspr on 4 vCPU; load trips the 5 s web timeouts; each BLOCKED costs a 10-55 min local re-verify (#823) | `scripts/verify.py`; STATE logs |
| Gates after review | design gates failed 5 of 12 walks (S26) and 5 of 7 (S27) on heads review had passed | STATE logs |
| Serial landing | about an hour a PR in S27: update with main, CI again, a new gate walk, the real-drawing run, land | S27 STATE |
| Holds | owner-question holds of 5 h, 3.5 h and 2 h (S17, S21, S23); one integration hold of 910 min (#811) | STATE logs |
| Review compute | only 5-11 % of a PR's open-to-merge time (44 of 411 min in S27) | review log; PR times |

## Why G1 does not converge
Five walk verdicts: 38 findings / 14 BLOCKS / 13 misleading (5 Oct); 22/7/8; 14/4/8; 7/0/3 (13 Oct, FAIL on misleading alone);
19/2/8 (14 Oct). BLOCKS fall; misleading findings do not. A PASS needs zero BLOCKS and zero misleading findings on two walks
in a row, an item fails when any critic fails it, and each walk is a fresh free exploration by several critics, so a second
walk on unchanged code finds new things by construction (`scripts/walk/ready.py`, `.claude/workflows/real-set-walk.js`).

## What makes a review FIX (434 runs, `.private/work/factory/review-cost.jsonl`)
Blocking findings are already reproduced: each finding of 50 or more carries a failing attack test, and of 260 FIX verdicts
only one had an UNPROVEN finding among its blockers and none rested on UNPROVEN findings alone. Since the 13 Oct bar (block on
75, or on 50 when user-facing or on a trust boundary), 23 of 30 FIX verdicts rested only on 50-74 findings, many "real but
rare" (an input no Development Set holds). The loops come from the bar and from heuristic treadmills (one keyword at a
time), not from unproven claims.

## Tokens
The orchestrator ran at a median 450-510k tokens of context, compacting only near 1.1M; cache reads were about 82 % of its
cost (S26: about $106 of $128, list-price proxy). Notifications drove most re-reads (68 % in S26). Reviews cost about $6 a PR
(468 runs, $1,189 list, 8 days), written to the 1-hour cache tier although a lens runs for minutes. Static text (CLAUDE.md,
rules, agents, launch prompts) is about 2 %. Builder tokens per ticket are unmeasured. How Max meters cache reads is not
documented ([support](https://support.claude.com/en/articles/11145838)).

## The platform (Claude Code docs, 14 Oct)
- A cloud session is 4 vCPU, 16 GB, 30 GB disk, with no larger size on Max; self-hosted environments are Team/Enterprise only
  ([cloud environments](https://code.claude.com/docs/en/cloud-environments.md),
  [self-hosted](https://code.claude.com/docs/en/self-hosted-environments.md)). Chromium is not preinstalled; a setup script
  can likely install it (unverified). Untracked files never upload; a private repo cloned with a read-only token is the
  route ADR 0042 already names for the two Development Sets (never probed).
- The status line re-runs only on session events unless `refreshInterval` is set
  ([statusline](https://code.claude.com/docs/en/statusline.md)): ours is not, so it goes stale while idle (#866).
- Mods (since 2.1.287, 1 Oct) can draw colour, Markdown, panes, inputs and images and read live usage; their API changed in
  nearly every release since ([mods](https://code.claude.com/docs/en/plugins/mods/overview.md)). Our band polls every 15 s,
  reads the oldest 20 review verdicts and keeps reviews of PRs outside its 200-PR window (#866).
- `claude remote-control --spawn worktree` runs many sessions on a machine you control on a Max plan; a subscription inside a
  hosted box is allowed for the end user's own use ([legal](https://code.claude.com/docs/en/legal-and-compliance)).

## Third-party sandboxes
Impello ([docs](https://www.impello.ai/docs), [terms](https://www.impello.ai/terms)) is an E2B-style sandbox API with no
Claude orchestration, terms dated 11 Oct 2026 and no SLA; E2B, Daytona and Modal are the same class. None beats the free cloud
sessions plus the owner's machine for this factory; a rented single-tenant server is the only option that adds browsers and
drawings at scale, and it shares the same usage pool. The owner ruled: no third-party sandboxes for now.

## Practice (2026)
- Anthropic, "Redesigning source control" (13 Oct 2026,
  [post](https://www.anthropic.com/engineering/redesigning-source-control)): merges grew from about 2,500 to over 30,000 a
  day; "We haven't been able to effectively replicate the industry standard of a global repository lock on the merge queue":
  post-merge and pre-deploy tests, automated bisect and revert, and Claude fixing conflicts "faster than humans detect them";
  engineers "tell Claude 'no'", adversarial review "could be overly defensive", and people review a change's intent.
- One clean-context reviewer plus CI is the common shape; fresh context beats patching a patch (Cognition; Shukla et al. on
  degradation over LLM-only fix iterations, as cited in the local report); immutable acceptance lists and an end-to-end
  check at session start ([long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents));
  evals built from escaped defects ([evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents));
  change the harness, then remove scaffolding as models improve
  ([Böckeler](https://martinfowler.com/articles/harness-engineering.html)).
- The insights report over 17 sessions (13-14 Oct): first passes miss whole input classes; gates catch mistakes after the
  commit (leak hits forcing resets, the Cut check refusing PR bodies); design docs take about six rounds on stale figures;
  real-drawing runs queue and overrun budgets.

## Not measured
Cloud verify per check; builder tokens per ticket; how Max meters cache reads; lock queue waits per run; round-1 PASS by
builder model; whether `review self` raises round-1 PASS; how loosely "user-facing" is tagged.
