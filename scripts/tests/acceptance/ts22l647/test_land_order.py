"""S22-647: `python -m scripts.land order <PR> ...` orders a PR of any size on its full file list, and
a PR git cannot read is a refusal, never a crash.

The big PR (7) has 150 files and is over GitHub's diff limit (the stub `gh pr diff` exits 1 with
too_large); its 150th file added is an engine path, so it is an engine PR and lands before the smaller
non-engine PR 5. A failed fetch, or a head or base GitHub names that git does not hold, prints
`land: refused: PR <n>: ...` and exits 3 (the lander's refusal). Driven through `scripts.land.main` in
a fresh clone with a stub `gh` and a ledger PASS for every head (see `_world.py`)."""

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
def shas(
    tmp_path: Path, hub: tuple[Path, dict[str, str]], monkeypatch: pytest.MonkeyPatch
) -> dict[str, str]:
    path, built = hub
    w.enter(tmp_path, path, built, monkeypatch)
    return built


def test_an_engine_file_as_the_150th_makes_the_big_pr_an_engine_pr_ordered_first(
    shas: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    code = land.main(["order", str(w.SMALL), str(w.BIG)])
    out = capsys.readouterr().out
    assert code == 0, out
    assert out.splitlines() == [
        f"land: PR {w.BIG} {shas[str(w.BIG)]}",
        f"land: PR {w.SMALL} {shas[str(w.SMALL)]}",
    ], out


def test_ordering_never_asks_gh_for_a_diff(
    tmp_path: Path, shas: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    land.main(["order", str(w.SMALL)])
    out = capsys.readouterr().out
    asked = [call for call in w.gh_calls(tmp_path) if call[:2] == ["pr", "diff"]]
    assert asked == [], f"the lander asked gh for a diff: {asked}\n{out}"


def test_a_pull_ref_that_cannot_be_fetched_is_a_refusal_naming_the_fetch(
    shas: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    code = land.main(["order", str(w.NO_REF)])
    out = capsys.readouterr().out
    assert code == 3, out
    refusals = [line for line in out.splitlines() if line.startswith(f"land: refused: PR {w.NO_REF}: ")]
    assert refusals, out
    assert "fetch" in refusals[0].lower(), out


def test_a_base_git_does_not_hold_is_a_refusal_not_a_crash(
    shas: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    code = land.main(["order", str(w.GONE_BASE)])
    out = capsys.readouterr().out
    assert code == 3, out
    assert any(line.startswith(f"land: refused: PR {w.GONE_BASE}: ") for line in out.splitlines()), out
    assert f"land: PR {w.GONE_BASE} " not in out


def test_a_head_git_does_not_hold_is_a_refusal_not_a_crash(
    shas: dict[str, str], capsys: pytest.CaptureFixture[str]
) -> None:
    code = land.main(["order", str(w.GONE_HEAD)])
    out = capsys.readouterr().out
    assert code == 3, out
    assert any(line.startswith(f"land: refused: PR {w.GONE_HEAD}: ") for line in out.splitlines()), out
    assert f"land: PR {w.GONE_HEAD} " not in out
