"""The acceptance tests run, every one (ADR 0041): a pytest plugin, loaded by CI's test run
(`pytest -p tools.lint.acceptance_pytest`) and by engine.yml's opt-in runs, that fails the run when a
test under an acceptance path was skipped, xfailed or deselected, however that was done (a marker, a
conftest hook, a `-k` or `-m` in `pyproject.toml`).

Two deselections are left to the other workflow, and only these (issue #107):
- in CI's run, an acceptance test whose own marks, as written in its file (the function's decorators,
  its `pytest.param` marks, its class's and its module's `pytestmark`), name `needs_toolchain` or
  `needs_bwrap`, the markers engine.yml runs, and whose file's source names that marker. A mark a
  conftest hook adds to the item never counts, and `live` is never exempt: no CI job runs it;
- in engine.yml's opt-in run (`-m "needs_toolchain or needs_bwrap"`), an acceptance test with no such
  written mark: CI's run runs it.
The written marks are read before any other plugin's `pytest_collection_modifyitems` runs. A test
dropped from the collection without the deselection hook is not seen here; the reviewer reads the
acceptance report.
"""

import re
from collections.abc import Generator, Iterable
from pathlib import Path

import pytest

from tools.lint.acceptance import is_acceptance

ENGINE_MARKERS = frozenset({"needs_toolchain", "needs_bwrap"})
ENGINE_RUN = "needs_toolchain or needs_bwrap"
_found: list[str] = []
_written: dict[str, frozenset[str]] = {}
_opt_in_run = False


def _acceptance(nodeid: str) -> bool:
    return is_acceptance(nodeid.split("::", 1)[0])


def _names(marks: object) -> set[str]:
    """The names of a `pytestmark` value: one mark, one decorator, or a list of either."""
    if marks is None:
        return set()
    listed: Iterable[object] = marks if isinstance(marks, list | tuple) else [marks]
    return {name for mark in listed if isinstance(name := getattr(mark, "name", None), str)}


def written_marks(item: pytest.Item) -> frozenset[str]:
    """The engine markers an item carries as written in its own file, not as any hook left them."""
    names: set[str] = set()
    callspec = getattr(item, "callspec", None)
    if callspec is not None:
        names |= _names(list(callspec.marks))
    for owner in ("function", "cls", "module"):
        names |= _names(getattr(getattr(item, owner, None), "pytestmark", None))
    names &= ENGINE_MARKERS
    if not names:
        return frozenset()
    try:
        source = Path(item.path).read_text()
    except OSError:
        return frozenset()
    return frozenset(name for name in names if re.search(rf"\b{name}\b", source))


def pytest_configure(config: pytest.Config) -> None:
    global _opt_in_run
    _opt_in_run = " ".join(str(config.option.markexpr).split()) == ENGINE_RUN


@pytest.hookimpl(wrapper=True, tryfirst=True)
def pytest_collection_modifyitems(items: list[pytest.Item]) -> Generator[None]:
    for item in items:
        if _acceptance(item.nodeid):
            _written[item.nodeid] = written_marks(item)
    return (yield)


def pytest_deselected(items: list[pytest.Item]) -> None:
    for item in items:
        if not _acceptance(item.nodeid):
            continue
        left_to_the_engine = bool(_written.get(item.nodeid))
        if left_to_the_engine != _opt_in_run:
            continue
        _found.append(f"{item.nodeid}: deselected")


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    if not _acceptance(report.nodeid):
        return
    if hasattr(report, "wasxfail"):
        _found.append(f"{report.nodeid}: xfailed or xpassed")
    elif report.skipped:
        _found.append(f"{report.nodeid}: skipped")


def pytest_terminal_summary(terminalreporter: pytest.TerminalReporter) -> None:
    if _found:
        terminalreporter.section("acceptance tests that did not run (ADR 0041)")
        for line in _found:
            terminalreporter.write_line(line)


def pytest_sessionfinish(session: pytest.Session) -> None:
    if _found:
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
