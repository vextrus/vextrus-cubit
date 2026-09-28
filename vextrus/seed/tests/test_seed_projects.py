"""The demo seed's projects (m0-screens §7): Shapla's three, Meghna's one, each with its Site and
one Building, on the Market's currency and default Display Units."""

import pytest
from django.db import connection

from vextrus.platform.services import markets, tenancy
from vextrus.projects import services
from vextrus.seed import platform as seed_platform
from vextrus.seed import projects as seed_projects
from vextrus.seed.demo import Demo


@pytest.mark.django_db
def test_the_seed_makes_each_developers_projects_with_their_site_and_building() -> None:
    demo: Demo = {}
    seed_platform.run(demo)

    seed_projects.run(demo)

    market = markets.by_code("BD")
    expected = {
        "developer:shapla": ["BP-02", "KR-01", "SG-03"],
        "developer:meghna": ["MG-01"],
    }
    for developer, codes in expected.items():
        with tenancy.acting_in(demo[developer]):
            found = services.list()
            assert [project.code for project in found] == codes
            for project in found:
                assert demo[f"project:{project.code}"] == project.id
                assert (project.currency, project.unit_system) == (
                    market.currency.code,
                    market.default_unit_system,
                )
                [building] = services.buildings(project.id)
                assert demo[f"building:{project.code}"] == building.id
                assert building.name == "Building 1"
                with connection.cursor() as cursor:
                    cursor.execute(
                        "select count(*) from projects_site where project_id = %s", [project.id]
                    )
                    assert cursor.fetchone() == (1,)
    with tenancy.acting_in(demo["developer:shapla"]):
        kadam = services.get(demo["project:KR-01"])
    assert (kadam.name, kadam.address) == ("Kadam Residence", "Plot 14, Road 7, Block C, Dhaka")
