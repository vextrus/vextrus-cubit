"""The demo seed's `projects` rows (08): the projects of docs/design/m0-screens.md §7, each made through
`projects.services.create`, so each has its Site and one Building, "Building 1", made with it, and
takes its Developer's Market, currency and default Display Units. The addresses are the wireframes'
(`docs/design/m0-wireframes/projects-1440.svg`); Meghna's is invented alike.

Then the seed's Guest (07 made her Membership for every Project, since KR-01 did not exist yet) is
given only KR-01, through the service an MD uses, acting as Kamal Uddin, Shapla's MD: the act is in
the event log as his; so is Rafiq Islam, the Guest whose access has ended (#75). Chameli Homes Ltd
has no Project (4.3's empty state).

For later seeds, `demo` gains `project:<code>` and `building:<code>` (the one Building's id).
"""

from vextrus.platform.services import invitations, tenancy
from vextrus.projects import services
from vextrus.seed.demo import Demo

PROJECTS: dict[str, tuple[tuple[str, str, str], ...]] = {
    "developer:shapla": (
        ("KR-01", "Kadam Residence", "Plot 14, Road 7, Block C, Dhaka"),
        ("BP-02", "Bokul Place", "House 3, Lane 2, Dhaka"),
        ("SG-03", "Shimul Garden", "Plot 9, Sector 4, Dhaka"),
    ),
    "developer:meghna": (("MG-01", "Meghna Heights", "Plot 22, Road 11, Block D, Dhaka"),),
}
GUEST_PROJECTS = ("KR-01",)
"""The Projects the seed's Guest, a contractor's QS, is given (m0-screens §7), and those the Guest
whose access has ended had been given ("Your access to KR-01 at Shapla Homes Ltd has ended…")."""


def run(demo: Demo) -> None:
    for developer, projects in PROJECTS.items():
        with tenancy.acting_in(demo[developer]):
            for code, name, address in projects:
                project = services.create(code=code, name=name, address=address)
                [building] = services.buildings(project.id)
                demo[f"project:{code}"] = project.id
                demo[f"building:{code}"] = building.id
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:kamal"]):
        for guest in ("membership:guest", "membership:ended_guest"):
            invitations.set_projects(demo[guest], [demo[f"project:{code}"] for code in GUEST_PROJECTS])
