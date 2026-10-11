"""S22-647: the lander's file list for a PR of any size comes from git, never `gh pr diff`.

GitHub refuses `gh pr diff` over 20000 lines (HTTP 406 too_large), so `scripts.land` refused any big PR
("land: refused: PR 641: gh pr diff failed"). As merge_ready reads it (#645), the lander's file list is
read from git after fetching `refs/pull/<PR>/head` and the PR's base (baseRefOid / headRefOid from gh's
JSON): files = `git diff --name-only <base>...<head>`, every file, no cap. Driven through the existing
seam `scripts.land.Gh(repo).files(<PR>)` in a fresh clone with a stub `gh` (see `_world.py`)."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts import land
from scripts.tests.acceptance.ts22l647 import _world as w


@pytest.fixture(scope="module")
def hub(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, dict[str, str]]:
    root = tmp_path_factory.mktemp("hub")
    with pytest.MonkeyPatch.context() as patch:
        for key, value in w.git_env(root).items():
            patch.setenv(key, value)
        shas = w.build_hub(root)
    return root / "hub.git", shas


@pytest.fixture
def work(tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch) -> Path:
    path, shas = hub
    return w.enter(tmp_path, path, shas, monkeypatch)


def test_a_pr_over_the_diff_limit_lists_every_one_of_its_150_files(work: Path) -> None:
    files = land.Gh(work).files(w.BIG)
    assert sorted(files) == sorted(w.BIG_FILES)
    assert len(files) == 150


def test_each_file_is_listed_by_its_name_as_written(work: Path) -> None:
    files = land.Gh(work).files(w.BIG)
    assert w.SPACED in files
    assert w.NON_ASCII in files
    assert w.ENGINE_FILE in files


def test_the_list_is_the_prs_own_change_not_mains_later_one(work: Path) -> None:
    files = land.Gh(work).files(w.BIG)
    assert w.MAIN_ONLY not in files
    assert ".github/engine-paths.txt" not in files


def test_a_small_pr_lists_its_files_from_git_too(work: Path) -> None:
    assert land.Gh(work).files(w.SMALL) == w.SMALL_FILES


def test_gh_pr_diff_is_never_asked_for(tmp_path: Path, work: Path) -> None:
    land.Gh(work).files(w.SMALL)
    asked = [call for call in w.gh_calls(tmp_path) if call[:2] == ["pr", "diff"]]
    assert asked == [], f"the lander asked gh for a diff: {asked}"
