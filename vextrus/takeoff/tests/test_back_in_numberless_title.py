"""S25-D5 fix after review round 1: a "confirmed back in" act names a numberless sheet by its title
(as the Step 1 list does), while a numbered sheet's entry stays number and reason only."""

import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest

from vextrus.drawings import services as drawings
from vextrus.platform.services import activity
from vextrus.takeoff.messages import step1 as said
from vextrus.takeoff.models import Confirmation
from vextrus.takeoff.services import step1


def test_a_numberless_sheet_confirmed_back_in_carries_its_title(monkeypatch: pytest.MonkeyPatch) -> None:
    project, cover, numbered = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    act_id = uuid.uuid4()
    event = activity.ActView(
        id=uuid.uuid4(),
        code=said.CONFIRMED_BACK_IN.code,
        params={},
        actor=None,
        project_id=project,
        building_id=None,
        subject_type="confirmation",
        subject_id=act_id,
        occurred_at=datetime.now(UTC),
    )
    confirmation = SimpleNamespace(
        id=act_id,
        project_id=project,
        before={
            "sheets": {
                str(cover): {"decision": "excluded", "reason": "cover_index"},
                str(numbered): {"decision": "excluded", "reason": "superseded"},
            }
        },
    )
    monkeypatch.setattr(Confirmation.objects, "filter", lambda **_: [confirmation])
    monkeypatch.setattr(drawings, "set_of", lambda _: SimpleNamespace(id=uuid.uuid4()))
    sheets: list[Any] = [
        SimpleNamespace(id=cover, number=None, title="Cover sheet"),
        SimpleNamespace(id=numbered, number="S-07", title="Seventh floor"),
    ]
    monkeypatch.setattr(drawings, "sheets", lambda *_, **__: sheets)

    entries = step1.act_params([event])[event.id]["excluded_before"]

    assert entries == [
        {"sheet": "", "reason": "cover_index", "title": "Cover sheet"},
        {"sheet": "S-07", "reason": "superseded"},
    ]
