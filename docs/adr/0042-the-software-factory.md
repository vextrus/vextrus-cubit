# The software factory: the harness is committed code, builders and reviewers run in the cloud, custody stays local, Jev advises, and gates are checks

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
   - **Cloud (more cloud, more parallel):** builders and acceptance writers (at high effort) for tickets proved by
     committed tests, and reviewers and refuters. They are launched and messaged only through
     `scripts.factory.launch` from the main checkout, onto a branch `git ls-remote` shows on origin, with every
     prompt leak-scanned. Each launch is judged from its own log. A bad launch cannot be prevented, only caught: the
     launcher exits 2, at once sends the session a STOP message, and names it for the owner to delete; the watcher
     alarms on any new `claude/*` branch. How many run at once is a governor-driven ramp (8 to start, up to 16),
     bound by the account's usage window, not a session count.
   - **Cloud reviewers and refuters return one pushed verdict file** on a review branch, which the local ledger
     records only after checking its parent, its single path, a nonce only the launch record and that reviewer hold,
     and an unmoved PR head. A PR comment or a Remote Control message is never the record. Until that channel has run
     once end to end, and for small diffs, review runs inside the orchestrator's session (`/review-pr`).
   - **Real drawings in the cloud** (the owner's Q7 ruling): the two Development Sets reach cloud sessions only
     through a private drawings repo and a read-only token in a separate cloud environment, after a probe proves the
     clone and the sandbox; then drawing builders, `--no-post` runs, proxy loops and convention-only analyst work
     may run there. Nothing from the drawings enters the public repository.
   - **Local, only what must stay:** the orchestrator, the ledger, `merge_ready`, `post-status`, the blind scorer and
     its keys, posting and scored runs under the lock, the governor, the launcher, the leak scan and its corpus, the
     G1 gate walk and its verdict, Held-out Sets, drawing-content analyst work (no private return channel yet), Jev
     calls carrying drawing text (until ADR 0013 is amended), and, while the cloud routes are unproven, the guard
     ticket and real-drawing builders. At most three local agents at once.
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
   usage would cross its floor, or when the usage reading cannot be parsed. The cloud cap ramps up only while the
   measured usage rate projects under the floors. The real-drawing lock has one visible queue, with posting runs
   first.
9. **Claude Code features are adopted only when the verified reference proves them.** Tier 1 rests only on facts in
   the verified reference or a Phase-1 live proof; anything else needs one test before anything relies on it. In:
   `claude agents --json` and resume by the full session id; `notify_when_idle` for local builders and Monitor for
   everything else; a workflow concurrency cap of 8; models pinned in frontmatter (and named per workflow stage, doc-quoted, one test); a
   Sonnet `Explore` agent; `.claude/rules` with `paths:`; an orchestrator-only status line; a committed
   `vextrus-factory` mod for the orchestrator only. Out: `worktree.baseRef`, `/goal` as builder completion,
   `CLAUDE_CODE_TOOL_MEMORY_LIMIT` (its kills name nothing), the sandbox on this WSL2 machine, a project override of
   `includeGitInstructions`, PreModelSwitch hooks, `/code-review` with `REVIEW.md`, routine `ultrareview`, Claude Code
   self-hosted environments, agent `memory:`, `--restricted` reviewers, PR auto-fix. Remote Control is on for the
   orchestrator (the owner's Q7 ruling), so its main conversation can list and message cloud sessions (verified
   reference; the two-way path has not yet run live, one test in Phase 3).
10. **Jev is a function the factory calls, never an agent or a gate.** One committed client
    (`scripts/factory/jev.py`) pins the model version, caches every answer, logs every call without its state, and
    answers `Unavailable` within the product's deadline, after which every step runs exactly as it would without
    Jev. Jev advises, sorts and routes (review-finding triage in shadow first, duplicate findings, leak advice beside
    the literal wall, a launch warning, and a watch that alarms when the Jev model moves); the guard, `merge_ready`,
    the ledger and the leak wall decide. A builder's READY or BLOCKED stays an exact trailer. Triage may route
    findings to refuters only after it agrees with refuter verdicts on at least 90 % of at least 30 findings, recorded
    here. In the product, ADR 0011's rule holds: Jev nodes go where the scorer names a failing class (view subject
    first), each after a live probe that beats the reader and a spot-check row; recorded answers carry Jev's gains
    into the offline scored run. Drawing text goes to Jev only under the owner's local key until ADR 0013 is amended.

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
- 20:2xZ, on the draft: selected "More cloud, more parallel"; "mostly pairing with Typesafe AI Jev model into factory
  incorportation where Jev model invokation and actively using it will enhance the factory workflow more better and
  enhance performance as well as making sure of getting the best out of Jev inside our new vextrus software as
  originally planned"; "Q4 M0 bar - 90%"; "Q7 drawing data - I'm allowing to be more easy going on this case and
  cloud sessions may read drawing and enabling Remote Control for most cases if that means more power and
  performance by allowing some privacy issues that I'm allowing willingly"; "Q20 acceptance writers at high effort:
  yes for most scenario if it comes to quality".

The evidence:
- D1–D10 reached the owner's walk because every gate between merges measured fakes, the demo seed or exports, never
  a QS's job on a real set. The one real-set agent walk's friction findings were dropped, and cuts were closed
  without issues (`.private/work/session-12/research/verified-answers.md` §1).
- The review cap, the clock and the self-matching waits lived in prose and were broken in five, four and three
  sessions (`.private/work/session-12/measures/ratchet.md`; the third wait was session 12's own cloud probe).
- Cloud sessions' built-in GitHub tools post comments under the owner's name, outside Bash, so a guard rule cannot
  stop a forged review comment (`research/docs-raw/cloud-environments.md:242,318`).
- Jev answered 60 logged factory-shaped calls (invented text) in 0.31–0.34 s at the median for about $0.0013 in all;
  it read a builder's free-text report literally, and its documented weak spots include adversarial state
  (`.private/work/session-12/research/jev-api.md` §1–§2). Re-checked live on 4 Oct at 21:02Z: `jev-latest` still
  answered as `jev-1.13.0` (HTTP 200, 0.39 s), and the model list names only aliases, so the model watch reads a
  call's `model` field. In the product its one node scores no field, so it moves
  the reading score by 0 today; on 130 real items it beat the reader on view subject only
  (`research/jev-product.md`).
- `judge()` passed a cloud launch on a branch missing from origin; no per-account cap on concurrent cloud sessions
  is documented, and they share the account's usage limits (`research/cloud-max.md`).

What stays, and why: everything in ADR 0041. The orchestrator merges after the capped review loop and green checks.
Gates are posted only through `post-status` from the main checkout. Acceptance tests come first and builders never
change them. Every serious finding leaves a committed check. Effort is medium by default. The owner's walk decides
each milestone; green CI is not done.

Rejected:
- **A review verdict carried by a PR comment or a Remote Control message.** A cloud session can post a comment
  under the owner's name, and anyone can comment on a public PR; a message is a doorbell. The verdict is a pushed
  file checked by the local ledger.
- **A review marker in a PR comment as the proof of review.** A cloud session can post one under the owner's name.
- **Jev deciding a gate** (READY/BLOCKED from free text, a PASS, dropping a finding). It reads literally and can be
  moved by injected text; it advises and the rules decide.
- **Attaching the drawings repo to cloud sessions as a second repository** (a multi-repo session loads no repo hooks,
  so the guard is off) and **an encrypted drawings archive in a release** (unreachable for an unattached repo, and
  in the public repo's releases it breaks the public-repo law).
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

Does not amend ADR 0011 or ADR 0013. Two owner questions stay open: whether cloud sessions may send drawing text to
Jev under the cloud key (ADR 0013), and whether a Claude vision proposer may run inside the product's read
(ADR 0011).

## History
- 4 Oct 2026: proposed in session 12, Phase 2. Three independent designs (quality-first, speed-first, risk-first)
  were scored by three judges. The spec starts from the risk-first design and adds the best of the other two. Three
  critics (completeness, facts, hostile) checked it, and it was revised once
  (`.private/work/session-12/design/revision-log.md`).
- 4 Oct 2026, 20:2xZ onward: revised a second time for the owner's notes (more cloud, more parallel; Jev in the
  factory and the product; the M0 bar at 90 %; drawings in the cloud with Remote Control on; acceptance writers at
  high effort), from five research strands each checked by a refuter
  (`.private/work/session-12/design/revision-2-log.md`).
- 4 Oct 2026, 21:0xZ: a final check tied every Claude Code name in the spec to the verified reference or marked it
  unverified, re-measured Jev's model pin live, and aligned the approval pack's summary and tier-1 list with the spec.
