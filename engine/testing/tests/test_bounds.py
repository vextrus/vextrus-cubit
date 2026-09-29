"""The bounds a test asserts on work: peak memory and call counts (`engine.testing.bounds`)."""

import inspect
import tracemalloc
from types import SimpleNamespace

import pytest

from engine.testing.bounds import calls, peak_memory


def test_a_block_under_its_memory_bound_passes_and_reports_its_peak() -> None:
    with peak_memory(4 * 2**20) as peak:
        kept = bytearray(2**20)

    assert 2**20 <= peak.bytes < 4 * 2**20
    assert len(kept) == 2**20
    assert not tracemalloc.is_tracing()


def test_a_block_over_its_memory_bound_fails_even_when_it_frees_what_it_took() -> None:
    with (
        pytest.raises(AssertionError, match=r"peak [\d,]+ bytes, over the bound of 1,048,576"),
        peak_memory(2**20),
    ):
        bytearray(8 * 2**20).clear()  # taken and freed inside the block

    assert not tracemalloc.is_tracing()


def test_inside_another_trace_the_peak_is_the_block_s_own_and_the_trace_stays_on() -> None:
    tracemalloc.start()
    try:
        held = bytearray(16 * 2**20)
        with peak_memory(2**20) as peak:
            small = bytearray(1000)

        assert peak.bytes < 2**20
        assert tracemalloc.is_tracing()
        assert len(held) + len(small) > 0
    finally:
        tracemalloc.stop()


def work(n: int) -> int:
    return n


def test_calls_are_counted_and_the_function_is_put_back() -> None:
    owner = SimpleNamespace(work=work)

    with calls(owner, "work", at_most=3) as counted:
        assert [owner.work(n) for n in range(3)] == [0, 1, 2]

    assert counted.calls == 3
    assert owner.work is work


def test_too_many_calls_fail_and_the_function_is_still_put_back() -> None:
    owner = SimpleNamespace(work=work)

    with (
        pytest.raises(AssertionError, match="work called 4 times, over 3"),
        calls(owner, "work", at_most=3),
    ):
        [owner.work(n) for n in range(4)]

    assert owner.work is work


def test_a_block_that_raises_puts_the_function_back() -> None:
    owner = SimpleNamespace(work=work)

    with pytest.raises(ZeroDivisionError), calls(owner, "work", at_most=0):
        owner.work(1 // 0)

    assert owner.work is work


class Sheets:
    @staticmethod
    def count(n: int) -> int:
        return n

    @classmethod
    def name(cls) -> str:
        return cls.__name__

    def read(self) -> str:
        return "read"


class Plans(Sheets):
    pass


def test_a_static_method_is_counted_and_stays_static() -> None:
    before = inspect.getattr_static(Sheets, "count")

    with calls(Sheets, "count", at_most=2) as counted:
        assert Sheets.count(1) == 1
        assert Sheets().count(2) == 2

    assert counted.calls == 2
    assert inspect.getattr_static(Sheets, "count") is before
    assert Sheets().count(3) == 3


def test_a_class_method_and_an_instance_method_are_counted_and_put_back() -> None:
    with calls(Sheets, "name", at_most=1) as named, calls(Sheets, "read", at_most=1) as read:
        assert Plans.name() == "Plans"
        assert Sheets().read() == "read"

    assert (named.calls, read.calls) == (1, 1)
    assert Plans.name() == "Plans"
    assert "read" in vars(Sheets)


def test_an_inherited_method_is_counted_on_the_subclass_and_left_inherited() -> None:
    with calls(Plans, "count", at_most=1) as counted:
        assert Plans.count(4) == 4

    assert counted.calls == 1
    assert "count" not in vars(Plans)
    assert Plans.count(5) == 5
