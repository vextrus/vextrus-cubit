# Why M0 took 24 sessions: a measured account (13 Oct 2026)

An exploring session ran read-only beside session 24 (12 Oct 17:12Z to 13 Oct ~01:00Z). It counted the repository's own records
and put every claim that would steer session 25 through a `refuter`. This note keeps the numbers, their windows and their caveats.
The raw tables and scripts are local (`.private/work/s24-explore/`); nothing here comes from a drawing.

## Sources
- `gh pr list --state all` (359 PRs, 28 Sep to 12 Oct 2026), with each PR's file list; `git log origin/main --numstat`.
- The review ledger (`scripts/ledger.py`, 481 records) and `.private/work/factory/review-cost.jsonl` (311 review.py runs).
- The PR review markers (499 markers on 240 PRs).
- Session briefs `docs/handoff/session-14-prompt.md` to `session-24-prompt.md`, and each session's measures.
- G1 walk verdicts under `.private/work/` (10 walks).
- `gh run list --workflow e2e.yml`.

## Findings
1. **Review rarely passes the first time.** Round-1 PASS, PR markers, from session 18 (8 Oct 05:52Z): 17 of 53 (32 %). The cost log
   gives the same rate (18 of 57 PRs). By area in that window: docs 7/13, factory 6/13, engine 2/17, backend 1/8, web 1/2, so product
   code passed 4 of 27. Over sessions 14–24 the per-area rates were 13–24 % for code and 43 % for docs. Over all sessions the markers give 24 %.
2. **The findings are real.** A stratified sample of 30 findings scored 50 or more (sessions 18–24, all areas, rounds 1–3), each read
   against the reviewed head: 10 user-facing defects, 14 edge, hostile-input or race defects, 5 breaking only the factory's own rules,
   1 spec gap, 0 false. Caveats: the shares are not population rates; 12 rows were read in code, the rest rest on the refuter, which
   confirmed 436 of 445 findings largely by re-running the reviewer's own failing test.
3. **Most were catchable before the PR** (one reader's judgment): 15 by the builder running the same review lens on its own diff, 8 by
   acceptance tests the writer left out (variant tables for word rules, upload-order permutations, every listed act), 6 by cheap
   committed checks.
4. **Fixes make new findings.** Of 16 sampled round-2 and round-3 findings, 7 were new faults introduced by the previous fix and 5 were
   incomplete fixes (weighted to the population, about 77 %). 78 of 107 later-round findings sit within 10 lines of the previous round's change.
5. **The bar.** Of 35 round-1 FIX verdicts since session 18, 27 rested only on findings scored 50–74. About 24–27 % of 50–74 findings
   were user-facing across rounds (40 % at round 1, n=10). The owner ruled on 13 Oct: block on 75 or more, or user-facing; file the rest as
   issues that owe their check.
6. **The cap closes PRs, and the work comes back.** 107 PRs closed unmerged: 71 landed through a second PR (19.8 % of all PRs; 144k
   lines written, reviewed and CI'd twice), 27 were abandoned or deferred, 3 were in flight, 6 were empty. Lost work is about 5 % of all
   lines written (15–19 % of the closed PRs' own lines).
7. **The factory displaced the product in sessions 12–14.** Product lines merged per session: 17.9k in S3–S11, about 1.4k in S12–S14 (the
   strict factory share was 72, 55 and 56 % of merged lines), 5.5k in S15–S24. Merges per day: 20.4 (28 Sep to 7 Oct), 7.4 (8–12 Oct).
8. **The machine.** The real-drawing lock held 147–212 minutes a session in S18–S23, 22–59 % of each session's budget. The governor
   counts idle builders as live, by design. Contention with a posting run failed G1 walk 1's act-latency check.
9. **G1 finds BLOCKS late.** Ten walks, none passing on main's product code; script-layer failures fell from 13 of 16 to 1 of 16, and the
   agent layer's BLOCKS from 14 to 7 to 4, each set found late in its session.
10. **The served product has never passed its end-to-end test.** `e2e.yml`: 129 failures and 2 cancellations on main, 0 passes in its last
    300 runs on any branch. The smoke test waits for a counter text the screen stopped using.
11. **The design held.** A product review's nine "change before M1" claims were each refuted as cheap-now by the ADRs that already cover
    them (0015, 0036, 0037) or by the plan (M1-11a/b/c, M1-18a). Its one confirmed gap, adding an Element the reader missed, matters
    because closing a step replaces the allowance with the measured figure, so a missed Element is unpriced.

## What it means
M0 dragged because execution did not converge, not because the design was wrong. Defects were found late (in review, not before
it), fixes made new ones, the round cap turned them into resubmissions, and the machine took a quarter or more of every session.
The remedies with a measured cost are: the builder runs the review lens before READY (and on each fix's diff), acceptance tests
pin variants and orders, the bar blocks on what users would hit, G1's critics walk an integration head early, and the end-to-end
test is made green and owned.

## Not measured
Builder cost and tokens per ticket; time from READY to review start; whether `review self` raises round-1 PASS (session 25's pilot);
what fails in the end-to-end test after its first assertion.
