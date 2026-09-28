"""The acting Developer's Market's Disciplines (ticket 14), and a file's Discipline read from its name.

The Disciplines are Library rows, read through `app.library_id` (row-level security admits the
Market's Library for reading only); a Developer names one by its key and `drawings` holds it by id.

**A file's Discipline from its name:** the name's whole words (split at anything but a letter or a
digit, the extension left off) against each Discipline's key and prefixes, case aside: exactly one
Discipline matched gives it; none, or several, gives none. "KR-STR-R0.dwg" is Structural by `STR`;
"site-photos.pdf" matches none; "KR-STR-ARC.dwg" matches two, so none.

    [structural, *_] = drawings.services.disciplines()
    drawings.services.conventions(file_id)  # (DisciplineConvention("structural", ("S", "ST", "STR")), …)
"""

import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import PurePosixPath

from django.db.models import QuerySet

from engine.recognise.types import DisciplineConvention
from vextrus.drawings.models import Discipline
from vextrus.drawings.services import _access
from vextrus.platform.services import tenancy

_WORDS = re.compile(r"[^\W_]+")


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


def labels_of(discipline_id: uuid.UUID | None) -> dict[str, str]:
    if discipline_id is None:
        return {}
    found = _library().filter(id=discipline_id).values_list("labels", flat=True).first()
    return dict(found or {})


def by_key(key: str) -> Discipline | None:
    """The Market's Discipline with this key, or None (another Market's is not the Market's)."""
    if not isinstance(key, str):
        return None
    return _library().filter(key=key).first()


def from_name(name: str, candidates: Iterable[Discipline]) -> Discipline | None:
    """The one Discipline the name's whole words name, or None (none or several)."""
    words = {word.casefold() for word in _WORDS.findall(PurePosixPath(name).stem)}
    matched = [
        discipline
        for discipline in candidates
        if words & {discipline.key.casefold(), *(p.casefold() for p in discipline.prefixes)}
    ]
    return matched[0] if len(matched) == 1 else None


def market() -> list[Discipline]:
    return list(_library().order_by("sort_order", "key"))


def _library() -> QuerySet[Discipline]:
    library_id = tenancy.current().library_id
    if library_id is None:
        return Discipline.objects.none()
    return Discipline.objects.filter(tenant_id=library_id)


def _view(row: Discipline) -> DisciplineView:
    return DisciplineView(row.id, row.key, dict(row.labels), row.kind, tuple(row.prefixes))
