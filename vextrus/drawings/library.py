"""`drawings`'s Library rows, which `sync_library` (02) reads: each Market's Disciplines (ticket 14;
docs/data-model.md §3.2; the M0 plan's review Q8).

A Discipline has one name everywhere, held here as data (`labels`, one per language), the sheet-
number prefixes it is known by, which the recognisers' conventions read (`services.conventions`), and
the forms a file's name gives it by (`name_forms`, #168), which the file's default reads (whole words,
case aside; a form of several words matches them in a row). They are Market data, not code: a
Market's rows are keyed by its code, and a Market with none has no Disciplines until its rows are
added here. A key is permanent (other modules
hold it by value), so a row is never removed; a change to a name, a prefix, a form or the order is
written by the next `sync_library`.
"""

import re
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
    name_forms: tuple[str, ...]


_WORDS = re.compile(r"[^\W_]+")


def words(text: str) -> tuple[str, ...]:
    """A text's whole words, case aside: split at anything but a letter or a digit."""
    return tuple(word.casefold() for word in _WORDS.findall(text))


def _row(
    key: str, name: str, kind: DisciplineKind, prefixes: Sequence[str] = (), forms: Sequence[str] = ()
) -> DisciplineRow:
    """A row whose file-name forms are its key, its prefixes and `forms` (the forms 13's file-name
    default read before #168, kept, and the ones #168 adds)."""
    return DisciplineRow(key, {"en": name}, kind, tuple(prefixes), (key, *prefixes, *forms))


MEP = DisciplineKind.MEP
NOTES_KIND = DisciplineKind.GENERAL
"""The kind of a Market's General Discipline (#159): its sheets are general notes, Step 2's."""

DISCIPLINES: Mapping[str, Sequence[DisciplineRow]] = {
    # Bangladesh (ADR 0040; the M0 plan's review Q8): one name each, used everywhere; the prefixes
    # are the list 13's default conventions carry (the orchestrator's decision of 29 Sep 2026).
    "BD": (
        _row("structural", "Structural", DisciplineKind.STRUCTURAL, ("S", "ST", "STR")),
        _row(
            "architectural",
            "Architectural",
            DisciplineKind.ARCHITECTURAL,
            ("A", "AR", "ARC", "ARCH"),
            ("architecture", "architect", "architects"),
        ),
        _row("electrical", "Electrical", MEP, ("E", "EL", "ELE", "ELEC")),
        _row("plumbing", "Plumbing and sanitary", MEP, ("P", "PL", "PLB", "SAN")),
        _row("fire", "Fire", MEP, ("F", "FF", "FP", "FS")),
        _row("mechanical", "Mechanical (HVAC)", MEP, ("M", "MEC", "MECH", "HVAC")),
        _row("lift", "Lift", MEP, ("L", "LF", "LIFT")),
        _row("gas", "Gas", MEP, ("G", "GS", "GAS")),
        # #159 (the owner's ruling, session 07): the general notes a file carries in its own bare-
        # numbered series; no prefix (G is Gas's). Its sheets are Step 2's notes. #168's ruling: a
        # name's "general" gives it; "notes" alone gives nothing (another Discipline's file has notes).
        _row("general", "General", DisciplineKind.GENERAL, (), ("general note", "general notes")),
    ),
}
"""Each Market's Disciplines, by the Market's code, in the order the Market lists them."""


def check(rows: Sequence[DisciplineRow]) -> None:
    """Refuse a Market's list that could not default a file's Discipline unambiguously: a key, a
    prefix or a file-name form given twice (case aside), a form with no word, or a row without its
    English name."""
    keys = [row.key for row in rows]
    if len(set(keys)) != len(keys):
        raise ValueError(f"a Discipline's key is given twice: {keys}")
    prefixes = [prefix.casefold() for row in rows for prefix in row.prefixes]
    if len(set(prefixes)) != len(prefixes):
        raise ValueError(f"a sheet-number prefix names two Disciplines: {sorted(prefixes)}")
    forms = [form for row in rows for form in set(map(words, row.name_forms))]
    if () in forms:
        raise ValueError("a file-name form has no word")
    if len(set(forms)) != len(forms):
        raise ValueError(f"a file-name form names two Disciplines: {sorted(forms)}")
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
                "name_forms": list(row.name_forms),
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
