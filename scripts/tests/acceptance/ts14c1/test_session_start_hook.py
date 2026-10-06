"""S14-C1 (b) and (c): the cloud SessionStart hook in `.claude/settings.json`.

The ticket (session-14 brief, row 18): "Postgres 18 and roles at session start". The orchestrator's
pins: the SessionStart hook runs the cloud script only in a cloud session (`CLAUDE_CODE_REMOTE=true`),
never locally; and (the owner, session 14: cloud sessions could not find the chrome-devtools MCP for
web walks and silently fell back to Playwright) the cloud hook states plainly that browser walks
(chrome-devtools) are local-only, and never runs a substitute browser walk.

Each test runs the hook's own command line from the settings, as Claude Code would (`bash -c`, the
SessionStart JSON on stdin, `CLAUDE_PROJECT_DIR` and `CLAUDE_ENV_FILE` set), against the stand-in tools
of `_world.py`; a cloud session's test sets the dry run `VEXTRUS_CLOUD_DRY_RUN=1`, a local one does not.
"""

from __future__ import annotations

import re
from pathlib import Path

from scripts.tests.acceptance.ts14c1._world import (
    APP_PASSWORD,
    BROWSER_TOOLS,
    OWNER_PASSWORD,
    Run,
    World,
    cloud_hook_commands,
    require_dry_run,
)


def commands() -> list[str]:
    found = cloud_hook_commands()
    assert found, "no SessionStart hook for a session's start runs a script under scripts/cloud/"
    return found


def cloud_start(world: World) -> Run:
    require_dry_run()
    out, err, code = "", "", 0
    for command in commands():
        run = world.hook(command, cloud=True)
        out, err, code = out + run.out, err + run.err, code or run.code
    assert code == 0, f"the cloud hook exited {code}:\n{(out + err)[-3000:]}"
    return Run(code, out, err)


def test_the_settings_run_a_cloud_script_when_a_session_starts() -> None:
    assert commands()


def test_a_local_session_start_touches_no_database_and_no_tool(tmp_path: Path) -> None:
    world = World(tmp_path)
    for command in commands():
        run = world.hook(command, cloud=False, dry_run=False)
        assert run.code == 0, run.text
    assert world.tools_called() == [], f"a local session start called {world.tools_called()}"
    assert world.load()["running"] is False


def test_a_cloud_session_start_leaves_postgres_running(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.complete()
    cloud_start(world)
    assert world.load()["running"] is True


def test_a_cloud_session_start_makes_the_missing_roles_and_database(tmp_path: Path) -> None:
    world = World(tmp_path)
    cloud_start(world)
    state = world.load()
    assert {"vextrus", "vextrus_app"} <= set(state["roles"]), state["roles"].keys()
    assert state["databases"].get("vextrus", {}).get("owner") == "vextrus", state["databases"]


def test_a_second_cloud_session_start_changes_nothing(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.complete()
    cloud_start(world)
    cloud_start(world)
    assert world.events("create_role") == []
    assert world.events("create_database") == []
    assert world.events("drop") == []
    assert world.events("error") == [], world.calls()
    assert world.load()["databases"]["vextrus"].get("marker") == "rows a session made"


def test_the_cloud_roles_take_the_passwords_the_environment_names(tmp_path: Path) -> None:
    """The app connects with DATABASE_URL and migrates with DATABASE_OWNER_URL: the roles' passwords are
    theirs, after the setup and a session's start."""
    world = World(tmp_path)
    require_dry_run()
    setup = world.setup()
    assert setup.code == 0, setup.text[-3000:]
    cloud_start(world)
    roles = world.load()["roles"]
    assert roles["vextrus"]["password"] == OWNER_PASSWORD
    assert roles["vextrus_app"]["password"] == APP_PASSWORD


def test_a_cloud_session_start_never_prints_a_password(tmp_path: Path) -> None:
    world = World(tmp_path)
    run = cloud_start(world)
    assert OWNER_PASSWORD not in run.text
    assert APP_PASSWORD not in run.text


def test_a_cloud_session_start_says_browser_walks_are_local_only(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.complete()
    text = cloud_start(world).text
    assert "chrome-devtools" in text, text[-2000:]
    assert re.search(r"(?i)\bbrowser walks?\b", text), text[-2000:]
    assert re.search(r"(?i)\blocal[- ]only\b", text), text[-2000:]


def test_a_local_session_start_does_not_say_it(tmp_path: Path) -> None:
    world = World(tmp_path)
    for command in commands():
        run = world.hook(command, cloud=False, dry_run=False)
        assert not re.search(r"(?i)\blocal[- ]only\b", run.text), run.text


def test_a_cloud_session_start_runs_no_browser(tmp_path: Path) -> None:
    world = World(tmp_path)
    world.complete()
    cloud_start(world)
    called = [tool for tool in world.tools_called() if tool in (*BROWSER_TOOLS, "npx", "npm")]
    assert called == [], f"the cloud session start ran {called}"
