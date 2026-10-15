"""S29-F4 (docs/plans/factory-s29.md item 4; the owner's rulings Q19 and Q20, 14 Oct 2026): "a gate is
walked again only when the update changed covered `web/**` files".

Seam (new, named here): `scripts.merge_ready.rewalk_files(walked: str, head: str, *, repo: Path) ->
list[str]`, the `web/**` files the design gate covered (the PR's own) that changed between the head
the gate walked (`walked`) and the PR's head now (`head`), read from git in `repo` (whose
`origin/main` is fetched); empty, the gate's verdict carries to `head` and it is not walked again.

The PR changes `web/src/screens/Plot.tsx` (its bottom). Pinned: an update (main merged in) that
brought no `web/**` file carries the gate; one that changed the PR's screen (its top, no conflict)
lists it; so does a commit of the builder's own after the walk. Not pinned: a `web/**` file the PR
does not change, brought in by the update.
"""

from __future__ import annotations

import importlib
import subprocess
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.ts29f4 import _world as w

PR = 61


def rewalk_files(walked: str, head: str, *, repo: Path) -> Any:
    """The seam under test, looked up when called (it is built by this ticket)."""
    return importlib.import_module("scripts.merge_ready").rewalk_files(walked, head, repo=repo)


def walked_and_updated(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, main_edits: dict[str, str]
) -> tuple[Path, str, str]:
    """A clone of a hub where main moved on with `main_edits` after the PR's fork; the head the gate
    walked (the PR's) and the head `land update` makes (main merged into it)."""
    shas = w.hub_world(tmp_path, [main_edits], {PR: ("fork", {w.SCREEN: "bottom"})})
    for key, value in w.git_env(tmp_path).items():
        monkeypatch.setenv(key, value)
    work = tmp_path / "work"
    subprocess.run(["git", "clone", "-q", str(tmp_path / "hub.git"), str(work)], check=True)
    w.git(work, "fetch", "-q", "origin", f"refs/pull/{PR}/head")
    walked = shas[str(PR)]
    w.git(work, "checkout", "-q", "-b", "update", walked)
    w.git(work, "merge", "-q", "--no-ff", "--no-edit", "origin/main")
    return work, walked, w.git(work, "rev-parse", "HEAD")


def test_an_update_that_changed_no_web_file_carries_the_design_gate(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, walked, head = walked_and_updated(
        tmp_path, monkeypatch, {"pkg/other.py": "new", "docs/notes/n.md": "new", w.SHARED: "top"}
    )
    assert list(rewalk_files(walked, head, repo=work)) == [], "a gate walked again for no web change"


def test_an_update_that_changed_the_pr_s_screen_walks_the_gate_again_naming_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, walked, head = walked_and_updated(tmp_path, monkeypatch, {w.SCREEN: "top"})
    assert list(rewalk_files(walked, head, repo=work)) == [w.SCREEN], (
        "an update that changed the screen the gate walked carried its verdict"
    )


def test_a_builder_s_own_commit_to_the_screen_after_the_walk_walks_the_gate_again(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    work, walked, _merged = walked_and_updated(tmp_path, monkeypatch, {"pkg/other.py": "new"})
    w.git(work, "checkout", "-q", "-b", "later", walked)
    (work / w.SCREEN).write_text((work / w.SCREEN).read_text() + "one more line\n")
    w.git(work, "commit", "-q", "-am", "a change after the walk")
    head = w.git(work, "rev-parse", "HEAD")
    assert list(rewalk_files(walked, head, repo=work)) == [w.SCREEN], (
        "a change to the screen after the walk carried the gate's verdict"
    )
