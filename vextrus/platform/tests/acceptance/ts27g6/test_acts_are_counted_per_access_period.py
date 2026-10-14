"""Ticket S27-G6, part f-18 (#323; G1 walk 1, M0-FL10): on Members and access, each access row counts
the acts done under it, and accepting the invitation is not counted as an act.

The triage: "the Engineer's acts count sits on the newest access row ('5 acts') while earlier, revoked
rows, under which the acts were done, show '-'. Accepting an invitation is counted as an act. Fix:
count acts per access period, and do not count the invitation's acceptance." m0-screens §4.4: "'Acts'
reads '12 acts, last 26 Sep 2026'" per row of the Vextrus access table.

An act here is any DomainEvent under the Engineer's name; the platform's own `staff_opened` stands in
for one, since a platform test may not import the takeoff (the import-linter's layers). Each access
period is given fixed past dates (inside a test's one transaction the database's now() does not move),
and each act is recorded while its access is current, at a time inside it.
"""

from datetime import datetime, timedelta
from typing import Any

import pytest
from django.utils import timezone

from vextrus.platform.messages import tenancy as tenancy_codes
from vextrus.platform.models import Membership, User
from vextrus.platform.services import events, tenancy
from vextrus.testing.auth import accept_as, api_as, invitation
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

PER_PERIOD = "acts are not counted per access period"


def _rows(md: Member, user: User) -> dict[str, dict[str, Any]]:
    seen = api_as(md).get("/api/members").json()["vextrus_access"]
    return {row["membership_id"]: row for row in seen if row["user_id"] == str(user.pk)}


def _acted(developer_id: Any, user: User, at: datetime) -> None:
    """One act under `user`'s name, done at `at` through their current access."""
    with tenancy.acting_in(developer_id, user_id=user.pk):
        events.record(
            tenancy_codes.STAFF_OPENED, subject_type="developer", actor_user_id=user.pk, occurred_at=at
        )


def _dated(md: Member, membership_id: Any, **dates: datetime) -> None:
    with md.acting():
        Membership.objects.filter(id=membership_id).update(**dates)


def test_accepting_an_invitation_is_not_an_act(team: dict[str, Member], staff: User) -> None:
    md = team["md"]
    membership_id, token = invitation(md, staff.email)
    accept_as(token, staff)

    row = _rows(md, staff)[str(membership_id)]

    assert (row["acts"], row["last_act_at"]) == (0, None), (
        "accepting the invitation was counted as an act"
    )


def test_each_access_row_counts_the_acts_done_under_it(team: dict[str, Member], staff: User) -> None:
    md = team["md"]
    base = timezone.now().replace(microsecond=0)
    first, token = invitation(md, staff.email)
    accept_as(token, staff)
    _dated(md, first, starts_at=base - timedelta(days=10), accepted_at=base - timedelta(days=10))
    _acted(md.developer_id, staff, base - timedelta(days=9))
    _acted(md.developer_id, staff, base - timedelta(days=8))
    assert api_as(md).post(f"/api/members/{first}/revoke").status_code == 204
    _dated(md, first, revoked_at=base - timedelta(days=7))
    second, token = invitation(md, staff.email)
    accept_as(token, staff)
    _dated(md, second, starts_at=base - timedelta(days=5), accepted_at=base - timedelta(days=5))
    for days in (4, 3, 2):
        _acted(md.developer_id, staff, base - timedelta(days=days))

    rows = _rows(md, staff)

    counted = {key: (rows[str(key)]["acts"], rows[str(key)]["last_act_at"]) for key in (first, second)}
    assert {key: n for key, (n, _) in counted.items()} == {first: 2, second: 3}, PER_PERIOD
    assert {key: datetime.fromisoformat(last) for key, (_, last) in counted.items()} == {
        first: base - timedelta(days=8),
        second: base - timedelta(days=2),
    }, PER_PERIOD
