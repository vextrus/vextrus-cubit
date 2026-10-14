"""How M1's Takeoff replies name a storey and a sheet (docs/plans/M1.md C17, C19; A17): by id and the
words a QS sees (the confirmed storey's name; the sheet's number and title), never by a key."""

import uuid

from ninja import Schema


class StoreyRefOut(Schema):
    """A confirmed storey: its id and its name ("1st"), never its key."""

    id: uuid.UUID
    name: str


class SheetRefOut(Schema):
    """A sheet: its id, number and title."""

    id: uuid.UUID
    number: str
    title: str
