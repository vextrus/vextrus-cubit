"""crosspr's worker count: 6 by default, `VEXTRUS_VERIFY_WORKERS` overrides, never `auto`."""

import pytest

from scripts.factory.crosspr import worker_count


@pytest.mark.parametrize(
    ("value", "expected"), [(None, 6), ("3", 3), ("0", 0), ("1", 1), ("auto", 6), ("", 6)]
)
def test_worker_count(monkeypatch: pytest.MonkeyPatch, value: str | None, expected: int) -> None:
    if value is None:
        monkeypatch.delenv("VEXTRUS_VERIFY_WORKERS", raising=False)
    else:
        monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", value)
    assert worker_count() == expected
