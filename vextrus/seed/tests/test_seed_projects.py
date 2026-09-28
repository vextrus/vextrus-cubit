"""The demo seed's projects (m0-screens §7): Shapla's three, Meghna's one, each with its Site and
one Building, on the Market's currency and default Display Units."""

import pytest
from django.db import connection

from vextrus.platform.services import activity, markets, tenancy
from vextrus.projects import services
from vextrus.seed import platform as seed_platform
from vextrus.seed import projects as seed_projects
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch) -> Demo:
    """platform's seed (07's people) then projects', as `seed_demo` runs them."""
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    made: Demo = {}
    seed_platform.run(made)
    seed_projects.run(made)
    return made


@pytest.mark.django_db
def test_the_seed_makes_each_developers_projects_with_their_site_and_building(demo: Demo) -> None:

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


@pytest.mark.django_db
def test_the_seeds_guest_is_given_only_kr_01_by_the_md(demo: Demo) -> None:
    guest = demo["user:farhana"]

    with tenancy.acting_in(demo["developer:shapla"], user_id=guest) as acting:
        assert acting.membership is not None
        assert acting.membership.role == "guest"
        assert [project.code for project in services.list()] == ["KR-01"]
        with pytest.raises(services.ProjectNotFound):
            services.get(demo["project:BP-02"])
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:kamal"]):
        seen = [(act.code, act.actor.name if act.actor else None) for act in activity.acts()]
    assert ("platform.invitations.projects_set", "Kamal Uddin") in seen


@pytest.mark.django_db
def test_the_seeds_guest_sees_another_projects_address_as_not_found(demo: Demo) -> None:
    signed_in = Api()
    assert (
        signed_in.post(
            "/api/auth/sign-in",
            {"email": "farhana@padma-builders.example", "password": "a demo password for the tests"},
        ).status_code
        == 200
    )

    listed = signed_in.get("/api/projects").json()
    elsewhere = signed_in.get(f"/api/projects/{demo['project:BP-02']}")

    assert [project["code"] for project in listed] == ["KR-01"]
    assert (elsewhere.status_code, elsewhere.json()) == (
        404,
        {"code": "platform.auth.not_found", "params": {}},
    )
