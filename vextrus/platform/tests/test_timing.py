"""A request's split server time (`services.timing`, S29-M0b): what the `Server-Timing` header says."""

import re

import pytest
from django.http import HttpResponse

from vextrus.platform.services import timing

METRICS = re.compile(r"app;dur=[0-9]+\.[0-9], lock;dur=[0-9]+\.[0-9]")


def test_a_request_that_reports_a_wait_answers_with_app_and_the_wait() -> None:
    response = HttpResponse()
    with timing.request() as timed:
        timing.report("lock")
    timing.write(response, timed)
    assert METRICS.fullmatch(response[timing.HEADER]), response[timing.HEADER]


def test_a_request_that_reports_nothing_carries_no_header() -> None:
    response = HttpResponse()
    with timing.request() as timed:
        pass
    timing.write(response, timed)
    assert timing.HEADER not in response


def test_app_is_the_requests_time_less_its_waits() -> None:
    timed = timing.Timed(started=10.0, waits={"lock": 0.75})
    assert timing.header(timed, now=11.0) == "app;dur=250.0, lock;dur=750.0"


def test_app_is_never_negative() -> None:
    timed = timing.Timed(started=10.0, waits={"lock": 2.0})
    assert timing.header(timed, now=11.0) == "app;dur=0.0, lock;dur=2000.0"


def test_waits_of_one_name_add_up_and_count_once_reported() -> None:
    with timing.request() as timed:
        timing.report("lock")
        with timing.waited("lock"):
            pass
        with timing.waited("lock"):
            pass
        timing.report("lock")  # reported again: the wait so far stays
    assert list(timed.waits) == ["lock"]
    assert timed.waits["lock"] > 0


def test_a_block_inside_a_request_shares_its_clock() -> None:
    with timing.request() as outer, timing.request() as inner:
        timing.report("lock")
    assert inner is outer
    assert outer.waits == {"lock": 0.0}


def test_outside_a_request_nothing_is_measured() -> None:
    timing.report("lock")
    with timing.waited("lock"):
        pass
    with timing.request() as timed:
        pass
    assert timed.waits == {}


def test_app_is_never_reported_as_a_wait() -> None:
    with timing.request(), pytest.raises(ValueError, match="not a wait"):
        timing.report(timing.APP)
