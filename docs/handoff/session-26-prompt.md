# Session 26: fix the factory's measured costs in 90 minutes, then M0 walk-ready twice, with M1 wave 0 beside

**Budget: 6 h** (the owner, 13 Oct 2026: from now a standard session is 6 h for the same amount of work as the old 12 h).
Phases: `stamp start --budget 6h --state .private/work/s26/STATE.md --phases "factory=90,land=150,g1=240"`.

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS verdicts on
main's current product code), so the owner can walk M0. Today it exits 1: 0 of 2. M1 wave 0 runs beside it.

## The order (the owner's ruling, 13 Oct 07:51Z)
1. **0:00-1:30, the factory fixes (FX1-FX7 below).** Builders for them launch at minute 0. The 30 % factory cap (Q17) is
   waived for these 90 minutes only; after 1:30 it binds again.
2. **From 0:00, beside them, the M0 walk-fix tickets** (D2, D3, D4, W2, E1, W3 are already built or building; D1 restarts on
   #714). Land C1 (#738) and A3 (#714) first: both passed review with their gates posted, and only their posting runs are owed.
3. **By about 3:00, the final main;** G1 walk #1 then #2 on it, each under a quiet machine (no posting run, no local suite).
   Two PASS by about 4:30. A G1 BLOCK found by walk #1 is fixed before walk #2.
4. **M1 wave 0 beside** (docs and owner-time tickets only; M1-00's freeze and code only after the owner's M0 walk).
5. **The last 45 minutes:** measures, lessons, the next brief, `stamp end`.

## First 15 minutes
1. `date -u`; `stamp start` (above); `uv run python -m scripts.factory.state`; read every live ticket's branch tip on origin
   AND each local builder's local branch yourself (the watcher misses both until FX1 lands: #761). `df`, `free`, swap.
2. `gh run list --workflow e2e.yml --branch main --limit 5`: the streak was 5 green at 07:41Z. The owner adds `e2e` to main's
   required checks (Q-R6); confirm it is listed on a PR's checks.
3. Read `.private/work/s25/STATE.md` (timeline and every ruling), `.private/work/s25/explore/` (retro.md,
   factory-mod-design.md, claude-code-features.md) and `.private/work/s25/walkA-briefs.md`.

## The owner's rulings of session 25 (13 Oct 2026; they bind)
| Q | Ruling |
|---|---|
| Start | Q10's production-grade numbers accepted as M1's finish line. A trust-boundary finding of 50-74 still blocks (now in F2's bar, #757). factory.md:652 lifted for the mod clock. |
| f-2 | A view on a confirmed sheet takes its sheet kind's steps (C2, #733, merged). |
| M1-05 | Ten Edison count rulings: `.private/work/m1-05/rulings.md` (tanks above roof and out of M1; tie beams and slab on grade are step 5, M2; the tapered cantilever counts; split balcony two panels; ...). |
| M1-02 | The analyst route, not the reduction script (reverses plan Q2). Two analysts counted the Sample Project; two disagreements ruled: the tank-carrying stair-room roof is out of M1; FB-11 is a main beam. `.private/work/m1-02/disagreements.md`. |
| #687 | Keep "plot setback" (a bare "setback" is not site works). |
| #705 | Keep the 4.5-6 kg/sft check and the ruled allowances (sum 4.91 at G+9); #700's figures were wrong. |
| M1-06 | The Held-out instance gets its OWN PostgreSQL 18 cluster (the key user's initdb, own port, local socket): an in-cluster wall cannot hold because build sessions held the shared superuser password. |
| A4 | M1-24's example prices Steps 9-14 from research B.4 too (every row traces). |
| Save state | After a lost act, once the connection is back: "Not saved: your last change did not reach Vextrus. Do it again." No automatic retry (D4). |
| Budget | Session 25 cut to ~6 h; every session from now is 6 h for the same work. |
| Q-R1 | At the round cap: a **fix-only delta review** after round 2 (reviews only the fix's own diff and re-runs the earlier rounds' attack tests; merges if it passes), not a cut. |
| Q-R2 | Design gate: **automatic "not applicable"** when every `web/**` path a PR changes is a test (`web/src/acceptance/**`, `web/e2e/**`, `*.test.*`); any shipped web file still gets the critic. |
| Q-R3 | Web verify under load: **re-run timed-out files alone** with vitest workers capped; a real failure still fails. No spending. |
| Q-R4 | The factory mod may **submit one batched, rate-capped wake prompt** (`$.prompt.submit`) into the orchestrator's session on factory events; it still edits nothing and runs no command. |
| Q-R5 | Session 26's order: factory fixes first (90 min, cap waived), M0 alongside, then two G1 walks. |
| Q-R6 | The owner makes e2e required on PRs. A builder answers a status message with an empty `Factory-Status:` commit. |

## The factory fixes (0:00-1:30): each names the measured cost it removes (`.private/work/s25/explore/`)
- **FX1 the watcher's misses (#761).** `scripts/factory/trailers.py:111-113` writes no event for a BLOCKED commit without a
  `Factory-Reason`; `watch.py:427` drops every launch record started before the session, so carried-over tickets are never
  watched; a local builder whose worktree switched branch drops out. Fix all three, add events for walk.json, verdict.json and
  `Factory-Status:` commits, and the builder rule (Q-R6). Cost removed: ~290-340 builder-minutes unseen in session 25.
- **FX2 the mod wake (Q-R4).** The factory mod's 15 s poll submits one batched wake on READY, BLOCKED, a builder commit, a walk
  file or CI red; at most one per ticket per 15 min and 12 an hour; a status band of every live ticket. Plus
  `SendMessage ... notify_when_idle` on each local builder (claude-code-features.md). Cost removed: the 30-minute Monitor
  re-arms and the unseen heads.
- **FX3 verify under load (Q-R3).** Cost removed: 8 local verifies of cloud trees (C1 C2 A3 B1 F1 F3 F5 e2e), ~15-20 min each.
- **FX4 the delta review (Q-R1).** Cost removed: 5 PRs cut at the cap in session 25 (F1 #748, F3 #737, M1-24 #747 and #756,
  M1-06 #753): 15 of 37 review runs, $45.83 of $94.04, none merged.
- **FX5 the design gate for test-only web PRs (Q-R2).** Cost removed: ~20 min and a refused land each (#711, #724, #738).
- **FX6 publish refuses a body merge_ready will refuse (#759).** Cost removed: 4 refused lands (#755 and #757 twice each).
- **FX7 no review spends on a red CI head.** Cost removed: $12.05 on 3 refused runs (check CI before the lenses start).
- Then, if time remains inside the 90 minutes: **F1 `review self`** (#754; branch s25-f1 c9df5d8c; its last two findings:
  a stop handler and a fix round's base after a main merge) under the delta review; **F4 the guard** (acceptance c825631d is
  on the LOCAL branch s25-f4, never pushed; it needs the throwaway cloud-launch proof first and a local builder).
- Filed, not built: #739-#746, #752 (F3 after the cap), #758 (the Q14 baseline), #760, #764.

## M0: where each walk item stands (G1 walk A on main a492e91a, 13 Oct 07:02Z: FAIL)
Script layer 15/16 (the one FAIL: the Sample Project's act sampling). Agent layer 0 BLOCKS (walk 1 had 4), 3 misleading,
FL8 and FL9 FAIL, FL1/FL10/FL11 NOT_WALKED. The PASS rule needs every item PASS (`docs/specs/factory.md` 878-882).
| Item | What fixes it | State at close (07:55Z) |
|---|---|---|
| FL8 f-1 (one-source continuation run) | C1 #738 | PASS r3, design gate posted; posting run was running (it took >45 min): land when posted |
| FL8 f-3 (dead "Next open item" on a confirmed Step 1) | D2, branch s25-d2 | builder launched 07:26 (cloud) |
| FL8 f-2 (E corrects no storeys) | B2, branch s24-b2 | BLOCKED behind B1 (catalogue conflict with #751) |
| FL9 f-1 (copies table) | D1, branch s25-d1 | STOPPED: #714 already builds the copies table; restart D1 on #714 after it lands |
| FL9 f-6 (hyphenated member-mark ranges) | E1, branch s25-e1 | local builder; its no-post run was queued behind C1 and A3 |
| FL5 f-4 (Discipline totals drop left-out sheets) | D3, branch s25-d3 | builder launched 07:30 (cloud) |
| FL13 (status bar, save state, f-6 jump to a sheet) | A3 #714 + D4 (branch s25-d4) | #714 PASS r3, gate posted, posting run queued; D4 merges s24-a3 first |
| FL10 (words, inspector history) | B1 #751 | step1/en.po went to 836 > 800 lines after main merged (ts15w0): builder splitting the catalogue + an undone-correction 50 |
| Script: act sampling | W2, branch s25-w2 | builder launched 07:27 (cloud) |
| FL1/FL10/FL11 not walked | W3 #766 | r1 FIX (one 50: FL1 is walked in the Django admin on the API origin); fix eb11d2f9 committed locally |
Check each tip before acting; none of these heads is verified by the orchestrator unless STATE.md says so.

## M1 wave 0 (within docs/plans/M1.md O2)
- M1-24 m1-screens: branch s25-m1-24b (local head b84c18e7 carries the qs-critic's N1-N6 and #756's round 3 fixes) waits
  for the seed-figure lint #765 (r2 FIX, its builder fixing); then a fresh PR, the lint green on it, review, qs-critic signs.
- M1-02: both analysts done and ruled; next, the owner confirms both drafts on a review page (~1.5 h a set, M1.md:223) and runs
  custody once (M1-01 builds that step).
- M1-05: ruled. M1-06: rebuild around its own cluster (#753 stays open as the reference).
- Q15's act is in docs/specs/M1.md (#734, story 125); #735 owes its Revision rule.

## Binding from session 25 (docs/knowledge/lessons.md, Session 25)
- Read every live ticket's tip (origin and local) at each check-in until FX1 and FX2 land; never trust the event log alone.
- A posting run's accept reason comes from that run's own table; after an engine merge, `land update` and a fresh no-post.
- A builder's acceptance writer runs first even for a one-line fix that spans a contract (the e2e "fix" was a CI install).
- Parallel local verifies time out; run them one at a time until FX3 lands.
- A docs page with one seed table needs the seed lint before review, or every round finds a stale copy.

## Measures of session 25 (`.private/work/s25/explore/retro.md`; window 02:10Z-07:40Z)
| measure | value |
|---|---|
| prs_merged | 11 (#732 #724 #734 #725 #723 #749 #750 #711 #733 #757 #755) |
| merge_p50_min | 46.5 |
| rounds_per_pr (merged) / rounds per ticket (incl. closed) | 1.64 / 2.27 |
| round-1 PASS | 5 of 14 (product 0/3, factory 4/8, docs 1/3) |
| review spend | $94.04 over 37 runs |
| factory share of builder minutes | 0.79 (cap 0.30) |
| e2e streak on main | 5 (first green ever, after #749) |
| G1 | walk A FAIL (15/16; 0 BLOCKS; 3 misleading) |

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. The orchestrator stays Opus 5.5 `medium`, with no workflow but
`real-set-walk`.
