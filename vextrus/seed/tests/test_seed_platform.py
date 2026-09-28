"""The demo seed's platform part: the two Developers on the Bangladesh Market (m0-screens §7)."""

import uuid
from datetime import timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from vextrus.platform.services import invitations, markets, tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api


@pytest.mark.django_db
def test_the_seed_makes_the_two_developers_on_the_market(staff: Any) -> None:
    demo: Demo = {}

    seed_platform.run(demo)

    with tenancy.acting_in(None, user_id=staff.pk):
        named = {choice.id: choice.name for choice in tenancy.staff_developers()}
    assert named == {
        demo["developer:shapla"]: "Shapla Homes Ltd",
        demo["developer:meghna"]: "Meghna Properties Ltd",
    }
    for name in ("developer:shapla", "developer:meghna"):
        with tenancy.acting_in(demo[name]):
            assert markets.of_developer(demo[name]) == demo["market"]
    assert tenancy.current_tenant_id() is None


# The people of m0-screens §7 (07) ---------------------------------------------------------------

DEMO_PASSWORD = "a demo passphrase for walks"


@pytest.fixture
def seeded(monkeypatch: pytest.MonkeyPatch) -> Demo:
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, DEMO_PASSWORD)
    demo: Demo = {}
    seed_platform.run(demo)
    return demo


def members_as_md(demo: Demo) -> invitations.Members:
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:kamal"]):
        return invitations.members()


@pytest.mark.django_db
def test_the_seed_makes_the_people_of_m0_screens(seeded: Demo) -> None:
    found = members_as_md(seeded)

    assert {(p.email, p.name, p.role, p.invited_by) for p in found.people} == {
        ("kamal@shapla-homes.example", "Kamal Uddin", "md", None),
        ("nusrat@shapla-homes.example", "Nusrat Jahan", "qs", "Kamal Uddin"),
        ("farhana@padma-builders.example", "Farhana Kabir", "guest", "Kamal Uddin"),
    }
    assert [(p.email, p.name, p.invited_by) for p in found.vextrus_access] == [
        ("arif@vextrus.example", "Arif Rahman", "Kamal Uddin")
    ]
    assert [(i.membership_id, i.email, i.role) for i in found.invitations] == [
        (seeded["invitation:rumana"], "rumana@shapla-homes.example", "qs")
    ]
    with tenancy.acting_in(seeded["developer:meghna"], user_id=seeded["user:tanvir"]) as meghna:
        assert meghna.membership is not None
        assert meghna.membership.role == "qs"
        assert [p.email for p in invitations.members().people] == ["tanvir@meghna.example"]


@pytest.mark.django_db
def test_the_seed_s_guest_is_from_outside_until_26_october_for_every_project_until_08(
    seeded: Demo,
) -> None:
    [guest] = [p for p in members_as_md(seeded).people if p.role == "guest"]

    assert guest.membership_id == seeded["membership:guest"]
    assert (guest.outside_org, guest.all_projects) == ("Padma Builders", True)
    assert guest.until is not None
    local = guest.until.astimezone(ZoneInfo(seeded["market"].time_zone)).date()
    assert local == seed_platform.GUEST_UNTIL or local > timezone.now().date()


@pytest.mark.django_db
def test_the_seed_s_engineer_has_30_days(seeded: Demo) -> None:
    [engineer] = members_as_md(seeded).vextrus_access

    assert engineer.membership_id == seeded["membership:engineer"]
    assert engineer.until is not None
    assert abs(engineer.until - (timezone.now() + timedelta(days=30))) < timedelta(minutes=5)


@pytest.mark.django_db
def test_projects_seed_scopes_the_guest_as_the_md_through_the_service(seeded: Demo) -> None:
    kr01 = uuid.uuid4()

    with tenancy.acting_in(seeded["developer:shapla"], user_id=seeded["user:kamal"]):
        invitations.set_projects(seeded["membership:guest"], [kr01])

    with tenancy.acting_in(seeded["developer:shapla"], user_id=seeded["user:farhana"]) as acting:
        assert acting.membership is not None
        assert acting.membership.project_ids == frozenset({kr01})


def signs_in(email: str, password: str) -> bool:
    response = Api().post("/api/auth/sign-in", {"email": email, "password": password})
    return bool(response.status_code == 200)


@pytest.mark.django_db
def test_the_seeded_people_sign_in_with_the_demo_password_which_is_never_logged(
    seeded: Demo, caplog: pytest.LogCaptureFixture, capsys: pytest.CaptureFixture[str]
) -> None:
    assert signs_in("nusrat@shapla-homes.example", DEMO_PASSWORD)
    assert signs_in("farhana@padma-builders.example", DEMO_PASSWORD)
    captured = capsys.readouterr()
    assert DEMO_PASSWORD not in caplog.text + captured.out + captured.err


@pytest.mark.django_db
def test_without_the_demo_password_no_one_can_sign_in(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    monkeypatch.delenv(seed_platform.PASSWORD_VARIABLE, raising=False)
    seed_platform.run({})

    assert not signs_in("kamal@shapla-homes.example", "")
    assert seed_platform.PASSWORD_VARIABLE in caplog.text
