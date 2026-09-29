"""A file's kept read steps and a printed sheet's views as its tenant holds them, whatever the file's
state (the sheet list shows only read files), for the read job's tests (21b)."""

import uuid

from vextrus.drawings.models import ReadStep, View
from vextrus.testing.tenancy import Member


def kept_steps(member: Member, file_id: uuid.UUID) -> list[ReadStep]:
    """The file's kept steps, in the order they were kept, as `member`'s tenant sees them."""
    with member.acting():
        return list(ReadStep.objects.filter(file_id=file_id).order_by("created_at", "id"))


def view_ids(member: Member, sheet_revision_id: uuid.UUID) -> set[uuid.UUID]:
    """The ids of a printed sheet's views, as `member`'s tenant sees them."""
    with member.acting():
        return set(View.objects.filter(sheet_revision_id=sheet_revision_id).values_list("id", flat=True))
