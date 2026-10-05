# The machine

- WSL2 with mirrored networking: use `127.0.0.1`, never `localhost`.
- PostgreSQL 18 runs natively on 5432 with two roles, `vextrus` (owns the schema, migrates) and
  `vextrus_app` (the app), passwords in `~/.pgpass`; PostgreSQL 16 on 5544 is the old product's: never
  touch it.
- The toolchain (Python 3.14, LibreDWG, .NET) lives under `/opt/vextrus`; make the venv with
  `UV_PYTHON_INSTALL_DIR=/opt/vextrus/python` (ADR 0034). Node 24.
- The harness's `grep` is ugrep. `/tmp` does not survive a reboot.
- Check `df` and `free` before every launch: eight local builders filled swap, and parallel suites filled
  the disk.
- Cloud sessions have no `.private/` and no real drawings.
