"""`projects`'s public services: other modules call only these and `schemas`.

Each ticket writes its own submodule (`services/<name>.py`); this file re-exports them, and a
re-export line is the only shared edit.

    from vextrus.projects import services
    services.create(code="KR-01", name="Kadam Residence")  # its Site and one Building with it
    services.list()                    # the Projects the current Membership may open
    services.get(project_id)           # else services.ProjectNotFound, never "forbidden"
    services.buildings(project_id)     # for drawings (14): one in M0
"""

from vextrus.projects.services import projects
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
    "NoDeveloper",
    "ProjectNotFound",
    "ProjectView",
    "Refused",
    "buildings",
    "create",
    "get",
    "list",
    "projects",
]
