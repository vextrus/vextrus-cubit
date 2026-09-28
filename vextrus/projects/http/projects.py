"""Projects in the API (ticket 08; docs/design/m0-screens.md §4.3): list, get and create.

Each operation declares its act through 07's guard, which answers first: signed out 401; no current
Membership 403; a Project outside the Membership's scope 404, before the role; a role lacking the act
(the MD or a Guest creating) 403. The service then answers "not found" the same way for a Project the
guard let by (another Developer's, or none at all), so every 404 is one answer.
"""

import uuid

from django.http import HttpRequest
from ninja import Router, Status

from vextrus.platform.http.acts import declare
from vextrus.projects import acts, services
from vextrus.projects.schemas import ProjectIn, ProjectOut, ProjectRefusedOut

router = Router()


@router.get("/projects", response=list[ProjectOut])
@declare(acts.OPEN)
def list_projects(request: HttpRequest) -> list[ProjectOut]:
    """The Projects the member may open, by code."""
    return [ProjectOut.from_view(project) for project in services.list()]


@router.get("/projects/{project_id}", response=ProjectOut)
@declare(acts.OPEN, project="project_id")
def get_project(request: HttpRequest, project_id: uuid.UUID) -> ProjectOut:
    return ProjectOut.from_view(services.get(project_id))


@router.post("/projects", response={201: ProjectOut, 400: ProjectRefusedOut, 409: ProjectRefusedOut})
@declare(acts.CREATE)
def create_project(request: HttpRequest, payload: ProjectIn) -> Status[ProjectOut | ProjectRefusedOut]:
    """Create a Project with its Site and Building, on the Developer's Market. A value refused is 400
    and a code taken 409, each with the field at fault; refusing the act itself (a member given chosen
    Projects) is the guard's 403, as every 403 is."""
    try:
        project = services.create(
            code=payload.code,
            name=payload.name,
            address=payload.address,
            unit_system=payload.unit_system,
        )
    except services.Refused as refused:
        if refused.field is None:
            raise
        return Status(refused.status, ProjectRefusedOut.from_refused(refused))
    return Status(201, ProjectOut.from_view(project))
