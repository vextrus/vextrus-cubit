"""`platform`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit.
"""

from vextrus.platform.services import events, jobs, library, markets, storage, tenancy

__all__ = ["events", "jobs", "library", "markets", "storage", "tenancy"]
