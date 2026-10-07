"""The root of the tests: every M0 fixture module, named once so no ticket edits this list."""

import os

pytest_plugins = [
    "vextrus.testing.database",
    "vextrus.testing.tenancy",
    "vextrus.testing.auth",
    "vextrus.testing.jobs",
    "vextrus.testing.drawings",
    "vextrus.testing.jev",
    "vextrus.testing.takeoff",
    "vextrus.testing.failures",
    "pytester",
]


def pytest_configure(config: object) -> None:
    """Colour forced in the shell reaches the subprocesses tests start (nested pytest, node) and breaks
    the regexes that read their output: drop it for the whole run (S15-FC)."""
    for key in ("FORCE_COLOR", "PY_COLORS", "CLICOLOR_FORCE"):
        os.environ.pop(key, None)
    os.environ["NO_COLOR"] = "1"
