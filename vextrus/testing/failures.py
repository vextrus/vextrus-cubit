"""Every failed or errored test, kept (session 05: twice a failure's name was lost).

Each run appends one line per failure to `.pytest-failures.log` at the root (gitignored): the time
in UTC, `failed` or `error` (a fixture's setup or teardown), the test's id and its first error line,
tab-separated. The file only grows; delete it by name when it is no longer wanted. A log that cannot
be written (a read-only checkout) is said once on stderr and the run goes on. Under xdist only the
controller writes, from the reports its workers send it, so each failure is one line.
"""

import sys
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
        self.broken = False

    def pytest_runtest_logreport(self, report: pytest.TestReport) -> None:
        if not report.failed or self.broken:
            return
        try:
            with self.path.open("a", encoding="utf-8") as log:
                log.write(line(report, datetime.now(UTC)))
        except OSError as error:
            self.broken = True
            sys.stderr.write(f"\nThe failures log cannot be written, so it is not kept: {error}\n")


def pytest_configure(config: pytest.Config) -> None:
    if hasattr(config, "workerinput"):
        return  # an xdist worker: the controller logs its reports
    config.pluginmanager.register(FailuresLog(config.rootpath / LOG), "vextrus-failures-log")
