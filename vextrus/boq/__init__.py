"""`boq` (layer 5): The Priced BOQ computed on read, Cost Bases, Issued Estimates, the Material Schedule.

The module's anatomy (docs/architecture.md): `models.py` and `migrations/` are private; `services`
and `schemas` are its public surface; `http`, `admin`, `tasks` and `messages` are packages whose
submodules are collected by listing them, so each ticket owns its own submodule; `library.py` holds its
Library rows for `sync_library`; `tests/` its tests.
"""
