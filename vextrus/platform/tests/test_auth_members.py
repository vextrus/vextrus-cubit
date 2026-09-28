"""Members and access, and the activity API: who sees whom, and no endpoint returning another
Developer's users, Memberships or events (ticket 07; m0-screens §4.4)."""

import json
import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from django.db import transaction
from django.utils import timezone

from vextrus.platform.messages import invitations as codes
from vextrus.platform.messages import tenancy as tenancy_codes
from vextrus.platform.models import DomainEvent, Membership, User
from vextrus.platform.services import events, invitations
from vextrus.testing.auth import Api, accept_as, api_as, invitation, served_operations
from vextrus.testing.tenancy import Member, add_member

PASSWORD = "a long enough passphrase 7"

pytestmark = pytest.mark.django_db


def test_the_md_sees_people_vextrus_access_and_unused_invitations(
    team: dict[str, Member], other_staff: User
) -> None:
    md = team["md"]
    engineer_id, token = invitation(md, other_staff.email)
    accept_as(token, other_staff)
    pending_id, _ = invitation(md, "rumana@example.com", "qs")

    seen = api_as(md).get("/api/members").json()

    assert sorted(p["role"] for p in seen["people"]) == ["guest", "md", "qs"]
    # (sorted: inside a test's one transaction, the database's now() is the test's start)
    assert sorted(
        (p["name"], p["invited_by"] or "", p["membership_id"]) for p in seen["vextrus_access"]
    ) == sorted(
        [
            (team["vextrus_engineer"].user.name, "", str(team["vextrus_engineer"].membership_id)),
            (other_staff.name, md.user.name, str(engineer_id)),
        ]
    )
    assert [(i["email"], i["role"], i["membership_id"]) for i in seen["invitations"]] == [
        ("rumana@example.com", "qs", str(pending_id))
    ]
    assert all(p["all_projects"] for p in seen["people"])


def test_a_vextrus_engineer_sees_the_people_only_and_a_guest_nothing(team: dict[str, Member]) -> None:
    invitation(team["md"], "rumana@example.com", "qs")

    seen = api_as(team["vextrus_engineer"]).get("/api/members").json()

    assert sorted(p["role"] for p in seen["people"]) == ["guest", "md", "qs"]
    assert (seen["vextrus_access"], seen["invitations"]) == ([], [])
    refused = api_as(team["guest"]).get("/api/members")
    assert (refused.status_code, refused.json()["code"]) == (403, "platform.auth.not_allowed")


def test_ended_access_stays_listed_with_who_ended_it(team: dict[str, Member]) -> None:
    md = api_as(team["md"])
    md.post(f"/api/members/{team['vextrus_engineer'].membership_id}/revoke")
    with team["md"].acting():
        Membership.objects.filter(id=team["guest"].membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )

    seen = md.get("/api/members").json()

    [engineer] = seen["vextrus_access"]
    assert (engineer["how_ended"], engineer["revoked_by"]) == ("revoked", team["md"].user.name)
    [guest] = [p for p in seen["people"] if p["role"] == "guest"]
    assert (guest["how_ended"], guest["revoked_by"]) == ("expired", None)


def test_a_member_given_chosen_projects_sees_only_those_they_share(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    kr, bp, sg = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    qs = sign_in(role="qs", developer_id=developer, projects=[kr, bp])
    add_member(developer, role="guest", email="sharing@example.com", projects=[kr, sg])
    add_member(developer, role="guest", email="apart@example.com", projects=[sg])
    add_member(developer, role="md", email="all@example.com")

    people = {p["email"]: p for p in api_as(qs).get("/api/members").json()["people"]}

    assert "apart@example.com" not in people
    assert (
        people["sharing@example.com"]["all_projects"],
        people["sharing@example.com"]["project_ids"],
    ) == (
        False,
        [str(kr)],
    )
    assert people["all@example.com"]["all_projects"] is True


# The activity API ---------------------------------------------------------------------------------


def test_the_md_reads_the_acts_as_codes_with_the_actor_s_name_and_role(
    team: dict[str, Member], other_staff: User
) -> None:
    md = team["md"]
    engineer_id, token = invitation(md, other_staff.email)
    accept_as(token, other_staff)
    api_as(md).post(f"/api/members/{engineer_id}/revoke")

    acts = api_as(md).get("/api/activity").json()

    named = [
        (a["code"], a["actor"]["name"] if a["actor"] else None, a["params"]["subject"]) for a in acts
    ]
    assert named[:3] == [
        (codes.REVOKED.code, md.user.name, other_staff.name),
        (codes.ACCEPTED.code, other_staff.name, other_staff.name),
        (codes.INVITED.code, md.user.name, other_staff.name),  # the person, once they joined
    ]
    assert named[-1][0] == tenancy_codes.DEVELOPER_CREATED.code
    first = acts[0]
    assert first["actor"] == {
        "id": str(md.user.pk),
        "name": md.user.name,
        "role": "md",
        "vextrus": False,
    }
    assert first["params"]["actor"] == md.user.name
    engineer = next(a for a in acts if a["code"] == codes.ACCEPTED.code)["actor"]
    assert (engineer["role"], engineer["vextrus"]) == ("vextrus_engineer", True)


def test_one_person_s_acts_newest_first_and_paged(team: dict[str, Member]) -> None:
    md = team["md"]
    for n in range(3):
        invitation(md, f"p{n}@example.com", "qs")
    invitation(team["qs"], "e@example.com")
    api = api_as(md)

    mine = api.get("/api/activity", actor=str(md.user.pk)).json()
    first = api.get("/api/activity", actor=str(md.user.pk), limit=2).json()
    rest = api.get("/api/activity", actor=str(md.user.pk), before=first[-1]["id"]).json()

    assert [a["params"]["subject"] for a in mine] == [
        "p2@example.com",
        "p1@example.com",
        "p0@example.com",
    ]
    assert first + rest == mine


@pytest.mark.parametrize("role", ["vextrus_engineer", "guest"])
def test_an_engineer_and_a_guest_read_no_acts(team: dict[str, Member], role: str) -> None:
    refused = api_as(team[role]).get("/api/activity")

    assert (refused.status_code, refused.json()["code"]) == (403, "platform.auth.not_allowed")


def test_a_member_given_chosen_projects_reads_only_their_acts(
    sign_in: Callable[..., Member], make_developer: Callable[..., uuid.UUID]
) -> None:
    developer = make_developer()
    mine, other = uuid.uuid4(), uuid.uuid4()
    qs = sign_in(role="qs", developer_id=developer, projects=[mine])
    with qs.acting():
        for project in (mine, other):
            events.record(
                codes.PROJECTS_SET, subject_type="project", project_id=project, actor_user_id=qs.user.pk
            )
    api = api_as(qs)

    projects = {a["project_id"] for a in api.get("/api/activity").json()}
    outside = api.get("/api/activity", project=str(other))

    assert str(other) not in projects
    assert str(mine) in projects
    assert (outside.status_code, outside.json()["code"]) == (404, "platform.auth.not_found")


# No endpoint returns another Developer's people or acts --------------------------------------------


def test_no_read_returns_anything_of_another_developer(
    team: dict[str, Member],
    sign_in: Callable[..., Member],
    make_developer: Callable[..., uuid.UUID],
    staff: User,
) -> None:
    meghna = make_developer("Meghna Properties Ltd")
    tanvir = sign_in(role="md", developer_id=meghna, email="tanvir@meghna.example")
    their_engineer, token = invitation(tanvir, staff.email)
    accept_as(token, staff)
    their_pending, _ = invitation(tanvir, "their-pending@example.com", "qs")
    with tanvir.acting():
        their_events = [str(e) for e in DomainEvent.objects.values_list("id", flat=True)]
    secrets = [
        "tanvir@meghna.example",
        tanvir.user.name,
        str(tanvir.user.pk),
        str(tanvir.membership_id),
        staff.email,
        staff.name,
        str(their_engineer),
        "their-pending@example.com",
        str(their_pending),
        str(meghna),
        "Meghna Properties Ltd",
        *their_events,
    ]
    reads = [
        fill
        for served in served_operations()
        if served.method == "GET" and "<" not in served.route
        for fill in ["/" + served.route]
    ]
    assert "/api/members" in reads
    assert "/api/activity" in reads

    for role, member in team.items():
        api = api_as(member)
        for path in reads:
            body = api.get(path).content.decode()
            leaked = [secret for secret in secrets if secret in body]
            assert leaked == [], (role, path, leaked)
        for query in ({"actor": str(tanvir.user.pk)}, {"before": their_events[0]}):
            body = api.get("/api/activity", **query).content.decode()
            assert [s for s in secrets if s in body] == [], (role, query)
    assert json.loads(api_as(team["md"]).get("/api/activity", actor=str(tanvir.user.pk)).content) == []


def test_an_act_says_who_acted_or_that_no_one_did_and_an_invitation_its_role(
    team: dict[str, Member],
) -> None:
    md = team["md"]
    invitation(md, "g@example.com", "guest")

    acts = api_as(md).get("/api/activity").json()

    invited = next(a for a in acts if a["code"] == codes.INVITED.code)
    created = next(a for a in acts if a["code"] == tenancy_codes.DEVELOPER_CREATED.code)
    assert (invited["params"]["by"], invited["params"]["role"]) == ("person", "guest")
    assert invited["params"]["subject"] == "g@example.com"
    assert (created["actor"], created["params"]["by"]) == (None, "vextrus")  # made by no user


# What each viewer may do to each row: the server's rules, never the web's (#75) --------------------

ACTIONS = ("revoke", "renew", "copy_link", "withdraw")
ACT_PATHS = {
    "revoke": "/api/members/{}/revoke",
    "renew": "/api/members/{}/renew",
    "copy_link": "/api/members/invitations/{}/link",
    "withdraw": "/api/members/invitations/{}/withdraw",
}


class _Undo(Exception):
    """Raised to roll an act back once its answer is read."""


def act_succeeds(api: Api, action: str, membership_id: str) -> bool:
    """Whether the act succeeds, rolled back after, so each is tried on the same rows."""
    succeeded = False
    try:
        with transaction.atomic():
            response = api.post(ACT_PATHS[action].format(membership_id))
            succeeded = 200 <= response.status_code < 300
            raise _Undo
    except _Undo:
        pass
    return succeeded


@pytest.fixture
def matrix(
    sign_in: Callable[..., Member],
    make_developer: Callable[..., uuid.UUID],
    staff: User,
    other_staff: User,
) -> dict[str, Any]:
    """One Developer: an MD, a QS, a QS given P1 only, an Engineer as a member viewing, Engineers
    each QS invited, Guests with and without an end date, a revoked QS, and unused invitations the
    MD and each QS made."""
    developer = make_developer()
    p1, p2 = uuid.uuid4(), uuid.uuid4()
    viewers = {
        "md": sign_in(role="md", developer_id=developer),
        "qs": sign_in(role="qs", developer_id=developer),
        "scoped qs": sign_in(role="qs", developer_id=developer, projects=[p1]),
        "engineer": sign_in(role="vextrus_engineer", developer_id=developer),
        "guest": sign_in(role="guest", developer_id=developer),
    }
    rows: dict[str, uuid.UUID] = {name: viewer.membership_id for name, viewer in viewers.items()}
    by_qs, token = invitation(viewers["qs"], staff.email)
    accept_as(token, staff)
    by_scoped, token = invitation(viewers["scoped qs"], other_staff.email, project_ids=[p1])
    accept_as(token, other_staff)
    _, rows["guest until, P2"] = add_member(
        developer, role="guest", projects=[p2], expires_at=timezone.now() + timedelta(days=9)
    )
    _, rows["revoked qs"] = add_member(developer, role="qs")
    with viewers["md"].acting():
        invitations.revoke(rows["revoked qs"])
    rows["engineer by qs"], rows["engineer by scoped qs"] = by_qs, by_scoped
    rows["invitation by md"], _ = invitation(viewers["md"], "rumana@example.com", "qs")
    rows["invitation by qs"], _ = invitation(viewers["qs"], "e1@example.com")
    rows["invitation by scoped qs"], _ = invitation(
        viewers["scoped qs"], "e2@example.com", project_ids=[p1]
    )
    return {"viewers": viewers, "rows": rows}


EXPECTED: dict[str, dict[str, tuple[str, ...]]] = {
    "md": {
        "qs": ("revoke",),
        "scoped qs": ("revoke",),
        "engineer": ("revoke", "renew"),
        "guest": ("revoke",),
        "guest until, P2": ("revoke", "renew"),
        "engineer by qs": ("revoke", "renew"),
        "engineer by scoped qs": ("revoke", "renew"),
        "invitation by md": ("copy_link", "withdraw"),
        "invitation by qs": ("copy_link", "withdraw"),
        "invitation by scoped qs": ("copy_link", "withdraw"),
    },
    "qs": {
        "engineer by qs": ("revoke", "renew"),
        "invitation by qs": ("copy_link", "withdraw"),
    },
    "scoped qs": {
        "engineer by scoped qs": ("revoke", "renew"),
        "invitation by scoped qs": ("copy_link", "withdraw"),
    },
    "engineer": {},
}
"""Each viewer's actions on each row they see (a row not named: none)."""
HIDDEN_FROM_SCOPED = {"guest until, P2"}
"""The scoped QS shares no Project with it, so `members()` leaves it out."""


@pytest.mark.parametrize("viewer", ["md", "qs", "scoped qs", "engineer"])
def test_each_row_offers_exactly_the_acts_the_server_would_accept(
    matrix: dict[str, Any], viewer: str
) -> None:
    api = api_as(matrix["viewers"][viewer])
    api.csrf_token()
    names = {str(membership): name for name, membership in matrix["rows"].items()}
    seen = api.get("/api/members").json()
    shown = [*seen["people"], *seen["vextrus_access"], *seen["invitations"]]

    offered = {names[row["membership_id"]]: tuple(row["actions"]) for row in shown}

    assert {name: acts for name, acts in offered.items() if acts} == EXPECTED[viewer]
    for name, membership in matrix["rows"].items():
        for action in ACTIONS:
            succeeds = act_succeeds(api, action, str(membership))
            assert succeeds == (action in offered.get(name, ())), (viewer, name, action)
    hidden = set(matrix["rows"]) - set(offered)
    if viewer == "scoped qs":
        assert hidden >= HIDDEN_FROM_SCOPED
    if viewer == "engineer":  # the people only: no Vextrus access, no invitations
        assert (seen["vextrus_access"], seen["invitations"]) == ([], [])


def test_a_guest_sees_no_row_and_every_act_is_refused(matrix: dict[str, Any]) -> None:
    api = api_as(matrix["viewers"]["guest"])
    api.csrf_token()

    refused = api.get("/api/members")

    assert (refused.status_code, refused.json()) == (
        403,
        {"code": "platform.auth.not_allowed", "params": {"role": "guest"}},
    )
    for membership in matrix["rows"].values():
        for action in ACTIONS:
            assert not act_succeeds(api, action, str(membership))


def test_each_row_names_who_invited_it_by_id(matrix: dict[str, Any], staff: User) -> None:
    viewers, rows = matrix["viewers"], matrix["rows"]
    seen = api_as(viewers["md"]).get("/api/members").json()
    by_id = {
        row["membership_id"]: row["invited_by_id"]
        for row in [*seen["people"], *seen["vextrus_access"], *seen["invitations"]]
    }

    assert by_id[str(rows["engineer by qs"])] == str(viewers["qs"].user.pk)
    assert by_id[str(rows["invitation by md"])] == str(viewers["md"].user.pk)
    assert by_id[str(rows["md"])] is None  # made a member directly, invited by no one
