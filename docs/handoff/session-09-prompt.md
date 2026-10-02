# Session 09: land M0's reviewed queue, finish its fix rounds, then (if the owner rules) M1 wave 1

## Starting the session (the owner)
1. **Before the session: the custody re-run** (owed since PR #187, the installed-copy hotfix, merged):
   `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh` — all 16 wall checks must pass
   (session 08's run failed one, "riz may run the installed command as vxrun (its usage)": the cause, fixed by
   #187, was `.github/checkout-also.txt` missing from the installed copy). Every posting and scored run waits on it.
2. Then: `claude --model claude-opus-5-5 --effort medium`, check `/status`, and say: "Read
   docs/handoff/session-09-prompt.md and run it."

---

You are the orchestrator of session 09, at **medium** effort. Read first, in this order and no more: this brief;
`.private/work/session-08/STATE.md` (the last block, from "RESUME"); each PR's re-check report named below when you
act on it. **8 hours** from your first launch; no new launches after 7 h. Write `.private/work/session-09/STATE.md`
first. Everything in session 08's operating rules still holds (copy `.private/work/session-08/common*.md`,
`writer-common.md`, `watch.sh`, with paths fixed).

**Accounts:** session 08 moved to account A (the owner, 2 Oct: "continue with Account A … and finish session-08")
after account B's organisation cut Claude Code access (403 `oauth_org_not_allowed`, ~18:55Z 30 Sep). Cloud launches
work on A with the default config (`scripts.cloud.launch` from the ticket's worktree). `~/.claude-b` is stale.

## 1. First 30 minutes: land the reviewed queue (after the owner's custody re-run)
Each PR below is reviewed (re-checks in `.private/work/session-08/<ticket>/review/`), its design gate posted on its
current head, CI green except real-drawings. For each, in this order: `gh api -X PUT repos/vextrus/vextrus-cubit/pulls/<PR>/update-branch`
if behind, re-post the design gate on the new head (the same items), `scripts/real-drawings <PR> --no-post` then
`--accept-if-clean` (or `--accept "<reason>"`), `scripts.merge_ready`, merge.

| Order | PR | Ticket | Gate (items) | Real drawings | Note |
|---|---|---|---|---|---|
| 1 | #178 | 22 Step 1 screen | passed 1–11 (walk 5b) | --no-post clean 0/0/0 (2 Oct) | closes #22's work; #115 fixed in it (walk 5b) |
| 2 | #175 | #166 one-source confirm | passed 1,4,10 | not run | includes the ruled amendments dc8ea1a1, 7b97da1a |
| 3 | #183 | #165 read anyway | passed 1,4,10 | not run | |
| 4 | #184 | #158 Structural views | passed 1,4,10 (pass 3) | builder: views 110 changed, checks 103 changed, 0 gained/lost (judged: Structural views accounted) → `--accept` | L 79→0, S 34→0 unaccounted |
| 5 | #180 | #164 sheetless rows | words passed 1,4,10 | not run | after #178 |
| 6 | #186 | #161 same-number per Discipline | not yet: run a words-only `ux-critic` pass (it changes `web/src/takeoff/model.ts` `held()`) | not run | after #178 and #159; contains #159's 9f49a945 |

## 2. Then: the fix rounds left READY but not re-checked (session 08 ran out)
Re-check each with `pr-reviewer` (+ `ux-critic` words where noted) on its head; at most the rounds named.

| Ticket | Branch / head | State | Next |
|---|---|---|---|
| #157 Plot matching | `t157` db6e2066 (local) | round 2 (the last) READY: N1 90 (release on a residual-less rank), N2 75 (order with two PDFs), N3 50 fixed | re-check; words pass on plot_not_matched / plot_no_page; PR; real-drawings (202/208 pages, 0 false) |
| #159 General Discipline | `claude/general-discipline-finish-10lyf0` 9f49a945 (cloud) | round 2 (the last) READY: ruff, F3 by a re-run job (ruling: never widen grants), F4, words `discipline_choice_undone`, docs | re-check + words; PR; real-drawings (engine/recognise touched) |
| #160 one paper scale | `t160` f1c3f5e1 (local) | round 1 READY after the ruling "render_f1 losses not accepted" (run …-d936) | review the real-drawing table first; then re-check |
| #162 no phantoms | `t162` f88cae32 (local) | round 1 READY (ruling: propose out, never drop) | re-check; real-drawings (phantoms 0 counted) |
| 21d job as the check's default | `t21d` 811869f4 (local) | round 2 (the last) READY: each held file in its own child | re-check; **merge 21d last** (after it, every open engine PR must merge main to be read; custody re-run after) ; render_f1 19 lost / 28 changed judged as f32 paper → `--accept` |
| loop 1 view boxes | `loop-boxes` d74bac21 + `loop-boxes-plan` 83584415 (round 2) | sections head scored E views 396/739 (main 332), S 203/417 (197); plans unscored | merge 83584415 into loop-boxes, light re-check, score the head (custody first), PR |
| #168 Discipline from file names | `t168` (acceptance 4ab17285) | **never built** (the cloud session died with account B) | relaunch a builder after #159 merges (rulings `.private/work/session-08/168/rulings.md`) |
| #156 answer Questions on screen | `t156` (acceptance ef40b751) | not started; waits on 22 | rulings `.private/work/session-08/156/rulings.md` (+ refusal.ts list params) |
| #163 viewer Next/Previous | `t163` (acceptance a44eaf09, passes on 22) | walk 5 PASSED it on the seed | after #178 merges: close #163 with walk 5's evidence and merge the tests as a regression pin |
| #167 Step 1 words bundle | — | not started | carry list `.private/work/session-08/167/carry.md` (toast names the Plot, heading from `outstanding`, decided_act words, General in the select, walk 5's mays) |
| #182 (21e) seed through the job | — | split from 21d; acceptance parked `.private/work/session-08/21d/seed-parked/` | after #157 merges; absorbs #150 |

Filed in session 08 (found after the cap or as follow-ups): #176 (a seed test leaks a cad job into the reused test
DB), #177 (Question numbers shift; excluded sheet's kind Question stays open; walk 5b's Y6, Y7), #179 (the lists
Question not asked when a read file brings a list), #181 (held file name cut keeps its tail), #185 (the Revision
Question gap). Debt: the custody wall-check line has no committed test (#187 review, 40).

## 3. The scored loops and the 80% bar
Only one head was scored in session 08 (custody blocked the rest): loop-boxes-sec 20fe66f9, Edison views joined
**396/739** (main 332), Sample **203/417** (main 197); sheets unchanged (Edison 38/217, Sample 8/67). The bar
("Sheets and views ≥ 80%": Edison ≥ 174/217 sheets and ≥ 592/739 views; Sample ≥ 54/67 and ≥ 334/417) is far.
Order unchanged: view boxes (score the merged head), details' kind, phantoms (#162), one paper scale (#160),
storeys **after the owner's key correction** (still owed: `.private/work/session-08/keys-fix/OWNER-STEP.md`; the
owner chose "Run it, read every line" but has not run it), subjects after a vocabulary ruling.

## 4. M1
M1's 47 issues are drafted (`.private/work/session-08/m1-tickets/`, `publish.sh` with 65 native blocking links;
not published). Publish only on the owner's answer to "publish as planned?". Session 09 starts M1's wave 1 only if
the owner rules so at session 08's close (the bar is not met). The launch list follows unchanged.

## The owner's walk (docs/specs/M0.md, Finish line)
`.private/work/session-08/walk-steps.md` (15 steps; tags name the PRs each step needs). Walk after the queue above
merges. Put it to the owner when §1 and §2's merges are in.

## The owner's rulings in session 08 (verbatim)
- Session scope: "All M0; M1 from session 09 (Recommended)"; the bar: "Sheets and views ≥ 80%".
- Key correction: "Run it, read every line (Recommended)" (not yet run).
- Custody, first ask: "Later"; second ask: "Run it now (Recommended)" (run 2 Oct, 15/16; the 16th fixed by #187).
- Account: "continue with Account A (rizkuet@gmail.com) which is logged in and finish session-08".

## Orchestrator's rulings in session 08 (binding on the tickets named)
6.4 overrides older pins (bulk confirm only of agreeing sheets; amendments dc8ea1a1, 7b97da1a); a sheet with no
Discipline is not compared across Disciplines (#161; amendment 90854b73); General Discipline key `general`, its own
kind, every view of a General sheet to Step 2 but the title block (#159); #158's mapping is the fix and `assign` is an
API act for unaccounted views only; #159's Coverage after a Discipline change by re-running the job's steps, never
widening grants; #162 proposes templates out, never drops; #160 render_f1 losses not accepted; 21d split (the seed to
#182); 21d merges last.

## For session 09: M1's wave 1 (launch list)
Kept here so nothing is lost; session 09's brief carries it. The contracts and edges are the plan's, carried by reference: each prompt pastes its ticket's entry from
M1.md "Wave 1" and the contract sections it names (C-numbers), plus "Units: one rule", "Reused from M0:
the loop" and "Where the spec and main disagree". Acceptance tests go under
`<the owned module>/tests/acceptance/m1_NN/` (web: `web/src/acceptance/m1_NN/`); the acceptance lint
guards any path under `tests/acceptance/`.

| Ticket | Where | Effort | Budget | Writer? | Acceptance path | Waits on |
|---|---|---|---|---|---|---|
| M1-01 Scorer: element level, two reads, gate scoring (#123, #127 first) | cloud | high (key fence) | 4 h + custody | yes | `tools/scorer/tests/acceptance/m1_01/`, `scripts/real_drawings/tests/acceptance/m1_01/` | merges after 21c, M1-10a |
| M1-06 The Held-out instance | local | high (security wall) | 3 h + owner 1 h | yes | `scripts/owner/tests/acceptance/m1_06/` | the owner runs it |
| M1-07 Rule Set as Library data, the pin, Billing Units, strength table | cloud | medium | 5 h | yes | `vextrus/measurement/tests/acceptance/m1_07/` | — |
| M1-08 `live_model` spine | cloud | high (row policies) | 4.5 h | yes | `vextrus/live_model/tests/acceptance/m1_08/` | — |
| M1-10a Family contract, registry, chain run, export v2 | cloud+local | medium | 4 h | yes | `engine/families/tests/acceptance/m1_10a/` | merges after 21c |
| M1-12 `drawings`: profiles, office, scales, hand-drawn | cloud | medium | 4 h | yes | `vextrus/drawings/tests/acceptance/m1_12/` | — |
| M1-13 Jev nodes and spot-check harness | cloud | medium | 2.5 h | yes | `vextrus/platform/tests/acceptance/m1_13/` | — |
| M1-14 `rates` | cloud | medium | 4.5 h | yes | `vextrus/rates/tests/acceptance/m1_14/` | merges after M1-07 (allowlist) |
| M1-44 `projects`: Gross Floor Area, Display Units | cloud | medium | 2 h | yes | `vextrus/projects/tests/acceptance/m1_44/` | — |
| M1-47 Platform walls: Developer header, refusals, malformed input | cloud | high (security wall) | 3 h | yes | `vextrus/platform/tests/acceptance/m1_47/`, `web/src/acceptance/m1_47/` | — |
| M1-29 Guarded repair, four bugs, literal guard, harness namespace (#77) | local | high (hostile input) | 3.5 h | yes | `engine/geometry/tests/acceptance/m1_29/` | — |
| M1-02 Sample Project element key | local, no PR | high (reading) | 3 h + owner 1.5 h | no (owner confirms) | — | the owner's answer to question 2 |
| M1-05 Edison counts per family per storey | local, no PR | high (reading) | 3 h + owner 1.5 h | no (owner confirms) | — | — |
| M1-24 `docs/design/m1-screens.md` | local | medium | 3 h | no (`ux-critic` and `qs-critic` read it) | — | — |

**Local sessions: at most six at once** (`free -g`). Wave 1 alone fills them (M1-05's two analysts, M1-06,
M1-29, M1-24, M1-10a's posting run), so M0's local leftovers (26, the scored loops, 24's preparation) share
them: M0's merges first, then M1-05 and M1-29 (the critical path), then the rest. Posting runs one at a
time under the lock.

From session 08's old order, for session 09: rule each writer's "not pinned" list within minutes; ask the
owner for M1-06's run (the Held-out instance, 1 h) and put the key confirmations (M1-02, M1-05; 1.5 h each)
on the owner's day as soon as the drafts exist; the custody re-run follows M1-01's merge and both keys'
confirmation, batched; wave 2 as edges clear (M1.md "Wave 2": M1-09 after M1-08; M1-10b after M1-07 and
M1-08, from M1-10a's reviewed head; M1-30 after M1-10a, from M1-29's reviewed head; M1-46 when a cloud slot
frees); adversary rounds on M1.md's surfaces in its order (the scorer and the key fence first).
