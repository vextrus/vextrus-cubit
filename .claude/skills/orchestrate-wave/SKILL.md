---
name: orchestrate-wave
description: The orchestrator's runbook for building one wave of a milestone autonomously (ADR 0041, ADR 0042): set the budgets, pass the governor's preflight, have acceptance-writer pin each ticket's tests, launch builders through scripts.factory.launch (cloud for committed-test tickets, local for real drawings), watch the event log with Monitor, review each READY head with /review-pr in at most two fix rounds, land, run the G1 walk before any "walk now", and record measures. Use when launching or running a wave (a session brief says "build wave N").
---
# Orchestrating a wave

Sessions are autonomous (ADR 0041; the owner: "I want complete autonomous sessions and I insist that"). You build,
review, gate and land; the owner decides product and scope and walks the milestone. Every command below is specified
in `docs/specs/factory.md` §2.2, and done is its §5. Keep your context for decisions: every read-heavy step goes to
an agent, each returning a file under `.private/work/<session>/`.

## Budgets and the clock
Set the session's budget and phases before the first launch; the clock hook then prints elapsed against them on
every prompt. Time comes from `date -u`, never from memory. Every message to a builder starts `[elapsed n/m min]`.
Over budget: cut scope and say what; each cut becomes an issue named under the PR body's `## Cut`. Never overrun
silently.

## When to ask the owner
Ask the owner only about product, scope, business, stack, spending and anything irreversible beyond pushing and
merging (ADR 0041 delegates those two): one question at a time, your recommendation first and the reason in a line.
Everything else (build, review, gates, push, land) runs without waiting. Never ask what research, the code or a
sensible default can answer.

## The runbook
1. **Governor (preflight).** Before each launch, review, test run or walk, the governor checks memory, disk and
   usage for that unit. A refusal waits or holds a ticket; it is never talked round.
2. **Acceptance writers.** Per ticket, `acceptance-writer` on the ticket's branch, given the plan entry, its
   contracts at the key level (the function, field, code or seed step by name; the shape's owner merges first)
   and m0-screens' words. It commits `acceptance: …` with its `red-on-main` and `green-on-throwaway` counts; its
   report goes into the builder's prompt and the reviewer's brief. Writers run in parallel.
3. **Launch.** Cloud for a ticket provable by committed tests:
   `uv run python -m scripts.factory.launch cloud …` (the only way `--cloud` is run; it refuses a branch origin
   lacks, a branch without an acceptance commit and a bundled upload). Real drawings, the guard and G1's builder:
   `uv run python -m scripts.factory.launch local …` (its own worktree and database, `VEXTRUS_ROLE=builder`).
   Effort `medium`; `high` for reading drawings, hostile-input boundaries and security walls. Launch one first and
   check it cloned `vextrus/vextrus-cubit` and pushed its branch; then fan out. Message a cloud builder through
   the launcher's `say`, a local one with SendMessage. A stopped builder resumes; it is never restarted over its work.
4. **Watch.** Monitor on the event log (`events.log` under `.private/work/factory/`), re-armed at its deadline, and
   `notify_when_idle` for local builders. No polling and no foreground sleep; never wait on a process listing. The
   SessionStart hook restarts the watcher when its pidfile is stale. A builder finishes with a `Factory-State:
   READY` (verified) or `BLOCKED` trailer; a READY head with no verify record is bounced, not reviewed.
5. **Review with `/review-pr`.** On each READY head, merged with `main` and any PR it meets: one review, then at
   most two fix rounds (the ledger refuses a third unless it is a security hole scoring 75 or more, a crash, or a
   false statement a QS meets). A PR touching `web/**` also gets `ux-critic` (the walk, or the words-only gate).
   One message per round: elapsed against budget, what held, each finding with its score, failing scenario and
   fix direction. Each fix carries a test that fails without it; a finding of 50 or more, or a repeated class,
   leaves a committed check. A finding after the cap becomes an issue (`needs-triage`, "found after the cap").
6. **Land.** `uv run python -m scripts.land order` picks the order (engine PRs as their posting runs finish, the
   rest in the gaps); `scripts.land <PR>` needs a ledger PASS for the head, brings the branch up to date, waits for
   CI, prints the status lines still owed and merges after `scripts.merge_ready`. Type each owed status yourself,
   from the main checkout, from the independent gate's verdict, never the builder's:
   `sudo -n -u vxkeys /usr/local/lib/vextrus/post-status <gate> <PR> <sha> …`, nothing else on the line. Engine
   PRs: `scripts/real-drawings <PR> --no-post` first, read the table and the exports' states (`states.py`, beside
   this file: states, times and error kinds, never text) under the accept rule (no failed stage gained; nothing
   lost or changed without a judged reason; every gain judged real), then the posting run. Without the lander,
   land by hand with the same steps; never `--admin`.
7. **G1 walk.** After each merge wave, G1 walks `main` on the real sets, started detached and reporting through
   the event log. **The G1 rule:** never tell the owner "walk now" (or "ready for your walk") without a passing G1
   verdict on main's current product code; the walk-now Stop hook blocks the message otherwise.
8. **Measures.** Per merged PR: time to first PR against budget, review rounds, findings filed after the cap, gate
   and posting-run outcomes, checks added. Per wave: tickets over budget, cuts, conflicts, lessons still without a
   check. Record them in the milestone issue before the next wave.

## Reading work: the scored loop
Run the scorer on `main`'s export (`sudo -n -u vxkeys /usr/local/bin/vx-score <run id>`, the run of a committed
head). One local agent per failing sheet loops change → `scripts/real-drawings <branch> --no-post` → score until
its sheet passes or stops rising, then commits; its PR lands through steps 5 and 6. Held-out Sets are scored only in
aggregate, at milestone gates. Every change to `scripts/real_drawings/` or `tools/scorer/` needs the owner's
custody re-run first: batch those PRs and ask once.

## Standing rules
- Nothing from real drawings leaves `.private/`; reviewers never run the real-drawing check.
- After each merge wave, adversary agents attack what merged, one surface each; a finding of 50 or more is re-run
  by a `refuter` before you act on it.
- A builder BLOCKED on an acceptance test, with proof, is answered in minutes: its writer amends the test in an
  `acceptance:` commit on the branch, and the builder merges it.
- After a reboot `/tmp` is gone and subagents are lost: read each one's `NOTES.txt`, re-launch fresh agents on the
  earlier reports, and re-check every branch head.
