"""Ticket S14-W1 (#455): open PRs and the hot-file list. "WIP cap 5 and 2 per hot file area in
`governor.py`; hot-file list"; acceptance check: "the governor refuses ... a launch whose owned files
intersect an open PR's, naming it" (session-13 close, factory-next.md 8 row 5). Issue #455: "refuses
with the blocking PR named"; "a launch with disjoint files is allowed; the hot-file list is read from
the committed file", "starting with `step1.py`, `proposals.py`, `views.py`, `model.ts`, `en.po`,
`m0-screens.md`".

A builder launch is `governor check cloud-session --owns <path>`; the hot-file list is
`scripts/factory/hot-files.json`, `{"areas": {"<area>": ["<path or glob>", ...]}}`. See `_world.py`.
"""

from __future__ import annotations

import fnmatch
import json
import subprocess
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts14w1._world import (
    REPO,
    World,
    assert_ok,
    names_pr,
    pr,
    refusal,
)

STEP1_CHAIN = {
    "step1-chain": [
        "vextrus/takeoff/http/step1.py",
        "vextrus/takeoff/services/step1.py",
        "vextrus/takeoff/schemas/step1.py",
    ]
}
OWNS = "vextrus/takeoff/services/step1.py"
UNRELATED = pr(493, "s14-docs", "docs/research/unrelated.md")


@pytest.fixture
def world(tmp_path: Path) -> World:
    return World(tmp_path, hot_areas=STEP1_CHAIN)


def two_prs_in_the_area(world: World) -> None:
    world.open_prs(
        [
            pr(471, "s14-p", "vextrus/takeoff/schemas/step1.py"),
            pr(482, "s14-q", "vextrus/takeoff/http/step1.py", "web/src/ui/button.tsx"),
            UNRELATED,
        ]
    )


def test_a_launch_in_a_hot_area_with_two_open_prs_is_refused_naming_both(world: World) -> None:
    two_prs_in_the_area(world)
    line = refusal(world.check("cloud-session", OWNS), "cloud-session")
    assert names_pr(line, 471), line
    assert names_pr(line, 482), line
    assert not names_pr(line, 493), f"a PR outside the area is not a blocker\n{line}"


def test_a_launch_in_a_hot_area_with_one_open_pr_is_allowed(world: World) -> None:
    world.open_prs([pr(471, "s14-p", "vextrus/takeoff/schemas/step1.py"), UNRELATED])
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")


def test_the_hot_areas_come_from_the_committed_list(world: World) -> None:
    two_prs_in_the_area(world)
    world.write_hot_files({"web-model": ["web/src/takeoff/model.ts"]})
    assert_ok(world.check("cloud-session", OWNS), "cloud-session")


def test_a_launch_whose_file_an_open_pr_changes_is_refused_naming_that_pr(world: World) -> None:
    world.open_prs(
        [
            pr(504, "s14-r", "scripts/factory/launch.py", "scripts/factory/say.py"),
            pr(515, "s14-s", "scripts/factory/watch.py"),
            UNRELATED,
        ]
    )
    line = refusal(world.check("cloud-session", "scripts/factory/launch.py"), "cloud-session")
    assert names_pr(line, 504), line
    assert not names_pr(line, 515), f"a PR on other files is not a blocker\n{line}"
    assert not names_pr(line, 493), f"a PR on other files is not a blocker\n{line}"


def test_a_launch_with_files_disjoint_from_every_open_pr_is_allowed(world: World) -> None:
    world.open_prs([pr(504, "s14-r", "scripts/factory/launch.py"), UNRELATED])
    assert_ok(world.check("cloud-session", "scripts/factory/watch.py"), "cloud-session")


def test_a_merged_pr_does_not_hold_its_files(world: World) -> None:
    world.open_prs([pr(526, "s14-t", "scripts/factory/launch.py", state="MERGED"), UNRELATED])
    assert_ok(world.check("cloud-session", "scripts/factory/launch.py"), "cloud-session")


def test_an_unreadable_open_pr_list_refuses_the_launch(world: World) -> None:
    world.seams["prs"].write_text("gh: HTTP 502 Bad Gateway")
    refusal(world.check("cloud-session", "scripts/factory/watch.py"), "cloud-session")


HOT_FILES = ("step1.py", "proposals.py", "views.py", "model.ts", "en.po", "m0-screens.md")


@pytest.mark.parametrize("name", HOT_FILES)
def test_the_committed_hot_file_list_holds_the_session_13_hot_files(name: str) -> None:
    listed = json.loads((REPO / "scripts" / "factory" / "hot-files.json").read_text())
    entries = [entry for paths in listed["areas"].values() for entry in paths]
    tracked = subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout.splitlines()
    named = [path for path in tracked if Path(path).name == name]
    assert any(fnmatch.fnmatch(path, entry) for path in named for entry in entries), (
        f"no area of scripts/factory/hot-files.json covers a tracked {name}"
    )
