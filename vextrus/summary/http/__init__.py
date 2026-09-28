"""`summary`'s HTTP operations: one `router` holding every submodule's `router`.

Each ticket writes its own submodule (`http/<name>.py`, defining `router = Router()`); they are found
by listing this package, so no ticket edits this file.
"""

from vextrus.routers import collect_router

router = collect_router(__name__)
