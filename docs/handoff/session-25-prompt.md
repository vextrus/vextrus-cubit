# Session 25: land FL8 and its stack, fix G1 walk 1's blocks, then G1 PASS twice on main

**The goal, in one line:** `uv run python -m scripts.walk.ready origin/main` exits 0 (two counted G1 PASS verdicts on
main's current product code), so the owner can walk M0. Today it exits 1. G1 walk 1 of session 24 (59524e39) FAILed:
script layer 15/16 (act sampling, #716), agent layer 4 BLOCKS.

## Session 24's measures (`scripts/factory/measures.py`, 12 Oct 15:57Z to 13 Oct 00:13Z, ended at 8:16 of 12:00)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 7 | 3 | |
| merge_p50_min | 84.8 | 2.6 | |
| rounds_per_pr | 2 | 1.33 | |
| rdlock_min | 176.2 | 40.2 | |
| verify_p50_min | 7.7 | 9.2 | |
| verify_p90_min | 14.0 | 11.0 | 10 |
| ci_wall_p50_min | 9.5 | 10.3 | 10 |

Merged on main (3672c414): #697 (recognise and plot lax for session 24; **remove the two globs this session**,
`scripts/factory/review_tiers.toml` and its test_ledger cases), #699 (the reviewer reads the lax list from the tiers file),
#707 (the ledger's verdict follows the bar: a lens FIX with no finding at the bar is PASS), #704 (FL6: MTEXT fits its
box, #661), #698 (FL5: long view titles, phantom views gone), #710 (the question cap: a `*_details` kind over the generic
`details` is no doubt), #712 (FL6: one sheet, one Plot page, a set-level match, #660, #197).

## Where each G1 item stands (walk 1 on 59524e39 plus what landed or waits)
| Item | State | What remains |
|---|---|---|
| FL1-3, FL6, FL11 | PASS in walk 1 | f-3 (FL4, page 14 as sheet 50) is fixed by #712: re-check on a fresh read |
| FL4 | FAIL (f-3) | fixed on main by #712 |
| FL5 | FAIL (f-4: "1 / 8 settled" counts a sheet outside the 8) | #725 (C3) passed review but its design gate FAILed item 1: with a drawing list shorter than the sheets found the heading reads "8 / 5". Fix: the total is the sheets found (m0-screens 6.3), keep the list's count in the words; add the case to ts24c3 |
| FL7 | FAIL (f-2/f-10: chips say unaccounted, the bar says 0) | C2 (branch s24-c2, cloud session_01... in its launch record) building: decided views take Coverage's standing steps, one query per reply. Plus #714 (A3: Coverage totals agree) |
| FL8 | FAIL (f-1: a one-source continuation run can't be confirmed, so General can't be) | C1 (s24-c1) building. FL8 itself: **#723** (fresh PR of #706: Correct E, undo, stale form), design gate PASSED at dd3bc302 (same tree as head d978bfb0: post `--passed 1,2,3,4,5,6,7,8,9,10 --not-applicable 11` once review passes); review round 1 was running at close. B2 (s24-b2, storeys by E) stacks on it |
| FL9 | FAIL (script: act sampling) | #724 (W1) in its fix round (a wall-clock bound per read). Also: #712 may slow DWG reads (one Edison file 171 -> 395 s, measured under contention): measure in the next walk |
| FL10 | FAIL (f-5 words) | B1 (s24-b1, READY a5cde0da, verified locally): publish after #723 lands; it stacks on #723 |
| FL13 | FAIL (f-6, f-7 slow Step 1 7.5 s, f-8) | #714 (A3) closed until #723 lands; then reopen, merge main, resolve the catalogue, review round 2 |
| #711 (B3, FL6 #665) | PASSED twice; golden amended | round 3 (false-statement) was queued at close; then a posting run (expect the same 15 views) and land |

Order: **#723 first** (it blocks #714, B1 and B2 through crosspr), then #711, #724, C1, C2, C3-fixed, #714, B1, B2;
then G1 #2 and #3 on the final main. Every walk 1 finding of OTHER is filed (#717-#722 and comments on #314, #319,
#320, #322, #324, #330, #335, #662).

## First 15 minutes
1. `date -u`; `uv run python -m scripts.factory.stamp start --budget <h> --state .private/work/s25/STATE.md --phases "land=150,g1=210"`.
2. `uv run python -m scripts.factory.state`; read every builder's branch tip yourself (the watcher misses carried-over
   tickets' READY and some BLOCKED: A1, A7). `df` (keep 30 GB: the walk's governor), `free`, swap (the owner cycled swap
   off; WSL restores it on restart).
3. Remove `engine/recognise/**` and `engine/plot/**` from `[lax]` (one small PR; the owner ruled them lax for session
   24 only).
4. Ask the owner, once, at the start: the budget; whether a view on a confirmed sheet should take its sheet kind's
   steps silently or stay unaccounted until someone acts (walk 1 f-2; C2 keeps today's behaviour and makes the chips
   agree); the M1-05 rulings (`.private/work/m1-05/disagreements.md`, 10 items, 1.5 h); #705 (rebar defaults); M1-02.
   Say, not ask: the scorer custody re-run is owed (#687): `! bash scripts/owner/custody-setup.sh`.

## Binding from session 24 (docs/knowledge/lessons.md, Session 24)
- Cloud builders cannot finish verify's web tests under load; the orchestrator verifies their tree locally with a
  clean `npm ci` (never a symlinked node_modules) and commits READY on that exact tree.
- An accept reason is written after reading the posting run's own table, never from a builder's counts.
- A PR's base must contain every engine merge before its posting run, or the table shows the merges in reverse:
  `land update` first.
- Two open PRs that conflict each refuse the other's READY (crosspr): decide the order and close the later one.
- A spec's worked example is one seed table every figure cites (#700).

## Cut (to session 25 or later)
- #700 M1-24 m1-screens: reshaped to one seed table (ae830596); review it fresh. The qs-critic signs it.
- #701 A6 factory quick wins: rounds spent; last fixes on its branch (76038dd7); review it fresh.
- rdlock's single holder: the owner's "two runs at once" needs an rdlock change.
- #726 review counts a superseded run's cancelled jobs as red CI; #709 verify's contract-fixtures race; #716 the walk's
  act sampling (W1, #724).
- M1-06 (the Held-out instance) never launched (six local agents held every slot); its prompt is
  `.private/work/s24/m1-06-prompt.md`, branch m1-06 on origin.

## M1 wave 0 (after the owner's M0 walk, docs/plans/M1.md O2; its docs and owner-time tickets already started)
- M1-24 m1-screens: #700 reshaped to one seed table (ae830596); review it fresh, then ux-critic and qs-critic (the
  qs-critic signed the previous head). It merges before any M1 UI ticket's acceptance writer starts.
- M1-05 Edison counts: both analysts done; 10 rulings wait for the owner (`.private/work/m1-05/disagreements.md`).
- M1-02 the Sample Project's element key: the owner's 1.5 h (the key user's reduction script).
- M1-06 the Held-out instance: never launched; prompt `.private/work/s24/m1-06-prompt.md`, branch m1-06 on origin.
- M1-00 the contract freeze: only after the owner's M0 walk.
- #705 (rebar defaults: allowance rates sum 3.1 kg/sft against the 4.5-6 check) blocks M1-07 until ruled.

## Housekeeping
- Never push local branches s22-fl7, s22-fl7b, s22-fl5b (real titles or a leaking commit).
- Open for the owner (carried from session 24): #687 narrowed "setback" to "plot setback", so a Structural sheet
  titled only "SETBACK ARRANGEMENT" leaves its untitled section unaccounted where the 11 Oct ruling gives Step 14.
- The owner clears stale builder worktrees under `.claude/worktrees/` (31 GB; sessions 15-22) and stops s22-fl7 from
  `claude agents` (the daemon resumed it after a kill).

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. The orchestrator stays Opus 5.5 `medium`, with no workflow
but `real-set-walk`.
