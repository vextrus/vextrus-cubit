"""S14-C1 (a): the cloud setup script, `scripts/cloud/setup.sh`.

The ticket (session-14 brief, row 18): "Cloud environment: setup script under 5 min, Postgres 18 and
roles at session start". The orchestrator's pins: the setup is idempotent; it installs or starts
PostgreSQL 18 and creates both roles and the database only when missing; it prints `id -u` and its
elapsed seconds; it never prints a password and never writes one into the repository. Run in its dry
run (`VEXTRUS_CLOUD_DRY_RUN=1`, `_world.py`) against stand-in PostgreSQL tools on PATH, as this user.
The roles are the ones `scripts/owner/db-roles.sql` defines: `vextrus` owns the schema (and the
database `vextrus`) and may create databases; `vextrus_app` is the app's plain login role, never a
superuser and never BYPASSRLS.
"""

from __future__ import annotations

import os
import re
import time
from pathlib import Path

from scripts.tests.acceptance.ts14c1._world import (
    APP_PASSWORD,
    NETWORK_TOOLS,
    OWNER_PASSWORD,
    REPO,
    World,
    changed_files_since,
    require_dry_run,
)

CLOUD = REPO / "scripts" / "cloud"


def setup(world: World, **flags: bool) -> str:
    require_dry_run()
    run = world.setup(**flags)
    assert run.code == 0, f"setup.sh exited {run.code}:\n{run.text[-3000:]}"
    return run.text


def test_the_setup_creates_both_roles_and_the_database_on_a_fresh_cluster(tmp_path: Path) -> None:
    world = World(tmp_path)
    setup(world)
    state = world.load()
    assert {"vextrus", "vextrus_app"} <= set(state["roles"]), state["roles"].keys()
    assert "vextrus" in state["databases"], state["databases"].keys()


def test_the_setup_starts_postgres_when_the_cluster_is_stopped(tmp_path: Path) -> None:
    world = World(tmp_path)
    setup(world)
    assert world.events("start"), f"no PostgreSQL start among the calls: {world.tools_called()}"


def test_vextrus_owns_the_database_and_vextrus_app_is_a_plain_login_role(tmp_path: Path) -> None:
    world = World(tmp_path)
    setup(world)
    state = world.load()
    owner, app = state["roles"]["vextrus"], state["roles"]["vextrus_app"]
    assert state["databases"]["vextrus"]["owner"] == "vextrus"
    assert owner["login"], owner
    assert owner["createdb"], owner
    assert not owner["superuser"], owner
    assert not owner["bypassrls"], owner
    assert app["login"], app
    assert not any(
        app[a] for a in ("superuser", "bypassrls", "createdb", "createrole", "replication")
    ), app


def test_a_second_run_creates_nothing_and_raises_no_error(tmp_path: Path) -> None:
    world = World(tmp_path)
    setup(world)
    first = world.load()
    world.log_path.write_text("")
    setup(world)
    assert world.events("create_role") == []
    assert world.events("create_database") == []
    assert world.events("error") == [], world.events("error")
    assert world.events("unsupported") == [], world.events("unsupported")
    again = world.load()
    assert again["roles"].keys() == first["roles"].keys()
    assert again["databases"] == first["databases"]


def test_only_the_missing_database_is_created_when_both_roles_exist(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.add_role("vextrus", createdb=True)
    world.add_role("vextrus_app")
    setup(world)
    assert world.events("create_role") == []
    assert world.events("create_database") == ["vextrus"]
    assert world.events("error") == [], world.events("error")
    assert world.load()["databases"]["vextrus"]["owner"] == "vextrus"


def test_only_the_missing_role_is_created_when_the_other_exists(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.add_role("vextrus", createdb=True)
    world.add_database("vextrus", "vextrus", marker="kept")
    setup(world)
    assert world.events("create_role") == ["vextrus_app"]
    assert world.events("create_database") == []
    assert world.events("error") == [], world.events("error")


def test_an_existing_database_is_never_dropped_or_made_again(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.complete()
    setup(world)
    assert world.events("drop") == []
    assert world.load()["databases"]["vextrus"].get("marker") == "rows a session made"


def test_the_setup_prints_the_uid_it_runs_as(tmp_path: Path) -> None:
    world = World(tmp_path)
    out = setup(world)
    uid = os.getuid()
    assert re.search(rf"(?im)^.*\b(uid|id -u)\b\D*\b{uid}\b", out), (
        f"no line gives `id -u` ({uid}):\n{out[-2000:]}"
    )


def test_the_setup_prints_its_elapsed_seconds(tmp_path: Path) -> None:
    world = World(tmp_path)
    out = setup(world)
    assert re.search(r"(?im)^.*\b(elapsed|total)\b.*?\b\d+(\.\d+)?\s*(s|sec|secs|seconds)\b", out), (
        f"no line gives the elapsed seconds:\n{out[-2000:]}"
    )


def test_the_setup_never_prints_a_password(tmp_path: Path) -> None:
    world = World(tmp_path)
    out = setup(world)
    assert OWNER_PASSWORD not in out
    assert APP_PASSWORD not in out


def test_the_setup_writes_no_password_into_the_repository(tmp_path: Path) -> None:
    world = World(tmp_path)
    start = time.time_ns() - 2_000_000_000  # a coarse filesystem clock writes a little in the past
    setup(world)
    holding = []
    for path in changed_files_since(start):
        written = path.read_text(errors="replace")
        if OWNER_PASSWORD in written or APP_PASSWORD in written:
            holding.append(str(path.relative_to(REPO)))
    assert holding == [], f"a password was written into the checkout: {holding}"


def test_the_dry_run_downloads_and_installs_nothing(tmp_path: Path) -> None:
    world = World(tmp_path)
    setup(world)
    called = [tool for tool in world.tools_called() if tool in NETWORK_TOOLS]
    assert called == [], f"the dry run called {called}"


PASSWORD_LITERAL = re.compile(r"(?i)\bpassword\s+'(?!['$\"%{])[^']+'")
URL_PASSWORD = re.compile(r"postgres(?:ql)?://[^:/\s@'\"]+:([^@\s'\"]+)@")


def test_no_cloud_script_holds_a_password() -> None:
    """The passwords come from the environment's URLs: the public repository holds none. A value
    filled in at run time (`'$pw'`, `'%s'`, `'{pw}'`, psql's `:'pw'`, a URL's `<throwaway>`) is not one.
    """
    found = []
    for path in sorted(CLOUD.rglob("*")):
        if not path.is_file():
            continue
        for number, line in enumerate(path.read_text(errors="replace").splitlines(), 1):
            literal = PASSWORD_LITERAL.search(line)
            url = URL_PASSWORD.search(line)
            if literal or (url and not url.group(1).startswith(("$", "<", "{", "*"))):
                found.append(f"{path.relative_to(REPO)}:{number}: {line.strip()}")
    assert found == [], "a password is written in the repository:\n" + "\n".join(found)
