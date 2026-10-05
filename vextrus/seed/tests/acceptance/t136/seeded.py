"""Ticket 136's fixtures (its tests import them by name): the whole demo seed on an empty database
(m0-screens §7; a second run refuses, #129), and its people on the API as the web calls it.

Everything is read at the boundary the seed feeds: the Drawing Set's files
(`GET /api/projects/{id}/drawings/files`) and Step 1 (`/api/projects/{id}/takeoff/step1/`), so the
tests hold whether 14's and 19a's rows or, from 21c, the real read job put the rows there.
"""

import copy
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from django.conf import settings
from django.db import transaction
from django.test import Client
from pytest_django.fixtures import validate_django_db
from pytest_django.plugin import DjangoDbBlocker

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import User
from vextrus.platform.services import jev, tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo, seed_demo
from vextrus.testing.auth import Api
from vextrus.testing.jev import TEST_KEY, FakeClock, Recorded

__all__ = ["as_person", "demo", "demo_once", "nusrat", "tanvir"]

SEEDED = (("shapla", "KR-01"), ("shapla", "BP-02"), ("shapla", "SG-03"), ("meghna", "MG-01"))
"""Every seeded project with the Developer it is of (§7's "Projects")."""
PASSWORD = "a demo password for the tests"


def seeded_offline() -> Demo:
    """`seed_demo` as a test runs it: the demo password set, and Jev answered from the recordings with
    no key in the environment (`vextrus.testing.jev.jev_offline`'s set-up, which is function-scoped)."""
    clock = FakeClock()
    offline = jev.Client(transport=Recorded(), clock=clock, sleep=clock.sleep, key=lambda: TEST_KEY)
    with pytest.MonkeyPatch.context() as patch, jev.using(offline):
        patch.setenv(seed_platform.PASSWORD_VARIABLE, PASSWORD)
        patch.delenv(settings.VEXTRUS_JEV_KEY_VARIABLE, raising=False)
        patch.setattr(jev, "_network", Recorded)
        return seed_demo()


class ModuleSeed:
    """The demo seed made once for a test module, inside a transaction held open on both aliases.
    pytest-django opens each non-transactional test's own block inside it (a savepoint) and rolls
    the test back to it, so every test sees the seed untouched; the module's end rolls it back."""

    def __init__(self, blocker: DjangoDbBlocker) -> None:
        self._blocker = blocker
        self._open: list[tuple[str, transaction.Atomic]] = []
        self.demo: Demo | None = None

    def open(self) -> None:
        with self._blocker.unblock():
            try:
                for alias in ("default", OWNER_ALIAS):
                    block = transaction.atomic(using=alias)
                    block.__enter__()
                    self._open.append((alias, block))
                self.demo = seeded_offline()
            except BaseException:
                self.close()
                raise

    def close(self) -> None:
        """Roll the seed back: at the module's end, or before a transactional test seeds and commits."""
        with self._blocker.unblock():
            while self._open:
                alias, block = self._open.pop()
                transaction.set_rollback(True, using=alias)
                block.__exit__(None, None, None)
        self.demo = None


def transactional(item: pytest.Item) -> bool:
    """Whether pytest-django runs the test outside a transaction (its own rule), so it commits."""
    if {"transactional_db", "live_server"} & set(getattr(item, "fixturenames", ())):
        return True
    marker = item.get_closest_marker("django_db")
    if marker is None:
        return False
    commits, resets_sequences, *_ = validate_django_db(marker)
    return commits or resets_sequences


@pytest.fixture(scope="module")
def demo_once(django_db_setup: None, django_db_blocker: DjangoDbBlocker) -> Iterator[ModuleSeed]:
    """The module's one seed (`ModuleSeed`): made when its first test asks for `demo`."""
    seed = ModuleSeed(django_db_blocker)
    seed.open()
    yield seed
    seed.close()


@pytest.fixture
def demo(request: pytest.FixtureRequest, demo_once: ModuleSeed) -> Demo:
    """The whole demo seed, as `seed_demo` runs it, on an empty database: the module's one seed,
    untouched (each test rolls back to it), for a test in a transaction; its own committed seed for
    a transactional test (the module's is rolled back first: a test that commits cannot run in it)."""
    if transactional(request.node):
        demo_once.close()
        return seeded_offline()
    if demo_once.demo is None:  # a transactional test of this module ran first and rolled it back
        return seeded_offline()
    return copy.deepcopy(demo_once.demo)


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
