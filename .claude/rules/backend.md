---
paths:
  - "vextrus/**"
  - "engine/**"
  - "scripts/**"
  - "tools/**"
---
# Backend commands (from the checkout's root)

- `uv sync --locked` (nothing is ever built). `uv run manage.py ensure_database && uv run manage.py
  migrate`: this worktree's own database (`vextrus`, or `vextrus_<worktree>`; `VEXTRUS_DB_NAME`
  overrides); `migrate` and `flush` always run as `vextrus`. `uv run manage.py sync_library`: every
  module's Library rows (the Market's Disciplines among them), idempotent, as `vextrus`. `uv run manage.py
  seed_demo`: the demo; it runs `sync_library` first (or refuses, naming it).
- `VEXTRUS_DEBUG=1 uv run manage.py runserver 127.0.0.1:8000`: the API at `/api/`, the admin at `/admin/`.
- `uv run manage.py worker`: the job worker on the default queue (it runs the stalled-job retrier);
  `uv run manage.py worker --queue cad`: the CAD queue's, one job at a time, under a 4 GiB address-space
  cap (`VEXTRUS_CAD_WORKER_MEMORY_BYTES` in `vextrus/settings/jobs.py`, from ticket 24's measurements:
  `docs/research/m0-measurements.md`). Both refuse to start unless connected as `vextrus_app`. Stop one
  with Ctrl-C or SIGTERM: a running job finishes its current step and is tried again later, its completed
  steps skipped.
- `uv run pytest`: as `vextrus_app`, on a test database named by the migrations' hash (`-m
  needs_toolchain`, `needs_bwrap` or `live` runs those left out). **Fast check:** `uv run pytest
  vextrus/<module> && uv run mypy && uv run lint-imports`. Keep every run's output in a file under
  `.private/work/` (`-rf`).
- **Lints and scans** (as `ci.yml` runs them): `uv run ruff check . && uv run ruff format --check .`;
  `uv run python -m tools.lint.<scan>` (`market_literals`, `migration_ids`, `migration_leaves`,
  `lock_sources`, `docs_paths`); `uv run manage.py makemigrations --check --dry-run`. The OpenAPI schema:
  `uv run manage.py export_openapi_schema --api vextrus.api.api` (never committed).
- `tools/lint/docs_paths.py` refuses a living doc (CLAUDE.md, `.claude/rules/`, the skills, `docs/sdlc.md`,
  `docs/architecture.md`, `docs/agents/`) that names a repo path not on the tree; name only paths on main.
