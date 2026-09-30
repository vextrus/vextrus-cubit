# Session 08: close M0, and launch M1's wave 1 in the first 15 minutes

## Starting the session (the owner)
1. **Before the session, if session 07's hand-off asks for it:** the custody re-run (the scorer changed
   with 24g, #143) and the autonomy set-up re-run (107's harness change). The hand-off names each with its
   command; the orchestrator asks again at start if either is still owed.
2. Then: `claude --model claude-opus-5-5 --effort medium`, check `/status` (Opus 5.5, medium, auto), and
   say: "Read docs/handoff/session-08-prompt.md and run it."

---

You are the orchestrator of session 08, at **medium** effort. You own three results:
1. **M0 closed:** its remaining merges first (table below), then the owner's walk steps handed over.
2. **M1's wave 1 launched in the first 15 minutes** and built through the loop: every wave-1 ticket merged,
   or at a reviewed head with what is left written down.
3. **The owner's element-key confirmation asked for in this session** (it is on M1's critical path from
   about hour 12), and session 09's brief written.

**You run everything yourself** (ADR 0041, the `orchestrate-wave` skill). The owner is not waiting to
approve anything but the steps only they can take (custody re-runs, the Held-out instance, key
confirmation, spending, the walk). **After each event take the next step in the same turn; never stop to
summarise or offer to wait.** The fastest safe path, not the fastest path.

**Read first (in this order, no more):** this brief; `docs/plans/M1.md` sections "What is broken or
unmeasured before the first ticket", "What waits on M0's last tickets", "Reused from M0: the loop",
"The rolling order (session 08 onward)" and "Wave 1"; session 07's hand-off state
(`.private/work/session-07/STATE.md`, the last block). Read each contract section (C1–C18) only when you
write the prompt of a ticket that names it.

## The owner's rulings (verbatim; #45 and the session STATE files hold each in full)
Session 06 (29 Sep 2026):
> "Keep it up and keep pushing until we completed all issues on M0 and have the solid production grade
> foundation of our product by achieving the highest quality completing M0. I suggest you to utilize some
> Sonnet 5.5 agents for adversary, skeptic role type for attacking features that are merged or partially
> merged to get to know the weak point so that we can keep improving, fixing to reach our destination."

> "Finish up those which you can." / (for session 07) "bigger responsibilities of finishing off M0 with
> production quality at any cost in shortest time and get ready us for starting working on M1 from
> session 8."

> "For temporary please make our repo public so that we don't have to deal with CI runtime for now, I've a
> card issue which I'll resolve and pay soon" — **the repository is public** (ADR 0024 set aside until the
> owner fixes billing and says to make it private again). Write every commit, issue and PR as public.

> Keys: "I have reviewed keys-draft/review/READ-FIRST.md and you are right on these points … it was good
> as far I saw though I couldn't get the chance to go through all of them." The keys are in custody.

Session 07's rulings from the owner (30 Sep 2026; each the option he chose, quoted):
- The real-drawing check's switch (21c): "Merge 21c, keep harness default (Recommended)": the harness stays
  the check's default until the job's export fills conflicts, Checks, the register, render F1 and the font
  and PDF reports (ticket 21d).
- General-notes files: "Add a 'General' Discipline (Recommended)" (a Market library row; an M0 fix ticket).
- The Answer Keys' sheet storeys: "Keep the ruling; correct the keys (Recommended)" (pile, pile cap and
  tie-beam levels are storeys) and "The title's words; content storeys go on views (Recommended)". The keys
  are corrected by a key-user step the owner runs (prepare it; ask once).
- M1: the eleven rulings in docs/plans/M1.md "The owner's rulings" (gate mode: amend ADR 0026; Sample keys
  by reduction; Held-out from a third office by S10; Hand Takeoffs by the team engineer after the Rule Set;
  **licensing: "Commit the full tables"**; laps 40d compression in columns, 62d/77d tension; shutter and props
  "Ask per project"; a read-only bar-bending schedule in M1; no Excel/PDF export in M1; pile Rebar by ratio
  in M1; Step 2 Building-level).

Still in force: autonomy (you push, open PRs, post gates and merge after the loop); at most two fix rounds
(a third only for a security hole ≥ 75 or a crash or false statement a QS meets); every finding ≥ 50 or of
a repeated class leaves a committed check; acceptance tests first by a separate agent; elapsed/budget in
every message to a builder; Opus 5.5 medium by default, high for reading drawings, hostile input and
security walls; `pr-reviewer` and `refuter` high; Sonnet 5.5 for light work and **adversary rounds** (its
findings ≥ 50 re-run by an Opus refuter before you act); account B; the Answer Keys fenced (only the
scorer reads them).

## The time budget and the clocks
**8 hours** from your first launch. Write `.private/work/session-08/STATE.md` first, with the clock start
and these limits, all from `date -u`:
- **0:00–0:15:** wave 1's acceptance writers launched, all at once (below), and M0's carried tickets
  resumed or relaunched.
- **No new M0 launches after 3 h** (M0's leftovers do not crowd M1's wave; what is still open then is
  written into session 09's brief with its state).
- **No new launches of any kind after 7 h;** at 8 h the running rounds finish and you write the hand-off.
- Per ticket: the budget in "The rolling order" (M1) or M0.md's table (M0), from its acceptance-writer's
  launch (or your first message to a carried-over builder) to merge.
State both clocks, from `date`, in every message to a builder.

## M0 at session 07's close
Verify with `git log origin/main` and `gh pr list`. Merged in session 07: 24g (#143), 122 (#141), nrif
(#144), 136 seed (#145), loop-storeys (#146), 107 harness (#147), loop-views (#148), 24 cap and memory words
(#153).

| Ticket | Branch / PR | State | What is left |
|---|---|---|---|
| 21c Proposals, Questions, Coverage | PR #152, branch `t21c` at 19fa1919 (= builder head c0ed0ada + main merged by the orchestrator, 24's `files.py` conflict resolved; takeoff + drawings 563 passed); cloud builder session_014HT3hdV9cvxQ2TXgd3xYqG | **three rounds done** (round 3 an exception: a QS dead end); words gate PASSED at 26c0c3f6 | **not merged.** Round 3's re-check (`.private/work/session-07/21c/review/recheck-3/`): (75) `answer()` with `keep_open` on a Question withdrawn by a standing exclusion overwrites `withdrawn_by`, so "Confirm back in" confirms a Discipline-less or unnumbered sheet again (keep `withdrawn_by` in its own field or refuse keep_open on a withdrawn Question; test exclude → keep_open → confirm = 409, and undo reopens); (50) a left-out sheet's kind answer is lost on confirm back in; (50, with 22) 22's queue shows only open/kept_open Questions, so a 409 names a Question the screen never shows. A fresh builder (cloud, high) from `t21c`, then review, the harness posting run, merge **before 22**; then `keys-custody.sh` (it changes `scripts/real_drawings/`) |
| 22 Step 1 screen | branch `claude/step1-screen-fixes-fxi25m` at 24fd0794 (from `t22`); cloud builder session_01HtUFHwchefECCoDV9fWuSw | three rounds done (the third an exception); design walk 4: PASSED 2–11, FAILED 1 (M21) | **not merged.** Round 3's re-check (`.private/work/session-07/22/review/recheck-3/`): (75) the new undo test "undoes nothing when the act it waited for was refused outright" fails 4/4 on this machine (the count text changes before `refresh()` ends: wait for the act to be accepted again, not the text); (75) M21 breaks on a long file name (the name spills past its cell, the reason gets 0 px: middle-truncate the name with a tooltip, keep a minimum for the reason, add a long name to the test); (50) Enter dropped while busy + Ctrl Z undoes the previous act (say "busy", or make Ctrl Z do nothing while blocked); M20 (the revision cloud) cut. Also: answering Questions on the screen (26's B1) and showing Questions withdrawn by an exclusion. A fresh builder from its branch head, merged with main and 21c (keep 22's `_agreeing` standing line, 21c's `_named`; fields additive), a design walk 5, merge after 21c |
| 26 walk | report kept locally (`.private/work/session-07/26/walk.md`) | **walked** on 21c + 22 + loop-views, 30 Sep | its 14 fix tickets (below) |
| 21d (new) | branch `t21d` to create from 21c's merge | not started | the job as the check's default once its export is full (conflicts, Checks, register, render F1, font and PDF reports); the seed replayed through the real job (a finder-readable synthetic KR-01); acceptance tests kept in `.private/work/session-07/21c/t21d-files/` (move them in with an `acceptance:` commit) |
| seed sheets | #150 | open | KR-01's synthetic sheets look nearly empty (blocks a demo) |

**M0's fix wave (from 26's walk) comes first in session 08,** each with acceptance tests first (26's report
gives each one's acceptance): **B1** answer Questions on the Step 1 screen (every option key worded); **B2**
wire Plot matching into the read and make its words honest (expect all 208 PDF pages matched); **B3** every
Structural view accounted (sections, schedules, details to their Steps; a QS act to place a view); **B4** the
"General" Discipline (the owner's ruling); then W1 one paper scale for views and buffers, W5 same-number
conflicts per Discipline and retired on re-read, W6 no phantom sheets (Edison 6 today), W2 Next/Previous
once through, W3/W4/W9 words (one bundle, a words gate), W7 read-anyway raises Questions, W8 confirm refuses
one-source sheets in a multi-sheet act. Launch B1–B4's writers in the first 15 minutes with M1's wave 1.
After them: the owner's walk steps (docs/specs/M0.md, Finish line).

Also carried: the owner's custody re-runs (`keys-custody.sh` after 24g, 107 and 21c; `autonomy-setup.sh`
after 107; ask once if session 07's close did not get them done); #140 and #149 (`before-beta`); #151 (after
the cap on #148).

## The scored baseline at session 07's close (main 81981915, run 20260930T160458Z-819819151220-4b91, 24g's scorer installed)
| Set | sheets all right | views joined | view titles | view subjects | storeys | number | title | Discipline | date |
|---|---|---|---|---|---|---|---|---|---|
| Edison | 38 / 217 | 332 / 739 | 282 / 332 | 43 / 75 | 185 | 214 | 205 | 202 | 206 |
| Sample Project | 8 / 67 | 197 / 417 | 195 / 197 | 85 / 91 | 56 | 67 | 67 | 67 | 67 |

The diagnostic (counts only) aims the next scored loop: on Edison, 86 unjoined key views have a same-kind export view at IoU 0.5–0.8 and 55 at 0.2–0.5 (sections 46 + 21, plans 26 + 6): **the boxes are near but not tight enough** — the first view loop is box extent (what a view's box takes in: its title, dimensions, grid bubbles), judged per kind. 65 have no export view of their kind, 33 are another kind at IoU ≥ 0.8 (details 26: a kind rule). Aligning frame corners joins nothing (0): not a frame problem. Subjects: 257 key phrases fall outside the engine's 14 words (architectural and electrical views have none: a vocabulary ruling for the owner before a subject loop). Sheet level is near its ceiling except storeys (32 Edison, 11 Sample; the key corrections the owner ruled come first).

## The order
1. **First 15 minutes, in parallel:**
   - the acceptance writers for every wave-1 ticket with tests (the table below), each in its own
     worktree on its branch `m1-NN`, with its unique scratch folder under `.private/work/session-08/<ticket>/`;
   - the local wave-1 tickets with no tests (M1-05's two analysts, M1-24; M1-02 if the owner has answered
     question 2 with the reduction route);
   - M0's carried builders (message or relaunch from their committed heads).
2. **Builders as their tests land** (rule each writer's "not pinned" list first, within minutes).
3. **The owner:** ask for M1-06's run (the Held-out instance, 1 h) and put the key confirmations (M1-02,
   M1-05; 1.5 h each) on the owner's day as soon as the drafts exist. The custody re-run follows M1-01's
   merge and both keys' confirmation, batched with any other change to `tools/scorer/` or
   `scripts/real_drawings/`.
4. **Wave 2 as edges clear** (M1.md "Wave 2"): M1-09 after M1-08; M1-10b after M1-07 and M1-08 (from
   M1-10a's reviewed head); M1-30 after M1-10a (from M1-29's reviewed head); M1-46 when a cloud slot frees.
   These three are the forecast's S08 finish (M1.md "Sessions").
5. **Adversary rounds** after each merge wave, on M1.md's surfaces in its order (the scorer and the key
   fence first).
6. **Session 09's brief** from 7 h, in M1.md's rolling order.

## M1's wave 1 (launch list)
The contracts and edges are the plan's, carried by reference: each prompt pastes its ticket's entry from
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

## The owner's questions still open
Session 07 asked and got answers to all eleven of M1.md's questions and the key-storey questions (see
"Session 07's rulings"). Still open, ask one at a time with your recommendation first:
- The rest of the sheet loop's key-contract questions (`.private/work/session-07/loop-sheet/key-questions.md`;
  general terms only): what a sheet's Discipline is when one file bundles trades (air-conditioning sheets in
  another trade's file), and fields where the key disagrees with the only value the drawing shows (a General
  Note's date).
- The keys' correction itself (the two storey rulings): prepare the key-user step and ask the owner to run it.

## Operating rules (sessions 06 and 07's lessons, each paid for; the checks are committed where named)
**Launching and messaging**
- **Launch `scripts.cloud.launch` from the ticket branch's own worktree,** on that branch, pushed. Run from
  the main checkout it clones main (session 07's first 22 launch; the stray session's branch was ignored
  and the owner deletes the session in the web UI). Give the watcher an ignore list for strays.
- **Message a cloud builder** with `claude --cloud <session_id> -p "<message>" < /dev/null` (the
  redirect stops it waiting on input). **Message an idle local builder with SendMessage**; never
  `claude --bg --resume <short id>` (it opens a picker and blocks). A stopped one: `claude --bg --resume
  <full session id> "<step>"` from its worktree.
- **Fix rounds go through files:** write each round to `.private/work/session-08/<ticket>/fix-N.md`, then
  send it (cloud: the file's text, since a cloud builder cannot read `.private/`; local: its path). One
  message per round; a later finding in the same round goes as an addendum only while the round runs.
- **The guard refuses any shell command whose text contains the privilege tool's name,** even inside a
  prompt or a heredoc. Write such prompts (M1-06's, any custody step) with the Write tool and pass the
  file.

**Watching**
- **Watch cloud builders by their `claude/<slug>` branch** (they never push the ticket's branch): copy
  session 07's watcher (`.private/work/session-07/watch.sh`) into session 08's folder and fix its paths.
  Mind its quoting: the inline Python sits in double quotes, so use only single quotes inside it; try the
  copy once on a known READY head before trusting it. A READY head present at the watcher's start still
  fires. Local builders by state transitions (names `s8-*`).

**Scoring**
- **A scored run needs the branch pushed by you and frozen until the run ends:** builders never push, and
  the run refuses a branch GitHub does not hold or a head that moved (loop-views, 16:24). Tell the builder
  not to commit while its head is scored.
- **The scorer's view contract is fixed (24g, #143):** kinds fold `_` to a space and one 3D/perspective
  kind; a key's subject phrase maps to the first of the engine's 14 subject words it holds (the rest are
  reported as "subjects outside the vocabulary: n"); the join (kind + IoU ≥ 0.8, paper-scaled, no shift)
  is unchanged. Its **diagnostic** (Development Sets only, counts only) gives each unjoined view's cause and
  how many would join with the frame corners aligned: read it before any views loop.
- **Score a real export the moment the scorer exists,** before any loop depends on it (the 0/284 join).
- **Every change to `scripts/real_drawings/` or `tools/scorer/` on main needs the owner's custody
  re-run:** batch such PRs, and ask once, right after the last one merges.

**Tests and builders**
- **Type test fixtures as the real data holds them** (storeys were a list; the helper typed a string).
- **Tests force the failure they test** (monkeypatch), never count on a build's stack or timing.
- **Acceptance writers run their tests against a throwaway implementation before committing,** and run
  every file they commit. Their "not pinned" lists are ruled before the builder starts. When a builder is
  BLOCKED on a test with proof, amend it yourself or through the writer (`acceptance:` commit) within
  minutes (21c's block in session 07 was ruled in one step: tests moved, counts re-pinned, option chosen).
- **Unique scratch folders per agent** (two drafting agents collided on `scratch-structural`).
- **CI differs from this machine** (no shellcheck here, a different Python build, a slower browser). A
  CI-only failure goes to a Sonnet debugger at once with the job's log; a failure that passes on a re-run
  twice is a flake: file it.
- `post-status` needs the literal full SHA on a line of its own. `gh` here is 2.45: use `gh api` for what
  newer flags do.
- Serve design walks yourself and pass the demo password as a file path, never the value; the seed refuses
  a second run (#129): `flush` then `seed_demo`.

**Power cuts**
- Session 07 lost 15 hours to a power cut and nothing else, because every event was in STATE.md. **Stamp
  every event from `date -u`, never from memory** (session 07 corrected estimated times once). On resume:
  read STATE.md, compute the time used before the cut, set a new clock with what is left, record it, then
  resume or relaunch each builder and review from its last committed head. Background agents keep a
  `NOTES.txt` and are told how to resume from it.

## Done means
1. M0's remaining tickets merged, or each one's state and what is left written into session 09's brief;
   M0's walk steps with the owner.
2. Every wave-1 ticket with tests merged through the loop, or at a reviewed head with what is left; every
   finding ≥ 50 with its committed check.
3. M1-05's counts drafted and put to the owner; M1-02 drafted by its route; M1-06 run by the owner or
   ready for the owner's run; M1-24 read by both critics.
4. M1-09, M1-10b and M1-30 started (their edges allowing), or the edge that stopped each named.
5. The owner's questions asked one at a time, each answer quoted; the custody re-run asked once, batched.
6. Adversary rounds on every merge wave with no confirmed finding ≥ 50 left open.
7. #45 and the M1 milestone issue's measures (counts only); lessons with their checks or listed as debts;
   session 09's brief written; the hand-off PR merged.

## Law in force
Secrets never printed or written; real drawings stay in `.private/` (the repo is public: no drawing text,
no key value, no client-identifying content beyond what is already there); the keys are read only by the
scorer; OpenConstructionERP never copied; no AGPL library in the product (never PyMuPDF, even in scratch:
use pypdfium2 or pdftoppm); the product's word is **Rebar**; no market literal; every visible string
through a catalogue; logical CSS only.
