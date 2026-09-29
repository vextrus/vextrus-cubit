"""The seed and the Library (M0 plan, 19a; #95; m0-screens §7): "`flush` then `seed_demo` succeeds"
(the ruling: "`sync_library` also puts back the Markets (idempotent)"); "19a seeds Held, answered: an
answered `file_misread` Question (`takeoff`'s) on a file 14 seeds as held" on BP-02 or MG-01;
`takeoff/library.py` for `sync_library`: "the 14 Takeoff Steps; the Check catalogue from
`engine.check.catalogue`, each Check with its kind and message code"."""

import json
from collections.abc import Callable, Iterator

import pytest
from django.core.management import call_command
from django.db import connections
from django.db.models.signals import post_migrate

from engine.check import catalogue
from vextrus.drawings import services as drawings
from vextrus.drawings.messages import files as said
from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import tenancy
from vextrus.seed import platform as seed_platform
from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api
from vextrus.testing.tenancy import put_back_the_library

from .step1 import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .step1 import step1


def owner_rows(sql: str) -> list[tuple[object, ...]]:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute(sql)
        return list(cursor.fetchall())


@pytest.fixture
def without_the_tests_put_back() -> Iterator[None]:
    """The product as the owner runs it: the tests' own `post_migrate` put-back switched off."""
    post_migrate.disconnect(dispatch_uid="vextrus.testing.tenancy.put_back_the_library")
    try:
        yield
    finally:
        post_migrate.connect(
            put_back_the_library, dispatch_uid="vextrus.testing.tenancy.put_back_the_library"
        )


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_flush_then_sync_library_puts_back_the_markets(without_the_tests_put_back: None) -> None:
    call_command("flush", interactive=False, verbosity=0)

    call_command("sync_library", verbosity=0)
    call_command("sync_library", verbosity=0)

    assert owner_rows("select code from platform_market") == [("BD",)]


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_flush_then_seed_demo_succeeds(
    without_the_tests_put_back: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(seed_platform.PASSWORD_VARIABLE, "a demo password for the tests")
    call_command("flush", interactive=False, verbosity=0)
    call_command("sync_library", verbosity=0)

    call_command("seed_demo", verbosity=0)

    assert owner_rows("select count(*) from platform_market") == [(1,)]
    [(sheets,)] = owner_rows("select count(*) from drawings_sheetrevision")
    assert isinstance(sheets, int)
    assert sheets > 0


@pytest.mark.django_db(databases=["default", "owner"])
def test_sync_library_writes_the_14_takeoff_steps_and_every_check() -> None:
    call_command("sync_library", verbosity=0)
    call_command("sync_library", verbosity=0)

    # The models the plan names (TakeoffStep, Check), in their Django tables; identity (tenant_id, key).
    assert owner_rows("select count(distinct key) from takeoff_takeoffstep") == [(14,)]
    codes = {code for (code,) in owner_rows("select distinct key from takeoff_check")}
    assert codes == {entry.code for entry in catalogue.entries()}


@pytest.mark.django_db(databases=["default", "owner"])
def test_held_answered_is_seeded_on_bp_02_or_mg_01(
    demo: Demo, as_person: Callable[[str, str], Api]
) -> None:
    answered = []
    for code, developer in (("BP-02", "shapla"), ("MG-01", "meghna")):
        with tenancy.acting_in(demo[f"developer:{developer}"]):
            for f in drawings.files(demo[f"drawing_set:{code}"]):
                shown = f.status["code"]
                if f.status != said.HELD() and ("held" in shown or "set_aside" in shown):
                    answered.append((code, developer, f))
    assert answered, "no held file on BP-02 or MG-01 carries an answer"

    code, developer, _held = answered[0]
    person = "nusrat@shapla-homes.example" if developer == "shapla" else "tanvir@meghna.example"
    response = as_person(person, developer).get(f"{step1(demo[f'project:{code}'])}/questions")
    questions = response.json()["questions"]
    assert any(q["kind"] == "file_misread" and q["status"] == "answered" for q in questions), json.dumps(
        questions
    )
