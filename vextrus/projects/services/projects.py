"""Projects, their Site and their Buildings (ticket 08; docs/data-model.md §3.1; ADRs 0036, 0038).

Every function acts in the tenant the transaction acts in (`tenancy`), and row-level security holds
it there whatever the code does. On top of the tenant, **the Project scope**: a Membership given
chosen Projects (`tenancy.current_membership().project_ids`) lists and gets only those; any other
Project, of this Developer or another, or none at all, is `ProjectNotFound`, by one query on one
path, so a Project's existence never leaks. With no Membership (a job step, the seed, staff in the
admin) the scope is the whole tenant.

    project = projects.services.create(code="KR-01", name="Kadam Residence")
    [building] = projects.services.buildings(project.id)   # "Building 1", never shown in M0

The Market, the currency and the Display Units come from the acting Developer's Market, never from
the caller: `create` takes no Market or currency, and a unit system the Market does not offer is
refused. Creating a Project makes its Site and one Building in the same transaction; nothing else
makes a Building in M0.

The database holds this too (migration 0001): the app role may UPDATE only the columns a person may
change (`code`, `code_key`, `name`, `address`, `unit_system`), and a trigger refuses any INSERT or
UPDATE whose Market, currency or unit system is not its Developer's Market's, so deleting a Project
and inserting it again cannot swap them either. The app role deletes no Project, Site or Building
(migration 0003), so none of their ids comes free for another Project: whatever names a Building by
id stays with its Project. A later update service saves with `update_fields` and recomputes
`code_key`.
"""

import builtins
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime

from django.db import IntegrityError, transaction
from django.db.models import CharField, QuerySet

from engine.messages import Message
from vextrus.platform.services import auth, events, markets, tenancy
from vextrus.projects.messages import projects as said
from vextrus.projects.models import Building, Project, Site

FIRST_BUILDING_CODE = "B1"
FIRST_BUILDING_NAME = "Building 1"
"""The one Building's name, fixed so the design gate can grep that it never shows (m0-screens §1.10)."""


@dataclass(frozen=True)
class ProjectView:
    id: uuid.UUID
    code: str
    name: str
    address: str
    market_id: uuid.UUID
    currency: str
    """Its Market's currency (ISO 4217), stored when the Project was made."""
    unit_system: str
    """Its Display Units: one of the unit systems its Market offers."""
    created_at: datetime
    updated_at: datetime
    """When the Project's newest DomainEvent happened (its creation's, at least), for every role."""


@dataclass(frozen=True)
class BuildingView:
    id: uuid.UUID
    project_id: uuid.UUID
    code: str
    name: str
    """Data, never shown while a Project has one Building (m0-screens §1.10)."""
    ordinal: int


class ProjectNotFound(auth.NotFound):
    """No such Project in the acting Developer, or one the Membership may not open: 07's one answer
    for every "not found" (404, `platform.auth.not_found`), whichever layer finds it."""

    def __init__(self, project_id: uuid.UUID | None = None) -> None:
        super().__init__()
        self.project_id = project_id


class NoDeveloper(RuntimeError):
    """A Project was asked for outside any Developer (a caller's mistake: a declared operation has
    refused an act outside a Developer before its service runs)."""


class Refused(auth.Refused):
    """A create refused: the field at fault (None for the whole act), the reason as a message, and
    the HTTP status it answers with (400 a value, 409 a code taken, 403 a member given chosen
    Projects)."""

    def __init__(self, field: str | None, message: Message, status: int = 400) -> None:
        super().__init__(message, status=status)
        self.field = field


# Reading ----------------------------------------------------------------------------------------


def list() -> builtins.list[ProjectView]:
    """The Projects the current Membership may open, by code."""
    projects = builtins.list(_open().order_by("code_key", "id"))
    newest = events.newest_for_projects([project.id for project in projects])
    return [_view(project, newest.get(project.id)) for project in projects]


def get(project_id: uuid.UUID) -> ProjectView:
    found = _open().filter(id=project_id).first()
    if found is None:
        raise ProjectNotFound(project_id)
    return _view(found, events.newest_for_projects([found.id]).get(found.id))


def buildings(project_id: uuid.UUID) -> builtins.list[BuildingView]:
    """A Project's Buildings, by ordinal (one in M0), for `drawings` to assign each file to (14)."""
    tenant_id = _open().filter(id=project_id).values_list("tenant_id", flat=True).first()
    if tenant_id is None:
        raise ProjectNotFound(project_id)
    found = Building.objects.filter(tenant_id=tenant_id, project_id=project_id).order_by("ordinal")
    return [BuildingView(b.id, b.project_id, b.code, b.name, b.ordinal) for b in found]


def _open() -> QuerySet[Project]:
    """The acting Developer's Projects that the current Membership may open."""
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        return Project.objects.none()
    found = Project.objects.filter(tenant_id=tenant_id)
    membership = tenancy.current_membership()
    if membership is not None and membership.project_ids:
        found = found.filter(id__in=membership.project_ids)
    return found


def _view(project: Project, newest_event: datetime | None = None) -> ProjectView:
    return ProjectView(
        id=project.id,
        code=project.code,
        name=project.name,
        address=project.address,
        market_id=project.market_id,
        currency=project.currency_code,
        unit_system=project.unit_system,
        created_at=project.created_at,
        updated_at=max(newest_event, project.created_at) if newest_event else project.created_at,
    )


# Creating ---------------------------------------------------------------------------------------


def create(*, code: str, name: str, address: str = "", unit_system: str | None = None) -> ProjectView:
    """Create a Project in the acting Developer, with its Site and one Building, in one transaction.

    Its Market and currency are the Developer's Market's; its Display Units are `unit_system` when
    the Market offers it, else refused, and the Market's default when not given. The code is unique
    in the Developer whatever its case, so a retried or concurrent create of the same code is refused
    and never makes a second Project or Building. A member given chosen Projects may not create one.
    """
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        raise NoDeveloper
    membership = tenancy.current_membership()
    if membership is not None and membership.project_ids:
        raise Refused(None, said.SCOPED_MEMBER_CANNOT_CREATE(), status=403)
    code, name, address = (
        unicodedata.normalize("NFC", value).strip() for value in (code, name, address)
    )
    if not name:
        raise Refused("name", said.NAME_MISSING())
    if not code:
        raise Refused("code", said.CODE_MISSING())
    for field, value in (("code", code), ("name", name), ("address", address)):
        limit = _max_length(field)
        if len(value) > limit:
            raise Refused(field, said.TOO_LONG(limit=limit))
    key = code_key(code)
    if len(key) > _max_length("code_key"):
        # A few characters grow many-fold when folded (NFKC): refused as too long, at the code's limit.
        raise Refused("code", said.TOO_LONG(limit=_max_length("code")))
    market = markets.of_developer(tenant_id)
    system = market.default_unit_system if unit_system is None else unit_system
    if system not in market.unit_systems:
        raise Refused("unit_system", said.UNIT_SYSTEM_NOT_OFFERED())

    with transaction.atomic():
        _refuse_taken(tenant_id, key)
        try:
            with transaction.atomic():
                project = Project.objects.create(
                    tenant_id=tenant_id,
                    code=code,
                    code_key=key,
                    name=name,
                    address=address,
                    market_id=market.id,
                    currency_code=market.currency.code,
                    unit_system=system,
                )
        except IntegrityError:
            # A concurrent create took the code between the check and the insert.
            _refuse_taken(tenant_id, key)
            raise
        Site.objects.create(tenant_id=tenant_id, project=project)
        Building.objects.create(
            tenant_id=tenant_id,
            project=project,
            code=FIRST_BUILDING_CODE,
            name=FIRST_BUILDING_NAME,
            ordinal=1,
        )
        events.record(
            said.CREATED,
            subject_type="project",
            subject_id=project.id,
            project_id=project.id,
            actor_user_id=tenancy.current().user_id,
        )
    return _view(project, events.newest_for_projects([project.id]).get(project.id))


def _max_length(field: str) -> int:
    column = Project._meta.get_field(field)
    assert isinstance(column, CharField)
    assert column.max_length is not None
    return column.max_length


def code_key(code: str) -> str:
    """A code as its uniqueness sees it: compatibility-normalised and case-folded in the app (so
    "KR-01", "kr-01" and "ẞ-1", "ß-1" are one code on every database, whatever its collation)."""
    return unicodedata.normalize("NFKC", unicodedata.normalize("NFKC", code.strip()).casefold())


def _refuse_taken(tenant_id: uuid.UUID, key: str) -> None:
    """Refuse a code another Project holds, naming that Project by its own code and name."""
    holder = (
        Project.objects.filter(tenant_id=tenant_id, code_key=key).values_list("code", "name").first()
    )
    if holder is not None:
        held_code, held_name = holder
        raise Refused("code", said.CODE_TAKEN(code=held_code, name=held_name), status=409)
