"""Ticket f3, 3.3: the watcher (`python -m scripts.factory.watch run --once | ensure`), spec 2.2 "Watch".

Black-box. Git is real: each test builds a bare `origin`, a `work` clone it pushes from, and a `main`
clone that is the watcher's current directory and main checkout (the watcher runs git in the current
directory's repository). `VEXTRUS_FACTORY_DIR` is `main/.private/work/factory`, so the ledger folder is
`<factory>/ledger/`, the walks are `main/.private/work/walks/<sha40>/verdict.json` and the pidfiles
`<factory>/{watch,g1,rd}.pid`. Ticket branches come from the launch records
`<factory>/launches/<ticket>-<utc>.json` (launch-cli.md 5; the watcher reads `started_at`). Every reading
has a seam: `VEXTRUS_NOW`, `VEXTRUS_MEMINFO_FILE`, `VEXTRUS_DF_FILE`, `VEXTRUS_USAGE_FILE`,
`VEXTRUS_AGENTS_FILE`, `VEXTRUS_PRS_FILE`, `VEXTRUS_LEAKSCAN_CMD` and `VEXTRUS_JEV_CMD` (stubs shaped by
leakscan-cli.md and jev-cli.md, run as `<cmd> range origin/main..<head> --no-stamp` and `<cmd>
models-check`). `claude` and `gh` stubs first on `PATH` record every call; `GIT_ALLOW_PROTOCOL=file`
keeps git off the network.

Events: one line `<UTC> <KIND> <ticket|-> <detail...>` per change in `<factory>/events.log`; alarm kinds
are status.schema.json's `alarms[].code` enum. State persists in `<factory>/watch-state.json`; usage
readings append a line to `<factory>/usage.log`. Commits carry a fixed old date, so only the watcher's
own view of a push (VEXTRUS_NOW when it saw the tip change) can time a builder.

W15 reads the committed commit-message fixtures `scripts/factory/tests/fixtures/trailers/<case>.txt`
(trailers.md 4: only f3 commits them; the builder writes them, these tests pin their trailers and
outcomes). In a fixture, `@TREE@` stands for the tree of the commit the message is put on and
`@OTHER_TREE@` for another tree. `older-commit-only.txt` is the parent's message; its tip carries
`none.txt`.
"""

from __future__ import annotations

import json
import os
import re
import select
import signal
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

REPO = Path(__file__).resolve().parents[4]
CONTRACTS = REPO / "docs" / "specs" / "factory" / "contracts"
TRAILER_FIXTURES = REPO / "scripts" / "factory" / "tests" / "fixtures" / "trailers"
NOW = "2026-10-04T21:08:00Z"
KB_PER_GB = 1024 * 1024
OLD_DATE = "2026-01-01T00:00:00+0000"
TRAILER_KINDS = {"READY", "BLOCKED", "READY-NO-VERIFY"}
DROPPED = {"CLAUDE_PROJECT_DIR", "CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS", "CLAUDE_CODE_PLUGIN_DIRS"}
USAGE = (
    "Current session: 12% used · resets Oct 5, 12:59am (Asia/Dhaka)\n"
    "Current week (all models): 27% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
    "Current week (Fable): 0% used · resets Oct 9, 2:59pm (Asia/Dhaka)\n"
)
SECRET = "ZEBRA-PLANK-7731-QUARTZ-LINTEL"


def meminfo(avail_gb: float, swap_used_gb: float) -> str:
    def kb(gb: float) -> int:
        return int(gb * KB_PER_GB)

    return (
        f"MemTotal:       {kb(27)} kB\nMemFree:        {kb(1)} kB\nMemAvailable:   {kb(avail_gb)} kB\n"
        f"SwapTotal:      {kb(8)} kB\nSwapFree:       {kb(8 - swap_used_gb)} kB\n"
    )


def ready(tree: str) -> str:
    return f"feat: the thing\n\nBody.\n\nFactory-State: READY\nFactory-Verify: {tree} ok\n"


def plain(_tree: str) -> str:
    return "wip: more of the thing\n\nNo trailer here.\n"


def blocked(reason: str) -> Callable[[str], str]:
    return lambda _tree: f"fix: stop\n\nFactory-State: BLOCKED\nFactory-Reason: {reason}\n"


def stub(path: Path, body: str) -> Path:
    path.write_text(f"#!{sys.executable}\nimport json, os, sys\n{body}")
    path.chmod(0o755)
    return path


class World:
    """origin, a pushing clone, the watcher's main checkout, its run folder and its seams."""

    def __init__(self, tmp: Path) -> None:
        self.tmp = tmp
        self.origin = tmp / "origin.git"
        self.work = tmp / "work"
        self.main = tmp / "main"
        self.factory = self.main / ".private" / "work" / "factory"
        self.stubs = tmp / "stubs"
        self.stubs.mkdir()
        self.gitconfig = tmp / "gitconfig"
        self.gitconfig.write_text(
            "[user]\n\tname = t\n\temail = t@example.invalid\n[init]\n\tdefaultBranch = main\n"
            "[commit]\n\tgpgsign = false\n"
        )
        self.counter = 0
        self.work.mkdir()
        self.git(self.work, "init", "-q", "-b", "main")
        (self.work / "README").write_text("seed\n")
        self.git(self.work, "add", "README")
        self.git(self.work, "commit", "-q", "-m", "seed")
        self.git(tmp, "clone", "-q", "--bare", str(self.work), str(self.origin))
        self.git(self.work, "remote", "add", "origin", str(self.origin))
        self.git(tmp, "clone", "-q", str(self.origin), str(self.main))
        self.factory.mkdir(parents=True)
        (self.factory / "launches").mkdir()

        self.calls = tmp / "calls"
        self.calls.mkdir()
        record = "open(os.path.join({d!r}, {n!r}), 'a').write(json.dumps(sys.argv[1:]) + '\\n')\n"
        stub(self.stubs / "claude", record.format(d=str(self.calls), n="claude") + "sys.exit(1)\n")
        stub(self.stubs / "gh", record.format(d=str(self.calls), n="gh") + "print('[]')\n")
        self.leak_clean = stub(
            tmp / "leak-clean",
            record.format(d=str(self.calls), n="leakscan")
            + "print('leakscan: hits=0 scanned=7 corpus=0123456789ab')\n",
        )
        self.leak_hit = stub(
            tmp / "leak-hit",
            record.format(d=str(self.calls), n="leakscan")
            + "print('HIT src/a.py:3 2')\n"
            + "print('leakscan: hits=2 scanned=7 corpus=0123456789ab')\nsys.exit(1)\n",
        )
        self.jev_ok = stub(
            tmp / "jev-ok",
            record.format(d=str(self.calls), n="jev") + "print('jev-model ok jev-1.13.0')\n",
        )
        self.jev_moved = stub(
            tmp / "jev-moved",
            record.format(d=str(self.calls), n="jev")
            + "print('JEV-MODEL-MOVED jev-1.13.0 -> jev-1.14.0')\n"
            "sys.exit(1)\n",
        )
        self.seams = {name: tmp / f"{name}.txt" for name in ("meminfo", "df", "usage", "agents", "prs")}
        self.reading(mem=16, swap=0.2, disk=60)
        self.seams["usage"].write_text(USAGE)
        self.seams["agents"].write_text("[]")
        self.seams["prs"].write_text("[]")
        self.leakscan_cmd = str(self.leak_clean)
        self.jev_cmd = str(self.jev_ok)
        self.extra_env: dict[str, str | None] = {}

    # --- git
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

    def tip(self, branch: str) -> str | None:
        out = self.git(self.work, "ls-remote", "origin", f"refs/heads/{branch}")
        return out.split()[0] if out else None

    def push(self, branch: str, message: Callable[[str], str], parent: str | None = None) -> str:
        """A new commit with unique content on `parent` (default: the branch's tip, else main's)."""
        self.counter += 1
        changed = self.work / f"change-{self.counter}.txt"
        changed.write_text(f"change {self.counter}\n")
        self.git(self.work, "add", changed.name)
        tree = self.git(self.work, "write-tree")
        parent = parent or self.tip(branch) or self.tip("main")
        assert parent
        text = self.tmp / "message.txt"
        text.write_text(message(tree))
        sha = self.git(self.work, "commit-tree", tree, "-p", parent, "-F", str(text))
        self.git(self.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
        return sha

    def tree_of(self, sha: str) -> str:
        return self.git(self.work, "rev-parse", f"{sha}^{{tree}}")

    # --- records and readings
    def launch(
        self,
        ticket: str,
        branch: str,
        *,
        where: str = "cloud",
        started_at: str = NOW,
        budget_minutes: int | None = None,
        name: str | None = None,
    ) -> None:
        record: dict[str, Any] = {
            "ticket": ticket,
            "branch": branch,
            "where": where,
            "role": "builder",
            "effort": "high",
            "model": "claude-opus-5-5",
            "budget_minutes": budget_minutes,
            "session_id": "session_01Example" + ticket if where == "cloud" else None,
            "cli_version": "2.1.999",
            "started_at": started_at,
            "governor": {"unit": "cloud-session", "ok": True},
            "leak_scan": {"status": "interim", "line": "test"},
            "judge": {"ok": True, "code": "ok", "reason": "cloned"} if where == "cloud" else None,
            "stop_sent": False,
            "untestable": None,
            "review": None,
        }
        if where == "local":
            record.update(name=name, worktree=str(self.main / ".claude" / "worktrees" / ticket))
            record["session_id"] = "5f0c3a52-1b2d-4e3f-8a9b-00000000000" + str(len(ticket) % 10)
            record["carried_merge_sha"] = None
        stamp = started_at.replace("-", "").replace(":", "")
        (self.factory / "launches" / f"{ticket}-{stamp}.json").write_text(json.dumps(record))

    def reading(self, *, mem: float, swap: float, disk: float) -> None:
        self.seams["meminfo"].write_text(meminfo(mem, swap))
        self.seams["df"].write_text(f"    Avail\n{int(disk * KB_PER_GB)}\n")

    def env(self, now: str) -> dict[str, str]:
        env = {
            k: v for k, v in self.git_env().items() if not k.startswith("VEXTRUS_") and k not in DROPPED
        }
        env.update(
            PATH=f"{self.stubs}{os.pathsep}{env.get('PATH', '')}",
            PYTHONPATH=str(REPO),
            VEXTRUS_NOW=now,
            VEXTRUS_FACTORY_DIR=str(self.factory),
            VEXTRUS_MEMINFO_FILE=str(self.seams["meminfo"]),
            VEXTRUS_DF_FILE=str(self.seams["df"]),
            VEXTRUS_USAGE_FILE=str(self.seams["usage"]),
            VEXTRUS_AGENTS_FILE=str(self.seams["agents"]),
            VEXTRUS_PRS_FILE=str(self.seams["prs"]),
            VEXTRUS_LEAKSCAN_CMD=self.leakscan_cmd,
            VEXTRUS_JEV_CMD=self.jev_cmd,
        )
        for key, value in self.extra_env.items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        return env

    def watch(self, *args: str, now: str = NOW, timeout: int = 120) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, "-m", "scripts.factory.watch", *args],
            cwd=self.main,
            env=self.env(now),
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=timeout,
            check=False,
        )

    def once(self, now: str = NOW) -> subprocess.CompletedProcess[str]:
        done = self.watch("run", "--once", now=now)
        assert done.returncode == 0, show(done)
        return done

    # --- outputs
    def lines(self) -> list[str]:
        log = self.factory / "events.log"
        return log.read_text().splitlines() if log.exists() else []

    def events(self, kind: str, subject: str | None = None) -> list[str]:
        found = []
        for line in self.lines():
            parts = line.split(" ", 3)
            assert len(parts) >= 3, f"an events.log line is not `<UTC> <KIND> <ticket|-> ...`: {line!r}"
            assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", parts[0]), line
            if parts[1] == kind and (subject is None or parts[2] == subject):
                found.append(line)
        return found

    def status(self) -> dict[str, Any]:
        loaded: dict[str, Any] = json.loads((self.factory / "status.json").read_text())
        return loaded

    def calls_of(self, name: str) -> list[list[str]]:
        log = self.calls / name
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []


def show(done: subprocess.CompletedProcess[str]) -> str:
    return f"exit {done.returncode}\n--- stdout\n{done.stdout}\n--- stderr\n{done.stderr}"


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path)


# --- a small structural JSON-schema check (the keywords status.schema.json uses)
def violations(value: Any, schema: dict[str, Any], root: dict[str, Any], at: str = "$") -> list[str]:
    if "$ref" in schema:
        target: Any = root
        for part in schema["$ref"].removeprefix("#/").split("/"):
            target = target[part]
        return violations(value, target, root, at)
    found: list[str] = []
    if "oneOf" in schema:
        matching = [s for s in schema["oneOf"] if not violations(value, s, root, at)]
        if len(matching) != 1:
            found.append(f"{at}: matches {len(matching)} of oneOf")
    if "const" in schema and value != schema["const"]:
        found.append(f"{at}: {value!r} is not {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        found.append(f"{at}: {value!r} not in {schema['enum']}")
    if "type" in schema:
        kinds = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        checks = {
            "object": lambda v: isinstance(v, dict),
            "array": lambda v: isinstance(v, list),
            "string": lambda v: isinstance(v, str),
            "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
            "number": lambda v: isinstance(v, int | float) and not isinstance(v, bool),
            "boolean": lambda v: isinstance(v, bool),
            "null": lambda v: v is None,
        }
        if not any(checks[k](value) for k in kinds):
            return [*found, f"{at}: {value!r} is not {kinds}"]
    if isinstance(value, dict):
        for key in schema.get("required", []):
            if key not in value:
                found.append(f"{at}: missing {key}")
        props = schema.get("properties", {})
        for key, item in value.items():
            if key in props:
                found += violations(item, props[key], root, f"{at}.{key}")
            elif schema.get("additionalProperties") is False:
                found.append(f"{at}: {key} is not in the schema")
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            found += violations(item, schema["items"], root, f"{at}[{i}]")
    if isinstance(value, int | float) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            found.append(f"{at}: {value} < {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            found.append(f"{at}: {value} > {schema['maximum']}")
    if isinstance(value, str):
        if "pattern" in schema and not re.search(schema["pattern"], value):
            found.append(f"{at}: {value!r} does not match {schema['pattern']}")
        if len(value) > schema.get("maxLength", len(value)) or len(value) < schema.get("minLength", 0):
            found.append(f"{at}: length {len(value)} out of bounds")
    return found


# W1
def test_w1_a_ready_trailer_raises_one_ready_event_and_a_new_blocked_head_one_blocked(
    world: World,
) -> None:
    world.launch("t1", "t1-branch")
    head = world.push("t1-branch", ready)
    world.once()
    assert len(world.events("READY", "t1")) == 1, world.lines()
    assert head[:8] in world.events("READY", "t1")[0]

    before = world.lines()
    world.once()
    assert world.lines() == before, "a second pass over the same heads added a line"

    world.push("t1-branch", blocked("the spec names no exit code for the refusal"))
    world.once()
    events = world.events("BLOCKED", "t1")
    assert len(events) == 1, world.lines()
    assert "the spec names no exit code for the refusal" in events[0]
    assert len(world.events("READY", "t1")) == 1


# W2
def test_w2_ready_heads_fire_once_across_restarts_and_while_the_watcher_was_down(world: World) -> None:
    world.launch("t2a", "t2a-branch")
    world.push("t2a-branch", ready)
    world.launch("t2b", "t2b-branch")
    world.push("t2b-branch", plain)

    assert not (world.factory / "watch-state.json").exists()
    world.once()
    assert len(world.events("READY", "t2a")) == 1, "a READY head present at the first run did not fire"
    assert (world.factory / "watch-state.json").exists()

    world.once()  # a restarted watcher: the state file is there, the head is the same
    assert len(world.events("READY", "t2a")) == 1

    head = world.push("t2b-branch", ready)  # pushed while no watcher ran
    world.once()
    events = world.events("READY", "t2b")
    assert len(events) == 1, world.lines()
    assert head[:8] in events[0]


# W3
def test_w3_ready_without_a_matching_verify_tree_raises_ready_no_verify_once_per_head(
    world: World,
) -> None:
    world.launch("t3a", "t3a-branch")
    world.push("t3a-branch", lambda _tree: "feat: x\n\nFactory-State: READY\n")
    world.launch("t3b", "t3b-branch")
    base = world.push("t3b-branch", plain)
    other_tree = world.tree_of(base)
    world.push(
        "t3b-branch", lambda _tree: f"feat: y\n\nFactory-State: READY\nFactory-Verify: {other_tree} ok\n"
    )

    world.once()
    world.once()
    for ticket in ("t3a", "t3b"):
        assert len(world.events("READY-NO-VERIFY", ticket)) == 1, world.lines()
        assert world.events("READY", ticket) == []


# W4
def test_w4_a_cloud_builder_quiet_for_30_minutes_alarms_once_and_a_push_resets_it(world: World) -> None:
    world.launch("t4", "t4-branch", started_at="2026-10-04T20:00:00Z")
    world.push("t4-branch", plain)
    world.once("2026-10-04T20:01:00Z")
    assert world.events("BUILDER-QUIET") == []

    world.once("2026-10-04T20:33:00Z")
    assert len(world.events("BUILDER-QUIET", "t4")) == 1, world.lines()
    alarms = world.status()["alarms"]
    assert any(a["code"] == "BUILDER-QUIET" and a["subject"] == "t4" for a in alarms), alarms
    world.once("2026-10-04T20:34:00Z")
    assert len(world.events("BUILDER-QUIET", "t4")) == 1

    world.push("t4-branch", plain)  # a push is a heartbeat
    world.once("2026-10-04T20:35:00Z")
    assert not any(a["code"] == "BUILDER-QUIET" for a in world.status()["alarms"])
    world.once("2026-10-04T21:03:00Z")
    assert len(world.events("BUILDER-QUIET", "t4")) == 1
    world.once("2026-10-04T21:07:00Z")
    assert len(world.events("BUILDER-QUIET", "t4")) == 2, world.lines()


def test_w4_a_ready_head_waiting_10_minutes_alarms_ready_waiting_once(world: World) -> None:
    world.launch("t5", "t5-branch", started_at="2026-10-04T20:00:00Z")
    world.push("t5-branch", ready)
    world.once("2026-10-04T20:01:00Z")
    assert len(world.events("READY", "t5")) == 1
    assert world.events("READY-WAITING") == []
    world.once("2026-10-04T20:12:00Z")
    assert len(world.events("READY-WAITING", "t5")) == 1, world.lines()
    world.once("2026-10-04T20:13:00Z")
    assert len(world.events("READY-WAITING", "t5")) == 1


# W5
def test_w5_a_new_claude_branch_on_origin_alarms_and_the_first_pass_is_the_baseline(
    world: World,
) -> None:
    world.push("claude/older-session-abc", plain)
    world.once()
    assert world.events("NEW-CLAUDE-BRANCH") == []

    world.push("claude/new-session-xyz", plain)
    world.once()
    events = world.events("NEW-CLAUDE-BRANCH")
    assert len(events) == 1, world.lines()
    assert "claude/new-session-xyz" in events[0]
    world.once()
    assert len(world.events("NEW-CLAUDE-BRANCH")) == 1


# W6
def test_w6_a_passed_budget_alarms_once_and_never_for_a_ready_or_blocked_ticket(world: World) -> None:
    for ticket, message in (("t6", plain), ("t7", ready), ("t8", blocked("waiting on a ruling"))):
        world.launch(ticket, f"{ticket}-branch", started_at="2026-10-04T20:00:00Z", budget_minutes=10)
        world.push(f"{ticket}-branch", message)
    world.once("2026-10-04T20:01:00Z")
    assert world.events("BUDGET-PASSED") == []
    world.once("2026-10-04T20:11:00Z")
    world.once("2026-10-04T20:12:00Z")
    assert len(world.events("BUDGET-PASSED", "t6")) == 1, world.lines()
    assert world.events("BUDGET-PASSED", "t7") == []
    assert world.events("BUDGET-PASSED", "t8") == []


# W7
@pytest.mark.parametrize(
    ("state", "waiting", "alarms"),
    [("blocked", "permission prompt", 1), ("blocked", None, 1), ("done", None, 0)],
)
def test_w7_a_local_builder_whose_agents_row_is_blocked_alarms(
    world: World, state: str, waiting: str | None, alarms: int
) -> None:
    world.launch("t9", "t9-branch", where="local", name="t9-local")
    world.push("t9-branch", plain)
    row: dict[str, Any] = {
        "id": "ae575c11",
        "cwd": str(world.main / ".claude" / "worktrees" / "t9"),
        "kind": "background",
        "startedAt": "2026-10-04T20:00:00Z",
        "sessionId": "5f0c3a52-1b2d-4e3f-8a9b-000000000009",
        "name": "t9-local",
        "state": state,
    }
    if state != "done":
        row["pid"] = 4242
    if waiting is not None:
        row["waitingFor"] = waiting
    world.seams["agents"].write_text(json.dumps([row]))
    world.once()
    world.once()
    assert len(world.events("BUILDER-BLOCKED", "t9")) == alarms, world.lines()


# W8
@pytest.mark.parametrize(
    ("floor", "bad"),
    [("mem", {"mem": 3.0}), ("swap", {"swap": 3.5}), ("disk", {"disk": 20.0})],
)
def test_w8_a_floor_crossing_is_one_event_each_time_it_is_crossed(
    world: World, floor: str, bad: dict[str, float]
) -> None:
    good = {"mem": 16.0, "swap": 0.2, "disk": 60.0}
    for reading, count in (
        (good, 0),
        ({**good, **bad}, 1),
        ({**good, **bad}, 1),
        (good, 1),
        ({**good, **bad}, 2),
    ):
        world.reading(**reading)
        world.once()
        events = world.events("FLOOR-CROSSED")
        assert len(events) == count, world.lines()
        assert all(re.search(rf"\b{floor}\b", event.split(" ", 2)[2]) for event in events), events


# W9
@pytest.mark.parametrize("scan", ["hit", "clean", "absent"])
def test_w9_a_leak_hit_on_a_cloud_head_alarms_with_place_and_count_and_never_the_text(
    world: World, scan: str
) -> None:
    world.leakscan_cmd = {
        "hit": str(world.leak_hit),
        "clean": str(world.leak_clean),
        "absent": str(world.tmp / "no-such-leakscan"),
    }[scan]
    world.launch("t10", "t10-branch")
    head = world.push("t10-branch", lambda _tree: f"feat: carries {SECRET}\n\nBody {SECRET}.\n")
    world.once()
    world.once()

    events = world.events("LEAK-HIT")
    if scan == "hit":
        assert len(events) == 1, world.lines()
        assert events[0].split(" ", 2)[2].split()[:3] == ["t10", "src/a.py:3", "2"], events
        args = world.calls_of("leakscan")[0]
        assert "range" in args
        assert "--no-stamp" in args
        assert any(arg.endswith(head) for arg in args), args
    else:
        assert events == [], world.lines()
    for written in ("events.log", "status.json"):
        path = world.factory / written
        assert not path.exists() or SECRET not in path.read_text()
    schema = json.loads((CONTRACTS / "status.schema.json").read_text())
    assert violations(world.status(), schema, schema) == []


# W10
def test_w10_status_json_is_written_atomically_by_the_contracts_schema(world: World) -> None:
    world.launch("tc1", "tc1-branch")
    head_tc1 = world.push("tc1-branch", plain)
    world.launch("tc2", "tc2-branch")
    world.push("tc2-branch", ready)
    world.launch("tc3", "tc3-branch")
    world.push("tc3-branch", lambda _tree: "feat: z\n\nFactory-State: READY\n")
    world.launch("tl1", "tl1-branch", where="local", name="tl1-local")
    world.push("tl1-branch", plain)
    world.seams["agents"].write_text(
        json.dumps(
            [
                {
                    "id": "b1c2d3e4",
                    "cwd": "/w/tl1",
                    "kind": "background",
                    "startedAt": "2026-10-04T20:00:00Z",
                    "sessionId": "5f0c3a52-1b2d-4e3f-8a9b-000000000001",
                    "name": "tl1-local",
                    "state": "working",
                    "pid": 4243,
                }
            ]
        )
    )
    other_head = "ab" * 20
    world.seams["prs"].write_text(
        json.dumps(
            [
                {"number": 250, "headRefName": "tc1-branch", "headRefOid": head_tc1, "state": "OPEN"},
                {
                    "number": 251,
                    "headRefName": "other-branch",
                    "headRefOid": other_head,
                    "state": "OPEN",
                },
            ]
        )
    )
    ledger = world.factory / "ledger"
    ledger.mkdir()
    for pr, head, round_, verdict in ((250, head_tc1, 1, "FIX"), (251, other_head, 2, "PASS")):
        (ledger / f"{pr}-{head}.json").write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "pr": pr,
                    "head": head,
                    "round": round_,
                    "verdict": verdict,
                    "counts": {
                        "reviewers": 2,
                        "findings": 1,
                        "findings_ge_50": 0,
                        "confirmed": 0,
                        "refuted": 0,
                        "unproven": 0,
                        "unrefuted_ge_50": 0,
                    },
                    "decision_input_sha256": "0" * 64,
                    "comment_id": 9000 + pr,
                    "exception": None,
                    "source": "review-pr",
                    "recorded_at": "2026-10-04T20:30:00Z",
                }
            )
        )
    walked = "cd" * 20
    walk = world.main / ".private" / "work" / "walks" / walked
    walk.mkdir(parents=True)
    (walk / "verdict.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "sha": walked,
                "ref": "main",
                "started_at": "2026-10-04T19:00:00Z",
                "finished_at": "2026-10-04T20:00:00Z",
                "result": "FAIL",
                "checks": [],
                "burden": [],
                "agent_layer": {
                    "items": [],
                    "findings": [],
                    "blocks": 0,
                    "misleading": 0,
                    "issues_drafted": 0,
                    "dedup_comments": 0,
                },
                "leak_scan": {"hits": 0},
            }
        )
    )
    (world.factory / "session.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "started_utc": "2026-10-04T18:00:00Z",
                "budget_minutes": 660,
                "state_file": str(world.tmp / "STATE.md"),
                "phases": [
                    {"name": "p1", "minutes": 150, "start_utc": "2026-10-04T18:00:00Z"},
                    {"name": "p3", "minutes": 330, "start_utc": "2026-10-04T20:03:00Z"},
                ],
            }
        )
    )
    world.reading(mem=16, swap=0.5, disk=60)

    world.once()
    leftovers = [
        p.name
        for p in world.factory.iterdir()
        if p.name.startswith("status") and p.name != "status.json"
    ]
    assert leftovers == [], "a temporary file was left beside status.json"
    status = world.status()
    schema = json.loads((CONTRACTS / "status.schema.json").read_text())
    assert violations(status, schema, schema) == []
    sample = json.loads((CONTRACTS / "status.sample.json").read_text())
    assert set(status) == set(sample)

    assert status["written_at"] == NOW
    assert isinstance(status["watcher"]["pid"], int)
    assert status["clock"] == {
        "session": {"started_at": "2026-10-04T18:00:00Z", "budget_minutes": 660, "elapsed_minutes": 188},
        "phase": {
            "name": "p3",
            "started_at": "2026-10-04T20:03:00Z",
            "budget_minutes": 330,
            "elapsed_minutes": 65,
        },
    }
    resources = status["resources"]
    assert abs(resources["mem_available_gb"] - 16.0) <= 0.1
    assert abs(resources["swap_used_gb"] - 0.5) <= 0.1
    assert abs(resources["disk_free_gb"] - 60.0) <= 0.1
    assert status["lock"] == {"holder": None, "waiters": []}

    items = {item["ticket"]: item for item in status["builders"]["items"]}
    assert set(items) == {"tc1", "tc2", "tc3", "tl1"}
    assert items["tc1"]["state"] == "working"
    assert items["tc1"]["where"] == "cloud"
    assert items["tc1"]["head"] == head_tc1
    assert items["tc1"]["pr"] == 250
    assert items["tc1"]["quiet_minutes"] == 0
    assert items["tc2"]["state"] == "ready"
    assert items["tl1"]["where"] == "local"
    assert items["tl1"]["state"] == "working"
    assert items["tl1"]["quiet_minutes"] is None
    assert status["builders"]["cloud"]["ready"] == 1
    assert status["builders"]["local"]["working"] == 1

    assert status["reviews"] == [{"pr": 250, "round": 1, "head": head_tc1}]
    assert status["g1"]["main"] == {"state": "FAIL", "sha": walked, "at": "2026-10-04T20:00:00Z"}
    assert status["usage"] == {"session_percent": 12, "week_percent": 27, "read_at": NOW}
    assert any(a["code"] == "READY-NO-VERIFY" and a["subject"] == "tc3" for a in status["alarms"])

    (world.factory / "g1.pid").write_text(f"{os.getpid()}\n")
    world.once()
    status = world.status()
    assert status["g1"]["main"] is not None
    assert status["g1"]["main"]["state"] == "RUNNING"
    assert violations(status, schema, schema) == []


# W11
def test_w11_usage_is_read_every_15_minutes_and_gh_pr_list_every_5(world: World) -> None:
    world.extra_env["VEXTRUS_PRS_FILE"] = None  # the `gh` stub answers instead
    usage_log = world.factory / "usage.log"

    def usage_reads() -> int:
        return len(usage_log.read_text().splitlines()) if usage_log.exists() else 0

    world.once("2026-10-04T21:00:00Z")
    first_gh = len(world.calls_of("gh"))
    assert first_gh >= 1
    assert all(call[:2] == ["pr", "list"] for call in world.calls_of("gh")), world.calls_of("gh")
    assert usage_reads() == 1

    world.once("2026-10-04T21:01:00Z")
    assert len(world.calls_of("gh")) == first_gh
    world.once("2026-10-04T21:06:00Z")
    after_five = len(world.calls_of("gh"))
    assert after_five > first_gh
    assert usage_reads() == 1, "usage was re-read within 15 minutes"

    world.once("2026-10-04T21:16:00Z")
    assert usage_reads() == 2
    assert len(world.calls_of("gh")) > after_five


def test_w11_unreadable_usage_gives_null_usage_and_no_crash(world: World) -> None:
    world.seams["usage"].write_text("Current session: unknown\n")
    world.once()
    assert world.status()["usage"] is None


# W12
def pid_alive(pid: int) -> bool:
    return Path(f"/proc/{pid}").exists()


def is_watcher(pid: int) -> bool:
    try:
        cmdline = Path(f"/proc/{pid}/cmdline").read_bytes()
    except OSError:
        return False
    return b"scripts.factory.watch" in cmdline or b"scripts/factory/watch.py" in cmdline


def stop(pid: int) -> None:
    """SIGTERM a watcher and wait (bounded) for it to exit, by pidfd: no sleep."""
    try:
        handle = os.pidfd_open(pid)
    except ProcessLookupError:
        return
    try:
        os.kill(pid, signal.SIGTERM)
        ready_fds, _, _ = select.select([handle], [], [], 30)
        if not ready_fds:
            os.kill(pid, signal.SIGKILL)
    finally:
        os.close(handle)


def dead_pid() -> int:
    finished = subprocess.Popen(["true"])
    finished.wait()
    return finished.pid


@pytest.mark.parametrize("pidfile", ["none", "dead", "unrelated", "live-watcher"])
def test_w12_ensure_starts_one_watcher_unless_a_live_one_holds_the_pidfile(
    world: World, pidfile: str
) -> None:
    pidpath = world.factory / "watch.pid"
    started: list[int] = []
    try:
        if pidfile == "dead":
            pidpath.write_text(f"{dead_pid()}\n")
        elif pidfile == "unrelated":
            pidpath.write_text(f"{os.getpid()}\n")
        elif pidfile == "live-watcher":
            first = world.watch("ensure", timeout=60)
            match = re.fullmatch(r"started (\d+)", first.stdout.strip())
            assert match, show(first)
            started.append(int(match.group(1)))

        done = world.watch("ensure", timeout=60)
        assert done.returncode == 0, show(done)
        if pidfile == "live-watcher":
            assert done.stdout.strip() == f"running {started[0]}"
            assert pidpath.read_text().strip() == str(started[0])
            return
        match = re.fullmatch(r"started (\d+)", done.stdout.strip())
        assert match, show(done)
        pid = int(match.group(1))
        assert pid != os.getpid()
        started.append(pid)
        assert pid_alive(pid)
        assert is_watcher(pid)
        assert pidpath.read_text().strip() == str(pid)
    finally:
        for pid in started:
            stop(pid)


def test_w12_the_script_form_with_no_arguments_runs_the_loop_and_sigterm_removes_its_pidfile(
    world: World,
) -> None:
    pidpath = world.factory / "watch.pid"
    pidpath.write_text(f"{dead_pid()}\n")
    env = world.env(NOW)
    env.pop("PYTHONPATH")
    out, err = world.tmp / "watch.out", world.tmp / "watch.err"
    with out.open("w") as stdout, err.open("w") as stderr:
        child = subprocess.Popen(
            [sys.executable, str(REPO / "scripts" / "factory" / "watch.py")],
            cwd=REPO,
            env=env,
            stdin=subprocess.DEVNULL,
            stdout=stdout,
            stderr=stderr,
        )
    handle = os.pidfd_open(child.pid)
    try:
        # Wait (bounded; the child's pidfd wakes at once if it dies) for the pidfile to name it.
        for _ in range(600):
            if pidpath.exists() and pidpath.read_text().strip() == str(child.pid):
                break
            exited, _, _ = select.select([handle], [], [], 0.05)
            assert not exited, f"the watcher exited: {err.read_text()}"
        assert pidpath.read_text().strip() == str(child.pid), err.read_text()
        assert child.poll() is None, err.read_text()
        child.send_signal(signal.SIGTERM)
        child.wait(timeout=30)
    finally:
        os.close(handle)
        if child.poll() is None:
            child.kill()
            child.wait(timeout=30)
    assert not pidpath.exists(), "SIGTERM left watch.pid behind"
    assert "Traceback" not in err.read_text(), err.read_text()


# W15
CASES = {
    "ready-ok": "READY",
    "ready-no-verify": "READY-NO-VERIFY",
    "ready-wrong-tree": "READY-NO-VERIFY",
    "ready-with-reason": "READY-NO-VERIFY",
    "blocked-ok": "BLOCKED",
    "blocked-no-reason": None,
    "repeated-key": "READY-NO-VERIFY",
    "lowercase-value": "READY-NO-VERIFY",
    "none": None,
    "older-commit-only": None,
}


def fixture(case: str, tree: str, other_tree: str) -> str:
    path = TRAILER_FIXTURES / f"{case}.txt"
    assert path.is_file(), f"missing trailer fixture {path.relative_to(REPO)} (trailers.md 4)"
    return path.read_text().replace("@TREE@", tree).replace("@OTHER_TREE@", other_tree)


def factory_lines(message: str) -> list[str]:
    paragraphs = [p for p in re.split(r"\n\s*\n", message.strip()) if p.strip()]
    return sorted(
        line.strip()
        for line in paragraphs[-1].splitlines()
        if re.match(r"(?i)factory-[a-z]+:", line.strip())
    )


def check_fixture_shape(case: str, message: str, tree: str, other_tree: str) -> None:
    found = factory_lines(message)
    state, verify = "Factory-State: READY", f"Factory-Verify: {tree} ok"
    exact = {
        "ready-ok": [state, verify],
        "ready-no-verify": [state],
        "ready-wrong-tree": [state, f"Factory-Verify: {other_tree} ok"],
        "blocked-no-reason": ["Factory-State: BLOCKED"],
        "older-commit-only": [state, verify],
    }
    if case in exact:
        assert found == sorted(exact[case]), (case, found)
    elif case == "ready-with-reason":
        assert [line for line in found if not line.startswith("Factory-Reason: ")] == sorted(
            [state, verify]
        )
        assert len(found) == 3, (case, found)
    elif case == "blocked-ok":
        reasons = [line for line in found if line.startswith("Factory-Reason: ")]
        assert len(found) == 2, (case, found)
        assert "Factory-State: BLOCKED" in found
        assert len(reasons) == 1
        assert re.fullmatch(r"[^\r\n]{1,200}", reasons[0].removeprefix("Factory-Reason: "))
    elif case == "repeated-key":
        assert found.count(state) == 2, (case, found)
    elif case == "lowercase-value":
        assert "Factory-State: ready" in found, (case, found)
    elif case == "none":
        assert not re.search(r"(?im)^\s*factory-", message), (case, message)


def push_fixture(world: World, branch: str, case: str, other_tree: str) -> tuple[str, str]:
    """Push the case's fixture message as the branch's new tip; return the message and the tip's tree."""
    made: dict[str, str] = {}

    def message(tree: str) -> str:
        made["text"], made["tree"] = fixture(case, tree, other_tree), tree
        return made["text"]

    world.push(branch, message)
    return made["text"], made["tree"]


def test_w15_the_trailer_fixture_table_parses_as_trailers_md_says(world: World) -> None:
    other_tree = world.tree_of(world.tip("main") or "")
    reason = ""
    for case in CASES:
        branch = f"tr-{case}"
        world.launch(branch, branch)
        if case == "older-commit-only":
            text, tree = push_fixture(world, branch, "older-commit-only", other_tree)
            check_fixture_shape(case, text, tree, other_tree)
            push_fixture(world, branch, "none", other_tree)
            continue
        text, tree = push_fixture(world, branch, case, other_tree)
        check_fixture_shape(case, text, tree, other_tree)
        if case == "blocked-ok":
            line = next(x for x in factory_lines(text) if x.startswith("Factory-Reason: "))
            reason = line.removeprefix("Factory-Reason: ")

    world.once()
    for case, outcome in CASES.items():
        ticket = f"tr-{case}"
        kinds = {kind for kind in TRAILER_KINDS if world.events(kind, ticket)}
        assert kinds == ({outcome} if outcome else set()), (case, world.lines())
        if outcome:
            assert len(world.events(outcome, ticket)) == 1, (case, world.lines())
    assert reason
    assert reason in world.events("BLOCKED", "tr-blocked-ok")[0]
