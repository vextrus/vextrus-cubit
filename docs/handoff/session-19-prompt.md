# Session 19: land Q1 and Train A, build Train B, take M0 to G1 PASS twice

## Session 18's measures (`scripts/factory/measures.py`, 9 Oct 06:54Z to 15:44Z; 3 h 47 min of it lost to a power cut)
| measure | value | previous | target |
|---|---|---|---|
| prs_merged | 6 | 8 | |
| merge_p50_min | 40.9 | 115.4 | |
| rounds_per_pr | 2.17 | 1.88 | |
| rdlock_min | 184.4 | 0 (wrong) | |
| verify_p50_min | 4.0 | 16.0 | |
| verify_p90_min | 21.2 | 19.2 | 10 |
| ci_wall_p50_min | 17.3 | 18.7 | 10 |

Missed or wrong:
- **verify p90 21.2 min against 10: missed.** The long runs are full verifies on a loaded machine (three to five
  builders at once, load 10-20) and re-runs after load timeouts. #617 (a port and a test database per worktree)
  landed; #616 (toolchain tests) was cut; #626 (contract-fixtures before openapi-export) is open.
- **CI wall p50 17.3 min against 10: missed, but mostly unmeasured on F1.** F1 (#607, CI parallel) landed at
  09:30Z; most of the session's CI runs came before it. Read the next ten landings' CI wall before judging.
- **rdlock_min now reads correctly** (every run went through `scripts.factory.rdlock run`). Its "regressed" flag
  is the old 0 being false (#620).
- `crosspr_max_min` (target 5) is still not in the table: unmeasured.

## What is broken (read first)
- **Nothing has ever passed G1. Main's G1 script layer at d0c53b48 failed 13 of 16 checks** (Edison 7 of 8,
  Sample 6 of 8; `.private/work/session-18/g1-gap-main.md`). No product PR landed in session 18, so main's product
  is unchanged since that walk.
- **A power cut (11:14Z-15:01Z) killed every builder.** Q1 and Train A stopped before their verifies.
- **Q1 (#628, branch `s18-q1`) is BLOCKED at 559c03f6** only because crosspr's own scratch worktree vanished mid-run
  (FileNotFoundError on `os.chdir` into `.private/work/crosspr/worktree-*`); every other verify check was 0 on tree
  57bb01fc. It holds the fix for review round 2 (55, 50) and the words gate's two musts, unreviewed.
- **Train A (`s18-train-a`, 90f36dfd) is merged but unverified**: main, the Q2+Q3 stack, E2, E3, W6, E6, A2, on Q1
  as of 0299f2fa. No verify, no toolchain tests, no real-drawing run on it yet.
- **Questions per Discipline will still fail after Train A on Edison structural**: Q1+Q2+Q3 measured 5 conflict
  Questions there (3 of them same_title/same_storey over sheets the expectations do not list as true Questions),
  plus 1 convention Question. Kind Questions are at most 3 per Discipline.
- **Bulk-confirmable share cannot pass without the owner's ruling being built** (below): Edison's E/P/G sheets
  and Sample's structural sheets have no second source today.
- **crosspr's scratch worktree vanished mid-run once (Q1)**, most likely because two verifies ran in the one `S18-Q1`
  worktree at once (the orchestrator's and the resumed builder's, which had been renamed
  `pr628-grouped-kind-records` and was not dead). Re-verify once, alone.

## The owner's rulings of session 18 (verbatim; they stand)
- Budget: 12 hours.
- Bulk share, 9 Oct ~15:35Z: "Number run counts (Recommended)": when a Discipline has no drawing list and no PDF,
  an unbroken run of sheet numbers counts as the second source; a sheet in that run with no open Question can be
  confirmed in bulk (`docs/rulings.md`).
- 15:30Z: "if this session can't fulfill the destination we chose then end the session systematically and prepare
  for the next session."
Session 17's rulings (in `docs/handoff/session-18-prompt.md`) still stand, among them: the review bar 75 (50 on
strict paths), now in code (#624); the factory freeze until G1 PASS twice (fixes under 60 min excepted); real-drawing
posting on train heads only, batched; M1's O1-O7.

## Starting the session (the owner)
1. In a WSL terminal: `cd ~/vextrus-cubit && git pull`, then `df -h /` and `free -g` (keep 40 GB free; swap
   under 2 GB). If PostgreSQL 18 was not shut down cleanly, it replays for a few minutes: wait for
   `pg_isready -h 127.0.0.1 -p 5432`.
2. Stop idle background sessions: `claude agents --json`, then `claude stop <id>` for each.
3. `unset FORCE_COLOR PY_COLORS CLICOLOR_FORCE`, then `scripts/factory/orchestrator.sh`, and say: "Read
   docs/handoff/session-19-prompt.md and run it."

---

You are the orchestrator of session 19. **Land Q1, then Train A, then build Train B on what G1 still fails, and take
M0 to its finish line: G1 PASS twice on main's current product code. No M1 building.**

## Step 1: Q1 alone (first ~1 hour)
`s18-q1` at 559c03f6. Re-run verify (a local builder, or the orchestrator in the `S18-Q1` worktree as session 18
did); READY if crosspr is clean. Then review round 3 of #628 under the `false-statement` exception (the card stated
consequences that were false; the reason is in the round-2 ledger) and the `ux-critic` words gate on the head (its
round-2 musts: `.private/work/session-18/STATE.md`, 10:37Z). Then one posting run under the rdlock and land.

## Step 2: Train A (~2.5 hours)
`s18-train-a` at 90f36dfd. A local hard integrator (its session-18 prompts: `.private/work/session-18/prompts/
s18-train-a.md`, `resume-train.md`): merge main (now holding Q1), run each member's acceptance tests, the
`needs_toolchain` engine tests by hand (lesson c), one verify, the real-drawing no-post run, READY. Open the train
PR (members: Q2+Q3 `s15-q3` d4b49ce6; E2 #627 adaf5e87, PASS r2 alone; E3 `s13-w318` a706025c; W6 #557 92dae6c0,
PASS r3; E6 `s13-w332` 6a6caae5 with its amended w332 test; A2 `s18-a2` 19e46707, BLOCKED only on crosspr). E3, the
Q stack and A2 could not be reviewed alone (a crosspr-only BLOCKED head gets no CI, so no review): the train PR's
round is their review. One review round, the design gate (web changes), one posting run with judged reasons
(E2's render_f1 drops; Q3's conflicts and continuations; E3's storeys), land. Close #627 and #557 when the train lands.

## Step 3: measure, then Train B
G1's script layer (`scripts.walk.run <sha40>` on main; #625 fixed its act timer). Read which checks still fail
(`.private/work/session-18/g1-gap-main.md` is the baseline). Train B, each with its acceptance tests first:
- **The owner's bulk ruling:** a Discipline with no drawing list and no PDF takes an unbroken number run as its
  second source (`vextrus/takeoff/services/step1.py` `_agreeing`). This is what moves `bulk_confirmable_share` on
  Edison E/P/G and Sample structural.
- **Edison structural's conflict Questions** (same_title/same_storey over sheets not listed as true Questions) and
  the 4 stale pairs still read as continuations (Q3's measure).
- **Phantom blank sheets** (3 on Edison: `sheets_match`): E7 (#538), deferred until now.
- **Convention Questions** (`boundary_storey`: 1 Edison, 2 Sample): no ticket yet.
- **Storeys** (Edison 22 wrong, Sample 16, before E3/E6): re-measure after Train A; Sample S-15's "top" vs a named
  floor is unowned.
- **A3** (`s13-w323`, origin f2e8e760) and **W9** (origin `s15-w9` d709f9ec): relaunch locally on fresh branches
  on main (both were stacked on the old Q1). E5 (#549), A4 (#545), W3 (#547) as the brief of session 18 said.

## Step 4: G1 twice
Script layer, then `/real-set-walk`, on main; a fix wave between; `scripts.walk.ready origin/main` exit 0; then, and
only then, "walk now". At half-way, say the measured gap to G1 twice, before any owner question.

## Finish line (checked by its command; evidence where it says)
1. Q1 and Train A merged; G1's script layer on main re-measured after each.
2. M0's finish line met: G1 PASS twice on main's current product code (`scripts.walk.ready origin/main` exit 0).
3. `docs/handoff/session-20-prompt.md` merged, opening with session 19's measures table.
Budget: ask the owner (recommend **12 hours**: Q1 ~1 h, Train A ~2.5 h, Train B ~4 h, G1 twice ~3 h, close ~1 h).

## Lessons from session 18 (binding; `docs/knowledge/lessons.md`, Session 18)
- **(a) A crosspr-only BLOCKED head cannot be reviewed alone** (no CI on a non-READY head, so the review refuses).
  Members that conflict only with each other go straight into the train; never open their PRs by hand.
- **(b) Run every real-drawing run through `scripts.factory.rdlock run`** (#620), or the measure misses it.
- **(c) `allowlist batch` opens a non-READY head:** verify it and commit READY before landing (#622's path).
- **(d) Keep the machine under load 10:** three heavy local builders at once drove load to 20 and made verifies
  fail on timing tests outside their diffs (E2 failed three times). Launch the fourth only when load drops.
- **(e) A power cut kills every builder; a resume copies the conversation into a new session, which may take a new
  name** (Q1's became `pr628-grouped-kind-records`). After a reboot, list sessions by `cwd`, not by name, before
  deciding a builder is gone; never run a second verify in a worktree whose builder is alive.
- **(f) Fix a below-bar finding that breaks G1's own instrument** (a negative `ms` would have failed the walk's
  schema): the bar decides blocking, not whether G1 can be trusted.
Session 17's lessons (`docs/handoff/session-18-prompt.md`) still bind.

## Effort and models
CLAUDE.md's "Effort and models" in full: orchestrator Opus 5.5 `medium`; `acceptance-writer`, the depth lens,
`qs-critic`, `drawing-analyst`, the `ux-critic` walk and hard builders Opus 5.5 `high`; ordinary builders Sonnet 5.5
`medium`; words-only `ux-critic` Sonnet 5.5 `high`; set model and effort in every launch.

## Laws that do not change
CLAUDE.md's Law section in full: account A; launches only through `scripts.factory.launch`; time from `date -u`;
Monitor on a log, never pgrep; no "walk now" without a passing G1 on main; secrets never printed; nothing from real
drawings in git, an issue, a PR or a cloud prompt; OCE is AGPL; cad2data's converters are never run; the repo is
public; statuses only through post-status; explicit paths; no force push, history rewrite or recursive delete.
