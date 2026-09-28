"""A Project in the API (ticket 08). The body of a create names no Market, currency or tenant: those
come from the acting Developer, and a body that sends one is refused rather than ignored."""

import uuid
from datetime import datetime

from ninja import Schema
from pydantic import ConfigDict

from engine.messages import Message
from vextrus.projects.services import ProjectView, Refused


class ProjectIn(Schema):
    """What a QS gives: a code and a name, an address, and the Display Units (the Market's default
    when left out). Lengths and blanks are refused by the service, with a message per field."""

    model_config = ConfigDict(extra="forbid")

    code: str
    name: str
    address: str = ""
    unit_system: str | None = None


class ProjectOut(Schema):
    id: uuid.UUID
    code: str
    name: str
    address: str
    market_id: uuid.UUID
    currency: str
    """Its Market's currency, an ISO 4217 code."""
    unit_system: str
    created_at: datetime

    @classmethod
    def from_view(cls, view: ProjectView) -> ProjectOut:
        return cls(
            id=view.id,
            code=view.code,
            name=view.name,
            address=view.address,
            market_id=view.market_id,
            currency=view.currency,
            unit_system=view.unit_system,
            created_at=view.created_at,
        )


class ProjectRefusedOut(Schema):
    """Why a create was refused: the field at fault (none for the whole act) and a message code."""

    field: str | None
    message: Message

    @classmethod
    def from_refused(cls, refused: Refused) -> ProjectRefusedOut:
        return cls(field=refused.field, message=refused.message)
