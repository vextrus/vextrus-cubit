"""T-XDIST (issue #248): every checkout and every xdist worker gets its own test database.

The name keeps its shape, `<name>_test_<10 hex>`, but the 10 hex now tell two checkouts apart that share
a database name and migrations, and pytest-django's `_gw<N>` suffix reaches the name each worker uses.
"""

import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest

from vextrus.settings.db import databases

REPO = Path(__file__).resolve().parents[4]
PROBE = Path(__file__).with_name("probe_database.py")
PROBE_DB = "p6xdist_probe"
SHAPE = re.compile(r"^(?P<name>[a-z0-9_]+)_test_[0-9a-f]{10}$")
POSTGRES_NAME_LIMIT = 63


def checkout(parent: Path, name: str, kind: str) -> Path:
    """A main checkout (`.git` a folder) or a linked worktree (`.git` a file) with one migration."""
    folder = parent / name
    folder.mkdir(parents=True)
    if kind == "main":
        (folder / ".git").mkdir()
    else:
        (folder / ".git").write_text("gitdir: /elsewhere/.git/worktrees/x\n")
    migrations = folder / "vextrus" / "platform" / "migrations"
    migrations.mkdir(parents=True)
    (migrations / "0001_initial.py").write_text("operations = []\n")
    return folder


def database_for_tests(folder: Path) -> str:
    result = databases({}, folder)
    assert result["default"]["TEST"]["NAME"] == result["owner"]["TEST"]["NAME"], result
    name: str = result["default"]["TEST"]["NAME"]
    return name


@pytest.mark.parametrize("kind", ["main", "linked"])
def test_two_checkouts_with_one_name_and_one_schema_get_two_test_databases(
    tmp_path: Path, kind: str
) -> None:
    one = checkout(tmp_path / "a", "vextrus-same", kind)
    two = checkout(tmp_path / "b", "vextrus-same", kind)
    assert databases({}, one)["default"]["NAME"] == databases({}, two)["default"]["NAME"]

    first, second = database_for_tests(one), database_for_tests(two)

    assert SHAPE.fullmatch(first), first
    assert SHAPE.fullmatch(second), second
    assert first != second, f"two checkouts share the test database {first}"


def test_one_checkout_keeps_one_test_database(tmp_path: Path) -> None:
    folder = checkout(tmp_path, "vextrus-same", "linked")

    assert database_for_tests(folder) == database_for_tests(folder)


def test_a_changed_migration_still_changes_the_test_database(tmp_path: Path) -> None:
    folder = checkout(tmp_path, "vextrus-same", "linked")
    before = database_for_tests(folder)

    (folder / "vextrus" / "platform" / "migrations" / "0001_initial.py").write_text("operations = [1]\n")

    assert database_for_tests(folder) != before


def test_the_longest_worktree_s_worker_database_fits_postgresql_s_limit(tmp_path: Path) -> None:
    name = database_for_tests(checkout(tmp_path, "w" * 80, "linked"))

    assert SHAPE.fullmatch(name), name
    assert len(f"{name}_gw127") <= POSTGRES_NAME_LIMIT, name


# End to end: two workers ------------------------------------------------------------------------------


def without_path(url: str) -> str:
    return urlunsplit(urlsplit(url)._replace(path=""))


def probe_environ(out: Path) -> dict[str, str]:
    """The outer environment without xdist's variables, on the fixed base name `p6xdist_probe`, so the
    inner run never shares a database with the outer one (which may itself be a worker)."""
    environ = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PYTEST_XDIST_") and key != "PYTEST_ADDOPTS"
    }
    for variable in ("DATABASE_URL", "DATABASE_OWNER_URL"):
        if variable in environ:
            environ[variable] = without_path(environ[variable])
    environ["VEXTRUS_DB_NAME"] = PROBE_DB
    environ["XDIST_PROBE_OUT"] = str(out)
    return environ


def probe(out: Path, *args: str) -> list[tuple[str, str, str]]:
    done = subprocess.run(
        [sys.executable, "-m", "pytest", *args, "-p", "no:cacheprovider", "-rf", str(PROBE)],
        cwd=REPO,
        env=probe_environ(out),
        capture_output=True,
        text=True,
        check=False,
    )
    assert done.returncode == 0, done.stdout[-4000:] + done.stderr[-4000:]
    lines = [tuple(line.split("\t")) for line in out.read_text().splitlines()]
    assert all(len(line) == 3 for line in lines), lines
    return [(line[0], line[1], line[2]) for line in lines]


def test_two_workers_each_use_their_own_test_database(tmp_path: Path) -> None:
    [(_, serial, serial_owner)] = probe(tmp_path / "serial.txt")
    assert serial == serial_owner
    assert SHAPE.fullmatch(serial), serial
    assert serial.startswith(f"{PROBE_DB}_test_"), serial

    lines = sorted(probe(tmp_path / "workers.txt", "-n", "2", "--dist", "each"))

    assert [worker for worker, _, _ in lines] == ["gw0", "gw1"], lines
    for _, default, owner in lines:
        assert default == owner, lines
    (_, gw0, _), (_, gw1, _) = lines
    assert gw0 != gw1, f"both workers used the test database {gw0}"
    assert gw0.endswith("_gw0"), gw0
    assert gw1.endswith("_gw1"), gw1
    assert serial not in (gw0, gw1), (serial, lines)


# The engine: pytest-xdist locked, tmp_path kept only for failed tests ---------------------------------


def test_pytest_xdist_is_pinned_and_locked_from_the_registry() -> None:
    project = tomllib.loads((REPO / "pyproject.toml").read_text())
    pins = [
        found.group(1)
        for line in project["dependency-groups"]["dev"]
        if (found := re.fullmatch(r"pytest-xdist==([0-9][0-9A-Za-z.]*)", line))
    ]
    assert len(pins) == 1, project["dependency-groups"]["dev"]

    lock = tomllib.loads((REPO / "uv.lock").read_text())
    locked = [package for package in lock["package"] if package["name"] == "pytest-xdist"]
    assert [package["version"] for package in locked] == pins, locked
    assert "registry" in locked[0]["source"], locked[0]["source"]


def test_tmp_path_is_kept_only_for_failed_tests() -> None:
    options = tomllib.loads((REPO / "pyproject.toml").read_text())["tool"]["pytest"]["ini_options"]

    assert options.get("tmp_path_retention_policy") == "failed", options
