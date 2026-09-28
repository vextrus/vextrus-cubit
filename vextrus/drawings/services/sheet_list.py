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
import re
import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.db.models import Q, QuerySet
from django.utils import timezone

from engine.messages import Message
from engine.read.anchor import Anchor, DwgAnchor
from engine.recognise.types import ExclusionReason as EngineExclusion
from engine.recognise.types import PlotMatch, SheetCandidate, SheetLocation, ViewCandidate
from engine.render.buffers import BufferError, SheetBuffers
from vextrus.drawings.messages import reads as refusal
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import (
    Decision,
    Discipline,
    DisciplineSource,
    DrawingFile,
    ExclusionReason,
    FileFormat,
    HeldAnswer,
    PlotNone,
    ReadStatus,
    Sheet,
    SheetRevision,
    StateSheet,
    View,
    ViewKind,
)
from vextrus.drawings.services import _access, drawing_files, library_disciplines, reads
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


# Recording a reading --------------------------------------------------------------------------------


def record_sheets(
    file_id: uuid.UUID, candidates: Sequence[SheetCandidate], *, empty_layouts: int = 0
) -> list[SheetView]:
    """Keep a DWG's printed sheets, in the candidates' order (see the module); the printed sheets,
    in the same order. `empty_layouts`: layout tabs showing nothing, never sheets (the report)."""
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
        _default_discipline(row, candidates, market)
        _access.lock("sheets", row.drawing_set_id)
        places = [_location_key(c.location) for c in candidates]
        if len(set(places)) != len(places):
            raise auth.Refused(refusal.NOT_ITS_READING(file=name), status=400)
        recorded = []
        for ordinal, (candidate, place) in enumerate(zip(candidates, places, strict=True), start=1):
            recorded.append(_keep_sheet(row, kept.reader_version, candidate, place, ordinal, market))
        _drop_stale(row, set(places))
        row.sheets_total = len(candidates)
        row.empty_layouts = max(0, int(empty_layouts))
        row.save(update_fields=["sheets_total", "empty_layouts"])
    return [_sheet_view(sr) for sr in _all().filter(id__in=[sr.id for sr in recorded])
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


def _decoded(file_name: str, *texts: str | None) -> None:
    for text in texts:
        if text and any(code in text for code in _RAW_CODES):
            raise auth.Refused(refusal.RAW_CODES(file=file_name), status=400)


def _default_discipline(
    row: DrawingFile, candidates: Sequence[SheetCandidate], market: dict[str, Discipline]
) -> None:
    """The file's Discipline from its sheets' numbers, only when its name gave none (and the QS
    chose none): the one Discipline its numbered sheets agree on."""
    if row.discipline_id is not None:
        return
    keys = {c.discipline.value for c in candidates if c.discipline is not None}
    if len(keys) != 1:
        return
    discipline = market[keys.pop()]
    row.discipline = discipline
    row.discipline_source = DisciplineSource.SHEET_NUMBERS
    row.revision = drawing_files._first_issue(row.drawing_set, discipline, tenancy.current().user_id)
    row.save(update_fields=["discipline", "discipline_source", "revision"])


def _location_key(location: SheetLocation) -> str:
    if location.layout is not None:
        return reads.canonical({"layout": location.layout}).decode()
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
        if (
            not isinstance(anchor, DwgAnchor)
            or anchor.source_sha256 != row.sha256
            or anchor.reader_version != reader_version
            or (sheet_key is not None and anchor.sheet != sheet_key)
        ):
            raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
        found.add(anchor.sheet)
    if len(found) > 1:
        raise auth.Refused(refusal.NOT_ITS_READING(file=row.original_name), status=400)
    return found.pop() if found else None


def _keep_sheet(
    row: DrawingFile,
    reader_version: str,
    candidate: SheetCandidate,
    place: str,
    ordinal: int,
    market: dict[str, Discipline],
) -> SheetRevision:
    location = candidate.location
    sheet_key = _anchors_of(row, reader_version, candidate.anchors, None)
    if sheet_key is None and location.layout is not None:
        sheet_key = location.layout
    discipline = row.discipline or (market[candidate.discipline.value] if candidate.discipline else None)
    number = candidate.number.value if candidate.number else ""
    title = candidate.title.value if candidate.title else ""
    storeys = candidate.storeys_as_stated.value if candidate.storeys_as_stated else ""
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
        "location": _location_json(location),
        "sheet_key": sheet_key or "",
        "ordinal": ordinal,
        "title": title,
        "revision_mark": candidate.revision_mark.value if candidate.revision_mark else "",
        "issue_date": candidate.issue_date.value if candidate.issue_date else "",
        "storeys_as_stated": storeys,
        "sources": _sources(candidate),
        "source_sha256": row.sha256,
        "reader_version": reader_version,
        "proposed_exclusion": str(exclusion.reason) if exclusion else "",
        "proposed_exclusion_text": (exclusion.text or "") if exclusion else "",
    }
    existing = SheetRevision.objects.filter(source_file=row, location_key=place).first()
    anchors = [_detail(a) for a in candidate.anchors]
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


def _location_json(location: SheetLocation) -> dict[str, Any]:
    if location.layout is not None:
        return {"layout": location.layout}
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
            _decoded(name, candidate.title, candidate.stated_scale, candidate.storeys_as_stated)
            if candidate.part is not None and candidate.part not in market:
                raise auth.Refused(refusal.UNKNOWN_DISCIPLINE(file=name), status=400)
            _anchors_of(row, kept.reader_version, candidate.anchors, sheet_revision.sheet_key or None)
        earlier = View.objects.filter(sheet_revision=sheet_revision, reader_version=kept.reader_version)
        if earlier.exclude(decision="").exists():
            raise auth.Refused(refusal.DECIDED(file=name), status=409)
        earlier.delete()
        made = []
        for ordinal, candidate in enumerate(candidates, start=1):
            exclusion = candidate.exclusion
            made.append(
                View(
                    tenant_id=row.tenant_id,
                    sheet_revision=sheet_revision,
                    reader_version=kept.reader_version,
                    ordinal=ordinal,
                    kind=str(candidate.kind),
                    title=candidate.title or "",
                    box=[_decimal(v) for v in _box(candidate)],
                    drawing_unit=_UNITS.get(kept.insunits, ""),
                    not_to_scale=candidate.not_to_scale,
                    stated_scale_text=candidate.stated_scale or "",
                    storeys_as_stated=candidate.storeys_as_stated or "",
                    storeys=list(candidate.storeys),
                    storeys_meaning=str(candidate.storeys_meaning or ""),
                    subject=candidate.subject or "",
                    layer=str(candidate.layer) if candidate.layer else "",
                    steps=list(candidate.steps),
                    part=market[candidate.part] if candidate.part else None,
                    proposed_exclusion=str(exclusion.reason) if exclusion else "",
                    proposed_exclusion_text=(exclusion.text or "") if exclusion else "",
                    source_sha256=row.sha256,
                    anchors=[_detail(a) for a in candidate.anchors],
                )
            )
        View.objects.bulk_create(made)
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


def sheets(set_id: uuid.UUID, discipline: str | None = None) -> list[SheetView]:
    """The set's printed sheets Step 1 lists: of its read files (and held files read anyway), of one
    Discipline by key when given, by Discipline, then number (naturally), then place."""
    drawing_set = _access.drawing_set(set_id)
    found = _printed().filter(sheet__drawing_set=drawing_set)
    if discipline is not None:
        found = found.filter(sheet__discipline__key=discipline)
    order = {d.key: d.sort_order for d in library_disciplines.market()}

    def placed(view: SheetView) -> tuple[Any, ...]:
        return (
            view.discipline is None,
            order.get(view.discipline or "", 0),
            view.number is None,
            [(0, int(p), "") if p.isdigit() else (1, 0, p.casefold())
             for p in _NATURAL.split(view.number or "") if p],
            str(view.file_id),
            view.ordinal,
        )  # fmt: skip

    return sorted((_sheet_view(sr) for sr in found), key=placed)


def sheet(sheet_revision_id: uuid.UUID) -> SheetView:
    """One printed sheet of the sheet list (in the acting Membership's scope); else not found."""
    return _sheet_view(_all().get(id=_listed(sheet_revision_id).id))


def _all() -> QuerySet[SheetRevision]:
    """Every printed sheet the acting tenant holds (row-level security), whatever its file's state."""
    return SheetRevision.objects.select_related(
        "sheet__discipline", "source_file", "plot_file", "sheet__drawing_set"
    )


def _printed() -> QuerySet[SheetRevision]:
    """The printed sheets in the sheet list: of read files, or held files read anyway."""
    listed = Q(source_file__read_status=ReadStatus.READ) | Q(
        source_file__read_status=ReadStatus.QUARANTINED,
        source_file__held_answer=HeldAnswer.READ_ANYWAY,
    )
    return SheetRevision.objects.select_related(
        "sheet__discipline", "source_file", "plot_file", "sheet__drawing_set"
    ).filter(listed)


def _listed(sheet_revision_id: uuid.UUID, *, lock: bool = False) -> SheetRevision:
    """A printed sheet in the sheet list, in scope; else not found."""
    sheet_revision = _access.sheet_revision(sheet_revision_id, lock=lock)
    if not _printed().filter(id=sheet_revision.id).exists():
        raise auth.NotFound
    return sheet_revision


def _sheet_view(sr: SheetRevision) -> SheetView:
    source = sr.source_file
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
        anchors=tuple(_stored(sr.id, sr.source_sha256, sr.reader_version, sr.anchors)),
        has_render=bool(sr.render_key),
        plot=_plot(sr),
        held=source.read_status == ReadStatus.QUARANTINED,
    )


def _stored(
    sheet_revision_id: uuid.UUID, sha256: str, reader_version: str, details: list[dict[str, Any]]
) -> list[StoredAnchor]:
    return [StoredAnchor(sheet_revision_id, sha256, reader_version, dict(d)) for d in details]


def _plot(sr: SheetRevision) -> PlotView:
    none: Message | None = None
    reason = sr.plot_none_reason or _no_plot_yet(sr)
    if sr.plot_page is None:
        if reason == PlotNone.NO_PDF:
            labels = library_disciplines.labels_of(sr.sheet.discipline_id)
            named = library_disciplines.name(labels)
            none = said.PLOT_NO_PDF(discipline=named) if named else said.PLOT_NO_PDF_ANY()
        elif reason == PlotNone.NO_PAGE and sr.plot_file is not None:
            none = said.PLOT_NO_PAGE(plot_file=sr.plot_file.original_name)
        elif reason == PlotNone.PDF_REFUSED:
            none = said.PLOT_PDF_REFUSED()
        elif reason == PlotNone.NO_NUMBER:
            none = said.PLOT_NO_NUMBER()
        else:
            none = said.PLOT_NOT_YET()
    return PlotView(
        file_id=sr.plot_file_id,
        page=sr.plot_page,
        transform=sr.plot_transform,
        residual=None if sr.plot_residual is None else str(sr.plot_residual),
        render_f1=None if sr.render_f1 is None else str(sr.render_f1),
        none=none,
    )


def _no_plot_yet(sr: SheetRevision) -> str:
    """Why a sheet whose Plot is not recorded has none so far: no PDF of its Discipline (or of none)
    is in the Drawing Set; only a refused one is; or one is, and its pages are not matched yet."""
    pdfs = DrawingFile.objects.filter(drawing_set_id=sr.drawing_set_id, format=FileFormat.PDF)
    if sr.sheet.discipline_id is not None:
        pdfs = pdfs.filter(Q(discipline_id=sr.sheet.discipline_id) | Q(discipline__isnull=True))
    statuses = set(pdfs.values_list("read_status", flat=True))
    if not statuses:
        return PlotNone.NO_PDF
    if statuses == {ReadStatus.REFUSED}:
        return PlotNone.PDF_REFUSED
    return ""


def views(sheet_revision_id: uuid.UUID) -> list[ViewView]:
    """A printed sheet's views, as its kept reading read them, in reading order (of a sheet in the
    sheet list only)."""
    return _views_of(_listed(sheet_revision_id))


def _views_of(sheet_revision: SheetRevision) -> list[ViewView]:
    found = View.objects.select_related("part").filter(
        sheet_revision=sheet_revision, reader_version=sheet_revision.reader_version
    )
    return [_view_view(v) for v in found.order_by("ordinal")]


def _view_view(view: View) -> ViewView:
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
        anchors=tuple(
            _stored(view.sheet_revision_id, view.source_sha256, view.reader_version, view.anchors)
        ),
    )


# Decisions: confirm, leave out, undo ----------------------------------------------------------------


def record_kind(sheet_revision_id: uuid.UUID, kind: str | None) -> SheetView:
    """Keep a printed sheet's kind as read (21b: the one 15's Jev picks, among the Discipline's kinds
    13 drafts, held by value as a key; None: not known). Never changes one the QS has decided."""
    if kind is not None and not (isinstance(kind, str) and _KEY.fullmatch(kind)):
        raise auth.Refused(said.KIND_UNKNOWN(), status=400)
    with transaction.atomic():
        sheet_revision = _access.sheet_revision(sheet_revision_id, lock=True)
        if sheet_revision.decision and sheet_revision.kind != (kind or ""):
            file_name = sheet_revision.source_file.original_name
            raise auth.Refused(refusal.DECIDED(file=file_name), status=409)
        sheet_revision.kind = kind or ""
        sheet_revision.save(update_fields=["kind"])
    return _sheet_view(_all().get(id=sheet_revision.id))


def confirm_sheet(
    sheet_revision_id: uuid.UUID, *, confirmation_id: uuid.UUID, kind: str | None = None
) -> SheetView:
    """The QS confirms a printed sheet (and its kind, a key, when given): stamped with the
    Confirmation's id, which `undo` reverses. Confirming a sheet left out brings it back in."""
    if kind is not None and not (isinstance(kind, str) and _KEY.fullmatch(kind)):
        raise auth.Refused(said.KIND_UNKNOWN(), status=400)
    with transaction.atomic():
        sheet_revision = _listed(sheet_revision_id, lock=True)
        _decide(sheet_revision, Decision.CONFIRMED, confirmation_id)
        if kind is not None:
            sheet_revision.confirmed_kind = kind
        sheet_revision.save(update_fields=[*_DECIDED, "confirmed_kind"])
    return _sheet_view(_all().get(id=sheet_revision.id))


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
