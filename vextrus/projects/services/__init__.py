"""`projects`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit.

    from vextrus.projects import services
    services.create(code="KR-01", name="Kadam Residence")  # its Site and one Building with it
    services.list()                    # the Projects the current Membership may open
    services.get(project_id)           # else services.ProjectNotFound, never "forbidden"
    services.buildings(project_id)     # for drawings (14): one in M0
    services.ended_access_codes()      # the codes of ended access's Projects (#75)
    services.invitation_projects(token)  # the Projects an invitation link gives (#75)
"""

from vextrus.projects.services import access, projects
from vextrus.projects.services.access import (
    EndedCodes,
    ProjectName,
    ended_access_codes,
    invitation_projects,
)
from vextrus.projects.services.projects import (
    BuildingView,
    NoDeveloper,
    ProjectNotFound,
    ProjectView,
    Refused,
    buildings,
    create,
    get,
    list,
)

__all__ = [
    "BuildingView",
    "EndedCodes",
    "NoDeveloper",
    "ProjectName",
    "ProjectNotFound",
    "ProjectView",
    "Refused",
    "access",
    "buildings",
    "create",
    "ended_access_codes",
    "get",
    "invitation_projects",
    "list",
    "projects",
]
