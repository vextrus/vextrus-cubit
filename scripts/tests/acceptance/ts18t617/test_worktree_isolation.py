"""S18-T617 (issue #617): two verifies running at once in different worktrees collide on the vitest
browser port and on the pytest test database's name, so a builder's verify goes red for reasons outside
its branch (session 17, lesson (d)). The check wanted: "verify gives each run a free vitest port and a
test database name unique to the worktree ..., with a test that two plans for two worktrees never share
either."

Pinned at verify's plan boundary, `scripts.verify.plan(paths, *, have, root)`: the env each planned check
carries, for two worktree roots.

Seams (named here; the builder makes them):
- The vitest port: the `web-test` check's env carries `VEXTRUS_VITEST_PORT`, a whole number, the first of
  `BROWSER_PROJECTS` consecutive ports, one per browser project of `web/vite.config.ts` (`browser`,
  `browser UTC`, `browser America/Los_Angeles`), which the config gives its projects. Vitest's default
  (63315 counting up per browser project) is what two runs share today.
- The test database: every planned pytest run's env carries `VEXTRUS_DB_NAME`, the name
  `vextrus.settings.db.databases` already reads when the database URLs carry no name (locally); the test
  database is `<it>_test_<10 hex>`, and xdist appends `_gw<N>`, so it is at most 40 characters (the
  settings' own bound) to stay within PostgreSQL's 63. In CI and the cloud the URLs name the database,
  so the planned name changes nothing there (one run per job).

The roots are fixed paths (the plan resolves them; nothing is created), so every run plans the same.
"""

import re
import socket
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import pytest

from scripts.verify import Check, plan
from vextrus.settings.db import databases

PORT_VARIABLE = "VEXTRUS_VITEST_PORT"
DB_VARIABLE = "VEXTRUS_DB_NAME"
BROWSER_PROJECTS = 3  # web/vite.config.ts: browser, browser UTC, browser America/Los_Angeles
MAX_DB_NAME = 40  # vextrus/settings/db.py's _MAX_NAME: "_test_", 10 hex and "_gw127" fit within 63
POSTGRES_LIMIT = 63
IDENTIFIER = re.compile(r"[a-z0-9_]+")

WEB_CHANGE = ["web/src/routes/index.tsx"]
PYTHON_CHANGES = {
    "one-module": ["vextrus/projects/models.py"],
    "whole-suite": ["conftest.py"],
    "lint-tests": ["tools/lint/acceptance.py", "scripts/verify.py"],
}

ONE = Path("/srv/clone-one/.claude/worktrees/s18-t617")
TWO = Path("/srv/clone-one/.claude/worktrees/s18-t618")
# Two clones of the repository, each with a worktree of the same name: only the parents differ.
SAME_NAME_ONE = Path("/srv/clone-one/.claude/worktrees/builder")
SAME_NAME_TWO = Path("/srv/clone-two/.claude/worktrees/builder")
LONG = "w" * 80
LONG_ONE = Path("/srv/clone-one/.claude/worktrees") / LONG
LONG_TWO = Path("/srv/clone-two/.claude/worktrees") / LONG


def is_pytest(check: Check) -> bool:
    """The check runs pytest (`uv run pytest ...`, `python -m pytest ...`), whatever its name."""
    argv = check.argv
    return any(
        token == "pytest" and (index <= 2 or argv[index - 1] == "-m") for index, token in enumerate(argv)
    )


def web_test(root: Path) -> Check:
    found = [
        check
        for check in plan(WEB_CHANGE, have=lambda tool: False, root=root)
        if check.name == "web-test"
    ]
    assert len(found) == 1, f"one web-test check for {WEB_CHANGE}, got {[c.name for c in found]}"
    return found[0]


def vitest_port(root: Path) -> int:
    check = web_test(root)
    assert PORT_VARIABLE in check.env, (
        f"the web-test check plans no {PORT_VARIABLE} for {root}: {check.command}"
    )
    value = check.env[PORT_VARIABLE]
    assert value.isdigit(), f"{PORT_VARIABLE} must be a whole number, got {value!r}"
    return int(value)


def ports(root: Path) -> set[int]:
    first = vitest_port(root)
    return set(range(first, first + BROWSER_PROJECTS))


def database_names(paths: list[str], root: Path) -> list[str]:
    runs = [check for check in plan(paths, have=lambda tool: False, root=root) if is_pytest(check)]
    assert runs, f"verify plans a pytest run for {paths}"
    names = []
    for run in runs:
        assert DB_VARIABLE in run.env, (
            f"the {run.name} check plans no {DB_VARIABLE} for {root}: {run.command}"
        )
        names.append(run.env[DB_VARIABLE])
    return names


@contextmanager
def occupied(port: int) -> Iterator[None]:
    """`port` on 127.0.0.1 is in use while the block runs (by this socket, or already by another)."""
    holder = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        try:
            holder.bind(("127.0.0.1", port))
            holder.listen(1)
        except OSError:
            pass  # someone else already holds it: it is in use either way
        yield
    finally:
        holder.close()


# The vitest port.


@pytest.mark.parametrize(
    ("one", "two"), [(ONE, TWO), (SAME_NAME_ONE, SAME_NAME_TWO)], ids=["two-names", "one-name"]
)
def test_two_worktrees_plan_vitest_ports_they_never_share(one: Path, two: Path) -> None:
    first, second = ports(one), ports(two)

    assert not first & second, (
        f"the web-test checks of {one} and {two} share vitest ports {sorted(first & second)}"
    )


def test_the_planned_vitest_ports_are_ports_a_run_may_listen_on() -> None:
    first = vitest_port(ONE)

    assert first >= 1024, f"{PORT_VARIABLE}={first}: a port under 1024 needs privileges"
    assert first + BROWSER_PROJECTS - 1 <= 65535, (
        f"{PORT_VARIABLE}={first}: its {BROWSER_PROJECTS} ports must end by 65535"
    )


def test_a_vitest_port_already_in_use_is_never_planned() -> None:
    last = max(ports(ONE))

    with occupied(last):
        again = ports(ONE)

    assert last not in again, f"verify planned vitest port {last} while it was in use: {sorted(again)}"


# The test database.


@pytest.mark.parametrize("workers", ["0", "4"], ids=["serial", "xdist"])
@pytest.mark.parametrize("change", list(PYTHON_CHANGES), ids=list(PYTHON_CHANGES))
@pytest.mark.parametrize(
    ("one", "two"), [(ONE, TWO), (SAME_NAME_ONE, SAME_NAME_TWO)], ids=["two-names", "one-name"]
)
def test_two_worktrees_plan_test_databases_they_never_share(
    monkeypatch: pytest.MonkeyPatch, one: Path, two: Path, change: str, workers: str
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", workers)
    paths = PYTHON_CHANGES[change]

    first, second = set(database_names(paths, one)), set(database_names(paths, two))

    assert not first & second, (
        f"the pytest runs of {one} and {two} share the database name {first & second}"
    )


def test_a_long_worktree_name_plans_distinct_database_names_postgresql_keeps(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "4")
    first = database_names(PYTHON_CHANGES["one-module"], LONG_ONE)
    second = database_names(PYTHON_CHANGES["one-module"], LONG_TWO)

    for name in [*first, *second]:
        assert IDENTIFIER.fullmatch(name), (
            f"{DB_VARIABLE}={name!r}: lower-case letters, digits and _ only"
        )
        assert len(name) <= MAX_DB_NAME, (
            f"{DB_VARIABLE}={name!r} is {len(name)} long, over {MAX_DB_NAME}"
        )
    assert not set(first) & set(second), (
        f"two worktrees named {LONG[:8]}... share {set(first) & set(second)}"
    )


def test_the_settings_name_the_test_database_from_the_planned_name(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("VEXTRUS_VERIFY_WORKERS", "4")
    found = {}
    for root in (SAME_NAME_ONE, SAME_NAME_TWO):
        [name, *_] = database_names(PYTHON_CHANGES["one-module"], root)
        # A local run: the URLs carry no database name, so the planned one is read.
        test_name = databases({DB_VARIABLE: name}, root)["default"]["TEST"]["NAME"]
        assert test_name.startswith(f"{name}_test_"), (
            f"{DB_VARIABLE}={name} gave the test database {test_name}"
        )
        assert len(f"{test_name}_gw127") <= POSTGRES_LIMIT, (
            f"{test_name}_gw127 is over PostgreSQL's {POSTGRES_LIMIT}"
        )
        found[root] = test_name

    assert found[SAME_NAME_ONE] != found[SAME_NAME_TWO], found
