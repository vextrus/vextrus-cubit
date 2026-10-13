"""S26-FX1 fix round 1 (PR #786): publish and the watcher read READY over a builder's status replies the
way `ci_gate.is_ready` does, and the watcher gives a second walk of one head its own G1."""

from __future__ import annotations

import json
import os
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from scripts.factory import ci_gate, publish, watch

AT = datetime(2026, 10, 13, 16, 0, tzinfo=UTC)
MESSAGE = "S99-X1: the widget\n\nWhat was not verified: nothing.\n\n## Cut\nNone.\n\n"


def git(repo: Path, *args: str) -> str:
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    env.update(
        GIT_CONFIG_NOSYSTEM="1",
        GIT_CONFIG_GLOBAL=os.devnull,
        GIT_AUTHOR_NAME="t",
        GIT_AUTHOR_EMAIL="t@example.invalid",
        GIT_COMMITTER_NAME="t",
        GIT_COMMITTER_EMAIL="t@example.invalid",
    )
    done = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=True, env=env
    )
    return done.stdout.strip()


class Builder:
    """A repository with main and the builder's branch: its READY commit and its status replies."""

    def __init__(self, path: Path) -> None:
        self.path = path
        git(path, "init", "-q", "-b", "main")
        (path / "seed.txt").write_text("seed\n")
        git(path, "add", "seed.txt")
        git(path, "commit", "-q", "-m", "seed")
        self.main = git(path, "rev-parse", "HEAD")
        git(path, "checkout", "-q", "-b", "s99-x1")

    def head(self) -> str:
        return git(self.path, "rev-parse", "HEAD")

    def ready(self, name: str = "r.txt", message: str = MESSAGE) -> str:
        (self.path / name).write_text(f"{name}\n")
        git(self.path, "add", name)
        tree = git(self.path, "write-tree")
        text = f"{message}Factory-State: READY\nFactory-Verify: {tree} ok\n"
        git(self.path, "commit", "-q", "--cleanup=verbatim", "-m", text)
        return self.head()

    def reply(self, line: str = "still working") -> str:
        git(
            self.path,
            "commit",
            "-q",
            "--allow-empty",
            "-m",
            "status: where I am",
            "-m",
            f"Factory-Status: {line}",
        )
        return self.head()


@pytest.fixture
def builder(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Builder:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(watch, "leak_scan", lambda head, main: {"result": "clean"})
    return Builder(tmp_path)


# --- publish


def test_publish_reads_the_ready_commit_under_status_replies(builder: Builder) -> None:
    ready = builder.ready()
    builder.reply("one")
    head = builder.reply("two")
    assert publish.ready_source(builder.path, head) == ready
    assert ci_gate.ready_commit(head, builder.path) == ready
    assert publish.ready_source(builder.path, ready) == ready


def test_publish_refuses_a_status_reply_on_a_head_that_is_not_ready(builder: Builder) -> None:
    git(builder.path, "commit", "-q", "--allow-empty", "-m", "wip: not done")
    head = builder.reply()
    with pytest.raises(publish.Refused, match="not READY"):
        publish.ready_source(builder.path, head)


def test_publish_refuses_a_reply_that_changes_a_file(builder: Builder) -> None:
    builder.ready()
    (builder.path / "edit.txt").write_text("an edit\n")
    git(builder.path, "add", "edit.txt")
    git(builder.path, "commit", "-q", "-m", "edit\n\nFactory-Status: with a file")
    with pytest.raises(publish.Refused, match="not READY"):
        publish.ready_source(builder.path, builder.head())


def test_the_pr_title_and_body_come_from_the_ready_commit_never_a_status_reply(
    builder: Builder, monkeypatch: pytest.MonkeyPatch
) -> None:
    ready = builder.ready()
    head = builder.reply("answering a status message")
    opened: dict[str, Any] = {}
    monkeypatch.setattr(publish, "fetch_main", lambda root: builder.main)
    monkeypatch.setattr(publish, "open_pr", lambda branch: None)
    monkeypatch.setattr(publish, "range_scan", lambda *args: None)
    monkeypatch.setattr(publish, "push", lambda root, branch, h, r=None: opened.update(pushed=(h, r)))
    monkeypatch.setattr(publish, "scan_body", lambda root, path: None)

    def create(branch: str, title: str, body: Path) -> str:
        opened.update(title=title, body=body.read_text(encoding="utf-8"))
        return "https://example.invalid/pr/1"

    monkeypatch.setattr(publish, "create_pr", create)
    assert publish.publish(builder.path, "s99-x1") == 0
    assert opened["title"] == "S99-X1: the widget"
    assert "What was not verified: nothing." in opened["body"]
    assert "status: where I am" not in opened["body"] + opened["title"]
    assert "answering a status message" not in opened["body"]
    assert head != ready


def test_publish_still_cuts_a_body_whose_ready_message_has_an_unlinked_cut_item(
    builder: Builder, monkeypatch: pytest.MonkeyPatch
) -> None:
    builder.ready(message="S99-X1: the widget\n\n## Cut\n- the second screen\n\n")
    builder.reply()
    monkeypatch.setattr(publish, "fetch_main", lambda root: builder.main)
    monkeypatch.setattr(publish, "open_pr", lambda branch: None)
    with pytest.raises(publish.Refused, match="Cut check"):
        publish.publish(builder.path, "s99-x1")


# --- the watcher's track()


def fresh_state() -> dict[str, Any]:
    return {"schema": 1, "alarms": {}, "tickets": {}, "parser": watch.PARSER}


def record() -> dict[str, Any]:
    return {
        "ticket": "tu",
        "branch": "s99-x1",
        "where": "cloud",
        "budget_minutes": 30,
        "_started": datetime(2026, 10, 13, 15, 0, tzinfo=UTC),
    }


def track_once(state: dict[str, Any], head: str, main: str) -> tuple[watch.Pass, dict[str, Any]]:
    step = watch.Pass(Path("unused"), AT, state)
    refs = {"s99-x1": head, "main": main}
    return step, watch.track(step, "tu", record(), refs, main, [], None)


def readies(step: watch.Pass) -> list[tuple[str, str | None, str]]:
    return [e for e in step.events if e[0] == "READY"]


def test_a_ready_commit_and_its_status_reply_in_one_pass_are_one_ready_event(builder: Builder) -> None:
    ready = builder.ready()
    head = builder.reply()
    state = fresh_state()
    step, item = track_once(state, head, builder.main)
    assert item["state"] == "ready"
    assert readies(step) == [("READY", "tu", ready[:8])]
    assert state["tickets"]["tu"]["outcome"] == "READY"
    assert not [a for a in step.alarms.values() if a[0] in ("BUILDER-QUIET", "BUDGET-PASSED")]

    later = builder.reply("again")  # a second reply: no second READY
    step, item = track_once(state, later, builder.main)
    assert (item["state"], readies(step)) == ("ready", [])


def test_a_watcher_that_saw_an_earlier_head_still_finds_the_ready_under_the_reply(
    builder: Builder,
) -> None:
    (builder.path / "w.txt").write_text("w\n")
    git(builder.path, "add", "w.txt")
    git(builder.path, "commit", "-q", "-m", "wip: working")
    state = fresh_state()
    step, item = track_once(state, builder.head(), builder.main)
    assert (item["state"], readies(step)) == ("working", [])

    ready = builder.ready()
    head = builder.reply()  # both land between two passes
    step, item = track_once(state, head, builder.main)
    assert item["state"] == "ready"
    assert readies(step) == [("READY", "tu", ready[:8])]


def test_a_reply_on_a_head_that_is_not_ready_stays_working(builder: Builder) -> None:
    git(builder.path, "commit", "-q", "--allow-empty", "-m", "wip: not done")
    step, item = track_once(fresh_state(), builder.reply(), builder.main)
    assert (item["state"], readies(step)) == ("working", [])


# --- the watcher's walks


def write_verdict(folder: Path, sha: str, finished_at: str, result: str) -> None:
    walk = folder / "walks" / sha
    walk.mkdir(parents=True, exist_ok=True)
    (walk / "verdict.json").write_text(json.dumps({"finished_at": finished_at, "result": result}))


def walk_pass(factory: Path, state: dict[str, Any]) -> list[tuple[str, str | None, str]]:
    step = watch.Pass(factory, AT, state)
    watch.watch_walks(step)
    return step.events


def test_a_second_walk_of_one_head_gives_a_second_g1(tmp_path: Path) -> None:
    factory = tmp_path / "factory"
    factory.mkdir()
    sha = "ab" * 20
    state: dict[str, Any] = {}
    write_verdict(tmp_path, sha, "2026-10-13T15:00:00Z", "FAIL")
    assert walk_pass(factory, state) == []  # the first pass: history
    assert walk_pass(factory, state) == []

    write_verdict(tmp_path, sha, "2026-10-13T15:30:00Z", "PASS")  # walk #2 over the same name
    assert walk_pass(factory, state) == [("G1", sha[:8], "PASS")]
    assert walk_pass(factory, state) == []  # not repeated


def test_a_verdict_without_finished_at_is_told_apart_by_its_file(tmp_path: Path) -> None:
    factory = tmp_path / "factory"
    factory.mkdir()
    sha = "cd" * 20
    walk = tmp_path / "walks" / sha
    walk.mkdir(parents=True)
    (walk / "verdict.json").write_text(json.dumps({"result": "FAIL"}))
    state: dict[str, Any] = {}
    walk_pass(factory, state)
    (walk / "verdict.json").unlink()
    (walk / "verdict.json").write_text(json.dumps({"result": "PASS"}))
    os.utime(walk / "verdict.json", ns=(10**18, 10**18))
    assert walk_pass(factory, state) == [("G1", sha[:8], "PASS")]


def test_a_state_an_older_watcher_wrote_does_not_repeat_its_walk(tmp_path: Path) -> None:
    factory = tmp_path / "factory"
    factory.mkdir()
    sha = "ef" * 20
    write_verdict(tmp_path, sha, "2026-10-13T15:00:00Z", "PASS")
    state: dict[str, Any] = {"walks": {sha: ["verdict.json"]}}
    assert walk_pass(factory, state) == []
