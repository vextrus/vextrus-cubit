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


# "A launch in a hot area with two open PRs is refused" was withdrawn by S14-K1 (an area holds 3 or
# more): scripts/tests/acceptance/ts14k1/test_hot_areas.py pins the raised area cap.


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


# views.py's place in the session-13 list is pinned by the views test below: S15-E4 (#524) makes
# engine/recognise/views.py the package engine/recognise/views/, so a file named views.py goes away
# while the views area stays hot.
HOT_FILES = ("step1.py", "proposals.py", "model.ts", "en.po", "m0-screens.md")
VIEWS_PACKAGE = "engine/recognise/views/"
VIEWS_MODULE = "engine/recognise/views.py"


def committed_areas() -> dict[str, list[str]]:
    listed = json.loads((REPO / "scripts" / "factory" / "hot-files.json").read_text())
    areas: dict[str, list[str]] = listed["areas"]
    return areas


def tracked_files() -> list[str]:
    return subprocess.run(
        ["git", "ls-files"], cwd=REPO, capture_output=True, text=True, check=True
    ).stdout.splitlines()


def covers(entry: str, path: str) -> bool:
    """An entry of the list is a repo path, a folder ending in /, or an fnmatch glob (governor.py)."""
    return (
        path == entry
        or fnmatch.fnmatchcase(path, entry)
        or (entry.endswith("/") and path.startswith(entry))
    )


@pytest.mark.parametrize("name", HOT_FILES)
def test_the_committed_hot_file_list_holds_the_session_13_hot_files(name: str) -> None:
    entries = [entry for paths in committed_areas().values() for entry in paths]
    named = [path for path in tracked_files() if Path(path).name == name]
    assert any(fnmatch.fnmatch(path, entry) for path in named for entry in entries), (
        f"no area of scripts/factory/hot-files.json covers a tracked {name}"
    )


def test_one_hot_area_covers_every_file_of_the_views_package_or_the_views_module() -> None:
    tracked = tracked_files()
    package = [path for path in tracked if path.startswith(VIEWS_PACKAGE)]
    views = package or [path for path in tracked if path == VIEWS_MODULE]
    assert views, f"neither {VIEWS_PACKAGE} nor {VIEWS_MODULE} is tracked"
    holding = [
        area
        for area, entries in committed_areas().items()
        if all(any(covers(entry, path) for entry in entries) for path in views)
    ]
    uncovered = sorted(
        path
        for path in views
        if not any(covers(entry, path) for paths in committed_areas().values() for entry in paths)
    )
    assert holding, (
        "no one area of scripts/factory/hot-files.json covers every views file; "
        f"uncovered: {uncovered or 'none, but they are split across areas'}"
    )
