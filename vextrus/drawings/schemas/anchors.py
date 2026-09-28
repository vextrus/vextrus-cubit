"""The Trace anchor as it is stored (docs/data-model.md §3.2, "The Trace anchor"; ADR 0031 §2).

Wherever an anchor is stored (`drawings`' sheets and views; later `takeoff`'s and `live_model`'s
Traces), three of its values are real columns and the rest is jsonb, so "which Traces use this
artefact" is a query:

    sheet_revision_id  uuid          the printed sheet it lies on (a downward id to drawings)
    source_sha256      char(64)      the file it was read from
    reader_version     varchar(64)   the reader version that read it
    anchor             jsonb         the rest: `StoredAnchor.detail`

    stored = StoredAnchor.of(anchor, sheet_revision_id=sr_id)   # from engine.read.anchor's Anchor
    Trace.objects.create(sheet_revision_id=stored.sheet_revision_id, source_sha256=
        stored.source_sha256, reader_version=stored.reader_version, anchor=stored.detail, …)
    drawings.services.resolve(stored.anchor(), sheet_revision_id=stored.sheet_revision_id)
"""

import uuid
from dataclasses import dataclass
from typing import Any

from ninja import Schema

from engine.read.anchor import Anchor, anchor_from_json

_COLUMNS = ("source_sha256", "reader_version")


@dataclass(frozen=True)
class StoredAnchor:
    sheet_revision_id: uuid.UUID
    source_sha256: str
    reader_version: str
    detail: dict[str, Any]
    """The anchor's JSON less its two columns (its kind, reader, sheet, chain and handle; or page,
    path index and box, as decimal strings)."""

    @classmethod
    def of(cls, anchor: Anchor, *, sheet_revision_id: uuid.UUID) -> StoredAnchor:
        data = anchor.to_json()
        detail = {name: value for name, value in data.items() if name not in _COLUMNS}
        return cls(sheet_revision_id, data["source_sha256"], data["reader_version"], detail)

    def anchor(self) -> Anchor:
        return anchor_from_json(
            {**self.detail, "source_sha256": self.source_sha256, "reader_version": self.reader_version}
        )


class AnchorOut(Schema):
    """A stored anchor in the API: the columns and the rest."""

    sheet_revision_id: uuid.UUID
    source_sha256: str
    reader_version: str
    detail: dict[str, Any]

    @classmethod
    def from_stored(cls, stored: StoredAnchor) -> AnchorOut:
        return cls(
            sheet_revision_id=stored.sheet_revision_id,
            source_sha256=stored.source_sha256,
            reader_version=stored.reader_version,
            detail=stored.detail,
        )
