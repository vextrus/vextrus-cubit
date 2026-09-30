"""A MemoryError while drawing a spline is the job's memory limit, never a shape left out (24): it
reaches the read job, which fails the file with the memory words, instead of a silent gap."""

from typing import Any

import pytest

from engine.render import _hatch, _shapes


class _Hungry:
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        raise MemoryError


def test_a_spline_out_of_memory_is_raised_not_left_out(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(_shapes, "BSpline", _Hungry)
    values = {"control_points": [[0, 0, 0], [1, 1, 0], [2, 0, 0], [3, 1, 0]], "degree": 3}

    with pytest.raises(MemoryError):
        _shapes._spline(values, 0.01, _shapes.Shape())


def test_a_hatch_spline_edge_out_of_memory_is_raised_not_left_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(_hatch, "BSpline", _Hungry)
    edge = {"type": "spline", "control_points": [[0, 0, 0], [1, 1, 0], [2, 0, 0], [3, 1, 0]]}

    with pytest.raises(MemoryError):
        _hatch._edges([edge], 0.01)
