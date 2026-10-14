"""S28-W1: a repeat-mode walk (walk #2) counts toward `scripts.walk.ready` exactly like a fresh walk.

The ticket: "a repeat-mode walk writes its verdict in the same shape and place as a fresh walk, and
`scripts.walk.ready` counts a PASS repeat-mode verdict exactly like a fresh PASS (walk #1 fresh PASS +
walk #2 repeat PASS => `ready` exits 0)"; and "A new finding there fails the walk only if it BLOCKS;
other new findings are filed (OTHER)". docs/specs/factory.md 5 "G1": `ready.py <ref>` "passes only when
the two most recent G1 verdicts on main are both PASS with no FAIL between them".

Both walks run the scripted path (`_g1.run_chain`) on synthetic data, in a throwaway git repository whose
second head changes only a doc (no product path). Walk #2 carries new OTHER findings, one under an item a
critic failed and one marked misleading with no reproduction steps.
"""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts28w1._g1 import finding, judged, lay_out, run_chain, triaged

COMMITTED = "2026-10-05T00:00:00Z"
WALK_1 = ("2026-10-05T01:00:00Z", "2026-10-05T02:00:00Z")
WALK_2 = ("2026-10-05T03:00:00Z", "2026-10-05T04:00:00Z")


def _git(repo: Path, *args: str) -> str:
    env = {**os.environ, "GIT_AUTHOR_DATE": COMMITTED, "GIT_COMMITTER_DATE": COMMITTED}
    done = subprocess.run(
        ["git", "-C", str(repo), *args], capture_output=True, text=True, check=True, env=env
    )
    return done.stdout.strip()


def _commit(repo: Path, path: str) -> str:
    file = repo / path
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(f"{path}\n")
    _git(repo, "add", "--", path)
    _git(repo, "commit", "-q", "--no-verify", "-m", f"change {path}")
    return _git(repo, "rev-parse", "HEAD")


def _repo(tmp_path: Path) -> tuple[Path, str, str]:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q", "-b", "main")
    _git(repo, "config", "user.email", "walk-test@example.invalid")
    _git(repo, "config", "user.name", "walk test")
    _git(repo, "config", "commit.gpgsign", "false")
    first = _commit(repo, "vextrus/app.py")
    second = _commit(repo, "docs/note.md")
    return repo, first, second


def _ready(repo: Path, walks: Path) -> subprocess.CompletedProcess[str]:
    command = [
        sys.executable,
        "-m",
        "scripts.walk.ready",
        "main",
        "--walks-dir",
        str(walks),
        "--repo",
        str(repo),
    ]
    return subprocess.run(
        command, capture_output=True, text=True, check=False, cwd=Path(__file__).resolve().parents[4]
    )


def _two_walks(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path, str]:
    repo, first, second = _repo(tmp_path)
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    lay_out(walks, expect_dir, first, WALK_1[0])
    codes = run_chain(monkeypatch, walks, expect_dir, triaged({}, []), sha=first, finished=WALK_1[1])
    assert codes == [0, 0, 0], f"walk #1 (fresh, no finding) exits {codes}"
    lay_out(walks, expect_dir, second, WALK_2[0])
    repeat = triaged(
        {"M0-FL5": "FAIL"},
        [
            finding(1, "M0-FL5", defect_class="words_wrong", screen="takeoff.step1"),
            finding(
                2,
                "M0-FL9",
                defect_class="misleading_display",
                screen="drawing-set.report",
                misleading=True,
            ),
        ],
    )
    run_chain(monkeypatch, walks, expect_dir, repeat, sha=second, finished=WALK_2[1])
    return repo, walks, second


def test_a_repeat_walk_with_new_other_findings_writes_a_pass_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _, walks, second = _two_walks(tmp_path, monkeypatch)

    written = judged(walks / second)

    assert written["result"] == "PASS", "the repeat walk is not PASS"
    assert written["sha"] == second


def test_a_fresh_pass_then_a_repeat_pass_is_walk_ready(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repo, walks, _ = _two_walks(tmp_path, monkeypatch)

    done = _ready(repo, walks)

    assert done.returncode == 0, done.stdout + done.stderr
