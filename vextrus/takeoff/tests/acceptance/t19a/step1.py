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

__all__ = ["as_person", "demo", "demo_once", "kr01", "nusrat"]

NOT_FOUND = {"code": "platform.auth.not_found", "params": {}}


def step1(project_id: uuid.UUID) -> str:
    return f"/api/projects/{project_id}/takeoff/step1"


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
    """The whole demo seed, as `seed_demo` runs it: the module's one seed, untouched (each test rolls
    back to it), for a test in a transaction; its own committed seed for a transactional test (the
    module's is rolled back first: a test that commits cannot run inside it)."""
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
