"""The root of the tests: every M0 fixture module, named once so no ticket edits this list."""

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
