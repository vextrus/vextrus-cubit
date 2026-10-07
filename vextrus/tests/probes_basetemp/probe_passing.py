"""Run only by `test_basetemp_xdist.py` in an inner session (no `test_` prefix): a passing test that
stores a file under the tests' storage root, as the product's tests do."""

from pathlib import Path

from django.conf import settings


def test_stores_a_file() -> None:
    root = Path(settings.VEXTRUS_STORAGE_ROOT)
    root.mkdir(parents=True, exist_ok=True)
    (root / "stored-by-a-passing-test.bin").write_bytes(b"stored")
