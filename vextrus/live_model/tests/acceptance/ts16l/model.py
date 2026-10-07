"""Shared helpers for S16-L's acceptance tests: a Building in a QS's Project, and the changes `apply`
takes (the seam `vextrus.live_model.services.StateChange`, named by M1.md C7's `apply` signature).

The StateChange's fields are this writer's pin of the seam C7 names without fields: `family` (an
Element Family's key), `identity_key` (C7's `<family>|<grid ref>|<storey>`), `mark`, `grid_ref`,
`attrs` (C8 keys, SI decimal strings) and `trace` (C7's ElementTrace: fact, kind, anchor).
"""

import uuid
from typing import Any

from django.db import connections

from vextrus.live_model import models as _models
from vextrus.live_model import services as _services
from vextrus.testing.drawings import QsProject

# The module's services and tables, typed loosely so the names S16-L adds type-check before it is built.
live: Any = _services
tables: Any = _models

ANCHOR = {
    "sheet_id": "11111111-1111-4111-8111-111111111111",
    "view_id": "22222222-2222-4222-8222-222222222222",
    "handle": "1F",
}


def building_of(project: QsProject) -> uuid.UUID:
    """The one Building of the Project, read as its member under row-level security."""
    with project.member.acting(), connections["default"].cursor() as cursor:
        cursor.execute("select id from projects_building where project_id = %s", [project.project_id])
        return uuid.UUID(str(cursor.fetchone()[0]))


def column(b: str = "0.254", d: str = "0.508", *, mark: str = "C2", grid_ref: str = "B/2") -> Any:
    return live.StateChange(
        family="column",
        identity_key=f"column|{grid_ref}|floor_1",
        mark=mark,
        grid_ref=grid_ref,
        attrs={"vx.column.section_b": b, "vx.column.section_d": d},
        trace=[{"fact": "size", "kind": "sheet_entity", "anchor": ANCHOR}],
    )
