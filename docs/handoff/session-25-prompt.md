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

## The owner's rulings of 13 Oct (an exploring session beside session 24; they bind session 25)
The owner ran a read-only session beside session 24, measured why M0 dragged, put every claim through a refuter, and
ruled on its questions. The numbers and their sources: `docs/research/2026-10-13-why-m0-dragged.md`; the raw tables stay local under `.private/work/s24-explore/`.

**Read this first: where this brief's sections meet** (a cold read on Opus `medium` found these):
- **The owner's start prompt may answer the opening questions** (the budget, Q10's numbers, the trust-boundary bar, the mod clock).
  Ask only what it leaves open. Run `stamp start` once the budget is known.
- **"Cut" means carried over, not dropped.** #724 (W1) is in the landing order. #701 is F3. #700 continues as M1-24.
- **#711's round 3 is ADR 0041 item 5's exception** (a false statement a QS meets), not a third ordinary round.
- **#700:** M1-24 continues on #700 while its review loop has rounds left; otherwise it gets a fresh PR from ae830596.
  Q15's act is added to `m1-screens.md` either way.
- **#723's design gate** was posted on d978bfb0 at 13 Oct 00:21Z. Post it again only if the head moves.
- **The 30 % cap counts builder hours.** The factory tickets are F1 to F4 plus F5, which adds `measures.py`'s new measures.
  - The model-map lint, the mod clock, and `maxTurns`/`autoCompactWindow` are filed as issues. They are built only if F1 to F5
    land with time left.
  - The Haiku pilot runs on look-ups and needs no ticket.
- **Q10's gates are M1's finish line,** not session 25's. Session 25's "walk now" stays `scripts.walk.ready` exiting 0 (CLAUDE.md law).
- **The quiet machine:** during a G1 walk, no posting run and no local test suite starts. Builders may keep editing, and their
  verify waits.
- **The Q14 pilot's wave** is the first wave launched after F1 merges. Its "before" baseline is sessions 18 to 24 re-scored under the new bar (F2).
- **The e2e fix asserts the counter by its message code** if the DOM carries one. Otherwise it uses the current English from `en.po`.
- **A1 and A7** are session 24's tickets (FL8 #706→#723 and the question cap #710, merged).
- **#687's "setback" item** is an owner question. Ask it after M1-02.

| Q | Ruling (the owner, 13 Oct 2026) |
|---|---|
| Q10 | "Production grade" is measurable gates, not a feeling: the table below. The owner rules its numbers at the start. |
| Q11 | Two model pilots: Haiku 5.5 for look-ups and mechanical steps, measured against Sonnet `low` on 20 look-ups; Fable 5.1 only as an escalation when the same ticket fails the same class twice. Each result goes to `lessons.md` before any role moves. |
| Q13 | The bar: a finding blocks when it scores 75 or more, or when a QS or MD would hit it (user-facing). An edge-case or rule-only finding scoring 50–74 is filed as an issue that still owes its committed check. The bar lives in ADR 0041 item 7 (amended 7 Oct), CLAUDE.md's "Every serious finding" line and the ledger's verdict; F2 changes all three together. Open at the start: does a hostile-input finding of 50–74 on a trust boundary (a tenant wall, a parser of hostile input, a gate, a ledger: `builder.md`'s list) still block? Recommended: yes, so Q13 relaxes edge findings only away from trust boundaries. |
| Q14 | A pilot of `review self` on one wave: before READY, the builder runs review.py's two lenses on its own diff, with no ledger and no post. It is measured by round-1 PASS before and after. |
| Q15 | M1 gains a pick-to-add act: a QS adds an Element the reader missed by picking it on the sheet. |
| Q16 | The bar-bending schedule beyond columns, editable Rule Sets and Rebar Ratios, and Excel/PDF stay where the plans put them (M2–M4); M2's grill revisits them. |
| Q17 | The factory takes at most about 30 % of session 25's time, and each factory change names the measured cost it removes. M1 wave 0 runs beside the M0 close. |
| Q18 | The orchestrator stays Opus 5.5 `medium` (`scripts/factory/orchestrator.sh:41`), whatever the owner's own default effort; builders, critics and refuters keep their mapped levels. |

## What is broken (each verified, and none in the lists above)
1. **The served product has never passed its end-to-end test.** `e2e.yml` failed 129 times on main (2 cancelled) and has 0 passes in its last
   300 runs on any branch. `web/e2e/acceptance/t22/smoke.spec.ts:62` waits for "Confirmed 0 / 3", which the screen no longer says
   (`web/src/takeoff/locales/en.po:504`: "{n} / {total} settled"). Nobody owned the red run. Fix it first, then count the five green runs
   on main that make it required on PRs (`e2e.yml:11-12`).
2. **A missed Element is unpriced.** M1 has no act to add an Element the reader missed, and closing a step replaces the allowance with the
   measured figure (`docs/specs/M1.md:1001-1002`, story 99), so every miss silently leaves the BOQ. Q15's act fixes it (spec text below).
3. **The guard fails open.** No hook sets `onFailure: "block"` (Claude Code 2.1.295+), and `guard.mjs` fails closed only for its push and
   GitHub-write rules (`:1696-1714`): a crash or a 10 s timeout lets every other refused act through. It also matches words, not acts:
   the status rule refuses a read-only query of a commit's checks, and the privilege rule refuses a note that merely names a root command
   (`:1440-1458`, reproduced).
4. **`docs/design/m1-screens.md:425` on main still prices cement at 3 % wastage** ("Cement 411 bags (398.20 net + 3 % wastage)"); the
   owner's verified default is 2 % (`docs/specs/bd-defaults.md:78`). `docs/plans/M1.md`'s example is fixed on main (407 bags);
   #700 (ae830596) drops the screens line.

## Why M0 took 24 sessions (measured; numbers from `m0-numbers/`, checked by refuters)
- **Review rarely passes the first time, and fixes make new faults.** Round-1 PASS since session 18: 17 of 53 (32 %); on product code
  4 of 27. In a stratified sample of 30 findings scored 50 or more, 24 were real behaviour defects, 5 broke only the factory's own rules, 1 was a
  spec gap, and 29 looked catchable before the PR (one reader's judgment; 12 rows read in code; the shares are not population rates). 12 of 16 round-2 and round-3 findings came from the previous fix.
- **The cap closes PRs, and the work comes back.** 71 of 359 PRs (19.8 %) landed through a second PR: 144k lines written, reviewed
  and CI'd twice. Work truly lost is about 5 % of all lines.
- **The factory displaced the product in sessions 12–14.** Product lines per session fell from 17.9k (S3–S11) to 1.4k (S12–S14), with
  the factory at 55–72 % of merged lines; S15–S24 recovered to 5.5k a session. Merges per day fell from 20.4 to 7.4 after 7 Oct.
- **The machine.** The real-drawing lock took 147–212 minutes a session, 22–59 % of each session's budget. The governor counts idle
  builders as live (by design, `factory.md:308`). Contention failed a G1 timing check (walk 1, `act_p95_during_read`).
- **G1's critics find BLOCKS late each session** (14, then 7, then 4), after the PRs they would have changed.
- The design held: none of a product review's nine "change the model before M1" claims survived a refuter as cheap-now (ADR 0015, 0036,
  0037 already cover them; multi-Building sheets stay M4's open question). Its one confirmed gap, adding a missed Element, became Q15.

## Session 25's order (amends "First 15 minutes"; steps 1–3 there stand)
1. **0:00 to 0:20.** The steps 1–3 above. Then ask the owner, one at a time, each with its recommendation: the budget; Q10's numbers (the table below); whether a trust-boundary finding of 50–74 still blocks (Q13's row; recommended yes); lifting `factory.md:652`'s read-only ruling for the mod clock only (the features table; recommended yes); then session 24's questions. Build nothing that depends on an unanswered one.
2. **0:10, the M0 close (the product's critical path).** Session 24's order stands: #723, #711, #724, C1, C2, C3 fixed, #714, B1, B2. Add the
   e2e fix: `smoke.spec.ts` is an acceptance test, so the acceptance-writer amends it (an `acceptance:` commit; builders never change it),
   asserting the counter by its message code, not its English. Only the first failure is known; what fails after line 62 is unmeasured.
3. **0:30, the factory (at most 30 % of builder hours; Q17).** Five tickets, each with its measured cost:
   - **F1 `review self`** (Q14): `scripts/factory/review_self.py` reuses `lens_command` and `run_lens` (`review.py:748, :912`) on
     `git diff main...HEAD` in the builder's worktree, its own database or no pytest, no ledger; `builder.md` runs it once before READY and on
     each fix's own diff, then re-runs the previous round's attack tests. Cost: A+B ≈ $2.56 and 7 min a run (`review-cost.jsonl`).
   - **F2 the bar** (Q13): each lens tags a finding's class (user-facing, edge, rule-only); the verdict blocks on ≥75, user-facing, or (if the owner confirms) a trust boundary at 50; ADR 0041
     item 7 (and item 5's late-finding rule), CLAUDE.md's "Every serious finding" line and the ledger's verdict amended together; a check that every filed 50–74 issue names its owed check. **Re-score sessions 18–24's round-1 verdicts under
     the new bar first:** that is the Q14 pilot's baseline, or the pilot mixes the two changes.
   - **F3 #701** (A6 factory quick wins: the watcher, rdlock, launch), reviewed fresh from round 1.
   - **F4 the guard**: `onFailure: "block"` on the PreToolUse guard only (prove first on one throwaway cloud launch that the cloud CLI keeps
     the settings file and the selftest still refuses a force push). Not on the Stop and SubagentStop gates until `hooks.md` shows a blocked
     Stop cannot loop a builder; allow cases in `guard.test.mjs` for read-only queries and notes that name a word.
   - **F5 the measures** (`scripts/factory/measures.py`): round-1 PASS by area, rounds per ticket including closed PRs, minutes from READY
     to review start, the factory's share of builder hours, and the e2e pass streak on main (the loop section below).
   - File the rest as issues, each with its owed check: the governor's idle slots, the sweep keep rule, generated catalogues that deadlock stacked
     PRs, symlinked node_modules in verify worktrees, `measures.py`'s `rounds_per_ticket` and READY-to-review minutes.
4. **0:45, M1 wave 0 beside it, within O2** (`docs/plans/M1.md`: docs and owner-time tickets now; M1-00's freeze and code only after the
   owner's M0 walk). The "M1 wave 0" section below stands; add to it: M1-24's fresh PR from #700 (ae830596) carries Q15's act in
   `m1-screens.md`; and one spec PR:
   - Already on main (the exploring session's last PR, 13 Oct): `docs/plans/M1.md`'s cement example at 2 % (407 bags), C7's nullable
     concrete fields, and `docs/specs/M1.md`'s grid-line relabel rule. Still open: if #700 has not merged first,
     `docs/design/m1-screens.md:425`'s words to "Cement 407 bags (398.20 net + 2 % wastage)", so the BOQ and the screen agree.
   - Q15's act in `docs/specs/M1.md`: **Add an Element the reader missed**: the QS picks the entity on the sheet (the buffers carry entity
     handles, `engine/render/buffers.py:27-30`); the act records a Confirmation and a Trace anchored on that entity (its cause's name is
     the ticket's to choose, in `CONTEXT.md` first); ADR 0015's position matching applies to it on the next read; the step's n/N counts it;
     undo removes it. The acceptance-writer pins: pick, add, undo, re-read keeps it, a second tenant cannot see it.
   - Step 1's fold onto M1-11/M1-18a's generic layer: a ticket, merged only after the owner's M0 walk.
5. **By about 2:30, an integration head.** Walk it with G1's script layer under a quiet machine (no posting runs, no suites), then the agent
   layer by 3:30, so BLOCKS arrive while there is time to act on them. G1 #2 and #3 follow on the final main.

## Production grade (Q10; thresholds from the repo's own specs, the owner rules them at the start)
| Gate | Threshold | Measured by | Today |
|---|---|---|---|
| The owner's walk | signed, on real drawings | the owner | law |
| G1 on main's product code | two PASS: 16/16 script checks; agent layer 0 BLOCKS, 0 open misleading | `scripts/walk/run.py`, `/real-set-walk` | 0 PASS in 10 walks |
| e2e on the served product | every Takeoff Step's keyboard flow (`M1.md:1199-1202`) green on 5 main runs, then required on PRs | Playwright, `e2e.yml` | 0 of 131 |
| Acts during a read | p95 ≤ 1,000 ms, max ≤ 3,000 ms, 0 failed acts | `verdict.py:281-291` | 674–980 ms with 0 Elements |
| Sheet viewer | cached open ≤ 1.5 s; pan/zoom p95 ≤ 16.7 ms on the densest sheet | `?perf` (ADR 0022) | readout not built |
| 3D | interactive ≤ 1.5 s warm, ≤ 3 s cold; pick ≤ 2 ms | `?bench` (`m0-measurements.md:235-237`) | M1-25, M1-43 |
| Accessibility | axe 0 serious or critical on every seeded route at 1440 and 1280; Lighthouse ≥ 95 | `@axe-core/playwright` in e2e | Lighthouse 95–97 (#723); axe not installed |
| Keyboard | every primary act reachable by keys on every route; 0 dead ends | a route sweep | not built (`factory.md:694`) |
| Design gate | 18/18 items PASS or not applicable | ux-critic, `post-status` | items 1–11 exist |
| Errors | 0 API 5xx, 0 uncaught console errors per walk and e2e run | collectors in both | not built |
| Figures | RCC ±1 %, formwork ±3 % against the Hand Takeoff; the Held-out Set scored blind | `tools/scorer` (`M1.md:1438-1447`) | M1-01 |

## The self-improving loop and Claude Code's newest features (each names the cost it removes; Q17)
The loop is already law: every serious finding leaves a committed check, and each session's measures open the next brief. Session 25
closes its gaps:
- **Measure what this diagnosis had to dig for.** `measures.py` gains round-1 PASS by area, rounds per ticket (closed PRs included;
  `rounds_per_pr` counts merged PRs only), minutes from READY to review start, the factory's share of builder hours, and the e2e
  pass streak on main. These lead every brief from session 26 on.
- **Refute before steering** (bound below), and record each model pilot's result in `lessons.md` (Q11).

Adopt in this order, each only with its cost named (Claude Code 2.1.296 is installed):
| Feature (version) | The cost it removes | Where |
|---|---|---|
| Hook `onFailure: "block"` (2.1.295) | the guard fails open on a crash or timeout | F4: the PreToolUse guard only, after one throwaway cloud launch |
| A model-map lint; agent `effort` frontmatter (2.1.267) and the Agent tool's `effort` (2.1.292) | `review-pr.js` ran its adversary and refuter on Opus against the map | `tools/lint`: every `.claude/agents/*.md` and workflow `agent()` names a model and effort from CLAUDE.md's map |
| The factory mod's clock (`$.clock.every`; mods on by default since 2.1.287) waking the orchestrator from the watcher's events | Monitor's 30-minute deadline (2.1.271); A7 sat BLOCKED 55 minutes unseen | `tools/mod/vextrus-factory`; it lifts `factory.md:652`'s read-only ruling for this one hook: ask the owner at the start (recommended: yes) |
| `/model` and `/effort` sent from `claude agents` to a busy background builder (2.1.290) | relaunching a builder to change its model | the Q11 Fable escalation: switch the stuck builder, keep its context |
| `maxTurns` and `autoCompactWindow` (2.1.296) in long agents' frontmatter | runaway or over-compacted hours-long analyst and reviewer runs (unmeasured: measure first) | `drawing-analyst.md`, `pr-reviewer.md` |
| Haiku 5.5 (2.1.293) | Sonnet's cost on look-ups | the Q11 pilot |

Not adopted: the guard as a mod (cloud sessions install no repo or user plugins; the shell guard in `.claude/settings.json` stays the
wall); dynamic workflows for routine work (CLAUDE.md; the owner's Q12 allowed one for the exploring session only).

## Bound from the exploring session
- A claim that changes a plan, a brief or a scope gets one `refuter` before it steers. A depth review on Opus `high` had none of its nine
  "cheap now" claims survive a refuter; the exploring session's own "verified" was once half-checked.
- Verify a figure against its raw source and name its window: round-1 PASS was quoted as 24 %, 13–24 % and 32 %, and each was right only for its own window.
- A command that changes the machine names its device: `swapon -a` reads `/etc/fstab`, which lists no swap on this WSL, so swap stayed off for
  about 47 minutes; the swap disk is `/dev/sdc`.
- A red required-looking workflow has an owner: the orchestrator reads `gh run list --workflow e2e.yml --branch main --limit 5` at the start of every session.
- The advisor pilot (the owner's Q5) did not run: the exploring session's advisor stayed Opus 5.5 throughout (an `/advisor` change applies
  after `/clear` or `/compact`). Fable 5.1 has no result yet; Q11's escalation pilot is its first.

## Effort and models; laws that do not change
CLAUDE.md's "Effort and models" and Law sections in full. The orchestrator stays Opus 5.5 `medium`, with no workflow
but `real-set-walk`.
