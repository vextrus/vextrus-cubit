"""`drawings`'s Library rows, which `sync_library` (02) reads: each Market's Disciplines (ticket 14;
docs/data-model.md §3.2; the M0 plan's review Q8).

A Discipline has one name everywhere, held here as data (`labels`, one per language), and the sheet-
number prefixes it is known by, which the file name's default and the recognisers' conventions read
(`services.conventions`). They are Market data, not code: a Market's rows are keyed by its code, and a
Market with none has no Disciplines until its rows are added here. A key is permanent (other modules
hold it by value), so a row is never removed; a change to a name, a prefix or the order is written by
the next `sync_library`.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from vextrus.drawings.models import Discipline, DisciplineKind
from vextrus.platform.services.library import Library


@dataclass(frozen=True)
class DisciplineRow:
    key: str
    labels: Mapping[str, str]
    kind: DisciplineKind
    prefixes: tuple[str, ...]


def _row(key: str, name: str, kind: DisciplineKind, *prefixes: str) -> DisciplineRow:
    return DisciplineRow(key, {"en": name}, kind, prefixes)


MEP = DisciplineKind.MEP

DISCIPLINES: Mapping[str, Sequence[DisciplineRow]] = {
    # Bangladesh (ADR 0040; the M0 plan's review Q8): one name each, used everywhere; the prefixes
    # are the list 13's default conventions carry (the orchestrator's decision of 29 Sep 2026).
    "BD": (
        _row("structural", "Structural", DisciplineKind.STRUCTURAL, "S", "ST", "STR"),
        _row("architectural", "Architectural", DisciplineKind.ARCHITECTURAL, "A", "AR", "ARC", "ARCH"),
        _row("electrical", "Electrical", MEP, "E", "EL", "ELE", "ELEC"),
        _row("plumbing", "Plumbing and sanitary", MEP, "P", "PL", "PLB", "SAN"),
        _row("fire", "Fire", MEP, "F", "FF", "FP", "FS"),
        _row("mechanical", "Mechanical (HVAC)", MEP, "M", "MEC", "MECH", "HVAC"),
        _row("lift", "Lift", MEP, "L", "LF", "LIFT"),
        _row("gas", "Gas", MEP, "G", "GS", "GAS"),
    ),
}
"""Each Market's Disciplines, by the Market's code, in the order the Market lists them."""


def check(rows: Sequence[DisciplineRow]) -> None:
    """Refuse a Market's list that could not default a file's Discipline unambiguously: a key or a
    prefix given twice (case aside), or a row without its English name."""
    keys = [row.key for row in rows]
    if len(set(keys)) != len(keys):
        raise ValueError(f"a Discipline's key is given twice: {keys}")
    prefixes = [prefix.casefold() for row in rows for prefix in row.prefixes]
    if len(set(prefixes)) != len(prefixes):
        raise ValueError(f"a sheet-number prefix names two Disciplines: {sorted(prefixes)}")
    for row in rows:
        if not row.labels.get("en"):
            raise ValueError(f"the Discipline {row.key} has no English name")


def sync(libraries: Sequence[Library], using: str) -> int:
    """Write each Market's Disciplines into its Library, through `using` (the owner); the rows
    created or changed (0 when every row is already as written here)."""
    written = 0
    for library in libraries:
        rows = DISCIPLINES.get(library.market_code, ())
        check(rows)
        held = {
            row.key: row for row in Discipline.objects.using(using).filter(tenant_id=library.library_id)
        }
        for order, row in enumerate(rows, start=1):
            wanted = {
                "labels": dict(row.labels),
                "kind": str(row.kind),
                "sort_order": order,
                "prefixes": list(row.prefixes),
            }
            found = held.get(row.key)
            if found is None:
                Discipline.objects.using(using).create(
                    tenant_id=library.library_id, key=row.key, **wanted
                )
                written += 1
            elif any(getattr(found, name) != value for name, value in wanted.items()):
                for name, value in wanted.items():
                    setattr(found, name, value)
                found.save(using=using, update_fields=list(wanted))
                written += 1
    return written
