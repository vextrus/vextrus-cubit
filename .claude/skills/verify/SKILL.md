---
name: verify
description: Run the fast check for the changed paths on the staged tree before each commit you finish on, and get the Factory-Verify trailer. Use before every READY commit, and whenever you want to know the staged tree passes.
---

# verify

Stage what the commit will hold (explicit paths), then run, in the foreground with an explicit timeout:

```
uv run python -m scripts.verify > .private/work/<ticket>/verify.txt 2>&1; echo $?
```

`scripts.verify` (`scripts/verify.py`) refuses (exit 2) while a tracked file differs from the index: it
checks exactly the tree `git write-tree` names, the one your next commit carries. It maps the changed
paths (staged against HEAD, plus your commits since the merge base with `origin/main`) to checks and runs
them one after another:

- Python: the changed modules' `pytest -rf`, `ruff check`, `ruff format --check`, `mypy`, `lint-imports`;
- web, in the order that works on a fresh checkout: `export_openapi_schema`, `api:types`, `typecheck`,
  `lint`, `messages:check`, `npm --prefix web test`;
- hooks: `node --test '.claude/hooks/**/*.test.mjs'` (a glob: Node 24 fails on a folder argument);
- workflow scripts: `python -m tools.lint.workflows_js`;
- a Claude Code plugin under `tools/mod/`: `claude plugin validate --json --strict` and `claude plugin
  test` (left out, with a `not run: claude absent` line, when `claude` is not on PATH).

Each check's output is kept under `.private/work/verify/<tree>/`. A failure made only of tests listed as
known flakes is run once more and, if that passes, recorded as a flake. The record goes to
`$(git rev-parse --git-common-dir)/vextrus/verify-<tree>.json`, shared by every worktree, never committed;
the guard's READY push gate reads it.

Exit 0 and a last line `Factory-Verify: <tree> ok` mean every check passed: put that exact line in your
commit's trailers beside `Factory-State: READY`. Exit 1: read the named output files, fix, stage, run it
again. Never hand-write the trailer or the record.
