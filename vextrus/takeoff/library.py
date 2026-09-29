"""`takeoff`'s Library rows, which `sync_library` (02) reads (ticket 19a; docs/data-model.md §3.4; the
M0 plan's review A9): the fourteen Takeoff Steps (ADR 0007) and every Check of the engine's catalogue
(`engine.check.catalogue.entries()`), each with its kind and the code of its words; and each Market's
Disciplines a Drawing Set is expected to carry (docs/specs/bd-defaults.md, "MEP conventions"), which
Step 1's "Disciplines not yet received" reads.

A row's identity is `(tenant_id, key)` for a step, `(tenant_id, key, version)` for a Check. A key is
permanent (other rows hold it by value), so no row is ever removed; a change to a name, an order or a
Check's words is written by the next `sync_library`.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from engine.check import catalogue
from vextrus.platform.services.library import Library
from vextrus.takeoff.models import Check, TakeoffStep


@dataclass(frozen=True)
class StepRow:
    key: str
    name: str
    discipline: str
    """`building` for the steps that read the whole Building, else its Discipline Part's key."""
    milestone: str


STEPS: tuple[StepRow, ...] = (
    StepRow("sheets", "Sheets", "building", "M0"),
    StepRow("general_notes", "General Notes and Specification", "building", "M1"),
    StepRow("storeys", "Storeys and levels", "building", "M1"),
    StepRow("grid", "Grid", "building", "M1"),
    StepRow("foundations", "Foundations and substructure", "structural", "M1"),
    StepRow("columns", "Columns, shear walls and the lift core", "structural", "M1"),
    StepRow("beams", "Beams", "structural", "M1"),
    StepRow("slabs", "Slabs", "structural", "M1"),
    StepRow("stairs", "Stairs, landing beams and the lift pit", "structural", "M2"),
    StepRow("tanks", "Tanks", "structural", "M2"),
    StepRow("walls", "Walls and openings", "architectural", "M2"),
    StepRow("rooms", "Rooms and finishes", "architectural", "M2"),
    StepRow("roof", "Roof", "architectural", "M2"),
    StepRow("site_mep", "Site works and MEP", "building", "M2"),
)
"""The fourteen Takeoff Steps in the building-first order (ADR 0007): step n is `STEPS[n - 1]`."""
SHEETS = STEPS[0].key
"""Step 1's key."""


@dataclass(frozen=True)
class Expected:
    """A Discipline a Market's Drawing Set is expected to carry; `from_storeys`: only for a Building
    of that many storeys or more (while the count is not known, it is expected)."""

    discipline: str
    from_storeys: int | None = None


EXPECTED: Mapping[str, Sequence[Expected]] = {
    # Bangladesh (docs/specs/bd-defaults.md, "MEP conventions"): the structural, architectural,
    # electrical, plumbing and sanitary and lift sets a Dhaka Developer's consultants issue, and Fire
    # for buildings of 7 or more storeys (the Fire Rules 2014). Mechanical (HVAC) and Gas are drawn on
    # few residential projects, so their absence is not flagged.
    "BD": (
        Expected("structural"),
        Expected("architectural"),
        Expected("electrical"),
        Expected("plumbing"),
        Expected("fire", from_storeys=7),
        Expected("lift"),
    ),
}
"""Each Market's expected Disciplines, by the Market's code, in the order Step 1 lists them."""


def sync(libraries: Sequence[Library], using: str) -> int:
    """Write the Takeoff Steps and the Checks into each Market's Library, through `using` (the
    owner); the rows created or changed (0 when every row is already as written here)."""
    written = 0
    entries = catalogue.entries()
    for library in libraries:
        steps = TakeoffStep.objects.using(using).filter(tenant_id=library.library_id)
        held_steps = {row.key: row for row in steps}
        for number, step in enumerate(STEPS, start=1):
            wanted = {
                "number": number,
                "labels": {"en": step.name},
                "discipline": step.discipline,
                "milestone": step.milestone,
            }
            written += _put(TakeoffStep, using, library, held_steps.get(step.key), step.key, wanted)
        checks = Check.objects.using(using).filter(tenant_id=library.library_id)
        held_checks = {(row.key, row.version): row for row in checks}
        for entry in entries:
            wanted_check = {
                "kind": entry.kind,
                "message_code": entry.message,
                "milestone": entry.milestone,
            }
            row = held_checks.get((entry.code, entry.version))
            if row is None:
                Check.objects.using(using).create(
                    tenant_id=library.library_id, key=entry.code, version=entry.version, **wanted_check
                )
                written += 1
            elif any(getattr(row, name) != value for name, value in wanted_check.items()):
                for name, value in wanted_check.items():
                    setattr(row, name, value)
                row.save(using=using, update_fields=list(wanted_check))
                written += 1
    return written


def _put(
    model: type[TakeoffStep],
    using: str,
    library: Library,
    row: TakeoffStep | None,
    key: str,
    wanted: dict[str, object],
) -> int:
    if row is None:
        model.objects.using(using).create(tenant_id=library.library_id, key=key, **wanted)
        return 1
    if all(getattr(row, name) == value for name, value in wanted.items()):
        return 0
    for name, value in wanted.items():
        setattr(row, name, value)
    row.save(using=using, update_fields=list(wanted))
    return 1
