"""The world of ticket S14-C1's acceptance tests: the cloud scripts run against stand-in tools.

S14-C1 (session-14 brief, row 18): "Cloud environment: setup script under 5 min, Postgres 18 and roles
at session start", with an owner checklist; and (the owner, session 14) cloud sessions say plainly that
browser walks are local-only and never substitute another browser.

The seams (pinned here):
- `VEXTRUS_CLOUD_DRY_RUN=1`: the dry run of `scripts/cloud/setup.sh` and of the cloud SessionStart
  hook. It downloads and installs nothing (no curl, wget, apt, gh, pip, npm or npx call) and does the
  PostgreSQL part with the PostgreSQL tools it finds on PATH, as the user running it (not root);
- `CLAUDE_CODE_REMOTE=true`: a cloud session (Claude Code's own variable); unset, a local one;
- `DATABASE_URL` and `DATABASE_OWNER_URL` (the cloud environment's variables, setup.sh's header):
  `postgresql://<role>:<password>@127.0.0.1:5432/vextrus` for `vextrus_app` and `vextrus`. The roles'
  passwords are the ones these name, so no password is written in the repository.
The stand-ins are `_fake_tools.py` (its docstring lists what they understand), first on PATH. Proxies
point at a closed local port, so a forgotten download fails instead of reaching the network.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

REPO = Path(__file__).resolve().parents[4]
SETUP = REPO / "scripts" / "cloud" / "setup.sh"
SETTINGS = REPO / ".claude" / "settings.json"
FAKE = Path(__file__).with_name("_fake_tools.py")

OWNER_PASSWORD = "c1-owner-Qx7ttz4"
APP_PASSWORD = "c1-app-Lm2vvk9"
OWNER_URL = f"postgresql://vextrus:{OWNER_PASSWORD}@127.0.0.1:5432/vextrus"
APP_URL = f"postgresql://vextrus_app:{APP_PASSWORD}@127.0.0.1:5432/vextrus"

PG_TOOLS = (
    "psql",
    "pg_ctl",
    "pg_ctlcluster",
    "pg_isready",
    "pg_lsclusters",
    "initdb",
    "pg_createcluster",
    "postgres",
    "pg_config",
    "createuser",
    "createdb",
    "dropuser",
    "dropdb",
    "service",
    "systemctl",
    "su",
    "runuser",
    "sudo",
)
NETWORK_TOOLS = ("curl", "wget", "apt-get", "apt", "gh", "pip", "pip3", "npx", "npm")
BROWSER_TOOLS = ("playwright", "chromium", "chromium-browser", "google-chrome", "chrome")
OTHER_TOOLS = ("uv", "gpg", "dotnet")
ALL_TOOLS = PG_TOOLS + NETWORK_TOOLS + BROWSER_TOOLS + OTHER_TOOLS
STARTUP = json.dumps({"hook_event_name": "SessionStart", "source": "startup", "session_id": "ts14c1"})


def superuser() -> dict[str, Any]:
    return {
        "login": True,
        "superuser": True,
        "createdb": True,
        "createrole": True,
        "bypassrls": True,
        "replication": True,
        "inherit": True,
        "password": None,
    }


@dataclass
class Run:
    code: int
    out: str
    err: str

    @property
    def text(self) -> str:
        return self.out + self.err


class World:
    """One stopped PostgreSQL 18 cluster (only `postgres` and its database), and the tools' log."""

    def __init__(self, tmp_path: Path) -> None:
        self.tmp = tmp_path
        self.bin = tmp_path / "bin"
        self.bin.mkdir()
        self.state_path = tmp_path / "cluster.json"
        self.log_path = tmp_path / "calls.jsonl"
        self.log_path.write_text("")
        self.home = tmp_path / "home"
        self.home.mkdir()
        self.scratch = tmp_path / "tmp"
        self.scratch.mkdir()
        self.env_file = tmp_path / "claude-env"
        self.env_file.write_text("")
        self.state: dict[str, Any] = {
            "running": False,
            "roles": {"postgres": superuser()},
            "databases": {"postgres": {"owner": "postgres"}},
        }
        self.save()
        for tool in ALL_TOOLS:
            wrapper = self.bin / tool
            wrapper.write_text(
                "#!/bin/sh\n"
                f'exec "{sys.executable}" "{FAKE}" "{self.state_path}" "{self.log_path}" {tool} "$@"\n'
            )
            wrapper.chmod(0o755)

    # --- the cluster --------------------------------------------------------------------------------
    def save(self) -> None:
        self.state_path.write_text(json.dumps(self.state, indent=1, sort_keys=True))

    def load(self) -> dict[str, Any]:
        self.state = json.loads(self.state_path.read_text())
        return self.state

    def add_role(self, name: str, **attrs: Any) -> None:
        role = {
            "login": True,
            "superuser": False,
            "createdb": False,
            "createrole": False,
            "bypassrls": False,
            "replication": False,
            "inherit": True,
            "password": None,
        }
        role.update(attrs)
        self.state["roles"][name] = role
        self.save()

    def add_database(self, name: str, owner: str, marker: str | None = None) -> None:
        self.state["databases"][name] = {"owner": owner, **({"marker": marker} if marker else {})}
        self.save()

    def complete(self) -> None:
        """A cluster the setup already prepared: both roles and the database."""
        self.add_role("vextrus", createdb=True, password=OWNER_PASSWORD)
        self.add_role("vextrus_app", password=APP_PASSWORD)
        self.add_database("vextrus", "vextrus", marker="rows a session made")

    # --- the log ------------------------------------------------------------------------------------
    def calls(self) -> list[dict[str, Any]]:
        return [json.loads(line) for line in self.log_path.read_text().splitlines() if line.strip()]

    def tools_called(self) -> list[str]:
        return [call["tool"] for call in self.calls()]

    def events(self, kind: str) -> list[str]:
        return [detail for call in self.calls() for k, detail in call["events"] if k == kind]

    # --- running ------------------------------------------------------------------------------------
    def env(self, *, cloud: bool, dry_run: bool = True, urls: bool = True) -> dict[str, str]:
        keep = {
            k: v for k, v in os.environ.items() if k in ("LANG", "LC_ALL", "TERM", "USER", "LOGNAME")
        }
        env = {
            **keep,
            "PATH": f"{self.bin}{os.pathsep}{os.environ.get('PATH', '/usr/bin:/bin')}",
            "HOME": str(self.home),
            "TMPDIR": str(self.scratch),
            "CLAUDE_PROJECT_DIR": str(REPO),
            "CLAUDE_ENV_FILE": str(self.env_file),
            "http_proxy": "http://127.0.0.1:9",
            "https_proxy": "http://127.0.0.1:9",
            "HTTP_PROXY": "http://127.0.0.1:9",
            "HTTPS_PROXY": "http://127.0.0.1:9",
            "no_proxy": "",
            "NO_PROXY": "",
            "PIP_INDEX_URL": "http://127.0.0.1:9/simple",
            "UV_OFFLINE": "1",
            "npm_config_offline": "true",
        }
        if cloud:
            env["CLAUDE_CODE_REMOTE"] = "true"
        if dry_run:
            env["VEXTRUS_CLOUD_DRY_RUN"] = "1"
        if urls:
            env["DATABASE_URL"] = APP_URL
            env["DATABASE_OWNER_URL"] = OWNER_URL
        return env

    def setup(self, **env_flags: bool) -> Run:
        flags = {"cloud": True, **env_flags}
        done = subprocess.run(
            ["bash", str(SETUP)],
            cwd=REPO,
            env=self.env(**flags),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=300,
            check=False,
        )
        return Run(done.returncode, done.stdout, done.stderr)

    def hook(self, command: str, **env_flags: bool) -> Run:
        done = subprocess.run(
            ["bash", "-c", command],
            cwd=REPO,
            env=self.env(**env_flags),
            input=STARTUP,
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        return Run(done.returncode, done.stdout, done.stderr)


def require_dry_run() -> None:
    """A real cloud run installs system packages: a test never starts one."""
    cloud = REPO / "scripts" / "cloud"
    texts = [p.read_text(errors="replace") for p in sorted(cloud.rglob("*")) if p.is_file()]
    assert any("VEXTRUS_CLOUD_DRY_RUN" in t for t in texts), (
        "scripts/cloud/ has no VEXTRUS_CLOUD_DRY_RUN dry run yet: not built"
    )


def cloud_hook_commands() -> list[str]:
    """The SessionStart commands in .claude/settings.json, for a session's start, that name a script
    under scripts/cloud/."""
    settings = json.loads(SETTINGS.read_text())
    found = []
    for entry in settings.get("hooks", {}).get("SessionStart", []):
        matcher = entry.get("matcher", "")
        if matcher and "startup" not in matcher.split("|") and matcher != "*":
            continue
        for hook in entry.get("hooks", []):
            command = hook.get("command", "")
            if hook.get("type") == "command" and "scripts/cloud/" in command:
                found.append(command)
    return found


def changed_files_since(start_ns: int) -> list[Path]:
    """Files under the checkout written at or after `start_ns` (build and dependency folders left
    out)."""
    skip = {
        ".git",
        "node_modules",
        ".venv",
        "__pycache__",
        ".mypy_cache",
        ".ruff_cache",
        ".pytest_cache",
    }
    found = []
    for folder, dirs, files in os.walk(REPO):
        dirs[:] = [d for d in dirs if d not in skip]
        for name in files:
            path = Path(folder) / name
            try:
                if path.stat().st_mtime_ns >= start_ns and not path.is_symlink():
                    found.append(path)
            except OSError:
                continue
    return found
