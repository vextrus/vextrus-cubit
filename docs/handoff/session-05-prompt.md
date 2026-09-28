# Session 05: M0 wave 3, built locally

## Starting the session (the owner)
In a terminal, from the main checkout on `main`, pulled:

```bash
cd ~/vextrus-cubit && git switch main && git pull --ff-only
```

```bash
CLAUDE_CONFIG_DIR=~/.claude-b claude --model claude-opus-5-5 --effort xhigh
```

Account B is the vextrus.com login; the CLI's default config is not signed in. Check that `/status` shows Opus 5.5
at xhigh and permission mode auto, then say: "Read docs/handoff/session-05-prompt.md and run it."

---

You are the orchestrator of the third build session of the new Vextrus. You run in the CLI, on **account B**, at
**xhigh**. **Everything runs on this machine: no cloud sessions.** The owner, 29 Sep 2026: "instead of Cloud
sessions the main sessions on xHigh will orchestrate everything just like we planned, the multi-agent sessions can
do whatever extend to accomplish the goal, everything will be run in locally."

Your job is to orchestrate:
- each ticket is built by its own **background Claude Code session**, in its own worktree, which may use subagents
  and workflows as it needs;
- local agents review and verify;
- you keep your own context for decisions, contracts and the owner.

Quality on every merge comes first, then speed ("the highest code quality with production grade output in
shortest time possible"; tokens are no constraint).

## You are resuming: session 05 began in the CLI and stopped at its cloud launch
- **Read first:** `.private/work/session-05/STATE.md`. It holds:
  - the finish line and the tickets;
  - the orchestrator's decisions **D1–D10** (the wave's contracts, merge edges and shared data, each open to the
    owner's reversal);
  - the owner's rulings, in their words;
  - the log.
- **The preparation stands:**
  - `wave3/contracts.md`: the contracts map;
  - `wave3/drafts/` and `wave3/final/*.prompt`: every ticket's prompt, drafted against `main` with contracts cited
    by path and line;
  - `wave3/common.md`: the shared rules.
- **Only the launch failed.** Account B's `claude --cloud` uploaded a local copy instead of linking the GitHub repo:
  the sessions had no remote. The owner then chose to build everything locally.
- **Adapt before launching:** replace `common.md`'s cloud "This environment" paragraph with the local one below,
  re-run `wave3/finalize.py` (or reassemble each prompt as its part plus `common.md`), and remove every cloud line
  from the parts.
- **13 was already building locally.** Its background session `21ab7611` is stopped, with uncommitted edits in
  `.claude/worktrees/13-sheet-segmentation` (placement's `Transform.inverse`, buffers). Resume it
  (`claude --bg --resume 21ab7611-1e38-4c48-ac72-823fbda64c63 "<the next step>"`) rather than starting over.
  Its analysts' reports are under `.private/work/session-05/13/`.
- **Clean-up the owner may ask for:**
  - the diagnostic cloud sessions on B and A;
  - the branch `claude/diag-*`, if one appears on GitHub;
  - the 24 `scratch-*` folders under `.private/work/session-04/` and `/home/riz/review70-scratch` (the guard
    refuses `rm -r`: give the owner the command).

## Done means (check each, and keep checking until all hold)
1. **Wave 3 merged:** 13, 14, 15, 19b, 20a (docs/plans/M0.md, "Wave 3"). Each PR:
   - went through the review loop (`docs/sdlc.md`, "The review loop");
   - was fixed and re-checked;
   - has its local step done (13's real sheets looked at; 19b's check on the real sets; 20a's design-gate walk).
2. **#75 and #82 merged,** in the order D2 sets: #75 before 15 and before 20a's gate.
3. **Wave 3's measures in #45:** per PR and per wave, and the widening gate decided.
4. **Session 06's brief written** (`docs/handoff/session-06-prompt.md`), the lessons added, the PR opened.

**Do not end your turn while any of these is owed.** A summary, a question you could answer yourself, a finished
milestone and a background session still running are not done. When you must wait for the owner, say exactly what
you need, then keep every other track moving.

## How the local build runs
- **One background session per ticket,** started from the main checkout with its complete prompt:
  `claude --bg --name w3-<ticket> "$(cat .private/work/session-05/wave3/final/<ticket>.prompt)"`.
  - It moves itself into its own worktree under `.claude/worktrees/` before editing.
  - It reads the project settings, so Opus 5.5 runs at xhigh, and account B's user settings, so it runs in auto
    mode.
  - It is a full session: it may spawn its own subagents and workflows.
  - Start the independent tickets together.
  - The machine: 24 cores, 26 GB RAM, 146 GB free. Watch memory with `free -g` as sessions build web code and
    run browsers. If it runs low, hold one ticket rather than risk the rest.
- **The local environment** (for `common.md`):
  - you work in your own worktree of this repository;
  - your own database comes from `uv run manage.py ensure_database && uv run manage.py migrate` (named for the
    worktree);
  - PostgreSQL 18 on 127.0.0.1:5432;
  - the toolchain under `/opt/vextrus`;
  - make the venv with `UV_PYTHON_INSTALL_DIR=/opt/vextrus/python`;
  - lay the compiled ezdxf from `~/.cache/vextrus-real-drawings/wheels/` over it, checked against
    `toolchain/ezdxf.lock`, and run with `uv run --no-sync`;
  - 24 cores (CI has 4: run the suites here);
  - the real Development Sets are at `/home/riz/vextrus-cubit/.private/reference/` (read-only; nothing from them
    enters git, an issue or a PR; only conventions and counts leave). `scripts/real-drawings <branch> --no-post`
    runs the check on your branch.
- **The builders never push, open a PR or merge.** A builder commits on its branch with explicit paths and tells
  you it is ready. You review it, then push and open the PR with the owner's yes, batched.
- **Talk to them with `SendMessage`** (the cross-session messaging `ListAgents` and `SendMessage`; ask for
  `notify_when_idle`, so you learn when a session finishes or waits). Watch with `claude agents --json`. A session
  that "Needs input" gets your answer, or the owner's, fast.
- **The review loop is unchanged** (the `orchestrate-wave` skill, and `docs/sdlc.md` "The review loop"). A review
  starts on the builder's committed head, before the PR: `pr-reviewer`, plus `ux-critic` as the words gate or the
  walk, in parallel. Then one message per round to the builder, and every fix re-checked. Use workflows for
  fan-outs; the owner authorises them.
- **The owner's steps are unchanged:** update the branch, any root step, the `design-gate` post, the real-drawing
  posting run, the merge. Batch them into one message with exact commands for exact SHAs, and read every posting
  run's table and `states.py` before the owner accepts.

## State lives in files, not in your context
Keep `.private/work/session-05/STATE.md` current after every event: the ticket table (session name and id,
branch, head, round, next step), rulings and open questions. **To resume** after a compaction or restart:
1. read STATE.md;
2. then #45's newest comments;
3. then `claude agents --json`;
4. then `gh pr list`;
5. then each agent's NOTES.txt.

Background sessions survive a closed terminal. A reboot stops them, and they restart where they left off when
attached or messaged.

## Read first
1. `CLAUDE.md`, `docs/sdlc.md` ("Waves", "The review loop"), `docs/knowledge/lessons.md` (sessions 03 and 04,
   all of them).
2. The `orchestrate-wave` skill: your runbook. Load it before launching.
3. `.private/work/session-05/STATE.md`, and #45 (waves 2a and 2b; its newest comments).
4. `docs/plans/M0.md`: "Wave 3", "The contracts fixed here", "Labels".
5. `docs/research/opus-5-5-agentic-orchestration.md` §7: how this model is best driven.

## The owner's rulings in force (#45 and STATE.md have them in full)
- **Accounts:** everything on B. Cost is not the constraint; quality is. Everything local (29 Sep).
- **Review minutes:** "Under 30 min a wave" (29 Sep).
- **Sheet kinds:** "Per-Discipline kinds" (29 Sep; see STATE.md).
- **Access:**
  - A Vextrus Engineer must be staff.
  - Staff reach in the admin is accepted for M0 (#74 before the beta).
  - Activity is for the MD and the QS.
  - The unusable-link words name no Developer.
- **Reading:**
  - A DWG read once shows 4.5's "Failed" row.
  - An item the second reader cannot read holds the file ("Hold it").
  - `failed_stages` counts a killed file.
  - BLAS runs on one thread per file.

## What is broken, unmeasured or waiting
- **The widening gate failed in both of session 04's waves** (2 of 4, then 3 of 3). The causes:
  - words that failed their first gate;
  - fixes that brought new faults;
  - bugs passing CI's 4 cores and failing on the owner's 24.
  Measure whether the new rules met each cause.
- **#77:** the harness's direct path gives a file's process no namespace of its own. Real drawings go only through
  the check.
- **Analysts' findings on 11's merged code** (in STATE.md; give them to 13, or file them):
  - `_shapes` bounds treat a 2–5 number list as a point;
  - a viewport ignores its view target;
  - an inch layout's paper is read in mm.
- **#73** (rate limits) and **#74** (staff reach) come before the beta. **Before M1:** the U+2068/U+2069 isolates.

## Law in force
- Secrets are never printed or written.
- Real drawings stay in `.private/`; only conventions and counts leave it.
- OpenConstructionERP is AGPL: learn, never copy. No AGPL library (PyMuPDF). No proprietary converter is run.
- The product's word is **Rebar**.
- No market literal in code; every visible string through a catalogue; logical CSS only.
- Push only with the owner's yes; only the owner merges.
