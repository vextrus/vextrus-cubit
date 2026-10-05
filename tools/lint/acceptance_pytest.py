"""The acceptance tests run, every one (ADR 0041): a pytest plugin, loaded by CI's test run
(`pytest -p tools.lint.acceptance_pytest`) and by engine.yml's opt-in runs, that fails the run when a
test under an acceptance path was skipped, xfailed or deselected, however that was done (a marker, a
conftest hook, a `-k` or `-m` in `pyproject.toml`).

Two deselections are left to the other workflow, and only these (issue #107):
- in CI's run, an acceptance test whose own marks (the function's `pytestmark`, its `pytest.param`
  marks, its class's and its module's `pytestmark`) name `needs_toolchain` or `needs_bwrap`, the
  markers engine.yml runs, and whose file (the one its node id names) names that marker. A mark
  `item.add_marker` adds never counts, and `live` is never exempt: no CI job runs it;
- in engine.yml's opt-in run (`-m "needs_toolchain or needs_bwrap"` on the command line), an acceptance
  test with no such mark: CI's run runs it.

What this cannot see (a tripwire, not a wall; the reviewer reads the acceptance report). The marks are
read in a tryfirst wrapper of `pytest_collection_modifyitems`, so code that runs earlier can still set
them: a conftest's own tryfirst wrapper of that hook, `pytest_itemcollected`, or `pytest_generate_tests`
adding `pytest.param` marks; so can a conftest that rewrites a report, resets the exit status or drops a
test from `items` without the deselection hook. Such a conftest is in-process code this plugin cannot
wall off.

Under pytest-xdist (`-n`) the workers collect, deselect and run, and the controller reports. A worker
records its deselections and hands them up in `workeroutput` at its session's end; the controller
merges each worker's list once (every worker deselects the same tests) and counts skips and xfails from
the reports the workers forward, so a worker never counts them itself. A worker that goes down with no
such list (it crashed, or was killed) is named as `<worker id>: no report from the worker` and fails the
run: what it deselected is unknown. Without xdist installed nothing of this runs.
"""

import re
from collections.abc import Generator, Iterable

import pytest

from tools.lint.acceptance import is_acceptance

ENGINE_MARKERS = frozenset({"needs_toolchain", "needs_bwrap"})
ENGINE_RUN = "needs_toolchain or needs_bwrap"
_found: list[str] = []
_written: dict[str, frozenset[str]] = {}
_opt_in_run = False
_worker = False
WORKER_KEY = "acceptance_not_run"


def _acceptance(nodeid: str) -> bool:
    return is_acceptance(nodeid.split("::", 1)[0])


def _names(marks: object) -> set[str]:
    """The names of a `pytestmark` value: one mark, one decorator, or a list of either."""
    if marks is None:
        return set()
    listed: Iterable[object] = marks if isinstance(marks, list | tuple) else [marks]
    return {name for mark in listed if isinstance(name := getattr(mark, "name", None), str)}


def written_marks(item: pytest.Item) -> frozenset[str]:
    """The engine markers on the item's function, param, class and module (not its `add_marker`s)
    that its file names too."""
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
        # The file the test's node id names, not `item.path`, which a hook may point elsewhere.
        source = (item.config.rootpath / item.nodeid.split("::", 1)[0]).read_text()
    except OSError:
        return frozenset()
    return frozenset(name for name in names if re.search(rf"\b{name}\b", source))


def pytest_configure(config: pytest.Config) -> None:
    """The opt-in run is engine.yml's: its `-m` is on the command line itself, so an `addopts` or
    `PYTEST_ADDOPTS` naming the same expression never turns CI's run into it."""
    global _opt_in_run, _worker
    _worker = hasattr(config, "workerinput")
    given = list(config.invocation_params.args)
    on_the_line = [given[i + 1] for i, arg in enumerate(given[:-1]) if arg == "-m"]
    on_the_line += [arg[2:] for arg in given if arg.startswith("-m") and len(arg) > 2]
    _opt_in_run = str(config.option.markexpr) == ENGINE_RUN and ENGINE_RUN in on_the_line


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
    if _worker or not _acceptance(report.nodeid):  # the controller counts a worker's reports
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


@pytest.hookimpl(optionalhook=True)
def pytest_testnodedown(node: object, error: object) -> None:
    """The controller merges a worker's deselections; a worker with no list fails the run closed."""
    output = getattr(node, "workeroutput", None)
    reported = output.get(WORKER_KEY) if isinstance(output, dict) else None
    if not isinstance(reported, list):
        workerinput = getattr(node, "workerinput", None)
        worker = workerinput.get("workerid") if isinstance(workerinput, dict) else None
        reported = [f"{worker or 'a worker'}: no report from the worker"]
    for line in reported:
        if line not in _found:
            _found.append(line)


def pytest_sessionfinish(session: pytest.Session) -> None:
    if _worker:
        # Read by xdist after this hook returns; the controller reports and sets the exit status.
        session.config.workeroutput[WORKER_KEY] = list(_found)  # type: ignore[attr-defined]
        return
    if _found:
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
