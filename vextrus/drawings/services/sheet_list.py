"""Sheets and views: what a read keeps of them, the sheet list, and what the QS decides (ticket 14;
for 21b, 19a and 21c; docs/data-model.md §3.2).

    [sr, *_] = drawings.services.record_sheets(file_id, candidates)    # 13's, group = file's group
    drawings.services.record_views(sr.id, view_candidates)              # 17's
    drawings.services.record_render(sr.id, buffers)                     # 11's SheetBuffers
    drawings.services.record_plot(sr.id, match)                         # 18's PlotMatch, or a PlotNone
    drawings.services.sheets(set_id, "structural")                      # Step 1's printed sheets
    drawings.services.confirm_sheet(sr.id, confirmation_id=c.id, kind="beam_layout")
    drawings.services.exclude(view.id, "superseded", confirmation_id=c.id)
    drawings.services.undo(c.id)                                         # every decision it stamped

**One row per printed sheet** (a SheetRevision): a Sheet is `(set, Building, Discipline, number)`,
or for a sheet with no number `(set, source file, location)`; each place in a file is one printed
sheet. A sheet's Building is its file's, its Discipline its file's, else its number's prefix (as 13
read it); its group must be its file's (`FileView.group`). Recording a file's sheets again (a step
run again) keeps each printed sheet at its place, updates what was read, and drops those no longer
found; a printed sheet the QS has confirmed or left out is never changed or dropped by a reading
(`drawings.reads.decided`, 409).

**Nothing from a cancelled, failed, held or refused file is in the sheet list**, though its recorded
steps remain; a held file read anyway is in it, its sheets marked (`held`).

Titles, numbers and every word stored must be decoded already (11's `engine.text.decode`): a value
still holding `%%`, `\\P`, `\\f`, `\\S`, `^J` or `{\\` is refused. A render must be a sheet buffer
`SheetBuffers.from_bytes` reads; a Plot page must be of a PDF of the same Drawing Set.
"""

import hashlib
import json
import re
import uuid
from collections.abc import Collection, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db import models, transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from engine.messages import Message
from engine.read.anchor import Anchor, DwgAnchor
from engine.recognise.types import ExclusionReason as EngineExclusion
from engine.recognise.types import (
    PlotMatch,
    SheetCandidate,
    SheetLocation,
    ValueSource,
    ViewCandidate,
)
from engine.render.buffers import BufferError, SheetBuffers
from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import reads as refusal
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import (
    Decision,
    Discipline,
    DisciplineKind,
    DisciplineSource,
    DrawingFile,
    ExclusionReason,
    FileFormat,
    PlotNone,
    ReadStatus,
    Sheet,
    SheetRevision,
    StateSheet,
    View,
    ViewKind,
)
from vextrus.drawings.services import _access, _text, drawing_files, library_disciplines, reads
from vextrus.drawings.services.stored_anchor import StoredAnchor
from vextrus.platform.services import auth, storage, tenancy

_RAW_CODES = ("%%", "\\P", "\\f", "\\S", "^J", "{\\")
_KEY = re.compile(r"[a-z][a-z0-9_]*")
_NATURAL = re.compile(r"(\d+)")
_UNITS = {1: "inch", 2: "ft", 4: "mm", 6: "m"}
RENDER_MEDIA_TYPE = "application/vnd.vextrus.sheet-buffer"


@dataclass(frozen=True)
class PlotView:
    file_id: uuid.UUID | None
    """The PDF: its page's file, or the one that matched no page or was refused."""
    page: int | None
    transform: dict[str, Any] | None
    """Sheet to page: scale, rotation (0, 90, 180 or 270) and offset, as decimal strings."""
    residual: str | None
    render_f1: str | None
    none: Message | None
    """Why there is no Plot (m0-screens 4.6), or None when a page matched."""


@dataclass(frozen=True)
class SheetView:
    id: uuid.UUID
    """The printed sheet's (the SheetRevision's) id."""
    sheet_id: uuid.UUID
    set_id: uuid.UUID
    file_id: uuid.UUID
    discipline: str | None
    building_id: uuid.UUID | None
    number: str | None
    title: str
    revision_mark: str
    issue_date: str
    storeys_as_stated: str
    location: dict[str, Any]
    sheet_key: str | None
    ordinal: int
    kind: str | None
    confirmed_kind: str | None
    proposed_exclusion: str | None
    proposed_exclusion_text: str
    decision: str | None
    excluded_reason: str | None
    excluded_text: str
    confirmation_id: uuid.UUID | None
    decided_at: datetime | None
    sources: dict[str, str]
    anchors: tuple[StoredAnchor, ...]
    has_render: bool
    plot: PlotView
    held: bool
    """From a held file the QS chose to read anyway: its sheets are marked."""


@dataclass(frozen=True)
class ViewView:
    id: uuid.UUID
    sheet_revision_id: uuid.UUID
    reader_version: str
    ordinal: int
    kind: str
    confirmed_kind: str | None
    title: str
    box: tuple[str, str, str, str]
    """x0, y0, x1, y1 in drawing units, as decimal strings."""
    drawing_unit: str
    not_to_scale: bool
    stated_scale: str
    storeys_as_stated: str
    storeys: tuple[str, ...]
    storeys_meaning: str | None
    subject: str | None
    layer: str | None
    steps: tuple[str, ...]
    part: str | None
    """Its Discipline Part, by the Discipline's key."""
    proposed_exclusion: str | None
    proposed_exclusion_text: str
    decision: str | None
    excluded_reason: str | None
    excluded_text: str
    confirmation_id: uuid.UUID | None
    anchors: tuple[StoredAnchor, ...]


class AnchorsNotLoaded(RuntimeError):
    """A list read with `anchors=False` was asked for its anchors."""


class _Unloaded(tuple[StoredAnchor, ...]):
    """The anchors of a sheet or view read without them: reading them raises `AnchorsNotLoaded`
    (an empty tuple would pass for a sheet with no anchors)."""

    def _refuse(self, *_: object) -> Any:
        raise AnchorsNotLoaded("the anchors were not read (anchors=False)")

    __iter__ = __len__ = __getitem__ = __contains__ = __bool__ = _refuse

    def __repr__(self) -> str:
        return "UNLOADED"


UNLOADED: tuple[StoredAnchor, ...] = _Unloaded()
"""A list's anchors when read with `anchors=False`."""


# Recording a reading --------------------------------------------------------------------------------


def record_sheets(
    file_id: uuid.UUID,
    candidates: Sequence[SheetCandidate],
    *,
    empty_layouts: int = 0,
    drawing_list: bool = False,
) -> list[SheetView]:
    """Keep a DWG's printed sheets, in the candidates' order (see the module); the printed sheets,
    in the same order. `empty_layouts`: layout tabs showing nothing, never sheets (the report);
    `drawing_list`: a drawing list was read on its sheets (its sheets then never default it to
    General; a "general note(s)" in its name still names it General, #168)."""
    with transaction.atomic():
        row = _access.drawing_file(file_id, lock=True)
        name = row.original_name
        if row.format != FileFormat.DWG:
            raise auth.Refused(refusal.WRONG_KIND(file=name), status=400)
        kept = reads._artefact_row(row)
        if kept is None:
            raise auth.Refused(refusal.NO_READING(file=name), status=409)
        group = drawing_files.group_of(row)
        market = {d.key: d for d in library_disciplines.market()}
        for candidate in candidates:
            if not isinstance(candidate, SheetCandidate) or candidate.group != group:
                raise auth.Refused(refusal.WRONG_GROUP(file=name), status=400)
            key = candidate.discipline.value if candidate.discipline else None
            if key is not None and key not in market:
                raise auth.Refused(refusal.UNKNOWN_DISCIPLINE(file=name), status=400)
            _decoded(name, *_sheet_words(candidate))
        if _refuse_taken_choice(row, candidates):
            # Read as if never chosen: the Discipline the finder gave from the file goes too.
            candidates = [
                replace(c, discipline=None)
                if c.discipline is not None and c.discipline.source == ValueSource.FILE
                else c
                for c in candidates
            ]
        _default_discipline(row, candidates, market, drawing_list=drawing_list)
        _access.lock("sheets", row.drawing_set_id)
        places = [_location_key(c.location) for c in candidates]
        if len(set(places)) != len(places):
            raise auth.Refused(refusal.NOT_ITS_READING(file=name), status=400)
        # A sheet a text of which is past its column is not kept, alone; each kept sheet's ordinal is
        # its candidate's place in `candidates`.
        kept_places = set()
        recorded = []
        for ordinal, (candidate, place) in enumerate(zip(candidates, places, strict=True), start=1):
            texts = _sheet_texts(candidate)
            if not texts.fits:
                continue
            kept_places.add(place)
            recorded.append(
                _keep_sheet(row, kept.reader_version, candidate, texts, place, ordinal, market)
            )
        _drop_stale(row, kept_places)
        row.sheets_total = len(recorded)
        row.sheets_refused = len(candidates) - len(recorded)
        row.empty_layouts = max(0, int(empty_layouts))
        row.save(update_fields=["sheets_total", "sheets_refused", "empty_layouts"])
    context = _PlotContext(row.drawing_set_id)
    return [_sheet_view(sr, context) for sr in _all().filter(id__in=[sr.id for sr in recorded])
            .order_by("ordinal")]  # fmt: skip


def _sheet_words(candidate: SheetCandidate) -> list[str]:
    return [
        field.value
        for field in (
            candidate.number,
            candidate.title,
            candidate.revision_mark,
            candidate.issue_date,
            candidate.storeys_as_stated,
        )
        if field is not None
    ]


@dataclass(frozen=True)
class _SheetTexts:
    """A sheet candidate's texts as they may be kept (`_text.read`)."""

    number: str
    title: str
    revision_mark: str
    issue_date: str
    storeys: str
    layout: str | None
    exclusion_text: str

    @property
    def fits(self) -> bool:
        return _text.fits(
            (self.number, _length(Sheet, "number")),
            (self.revision_mark, _length(SheetRevision, "revision_mark")),
            (self.issue_date, _length(SheetRevision, "issue_date")),
        )


def _sheet_texts(candidate: SheetCandidate) -> _SheetTexts:
    def value(field: Any) -> str:
        return _text.read(field.value) if field is not None else ""

    layout = candidate.location.layout
    return _SheetTexts(
        number=value(candidate.number),
        title=value(candidate.title),
        revision_mark=value(candidate.revision_mark),
        issue_date=value(candidate.issue_date),
        storeys=value(candidate.storeys_as_stated),
        layout=None if layout is None else _text.read(layout),
        exclusion_text=_text.read(candidate.exclusion.text) if candidate.exclusion else "",
    )


def _length(model: type[models.Model], name: str) -> int:
    field = model._meta.get_field(name)
    assert isinstance(field, models.Field)
    assert field.max_length is not None
    return field.max_length


def _decoded(file_name: str, *texts: str | None) -> None:
    for text in texts:
        if text and any(code in text for code in _RAW_CODES):
            raise auth.Refused(refusal.RAW_CODES(file=file_name), status=400)


def _default_discipline(
    row: DrawingFile,
    candidates: Sequence[SheetCandidate],
    market: dict[str, Discipline],
    *,
    drawing_list: bool,
) -> None:
    """The file's Discipline from its sheets' numbers, only when its name gave none (and the QS
    chose none): the one Discipline its numbered sheets agree on; else, for a file running its own
    series (two or more sheets with bare numbers, none of any Discipline, and no drawing list read on
    them), the Market's notes Discipline, General (#159: the owner's ruling, session 07)."""
    if row.discipline_id is not None:
        return
    keys = {c.discipline.value for c in candidates if c.discipline is not None}
    if not keys and not drawing_list and _own_series(candidates):
        keys = {d.key for d in market.values() if d.kind == DisciplineKind.GENERAL}
    if len(keys) != 1:
        return
    discipline = market[keys.pop()]
    row.discipline = discipline
    row.discipline_source = DisciplineSource.SHEET_NUMBERS
    row.revision = drawing_files._first_issue(row.drawing_set, discipline, tenancy.current().user_id)
    row.save(update_fields=["discipline", "discipline_source", "revision"])


def _refuse_taken_choice(row: DrawingFile, candidates: Sequence[SheetCandidate]) -> bool:
    """A Discipline the QS chose before the file's numbers were read is refused now, if it already
    has a sheet of one of them from another file, as `set_discipline` refuses it after the read (in
    words of its own, `discipline_choice_undone`, kept as the file's finding), never a silent join by
    number (the orchestrator's ruling, session 08). The file is then read as if never chosen."""
    if row.discipline_source != DisciplineSource.QS or row.discipline_id is None:
        return False
    for candidate in candidates:
        number = _text.read(candidate.number.value) if candidate.number is not None else ""
        if not number:
            continue
        taken = (
            Sheet.objects.filter(
                drawing_set_id=row.drawing_set_id,
                building_id=row.building_id,
                discipline_id=row.discipline_id,
                number=number,
            )
            .exclude(id__in=SheetRevision.objects.filter(source_file=row).values("sheet_id"))
            .exists()
        )
        if taken:
            assert row.discipline is not None
            name = library_disciplines.name(row.discipline.labels)
            row.finding = _text.read_json(
                dict(file_words.DISCIPLINE_CHOICE_UNDONE(discipline=name, sheet=number))
            )
            row.discipline = None
            row.discipline_source = ""
            row.revision = None
            row.save(update_fields=["finding", "discipline", "discipline_source", "revision"])
            return True
    return False


def _own_series(candidates: Sequence[SheetCandidate]) -> bool:
    """Two or more sheets numbered with bare digits ("01"), and no numbered sheet otherwise."""
    numbers = [_text.read(c.number.value).strip() for c in candidates if c.number is not None]
    return len(numbers) >= 2 and all(n.isascii() and n.isdigit() for n in numbers)


def _location_key(location: SheetLocation) -> str:
    """Its place as one text: its layout's name as read, every character past ASCII escaped (so any
    name is a key and two names are never one, whatever they hold), or its box."""
    if location.layout is not None:
        return json.dumps({"layout": location.layout}, separators=(",", ":"))
    assert location.box is not None
    box = location.box
    return reads.canonical({"box": [_decimal(v) for v in (box.x0, box.y0, box.x1, box.y1)]}).decode()


def _decimal(value: float) -> str:
    return repr(float(value))


def _anchors_of(
    row: DrawingFile, reader_version: str, anchors: Sequence[Anchor], sheet_key: str | None
) -> str | None:
    """The one sheet key the anchors name (every one of this file, its reader version and, when the
    printed sheet has one, its key); else refused."""
    found = set()
    for anchor in anchors:
        if not isinstance(anchor, DwgAnchor):
            raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
        sheet = None if anchor.sheet is None else _text.read(anchor.sheet)
        if (
            anchor.source_sha256 != row.sha256
            or anchor.reader_version != reader_version
            or (sheet_key is not None and sheet != sheet_key)
        ):
            raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
        found.add(sheet)
    if len(found) > 1:
        raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
    return found.pop() if found else None


def _keep_sheet(
    row: DrawingFile,
    reader_version: str,
    candidate: SheetCandidate,
    texts: _SheetTexts,
    place: str,
    ordinal: int,
    market: dict[str, Discipline],
) -> SheetRevision:
    location = candidate.location
    sheet_key = _anchors_of(row, reader_version, candidate.anchors, None)
    if sheet_key is None and texts.layout is not None:
        sheet_key = texts.layout
    discipline = row.discipline or (market[candidate.discipline.value] if candidate.discipline else None)
    number, title, storeys = texts.number, texts.title, texts.storeys
    if number:
        sheet, _ = Sheet.objects.get_or_create(
            tenant_id=row.tenant_id,
            drawing_set_id=row.drawing_set_id,
            building_id=row.building_id,
            discipline=discipline,
            number=number,
            defaults={"title": title, "storeys_as_stated": storeys},
        )
    else:
        sheet, _ = Sheet.objects.get_or_create(
            tenant_id=row.tenant_id,
            drawing_set_id=row.drawing_set_id,
            source_file=row,
            location_key=place,
            number="",
            defaults={
                "building_id": row.building_id,
                "discipline": discipline,
                "title": title,
                "storeys_as_stated": storeys,
            },
        )
    exclusion = candidate.exclusion
    values = {
        "sheet": sheet,
        "revision_id": row.revision_id,
        "location": _location_json(location, texts.layout),
        "sheet_key": sheet_key or "",
        "ordinal": ordinal,
        "title": title,
        "revision_mark": texts.revision_mark,
        "issue_date": texts.issue_date,
        "storeys_as_stated": storeys,
        "sources": _text.read_json(_sources(candidate)),
        "source_sha256": row.sha256,
        "reader_version": reader_version,
        "proposed_exclusion": str(exclusion.reason) if exclusion else "",
        "proposed_exclusion_text": texts.exclusion_text,
    }
    existing = SheetRevision.objects.filter(source_file=row, location_key=place).first()
    anchors = [_text.read_json(_detail(a)) for a in candidate.anchors]
    if existing is None:
        created = SheetRevision.objects.create(
            tenant_id=row.tenant_id,
            drawing_set_id=row.drawing_set_id,
            source_file=row,
            location_key=place,
            anchors=anchors,
            **values,
        )
        existing = created
    else:
        changed: dict[str, Any] = {k: v for k, v in values.items() if _differs(existing, k, v)}
        if existing.anchors != anchors:
            changed["anchors"] = anchors
        if changed and existing.decision:
            raise auth.Refused(refusal.DECIDED(file=row.original_name), status=409)
        old_sheet_id = existing.sheet_id
        for name, value in changed.items():
            setattr(existing, name, value)
        if changed:
            existing.save(update_fields=[_column(name) for name in changed])
        if existing.sheet_id != old_sheet_id:
            _drop_sheet_if_empty(old_sheet_id)
    if sheet.number and (sheet.title, sheet.storeys_as_stated) != (title, storeys):
        Sheet.objects.filter(id=sheet.id).update(title=title, storeys_as_stated=storeys)
    state_id = row.drawing_set.current_state_id
    if state_id is not None:
        StateSheet.objects.get_or_create(
            tenant_id=row.tenant_id,
            drawing_set_id=row.drawing_set_id,
            state_id=state_id,
            sheet_revision=existing,
        )
    return existing


def _differs(existing: SheetRevision, name: str, value: object) -> bool:
    if name == "sheet":
        assert isinstance(value, Sheet)
        return existing.sheet_id != value.id
    return bool(getattr(existing, name) != value)


def _column(name: str) -> str:
    return {"sheet": "sheet", "revision_id": "revision"}.get(name, name)


def _detail(anchor: Anchor) -> dict[str, Any]:
    """The anchor's jsonb part (its printed sheet, sha256 and reader version are the row's columns)."""
    return StoredAnchor.of(anchor, sheet_revision_id=uuid.UUID(int=0)).detail


def _location_json(location: SheetLocation, layout: str | None) -> dict[str, Any]:
    if layout is not None:
        return {"layout": layout}
    assert location.box is not None
    b = location.box
    return {"box": [_decimal(v) for v in (b.x0, b.y0, b.x1, b.y1)]}


def _sources(candidate: SheetCandidate) -> dict[str, str]:
    found = {}
    for name in ("number", "title", "discipline", "revision_mark", "issue_date", "storeys_as_stated"):
        value = getattr(candidate, name)
        if value is not None:
            found[name] = str(value.source)
    return found


def _drop_stale(row: DrawingFile, places: set[str]) -> None:
    """Drop the file's printed sheets a reading no longer finds (never one the QS decided)."""
    stale = SheetRevision.objects.filter(source_file=row).exclude(location_key__in=places)
    if stale.exclude(decision="").exists():
        raise auth.Refused(refusal.DECIDED(file=row.original_name), status=409)
    for sheet_revision in list(stale):
        if View.objects.filter(sheet_revision=sheet_revision).exclude(decision="").exists():
            raise auth.Refused(refusal.DECIDED(file=row.original_name), status=409)
        View.objects.filter(sheet_revision=sheet_revision).delete()
        StateSheet.objects.filter(sheet_revision=sheet_revision).delete()
        sheet_id = sheet_revision.sheet_id
        sheet_revision.delete()
        _drop_sheet_if_empty(sheet_id)


def _drop_sheet_if_empty(sheet_id: uuid.UUID) -> None:
    if not SheetRevision.objects.filter(sheet_id=sheet_id).exists():
        Sheet.objects.filter(id=sheet_id).delete()


def record_views(sheet_revision_id: uuid.UUID, candidates: Sequence[ViewCandidate]) -> list[ViewView]:
    """Keep a printed sheet's views as its file's kept reading read them, in reading order,
    replacing that reading's earlier views of it (never one the QS decided)."""
    with transaction.atomic():
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=True)
        row = sheet_revision.source_file
        name = row.original_name
        kept = reads._artefact_row(row)
        if kept is None:
            raise auth.Refused(refusal.NO_READING(file=name), status=409)
        market = {d.key: d for d in library_disciplines.market()}
        for candidate in candidates:
            if not isinstance(candidate, ViewCandidate):
                raise auth.Refused(refusal.NOT_ITS_READING(file=name), status=400)
            if str(candidate.kind) not in ViewKind.values:
                raise auth.Refused(refusal.KIND_UNKNOWN(file=name), status=400)
            _decoded(name, candidate.title, candidate.stated_scale, candidate.storeys_as_stated)
            if candidate.part is not None and candidate.part not in market:
                raise auth.Refused(refusal.UNKNOWN_DISCIPLINE(file=name), status=400)
            _anchors_of(row, kept.reader_version, candidate.anchors, sheet_revision.sheet_key or None)
        earlier = View.objects.filter(sheet_revision=sheet_revision, reader_version=kept.reader_version)
        if earlier.exclude(decision="").exists():
            raise auth.Refused(refusal.DECIDED(file=name), status=409)
        earlier.delete()
        made = []
        for ordinal, candidate in enumerate(candidates, start=1):  # its candidate's place, kept or not
            exclusion = candidate.exclusion
            scale = _text.read(candidate.stated_scale)
            subject = _text.read(candidate.subject)
            layer = _text.read(candidate.layer)
            meaning = _text.read(candidate.storeys_meaning)
            if not _text.fits(
                (scale, _length(View, "stated_scale_text")),
                (subject, _length(View, "subject")),
                (layer, _length(View, "layer")),
                (meaning, _length(View, "storeys_meaning")),
            ):
                continue
            made.append(
                View(
                    tenant_id=row.tenant_id,
                    sheet_revision=sheet_revision,
                    reader_version=kept.reader_version,
                    ordinal=ordinal,
                    kind=str(candidate.kind),
                    title=_text.read(candidate.title),
                    box=[_decimal(v) for v in _box(candidate)],
                    drawing_unit=_UNITS.get(kept.insunits, ""),
                    not_to_scale=candidate.not_to_scale,
                    stated_scale_text=scale,
                    storeys_as_stated=_text.read(candidate.storeys_as_stated),
                    storeys=_text.read_json(list(candidate.storeys)),
                    storeys_meaning=meaning,
                    subject=subject,
                    layer=layer,
                    steps=_text.read_json(list(candidate.steps)),
                    part=market[candidate.part] if candidate.part else None,
                    proposed_exclusion=str(exclusion.reason) if exclusion else "",
                    proposed_exclusion_text=_text.read(exclusion.text) if exclusion else "",
                    source_sha256=row.sha256,
                    anchors=[_text.read_json(_detail(a)) for a in candidate.anchors],
                )
            )
        View.objects.bulk_create(made)
        sheet_revision.views_refused = len(candidates) - len(made)
        sheet_revision.save(update_fields=["views_refused"])
    return _views_of(sheet_revision)


def _box(candidate: ViewCandidate) -> tuple[float, float, float, float]:
    b = candidate.box
    return (b.x0, b.y0, b.x1, b.y1)


def record_render(sheet_revision_id: uuid.UUID, buffers: SheetBuffers | bytes) -> SheetView:
    """Keep a printed sheet's render (11's sheet buffer), checked by decoding it."""
    with transaction.atomic():
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=True)
        row = sheet_revision.source_file
        try:
            content = buffers.to_bytes() if isinstance(buffers, SheetBuffers) else bytes(buffers)
            SheetBuffers.from_bytes(content)
        except BufferError, TypeError, ValueError:
            raise auth.Refused(refusal.BAD_RENDER(file=row.original_name), status=400) from None
        digest = hashlib.sha256(content).hexdigest()
        key = storage.key(
            row.drawing_set.project_id, "drawings", row.sha256, "renders", f"{digest}.vxsb"
        )
        stored = storage.put(
            key,
            content,
            kind="derived",
            media_type=RENDER_MEDIA_TYPE,
            producer="engine.render.buffers",
            source_sha256=row.sha256,
        )
        sheet_revision.render_file_id = stored.id
        sheet_revision.render_key = key
        sheet_revision.save(update_fields=["render_file_id", "render_key"])
    return _sheet_view(_all().get(id=sheet_revision.id))


def render(sheet_revision_id: uuid.UUID) -> bytes:
    """A printed sheet's render, checked against its StoredFile; not found when it has none."""
    sheet_revision = _listed(sheet_revision_id)
    if not sheet_revision.render_key:
        raise auth.NotFound
    try:
        return storage.get(sheet_revision.render_key)
    except storage.StorageError:  # missing, damaged or planted: no render to give
        raise auth.NotFound from None


def hold_plots(set_id: uuid.UUID) -> None:
    """Hold the Drawing Set's Plot matching until the transaction ends (ticket 157): the read job
    matching a PDF and one matching a DWG of the same set wait for each other, so the second sees
    what the first marked read and matched."""
    drawing_set = _access.drawing_set(set_id)
    _access.lock("plots", drawing_set.id)


def record_plot(
    sheet_revision_id: uuid.UUID,
    match: PlotMatch | PlotNone | str,
    *,
    pdf_file_id: uuid.UUID | None = None,
    render_f1: float | None = None,
) -> SheetView:
    """Keep a printed sheet's Plot: the PDF page 18 matched to it (its PDF, found by the page's
    sha256, must be of the same Drawing Set), or why it has none (`PlotNone`; `pdf_file_id` names the
    PDF that matched no page, or was refused)."""
    with transaction.atomic():
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=True)
        row = sheet_revision.source_file
        values: dict[str, Any] = {
            "plot_file": None,
            "plot_page": None,
            "plot_transform": None,
            "plot_residual": None,
            "plot_none_reason": "",
            "render_f1": None if render_f1 is None else _decimal_of(render_f1, 6),
        }
        if isinstance(match, PlotMatch) and match.sheet is not None:
            page = match.page
            sha256 = getattr(page, "source_sha256", None)
            number = getattr(page, "number", None)
            values["plot_file"] = _pdf_of_set(row, sha256=sha256)
            if not isinstance(number, int) or number < 1:
                raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
            values["plot_page"] = number
            if match.transform is not None:
                t = match.transform
                values["plot_transform"] = {
                    "scale": _decimal(t.scale),
                    "rotation": t.rotation,
                    "offset": [_decimal(v) for v in t.offset],
                }
            if match.residual is not None:
                values["plot_residual"] = _decimal_of(match.residual, 6)
        else:
            if isinstance(match, PlotMatch):
                sha256 = getattr(match.page, "source_sha256", None)
                values["plot_file"] = _pdf_of_set(row, sha256=sha256)
                reason = PlotNone.NO_PAGE
            else:
                try:
                    reason = PlotNone(match)
                except ValueError:
                    raise auth.Refused(
                        refusal.NOT_ITS_READING(file=row.original_name), status=400
                    ) from None
                if reason in (PlotNone.NO_PAGE, PlotNone.PDF_REFUSED):
                    values["plot_file"] = _pdf_of_set(row, file_id=pdf_file_id)
            values["plot_none_reason"] = reason
        for name, value in values.items():
            setattr(sheet_revision, name, value)
        sheet_revision.save(update_fields=list(values))
    return _sheet_view(_all().get(id=sheet_revision.id))


def _pdf_of_set(
    row: DrawingFile, *, sha256: object = None, file_id: uuid.UUID | None = None
) -> DrawingFile:
    rows = DrawingFile.objects.filter(drawing_set_id=row.drawing_set_id, format=FileFormat.PDF)
    if file_id is not None:
        found = rows.filter(id=file_id).first()
    elif isinstance(sha256, str):
        found = rows.filter(sha256=sha256).first()
    else:
        found = None
    if found is None:
        raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
    return found


def _decimal_of(value: float, places: int) -> Decimal:
    return Decimal(repr(float(value))).quantize(Decimal(1).scaleb(-places))


# The sheet list and its views ----------------------------------------------------------------------


def sheets(
    set_id: uuid.UUID,
    discipline: str | None = None,
    *,
    anchors: bool = True,
    among: Collection[uuid.UUID] | None = None,
) -> list[SheetView]:
    """The set's printed sheets Step 1 lists: of its read files (and held files read anyway), of one
    Discipline by key when given, by Discipline, then number (naturally), then place. In a fixed
    number of statements whatever the set's size: why a sheet has no Plot is worked out from one read
    of the set's PDFs (`_PlotContext`). `anchors=False` leaves the anchors unread (Step 1's lists and
    acts never read them): each sheet's `anchors` is then `UNLOADED`, which refuses to be read.
    `among`: only the listed sheets with these ids (an act's named sheets)."""
    drawing_set = _access.drawing_set(set_id)
    found = _printed().filter(sheet__drawing_set=drawing_set)
    if discipline is not None:
        found = found.filter(sheet__discipline__key=discipline)
    if among is not None:
        found = found.filter(id__in=list(among))
    if not anchors:
        found = found.defer("anchors")
    market = library_disciplines.market()
    order = {d.key: d.sort_order for d in market}
    context = _PlotContext(drawing_set.id, market)
    viewed = (_sheet_view(sr, context, anchors=anchors) for sr in found)
    return sorted(viewed, key=lambda v: _placed(order, v.discipline, v.number, v.file_id, v.ordinal))


@dataclass(frozen=True)
class SheetFacts:
    """What Step 1 counts and checks of a printed sheet, without its view (`sheet_facts`)."""

    id: uuid.UUID
    discipline: str | None
    number: str | None
    decision: str | None
    proposed_exclusion: str | None
    confirmation_id: uuid.UUID | None
    plot_file_id: uuid.UUID | None
    plot_page: int | None


def sheet_facts(set_id: uuid.UUID) -> list[SheetFacts]:
    """The set's printed sheets `sheets` lists, in its order, as facts read in one statement (no Plot
    reason, no anchors, no texts): Step 1's counts and an act's membership tests."""
    drawing_set = _access.drawing_set(set_id)
    rows = (
        _printed()
        .filter(sheet__drawing_set=drawing_set)
        .values_list(
            "id",
            "sheet__discipline__key",
            "sheet__number",
            "decision",
            "proposed_exclusion",
            "confirmation_id",
            "plot_file_id",
            "plot_page",
            "source_file_id",
            "ordinal",
        )
    )
    order = {d.key: d.sort_order for d in library_disciplines.market()}
    placed = []
    for sr_id, key, number, decision, out, act, plot_file, page, file_id, ordinal in rows:
        fact = SheetFacts(
            sr_id, key, number or None, decision or None, out or None, act, plot_file, page
        )
        placed.append((_placed(order, fact.discipline, fact.number, file_id, ordinal), fact))
    return [fact for _key, fact in sorted(placed, key=lambda pair: pair[0])]


def _placed(
    order: Mapping[str, int],
    discipline: str | None,
    number: str | None,
    file_id: uuid.UUID,
    ordinal: int,
) -> tuple[Any, ...]:
    """A printed sheet's place in the sheet list (see `sheets`)."""
    return (
        discipline is None,
        order.get(discipline or "", 0),
        number is None,
        [(0, int(p), "") if p.isdigit() else (1, 0, p.casefold())
         for p in _NATURAL.split(number or "") if p],
        str(file_id),
        ordinal,
    )  # fmt: skip


def sheet(sheet_revision_id: uuid.UUID) -> SheetView:
    """One printed sheet of the sheet list (in the acting Membership's scope); else not found."""
    return _sheet_view(_all().get(id=_listed(sheet_revision_id).id))


def sheet_discipline(sheet_revision_id: uuid.UUID) -> str | None:
    """A printed sheet's Discipline as it stands, by key, while its file is still being read (the
    read job's views are proposed by it: #159); in the acting tenant's scope, else not found."""
    sheet_revision = _access.sheet_revision(sheet_revision_id)
    discipline = Sheet.objects.select_related("discipline").get(id=sheet_revision.sheet_id).discipline
    return discipline.key if discipline else None


def _all() -> QuerySet[SheetRevision]:
    """Every printed sheet the acting tenant holds (row-level security), whatever its file's state."""
    return SheetRevision.objects.select_related(
        "sheet__discipline", "source_file", "plot_file", "sheet__drawing_set"
    )


def _printed() -> QuerySet[SheetRevision]:
    """The printed sheets in the sheet list: of read files, or held files read anyway (once their
    read has ended, `drawing_files.read_anyway`)."""
    listed = Q(source_file__read_status=ReadStatus.READ) | drawing_files.read_anyway("source_file__")
    return SheetRevision.objects.select_related(
        "sheet__discipline", "source_file", "plot_file", "sheet__drawing_set"
    ).filter(listed)


def _listed(sheet_revision_id: uuid.UUID, *, lock: bool = False, anchors: bool = True) -> SheetRevision:
    """A printed sheet in the sheet list, in scope; else not found. `anchors=False`: read without its
    anchors (the same scope test as `_access.sheet_revision`'s)."""
    if anchors:
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=lock)
    else:
        _access.tenant_id()
        rows = (
            SheetRevision.objects.select_related("source_file__drawing_set", "sheet")
            .defer("anchors")
            .filter(id=sheet_revision_id)
        )
        if lock:
            rows = rows.select_for_update(of=("self",))
        found = rows.first()
        if found is None:
            raise auth.NotFound
        _access.in_scope(found.source_file.drawing_set.project_id)
        sheet_revision = found
    if not _printed().filter(id=sheet_revision.id).exists():
        raise auth.NotFound
    return sheet_revision


def _sheet_view(
    sr: SheetRevision, context: _PlotContext | None = None, *, anchors: bool = True
) -> SheetView:
    """A printed sheet's view; `context`: its set's PDFs and Disciplines, read once for a list (a
    one-off one for a single sheet)."""
    source = sr.source_file
    if context is None:
        context = _PlotContext(sr.drawing_set_id)
    return SheetView(
        id=sr.id,
        sheet_id=sr.sheet_id,
        set_id=sr.sheet.drawing_set_id,
        file_id=sr.source_file_id,
        discipline=sr.sheet.discipline.key if sr.sheet.discipline else None,
        building_id=sr.sheet.building_id,
        number=sr.sheet.number or None,
        title=sr.title,
        revision_mark=sr.revision_mark,
        issue_date=sr.issue_date,
        storeys_as_stated=sr.storeys_as_stated,
        location=dict(sr.location),
        sheet_key=sr.sheet_key or None,
        ordinal=sr.ordinal,
        kind=sr.kind or None,
        confirmed_kind=sr.confirmed_kind or None,
        proposed_exclusion=sr.proposed_exclusion or None,
        proposed_exclusion_text=sr.proposed_exclusion_text,
        decision=sr.decision or None,
        excluded_reason=sr.excluded_reason or None,
        excluded_text=sr.excluded_text,
        confirmation_id=sr.confirmation_id,
        decided_at=sr.decided_at,
        sources=dict(sr.sources),
        anchors=(
            tuple(_stored(sr.id, sr.source_sha256, sr.reader_version, sr.anchors))
            if anchors
            else UNLOADED
        ),
        has_render=bool(sr.render_key),
        plot=_plot(sr, context),
        held=source.read_status == ReadStatus.QUARANTINED,
    )


def _stored(
    sheet_revision_id: uuid.UUID, sha256: str, reader_version: str, details: list[dict[str, Any]]
) -> list[StoredAnchor]:
    return [StoredAnchor(sheet_revision_id, sha256, reader_version, dict(d)) for d in details]


def _plot(sr: SheetRevision, context: _PlotContext) -> PlotView:
    none: Message | None = None
    reason = sr.plot_none_reason
    if sr.plot_page is None:
        if reason == PlotNone.NO_PAGE and sr.plot_file is not None:
            none = said.PLOT_NO_PAGE(plot_file=sr.plot_file.original_name)
        elif reason == PlotNone.NO_NUMBER:
            none = said.PLOT_NO_NUMBER()
        else:  # none recorded, or one about the set's PDFs, which change: as they stand now
            none = _no_plot_yet(sr, context)
    return PlotView(
        file_id=sr.plot_file_id,
        page=sr.plot_page,
        transform=sr.plot_transform,
        residual=None if sr.plot_residual is None else str(sr.plot_residual),
        render_f1=None if sr.render_f1 is None else str(sr.render_f1),
        none=none,
    )


class _PlotContext:
    """What `_no_plot_yet` reads of a Drawing Set, read once (when first needed) for every sheet of a
    list: the set's PDFs, its Market's Disciplines' names in the Market's language."""

    def __init__(self, set_id: uuid.UUID, market: Sequence[Discipline] | None = None) -> None:
        self._set_id = set_id
        self._market = market
        self._pdfs: list[tuple[uuid.UUID | None, datetime, str, str]] | None = None
        self._names: dict[uuid.UUID, str] | None = None

    def pdfs(self) -> list[tuple[uuid.UUID | None, datetime, str, str]]:
        """The set's PDFs: Discipline, added, name and read status, of none last, oldest first."""
        if self._pdfs is None:
            found = DrawingFile.objects.filter(drawing_set_id=self._set_id, format=FileFormat.PDF)
            self._pdfs = sorted(
                found.values_list("discipline_id", "added_at", "original_name", "read_status"),
                key=lambda pdf: (pdf[0] is None, pdf[1]),
            )
        return self._pdfs

    def name(self, discipline_id: uuid.UUID) -> str:
        """The Discipline's name in the Market's language ("" for one not of the Market)."""
        if self._names is None:
            market = library_disciplines.market() if self._market is None else self._market
            self._names = library_disciplines.names(market)
        return self._names.get(discipline_id, "")


def _no_plot_yet(sr: SheetRevision, context: _PlotContext) -> Message:
    """Why a sheet has no Plot, from its Drawing Set's PDFs of its Discipline (or of none) as they
    stand (see PLOT_NOT_YET): a PDF of its own Discipline is named before one of none."""
    discipline_id = sr.sheet.discipline_id
    found = [
        pdf
        for pdf in context.pdfs()
        if discipline_id is None or pdf[0] is None or pdf[0] == discipline_id
    ]
    statuses = {status for *_, status in found}
    if statuses & {ReadStatus.QUEUED, ReadStatus.READING}:
        return said.PLOT_NOT_YET()
    # A read PDF with no match kept for this sheet was never matched to it (a set read before 157,
    # or a PDF that could not be read again): "no page of it matched" is said only by a match that
    # ran (`PlotNone.NO_PAGE`).
    # Of its own Discipline only (any, for a sheet of none): a read PDF of no Discipline may be a
    # site photograph, not this sheet's Plot.
    read = [
        name
        for d, _, name, status in found
        if status == ReadStatus.READ and (discipline_id is None or d == discipline_id)
    ]
    if read:
        return said.PLOT_NOT_MATCHED(plot_file=read[0])
    # One that could not be read, or was refused, is its PDF only if of its Discipline (a PDF of
    # none, a site photograph say, is not a sheet's Plot for being refused).
    own = {status for d, *_, status in found if discipline_id is None or d == discipline_id}
    if own - {ReadStatus.REFUSED}:
        return said.PLOT_PDF_UNREAD()
    if own:
        return said.PLOT_PDF_REFUSED()
    named = context.name(discipline_id) if discipline_id is not None else ""
    return said.PLOT_NO_PDF(discipline=named) if named else said.PLOT_NO_PDF_ANY()


def views(sheet_revision_id: uuid.UUID) -> list[ViewView]:
    """A printed sheet's views, as its kept reading read them, in reading order (of a sheet in the
    sheet list only)."""
    return _views_of(_listed(sheet_revision_id))


def views_of_set(set_id: uuid.UUID, *, anchors: bool = True) -> dict[uuid.UUID, list[ViewView]]:
    """Every printed sheet's views of a Drawing Set at once (in a fixed number of statements, the
    scope checked once for the set), by printed sheet id, each as `views` gives it: at the sheet's
    kept reader version, in reading order; a sheet with no views is not a key. `anchors=False` as
    `sheets`'s. The sheets are read first and their views by id, a version at a time (a join of the
    views to their sheets' versions let the planner scan for seconds on 220 sheets)."""
    drawing_set = _access.drawing_set(set_id)
    of_version: dict[str, list[uuid.UUID]] = {}
    for sheet_revision_id, version in (
        _printed().filter(sheet__drawing_set=drawing_set).values_list("id", "reader_version")
    ):
        of_version.setdefault(version, []).append(sheet_revision_id)
    if not of_version:
        return {}
    kept = Q()
    for version, ids in of_version.items():
        kept |= Q(sheet_revision_id__in=ids, reader_version=version)
    found = View.objects.select_related("part").filter(kept)
    if not anchors:
        found = found.defer("anchors")
    grouped: dict[uuid.UUID, list[ViewView]] = {}
    for view in found.order_by("sheet_revision_id", "ordinal"):
        grouped.setdefault(view.sheet_revision_id, []).append(_view_view(view, anchors=anchors))
    return grouped


def _views_of(sheet_revision: SheetRevision) -> list[ViewView]:
    found = View.objects.select_related("part").filter(
        sheet_revision=sheet_revision, reader_version=sheet_revision.reader_version
    )
    return [_view_view(v) for v in found.order_by("ordinal")]


def _view_view(view: View, *, anchors: bool = True) -> ViewView:
    x0, y0, x1, y1 = (str(v) for v in view.box)
    return ViewView(
        id=view.id,
        sheet_revision_id=view.sheet_revision_id,
        reader_version=view.reader_version,
        ordinal=view.ordinal,
        kind=view.kind,
        confirmed_kind=view.confirmed_kind or None,
        title=view.title,
        box=(x0, y0, x1, y1),
        drawing_unit=view.drawing_unit,
        not_to_scale=view.not_to_scale,
        stated_scale=view.stated_scale_text,
        storeys_as_stated=view.storeys_as_stated,
        storeys=tuple(view.storeys),
        storeys_meaning=view.storeys_meaning or None,
        subject=view.subject or None,
        layer=view.layer or None,
        steps=tuple(view.steps),
        part=view.part.key if view.part else None,
        proposed_exclusion=view.proposed_exclusion or None,
        proposed_exclusion_text=view.proposed_exclusion_text,
        decision=view.decision or None,
        excluded_reason=view.excluded_reason or None,
        excluded_text=view.excluded_text,
        confirmation_id=view.confirmation_id,
        anchors=(
            tuple(_stored(view.sheet_revision_id, view.source_sha256, view.reader_version, view.anchors))
            if anchors
            else UNLOADED
        ),
    )


# Decisions: confirm, leave out, undo ----------------------------------------------------------------


def _is_kind(kind: object) -> bool:
    """A sheet's kind: a key, held by value, no longer than its column."""
    return (
        isinstance(kind, str)
        and len(kind) <= _length(SheetRevision, "kind")
        and _KEY.fullmatch(kind) is not None
    )


def record_kind(sheet_revision_id: uuid.UUID, kind: str | None) -> SheetView:
    """Keep a printed sheet's kind as read (21b: the one 15's Jev picks, among the Discipline's kinds
    13 drafts, held by value as a key; None: not known). Never changes one the QS has decided."""
    with transaction.atomic():
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=True)
        if kind is not None and not _is_kind(kind):
            file_name = sheet_revision.source_file.original_name
            raise auth.Refused(refusal.KIND_UNKNOWN(file=file_name), status=400)
        if sheet_revision.decision and sheet_revision.kind != (kind or ""):
            file_name = sheet_revision.source_file.original_name
            raise auth.Refused(refusal.DECIDED(file=file_name), status=409)
        sheet_revision.kind = kind or ""
        sheet_revision.save(update_fields=["kind"])
    return _sheet_view(_all().get(id=sheet_revision.id))


def confirm_sheet(
    sheet_revision_id: uuid.UUID,
    *,
    confirmation_id: uuid.UUID,
    kind: str | None = None,
    anchors: bool = True,
) -> SheetView:
    """The QS confirms a printed sheet (and its kind, a key, when given): stamped with the
    Confirmation's id, which `undo` reverses. Confirming a sheet left out brings it back in.
    `anchors=False`: the sheet is read without its anchors (as `sheets`'s)."""
    if kind is not None and not _is_kind(kind):
        raise auth.Refused(said.KIND_UNKNOWN(), status=400)
    with transaction.atomic():
        sheet_revision = _listed(sheet_revision_id, lock=True, anchors=anchors)
        _decide(sheet_revision, Decision.CONFIRMED, confirmation_id)
        if kind is not None:
            sheet_revision.confirmed_kind = kind
        sheet_revision.save(update_fields=[*_DECIDED, "confirmed_kind"])
    return _sheet_view(_unanchored(_all(), anchors).get(id=sheet_revision.id), anchors=anchors)


def _unanchored(rows: QuerySet[SheetRevision], anchors: bool) -> QuerySet[SheetRevision]:
    return rows if anchors else rows.defer("anchors")


def confirm_view(view_id: uuid.UUID, *, confirmation_id: uuid.UUID, kind: str | None = None) -> ViewView:
    """The QS confirms a view (and its kind, one of the ten, when given)."""
    if kind is not None and kind not in ViewKind.values:
        raise auth.Refused(said.KIND_UNKNOWN(), status=400)
    with transaction.atomic():
        view = _listed_view(view_id)
        _decide(view, Decision.CONFIRMED, confirmation_id)
        if kind is not None:
            view.confirmed_kind = kind
        view.save(update_fields=[*_DECIDED, "confirmed_kind"])
    return _view_view(View.objects.select_related("part").get(id=view.id))


def exclude(
    subject_id: uuid.UUID,
    reason: EngineExclusion | ExclusionReason | str,
    text: str = "",
    *,
    confirmation_id: uuid.UUID,
) -> SheetView | ViewView:
    """The QS leaves a printed sheet or a view out, for one of the seven reasons; "other" with the
    QS's own words, kept as typed. `subject_id` is the printed sheet's or the view's id."""
    try:
        chosen = ExclusionReason(str(reason))
    except ValueError:
        raise auth.Refused(said.REASON_UNKNOWN(), status=400) from None
    words = (text or "").strip()
    if not _text.typed(words):
        raise auth.Refused(said.TEXT_UNREADABLE(), status=400)
    if chosen == ExclusionReason.OTHER and not words:
        raise auth.Refused(said.OTHER_NEEDS_TEXT(), status=400)
    if chosen != ExclusionReason.OTHER and words:
        raise auth.Refused(said.TEXT_ONLY_FOR_OTHER(), status=400)
    with transaction.atomic():
        if SheetRevision.objects.filter(id=subject_id).exists():
            sheet_revision = _listed(subject_id, lock=True)
            _decide(sheet_revision, Decision.EXCLUDED, confirmation_id, chosen, words)
            sheet_revision.save(update_fields=_DECIDED)
            return _sheet_view(_all().get(id=sheet_revision.id))
        view = _listed_view(subject_id)
        _decide(view, Decision.EXCLUDED, confirmation_id, chosen, words)
        view.save(update_fields=_DECIDED)
    return _view_view(View.objects.select_related("part").get(id=view.id))


def undo(confirmation_id: uuid.UUID) -> int:
    """Reverse every decision stamped with this Confirmation's id, on the printed sheets and views
    the acting Membership may open: they are undecided again. How many were reversed."""
    reversed_ = 0
    cleared = {
        "decision": "",
        "confirmation_id": None,
        "decided_by": None,
        "decided_at": None,
        "excluded_reason": "",
        "excluded_text": "",
        "confirmed_kind": "",
    }
    with transaction.atomic():
        for sheet_revision in SheetRevision.objects.select_related("source_file__drawing_set").filter(
            confirmation_id=confirmation_id
        ):
            if _may_open(sheet_revision.source_file.drawing_set.project_id):
                SheetRevision.objects.filter(id=sheet_revision.id).update(**cleared)
                reversed_ += 1
        for view in View.objects.select_related("sheet_revision__source_file__drawing_set").filter(
            confirmation_id=confirmation_id
        ):
            if _may_open(view.sheet_revision.source_file.drawing_set.project_id):
                View.objects.filter(id=view.id).update(**cleared)
                reversed_ += 1
    return reversed_


def _may_open(project_id: uuid.UUID) -> bool:
    try:
        _access.in_scope(project_id)
    except auth.NotFound:
        return False
    return True


def _listed_view(view_id: uuid.UUID) -> View:
    view = _access.view(view_id, lock=True)
    _listed(view.sheet_revision_id)
    return view


_DECIDED = [
    "decision",
    "confirmation_id",
    "decided_by",
    "decided_at",
    "excluded_reason",
    "excluded_text",
]
"""The columns a decision writes (the only ones, with a confirmed kind, it may: migration 0001)."""


def _decide(
    subject: SheetRevision | View,
    decision: Decision,
    confirmation_id: uuid.UUID,
    reason: ExclusionReason | None = None,
    text: str = "",
) -> None:
    if not isinstance(confirmation_id, uuid.UUID):
        raise auth.NotFound
    subject.decision = decision
    subject.confirmation_id = confirmation_id
    subject.decided_by = tenancy.current().user_id
    subject.decided_at = timezone.now()
    subject.excluded_reason = reason or ""
    subject.excluded_text = text


def location_key(location: SheetLocation) -> str:
    """A location as its canonical key (the seed and the tests find a printed sheet by it)."""
    return _location_key(location)
