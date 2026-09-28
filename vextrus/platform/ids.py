"""Ids: every row's id is a UUIDv7 made here, in the app, with no database default.

Models name `vextrus.platform.ids.new_id` as their id's default, so a migration records only that
path and never `uuid.uuid7` itself: were the generator ever swapped (a backport on another Python),
no migration changes (docs/research/stack-versions.md, problem 2). The migration scan
(`tools/lint/migration_ids.py`) fails any migration naming `uuid7`.
"""

import uuid


def new_id() -> uuid.UUID:
    """A new UUIDv7: time-ordered, so ids made later sort later and index well."""
    return uuid.uuid7()
