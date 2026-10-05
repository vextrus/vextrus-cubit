---
paths:
  - "scripts/factory/**"
  - ".claude/**"
---
# The factory and the harness (ADR 0042)

- **Hooks** (`.claude/hooks/`): `guard.mjs` (the refusals in CLAUDE.md's Law, plus staging `.private/` or
  drawings, deleting untracked files and edits to reference drawings; its test: `node --test
  .claude/hooks/guard.test.mjs`); `state.mjs` prints the checkout's state at session start;
  `after-bash.mjs` runs `sync` after each commit.
- **Launches:** `uv run python -m scripts.factory.launch cloud|say|local ...` from the main checkout
  (`scripts/factory/launch.py`; its contract: `docs/specs/factory/contracts/launch-cli.md`). It judges
  each cloud launch's debug log and refuses a bundled session or one cloned at the wrong branch.
- **Committed checks** carry the lessons: CI's lints and scans (`tools/lint/`, the acceptance check and
  `docs_paths` among them), the guard's test and each module's tests. Merges pass `scripts/merge_ready.py`.
- **Agents** (`.claude/agents/`): `acceptance-writer` (a ticket's failing acceptance tests, before its
  builder), `pr-reviewer` (every PR and every fix round), `refuter` (one claim), `ux-critic` (a walk, or
  the words-only design gate), `qs-critic` (read-only reviewers) and `drawing-analyst` (local).
- **Skills:** Matt Pocock's (`/ask-matt` routes; his review skill is `/spec-review`), plus our
  `orchestrate-wave` (the orchestrator's runbook), `product-review` and `real-drawings`.
- **MCP:** `chrome-devtools` (a headless browser for walking products).
- **Background agents** die when the app restarts: each long one keeps a `NOTES.txt` progress log and is
  told how to resume from it. Their scratch copies live under `.private/work/`, never `/tmp`.
- **Harness PRs** state `Harness net: +a / -r` in their body: a harness change should remove as much as
  it adds.
