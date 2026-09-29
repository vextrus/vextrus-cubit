"""Opening a Trace anchor (ticket 14; ADR 0031 §2; docs/data-model.md §3.2, "The Trace anchor").

    found = drawings.services.resolve(anchor, sheet_revision_id=stored.sheet_revision_id)
    found.file, found.sheet            # the file and the printed sheet it lies on
    found.entity, found.chain          # a DWG's entity, and each insert reaching it (outermost first)
    found.page, found.path_index, found.box   # a PDF's page, path and box

An anchor is resolved against its own reader version only: the artefact that reader version kept
(never a newer reading), with its entity, and its chain of inserts where each insert's block holds the
next and the last's holds the entity. Anything else is one answer, `auth.NotFound`, whoever asks: an
anchor of another Developer's or of a Project outside the Membership's scope, a printed sheet it does
not lie on, a reader version, a handle or a chain not there, a page past the PDF's last.

The printed sheet is how it is found: an anchor is stored with its `sheet_revision_id` (the same
contents may be in two Projects of one Developer, so the file's sha256 alone would not say which).
"""

import uuid
from dataclasses import dataclass

from engine.read.anchor import Anchor, DwgAnchor, PdfAnchor
from engine.read.artefact import AnyEntity, Insert
from vextrus.drawings.models import DrawingFile, FileFormat
from vextrus.drawings.services import _access, _text, drawing_files, reads, sheet_list
from vextrus.platform.services import auth


@dataclass(frozen=True)
class Resolved:
    file: drawing_files.FileView
    sheet: sheet_list.SheetView
    entity: AnyEntity | None = None
    chain: tuple[Insert, ...] = ()
    page: int | None = None
    path_index: int | None = None
    box: tuple[float, float, float, float] | None = None


def resolve(anchor: Anchor, *, sheet_revision_id: uuid.UUID) -> Resolved:
    """The file, printed sheet and entity (or PDF page) an anchor names; else not found."""
    try:
        return _resolve(anchor, sheet_revision_id)
    except auth.Refused:
        raise auth.NotFound from None
    except KeyError, ValueError, TypeError:
        raise auth.NotFound from None


def _resolve(anchor: Anchor, sheet_revision_id: uuid.UUID) -> Resolved:
    listed = sheet_list._listed(sheet_revision_id)
    sheet = sheet_list._sheet_view(sheet_list._all().get(id=listed.id))
    if isinstance(anchor, DwgAnchor):
        row = listed.source_file
        if anchor.source_sha256 != row.sha256:
            raise auth.NotFound
        layout = None if anchor.sheet is None else _text.read(anchor.sheet)  # as it was kept
        if listed.sheet_key and layout != listed.sheet_key:
            raise auth.NotFound
        kept = reads._artefact_row(row, reader=anchor.reader, reader_version=anchor.reader_version)
        if kept is None:
            raise auth.NotFound
        artefact = reads._load(row, kept)
        chain = tuple(_insert(artefact.entities.get(handle)) for handle in anchor.inserts)
        entity = artefact.entities.get(anchor.handle)
        if entity is None:
            raise auth.NotFound
        holders = [insert.block for insert in chain]
        reached = [*chain[1:], entity]
        for holder, inner in zip(holders, reached, strict=True):
            block = artefact.blocks.get(holder)
            if block is None or inner.handle not in block.entities:
                raise auth.NotFound
        return Resolved(drawing_files.file(row.id), sheet, entity=entity, chain=chain)
    if isinstance(anchor, PdfAnchor):
        pdf = DrawingFile.objects.filter(
            drawing_set_id=listed.source_file.drawing_set_id,
            format=FileFormat.PDF,
            sha256=anchor.source_sha256,
        ).first()
        if pdf is None:
            raise auth.NotFound
        _access.drawing_file(pdf.id)
        pages = len((pdf.upload_report or {}).get("pages", ()))
        if pdf.upload_report is None or anchor.page > pages:
            raise auth.NotFound
        if listed.plot_file_id != pdf.id or listed.plot_page != anchor.page:
            raise auth.NotFound
        return Resolved(
            drawing_files.file(pdf.id),
            sheet,
            page=anchor.page,
            path_index=anchor.path_index,
            box=anchor.box,
        )
    raise auth.NotFound


def _insert(entity: AnyEntity | None) -> Insert:
    if not isinstance(entity, Insert):
        raise auth.NotFound
    return entity
