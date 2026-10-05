"""Ticket T-LOCAL, section 3 A: the local launcher (`python -m scripts.factory.local`) cleans up after
a refusal, prepares the web's dependencies and guards its database name (launch-cli.md 4 and 5).

- A refused launch leaves no branch it made: a conflicting carried merge, or a failing
  `ensure_database` or `npm ci`, removes the worktree and deletes the branch the launcher created at
  origin's tip; a branch it did not create, or a carried branch whose tip is now the merge commit, is
  kept, and the error names the way out (`git branch -f <b> origin/<b>`). The launcher never resets a
  branch itself.
- A branch with `web/package-lock.json` gets `npm --prefix web ci --no-audit --no-fund`, once, in the
  worktree, after `ensure_database` and before `claude --bg`; a failing `npm ci` refuses the launch.
- The ticket id is the worktree folder and so the database name (`vextrus/settings/db.py`:
  `vextrus_` + slug, cut at 40). A slug over 32 characters is a usage error (64); a ticket whose slug
  another linked worktree already has is an `ERROR` naming `vextrus_<slug>` and that folder, under
  `--dry-run` too.

Black-box, as `test_launch_local.py` (its helper and stubs are copied, never imported). Every stub
appends a monotonically numbered `seq` to its log so the order of calls is comparable. The `uv` stub
exits 1 on `manage.py ensure_database` when a file `fail-ensure` exists beside its log; the `npm` stub
logs its argv and cwd, creates `<cwd>/web/node_modules/.bin/` on `ci`, and exits 1 when `fail-npm`
exists. origin's history is the original's (`f-ok`, `f-carried`, `f-conflict`) plus `f-web`: main
plus `web/package.json` and `web/package-lock.json`.
"""

from __future__ import annotations

import importlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[5]
NOW = "2026-10-04T21:08:00Z"
KB_PER_GB = 1024 * 1024
OLD_DATE = "2026-01-01T00:00:00+0000"
PROMPT = "Follow `.claude/agents/builder.md`. Build ticket t901 on its branch."
NPM_ARGS = ["--prefix", "web", "ci", "--no-audit", "--no-fund"]
USAGE = (
    "Current session: 12% used · resets Oct 5, 12:59am (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)

# Every stub takes the next number from one counter file; the launcher runs its children one at a time.
SEQ = """
import fcntl
def next_seq():
    with open({seq!r}, "a+") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        handle.seek(0)
        number = int(handle.read() or "0") + 1
        handle.seek(0)
        handle.truncate()
        handle.write(str(number))
    return number
"""

CLAUDE_STUB = """
import json, os, sys, uuid
args = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps({{"argv": args, "cwd": os.getcwd(), "env": dict(os.environ),
                          "seq": next_seq()}}) + "\\n")
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
    log.write(json.dumps({{"argv": args, "cwd": os.getcwd(), "seq": next_seq()}}) + "\\n")
if args[:1] == ["run"]:
    rest = [a for a in args[1:] if not a.startswith("-")]
    if "manage.py" in rest:
        if "ensure_database" in rest and os.path.exists({fail_ensure!r}):
            print("could not create the database", file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    if rest and rest[0] in ("python", "python3"):
        at = args.index(rest[0])
        os.execv(sys.executable, [sys.executable, *args[at + 1:]])
sys.exit(0)
"""

NPM_STUB = """
import json, os, sys
args = sys.argv[1:]
with open({log!r}, "a") as log:
    log.write(json.dumps({{"argv": args, "cwd": os.getcwd(), "seq": next_seq()}}) + "\\n")
if os.path.exists({fail_npm!r}):
    print("npm error code ECONNRESET", file=sys.stderr)
    sys.exit(1)
if "ci" in args:
    os.makedirs(os.path.join(os.getcwd(), "web", "node_modules", ".bin"), exist_ok=True)
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
        self.fail_ensure = self.calls / "fail-ensure"
        self.fail_npm = self.calls / "fail-npm"
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
        seq = SEQ.format(seq=str(self.calls / "seq"))
        for name, body in (("claude", CLAUDE_STUB), ("uv", UV_STUB), ("npm", NPM_STUB)):
            path = self.stubs / name
            text = body.format(
                log=str(self.calls / name),
                agents=str(self.seams["agents"]),
                fail_ensure=str(self.fail_ensure),
                fail_npm=str(self.fail_npm),
            )
            path.write_text(f"#!{sys.executable}\n{seq}\n{text}")
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
        done = self.git_run(cwd, *args)
        assert done.returncode == 0, f"git {args}: {done.stderr}"
        return done.stdout.strip()

    def git_run(self, cwd: Path, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args], cwd=cwd, env=self.git_env(), capture_output=True, text=True, check=False
        )

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
        self.git(self.seed, "checkout", "-q", "-b", "f-web", self.main_sha)
        self.commit(
            {
                "web/package.json": '{"name": "web", "private": true}\n',
                "web/package-lock.json": '{"name": "web", "lockfileVersion": 3, "packages": {}}\n',
            },
            "web work",
        )
        self.git(self.seed, "checkout", "-q", "main")
        self.git(self.tmp, "clone", "-q", "--bare", str(self.seed), str(self.origin))
        self.git(self.tmp, "clone", "-q", str(self.origin), str(self.main))

    def push_clean_tip(self, branch: str) -> str:
        """Moves origin's `branch` to main plus one commit (a tip that needs no merge)."""
        self.git(self.seed, "checkout", "-q", "-B", branch, self.main_sha)
        sha = self.commit({"fixed.txt": "fixed\n"}, f"{branch}: rebuilt on main")
        self.git(self.seed, "push", "-q", "--force", str(self.origin), f"{branch}:{branch}")
        self.git(self.seed, "checkout", "-q", "main")
        return sha

    def origin_tip(self, branch: str) -> str:
        return self.git(self.main, "ls-remote", "origin", f"refs/heads/{branch}").split()[0]

    def local_branch(self, branch: str) -> str | None:
        done = self.git_run(self.main, "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}")
        return done.stdout.strip() if done.returncode == 0 else None

    def worktree(self, ticket: str) -> Path:
        return self.main / ".claude" / "worktrees" / ticket

    def listed_worktrees(self) -> str:
        return self.git(self.main, "worktree", "list", "--porcelain")

    def env(self) -> dict[str, str]:
        env = {k: v for k, v in self.git_env().items() if not k.startswith("VEXTRUS_")}
        for key in ("CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_PLUGIN_DIRS"):
            env.pop(key, None)
        env.pop("CLAUDE_PROJECT_DIR", None)
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
        self, ticket: str = "t901", branch: str = "f-ok", *extra: str
    ) -> subprocess.CompletedProcess[str]:
        args = [
            "--ticket",
            ticket,
            "--branch",
            branch,
            "--effort",
            "high",
            "--name",
            f"{ticket}-builder",
            "--prompt-file",
            str(self.prompt),
            *extra,
        ]
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.local", *args],
            cwd=self.main,
            env=self.env(),
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

    def ensure_calls(self) -> list[dict[str, Any]]:
        return [
            call
            for call in self.calls_of("uv")
            if "manage.py" in call["argv"] and "ensure_database" in call["argv"]
        ]

    def records(self) -> list[Path]:
        folder = self.factory / "launches"
        return sorted(folder.iterdir()) if folder.is_dir() else []


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


def first_line(done: subprocess.CompletedProcess[str]) -> str:
    return done.stdout.splitlines()[0] if done.stdout.strip() else ""


def database_slug_of(ticket: str) -> str:
    """The rule of `vextrus/settings/db.py:44`, restated so the test does not lean on the launcher."""
    return re.sub(r"[^a-z0-9]+", "_", ticket.lower()).strip("_")


@pytest.fixture
def launcher(tmp_path: Path) -> Launcher:
    return Launcher(tmp_path)


# A1
def test_a1_a_conflict_refusal_leaves_no_branch_and_the_relaunch_works(launcher: Launcher) -> None:
    done = launcher.local("t904", "f-conflict")
    assert done.returncode == 2, show(done)
    assert first_line(done).startswith("REFUSED merge-conflict"), show(done)
    assert launcher.local_branch("f-conflict") is None, "the refused launch left its branch behind"

    fixed = launcher.push_clean_tip("f-conflict")
    done = launcher.local("t904", "f-conflict")
    assert done.returncode == 0, show(done)
    assert first_line(done).startswith("OK launched "), show(done)
    assert launcher.git(launcher.worktree("t904"), "rev-parse", "HEAD") == fixed


# A2
def test_a2_a_branch_the_launcher_did_not_create_is_never_deleted(launcher: Launcher) -> None:
    tip = launcher.origin_tip("f-conflict")
    launcher.git(launcher.main, "branch", "f-conflict", tip)
    done = launcher.local("t904", "f-conflict")
    assert done.returncode == 2, show(done)
    assert first_line(done).startswith("REFUSED merge-conflict"), show(done)
    assert launcher.local_branch("f-conflict") == tip


# A3
def test_a3_the_other_sha_error_names_the_way_out_and_still_resets_nothing(
    launcher: Launcher,
) -> None:
    launcher.git(launcher.main, "branch", "f-ok", launcher.c0)
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 1, show(done)
    assert first_line(done).startswith("ERROR "), show(done)
    assert "git branch -f f-ok origin/f-ok" in first_line(done), show(done)
    assert launcher.local_branch("f-ok") == launcher.c0, "the launcher reset the branch itself"
    assert not launcher.worktree("t901").exists()
    assert launcher.bg_calls() == []


# A4
def test_a4_a_failing_ensure_database_undoes_the_launch_and_the_relaunch_works(
    launcher: Launcher,
) -> None:
    launcher.fail_ensure.write_text("")
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 1, show(done)
    assert first_line(done).startswith("ERROR "), show(done)
    assert launcher.ensure_calls(), "ensure_database was not run"
    tree = launcher.worktree("t901")
    assert not tree.exists(), "the worktree stayed"
    assert str(tree) not in launcher.listed_worktrees()
    assert launcher.local_branch("f-ok") is None, "the branch the launcher made stayed"
    assert launcher.bg_calls() == []
    assert launcher.records() == [], "a refused launch wrote a launch record"

    launcher.fail_ensure.unlink()
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 0, show(done)
    assert first_line(done).startswith("OK launched "), show(done)


def test_a4_a_carried_branch_keeps_its_merge_commit_and_the_error_names_git_branch_f(
    launcher: Launcher,
) -> None:
    launcher.fail_ensure.write_text("")
    done = launcher.local("t902", "f-carried")
    assert done.returncode == 1, show(done)
    line = first_line(done)
    assert line.startswith("ERROR "), show(done)
    assert "git branch -f f-carried origin/f-carried" in line, show(done)
    tree = launcher.worktree("t902")
    assert not tree.exists(), "the worktree stayed"
    assert str(tree) not in launcher.listed_worktrees()
    kept = launcher.local_branch("f-carried")
    assert kept is not None, "the carried branch, holding its merge commit, was deleted"
    assert kept != launcher.origin_tip("f-carried")
    assert launcher.bg_calls() == []


# A5
def test_a5_npm_ci_runs_once_for_a_web_branch_after_the_database_and_before_the_builder(
    launcher: Launcher,
) -> None:
    done = launcher.local("t905", "f-web")
    assert done.returncode == 0, show(done)
    tree = launcher.worktree("t905")
    [npm] = launcher.calls_of("npm")
    assert npm["argv"] == NPM_ARGS
    assert Path(npm["cwd"]).resolve() == tree.resolve()
    [ensure] = launcher.ensure_calls()
    [bg] = launcher.bg_calls()
    assert ensure["seq"] < npm["seq"] < bg["seq"], (ensure["seq"], npm["seq"], bg["seq"])


def test_a5_a_branch_without_a_web_lockfile_makes_no_npm_call(launcher: Launcher) -> None:
    done = launcher.local("t901", "f-ok")
    assert done.returncode == 0, show(done)
    assert launcher.calls_of("npm") == []


# A6
def test_a6_a_failing_npm_ci_refuses_before_the_builder_starts(launcher: Launcher) -> None:
    launcher.fail_npm.write_text("")
    done = launcher.local("t905", "f-web")
    assert done.returncode == 1, show(done)
    line = first_line(done)
    assert line.startswith("ERROR "), show(done)
    assert "npm" in line, show(done)
    assert launcher.calls_of("npm"), "npm was not run"
    assert launcher.bg_calls() == []
    tree = launcher.worktree("t905")
    assert not tree.exists(), "the worktree stayed"
    assert str(tree) not in launcher.listed_worktrees()

    launcher.fail_npm.unlink()
    done = launcher.local("t905", "f-web")
    assert done.returncode == 0, show(done)
    assert first_line(done).startswith("OK launched "), show(done)


# A7 (a)
@pytest.mark.parametrize("ticket", ["m3-inc-314-golden-lane-a3-takeoff-engine-x", "._."])
def test_a7_a_ticket_whose_database_slug_is_over_32_or_empty_is_a_usage_error(
    launcher: Launcher, ticket: str
) -> None:
    for extra in ([], ["--dry-run"]):
        done = launcher.local(ticket, "f-ok", *extra)
        assert done.returncode == 64, show(done)
    assert not (launcher.main / ".claude" / "worktrees").exists()
    assert launcher.calls_of("claude") == []
    assert launcher.calls_of("uv") == []
    assert launcher.records() == []


def test_a7_a_ticket_whose_slug_is_exactly_32_characters_still_launches(launcher: Launcher) -> None:
    ticket = "t" + "-x" * 15 + "1"
    assert len(database_slug_of(ticket)) == 32
    done = launcher.local(ticket, "f-ok")
    assert done.returncode == 0, show(done)


# A7 (b), (c)
@pytest.mark.parametrize("extra", [[], ["--dry-run"]], ids=["launch", "dry-run"])
def test_a7_a_ticket_whose_slug_another_worktree_has_is_refused(
    launcher: Launcher, extra: list[str]
) -> None:
    done = launcher.local("t-1", "f-ok")
    assert done.returncode == 0, show(done)

    done = launcher.local("T.1", "f-carried", *extra)
    assert done.returncode == 1, show(done)
    line = first_line(done)
    assert line.startswith("ERROR "), show(done)
    assert "vextrus_t_1" in line, show(done)
    assert "t-1" in line, show(done)
    assert not launcher.worktree("T.1").exists()
    assert len(launcher.bg_calls()) == 1, "a second builder was started on the same database"
    assert len(launcher.ensure_calls()) == 1
    if extra:
        assert "{" not in done.stdout, "the dry run printed a plan for a refused launch"


# A8
SAMPLE_IDS = [
    "T-1",
    "T.1",
    "T_1",
    "t901",
    "T-LOCAL",
    "s12-p6-local",
    "m3.inc-314",
    "A--b..c__d",
    "x" * 41,
    "m3-inc-314-golden-lane-a3-takeoff-engine-x",
]


@pytest.mark.parametrize("ticket", SAMPLE_IDS)
def test_a8_the_launchers_slug_rule_is_the_database_settings_rule(tmp_path: Path, ticket: str) -> None:
    from vextrus.settings.db import worktree_database_name

    launcher = importlib.import_module("scripts.factory.local")  # its `database_slug` is T-LOCAL's seam

    checkout = tmp_path / ticket
    checkout.mkdir()
    (checkout / ".git").write_text("gitdir: /elsewhere/.git/worktrees/x\n")  # a linked worktree's shape
    name = worktree_database_name(checkout)
    slug = launcher.database_slug(ticket)
    assert name == f"vextrus_{slug}"[:40]
    assert name.removeprefix("vextrus_") == slug[:32]
