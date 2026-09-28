"""`drawings` (layer 2): Disciplines, Drawing Sets, Revisions, Sheets, Views, and files with their
reports.

The module's anatomy (docs/architecture.md): `models.py` and `migrations/` are private; `services`
and `schemas` are its public surface; `http`, `admin`, `tasks` and `messages` are packages whose
submodules are collected by listing them, so each ticket owns its own submodule; `library.py` holds its
Library rows for `sync_library`; `tests/` its tests.
"""
