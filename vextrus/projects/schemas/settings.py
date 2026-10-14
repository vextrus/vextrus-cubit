"""A Building's Gross Floor Area and the Project's Display Units in the API (docs/plans/M1.md C15, A18;
frozen by M1-00, built by M1-44). A Gross Floor Area in any answer is `{value_m2, display: {value,
unit}}`: the stored m² and the figure in the Display Units."""

import uuid
from decimal import Decimal

from ninja import Schema


class GrossFloorAreaIn(Schema):
    """A Gross Floor Area as typed: a decimal and its unit ("sft"), converted exactly."""

    value: Decimal
    unit: str


class AreaDisplayOut(Schema):
    value: Decimal
    unit: str


class GrossFloorAreaOut(Schema):
    value_m2: Decimal
    display: AreaDisplayOut


class BuildingAreaOut(Schema):
    building_id: uuid.UUID
    gross_floor_area: GrossFloorAreaOut | None


class DisplayUnitsIn(Schema):
    """A unit system the Market offers ("metric")."""

    unit_system: str


class DisplayUnitsOut(Schema):
    unit_system: str
