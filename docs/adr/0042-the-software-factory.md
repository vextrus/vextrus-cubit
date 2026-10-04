# The software factory: the harness is committed code, builders run in the cloud, real drawings stay local, and gates are checks

Status: proposed, waiting for the owner's approval (session 12). On approval, PR f0 sets it to "accepted <UTC> by the
owner: "<the owner's words, verbatim from STATE.md>"". The spec is `docs/specs/factory.md`.

The harness that builds Vextrus becomes a software factory: committed, tested and reviewed code that launches,
watches, reviews, gates and merges the work, instead of prose runbooks and session scripts under `.private/`.
Every gate that decides a merge or a walk is a committed check that fails on its class:

1. **Factory code is product code.** Launchers, the watcher, the governors, the review record, the merge gate,
   the walk gate, the hooks, the workflows and the mod live in the repo (`scripts/factory/`, `scripts/`,
   `scripts/walk/`, `tools/leakscan/`, `.claude/hooks/`, `.claude/workflows/`, `tools/mod/`). Each has tests, goes
   through the same review loop and CI, and leaves its check red without its fix. The data passed between them is
   fixed first as committed contracts (`docs/specs/factory/contracts/`). A harness change still removes as much as it
   adds; where one does not, its PR says so with a measured `Harness net` line. Files under `.private/work/factory/`
   are run records, never code.
2. **One account runs everything.** Account A, the default login, runs the orchestrator and every cloud and local
   builder, so the orchestrator and its local builders share one config folder and can message each other.
3. **Who runs where.**
   - **Cloud:** builders and acceptance writers for tickets proved by committed tests. They are launched and
     messaged only through `scripts.factory.launch` from the main checkout, onto the ticket's own branch, with every
     prompt leak-scanned. Each launch is judged from its own log. A bad launch cannot be prevented, only caught: the
     launcher exits 2, at once sends the session a STOP message, and names it for the owner to delete; the watcher
     alarms on any new `claude/*` branch.
   - **Local:** the orchestrator, every piece of real-drawing work (posting runs, scored loops, the real-set walk and
     its builder, `drawing-analyst`, builders that read real drawings) and the guard ticket. At most three local
     agents at once.
   - **Reviewers and refuters** run inside the orchestrator's session as a committed workflow (`/review-pr`), because
     no documented channel brings a cloud session's verdict back except a push. Locally they run only the PR's
     changed tests and their own attack tests; full and web suites are CI's.
4. **Builders finish in one machine-readable way.** A builder's last commit carries `Factory-State: READY` (with
   `Factory-Verify: <tree> ok`) or `BLOCKED`. The guard refuses to push a READY head unless the `verify` record for
   that exact tree is green; a Stop hook only nudges the builder until then (Claude Code overrides a Stop block after
   eight in a row). Local builders never push; cloud builders push only their own branch.
5. **The review cap and "no silent cuts" are enforced by `merge_ready`,** the gate every merge already passes. A
   merge needs a PASS review recorded in the orchestrator's local ledger for the PR's head (or for a head that differs
   only by a merge of main with no resolved conflict), and no round 3 without a recorded exception. The PR comment is
   for display only: `merge_ready` accepts a review only when the orchestrator's local ledger recorded it, because
   cloud sessions can post comments under the owner's name. Every cut item must link an open issue. The leak scan
   must be clean.
6. **No "walk now" without G1.** Before the owner is asked to walk a milestone, an agent walks main on the real sets
   as a QS would (G1), with the QS's burden counted (Questions per Discipline, bulk-confirmable share, act time
   during a read) against expectations taken from the agreed limits and the Answer Key, never from a walk's own
   recording. It must pass twice in a row, the newer pass on main's current product code. A CLAUDE.md law says it, and
   `ready.py` checks it. Every walk finding, of any severity, becomes an issue.
7. **Drawing text cannot leave by push, issue, PR or prompt.** The literal scan (#211) is committed before any
   real-set walk runs. Its corpus is built locally from the drawings' own text and stays local. It scans added lines,
   commit messages, file names, branch names, bodies and cloud prompts, and prints locations and counts, never text.
   The guard requires its stamp for every push from the main checkout and every `gh` body. A pre-push hook covers
   pushes the guard never sees. `merge_ready` re-scans each PR. CI checks only drawing bytes and private paths.
8. **Resources are governed, failing closed.** No launch or heavy run starts when disk, memory, swap or plan
   usage would cross its floor, or when the usage reading cannot be parsed. The real-drawing lock has one visible
   queue, with posting runs first.
9. **Claude Code features are adopted only when the verified reference proves them.** Tier 1 rests only on facts in
   the verified reference or a Phase-1 live proof; anything else needs one test before anything relies on it. In:
   `claude agents --json` and resume by the full session id; `notify_when_idle` for local builders and Monitor for
   everything else; a workflow concurrency cap of 8; models pinned in frontmatter and named per workflow stage; a
   Sonnet `Explore` agent; `.claude/rules` with `paths:`; an orchestrator-only status line; a committed
   `vextrus-factory` mod for the orchestrator only. Out: `worktree.baseRef`, `/goal` as builder completion,
   `CLAUDE_CODE_TOOL_MEMORY_LIMIT` (its kills name nothing), the sandbox on this WSL2 machine, a project override of
   `includeGitInstructions`, PreModelSwitch hooks, `/code-review` with `REVIEW.md`, routine `ultrareview`, Claude Code
   self-hosted environments, agent `memory:`, `--restricted` reviewers, PR auto-fix.

The machinery: `docs/specs/factory.md` §2.2 names every file and what it does; §9 lists the eight tier-1 components
session 13 cannot run without, each with its check, and the finish-line obligations exempt from the cut line.

Why: the owner's rulings in session 12 (STATE.md, verbatim):
- 4 Oct 2026, 17:21Z, on lifting "no orchestrator code": "Yes, lift it (Recommended)".
- 17:22Z, on the budget: "~11 h as proposed (Recommended)".
- 17:42Z: "20x max account is perfect for us … for now go on with your full potential."
- 18:21Z, on accounts: "Yes, account A for all (Recommended)".
- The owner's intent for the session (4 Oct): "a complete customized upgraded updated sdlc for agentic coding
  software factory with leveraging "Claude Mods" … with lots of parallel sessions and agents mostly in cloud
  sessions"; "on our local machine only the needed core sessions will run".

The evidence:
- D1–D10 reached the owner's walk because every gate between merges measured fakes, the demo seed or exports, never
  a QS's job on a real set. The one real-set agent walk's friction findings were dropped, and cuts were closed
  without issues (`.private/work/session-12/research/verified-answers.md` §1).
- The review cap, the clock and the self-matching waits lived in prose and were broken in five, four and three
  sessions (`.private/work/session-12/measures/ratchet.md`; the third wait was session 12's own cloud probe).
- Cloud sessions' built-in GitHub tools post comments under the owner's name, outside Bash, so a guard rule cannot
  stop a forged review comment (`research/docs-raw/cloud-environments.md:242,318`).

What stays, and why: everything in ADR 0041. The orchestrator merges after the capped review loop and green checks.
Gates are posted only through `post-status` from the main checkout. Acceptance tests come first and builders never
change them. Every serious finding leaves a committed check. Effort is medium by default. The owner's walk decides
each milestone; green CI is not done.

Rejected:
- **Reviewers in the cloud.** Their verdicts would come back only as public PR comments, and nothing reports when a
  cloud session finishes except a push.
- **A review marker in a PR comment as the proof of review.** A cloud session can post one under the owner's name.
- **A Stop hook as the READY gate.** It cannot stop a commit or a push, and it gives way after eight blocks.
- **A committed list of proven CLI versions.** The CLI updated on each of three days in a row; every launch is
  judged from its own log instead.
- **A guard rule refusing harness edits unless an environment variable reached the session,** and a `harness` label
  the orchestrator sets for itself. The first is unverified and would block every cloud harness ticket; the second
  proves nothing. The guard's hook registration is pinned by a lint instead.
- **xdist as the first CI fix.** `uv.lock` and `pyproject.toml` are engine paths, so it would owe a posting run on
  the critical path. Sharding `ci.yml` comes first; xdist follows in session 13.
- **The mod as the only display.** Mods are new and had session-ending crashes fixed in the last two releases. The
  status line carries the same data; it replaces the mod only after two recorded crashes.
- **A blanket CI retry for flakes.** Only tests listed against an open issue get one recorded rerun.

Supersedes `docs/sdlc.md:112-114` (the owner's ruling cited it as 111-113): "The harness stays small: three hooks
(guard, state, after-bash), the blind scorer and the committed checks; no orchestrator code, ledger, state store or
evidence packs. A harness change should remove as much as it adds." The last sentence stays. Amends ADR 0041:
- item 9: account A, not account B, runs cloud sessions, launched only through the committed launcher;
- item 5: the two-round cap is enforced by `merge_ready` from a local ledger, not by prose.

## History
- 4 Oct 2026: proposed in session 12, Phase 2. Three independent designs (quality-first, speed-first, risk-first)
  were scored by three judges. The spec starts from the risk-first design and adds the best of the other two. Three
  critics (completeness, facts, hostile) checked it, and it was revised once
  (`.private/work/session-12/design/revision-log.md`).
