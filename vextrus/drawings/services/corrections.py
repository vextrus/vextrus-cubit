"""The QS's corrections to what a read found on a printed sheet (ticket 21c, answering Step 1's
`missing` and `missing_discipline` Questions; S22-FL8, Step 1's Correct act): its number and its
title, typed; its Discipline, chosen among the Market's.

    drawings.services.set_sheet_number(sr.id, "S-02")
    drawings.services.set_sheet_title(sr.id, "Ground floor slab layout")
    drawings.services.typed_number(" S-02 ")              # "S-02", or refused (400): nothing written
    drawings.services.set_sheet_discipline(sr.id, "structural")
    drawings.services.put_back_sheet(sr.id, number="", title="…")  # a correction undone
    drawings.services.typed_view_storeys(sr.id, [(view_id, "3rd, 5th", "at_floor_level")])
    drawings.services.set_view_storeys(sr.id, changes)    # a plan view's storeys, typed (S24-B2)
    drawings.services.put_back_view_storeys(sr.id, before)

The printed sheet keeps its id and its place in its file; it moves to the Sheet its new number or
Discipline names (`(set, Building, Discipline, number)`, made when none is), and a Sheet it leaves
with no printed sheet is dropped. A printed sheet the QS has confirmed is not corrected (409): undo
the confirmation first; one left out may be (its number or Discipline answered, it comes back
in). A number or a title is typed text: on one line, decoded, no drawing code, within its column
(a title within `TITLE_LENGTH`).
"""

import re
import unicodedata
import uuid
from collections.abc import Sequence
from dataclasses import dataclass

from django.db import transaction

from engine.messages import MessageCode
from engine.recognise import storeys as storey_reader
from engine.recognise.sheets import default_conventions
from engine.recognise.types import SheetConventions, StoreysMeaning
from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import Decision, Discipline, HeldAnswer, Sheet, SheetRevision, View
from vextrus.drawings.services import _access, _text, library_disciplines, sheet_list
from vextrus.platform.services import auth

TYPED = "typed"
"""A value's source once the QS typed it: not read from the title block, so a sheet carrying it is
not one two sources agree on until the QS confirms it (m0-screens 5; review 3 of #680)."""

_LINE_BREAKS = frozenset("\n\r\v\f\x85\u2028\u2029")


def _refuse_unless_typed(
    typed: str,
    *,
    length: int,
    empty: MessageCode,
    long: MessageCode,
    lines: MessageCode,
    code: MessageCode,
    unprintable: MessageCode,
    bidi: bool,
) -> None:
    """Why typed text is refused, each cause its own message (400), before anything is written."""
    if not typed:
        raise auth.Refused(empty(), status=400)
    if any(c in _LINE_BREAKS for c in typed):
        raise auth.Refused(lines(), status=400)
    if any(c in typed for c in sheet_list._RAW_CODES):
        raise auth.Refused(code(), status=400)
    if len(typed) > length:
        raise auth.Refused(long(limit=length), status=400)
    printable = _title_line(typed) if bidi else _one_line(typed)
    if not printable:
        raise auth.Refused(unprintable(), status=400)


def typed_number(number: object) -> str:
    """A number as the QS typed it, stripped, as it may be kept; else refused (400), before anything
    is written (a NUL or a lone surrogate never reaches a write, nor a correction's act)."""
    typed = number.strip() if isinstance(number, str) else ""
    _refuse_unless_typed(
        typed,
        length=sheet_list._length(Sheet, "number"),
        empty=said.NUMBER_EMPTY,
        long=said.NUMBER_TOO_LONG,
        lines=said.NUMBER_MANY_LINES,
        code=said.NUMBER_DRAWING_CODE,
        unprintable=said.NUMBER_UNREADABLE,
        bidi=False,
    )
    return typed


def set_sheet_number(sheet_revision_id: uuid.UUID, number: str) -> sheet_list.SheetView:
    """The printed sheet's number, as the QS typed it (a sheet the read found none on)."""
    typed = typed_number(number)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _move(printed, printed.sheet.discipline, typed)
        _source(printed, number=TYPED)
    return sheet_list.sheet(printed.id)


TITLE_LENGTH = 500
"""The longest title the QS may type: a title block's runs to a line or two."""


def typed_title(title: object) -> str:
    """A title as the QS typed it, stripped, as it may be kept; else refused (400), as `typed_number`.
    A title is words: its joiners and soft hyphens are its own (Bangla's ra + ZWJ + virama + ya:
    review 1 of #680), so only a control, a line break or a bidi control refuses it."""
    typed = title.strip() if isinstance(title, str) else ""
    _refuse_unless_typed(
        typed,
        length=TITLE_LENGTH,
        empty=said.TITLE_EMPTY,
        long=said.TITLE_TOO_LONG,
        lines=said.TITLE_MANY_LINES,
        code=said.TITLE_DRAWING_CODE,
        unprintable=said.TITLE_UNREADABLE,
        bidi=True,
    )
    return typed


def set_sheet_title(sheet_revision_id: uuid.UUID, title: str) -> sheet_list.SheetView:
    """The printed sheet's title, as the QS typed it (a correction). Its numbered Sheet takes it
    where it had none or the old one, so another revision's own title stays."""
    typed = typed_title(title)
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        _retitle(printed, typed)
        _source(printed, title=TYPED)
    return sheet_list.sheet(printed.id)


STOREYS_LENGTH = 500
"""The longest storey list the QS may type: room for `MAX_STOREYS` listed one by one ("40th floor, ")."""
MAX_STOREYS = 40
"""The most storeys one view may be given: a tall tower's floors listed one by one."""
MEANINGS = (StoreysMeaning.AT_FLOOR_LEVEL.value, StoreysMeaning.FLOOR_TO_FLOOR.value)
"""The meanings a correction picks between; a view read "at ceiling level" is not given it again."""

_LIST_MARKS = re.compile(r"[,;&+/]|\band\b", re.IGNORECASE)
_EDGE = ".: \t"


@dataclass(frozen=True)
class ViewStoreys:
    """A plan view's storeys as kept: their keys low to high, their meaning, where they were read
    (`TYPED`, or none for a reading's own)."""

    view: uuid.UUID
    storeys: tuple[str, ...]
    meaning: str | None
    source: str | None


def typed_storeys(storeys: object) -> tuple[str, ...]:
    """A plan view's storeys as the QS typed them, each listed ("3rd, 5th, 7th"), as the storey keys
    low to high; else refused (400), before anything is written. The words are the engine's
    (`storeys.read`, ADR 0011: code owns storeys), read one item at a time: each item names exactly
    one storey, so a range ("2nd to 6th") or an open end ("1st to top") is refused, and so is a word
    naming no storey. A storey named twice is kept once."""
    typed = storeys.strip() if isinstance(storeys, str) else ""
    _refuse_unless_typed(
        typed,
        length=STOREYS_LENGTH,
        empty=said.STOREYS_EMPTY,
        long=said.STOREYS_TOO_LONG,
        lines=said.STOREYS_MANY_LINES,
        code=said.STOREYS_DRAWING_CODE,
        unprintable=said.STOREYS_UNREADABLE,
        bidi=False,
    )
    items = [item for part in _LIST_MARKS.split(typed) if (item := part.strip(_EDGE))]
    if not items:
        raise auth.Refused(said.STOREYS_EMPTY(), status=400)
    if len(items) > MAX_STOREYS:
        raise auth.Refused(said.STOREYS_TOO_MANY(limit=MAX_STOREYS), status=400)
    conventions = default_conventions()
    read: dict[str, str] = {}
    for item in items:
        key, words = _one_storey(item, conventions)
        read.setdefault(key, words)
    # The engine orders a list low to high; the keys it reads from the items together must be the
    # keys read from each (a list it reads differently is refused, never kept as something else).
    joined = storey_reader.read(", ".join(read.values()), conventions, plan_title=False)
    if set(joined.keys) != set(read) or joined.runs_to is not None or joined.ranged:
        raise auth.Refused(said.STOREYS_UNREADABLE(), status=400)
    return joined.keys


def _one_storey(item: str, conventions: SheetConventions) -> tuple[str, str]:
    """The storey key one typed item names, with the words it was read from ("3rd" is read as "3rd
    floor"): the whole item, naming one storey; else refused (400). Both readings are taken before
    either is accepted: the engine reads "basement to 3rd" as the basement alone, and only the
    reading with a floor word shows the range."""
    spoken = item[:60]
    if not _plain(item):
        raise auth.Refused(said.STOREYS_NOT_A_STOREY(word=spoken), status=400)
    reads = [
        (words, storey_reader.read(words, conventions, plan_title=False))
        for words in (item, f"{item} floor")
    ]
    if _ranges(item, conventions) or any(
        found.ranged or found.runs_to is not None or len(found.keys) > 1 for _words, found in reads
    ):
        raise auth.Refused(said.STOREYS_RANGE(word=spoken), status=400)
    for words, found in reads:
        if (
            len(found.keys) == 1
            and found.keys[0] not in storey_reader.SYMBOLIC
            and not found.below_ground
            and _folded(found.as_stated) == _folded(words)
        ):
            return found.keys[0], words
    raise auth.Refused(said.STOREYS_NOT_A_STOREY(word=spoken), status=400)


def _plain(item: str) -> bool:
    """An item of letters, digits of one script, spaces, hyphens and dots only: the engine skips other
    marks ("3rd!", "3rd *"), which would be kept as a storey nobody typed."""
    if not all(c.isalnum() or c in " -.'" for c in item):
        return False
    scripts = {unicodedata.name(c, "?").split()[0] for c in item if c.isdigit()}
    return len(scripts) <= 1


def _ranges(item: str, conventions: SheetConventions) -> bool:
    """Whether an item holds a range word ("to", "through"). A dash between two storeys ("2nd-6th") is
    seen by the reading with a floor word; one inside a name ("stair-room roof") is not a range."""
    words = {w for phrase in conventions.range_words for w in phrase.casefold().split()}
    return any(w in words for w in item.casefold().split())


def _folded(text: str | None) -> str:
    return " ".join((text or "").casefold().split())


def typed_view_storeys(
    sheet_revision_id: uuid.UUID, given: Sequence[tuple[object, object, object]]
) -> list[tuple[ViewStoreys, ViewStoreys]]:
    """The corrections of a printed sheet's plan views' storeys, each `(view, storeys as typed,
    meaning)`, as `(before, after)` for the views they change (a view given as it already is changes
    nothing); else refused (400) before anything is written: a view that is not one of the sheet's,
    or not a plan, named twice, storeys that cannot be read, a meaning other than the two a correction
    picks. The sheet's views are those of its kept reading."""
    if not given:
        return []
    # The sheet is locked before its views are read, as a re-read of its file locks it before replacing
    # them (`record_views`): the views read here are those the correction writes (review 2 of #780).
    sheet_list._listed(sheet_revision_id, lock=True)
    kept = {v.id: v for v in sheet_list.views(sheet_revision_id)}
    seen: set[uuid.UUID] = set()
    changes: list[tuple[ViewStoreys, ViewStoreys]] = []
    for view_id, storeys, meaning in given:
        view = kept.get(view_id) if isinstance(view_id, uuid.UUID) else None
        if view is None:
            raise auth.Refused(said.STOREYS_VIEW_UNKNOWN(), status=400)
        if (view.confirmed_kind or view.kind) != "plan":
            raise auth.Refused(said.STOREYS_NOT_A_PLAN(), status=400)
        if view.id in seen:
            raise auth.Refused(said.STOREYS_VIEW_TWICE(), status=400)
        seen.add(view.id)
        try:
            keys = typed_storeys(storeys)
            if not isinstance(meaning, str) or meaning not in MEANINGS:
                raise auth.Refused(said.STOREYS_MEANING_UNKNOWN(), status=400)
        except auth.Refused as refused:
            # Which view it is about, for the form to say it under that view's fields (the words stay).
            about = {**refused.message["params"], "view_id": str(view.id), "view_title": view.title[:80]}
            raise auth.Refused(
                {"code": refused.message["code"], "params": about}, status=refused.status
            ) from None
        before = ViewStoreys(view.id, tuple(view.storeys), view.storeys_meaning, view.storeys_source)
        # A part plan (its storeys read from a title line) stays one: it sits out of the same-storey
        # comparison once corrected, as it did before (review of #777).
        part = view.storeys_source in ("title_line", sheet_list.TYPED_PART)
        after = ViewStoreys(view.id, keys, meaning, sheet_list.TYPED_PART if part else TYPED)
        if (before.storeys, before.meaning) != (after.storeys, after.meaning):
            changes.append((before, after))
    return changes


def set_view_storeys(sheet_revision_id: uuid.UUID, changes: Sequence[ViewStoreys]) -> set[uuid.UUID]:
    """Plan views' storeys and meaning as the QS typed them (`typed_view_storeys` first), each marked
    typed; the views written. A view not written (its file read again since: its row replaced) is the
    caller's to refuse. A printed sheet the QS has confirmed is not corrected (409)."""
    return _write_view_storeys(sheet_revision_id, changes)


def put_back_view_storeys(sheet_revision_id: uuid.UUID, before: Sequence[ViewStoreys]) -> None:
    """A correction undone: plan views' storeys, meaning and source as they were kept before it. A
    view gone from the sheet's kept reading (it was read again) holds nothing to put back."""
    _write_view_storeys(sheet_revision_id, before)


def _write_view_storeys(sheet_revision_id: uuid.UUID, kept: Sequence[ViewStoreys]) -> set[uuid.UUID]:
    written: set[uuid.UUID] = set()
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        for one in kept:
            if View.objects.filter(
                id=one.view, sheet_revision=printed, reader_version=printed.reader_version
            ).update(
                storeys=list(one.storeys),
                storeys_meaning=one.meaning or "",
                storeys_source=one.source or "",
            ):
                written.add(one.view)
    return written


def put_back_sheet(
    sheet_revision_id: uuid.UUID,
    *,
    number: str | None = None,
    title: str | None = None,
    number_source: str | None = None,
    title_source: str | None = None,
    plot_title_alike: bool = False,
) -> sheet_list.SheetView:
    """A correction undone: the printed sheet's number (none included) and title as they were kept
    before it, each when given, with its source (the reading's, or the earlier correction's); a value
    put back with no source given was read with none. Values once kept, so not checked again as
    typed text."""
    with transaction.atomic():
        printed = _undecided(sheet_revision_id)
        if number is not None:
            _move(printed, printed.sheet.discipline, number)
            _source(printed, number=number_source or None)
        if title is not None:
            _retitle(printed, title)
            _source(printed, title=title_source or None)
        if plot_title_alike and printed.plot_page is not None:
            # Its Plot page read the title the correction replaced: it reads it again.
            printed.plot_title_alike = True
            printed.save(update_fields=["plot_title_alike"])
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


def _source(printed: SheetRevision, **sources: str | None) -> None:
    """Where the value now kept was read (`SheetRevision.sources`): a typed one is `TYPED`; a value
    put back is its reading's, none when the reading had none."""
    kept = dict(printed.sources)
    for name, source in sources.items():
        if source is None:
            kept.pop(name, None)
        else:
            kept[name] = source
    if kept != printed.sources:
        printed.sources = kept
        printed.save(update_fields=["sources"])


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
