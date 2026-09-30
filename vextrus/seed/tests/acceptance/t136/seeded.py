"""Ticket 136's fixtures (its tests import them by name): the whole demo seed on an empty database
(m0-screens §7; a second run refuses, #129), and its people on the API as the web calls it.

Everything is read at the boundary the seed feeds: the Drawing Set's files
(`GET /api/projects/{id}/drawings/files`) and Step 1 (`/api/projects/{id}/takeoff/step1/`), so the
tests hold whether 14's and 19a's rows or, from 21c, the real read job put the rows there.
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

__all__ = ["as_person", "demo", "nusrat", "tanvir"]

SEEDED = (("shapla", "KR-01"), ("shapla", "BP-02"), ("shapla", "SG-03"), ("meghna", "MG-01"))
"""Every seeded project with the Developer it is of (§7's "Projects")."""


@pytest.fixture
def demo(monkeypatch: pytest.MonkeyPatch) -> Demo:
    """The whole demo seed, as `seed_demo` runs it, on the test's empty database."""
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
    """Shapla Homes' QS (KR-01, BP-02, SG-03)."""
    return as_person("nusrat@shapla-homes.example", "shapla")


@pytest.fixture
def tanvir(as_person: Callable[[str, str], Api]) -> Api:
    """Meghna Properties' QS (MG-01)."""
    return as_person("tanvir@meghna.example", "meghna")


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


def files(api: Api, project_id: uuid.UUID) -> list[dict[str, Any]]:
    """The Drawing Set's files as 4.5's table reads them."""
    response = api.get(f"/api/projects/{project_id}/drawings/files")
    assert response.status_code == 200, response.content
    listed: list[dict[str, Any]] = response.json()["files"]
    return listed


def every_seeded_file(demo: Demo, nusrat: Api, tanvir: Api) -> list[dict[str, Any]]:
    """Every file on every seeded project, each marked with its project's code (`project`)."""
    apis = {"shapla": nusrat, "meghna": tanvir}
    found = []
    for developer, code in SEEDED:
        for row in files(apis[developer], demo[f"project:{code}"]):
            found.append({**row, "project": code})
    return found


def get_json(api: Api, path: str, **query: Any) -> Any:
    response = api.get(path, **query)
    assert response.status_code == 200, response.content
    return response.json()
