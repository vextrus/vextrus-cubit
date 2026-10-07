"""Finding a `drawings` row the way every service must: in the acting tenant (row-level security
holds that whatever the code does) and in the acting Membership's Projects (`projects.services.get`,
which answers "not found" for a Project outside the scope). A row that is missing, another
Developer's or outside the scope is one answer, `auth.NotFound`, so its existence never leaks.

With no Membership (a job step for the system, the seed) the scope is the whole tenant; a job step for
a user acts through that user's Membership, so it keeps the user's Projects (09's `Run.acting`).
"""

import hashlib
import re
import uuid
from collections.abc import Callable

from django.db import connection
from django.db.models import Model, QuerySet

from vextrus.drawings.models import DrawingFile, DrawingSet, SheetRevision, View
from vextrus.platform.services import auth, tenancy
from vextrus.projects import services as projects

_SAFE_NAME = re.compile(r"[A-Za-z0-9._+-]{1,40}")


def tenant_id() -> uuid.UUID:
    """The acting tenant; with none, nothing is found."""
    found = tenancy.current_tenant_id()
    if found is None:
        raise auth.NotFound
    return found


def in_scope(project_id: uuid.UUID) -> None:
    """Refuse a Project the acting Membership may not open (or none of this tenant) as not found."""
    projects.get(project_id)


def drawing_set(set_id: uuid.UUID) -> DrawingSet:
    return _checked(DrawingSet.objects.filter(id=set_id), lambda found: found.project_id)


def drawing_file(file_id: uuid.UUID, *, lock: bool = False) -> DrawingFile:
    rows = DrawingFile.objects.select_related("drawing_set").filter(id=file_id)
    if lock:
        rows = rows.select_for_update(of=("self",))
    return _checked(rows, lambda found: found.drawing_set.project_id)


def sheet_revision(sheet_revision_id: uuid.UUID, *, lock: bool = False) -> SheetRevision:
    rows = SheetRevision.objects.select_related("source_file__drawing_set", "sheet").filter(
        id=sheet_revision_id
    )
    if lock:
        rows = rows.select_for_update(of=("self",))
    return _checked(rows, lambda found: found.source_file.drawing_set.project_id)


def view(view_id: uuid.UUID, *, lock: bool = False, anchors: bool = True) -> View:
    """A view in scope; else not found. `anchors=False`: neither its anchors nor its sheet's read."""
    rows = View.objects.select_related("sheet_revision__source_file__drawing_set").filter(id=view_id)
    if not anchors:
        rows = rows.defer("anchors", "sheet_revision__anchors")
    if lock:
        rows = rows.select_for_update(of=("self",))
    return _checked(rows, lambda found: found.sheet_revision.source_file.drawing_set.project_id)


def _checked[M: Model](rows: QuerySet[M], project_of: Callable[[M], uuid.UUID]) -> M:
    tenant_id()
    found = rows.first()
    if found is None:
        raise auth.NotFound
    in_scope(project_of(found))
    return found


def lock(*parts: object) -> None:
    """A transaction-level lock on a name, so two acts on one thing wait for each other."""
    name = ":".join(str(part) for part in ("drawings", *parts))
    with connection.cursor() as cursor:
        cursor.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))", [name])


def key_name(value: str) -> str:
    """A reader's name or version as a storage key's name part: itself when it is a plain word, else
    a fixed digest of it (a key's name holds only `[A-Za-z0-9._@+-]`)."""
    if _SAFE_NAME.fullmatch(value):
        return value
    return "h" + hashlib.sha256(value.encode()).hexdigest()[:24]
