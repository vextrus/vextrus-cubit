"""The QS's corrections to what a read found on a printed sheet (ticket 21c, answering Step 1's
`missing` and `missing_discipline` Questions): its number, typed; its Discipline, chosen among the
Market's.

    drawings.services.set_sheet_number(sr.id, "S-02")
    drawings.services.set_sheet_discipline(sr.id, "structural")

The printed sheet keeps its id and its place in its file; it moves to the Sheet its new number or
Discipline names (`(set, Building, Discipline, number)`, made when none is), and a Sheet it leaves
with no printed sheet is dropped. A printed sheet the QS has already decided is not corrected (409):
undo the decision first. A number is typed text: decoded, no drawing code, within its column.
"""

import unicodedata
import uuid

from django.db import transaction

from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import Discipline, HeldAnswer, Sheet, SheetRevision
from vextrus.drawings.services import _access, _text, library_disciplines, sheet_list
from vextrus.platform.services import auth


def set_sheet_number(sheet_revision_id: uuid.UUID, number: str) -> sheet_list.SheetView:
    """The printed sheet's number, as the QS typed it (a sheet the read found none on)."""
    typed = number.strip() if isinstance(number, str) else ""
    if not typed or not _one_line(typed) or any(code in typed for code in sheet_list._RAW_CODES):
        raise auth.Refused(said.NUMBER_UNREADABLE(), status=400)
    if not _text.fits((typed, sheet_list._length(Sheet, "number"))):
        raise auth.Refused(said.NUMBER_UNREADABLE(), status=400)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _move(printed, printed.sheet.discipline, typed)
    return sheet_list.sheet(printed.id)


def set_sheet_discipline(sheet_revision_id: uuid.UUID, key: str) -> sheet_list.SheetView:
    """The printed sheet's Discipline, one of the Market's by key (a sheet of none: #102)."""
    market = {d.key: d for d in library_disciplines.market()}
    if not isinstance(key, str) or key not in market:
        raise auth.Refused(file_words.DISCIPLINE_UNKNOWN(), status=400)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _move(printed, market[key], printed.sheet.number)
    return sheet_list.sheet(printed.id)


def _one_line(text: str) -> bool:
    """A number as a person types it: printable on one line, no control or format character (a line
    break, a tab, a bidi override would print a number other than the one kept)."""
    return _text.typed(text) and not any(
        unicodedata.category(c) in ("Cc", "Cf", "Zl", "Zp") for c in text
    )


def _undecided(sheet_revision_id: uuid.UUID) -> SheetRevision:
    printed = sheet_list._listed(sheet_revision_id, lock=True)
    if printed.decision:
        raise auth.Refused(said.DECIDED_ALREADY(), status=409)
    return printed


def _move(printed: SheetRevision, discipline: Discipline | None, number: str) -> None:
    old = printed.sheet
    if number:
        target, _made = Sheet.objects.get_or_create(
            tenant_id=old.tenant_id,
            drawing_set_id=old.drawing_set_id,
            building_id=old.building_id,
            discipline=discipline,
            number=number,
            defaults={"title": printed.title, "storeys_as_stated": printed.storeys_as_stated},
        )
    else:
        target, _made = Sheet.objects.get_or_create(
            tenant_id=old.tenant_id,
            drawing_set_id=old.drawing_set_id,
            source_file_id=printed.source_file_id,
            location_key=printed.location_key,
            number="",
            defaults={
                "building_id": old.building_id,
                "discipline": discipline,
                "title": printed.title,
                "storeys_as_stated": printed.storeys_as_stated,
            },
        )
        if target.discipline_id != (discipline.id if discipline else None):
            Sheet.objects.filter(id=target.id).update(discipline=discipline)
    if target.id == old.id:
        return
    printed.sheet = target
    printed.save(update_fields=["sheet"])
    sheet_list._drop_sheet_if_empty(old.id)


def held_answer(file_id: uuid.UUID) -> HeldAnswer | None:
    """What the QS decided about a held file (its `file_misread` Question), or None: the read job
    reads on only when it is "read anyway"."""
    row = _access.drawing_file(file_id)
    return HeldAnswer(row.held_answer) if row.held_answer else None
