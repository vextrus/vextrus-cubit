"""Ticket f3, 3.5: the local launcher (`python -m scripts.factory.local`, which f1's `launch.py local`
calls as `local.main(argv)`), spec 2.2 "Launch, local" and "Launch record", launch-cli.md 1, 4 and 5.

    local --ticket T --branch B --effort E --name N --prompt-file F [--model M]
          [--role builder|acceptance-writer] [--budget-minutes MIN] [--dry-run]

First stdout line `OK launched <name> <session_id>`; a refusal is `REFUSED <code>: <reason>` (exit
2), the governor's `REFUSED governor: <reason>` (exit 3), `ERROR <one line>` (exit 1), usage 64
(launch-cli.md 1). `--dry-run` prints one JSON object with the `argv` it would run and its `cwd`, and
launches nothing.

Black-box, git real: a bare `origin` and a `main` clone (the main checkout, the launcher's cwd).
`claude` and `uv` are stubs first on `PATH`: `claude` records its argv, cwd and environment, answers
`--version`, and on `--bg` adds a row named by `--name` to the agents file (`VEXTRUS_AGENTS_FILE`,
the stand-in for `claude agents --json --all`), whose `sessionId` is uuid5(URL, name); `uv` records
its call, answers `run ... manage.py ...` with success and runs `run ... python ...` with this
Python. The governor reads the seams `VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE`, `VEXTRUS_USAGE_FILE`,
`VEXTRUS_AGENTS_FILE`.

origin's history: `c0` (README, conflict.txt) is the root; `main` adds `.claude/agents/builder.md`,
`scripts/factory/builder.settings.json` and changes conflict.txt; `f-ok` is main plus one commit;
`f-carried` is c0 plus a new file (no builder.md: a carried branch); `f-conflict` is c0 plus its own
conflict.txt.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import uuid
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
NOW = "2026-10-04T21:08:00Z"
RECORD_STEM = "20261004T210800Z"
KB_PER_GB = 1024 * 1024
OLD_DATE = "2026-01-01T00:00:00+0000"
PROMPT = "Follow `.claude/agents/builder.md`. Build ticket t901 on its branch."
PLANTED = {
    "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS": "8",
    "CLAUDE_CODE_PLUGIN_DIRS": "/somewhere/plugins",
    "CLAUDE_PROJECT_DIR": "/somewhere/main-checkout",
}
RECORD_KEYS = {
    "ticket",
    "branch",
    "where",
    "role",
    "effort",
    "model",
    "budget_minutes",
    "session_id",
    "cli_version",
    "started_at",
    "governor",
    "leak_scan",
    "judge",
    "stop_sent",
    "untestable",
    "review",
}
USAGE = (
    "Current session: 12% used · resets Oct 5, 12:59am (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)

CLAUDE_STUB = """
import json, os, sys, uuid
args = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps({{"argv": args, "cwd": os.getcwd(), "env": dict(os.environ)}}) + "\\n")
if args == ["--version"]:
    print("2.1.999 (Claude Code)")
elif args[:1] == ["agents"]:
    print(open({agents!r}).read())
elif "--bg" in args:
    name = args[args.index("--name") + 1]
    rows = json.loads(open({agents!r}).read())
    rows.append({{"id": "ae575c11", "cwd": os.getcwd(), "kind": "background",
                  "startedAt": "2026-10-04T21:08:00Z",
                  "sessionId": str(uuid.uuid5(uuid.NAMESPACE_URL, name)), "name": name,
                  "state": "working", "pid": 50123}})
    open({agents!r}, "w").write(json.dumps(rows))
    print("started in the background")
"""

UV_STUB = """
import json, os, sys
args = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps({{"argv": args, "cwd": os.getcwd()}}) + "\\n")
if args[:1] == ["run"]:
    rest = [a for a in args[1:] if not a.startswith("-")]
    if "manage.py" in rest:
        sys.exit(0)
    if rest and rest[0] in ("python", "python3"):
        at = args.index(rest[0])
        os.execv(sys.executable, [sys.executable, *args[at + 1:]])
sys.exit(0)
"""


def meminfo(avail_gb: float) -> str:
    kb = int(avail_gb * KB_PER_GB)
    return (
        f"MemTotal:       {27 * KB_PER_GB} kB\nMemAvailable:   {kb} kB\n"
        f"SwapTotal:      {8 * KB_PER_GB} kB\nSwapFree:       {8 * KB_PER_GB} kB\n"
    )


class Launcher:
    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.origin = tmp / "origin.git"
        self.seed = tmp / "seed"
        self.main = tmp / "main"
        self.factory = tmp / "factory"
        self.factory.mkdir()
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.calls = tmp / "calls"
        self.calls.mkdir()
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.seams = {name: tmp / f"{name}.txt" for name in ("meminfo", "df", "usage", "agents")}
        self.seams["meminfo"].write_text(meminfo(20))
        self.seams["df"].write_text(f"    Avail\n{100 * KB_PER_GB}\n")
        self.seams["usage"].write_text(USAGE)
        self.seams["agents"].write_text("[]")
        self.prompt = tmp / "prompt.txt"
        self.prompt.write_text(PROMPT)
        for name, body in (("claude", CLAUDE_STUB), ("uv", UV_STUB)):
            path = self.stubs / name
            text = body.format(log=str(self.calls / name), agents=str(self.seams["agents"]))
            path.write_text(f"#!{sys.executable}\n{text}")
            path.chmod(0o755)
        self.build_origin()

    def git_env(self) -> dict[str, str]:
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        env.update(
            GIT_CONFIG_GLOBAL=str(self.gitconfig),
            GIT_CONFIG_NOSYSTEM="1",
            GIT_ALLOW_PROTOCOL="file",
            GIT_AUTHOR_DATE=OLD_DATE,
            GIT_COMMITTER_DATE=OLD_DATE,
        )
        return env

    def git(self, cwd: Path, *args: str) -> str:
        done = subprocess.run(
            ["git", *args], cwd=cwd, env=self.git_env(), capture_output=True, text=True, check=False
        )
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def commit(self, files: dict[str, str], message: str) -> str:
        for name, text in files.items():
            path = self.seed / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
            self.git(self.seed, "add", name)
        self.git(self.seed, "commit", "-q", "-m", message)
        return self.git(self.seed, "rev-parse", "HEAD")

    def build_origin(self) -> None:
        self.seed.mkdir()
        self.git(self.seed, "init", "-q", "-b", "main")
        self.c0 = self.commit({"README": "seed\n", "conflict.txt": "base\n"}, "c0")
        self.git(self.seed, "checkout", "-q", "-b", "f-carried")
        self.commit({"feature.txt": "carried work\n"}, "carried work")
        self.git(self.seed, "checkout", "-q", "-b", "f-conflict", self.c0)
        self.commit({"conflict.txt": "theirs\n"}, "conflicting work")
        self.git(self.seed, "checkout", "-q", "main")
        self.main_sha = self.commit(
            {
                ".claude/agents/builder.md": "# builder\n",
                "scripts/factory/builder.settings.json": "{}\n",
                "conflict.txt": "ours\n",
            },
            "main: the builder agent",
        )
        self.git(self.seed, "checkout", "-q", "-b", "f-ok")
        self.commit({"ok.txt": "ticket work\n"}, "ticket work")
        self.git(self.seed, "checkout", "-q", "main")
        self.git(self.tmp, "clone", "-q", "--bare", str(self.seed), str(self.origin))
        self.git(self.tmp, "clone", "-q", str(self.origin), str(self.main))

    def origin_tip(self, branch: str) -> str:
        return self.git(self.main, "ls-remote", "origin", f"refs/heads/{branch}").split()[0]

    def worktree(self, ticket: str) -> Path:
        return self.main / ".claude" / "worktrees" / ticket

    def env(self, planted: dict[str, str] | None = None) -> dict[str, str]:
        env = {
            k: v for k, v in self.git_env().items() if not k.startswith("VEXTRUS_") and k not in PLANTED
        }
        env.update(planted or {})
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=NOW,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_MEMINFO_FILE=str(self.seams["meminfo"]),
            VEXTRUS_DF_FILE=str(self.seams["df"]),
            VEXTRUS_USAGE_FILE=str(self.seams["usage"]),
            VEXTRUS_AGENTS_FILE=str(self.seams["agents"]),
        )
        return env

    def local(
        self,
        ticket: str = "t901",
        branch: str = "f-ok",
        *extra: str,
        name: str | None = None,
        cwd: Path | None = None,
        planted: dict[str, str] | None = None,
    ) -> subprocess.CompletedProcess[str]:
        args = [
            "--ticket",
            ticket,
            "--branch",
            branch,
            "--effort",
            "high",
            "--name",
            name or f"{ticket}-builder",
            "--prompt-file",
            str(self.prompt),
            *extra,
        ]
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.local", *args],
            cwd=cwd or self.main,
            env=self.env(planted),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=300,
            check=False,
        )

    def calls_of(self, name: str) -> list[dict[str, Any]]:
        log = self.calls / name
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

    def bg_calls(self) -> list[dict[str, Any]]:
        return [call for call in self.calls_of("claude") if "--bg" in call["argv"]]


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def first_line(done: subprocess.CompletedProcess[str]) -> str:
    return done.stdout.splitlines()[0] if done.stdout.strip() else ""


def dry_run(done: subprocess.CompletedProcess[str]) -> dict[str, Any]:
    assert done.returncode == 0, show(done)
    plan: dict[str, Any] = json.loads(done.stdout[done.stdout.index("{") :])
    return plan


def session_id(name: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, name))


def expected_argv(launcher: Launcher, name: str) -> list[str]:
    settings = str(launcher.main.resolve() / "scripts" / "factory" / "builder.settings.json")
    return [
        "claude",
        "--bg",
        "--agent",
        "builder",
        "--name",
        name,
        "--effort",
        "high",
        "--settings",
        settings,
        PROMPT,
    ]


@pytest.fixture
def launcher(tmp_path: Path) -> Launcher:
    return Launcher(tmp_path)


# L1
@pytest.mark.parametrize("where", ["main checkout", "linked worktree"])
def test_l1_dry_run_shows_the_exact_argv_with_an_absolute_settings_path(
    launcher: Launcher, where: str
) -> None:
    cwd = launcher.main
    if where == "linked worktree":
        cwd = launcher.tmp / "linked"
        launcher.git(launcher.main, "worktree", "add", "-q", "-b", "side", str(cwd))
    plan = dry_run(launcher.local("t901", "f-ok", "--dry-run", cwd=cwd))
    argv = plan["argv"]
    assert argv[:9] == expected_argv(launcher, "t901-builder")[:9]
    assert Path(argv[9]).is_absolute()
    assert (
        Path(argv[9]).resolve()
        == launcher.main.resolve() / "scripts" / "factory" / "builder.settings.json"
    )
    assert argv[10:] == [PROMPT]
    assert Path(plan["cwd"]).resolve() == launcher.worktree("t901").resolve()
    assert launcher.bg_calls() == [], "a dry run launched a session"


# L2
def test_l2_the_child_runs_as_a_builder_without_the_orchestrators_environment(
    launcher: Launcher,
) -> None:
    done = launcher.local("t901", "f-ok", planted=PLANTED)
    assert done.returncode == 0, show(done)
    [call] = launcher.bg_calls()
    assert call["env"].get("VEXTRUS_ROLE") == "builder"
    for key in PLANTED:
        assert key not in call["env"], f"{key} reached the builder"


# L3
@pytest.mark.parametrize(
    "extra",
    [[], ["--model", "claude-sonnet-5-5"], ["--role", "acceptance-writer"], ["--budget-minutes", "90"]],
)
def test_l3_plugin_dir_is_never_passed(launcher: Launcher, extra: list[str]) -> None:
    plan = dry_run(launcher.local("t901", "f-ok", *extra, "--dry-run", planted=PLANTED))
    assert not any(str(arg).startswith("--plugin-dir") for arg in plan["argv"]), plan["argv"]
    done = launcher.local("t901", "f-ok", *extra, planted=PLANTED)
    assert done.returncode == 0, show(done)
    for call in launcher.bg_calls():
        assert not any(arg.startswith("--plugin-dir") for arg in call["argv"]), call["argv"]


# L4
def test_l4_a_governor_refusal_exits_3_and_creates_nothing(launcher: Launcher) -> None:
    launcher.seams["meminfo"].write_text(meminfo(3))
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 3, show(done)
    assert first_line(done).startswith("REFUSED governor: "), show(done)
    assert not launcher.worktree("t901").exists()
    assert launcher.bg_calls() == []


# L5
def test_l5_a_branch_origin_does_not_list_is_refused_even_with_a_stale_tracking_ref(
    launcher: Launcher,
) -> None:
    launcher.git(launcher.main, "update-ref", "refs/remotes/origin/f-gone", launcher.main_sha)
    done = launcher.local("t901", "f-gone")
    assert done.returncode == 2, show(done)
    assert first_line(done).startswith("REFUSED branch-not-on-origin"), show(done)
    assert not launcher.worktree("t901").exists()
    assert launcher.bg_calls() == []


# L6
def test_l6_the_worktree_is_at_origins_tip_tracking_origin(launcher: Launcher) -> None:
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 0, show(done)
    tree = launcher.worktree("t901")
    assert launcher.git(tree, "rev-parse", "HEAD") == launcher.origin_tip("f-ok")
    assert launcher.git(tree, "rev-parse", "--abbrev-ref", "HEAD") == "f-ok"
    assert (
        launcher.git(tree, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}") == "origin/f-ok"
    )
    [call] = launcher.bg_calls()
    assert Path(call["cwd"]).resolve() == tree.resolve()
    assert call["argv"] == expected_argv(launcher, "t901-builder")[1:]
    ensure = [
        c for c in launcher.calls_of("uv") if "manage.py" in c["argv"] and "ensure_database" in c["argv"]
    ]
    assert ensure, "ensure_database was not run for the worktree"
    assert Path(ensure[0]["cwd"]).resolve() == tree.resolve()


def test_l6_a_local_branch_at_another_sha_is_an_error_and_creates_nothing(launcher: Launcher) -> None:
    launcher.git(launcher.main, "branch", "f-ok", launcher.c0)
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 1, show(done)
    assert first_line(done).startswith("ERROR "), show(done)
    assert "f-ok" in first_line(done)
    assert not launcher.worktree("t901").exists()
    assert launcher.bg_calls() == []


# L7
def test_l7_a_carried_branch_gets_origin_main_merged_first_as_a_recorded_merge_commit(
    launcher: Launcher,
) -> None:
    done = launcher.local("t902", "f-carried")
    assert done.returncode == 0, show(done)
    tree = launcher.worktree("t902")
    head = launcher.git(tree, "rev-parse", "HEAD")
    parents = launcher.git(tree, "rev-list", "--parents", "-n", "1", "HEAD").split()[1:]
    assert parents == [launcher.origin_tip("f-carried"), launcher.origin_tip("main")]
    assert (tree / ".claude" / "agents" / "builder.md").is_file()
    record = json.loads((launcher.factory / "launches" / f"t902-{RECORD_STEM}.json").read_text())
    assert record["carried_merge_sha"] == head

    done = launcher.local("t903", "f-ok")
    assert done.returncode == 0, show(done)
    assert launcher.git(launcher.worktree("t903"), "rev-parse", "HEAD") == launcher.origin_tip("f-ok")
    record = json.loads((launcher.factory / "launches" / f"t903-{RECORD_STEM}.json").read_text())
    assert record["carried_merge_sha"] is None


# L8
def test_l8_a_conflicting_carried_merge_is_refused_aborted_and_its_worktree_removed(
    launcher: Launcher,
) -> None:
    done = launcher.local("t904", "f-conflict")
    assert done.returncode == 2, show(done)
    assert first_line(done).startswith("REFUSED merge-conflict: "), show(done)
    assert not launcher.worktree("t904").exists()
    listed = launcher.git(launcher.main, "worktree", "list", "--porcelain")
    assert str(launcher.worktree("t904")) not in listed
    assert launcher.bg_calls() == []


# L9
def test_l9_a_second_live_session_with_the_same_name_is_refused(launcher: Launcher) -> None:
    row = {
        "id": "ae575c11",
        "cwd": "/elsewhere",
        "kind": "background",
        "startedAt": "2026-10-04T20:00:00Z",
        "sessionId": "0b5e2c71-9a3d-4e6f-8b1c-2d4e6f8a0b1c",
        "name": "t901-builder",
        "state": "working",
        "pid": 777,
    }
    launcher.seams["agents"].write_text(json.dumps([row]))
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 2, show(done)
    assert first_line(done).startswith("REFUSED duplicate-name: "), show(done)
    assert not launcher.worktree("t901").exists()
    assert launcher.bg_calls() == []

    finished = {key: value for key, value in row.items() if key != "pid"} | {"state": "done"}
    launcher.seams["agents"].write_text(json.dumps([finished]))
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 0, show(done)


# L10
def test_l10_the_launch_record_holds_every_contract_field_and_an_agents_snapshot(
    launcher: Launcher,
) -> None:
    done = launcher.local("t901", "f-ok", "--budget-minutes", "150")
    assert done.returncode == 0, show(done)
    sid = session_id("t901-builder")
    assert first_line(done) == f"OK launched t901-builder {sid}"

    launches = launcher.factory / "launches"
    record = json.loads((launches / f"t901-{RECORD_STEM}.json").read_text())
    assert RECORD_KEYS | {"name", "worktree", "carried_merge_sha"} <= set(record)
    assert record["ticket"] == "t901"
    assert record["branch"] == "f-ok"
    assert record["where"] == "local"
    assert record["role"] == "builder"
    assert record["effort"] == "high"
    assert record["model"] == "claude-opus-5-5"
    assert record["budget_minutes"] == 150
    assert record["session_id"] == sid
    assert isinstance(record["cli_version"], str)
    assert record["cli_version"]
    assert record["started_at"] == NOW
    assert isinstance(record["governor"], dict)
    assert record["governor"]["ok"] is True
    assert record["leak_scan"] == {"status": "interim", "line": "local: prompt not scanned"}
    assert record["judge"] is None
    assert record["stop_sent"] is False
    assert record["untestable"] is None
    assert record["review"] is None
    assert record["name"] == "t901-builder"
    assert Path(record["worktree"]).resolve() == launcher.worktree("t901").resolve()
    assert record["carried_merge_sha"] is None
    assert PROMPT not in json.dumps(record), "the record holds the prompt text"

    snapshot = json.loads((launches / f"t901-{RECORD_STEM}.agents.json").read_text())
    assert any(row.get("name") == "t901-builder" for row in snapshot)


# L11
def test_l11_the_builders_budget_record_is_written(launcher: Launcher) -> None:
    done = launcher.local("t901", "f-ok", "--budget-minutes", "150")
    assert done.returncode == 0, show(done)
    budget = json.loads((launcher.main / ".git" / "vextrus" / "budget-t901.json").read_text())
    assert budget["ticket"] == "t901"
    assert budget["minutes"] == 150
    assert budget["started_utc"] == NOW
