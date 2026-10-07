"""The Takeoff Steps the Priced BOQ is read by (S16-B; ADR 0007's order, Step 3 to Step 13).

`confirmed(building_id)` is boq's seam on `takeoff`: the step keys whose Takeoff Step is confirmed
in the Building (in M1 a Project has one Building, and `takeoff` reports its steps per Project). A
confirmed step bills its Measurement Lines and drops its allowance whole; an open one is priced by
its allowance while the Building has a Gross Floor Area.

The tests set `confirmed` by name (`steps.confirmed`), so callers look it up on this module at call
time, never by `from ... import confirmed`.
"""

import uuid
from importlib import import_module

STEPS: tuple[str, ...] = (
    "storeys",
    "grid",
    "foundations",
    "columns",
    "beams",
    "slabs",
    "stairs",
    "tanks",
    "walls",
    "rooms",
    "roof",
)
"""Step 3 (storeys) to Step 13 (roof), in Takeoff Step order."""

CONFIRMED = "confirmed"
"""A Takeoff Step's status once every Proposal is decided and no Question is open (`takeoff`)."""

SECTIONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("sub_structure", ("foundations",)),
    ("super_structure", ("storeys", "grid", "columns", "beams", "slabs", "stairs", "tanks", "roof")),
    ("finishes", ("walls", "rooms")),
)
"""The Priced BOQ's sections in print order and the steps billed in each."""


def section_of(step: str) -> str:
    for section, keys in SECTIONS:
        if step in keys:
            return section
    raise ValueError(f"{step!r} is not a Takeoff Step the BOQ reads")


def confirmed(building_id: uuid.UUID) -> frozenset[str]:
    """The step keys confirmed in the Building's Project, as `takeoff` reports them (S16-T2's
    `frame_steps.steps(project_id)`, a row per step with `status` "confirmed" when every Proposal not
    excluded is confirmed and no Question is open). While `takeoff` has no `frame_steps`, none is
    confirmed, so every step keeps its allowance."""
    takeoff = import_module("vextrus.takeoff.services")
    frame = getattr(takeoff, "frame_steps", None)
    if frame is None:
        return frozenset()
    projects = import_module("vextrus.projects.services")
    rows = frame.steps(projects.gfa.project_of(building_id))
    return frozenset(row.step for row in rows if row.status == CONFIRMED) & frozenset(STEPS)
