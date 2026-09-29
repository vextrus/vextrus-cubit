"""The Trace anchor in the API: its three columns and the rest (`services.StoredAnchor`)."""

import uuid
from typing import Any

from ninja import Schema

from vextrus.drawings.services.stored_anchor import StoredAnchor

__all__ = ["AnchorOut", "StoredAnchor"]


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
