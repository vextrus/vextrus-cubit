"""Ticket S27-G6, parts f-13 and f-19 (#669, #323; G1 walk 1, M0-FL10): on Members and access, a row
whose access has Ended (its end date passed; m0-screens §4.4: "Ended access stays listed, muted: ...
'Ended 26 Oct 2026'") offers "Renew 30 days" only, never "Revoke": "Revoke on an ended access is
meaningless and reads as if the access were live. Fix: an Ended row offers Renew only." (the triage).

A row offers exactly the acts the server accepts (`actions`, `services.invitations._actions`), so the
promise is pinned on the API both ways: the row's `actions`, and the revoke endpoint itself, which
refuses an Ended access as already ended (`platform.invitations.already_ended`, 409), as it refuses a
revoked one. Renew still works on it, and a current row keeps both acts.
"""

from datetime import datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone

from vextrus.platform.models import Membership
from vextrus.testing.auth import api_as
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

OFFERS_REVOKE = "an Ended row offers more than Renew"


def _end(team: dict[str, Member], member: Member) -> None:
    with team["md"].acting():
        Membership.objects.filter(id=member.membership_id).update(
            expires_at=timezone.now() - timedelta(days=1)
        )


def _row(team: dict[str, Member], member: Member) -> dict[str, Any]:
    seen = api_as(team["md"]).get("/api/members").json()
    rows: list[dict[str, Any]] = seen["people"] + seen["vextrus_access"]
    [row] = [p for p in rows if p["membership_id"] == str(member.membership_id)]
    return row


def test_an_ended_guest_row_offers_renew_only(team: dict[str, Member]) -> None:
    _end(team, team["guest"])

    row = _row(team, team["guest"])

    assert row["how_ended"] == "expired"
    assert row["actions"] == ["renew"], OFFERS_REVOKE


def test_an_ended_vextrus_engineer_row_offers_renew_only(team: dict[str, Member]) -> None:
    _end(team, team["vextrus_engineer"])

    row = _row(team, team["vextrus_engineer"])

    assert row["how_ended"] == "expired"
    assert row["actions"] == ["renew"], OFFERS_REVOKE


def test_revoking_an_ended_access_is_refused_as_already_ended(team: dict[str, Member]) -> None:
    _end(team, team["guest"])

    response = api_as(team["md"]).post(f"/api/members/{team['guest'].membership_id}/revoke")

    assert response.status_code != 204, "Revoke on an Ended access was accepted"
    assert (response.status_code, response.json()["code"]) == (
        409,
        "platform.invitations.already_ended",
    ), "Revoke on an Ended access was accepted"
    assert _row(team, team["guest"])["revoked_by"] is None


def test_renewing_an_ended_access_makes_it_current_with_both_acts_again(team: dict[str, Member]) -> None:
    """The guard: Renew stays on an Ended row and works; renewed, the row offers Revoke again."""
    _end(team, team["guest"])
    before = timezone.now()

    response = api_as(team["md"]).post(f"/api/members/{team['guest'].membership_id}/renew")

    assert response.status_code == 200
    renewed = datetime.fromisoformat(response.json()["expires_at"])
    assert before + timedelta(days=30) <= renewed <= timezone.now() + timedelta(days=30)
    row = _row(team, team["guest"])
    assert (row["ended_at"], sorted(row["actions"])) == (None, ["renew", "revoke"])
