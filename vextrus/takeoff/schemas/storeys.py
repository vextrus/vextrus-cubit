"""Step 3's storeys and View Placements in the API (docs/plans/M1.md C19; frozen by M1-00, built by
M1-32a). Levels are metres in the Building frame; a typed level arrives with its unit and is converted
exactly by the Units rule."""

import uuid
from decimal import Decimal
from typing import Literal

from ninja import Schema

from vextrus.takeoff.schemas.refs import SheetRefOut, StoreyRefOut


class StoreyRowOut(Schema):
    """A storey: its name on screen (never its key), order, levels (m) and where they came from."""

    id: uuid.UUID
    key: str
    name: str
    order: int
    slab_level_m: Decimal | None
    finished_level_m: Decimal | None
    height_m: Decimal | None
    basis: Literal["read", "typed", "derived"]


class ViewPlacementOut(Schema):
    """Where a view sits: its sheet, its meaning, and the storeys it shows."""

    view_id: uuid.UUID
    sheet: SheetRefOut
    meaning: Literal["at_floor_level", "floor_to_floor"]
    storeys: list[StoreyRefOut]


class StoreysOut(Schema):
    storeys: list[StoreyRowOut]
    view_placements: list[ViewPlacementOut]


class StoreyLevelIn(Schema):
    """A typed level (O3): a decimal and its unit ("m")."""

    value: Decimal
    unit: str


class ViewPlacementIn(Schema):
    """The storeys a view shows, as the QS corrects them."""

    storeys: list[uuid.UUID]
