"""The tests' files live in pytest's own basetemp, and a failed run keeps only what failed (#243).

- The file storage root is a folder of the session's basetemp (`pytest-of-<user>/pytest-<n>/`), unless
  `VEXTRUS_TEST_STORAGE_ROOT` names one: pytest's retention count bounds what a killed run leaves, and
  nothing is made loose in the temporary root. (A process that made its own `mkdtemp` folder left 2,778
  of them in session 11.)
- With `tmp_path_retention_policy = "failed"` pytest drops a passing test's folder at once, but keeps the
  whole basetemp when anything failed, a session fixture's folder and the storage root among them. At the
  session's end every folder that is not a failed (or errored) test's own is removed.
"""

import os
import shutil
from collections.abc import Generator, Iterator
from pathlib import Path

import pytest
from django.conf import settings

STORAGE_FOLDER = "vextrus-storage"
_kept: set[Path] = set()
"""The test folders of the tests that failed or errored in this process."""


@pytest.fixture(scope="session", autouse=True)
def storage_root(tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    if os.environ.get("VEXTRUS_TEST_STORAGE_ROOT"):
        yield
        return
    root = tmp_path_factory.mktemp(STORAGE_FOLDER)
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(settings, "VEXTRUS_STORAGE_ROOT", root)
        yield


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(
    item: pytest.Item, call: pytest.CallInfo[None]
) -> Generator[None, pytest.TestReport, pytest.TestReport]:
    report = yield
    folder = getattr(item, "funcargs", {}).get("tmp_path")
    if report.when in ("setup", "call", "teardown") and report.failed and folder is not None:
        _kept.add(Path(folder))
    return report


def pytest_sessionfinish(session: pytest.Session) -> None:
    """Remove every folder of the basetemp that is not a failed test's own (only when a test failed:
    pytest removes the whole basetemp itself when none did)."""
    factory = session.config._tmp_path_factory  # type: ignore[attr-defined]
    base = factory.getbasetemp()
    if not _kept or not base.is_dir():
        return
    for entry in base.iterdir():
        if entry.is_symlink() or entry in _kept:
            continue
        shutil.rmtree(entry, ignore_errors=True)
