"""A Building's Gross Floor Area (S16-B; M1.md C15): entered by the QS in sft or m2, stored in m2.

    gfa.set_gross_floor_area(building_id, Decimal("12000"), "sft", project_id=project.id)
    gfa.gross_floor_area(building_id)   # GrossFloorArea(m2=Decimal("1114.8365"), ...) or None

The conversion is exact (1 sft = 0.09290304 m2, by definition) and rounded once, to the column's
four places, so the same area typed in either unit is one stored value. A Building is found as a
Project is: only in a Project the current Membership may open, and only under `project_id` when it
is given; any other is `ProjectNotFound`, the one "not found".
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from vextrus.platform.services import auth, events, tenancy
from vextrus.projects.messages import gfa as said
from vextrus.projects.models import Building
from vextrus.projects.services.projects import ProjectNotFound, _open

M2_PER_SFT = Decimal("0.09290304")
"""The international foot squared, exactly."""
UNITS = ("sft", "m2")
PLACES = Decimal("0.0001")
"""The column's four places (`Building.gross_floor_area_m2`, dec(14,4))."""
LARGEST = Decimal("9999999999.9999")


@dataclass(frozen=True)
class GrossFloorArea:
    building_id: uuid.UUID
    m2: Decimal
    entered_by: uuid.UUID | None
    entered_at: datetime | None

    @property
    def sft(self) -> Decimal:
        """The area in sft, unrounded (the allowances multiply by it before they round)."""
        return self.m2 / M2_PER_SFT


def to_m2(value: Decimal | int | str, unit: str) -> Decimal:
    """The area in m2 to four places, or `auth.Refused(NOT_AN_AREA)`: a unit not offered, a value
    that is not a finite number, not positive once rounded, or too large for the column."""
    refused = auth.Refused(said.NOT_AN_AREA(units=", ".join(UNITS)), status=400)
    if unit not in UNITS:
        raise refused
    try:
        area = Decimal(str(value).strip())
    except InvalidOperation:
        raise refused from None
    if not area.is_finite() or area.adjusted() > LARGEST.adjusted():
        # Too large to round to four places in Decimal's context: refused before `quantize` raises.
        raise refused
    m2 = (area * M2_PER_SFT if unit == "sft" else area).quantize(PLACES, rounding=ROUND_HALF_UP)
    if not Decimal(0) < m2 <= LARGEST:
        raise refused
    return m2


def set_gross_floor_area(
    building_id: uuid.UUID,
    value: Decimal | int | str,
    unit: str,
    *,
    project_id: uuid.UUID | None = None,
) -> GrossFloorArea:
    """Enter a Building's Gross Floor Area and write one DomainEvent under the acting user."""
    m2 = to_m2(value, unit)
    with transaction.atomic():
        building = _building(building_id, project_id, lock=True)
        building.gross_floor_area_m2 = m2
        building.gfa_entered_by = tenancy.current().user_id
        building.gfa_entered_at = timezone.now()
        building.save(update_fields=["gross_floor_area_m2", "gfa_entered_by", "gfa_entered_at"])
        events.record(
            said.ENTERED,
            subject_type="building",
            subject_id=building.id,
            project_id=building.project_id,
            building_id=building.id,
            actor_user_id=building.gfa_entered_by,
        )
    return _view(building)


def gross_floor_area(
    building_id: uuid.UUID, *, project_id: uuid.UUID | None = None
) -> GrossFloorArea | None:
    """The Building's Gross Floor Area, or None while none is entered."""
    building = _building(building_id, project_id)
    if building.gross_floor_area_m2 is None:
        return None
    return _view(building)


def _building(building_id: uuid.UUID, project_id: uuid.UUID | None, *, lock: bool = False) -> Building:
    found = Building.objects.filter(id=building_id, project_id__in=_open().values("id"))
    if project_id is not None:
        found = found.filter(project_id=project_id)
    if lock:
        found = found.select_for_update()
    building = found.first()
    if building is None:
        raise ProjectNotFound(project_id)
    return building


def _view(building: Building) -> GrossFloorArea:
    assert building.gross_floor_area_m2 is not None
    return GrossFloorArea(
        building.id, building.gross_floor_area_m2, building.gfa_entered_by, building.gfa_entered_at
    )
