"""Fix round 1 of S14-S1 (PR #492): one test per confirmed finding, driven through the command with the
acceptance world's stand-ins (the acceptance tests themselves are not touched)."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14s1 import _world
from scripts.tests.acceptance.ts14s1._world import World, plain, ready, row, rows, stub


@pytest.fixture
def world(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> World:
    return World(tmp_path, monkeypatch)


def merge_main_into(world: World, branch: str) -> str:
    """A clean merge of a newer main into `branch`, pushed (the lander's `update-branch`)."""
    old = world.tip(branch)
    assert old
    new_main = world.push("main", plain)
    world.git(world.work, "fetch", "-q", "origin")
    tree = world.git(world.work, "merge-tree", "--write-tree", old, new_main).split()[0]
    text = world.tmp / "merge.txt"
    text.write_text(f"Merge main into {branch}\n")
    sha = world.git(world.work, "commit-tree", tree, "-p", old, "-p", new_main, "-F", str(text))
    world.git(world.work, "push", "-q", "origin", f"+{sha}:refs/heads/{branch}")
    return sha


def has(line: str, words: str) -> bool:
    return words.lower() in line.lower()


def test_a_fix_on_an_older_head_and_a_dead_builder_on_a_newer_one_reads_resume(world: World) -> None:
    name, session = world.launch_local("s99a", "s99-a")
    old = world.push("s99-a", ready)
    world.pr(5001, "s99-a", old)
    world.verdict(5001, old, 1, "FIX")
    world.commit_local("s99-a", plain)
    world.ended(name, session)

    line = row(world.table(), "s99-a")

    assert has(line, f"resume {session}"), line
    assert not has(line, "unreviewed"), line


def test_a_fix_on_an_older_head_and_a_live_builder_on_a_newer_one_reads_building(world: World) -> None:
    name, session = world.launch_local("s99b", "s99-b")
    old = world.push("s99-b", ready)
    world.pr(5002, "s99-b", old)
    world.verdict(5002, old, 1, "FIX")
    world.commit_local("s99-b", plain)
    world.live(name, session)

    line = row(world.table(), "s99-b")

    assert has(line, "building"), line
    assert not has(line, "unreviewed"), line
    assert not has(line, "resume"), line


def test_a_closed_pr_reads_pr_closed_whatever_the_head(world: World) -> None:
    head = world.push("s99-c", ready)
    world.pr(5003, "s99-c", head, state="CLOSED")
    name, session = world.launch_local("s99d", "s99-d")
    world.push("s99-d", plain)
    world.commit_local("s99-d", plain)
    world.ended(name, session)
    world.pr(5004, "s99-d", world.tip("s99-d") or "", state="CLOSED")

    table = world.table()

    for branch in ("s99-c", "s99-d"):
        line = row(table, branch)
        assert has(line, "PR closed"), line
        assert "READY, no PR" not in line, line
        assert not has(line, "resume"), line


def test_a_pass_followed_by_a_clean_merge_of_main_is_not_unreviewed(world: World) -> None:
    reviewed = world.push("s99-e", ready)
    world.verdict(5005, reviewed, 1, "PASS")
    head = merge_main_into(world, "s99-e")
    world.pr(5005, "s99-e", head)

    line = row(world.table(), "s99-e")

    assert has(line, "ready to land"), line
    assert "READY" in line, line
    assert not has(line, "unreviewed"), line


def test_a_pass_followed_by_new_work_is_still_unreviewed(world: World) -> None:
    reviewed = world.push("s99-f", ready)
    world.verdict(5006, reviewed, 1, "PASS")
    head = world.push("s99-f", ready)
    world.pr(5006, "s99-f", head)

    assert has(row(world.table(), "s99-f"), "unreviewed")


def test_a_rollup_without_the_ci_check_is_not_ready_to_land(world: World) -> None:
    head = world.push("s99-g", ready)
    world.pr(5007, "s99-g", head)
    world.prs[-1]["statusCheckRollup"] = [
        {**world.prs[-1]["statusCheckRollup"][1], "name": "design-gate"}
    ]
    world._write_seams()
    world.verdict(5007, head, 1, "PASS")

    assert not has(row(world.table(), "s99-g"), "ready to land")


def test_a_branch_name_cannot_forge_cells(world: World) -> None:
    evil = "s99-y|READY|#7|PASS|ready-to-land"
    world.push(evil, plain)
    world.push("s99-z", plain)

    text = world.table()

    cells = [re.split(r"(?<!\\)\|", line) for line in text.splitlines() if "s99-y" in line]
    normal = [re.split(r"(?<!\\)\|", line) for line in text.splitlines() if "s99-z" in line]
    assert len(cells) == 1, text
    assert len(normal) == 1, text
    assert len(cells[0]) == len(normal[0]), cells[0]


def test_an_unreadable_launch_record_is_a_note_in_the_table_and_in_resume_md(
    world: World, tmp_path: Path
) -> None:
    (world.factory / "launches" / "s99q-20261006T100000Z.json").write_text('{"ticket": "s99q", "br')
    world.push("s99-alpha", ready)
    target = tmp_path / "RESUME.md"

    text = world.table("--resume-md", str(target))

    assert "unreadable launch record s99q-20261006T100000Z.json" in text
    assert "unreadable launch record s99q-20261006T100000Z.json" in target.read_text()


def test_an_idle_branch_with_no_pr_and_no_launch_is_counted_not_listed(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    before = world.git.env

    def long_ago() -> dict[str, str]:
        return {**before(), "GIT_COMMITTER_DATE": "2026-08-01T10:00:00Z"}

    monkeypatch.setattr(world.git, "env", long_ago)
    world.push("s99-stale", plain)
    world.push("s99-stale-ready", ready)
    monkeypatch.setattr(world.git, "env", before)
    world.push("s99-fresh", plain)

    text = world.table()

    assert rows(text, "s99-stale") == [], text
    assert "READY, no PR" in row(text, "s99-stale-ready"), text
    assert row(text, "s99-fresh")
    assert re.search(r"1 branches with no PR or launch", text), text


def paging_gh(world: World) -> None:
    """The acceptance world's gh, honouring --limit as gh does (newest first)."""
    source = _world.FAKE_GH.format(prs=str(world.prs_file)).replace(
        "    print(json.dumps([shown(row) for row in rows]))",
        "    rows = sorted(rows, key=lambda r: -r['number'])\n"
        "    rows = rows[: int(value('--limit', '-L', default='30'))]\n"
        "    print(json.dumps([shown(row) for row in rows]))",
    )
    stub(world.stubs / "gh", source.split("\n", 1)[1] if source.startswith("#!") else source)


def test_a_merged_pr_beyond_the_first_two_hundred_still_drops_its_branch(world: World) -> None:
    paging_gh(world)
    old = world.push("s99-old", ready)
    world.pr(1, "s99-old", old, state="MERGED")
    for number in range(10, 215):
        world.pr(number, f"filler-{number}", old, state="MERGED")

    assert rows(world.table(), "s99-old") == []


def test_a_launched_branch_with_commits_after_launch_inside_main_is_dropped(
    world: World, monkeypatch: pytest.MonkeyPatch
) -> None:
    name, session = world.launch_local("s99m", "s99-merged")
    before = world.git.env

    def later() -> dict[str, str]:
        return {**before(), "GIT_COMMITTER_DATE": "2026-10-06T11:00:00Z"}

    monkeypatch.setattr(world.git, "env", later)
    work = world.push("s99-merged", plain)
    world.git(world.work, "fetch", "-q", "origin")
    ahead_of = world.git.commit(world.work, plain, work)
    world.git(world.work, "push", "-q", "origin", f"+{ahead_of}:refs/heads/main")
    world.ended(name, session)

    assert rows(world.table(), "s99-merged") == []


def test_a_launched_branch_whose_pr_is_merged_is_dropped(world: World) -> None:
    name, session = world.launch_local("s99n", "s99-pr-merged")
    head = world.push("s99-pr-merged", plain)
    world.pr(5100, "s99-pr-merged", head, state="MERGED")
    world.ended(name, session)

    assert rows(world.table(), "s99-pr-merged") == []


def behind_a_moved_main(world: World) -> tuple[str, str]:
    """A launched builder with no commit of its own: its branch is main's old tip, main has moved on."""
    name, session = world.launch_local("s99p", "s99-fresh-builder")
    old_main = world.tip("main")
    world.git(world.work, "push", "-q", "origin", f"{old_main}:refs/heads/s99-fresh-builder")
    world.push("main", plain)
    return name, session


def test_a_launched_builder_with_no_commit_behind_a_moved_main_reads_building_while_live(
    world: World,
) -> None:
    name, session = behind_a_moved_main(world)
    world.live(name, session)

    line = row(world.table(), "s99-fresh-builder")

    assert has(line, "building"), line
    assert not has(line, "resume"), line


def test_a_launched_builder_with_no_commit_behind_a_moved_main_reads_resume_once_dead(
    world: World,
) -> None:
    name, session = behind_a_moved_main(world)
    world.ended(name, session)

    line = row(world.table(), "s99-fresh-builder")

    assert has(line, f"resume {session}"), line
