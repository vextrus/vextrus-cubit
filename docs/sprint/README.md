# The sprint: many builders, one branch, no orchestrator

This follows how Anthropic's own largest public run worked (docs/research/build-speed.md §2A): every
agent reads the same short prompt, picks the next ready task, builds it, proves it, reviews it,
lands it, and starts over. Git is the only thing they share.

- **No orchestrator session, no relay, no waves.** A task is ready the moment its dependencies land.
- **Local git is the lock.** A claim is a ref that can be created only once. A landing moves
  `sprint` forward only if nobody else moved it during the check; otherwise it merges again and
  re-checks. Both are tested (the scratch run in this folder's commit message).
- **Quality lives in each landing:**
  1. the builder proves its task in the running product;
  2. a fresh `pr-reviewer` reviews the diff, and the builder fixes findings at 50 and above;
  3. `check.sh` runs what CI runs;
  4. a notes file leads with what is not verified.
- **A reviewer and a walker keep everyone honest.** The reviewer reads what landed with fresh eyes.
  The walker walks GOAL.md on the newest `sprint`, as the owner will. Both turn what they find into
  task files, and the builders pick those up.
- **`main` is untouched.** Everything lands on the local branch `sprint`. The owner shows the demo
  from `sprint`, pushes it when satisfied, and merges it through one PR.

## Files
| File | What it is |
|---|---|
| GOAL.md | The walk the owner shows: the finish line |
| agent.md, reviewer.md, walker.md | The three prompts: one task per session |
| tasks/*.md | The DAG: `title`, `priority` (1 first), `deps`, source, "Done when" |
| sprint.sh | `next`, `claim`, `release`, `land`, `status` |
| check.sh | The gate before landing: ruff, the scans, migrations, mypy, lint-imports, pytest; the web's checks when `web/` changed |
| demo.sh | Brings the product up, as the investors will see it |
| notes/, owner/, WALK.md | Each task's record, asks for the owner, the walker's latest walk |

## Starting (the owner, on the machine)
0. **Fold session 05 in.**
   - Tell each running wave-3 builder (13, 14, 19b, 20a) to commit its work on its branch and
     stop.
   - The task files for those tickets tell their new builders to merge those branches first.
1. **Create `sprint`, then commit this folder onto it:**
   ```bash
   cd ~/vextrus-cubit && git switch main && git pull --ff-only && git branch sprint main
   ```
2. **Make one worktree per agent** (b1…b6, reviewer, walker):
   ```bash
   git worktree add -b work-b1 ~/vextrus-sprint/b1 sprint
   ```
   Then, in each worktree:
   ```bash
   UV_PYTHON_INSTALL_DIR=/opt/vextrus/python uv sync --locked
   uv run manage.py ensure_database
   uv run manage.py migrate
   uv run manage.py sync_library
   npm --prefix web ci
   ```
3. **Start each agent in its own terminal, from its worktree:**
   ```bash
   CLAUDE_CONFIG_DIR=~/.claude-b claude --model claude-opus-5-5 --effort high
   ```
   Then say: "Read docs/sprint/agent.md and do it." Use `reviewer.md` or `walker.md` for those two.
   When a session says it landed, or says `IDLE`, type `/clear` and say it again. One task per
   context is deliberate: a fresh context per task is what keeps the tenth task as good as the first.
4. **Watch:**
   - `bash docs/sprint/sprint.sh status` shows every task: ready, claimed by whom, done at which
     commit, or blocked on what.
   - `docs/sprint/WALK.md` shows how much of the demo works now.
   - `docs/sprint/owner/` holds the asks only you can answer.

## Decisions for the owner
- **How many builders.** Six, plus the reviewer and the walker, on 24 cores and 26 GB. Watch
  `free -g`. Every builder runs pytest and sometimes a browser. Usage limits on one account may bind
  before the machine does: a second account's config dir spreads the load.
- **Effort.** `high` for builders; `xhigh` for the drawing-reading tasks (M13, M17, B03 to B05) if
  you want it (docs/research/build-speed.md §2.4).
- **An unattended loop.** My safety check refused to write a script that starts `claude -p` sessions
  in a loop without a person present. Whether to automate the restarts is your decision, made
  knowingly. The prompts work the same either way.

## Unverified
- `check.sh`'s run time on this repository (pytest runs serially), and so how often landings race.
- `demo.sh` from a fresh worktree: the web is not yet wired to the API; S01 does that.
- The M1 and M2 tasks (B, C) have no signed plan. They point at the specs, and each builder designs
  within docs/architecture.md. Expect the reviewer to find more there.
- Whether the B and C tiers can land in 24 hours. Tier A is M0's remaining 13 tickets.
