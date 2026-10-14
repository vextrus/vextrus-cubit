"""Ticket S29-F2a (docs/plans/factory-s29.md item 2, F2): "Timing assertions (#851, ts15a2's 500 ms)
become counts or scaled bounds." #851: ts15a2's [answer] case measured 0.587 s against a fixed 0.5 s
while several PRs ran CI together, and blocked a land.

ts15a2 (amended in this ticket) takes its bounds from `vextrus.testing.timing.scaled(seconds)`: the
bound times a load margin, or times `VEXTRUS_TIME_SCALE` (the machine's factor the fast verify sets)
when that is larger. Its verdict on an act (`_within_bound`) is pinned here on invented measurements:
the #851 measurement passes, the bound grows with the factor and never shrinks below the margin, and an
act that waited on the read job, or as long as the 3 s lock_timeout, still fails.

    uv run pytest -rf vextrus/takeoff/tests/acceptance/ts29f2a
"""

from __future__ import annotations

import importlib
from collections.abc import Callable
from types import SimpleNamespace

import pytest
from django.conf import settings

from vextrus.takeoff.tests.acceptance.ts15a2.test_no_act_waits_on_a_read import (
    ACT_BOUND,
    Overlap,
    _within_bound,
)

scaled: Callable[[float], float] = importlib.import_module("vextrus.testing.timing").scaled
SCALE = "VEXTRUS_TIME_SCALE"
MEASURED_IN_851 = 0.587
LOCK_TIMEOUT = 3.0
"""An act's lock_timeout (`platform.services.deadlocks.LOCK_TIMEOUT_MS`), seconds: an act that took
this long may have waited on a lock the whole time."""


def overlap(seconds: float, *, waited: bool = False) -> Overlap:
    return Overlap(
        response=SimpleNamespace(status_code=200, content=b"{}"),
        waited_on_the_job=waited,
        seconds=seconds,
        role=settings.VEXTRUS_APP_ROLE,
        server_version=180000,
    )


def test_the_answer_measured_in_851_passes_on_a_loaded_machine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(SCALE, raising=False)
    _within_bound("answer", overlap(MEASURED_IN_851))


def test_the_bound_grows_with_the_machines_time_scale(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(SCALE, "10")
    assert scaled(ACT_BOUND) == pytest.approx(5.0)
    _within_bound("answer", overlap(4.0))


def test_a_small_time_scale_never_shrinks_the_margin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(SCALE, "0.5")
    assert scaled(ACT_BOUND) >= MEASURED_IN_851


def test_an_act_that_waited_on_the_read_job_still_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(SCALE, raising=False)
    with pytest.raises(AssertionError, match="waited on the read job"):
        _within_bound("answer", overlap(0.1, waited=True))


def test_an_act_as_slow_as_the_lock_timeout_still_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(SCALE, raising=False)
    with pytest.raises(AssertionError, match="while a file was finishing"):
        _within_bound("answer", overlap(LOCK_TIMEOUT))
