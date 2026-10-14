"""A Trace in the API (docs/plans/M1.md C7, A8; frozen by M1-00): `{fact, kind, anchor | null,
question_id | null}`, its anchor C7's anchor JSON. Any module's reply that carries a Trace uses these."""

import uuid
from decimal import Decimal

from ninja import Schema
from pydantic import Field

from vextrus.live_model.services import TraceKind


class TraceAnchorOut(Schema):
    """A `sheet_entity` anchor: the sheet, view and file it was read in, the entity's handle (DWG) or
    the page (PDF), and its box on the sheet in mm, `[x0, y0, x1, y1]`."""

    sheet_id: uuid.UUID
    view_id: uuid.UUID
    file_id: uuid.UUID
    handle: str | None
    page: int | None
    bbox_sheet_mm: list[Decimal] = Field(min_length=4, max_length=4)


class TraceEntryOut(Schema):
    """One fact's Trace."""

    fact: str
    kind: TraceKind
    anchor: TraceAnchorOut | None
    question_id: uuid.UUID | None
