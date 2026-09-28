"""A Project, and so its Building, is made once: a retried or concurrent create of the same code is
refused, and never makes a second Project, Site or Building (ADR 0036)."""

import threading
import time
import uuid
from collections.abc import Callable

import pytest
from django.db import connection

from vextrus.platform.services import tenancy
from vextrus.projects import services
from vextrus.projects.models import Building, Site


def counts(developer_id: uuid.UUID) -> tuple[int, int, int]:
    with tenancy.acting_in(developer_id):
        return len(services.list()), Site.objects.count(), Building.objects.count()


@pytest.mark.django_db
def test_a_retried_create_is_refused_naming_the_project_that_has_the_code(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    shapla = make_developer()
    with tenancy.acting_in(shapla):
        services.create(code="KR-01", name="Kadam Residence")

    for retried in ("KR-01", "kr-01", " Kr-01 "):
        with tenancy.acting_in(shapla), pytest.raises(services.Refused) as refused:
            services.create(code=retried, name="Kadam Residence")
        # The holder's own code, as stored: "kr-01" typed reads "KR-01 is already used by …".
        assert (refused.value.field, refused.value.status, refused.value.message) == (
            "code",
            409,
            {
                "code": "projects.projects.code_taken",
                "params": {"code": "KR-01", "name": "Kadam Residence"},
            },
        )

    assert counts(shapla) == (1, 1, 1)


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("first", "again"),
    [
        ("KR-01", "kr-01"),
        ("ẞ-1", "ß-1"),  # upper() leaves ß alone: both fold to "ss-1"
        ("ϴ-1", "θ-1"),
        ("\u017f-1", "S-1"),  # a long s
        ("\uff2b-1", "K-1"),  # a full-width K, as some keyboards type it
        ("e\u0301-1", "\u00e9-1"),  # é decomposed and composed
    ],
)
def test_codes_that_differ_only_in_case_or_form_are_one_code(
    make_developer: Callable[..., uuid.UUID], first: str, again: str
) -> None:
    shapla = make_developer()
    with tenancy.acting_in(shapla):
        services.create(code=first, name="Kadam Residence")

    with tenancy.acting_in(shapla), pytest.raises(services.Refused) as refused:
        services.create(code=again, name="Another")

    assert refused.value.message["code"] == "projects.projects.code_taken"
    assert counts(shapla) == (1, 1, 1)


@pytest.mark.django_db
def test_a_code_folding_past_its_key_is_refused_as_too_long(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    # U+FDFA folds (NFKC) to 18 characters: 8 of them fit the code's 32 but not the key's 128.
    with tenancy.acting_in(make_developer()), pytest.raises(services.Refused) as refused:
        services.create(code="\ufdfa" * 8, name="Kadam Residence")

    assert refused.value.message == {"code": "projects.projects.too_long", "params": {"limit": 32}}


@pytest.mark.django_db
def test_two_developers_may_each_have_the_same_code(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    shapla, meghna = make_developer(), make_developer()

    for developer in (shapla, meghna):
        with tenancy.acting_in(developer):
            services.create(code="KR-01", name="Kadam Residence")

    assert counts(shapla) == counts(meghna) == (1, 1, 1)


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_two_concurrent_creates_of_one_code_make_one_project_and_one_building(
    make_developer: Callable[..., uuid.UUID],
) -> None:
    shapla = make_developer()
    first_made = threading.Event()
    release_first = threading.Event()
    outcomes: dict[str, object] = {}

    def first() -> None:
        try:
            with tenancy.acting_in(shapla):
                outcomes["first"] = services.create(code="KR-01", name="Kadam Residence")
                first_made.set()
                # Holds its transaction open, uncommitted, while the second create runs into it.
                release_first.wait(10)
        finally:
            connection.close()

    def second() -> None:
        first_made.wait(10)
        try:
            with tenancy.acting_in(shapla):
                services.create(code="KR-01", name="Kadam Residence again")
        except services.Refused as refused:
            outcomes["second"] = refused.message
        finally:
            connection.close()

    threads = [threading.Thread(target=first), threading.Thread(target=second)]
    for thread in threads:
        thread.start()
    first_made.wait(10)
    # The second has checked the code (not yet committed, so free) and waits on the unique index.
    time.sleep(0.5)
    release_first.set()
    for thread in threads:
        thread.join(20)

    assert isinstance(outcomes["first"], services.ProjectView)
    assert outcomes["second"] == {
        "code": "projects.projects.code_taken",
        "params": {"code": "KR-01", "name": "Kadam Residence"},
    }
    assert counts(shapla) == (1, 1, 1)
