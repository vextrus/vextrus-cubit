"""Every failed or errored test, kept (session 05: twice a failure's name was lost).

Each run appends one line per failure to `.pytest-failures.log` at the root (gitignored): the time
in UTC, `failed` or `error` (a fixture's setup or teardown), the test's id and its first error line,
tab-separated. The file only grows; delete it by name when it is no longer wanted.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest

LOG = ".pytest-failures.log"


def first_line(report: pytest.TestReport) -> str:
    """The crash's message, or the report's last line when it has none."""
    crash = getattr(report.longrepr, "reprcrash", None)
    message = getattr(crash, "message", None) or report.longreprtext.strip().rsplit("\n", 1)[-1]
    lines = message.strip().splitlines()
    return " ".join(lines[0].split()) if lines else ""


def line(report: pytest.TestReport, now: datetime) -> str:
    kind = "failed" if report.when == "call" else "error"
    return f"{now.isoformat(timespec='seconds')}\t{kind}\t{report.nodeid}\t{first_line(report)}\n"


class FailuresLog:
    def __init__(self, path: Path) -> None:
        self.path = path

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        if report.failed:
            with self.path.open("a", encoding="utf-8") as log:
                log.write(line(report, datetime.now(UTC)))


def pytest_configure(config: pytest.Config) -> None:
    config.pluginmanager.register(FailuresLog(config.rootpath / LOG), "vextrus-failures-log")
