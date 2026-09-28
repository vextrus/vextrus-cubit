"""Creating a Project: its Market, currency and Display Units from the Developer's Market; its Site and
one Building in the same transaction, never a second (docs/data-model.md §3.1; ADRs 0036, 0038)."""

import inspect
import uuid
from collections.abc import Callable
from dataclasses import replace

import pytest
from django.db import connection

from vextrus.platform.services import markets, tenancy
from vextrus.platform.services.markets import MarketProfile
from vextrus.projects import services
from vextrus.projects.models import Building, Project, Site
from vextrus.projects.services import projects
from vextrus.testing.tenancy import Member


@pytest.fixture
def qs(sign_in: Callable[..., Member]) -> Member:
    return sign_in(role="qs")


def events_of(kind: str) -> list[tuple[uuid.UUID | None, ...]]:
    """The acting tenant's events of a kind (platform's models are private to it)."""
    with connection.cursor() as cursor:
        cursor.execute(
            "select project_id, subject_id, actor_user_id, building_id from platform_domainevent"
            " where kind = %s",
            [kind],
        )
        return list(cursor.fetchall())


@pytest.mark.django_db
def test_a_project_takes_its_developers_market_currency_and_default_units(
    qs: Member, market: MarketProfile
) -> None:
    with qs.acting():
        project = services.create(code="KR-01", name="Kadam Residence", address="Plot 14, Road 7")

    assert (project.code, project.name, project.address) == (
        "KR-01",
        "Kadam Residence",
        "Plot 14, Road 7",
    )
    assert project.market_id == market.id
    assert project.currency == market.currency.code
    assert project.unit_system == market.default_unit_system


@pytest.mark.django_db
def test_creating_a_project_makes_its_site_and_one_building_named_building_1(qs: Member) -> None:
    with qs.acting():
        project = services.create(code="KR-01", name="Kadam Residence")
        [building] = services.buildings(project.id)
        sites = list(Site.objects.filter(project_id=project.id).values_list("tenant_id", flat=True))

    assert building.project_id == project.id
    assert (building.name, building.ordinal) == ("Building 1", 1)
    assert sites == [qs.developer_id]


@pytest.mark.django_db
def test_every_offered_unit_system_may_be_chosen(qs: Member, market: MarketProfile) -> None:
    with qs.acting():
        made = [
            services.create(code=f"P-{number}", name="A project", unit_system=system)
            for number, system in enumerate(market.unit_systems)
        ]

    assert [project.unit_system for project in made] == list(market.unit_systems)


@pytest.mark.django_db
def test_a_unit_system_the_market_does_not_offer_is_refused_and_nothing_is_made(
    qs: Member, market: MarketProfile
) -> None:
    with qs.acting(), pytest.raises(projects.Refused) as refused:
        services.create(code="KR-01", name="Kadam Residence", unit_system="cubits")

    assert refused.value.field == "unit_system"
    assert refused.value.message == {
        "code": "projects.projects.unit_system_not_offered",
        "params": {},
    }
    with qs.acting():
        assert services.list() == []
        assert not Building.objects.exists()


@pytest.mark.django_db
def test_the_currency_and_units_follow_the_market_not_the_caller(
    qs: Member, market: MarketProfile, monkeypatch: pytest.MonkeyPatch
) -> None:
    # A Market whose default and currency differ from the seeded one's: whatever the Market says wins.
    other = replace(
        market,
        currency=replace(market.currency, code="XTS"),
        default_unit_system=market.unit_systems[-1],
    )
    monkeypatch.setattr(markets, "of_developer", lambda developer_id: other)

    with qs.acting():
        project = services.create(code="KR-01", name="Kadam Residence")

    assert (project.currency, project.unit_system) == ("XTS", market.unit_systems[-1])


def test_create_takes_no_market_or_currency_from_its_caller() -> None:
    accepted = set(inspect.signature(services.create).parameters)

    assert accepted == {"code", "name", "address", "unit_system"}


@pytest.mark.django_db
def test_the_project_is_made_in_the_acting_developer(qs: Member, sign_in: Callable[..., Member]) -> None:
    other = sign_in(role="qs")

    with qs.acting():
        project = services.create(code="KR-01", name="Kadam Residence")
    with other.acting():
        assert services.list() == []
        with pytest.raises(projects.ProjectNotFound):
            services.buildings(project.id)
    stored = Project.objects.filter(id=project.id)
    with qs.acting():
        assert list(stored.values_list("tenant_id", flat=True)) == [qs.developer_id]


@pytest.mark.django_db
def test_creating_is_an_act_recorded_as_a_domain_event(qs: Member) -> None:
    with qs.acting():
        project = services.create(code="KR-01", name="Kadam Residence")
        recorded = events_of("projects.projects.created")

    assert recorded == [(project.id, project.id, qs.user.pk, None)]


@pytest.mark.django_db
def test_a_name_and_a_code_are_required_and_trimmed(qs: Member) -> None:
    with qs.acting():
        with pytest.raises(projects.Refused) as no_name:
            services.create(code="KR-01", name="   ")
        with pytest.raises(projects.Refused) as no_code:
            services.create(code=" ", name="Kadam Residence")
        project = services.create(code="  KR-01 ", name=" Kadam Residence  ", address=" Plot 14 ")

    assert (no_name.value.field, no_name.value.message["code"]) == (
        "name",
        "projects.projects.name_missing",
    )
    assert (no_code.value.field, no_code.value.message["code"]) == (
        "code",
        "projects.projects.code_missing",
    )
    assert (project.code, project.name, project.address) == ("KR-01", "Kadam Residence", "Plot 14")


@pytest.mark.django_db
def test_a_value_too_long_for_its_field_is_refused_with_its_limit(qs: Member) -> None:
    with qs.acting(), pytest.raises(projects.Refused) as refused:
        services.create(code="K" * 33, name="Kadam Residence")

    assert (refused.value.field, refused.value.message) == (
        "code",
        {"code": "projects.projects.too_long", "params": {"limit": 32}},
    )


@pytest.mark.django_db
def test_creating_outside_any_developer_is_refused() -> None:
    with tenancy.acting_in(None), pytest.raises(projects.NoDeveloper):
        services.create(code="KR-01", name="Kadam Residence")


@pytest.mark.django_db
def test_a_failed_building_rolls_the_project_and_its_site_back(
    qs: Member, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail(*args: object, **kwargs: object) -> None:
        raise RuntimeError("the Building could not be written")

    monkeypatch.setattr(Building.objects, "create", fail)

    with qs.acting(), pytest.raises(RuntimeError):
        services.create(code="KR-01", name="Kadam Residence")
    monkeypatch.undo()
    with qs.acting():
        assert services.list() == []
        assert not Site.objects.exists()
