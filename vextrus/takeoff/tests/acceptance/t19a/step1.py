"""Ticket 19a's fixtures (its tests import them by name): the demo seed (m0-screens §7), whose
KR-01 Step 1 rows 19a writes, and its people signed in on the API as the web calls it (CSRF enforced).

Names chosen by the acceptance writer where no authority gives one (the builder meets them):
- the Step 1 base path is the orchestrator's ruling: `/api/projects/{project_id}/takeoff/step1/`;
- `GET proposals` answers `{"proposals": [...]}`, one item per printed sheet with `id`, `number`,
  `revision_mark`, `discipline` (a key, or null) and `jev_pick` (null, or `{"choice", "options"}`:
  the node's answer, the ruling's name);
- `confirm` takes `{"proposals": [ids], "kind"?: key}`; `exclude` takes `{"proposals": [ids],
  "reason": one of the seven keys, "text": str}`; `undo` takes `{}` and undoes the actor's last act.
"""

import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.test import Client

from vextrus.platform.models import User
from vextrus.platform.services import tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo, seed_demo
from vextrus.testing.auth import Api

__all__ = ["as_person", "demo", "kr01", "nusrat"]

NOT_FOUND = {"code": "platform.auth.not_found", "params": {}}


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch) -> Demo:
    """The whole demo seed, as `seed_demo` runs it."""
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    return seed_demo()


@pytest.fixture
def as_person(demo: Demo) -> Callable[[str, str], Api]:
    """`as_person(email, developer)`: an Api signed in as the seeded person in that Developer."""

    def make(email: str, developer: str) -> Api:
        client = Client()
        client.force_login(User.objects.get(email=email))
        session = client.session
        session[tenancy.SESSION_TENANT] = str(demo[f"developer:{developer}"])
        session.save()
        return Api(client)

    return make


@pytest.fixture
def nusrat(as_person: Callable[[str, str], Api]) -> Api:
    """Shapla Homes' QS."""
    return as_person("nusrat@shapla-homes.example", "shapla")


@pytest.fixture
def kr01(demo: Demo) -> uuid.UUID:
    project_id: uuid.UUID = demo["project:KR-01"]
    return project_id


def proposals(api: Api, project_id: uuid.UUID) -> list[dict[str, Any]]:
    response = api.get(f"{step1(project_id)}/proposals")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()["proposals"]
    return listed


def by_number(items: list[dict[str, Any]], number: str | None) -> list[dict[str, Any]]:
    return [p for p in items if p["number"] == number]
