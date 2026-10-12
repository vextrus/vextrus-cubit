"""The QS's corrections to what a read found on a printed sheet (ticket 21c, answering Step 1's
`missing` and `missing_discipline` Questions; S22-FL8, Step 1's Correct act): its number and its
title, typed; its Discipline, chosen among the Market's.

    drawings.services.set_sheet_number(sr.id, "S-02")
    drawings.services.set_sheet_title(sr.id, "Ground floor slab layout")
    drawings.services.typed_number(" S-02 ")              # "S-02", or refused (400): nothing written
    drawings.services.set_sheet_discipline(sr.id, "structural")
    drawings.services.put_back_sheet(sr.id, number="", title="…")  # a correction undone

The printed sheet keeps its id and its place in its file; it moves to the Sheet its new number or
Discipline names (`(set, Building, Discipline, number)`, made when none is), and a Sheet it leaves
with no printed sheet is dropped. A printed sheet the QS has confirmed is not corrected (409): undo
the confirmation first; one left out may be (its number or Discipline answered, it comes back
in). A number or a title is typed text: on one line, decoded, no drawing code, within its column
(a title within `TITLE_LENGTH`).
"""

import unicodedata
import uuid

from django.db import transaction

from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import Decision, Discipline, HeldAnswer, Sheet, SheetRevision
from vextrus.drawings.services import _access, _text, library_disciplines, sheet_list
from vextrus.platform.services import auth


def typed_number(number: object) -> str:
    """A number as the QS typed it, stripped, as it may be kept; else refused (400), before anything
    is written (a NUL or a lone surrogate never reaches a write, nor a correction's act)."""
    typed = number.strip() if isinstance(number, str) else ""
    if not typed or not _one_line(typed) or any(code in typed for code in sheet_list._RAW_CODES):
        raise auth.Refused(said.NUMBER_UNREADABLE(), status=400)
    if not _text.fits((typed, sheet_list._length(Sheet, "number"))):
        raise auth.Refused(said.NUMBER_UNREADABLE(), status=400)
    return typed


def set_sheet_number(sheet_revision_id: uuid.UUID, number: str) -> sheet_list.SheetView:
    """The printed sheet's number, as the QS typed it (a sheet the read found none on)."""
    typed = typed_number(number)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _move(printed, printed.sheet.discipline, typed)
    return sheet_list.sheet(printed.id)


TITLE_LENGTH = 500
"""The longest title the QS may type: a title block's runs to a line or two."""


def typed_title(title: object) -> str:
    """A title as the QS typed it, stripped, as it may be kept; else refused (400), as `typed_number`.
    A title is words: its joiners and soft hyphens are its own (Bangla's ra + ZWJ + virama + ya:
    review 1 of #680), so only a control, a line break or a bidi control refuses it."""
    typed = title.strip() if isinstance(title, str) else ""
    if not typed or not _title_line(typed) or any(code in typed for code in sheet_list._RAW_CODES):
        raise auth.Refused(said.TITLE_UNREADABLE(), status=400)
    if not _text.fits((typed, TITLE_LENGTH)):
        raise auth.Refused(said.TITLE_UNREADABLE(), status=400)
    return typed


def set_sheet_title(sheet_revision_id: uuid.UUID, title: str) -> sheet_list.SheetView:
    """The printed sheet's title, as the QS typed it (a correction). Its numbered Sheet takes it
    where it had none or the old one, so another revision's own title stays."""
    typed = typed_title(title)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _retitle(printed, typed)
    return sheet_list.sheet(printed.id)


def put_back_sheet(
    sheet_revision_id: uuid.UUID, *, number: str | None = None, title: str | None = None
) -> sheet_list.SheetView:
    """A correction undone: the printed sheet's number (none included) and title as they were kept
    before it, each when given. Values once kept, so not checked again as typed text."""
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        if number is not None:
            _move(printed, printed.sheet.discipline, number)
        if title is not None:
            _retitle(printed, title)
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


_BIDI_CONTROLS = frozenset("\u200e\u200f\u061c\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069")
"""Format characters that reorder what prints (marks, embeddings, overrides, isolates)."""


def _title_line(text: str) -> bool:
    """A title as a person types it: one line, no control, no bidi control; other format characters
    (ZWJ, ZWNJ, a soft hyphen) are kept."""
    return _text.typed(text) and not any(
        unicodedata.category(c) in ("Cc", "Zl", "Zp") or c in _BIDI_CONTROLS for c in text
    )


def _undecided(sheet_revision_id: uuid.UUID) -> SheetRevision:
    printed = sheet_list._listed(sheet_revision_id, lock=True)
    if printed.decision == Decision.CONFIRMED:  # a sheet left out may still be corrected
        raise auth.Refused(said.DECIDED_ALREADY(), status=409)
    return printed


def _retitle(printed: SheetRevision, title: str) -> None:
    old = printed.title
    if title == old:
        return
    printed.title = title
    fields = ["title"]
    if printed.plot_title_alike:
        # Its Plot page read the old title: until the page is matched again it reads none, as
        # `record_sheets` does on any title change (#229; review 2 of #680), so the sheet is not
        # one two sources agree on by a title nobody read there.
        printed.plot_title_alike = False
        fields.append("plot_title_alike")
    printed.save(update_fields=fields)
    sheet = Sheet.objects.get(id=printed.sheet_id)
    if sheet.number and sheet.title in {"", old}:
        Sheet.objects.filter(id=sheet.id).update(title=title)


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
    fields = ["sheet"]
    if number != old.number and printed.plot_title_alike:
        # The page was matched to the old number (and read its title there): no longer a second
        # source for the number typed (review 2 of #680).
        printed.plot_title_alike = False
        fields.append("plot_title_alike")
    if target.id == old.id and len(fields) == 1:
        return
    printed.sheet = target
    printed.save(update_fields=fields)
    sheet_list._drop_sheet_if_empty(old.id)


def held_answer(file_id: uuid.UUID) -> HeldAnswer | None:
    """What the QS decided about a held file (its `file_misread` Question), or None: the read job
    reads on only when it is "read anyway"."""
    row = _access.drawing_file(file_id)
    return HeldAnswer(row.held_answer) if row.held_answer else None
