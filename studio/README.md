# The Vextrus Studio

A small local harness for Claude Code, made to work the way the Managed Agents session worked
(`docs/research/2026-10-15-cma-session-lessons.md`). It has one lead, specialists with their own model
and effort, work given as outcomes graded by an independent grader, code checks as the first judge, and
the product looked at in a browser. It has no factory ceremony. The evidence behind it is
`docs/research/2026-10-15-local-harness.md`, and its first use is `docs/handoff/session-31-prompt.md`.

This folder is the public template. The workspace it makes, `~/vextrus-studio`, is private and stays
on the owner's machine, because it holds the Edison set's dissection and the prototype built from it.

## Make the workspace
```sh
studio/bootstrap.sh            # from any checkout or worktree of this repository; once
cd ~/vextrus-studio && claude
```
It copies the newest Managed Agents output (`.private/work/cma/outputs/sesn_*/tree`) into `cma/` as a
read-only baseline, and makes working copies in `proto/`, `data/` and `generator/`. It links the Edison
originals as `drawings/`, installs the harness, makes a Python 3.14 venv for the checks, and commits it
all to a local git repo with no remote.

## What's in it
| Path | What |
|---|---|
| `harness/CLAUDE.md` | The studio's own memory: purpose, layout, how we work, the law. Short on purpose. |
| `harness/claude/agents/` | `grader` (Opus, read-only, its own browser), `model-auditor` (Opus, code checks), `visual-judge` (Opus, its own browser), `builder` (Opus) and `builder-light` (Sonnet), `adversary` (Sonnet), `scout` (Haiku). The bootstrap adds the product repo's `qs-critic`. |
| `harness/claude/workflows/proto-audit.js` | `/proto-audit`: nine lenses find defects, adversaries try to refute each one, the owner's issues come first, and a completeness pass names what nobody looked at. |
| `harness/claude/workflows/outcome.js` | `/outcome`: the builder works the rubric, a fresh grader judges the live result per criterion, and the gaps go back. It repeats until satisfied, or up to 3 rounds. |
| `harness/claude/skills/outcome/` | How the lead turns a cluster of defects into an outcome folder and runs it. |
| `harness/outcomes/RUBRIC-TEMPLATE.md` | Criteria by kind: geometry by code, fidelity by looking, QS figures, screens, budgets, honesty, regression. |
| `harness/claude/settings.json` | Opus 5.5 at `high`, auto permission mode, the product repo readable but not writable, no push, no recursive delete, at most 6 workflow agents at once. |

## Notes
- The workflow scripts were run here only against stub agents, which checked their control flow, dedup
  and round logic. Their first real run is session 31's audit; tune the lens prompts from what it returns.
- Subagents cannot start workflows, so the lead (the main session) runs `/proto-audit` and `/outcome`.
- At most 6 workflow agents run at once (`CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS`), because each
  visual judge and grader starts its own Chromium. Raise it if memory allows (`free -h`).
- An interactive workflow pauses at the plan's usage limit and resumes after the reset. A `-p` or
  background one fails instead, so run the long ones interactively.
