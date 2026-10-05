"""The owner's usage holds: VEXTRUS_SESSION_HOLD, VEXTRUS_WEEK_HOLD and VEXTRUS_DEGRADE_AT move the
governor's lines (a spend decision); anything that is not a number from 0 to 100 keeps the default."""

from __future__ import annotations

import pytest

from scripts.factory import governor

HOLD_VARS = ("VEXTRUS_SESSION_HOLD", "VEXTRUS_WEEK_HOLD", "VEXTRUS_DEGRADE_AT")


@pytest.fixture(autouse=True)
def no_holds(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in HOLD_VARS:
        monkeypatch.delenv(name, raising=False)


def usage_of(monkeypatch: pytest.MonkeyPatch, session: float, week: float) -> None:
    reading = governor.UsageReading(governor.Usage(session=session, week=week), [])
    monkeypatch.setattr(governor, "read_usage", lambda: reading)


def test_the_defaults_stand_when_nothing_is_set() -> None:
    assert governor.holds() == (80.0, 85.0, 90.0)


def test_each_variable_moves_its_own_line(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SESSION_HOLD", "95")
    monkeypatch.setenv("VEXTRUS_WEEK_HOLD", "100")
    monkeypatch.setenv("VEXTRUS_DEGRADE_AT", "99.5")
    assert governor.holds() == (95.0, 100.0, 99.5)


@pytest.mark.parametrize("raw", ["", "  ", "abc", "-1", "100.1", "150", "nan", "inf"])
def test_a_value_that_is_not_a_number_from_0_to_100_keeps_the_default(
    monkeypatch: pytest.MonkeyPatch, raw: str
) -> None:
    monkeypatch.setenv("VEXTRUS_WEEK_HOLD", raw)
    assert governor.holds()[1] == 85.0


def test_a_week_over_the_default_line_refuses_a_launch(monkeypatch: pytest.MonkeyPatch) -> None:
    usage_of(monkeypatch, session=10, week=90)
    verdict = governor.check("cloud-session")
    assert any("week usage 90% is at or over 85%" in reason for reason in verdict.reasons)


def test_the_owner_raised_week_line_lets_the_launch_through(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_WEEK_HOLD", "100")
    usage_of(monkeypatch, session=10, week=90)
    verdict = governor.check("cloud-session")
    assert not any("week usage" in reason for reason in verdict.reasons)


def test_a_used_up_week_still_holds_at_100(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_WEEK_HOLD", "100")
    usage_of(monkeypatch, session=10, week=100)
    verdict = governor.check("cloud-session")
    assert any("week usage 100% is at or over 100%" in reason for reason in verdict.reasons)


def test_the_degrade_line_moves_for_reviews(monkeypatch: pytest.MonkeyPatch) -> None:
    usage_of(monkeypatch, session=10, week=92)
    assert governor.check("review").degrade is True
    monkeypatch.setenv("VEXTRUS_DEGRADE_AT", "100")
    assert governor.check("review").degrade is False


def test_the_cloud_ramp_uses_the_session_line_in_force(monkeypatch: pytest.MonkeyPatch) -> None:
    usage = governor.Usage(session=70, week=10)
    assert governor.cloud_cap(usage, rate=1.0, hours=2.0) == 5
    monkeypatch.setenv("VEXTRUS_SESSION_HOLD", "90")
    assert governor.cloud_cap(usage, rate=1.0, hours=2.0) == 10
