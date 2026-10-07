# Session 16: the first M1 slice, shown to the founders by 12:30Z

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free).
2. Stop every finished background session: `claude agents --json`, then `claude stop <id>` for each idle one
   (session 15 found killed sessions respawn; `claude stop` retires them).
3. Unset the colour variables in the shell that starts the orchestrator: `unset FORCE_COLOR PY_COLORS CLICOLOR_FORCE`
   (they broke 27 local tests in session 15, #585; S15-FC fixes it in code).
4. Start the orchestrator with `scripts/factory/orchestrator.sh` (Opus 5.5 at `medium`), then say:
   "Read docs/handoff/session-16-prompt.md and run it."
5. Keep the pane open for owner-only steps, each given as an exact `! <command>`. After any PR that changes
   `scripts/real_drawings/`, `tools/scorer/` or `scripts/owner/post-status` lands:
   `! cd ~/vextrus-cubit && git pull && sudo bash scripts/owner/keys-custody.sh` (posting runs refuse until it is run).

---

You are the orchestrator of session 16. **In 3 hours, build the thinnest honest slice of M1 on what M0 has, on the
Edison structural set, and hand the owner a showing script for the founders' meeting at about 12:30Z.** The slice:
storeys and levels, the grid, columns (one Element per column per storey), the columns in 3D, and a Priced BOQ for them
(concrete, formwork, rebar by ratio) on starter Market Prices, with every figure opening its Trace and every other step
a marked allowance. Nothing is faked: what the readers miss shows as n / N and as Questions.

## The owner's rulings (verbatim)
- 7 Oct 07:31Z: "the next session handoff prompt will be much targetted powerful session we'll target to achieve at least
  a sustainable stage of M1 will be build and ready to be present for a walk that I'll present to internal founders team
  of our Vextrus today … within next 3 hours finishing those tickets in parallel the next session can deliver a
  presentable walk of our system to our internal meeting today … I'll finally walk after the next session minimum
  presentable walkthrough is delivered before today's meeting."
- 7 Oct 07:42Z, on whether the showing is a G1-gated walk: "A showing, not a walk (Recommended)". The showing script says
  G1's open failures and the cut list aloud; G1 stays the gate for the owner's own milestone walk.
- 7 Oct 07:43Z, on the train head: "Yes, the reviewed train head (Recommended)". The showing may run on the reviewed
  `s16-m1` head served locally, labelled "not on main"; the train lands through the normal gates when its posting run passes.
- Standing: the 90 % reading bar is M1's goal, not M0's (5 Oct, Q10). An answer that confirmed sheets is never undone
  (m0-screens §6, #156). Questions per Discipline at most 3; bulk share at least 0.8 (Q5, Q9).

## Finish line (checked by its command; evidence where it says)
1. The train `s16-m1` holds the slice, every ticket reviewed (`scripts.factory.review run <PR> --round <n>`, at most two
   rounds) and merged into it; one PR `s16-m1` → main is open with its integrated review recorded.
2. The orchestrator ran the showing script below on the train head (or main if it landed) on the demo project, by keyboard,
   and wrote what each step showed, n / N included: `.private/work/session-16/showing.md`.
3. The owner has the showing script with the cut list and G1's open failures, and the exact serve command.
4. The train PR lands on main if its posting run passes in time; if not, its state is written down.
5. `docs/handoff/session-17-prompt.md` is merged (M0's carry-over plus M1's next slice).

## The slice and the showing script (about 12 minutes, the owner)
| # | Screen | Keys | What it shows (and says it is not) |
|---|---|---|---|
| 1 | Projects → Edison → Priced BOQ (`/p/<code>/boq`) | type the gross floor area, Enter | Whole-building ৳ figure, measured share 0 %, every step a hatched allowance line "Vextrus default, Low" |
| 2 | Takeoff → Step 1 | — | Sheet list confirmed before the meeting (said aloud) |
| 3 | Step 3 Storeys and levels (`/takeoff/3`) | review; fix one view's storeys if wrong; accept or type heights; Enter | Storeys low to high; "levels typed, not read" |
| 4 | Step 4 Grid (`/takeoff/4`) | Space opens a view; Enter confirms | Grid lines n / N (N counted by hand), each line's Trace on the sheet |
| 5 | Step 6 Columns (`/takeoff/6`) | groups by band and mark; Enter confirms the agreeing; E types a size, X excludes | One Element per column per storey; "shear walls and core on allowance" |
| 6 | Model (`/p/<code>/model`) | orbit, isolate a storey, click a column | Columns in 3D at their grid points and storey heights; inspector with IFC class, Uniclass reference, Trace |
| 7 | Priced BOQ | expand Columns; click a quantity, then a line | Concrete, formwork, rebar marked "by ratio"; measured share above 0 %; a Measurement Line opens the sheet at the column |
| 8 | Priced BOQ → a rate | click | Rate Analysis lines with their PWD SoR 2022 (Dhaka) page references |
| 9 | Market Prices | edit the rebar price, back to the BOQ | Rates, amounts and allowances move; quantities do not |
| 10 | Close | — | The cut list read aloud |

**Cut, said aloud:** Step 2 notes (mix and grade are Rule Set defaults, shown "default"); level marks and sections; piles and
caps, shear walls, core, beams, slabs (allowance lines); column rebar from the drawing (by ratio instead, against M1's
clause); Material Schedule; Labour Contracts; the metric switch; Drafting Profile storage; Checks beyond "size not read";
viewer tools; Answer Keys and blind scoring; the MD's view; Revisions.

**Cut order when behind** (cut from the top; each cut said aloud): price edit (prices read-only with their page); storey
slabs as planes in 3D; the Rate Analysis popover; Step 3's view placement edit; the size Question (E); Step 4 as its own
screen (grid confirmed inside Step 6); 3D entirely. **Never cut:** the allowance lines and measured share, n / N with N by
hand, every figure's Trace, the "by ratio" mark, the cut list read aloud.

## The train
Every ticket branches from S16-K0's branch (`launch cloud --on-branch s16-k0` / local equivalent) and its PR targets
`s16-m1`, not main. Review each into `s16-m1` (at most two rounds; then simplify or cut). At **T+110 min freeze**: one PR
`s16-m1` → main; one integrated review round (exception `integration` if needed), the design gate on that head, ONE
posting run, merge_ready, land. Content not READY at the freeze is cut, not waited for. If review.py or merge_ready refuses
a non-main base, say so in STATE.md and review the branch heads with the lenses by hand. Contracts are frozen at K0
(`docs/plans/M1.md` C4, C7, C11, C12, C13, C17); a contract change is an acceptance amendment through the orchestrator.

| id | title | owns | blocked by | where | tier / model | budget | finish check |
|---|---|---|---|---|---|---|---|
| S16-K0 | Contracts: family types, API schemas, stub routes | `engine/families/{__init__,types,registry}.py`; `vextrus/{takeoff/schemas/frame.py, live_model/schemas/model.py, boq/schemas/boq.py, rates/schemas/prices.py}`; stub http modules returning 501 | acceptance only | cloud | hard, Opus 5.5 high | 35 | types import; OpenAPI lists every slice endpoint; web schema generation passes; the registry discovers 0 families |
| S16-D | Demo project and hand counts | `.private/work/session-16/demo/` only; a local stack with Edison uploaded and Step 1 structural confirmed through the product | — | local | drawing-analyst, Opus 5.5 high | 60 | Step 1 structural confirmed; N per column-plan view for grid lines and per band for columns counted from the PDFs by hand; each column-plan view's storeys noted right or wrong |
| S16-R1 | Grid reader | `engine/families/grid_line/**` | K0 | local | hard, Opus 5.5 high | 90 | fixtures; on Edison column plans grid n = D's N; frame registered across plans; no literal layer or label in code (ADR 0039) |
| S16-R2 | Column reader (outline, mark, size label, grid ref, band) + `measure.py` (F1, FW2, R2 per C11) | `engine/families/column/**` | K0 | local | hard, Opus 5.5 high | 90 | fixtures; on Edison columns per band n vs D's N with phantoms and misses listed; size = label; C11's worked example exact |
| S16-T1 | Frame read job: families on the confirmed Step 1 views, Proposals and ProposalTraces | `vextrus/takeoff/services/frame_read.py`, `vextrus/takeoff/tasks/frame_read.py` | K0 | cloud | hard, Opus 5.5 high | 90 | idempotent re-run; values in drawing units with verbatim text; a failed family writes a Question, never silence |
| S16-T2 | Steps 3/4/6 API and acts: storey list and view placement, typed levels, confirm, exclude, size answer, n / N; a DomainEvent per act; calls `live_model.services.apply` | `vextrus/takeoff/services/frame_steps.py`, `vextrus/takeoff/http/frame.py`, `vextrus/takeoff/messages/frame.py` | K0 | cloud | hard, Opus 5.5 high | 90 | API tests; every act one DomainEvent; act p95 under 1 s at 500 Proposals; nothing reaches live_model unconfirmed |
| S16-L1 | live_model spine subset: DisciplinePart, ModelVersion, ElementState, ElementTrace, ViewPlacement(+Storey) with RLS; `apply`, `snapshot`, `figures_hash` | `vextrus/live_model/{models.py, migrations/0002_*, services/**}` | K0 | cloud | hard (security wall), Opus 5.5 high | 90 | tenancy walls tested; append-only versions; `apply` the sole writer |
| S16-L2 | Library rows for storey, grid_line, column (IFC class, Attribute Definitions with IFC mapping, Uniclass); primitives + `GET /api/p/{code}/model/primitives` | `vextrus/live_model/{library.py, http/model.py, services/primitives.py}` | L1 (stacked on L1's branch) | cloud | ordinary, Sonnet 5.5 high | 75 | every definition has meaning, face, datum, unit, IFC; volume = b × d × h per column |
| S16-M | measurement subset: RuleSet(+Version), MeasurementRule (F1, FW2, R2 with clauses), BoqItem + BillingUnit for 3 column items, RebarRatio; `measure(building, seq, version)` | `vextrus/measurement/**` | K0 | cloud | ordinary, Sonnet 5.5 high | 80 | C11 worked example; SI decimals, no float; one rounding place |
| S16-RT | rates subset: Resource, MarketPriceSet (PWD SoR 2022 2nd Rev Dhaka, page refs), MarketPrice (empty = "rate not entered"), RateAnalysis(+Line) for the column and allowance items; `working_rate`; price edit with a DomainEvent | `vextrus/rates/**` | K0 | cloud | ordinary, Sonnet 5.5 high | 80 | every starter price cites its page; an empty price never prices ৳0 |
| S16-B | boq on read + Building GFA: strip, items, Measurement Lines, Trace, CostBasis per step with allowance rows, measured share | `vextrus/boq/**`, `vextrus/projects/{models.py, migrations/0004_*, http/settings.py, services/gfa.py}` | K0 | cloud | hard, Opus 5.5 high | 90 | C13 example exact; total = measured + awaiting + allowance, each Element once; a confirmed step drops its allowance whole |
| S16-W1 | Takeoff Steps 3, 4, 6 screens: lists by band and mark, inspector with Trace to the sheet viewer, keys, typed levels | `web/src/takeoff/frame/**`, `web/src/routes/_app/p/$code/takeoff/{3,4,6}.tsx`, its own catalogue | K0 | cloud | ordinary, Sonnet 5.5 high | 90 | m0-screens §8 keyboard walk; tests on the contracts' fixture JSON; ux-critic words |
| S16-W2 | 3D Live Model view: plain three.js, merged per storey, orthographic, orbit, storey isolate, pick → inspector with Trace | `web/src/model/**`, `web/src/routes/_app/p/$code/model.tsx`, `web/package.json` + lock (sole owner) | K0 | local (WebGL) | ordinary, Sonnet 5.5 high | 90 | browser test: volumes and bounds equal primitives; one draw call per storey; keyboard reach |
| S16-W3 | Priced BOQ and Market Prices screens: strip, sections, rows, lines, Trace, Rate Analysis with PWD refs, GFA entry, price edit; nav entries | `web/src/boq/**`, `web/src/rates/**`, `web/src/routes/_app/p/$code/{boq,prices}.tsx`, `web/src/app/routes.tsx` (sole owner) | K0 | cloud | ordinary, Sonnet 5.5 high | 90 | quantity × rate = amount on every row; "rate not entered" shown; money in ৳ with lakh grouping; §8 keys |

`web/src/routeTree.gen.ts` is regenerated at each train merge, never hand-merged; `web/src/api/schema.gen.ts` is CI's.
No two tickets own one file.

**Timeline (T = start):** T+0 acceptance writers for all 14 in parallel (Opus 5.5 high, 15 min); D starts. T+15 launch every
ticket on K0's branch as it stands (R1, R2 merge K0's head when READY). T+40 L2 on L1's branch. T+60-110 reviews into
`s16-m1`; the orchestrator serves the train head with D's project. **T+110 freeze**, train PR, integrated review, design
gate, posting run. T+160-175 land if it passes; the orchestrator runs the showing script. ~12:30Z the owner presents.

## M0 carried in from session 15 (land when the lock and reviews allow; never at the slice's cost)
Session 15 measured M0 (gap map: `.private/work/session-15/gap-map.md`), wrote 29 tickets (#523-#551), closed 37 old M0
issues as superseded and moved 13 to M1, and merged #552, #555, #559, #560, #561, #563, #568, #569, #571, #574 (and those
landed after this brief: check `gh pr list --state merged`). G1's baseline on main (dddce3f8, script layer) failed on both
sets: Questions per Discipline (low_confidence), false continuations, bulk share, storeys, act p95; Edison reads (the
Plumbing DWG) until #567 lands. Read `.private/work/session-15/STATE.md` for each ticket's exact state. In flight at close:
- READY or in review: #565 (S15-E4 views package; element diff 0, posting accepted-if-clean), #567 (S15-I1 ACadSharp:
  the Plumbing DWG agrees; posting with its judged reason), #573 (S15-A5 Plot report), #572 (S15-T2 test health), #564
  (S15-A1, re-verify after a cross-PR fixture amendment), #566 (S15-Q1; lands after #564 and merges main).
- Building, stacked: S15-E2, E3, E6 on s15-e4; S15-Q2 on s15-q1 (local); S15-A3 on s15-a1 (cloud); W9 (X excludes the
  selected view, §6.9), W1 re-submit (one frame-owned connectivity probe), W6 (Projects list), A2 (after #564/#566), S1.
- Not started: S15-W3 (after W9), Q3, E5 (after E4 + Q3), E7 (after Q1 + A5), Q0 (after Q3), A4 (after A3), I2, A6, E8.
- Factory: S15-R3b BLOCKED — review.py's replay recall 60 % / 50 % (was 28 %), below the 90 % gate; the cutover stays held
  (the owner's ruling). Judge each review accordingly. S15-FC fixes the colour-variable test leak (#585).
These are M0's road to G1 PASS twice; session 17 finishes them unless session 16 has spare lock time.

## Lessons from session 15 (binding)
- **The real-drawing lock is the bottleneck:** each engine-path PR needs a 35-60 min posting run; batch through a train.
  A change to `scripts/real_drawings/` needs the owner's keys-custody re-run before any posting run is accepted.
- **Cloud web verify times out under load** (4-core containers): finish BLOCKED with the exact statement and the tree id;
  the orchestrator verifies the same tree locally and commits an empty READY on it.
- **A launch that prints only `record: …` was refused** (#587): read for "OK cloned"/"OK launched". A ticket with no
  `acceptance:` commit needs `--untestable "<reason>"`.
- **Post a web PR's design gate only on the head the lander left up to date, then land at once;** any merge to main in
  between moves the head and voids it.
- **Two rounds, then simplify:** four PRs were closed and re-submitted with one class-closing rule (#553, #554, #556, #558,
  #562, #570); every re-submit passed faster.
- **Stack dependent tickets on their blocker's branch** instead of waiting for main; cross-PR fixture conflicts are fixed by
  an acceptance-writer amendment that passes both ways.
- **Idle background sessions hold local slots:** `claude stop <id>`, not kill.
- **The watcher can go silent:** sweep branch heads by hand every 30 minutes (`scripts.factory.state`).

## Laws that do not change
CLAUDE.md's Law section in full: account A; launches only through `scripts.factory.launch`; time from `date -u`; Monitor
on a log, never pgrep; no "walk now" without a passing G1 on main (the founders' event is a showing, by the owner's ruling);
secrets never printed; nothing from real drawings in git, an issue, a PR or a cloud prompt; OCE is AGPL; cad2data's
converters are never run; the repo is public; statuses only through post-status; explicit paths; no force push, history
rewrite or recursive delete.
