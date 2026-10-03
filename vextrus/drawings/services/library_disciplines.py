"""The acting Developer's Market's Disciplines (ticket 14), and a file's Discipline read from its name.

The Disciplines are Library rows, read through `app.library_id` (row-level security admits the
Market's Library for reading only); a Developer names one by its key and `drawings` holds it by id.

**A file's Discipline from its name:** the name's whole words (split at anything but a letter or a
digit, the extension left off) against each Discipline's file-name forms (`name_forms`, Market data:
#168), case aside, a form of several words matching them in a row: exactly one Discipline matched
gives it; none, or several, gives none. "KR-STR-R0.dwg" is Structural by `STR`; "site-photos.pdf"
matches none; "KR-STR-ARC.dwg" matches two, so none.

    [structural, *_] = drawings.services.disciplines()
    drawings.services.conventions(file_id)  # (DisciplineConvention("structural", ("S", "ST", "STR")), …)
"""

import uuid
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.db.models import QuerySet

from engine.recognise.types import DisciplineConvention
from vextrus.drawings.library import words
from vextrus.drawings.models import Discipline, DisciplineKind
from vextrus.drawings.services import _access
from vextrus.platform.services import markets, tenancy


@dataclass(frozen=True)
class DisciplineView:
    id: uuid.UUID
    key: str
    labels: dict[str, str]
    """Its one name per language (data, not catalogue words: m0-screens §1.1)."""
    kind: str
    prefixes: tuple[str, ...]


def disciplines() -> list[DisciplineView]:
    """The Market's Disciplines, in the Market's order (none when acting in no Developer)."""
    return [_view(row) for row in _library().order_by("sort_order", "key")]


def conventions(file_id: uuid.UUID) -> tuple[DisciplineConvention, ...]:
    """The Disciplines a file's sheets are read among (21b puts them over the default conventions):
    its Market's, each by key with its prefixes."""
    _access.drawing_file(file_id)
    return tuple(DisciplineConvention(d.key, d.prefixes) for d in disciplines())


def notes_disciplines(file_id: uuid.UUID) -> tuple[str, ...]:
    """The keys of the file's Market's notes Disciplines (kind `notes`: General, #159), whose sheets are
    general notes: every view of theirs is Step 2's (17's `ViewConventions.notes_disciplines`)."""
    _access.drawing_file(file_id)
    return tuple(d.key for d in disciplines() if d.kind == DisciplineKind.GENERAL)


def labels_of(discipline_id: uuid.UUID | None) -> dict[str, str]:
    if discipline_id is None:
        return {}
    found = _library().filter(id=discipline_id).values_list("labels", flat=True).first()
    return dict(found or {})


def name(labels: Mapping[str, str]) -> str:
    """A Discipline's name in the Market's language (English is the one shipped)."""
    acting = tenancy.current()
    language = "en"
    if acting.tenant_id is not None:
        language = markets.of_developer(acting.tenant_id).default_language
    return labels.get(language) or labels.get("en") or ""


def by_key(key: str) -> Discipline | None:
    """The Market's Discipline with this key, or None (another Market's is not the Market's)."""
    if not isinstance(key, str):
        return None
    return _library().filter(key=key).first()


def from_name(name: str, candidates: Iterable[Discipline]) -> Discipline | None:
    """The one Discipline the name's whole words name by its file-name forms, or None (none or
    several)."""
    named = words(PurePosixPath(name).stem)
    matched = [
        discipline
        for discipline in candidates
        if any(_in_a_row(words(form), named) for form in _forms(discipline))
    ]
    return matched[0] if len(matched) == 1 else None


def _forms(discipline: Discipline) -> list[str]:
    """Its file-name forms; none when the row holds anything but a list (a hand-edited row, put back
    by the next `sync_library`): a bare string is no list of one-letter forms."""
    held = discipline.name_forms
    return [form for form in held if isinstance(form, str)] if isinstance(held, list) else []


def _in_a_row(form: tuple[str, ...], named: tuple[str, ...]) -> bool:
    width = len(form)
    return width > 0 and any(named[at : at + width] == form for at in range(len(named) - width + 1))


def market() -> list[Discipline]:
    return list(_library().order_by("sort_order", "key"))


def _library() -> QuerySet[Discipline]:
    library_id = tenancy.current().library_id
    if library_id is None:
        return Discipline.objects.none()
    return Discipline.objects.filter(tenant_id=library_id)


def _view(row: Discipline) -> DisciplineView:
    return DisciplineView(row.id, row.key, dict(row.labels), row.kind, tuple(row.prefixes))
