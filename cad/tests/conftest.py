"""The lane's skip accounting: a skip is a claim about this machine, never about the evidence.

P4a's second finding was a lane armed by the presence of the file it grades — delete
`fixtures/rcc6-bnbc/cells.json` and the M3 gate check skipped, the run stayed green, and the skip
COUNT no test asserted. The corpora checks are armed by their manifests now
(cad/tests/sanity/test_golden_corpora.py), and this hook holds the run to the arithmetic: every
skip the session prints must be one the list below explains, and anything else fails the session
with the node named — so `N skipped` can never again mean `N unproved`.

The only skips this lane admits are facts about the machine (a converter that is not installed),
which `pnpm checkup`'s probes own. A corpus that declares a file in `fixtures/*/manifest.json` and
does not carry it is a failure by name, not a skip.
"""

from __future__ import annotations

import re
from typing import Any

import pytest

#: A skip reason this lane admits, with what owns the fact instead.
EXPLAINED_SKIPS: dict[str, str] = {
    r"is not on PATH": "a converter this machine does not have; checkup's probe owns that",
}

_PATTERNS = {re.compile(pattern): why for pattern, why in EXPLAINED_SKIPS.items()}

#: (nodeid, reason) for every skip the session printed.
_SKIPPED: list[tuple[str, str]] = []


def _reason(report: pytest.TestReport) -> str:
    longrepr: Any = report.longrepr
    if isinstance(longrepr, tuple) and len(longrepr) == 3:
        return str(longrepr[2]).removeprefix("Skipped: ")
    return str(longrepr)


def pytest_runtest_logreport(report: pytest.TestReport) -> None:
    if report.skipped:
        _SKIPPED.append((report.nodeid, _reason(report)))


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    explained = [(node, why) for node, why in _SKIPPED if any(p.search(why) for p in _PATTERNS)]
    unexplained = [(node, why) for node, why in _SKIPPED if (node, why) not in explained]
    reporter = session.config.pluginmanager.get_plugin("terminalreporter")
    if reporter is None:
        return
    reporter.write_line(
        f"skip accounting: {len(_SKIPPED)} skipped, {len(explained)} explained, "
        f"{len(unexplained)} unexplained"
    )
    for node, why in explained:
        reporter.write_line(f"  skip (explained): {node} - {why}")
    for node, why in unexplained:
        reporter.write_line(f"  skip (UNEXPLAINED): {node} - {why}")
    if unexplained:
        reporter.write_line(
            "a skip this lane does not explain is a check that did not run: either the corpus "
            "carries what its manifest promises, or the manifest stops promising it"
        )
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
