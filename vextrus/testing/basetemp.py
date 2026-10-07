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


@pytest.fixture(scope="session", autouse=True)
def storage_root(tmp_path_factory: pytest.TempPathFactory) -> Iterator[None]:
    if os.environ.get("VEXTRUS_TEST_STORAGE_ROOT"):
        yield
        return
    root = tmp_path_factory.mktemp(STORAGE_FOLDER)
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(settings, "VEXTRUS_STORAGE_ROOT", root)
        yield


REGISTRY = ".failed-folders"
"""Each process lists its failed tests' folders in its own basetemp; the controller reads every list."""


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(
    item: pytest.Item, call: pytest.CallInfo[None]
) -> Generator[None, pytest.TestReport, pytest.TestReport]:
    report = yield
    folder = getattr(item, "funcargs", {}).get("tmp_path")
    if report.when in ("setup", "call", "teardown") and report.failed and folder is not None:
        base = item.config._tmp_path_factory.getbasetemp()  # type: ignore[attr-defined]
        with (base / REGISTRY).open("a") as registry:
            registry.write(f"{folder}\n")
    return report


def _prune(folder: Path, kept: set[Path]) -> None:
    """Remove all of `folder` that is not a kept folder or the way to one."""
    for entry in folder.iterdir():
        if entry.is_symlink() or entry in kept:
            continue
        if any(path.is_relative_to(entry) for path in kept):
            _prune(entry, kept)
        else:
            shutil.rmtree(entry, ignore_errors=True)


def pytest_sessionfinish(session: pytest.Session) -> None:
    """At the controller (or the only process), remove every folder under the basetemp, the workers'
    among them, that is not a failed test's own. A worker's basetemp is one pytest never removes, so
    only the controller sees the whole run (pytest removes the basetemp itself when nothing failed)."""
    if hasattr(session.config, "workerinput"):
        return
    base = session.config._tmp_path_factory.getbasetemp()  # type: ignore[attr-defined]
    if not base.is_dir():
        return
    registries = list(base.rglob(REGISTRY))
    kept = {Path(line) for r in registries for line in r.read_text().splitlines() if line}
    if not kept:
        return
    for registry in registries:
        registry.unlink()
    _prune(base, kept)
