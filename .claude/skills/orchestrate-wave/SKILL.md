---
name: orchestrate-wave
description: The orchestrator's runbook for building one wave of a milestone with cloud sessions and local agents: find the contracts inside the wave, write and launch each ticket, watch for PRs, review each PR and gate its words, send one combined fix message per round, re-check every fix, walk the owner through the gate post and the real-drawing posting run, and record measures in the milestone issue. Use when launching or running a wave (a session brief says "build wave N").
---
# Orchestrating a wave

The loop session 04 ran for eleven PRs, each merged only after review. Read `docs/sdlc.md` ("Waves", "The review
loop") and the milestone issue first. Keep your own context for decisions: every read-heavy step goes to an
agent, each returning a file under `.private/work/<session>/`.

## 1. Before launching
- **Contracts inside the wave.** For every pair of tickets, ask: does one call the other's interface, seed
  after the other, or share a migration chain? The shape's owner merges first; the other builds against it
  and is declared "merges after". Session 04 found two such edges only by reading (a decorator and the seed's
  order): look before you launch, and write the edge into both prompts.
- **Which gates apply.** A PR touching `web/**` needs `design-gate` (a backend ticket's catalogue counts: its
  gate is the words review). A PR touching an engine path (`.github/engine-paths.txt`) needs the owner's
  posting run; one touching `scripts/owner/toolchain.sh` also needs the owner to re-run it, as root, from a
  worktree of the PR head, before the posting run.
- **The prompt** = the ticket's part (the plan's entry, the trust boundary to attack, the contracts it meets,
  who builds on it) + the wave's `common.md` (copy the last wave's; it carries every lesson). Keep them under
  `.private/work/<session>/<wave>/`.
- **Launch** each (the brief names the account):
  `script -q -e -c 'CLAUDE_CONFIG_DIR=$HOME/.claude-b claude --cloud "$(cat <ticket>.prompt)"' launch-<t>.log`
  and read the session id from the log. Record ticket, time and session id in the milestone issue.

## 2. Watch without polling by hand
A background Bash loop that exits when something changes wakes you: new PRs above N
(`gh pr list --json number --jq '.[]|select(.number>N)'`), or a PR's head moving
(`gh pr view P --json headRefOid`). Re-arm after each wake. Never sleep in the foreground.

## 3. Each PR, first head: two agents in parallel
- `pr-reviewer` with the PR, its authority, and a **focus**: the trust boundary to attack, plus "run it merged
  with <open PR or main> where they meet". Name the report file.
- `ux-critic` in words-only gate mode on the PR's catalogue, if it touches `web/**`.
- Engine PRs: nothing from real drawings leaves `.private/`, and the reviewer never runs the real-drawing check.

## 4. One combined message per round
Write `fix-<PR>[b|c].md`: what held (so it is not undone), then each finding with its score, failing scenario
and fix direction, then the gate's musts and mays, then any owner ruling in their words, then "each with a
test that fails without the fix; the suites; correct the PR body; push". Send it
(`CLAUDE_CONFIG_DIR=$HOME/.claude-b claude -p "$(cat fix.md)" --cloud <session> < /dev/null`), then log the
continuation in the milestone issue. One round, one message: never a second message while the session works,
unless it carries a ruling it must build on. Send a decision **before** posting any PR comment.

## 5. Re-check every fix round
`pr-reviewer` in re-check mode on the new head (each finding re-attacked, its test red without the fix, the
round's diff scanned, the earlier attacks re-run for a regression), and `ux-critic` again if words changed.
Five fixes in session 04 brought a new fault: never skip this.

## 6. The owner's steps, in this order
1. **Update branch**, if the PR is behind `main`; then confirm the new head changes only what `main` brought
   (`git diff <verified head> <new head>`, excluding main's files), so every verdict carries over.
2. **Owner steps before the check**, if any (`toolchain.sh`, as root, from `~/pr<N>`: give the commands).
3. **The gate** (give the full SHA): `sudo -u <key user> /usr/local/lib/vextrus/post-status design-gate <PR>
   <sha> --passed … --not-applicable …`. Write this text with the Write tool or in a reply: the guard refuses
   it in a Bash command. Then check the status reached that head (`gh pr view --json statusCheckRollup`).
4. **The posting run:** `scripts/real-drawings <PR>`. Ask for the table **before** the owner accepts, and read
   the exports' states with `states.py` (beside this file: states, times and error kinds only, never text).
   A new measure's first run is where real files surprise (10's first run found a DWG its second reader
   could not read).
5. The owner merges; `git pull --ff-only`; log it.

## 7. Measures and the gate
Per merged PR: time to first PR, continuations (review rounds; a planned part counts apart), design-gate and
posting-run outcomes. Per wave: second continuations against ADR 0025's "at most 1 in 4", the review queue,
conflicts, cost if readable. Record them in the milestone issue before the next wave.

## When the machine restarts
Local agents and `/tmp` are gone; cloud sessions carry on. Read each agent's NOTES.txt, re-launch fresh agents
pointed at the earlier reports, and re-check PR heads.
