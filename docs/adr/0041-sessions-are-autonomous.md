# Sessions are autonomous: agents build, review, gate and merge; the owner walks the milestone

**Amended by ADR 0042** (4 Oct 2026; the owner: "Approve as written (Recommended)"): item 9 — account A runs the
orchestrator and every builder, cloud launches go only through the committed launcher, and cloud sessions may read
the two Development Sets (the owner's Q7 ruling); item 5 — `merge_ready` enforces the review from a local ledger.

The owner decides product and scope and walks each milestone's finish line on real drawings; everything
between is done by agents, without waiting for the owner:

1. **The orchestrator pushes, opens PRs and merges** once a PR's review loop is done and the ruleset's
   required checks are green. The ruleset still enforces CI, up-to-date branches and the two statuses;
   what moves is who presses merge. The orchestrator merges `main` into a PR itself before posting its
   statuses (the ruleset requires up-to-date branches). **Before every merge it runs
   `python -m scripts.merge_ready <PR>`**, which passes only when `real-drawings` and `design-gate` on
   the head were posted by the owner's App (or main's not-applicable workflow) and every check passed:
   the ruleset does not pin who posts a status, so the author is checked here, and the guard refuses
   changes to the ruleset, branch protection and admin merges.
2. **Independence moves from the owner to separate agents.** A reviewer and a gate that did not build the
   ticket decide; the builder never gates itself. The guard allows the poster only in the
   orchestrator's session (its project is the main checkout), never in a builder's worktree or a cloud
   copy. Every agent runs as the owner's one Unix user, so this is a tripwire, not a wall: a determined
   process could still write a run's `summary.json` in the drop folder, which the poster trusts on that
   basis, and the reviewer and the merge-ready check are what hold.
   - `design-gate` is posted by the orchestrator, through `post-status` run as the key user, from an
     independent `ux-critic` gate's verdict (the walk or the words-only gate), never the builder's own.
   - `real-drawings` is posted by the orchestrator after reading the run's table and export states,
     under **the accept rule**: no failed stage gained; nothing lost or changed without a judged reason;
     every gain judged real. Otherwise it is rejected, and the ticket goes back.
3. **The scorer** follows the owner's chosen option, "Dev per-sheet, held-out blind": agents run it
   password-free, but only on the pipeline's own export of a committed head (a run id the real-drawing
   command wrote, never a hand-made file). On Development Sets (Edison, the Sample Project) it answers per
   sheet: pass or fail and what is wrong in general terms. Held-out Sets are scored only in aggregate, at
   milestone gates. The keys stay with the key user, never readable by agents: measurement honesty, not
   security.
4. **Every session and every ticket has a time budget,** and the orchestrator writes elapsed against
   budget (`elapsed 40 min / 120 min`) in every message to a builder: the one speed lever the research
   measured (docs/research/opus-5-5-agentic-orchestration.md §3, §7 item 15).
5. **At most two review rounds per ticket.** A later finding is filed as an issue, unless it is a
   security hole scoring 75 or more, or a crash or false statement a QS meets.
6. **Acceptance tests come first,** written from the plan's entry, its contracts and m0-screens' words by
   a separate agent (`acceptance-writer`) and committed on the ticket's branch before the builder starts.
   The builder may not weaken them: CI's acceptance check (`tools/lint/acceptance.py`) fails any commit
   that changes a file under an acceptance path unless its message starts `acceptance:` and it changes
   nothing else; the reviewer reads any such commit against the writer's report.
7. **Every serious finding leaves a committed check** (a test, lint or scan that fails on the class) in
   the PR that fixes it: a finding scoring 50 or more, or any class seen twice. `docs/knowledge/lessons.md`
   becomes an index pointing each lesson at its check; a lesson without a check is a debt, listed in the
   milestone issue until it has one.
8. **Effort defaults to medium** for Opus 5.5 (the committed settings), **high** only for hard tickets:
   reading drawings, hostile-input boundaries, security walls. It is set per launch (`--effort`). The
   independent reviewers (`pr-reviewer`, `refuter`) keep `high` in their own definitions.
9. **Cloud and local sessions are both used.** Cloud sessions (account B) build tickets provable by
   committed tests; local sessions build anything touching real drawings. Before fanning out, the
   orchestrator checks one cloud launch's git remote (session 05's cloud sessions ran on uploaded copies
   with no remote).
10. **Reading work is a scored loop.** With the Answer Keys and the scorer in place, many agents work at
    once, each on a different failing sheet, looping until its score rises; the per-sheet score is the
    pass/fail check.

The machinery: the guard no longer refuses `gh pr merge` or the merge API; it allows exactly two command
lines under a privilege-raising command, `post-status` and the scorer run as the key user with `-n` and
plain arguments, and still refuses every other form, reading the key user's home, statuses posted
through the API, force pushes, history rewrites, `--no-verify`, secrets, staging everything and recursive
deletes. `scripts/owner/autonomy-setup.sh` (run once by the owner, as root) installs the matching
password-free sudoers rule for those two programs and nothing else. The App's key stays with the key
user, reached only through that rule.

Why: the owner's rulings, 29 Sep 2026: "I want quality with speed, I'm the only one person beside you
working on this project and the Real Drawing from Edison have us full permission, so there is nothing to
be extra cautious about security and other things. … I want the next sessions to be fastest to deliver
results with quality, not waiting for my approval of push or even merge I would say: I want complete
autonomous sessions and I insist that." And: "Every serious finding leaves a committed check, not a
lesson; repeated fault can't be stay forever … Acceptance tests are written before the builder starts, by
a separate agent. Bring the drawing-reading scorer forward from M1. With the Answer Keys and the blind
scorer in place, reading work becomes compiler-shaped: many agents, each on a different failing sheet,
looping until the score rises. Give every session a time budget. … Default effort medium for Opus 5.5,
not xhigh or high … in some situations we can run in high for hard tasks but in most cases we'll be in
default mode. … our Cloud Sessions on account B working now again so from next session can leverage both
local and cloud sessions". On the scorer, the owner chose "Dev per-sheet, held-out blind (Recommended)".

What stays, and why: the independence of gates (now separate agents, not the owner); the ruleset
enforcing CI; the owner's walk at each milestone's finish line (green CI is not done); the Answer Keys
fenced (a reader that can see its answers fits itself to them: docs/postmortem.md, cause 1).

Rejected: keeping the owner's merge (it made the owner the queue, the opposite of the ruling); a gate
posted by the builder (it grades itself); an unrestricted password-free rule for the key user (any
process could read the keys and the App's key through it: ADR 0026's refuter #5).

## History
- 29 Sep 2026: decided. The owner's rulings above, in session 05; amends ADRs 0025, 0026 and 0030.
- 29 Sep 2026 (review round 1 of the harness PR): the author of each gate is checked before a merge
  (`scripts/merge_ready.py`), the poster runs only from the main checkout's session, the guard refuses
  ruleset and branch-protection changes and admin merges, the scorer's rule admits one run id only (a
  sudoers regular expression), acceptance tests may not be skipped, deselected or weakened in a merge
  (`tools/lint/acceptance.py`, `tools/lint/acceptance_pytest.py`), and `scripts/real-drawings` gains
  `--accept-if-clean` and `--accept REASON`. The owner is advised to pin the App's `integration_id` on
  both statuses in the ruleset.
- 29 Sep 2026 (ticket 24s): **the scorer's "committed head" is enforced by a third user**, `vxrun`, as
  amended in ADR 0026. The password-free rules are now the owner's two above, plus one letting the
  owner's user run the installed real-drawing command as `vxrun`. `vxrun` in turn runs, as the key user,
  only the poster's `head` and `real-drawings` and the scorer. A scored run measures only a head and a
  main that GitHub holds. The guard's two allowed command lines are unchanged.
- 4 Oct 2026 (ADR 0042; the owner: "Approve as written (Recommended)"): item 9 — account A runs the orchestrator and
  every builder, cloud launches only through the committed launcher, and cloud sessions may read the two Development
  Sets (owner ruling Q7); item 5 — merge_ready enforces the review from a local ledger.
