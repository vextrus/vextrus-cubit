"""The acceptance tests run, every one (ADR 0041): a pytest plugin, loaded by CI's test run
(`pytest -p tools.lint.acceptance_pytest`), that fails the run when a test under an acceptance path was
skipped, xfailed or deselected, however that was done (a marker, a conftest hook, a `-k` or `-m` in
`pyproject.toml`). The one exception is a test deselected by the suite's own opt-in markers (it needs the
toolchain, bubblewrap or a live service), which the engine's workflow runs. A test dropped from the
collection without the deselection hook is not seen here; the reviewer reads the acceptance report.
"""

import pytest

from tools.lint.acceptance import is_acceptance

OPT_IN = frozenset({"needs_toolchain", "needs_bwrap", "live"})
_found: list[str] = []


def _acceptance(nodeid: str) -> bool:
    return is_acceptance(nodeid.split("::", 1)[0])


def pytest_deselected(items: list[pytest.Item]) -> None:
    for item in items:
        if _acceptance(item.nodeid) and not OPT_IN & {mark.name for mark in item.iter_markers()}:
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
