"""`platform`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit.
"""

from vextrus.platform.services import events, jobs, library, markets, storage, tenancy

from vextrus.platform.services import activity, auth, invitations  # isort: skip  (07)
from vextrus.platform.services import jev  # isort: skip  (15)

__all__ = [
    "activity",
    "auth",
    "events",
    "invitations",
    "jev",
    "jobs",
    "library",
    "markets",
    "storage",
    "tenancy",
]
