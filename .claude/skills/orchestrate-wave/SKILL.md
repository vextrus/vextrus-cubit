---
name: orchestrate-wave
description: The orchestrator's runbook for building one wave of a milestone autonomously (ADR 0041): set the time budget, have acceptance-writer pin each ticket's tests, launch builders in cloud (committed-test tickets) and local sessions (real drawings) at medium or high effort, review each committed head with independent agents in at most two fix rounds, post design-gate and accept real-drawings under the accept rule, merge main in, merge, run reading work as a scored loop, and record measures in the milestone issue. Use when launching or running a wave (a session brief says "build wave N").
---
# Orchestrating a wave

Sessions are autonomous (ADR 0041; the owner: "I want complete autonomous sessions and I insist that"). You
build, review, gate and merge; the owner decides product and scope and walks the milestone. Read
`docs/sdlc.md` ("Waves", "The review loop") and the milestone issue first. Keep your context for decisions:
every read-heavy step goes to an agent, each returning a file under `.private/work/<session>/`.

## 0. The time budget first
Write the session's budget and each ticket's in `.private/work/<session>/STATE.md` before launching. Every
message to a builder carries `elapsed <n> min / <budget> min` (the research's one measured speed lever:
docs/research/opus-5-5-agentic-orchestration.md §7 item 15). A ticket over budget cuts scope, says what, and
the cut goes into its issue; it never overruns silently.

## 1. Before launching
- **Contracts inside the wave.** For every pair of tickets: does one call the other's interface, seed after
  the other, or share a migration chain? The shape's owner merges first; the other is declared "merges
  after". Write each edge **at the key level** (the function, field, code or seed step, by name) into both
  tickets' prompts.
- **Which gates apply.** A PR touching `web/**` needs `design-gate` (a backend ticket that words codes in
  `web/src/messages/` gets the words-only gate). A PR touching an engine path (`.github/engine-paths.txt`)
  needs a real-drawing posting run; one touching `scripts/owner/toolchain.sh` needs the owner to re-run it as
  root first (ask, with the command).
- **Where it runs, and at what effort.** `cloud` for a ticket provable by committed tests; `local` for
  anything touching real drawings. `--effort medium` by default; `--effort high` for hard tickets: reading
  drawings, hostile-input boundaries, security walls.
- **Acceptance tests first.** For each ticket, launch `acceptance-writer` with the ticket's plan entry, its
  contracts at the key level and m0-screens' verbatim words, on the ticket's branch. It commits
  `acceptance: t<ticket> …` and reports what each test pins; that report goes into the builder's prompt and
  the reviewer's brief. Tickets' writers run in parallel.
- **The prompt** = the ticket's part (the plan's entry, the trust boundary, the contracts, the acceptance
  report, the budget) + the wave's `common.md` (copy the last wave's; it carries every lesson). Keep them
  under `.private/work/<session>/<wave>/`. `common.md` says: make the acceptance tests pass and never change
  them; every serious finding fixed leaves a check that fails on its class; commit with explicit paths;
  never push, open a PR or merge; keep every suite's output in a file (pytest `-rf`); say when ready.
- **The local environment paragraph** (local tickets): the builder's own worktree and database
  (`ensure_database`); the venv from `/opt/vextrus/python`, the compiled ezdxf laid over it, `uv run
  --no-sync`; 24 cores; the real sets at `/home/riz/vextrus-cubit/.private/reference/`, read-only, only counts
  and conventions leaving; `scripts/real-drawings <branch> --no-post` for engine work.

## 2. Launch
- **Local:** from the main checkout, with the same config as yours (a session can message only sessions
  of its own config dir): `claude --bg --effort medium --name w<wave>-<ticket> "$(cat <ticket>.prompt)"`.
  It moves into its own worktree under `.claude/worktrees/`. Watch memory (`free -g`); hold one ticket
  rather than starve the rest.
- **Cloud (account B):** `CLAUDE_CONFIG_DIR=~/.claude-b claude --cloud --effort medium "$(cat <ticket>.prompt)"`.
  **Launch one first and check its git remote** (it must clone `vextrus/vextrus-cubit` and push its branch;
  session 05's launches uploaded copies with no remote). Fan out only when it has.
- Record ticket, time, where, effort, session name and id in the milestone issue and `STATE.md`.
- **An earlier session's builder** resumes rather than restarts: `claude --bg --resume <id> "<next step>"`.

## 3. Watch without polling by hand
- `SendMessage` with `notify_when_idle` wakes you when a local builder finishes or waits; `claude agents
  --json` (`--all` for completed ones) lists `state` and `waitingFor`. Answer "Needs input" fast.
- A background Bash loop that exits when something changes (a branch head moving, a new PR) covers the
  rest, cloud branches among them. Re-arm it after each wake. Never sleep in the foreground.
- **An idle session that should be working:** stop it, then resume it from its worktree with the next step
  (`claude --bg --resume <id> "<step>"`), never a fresh session over its work.

## 4. Review each committed head (one review, then at most two fix rounds)
When a builder says ready, review its committed head in a scratch copy, **merged with `main` and any PR it
meets**, before anything is pushed. In parallel:
- `pr-reviewer` with the ticket's authority, the acceptance report and a **focus** (the trust boundary),
  naming its report file.
- `ux-critic`: the words-only gate on the PR's catalogue, or the walk for a UI PR (m0-screens §8 by keyboard).
Engine PRs: nothing from real drawings leaves `.private/`; the reviewer never runs the real-drawing check.

**One message per round** (`fix-<PR>[b].md`): elapsed against budget; what held (so it is not undone); each
finding with its score, failing scenario and fix direction; the gate's musts and mays; "each fix with a test
that fails without it, and for a serious finding (50 or more, or a repeated class) a committed check that
fails on the class; the suites into files; correct the PR body; commit and say when ready". Findings at 50
and above are fixed; below 50, when cheap. Never a second message while the session works, unless it carries
a ruling it must build on.

**Re-check every fix** with the same agents on the new head: each finding re-attacked, its test red without
the fix, the round's diff scanned, the earlier attacks re-run. Five fixes in session 04 brought a new fault.

**The cap: two fix rounds.** A finding after the second is filed as an issue (label `needs-triage`, the
finding's scenario, "found after the cap"), unless it is a security hole scoring 75 or more, or a crash or
false statement a QS meets: those are fixed in a third round.

## 5. Gate and merge (yours, in this order)
1. **Push and open the PR:** `git push -u origin <branch>`; `gh pr create --body-file <the builder's body>`.
2. **Bring it up to date** (the ruleset requires it): merge `main` into the branch yourself (`gh pr
   update-branch <PR>`, or merge in its worktree and push), then confirm the new head changes only what
   `main` brought (`git diff <reviewed head> <new head>`, main's files excluded), so every verdict carries
   over. Post statuses only on this final head.
3. **`design-gate`** (web PRs), from the independent gate's verdict, never the builder's, with the full SHA:
   `sudo -n -u vxkeys /usr/local/lib/vextrus/post-status design-gate <PR> <sha> --passed <items> --failed
   <items> --not-applicable <items>`. Nothing else on the line, and only from your own session in the main
   checkout (the guard allows exactly this form there, never in a builder's worktree). Check
   it reached the head: `gh pr view <PR> --json statusCheckRollup`.
4. **`real-drawings`** (engine PRs), from the main checkout on `main`: first `scripts/real-drawings <PR>
   --no-post`, and read the table and the exports' states (`states.py`, beside this file: states, times
   and error kinds only, never text). Apply **the accept rule**: no failed stage gained; nothing lost or
   changed without a judged reason; every gain judged real. Then the posting run (the exports are cached,
   so it is quick): `scripts/real-drawings <PR> --accept-if-clean` when nothing was lost or changed and no
   failed stage was gained (it posts nothing and exits 3 otherwise), or `scripts/real-drawings <PR>
   --accept "<judged reason, at most 100 characters>"`. Otherwise post nothing and send the builder the
   table. A new measure's first run is where real files surprise.
5. **Merge-ready, then merge:** `uv run python -m scripts.merge_ready <PR>` must pass (both gates on the
   head posted by the App `vextrus-status`, or by main's not-applicable workflow; `ci` and every check
   green). If a gate was posted by anyone else, do not merge: say so to the owner. Then `gh pr merge <PR>
   --merge` (never `--admin`; the guard refuses it and any change to the ruleset), `git pull --ff-only`
   in the main checkout, and log it.

## 6. Reading work: the scored loop
Once the scorer and the Answer Keys are in place: run the scorer on `main`'s export
(`sudo -n -u vxkeys /usr/local/bin/vx-score <run id>`; the run id of a real-drawing run on a committed head,
never a hand-made file). It answers per sheet on the Development Sets. Launch one local agent per failing
sheet (or small group), each told its sheet, the failure in general terms and the budget; each loops
change → `scripts/real-drawings <branch> --no-post` → score until its sheet passes or its score stops
rising, then commits. Merge the gains one PR at a time through §4–5; re-score `main` after each merge. The
Held-out Sets are scored only in aggregate, at milestone gates.

## 7. Measures
Per merged PR: time to first PR against budget, review rounds, findings filed after the cap, design-gate and
posting-run outcomes, committed checks added. Per wave: tickets over budget, the lessons still without a
check (the debt list in the milestone issue), conflicts. Record them in the milestone issue before the next
wave.

## When the machine restarts
`/tmp` is gone. Background sessions survive a closed terminal; a reboot stops them, and they restart where
they left off when attached or messaged (`claude agents`). Subagents of the orchestrator do not survive: read
each one's NOTES.txt, re-launch fresh agents pointed at the earlier reports, and re-check every branch head.

## Session 06's additions (each paid for; see docs/knowledge/lessons.md)
- **Cloud builders push to a harness-named `claude/<slug>` branch**, never the ticket's: watch every
  `claude/*` branch (`git ls-remote origin "refs/heads/claude/*"`) each loop, remember the heads you have
  handled, and fire on a READY/BLOCKED head even if it was there when the watcher started.
- **Talk to a local builder with SendMessage** (it wakes an idle session); `claude --bg --resume <short
  id>` opens a picker and blocks. A stopped one: `claude --bg --resume <full session id> "<step>"`.
- **A builder's BLOCKED on an acceptance test, with proof,** is answered in minutes: amend it yourself or
  through its writer (`acceptance:` commit), push the ticket branch, tell the builder to merge it.
  Writers run every test file they commit against a throwaway implementation first.
- **Adversary rounds after each merge wave** (the owner's ruling): Sonnet 5.5 agents, one surface each,
  attack what merged; every finding ≥ 50 is re-run by an Opus `refuter` before you act; confirmed ones
  become fix tickets in the same session, the rest one issue per surface.
- **Score a real export as soon as a scorer exists**; if one reason dominates a whole set, suspect the
  scorer or the contract first and prove it on a synthetic case.
- **Every change to `scripts/real_drawings/` or `tools/scorer/` on main needs the owner's custody
  re-run** before the next posting or scored run: batch those PRs and ask once.
- **Unique scratch folders per agent**; a design gate reads a throwaway demo password from a file and
  types it into the sign-in form (never a real credential).
- **CI differs from this machine** (shellcheck, the Python build, browser speed): a CI-only failure goes
  to a Sonnet debugger with the job's log at once; a test must force the failure it tests.
