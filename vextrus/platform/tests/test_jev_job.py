"""Jev asked inside a job step, as 21c will (ticket 15; story 86): TypeSafe down any way leaves the
step done, the QS to pick and nothing cached; a whole Drawing Set's sheets in an outage cost seconds,
not minutes. On the offline client's FakeClock: no test sleeps."""

import uuid
from collections.abc import Callable

import httpx
import pytest
from django.conf import settings
from django.db import connections

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.services import jev, jobs
from vextrus.testing.jev import (
    DOWN,
    INVENTED_SHEETS,
    STAND_IN_KINDS,
    STAND_IN_QUESTION,
    WAYS,
    FakeClock,
    Offline,
    down,
)
from vextrus.testing.jobs import TEST_QUEUE, TableStepStore, recorded_steps, run_inline

BOTH = ["default", OWNER_ALIAS]
SHEETS = 60


def _kind_of(sheet: int) -> jobs.StepResult:
    """One sheet's step: ask, and say who picks."""
    facts = (
        {**INVENTED_SHEETS[1], "title": f"GROUND FLOOR PLAN {sheet}"} if sheet else INVENTED_SHEETS[1]
    )
    answer = jev.ask("sheet_type", facts, STAND_IN_QUESTION, STAND_IN_KINDS)
    if isinstance(answer, jev.Unavailable):
        return {"picked_by": "qs", "why": answer.why.value}
    return {"picked_by": "jev", "choice": answer.choice}


@jobs.job(queue=TEST_QUEUE)
def kind_of_one_sheet(run: jobs.Run, *, subject_id: uuid.UUID) -> None:
    steps = run.steps(TableStepStore(), subject_id, total=1)
    steps.run("kind", lambda: _kind_of(0), inputs={"subject": subject_id})


@jobs.job(queue=TEST_QUEUE)
def kinds_of_a_set(run: jobs.Run, *, subject_id: uuid.UUID) -> None:
    steps = run.steps(TableStepStore(), subject_id, total=SHEETS)
    for sheet in range(SHEETS):
        steps.run(f"sheet_{sheet}", lambda sheet=sheet: _kind_of(sheet), inputs={"sheet": sheet})  # type: ignore[misc]


def answers_committed() -> int:
    with connections[OWNER_ALIAS].cursor() as cursor:
        cursor.execute("select count(*) from platform_jevanswer")
        [(count,)] = cursor.fetchall()
    return int(count)


@pytest.mark.django_db(transaction=True, databases=BOTH)
@pytest.mark.parametrize("way", WAYS)
def test_typesafe_down_any_way_leaves_the_step_done_and_the_qs_to_pick(
    way: str,
    make_developer: Callable[..., uuid.UUID],
    step_store: TableStepStore,
    jev_down: Callable[[str], None],
    jev_clock: FakeClock,
) -> None:
    developer = make_developer()
    subject = uuid.uuid4()
    jev_down(way)
    start = jev_clock.now

    run_inline(kind_of_one_sheet, tenant_id=developer, subject_id=subject)

    assert recorded_steps(subject) == {"kind": {"picked_by": "qs", "why": DOWN[way].value}}
    assert answers_committed() == 0
    # the transaction waited no longer than the deadline (a drip's last chunk may cross it by 1 s)
    assert jev_clock.now - start <= settings.VEXTRUS_JEV_DEADLINE_SECONDS + 1.0


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_a_step_jev_answered_keeps_its_answer(
    make_developer: Callable[..., uuid.UUID], step_store: TableStepStore
) -> None:
    subject = uuid.uuid4()

    run_inline(kind_of_one_sheet, tenant_id=make_developer(), subject_id=subject)

    assert recorded_steps(subject) == {"kind": {"picked_by": "jev", "choice": "floor_plan"}}
    assert answers_committed() == 1


@pytest.mark.django_db(transaction=True, databases=BOTH)
def test_sixty_sheets_in_an_outage_cost_seconds_and_three_calls(
    make_developer: Callable[..., uuid.UUID],
    step_store: TableStepStore,
    jev_offline: Offline,
    jev_clock: FakeClock,
) -> None:
    subject = uuid.uuid4()
    timing_out = down("timeout", jev_clock)
    tried: list[httpx.Request] = []

    def counted(request: httpx.Request) -> httpx.Response:
        tried.append(request)
        return timing_out.handle_request(request)

    jev_offline.use(httpx.MockTransport(counted))
    start = jev_clock.now

    run_inline(kinds_of_a_set, tenant_id=make_developer(), subject_id=subject)

    steps = recorded_steps(subject)
    assert len(steps) == SHEETS
    assert all(step["picked_by"] == "qs" for step in steps.values())
    assert [steps[f"sheet_{n}"]["why"] for n in range(4)] == ["timed_out"] * 3 + ["cooling_off"]
    assert len(tried) == 3
    assert jev_clock.now - start <= 3 * settings.VEXTRUS_JEV_DEADLINE_SECONDS
    assert answers_committed() == 0
