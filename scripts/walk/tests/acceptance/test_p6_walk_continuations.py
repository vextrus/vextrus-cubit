"""T-WALK-3 acceptance, as T-WALK-4 leaves it: the walk still writes `conflicts.json` beside walk.json.

T-WALK-3 (session 12 phase 6, closes #294) counted false continuation Questions from conflicts.json
against a local ground-truth list (`continuations.json`, groups and near misses). T-WALK-4 (session 13)
retires that rule and its truth file: G1 now judges every conflict Question not on the expectation's
true list as false, from `snapshot.json` (scripts/walk/tests/acceptance/s13_walk4/). What survives here
is the side file itself, "kept: same shape, from the snapshot": the spec writes it where
`WALK_CONFLICTS` says, `run.walk_spec` points that at the walk's folder, and `run.set_aside` moves it
aside without overwriting an earlier move.

Synthetic data only; every time is a fixed string; no git, no network, no clock.
"""

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import pytest

SHA = "0123456789abcdef0123456789abcdef01234567"
STARTED = "2026-10-05T01:00:00Z"
FIXED_MTIME = 1_791_000_000  # 2026-10-03, one fixed second for both moves in T10
SET = "set-a"


def _folders(root: Path) -> tuple[Path, Path]:
    work = root / ".private" / "work"
    return work / "walks", work / "walk-expect"


def _plan(root: Path) -> Any:
    """A Plan by hand (as T-WALK-1's tests build it): no git, its out_dir the laid-out walk folder."""
    from scripts.walk import run

    walks, _ = _folders(root)
    db = f"vextrus_walk_{SHA[:8]}"
    return run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=db,
        out_dir=walks / SHA,
        worktree=walks / "_src",
        web_port=5511,
        api_port=8811,
        env={
            "VEXTRUS_DB_NAME": db,
            "VEXTRUS_WEB_PORT": "5511",
            "VEXTRUS_API_URL": "http://127.0.0.1:8811",
        },
    )


# T10 ----------------------------------------------------------------------------------------------


def test_set_aside_moves_conflicts_json_and_never_overwrites_an_earlier_move(tmp_path: Path) -> None:
    from scripts.walk import run

    folder = tmp_path / "walks" / SHA
    folder.mkdir(parents=True)
    for walk_n in (1, 2):
        path = folder / "conflicts.json"
        path.write_text(json.dumps({"synthetic": f"conflicts of walk {walk_n}"}))
        os.utime(path, (FIXED_MTIME, FIXED_MTIME))
        run.set_aside(folder)

    assert not (folder / "conflicts.json").exists(), "conflicts.json was not set aside"
    dated = sorted(p for p in folder.glob("conflicts.*.json") if p.name != "conflicts.json")
    kept = sorted(json.loads(p.read_text())["synthetic"] for p in dated)
    assert kept == ["conflicts of walk 1", "conflicts of walk 2"], kept


# T12 ----------------------------------------------------------------------------------------------

SPEC = Path(__file__).resolve().parents[4] / "web" / "e2e" / "real" / "walk.spec.ts"


def test_the_walk_spec_writes_conflicts_json_where_walk_conflicts_says() -> None:
    text = SPEC.read_text()

    assert "WALK_CONFLICTS" in text, "walk.spec.ts does not read WALK_CONFLICTS"
    assert text.count("started_at") >= 2, "conflicts.json carries no started_at"
    for key in ("file_name", "plot_page", "proposals"):
        assert key in text, f"walk.spec.ts does not resolve a Proposal's {key}"


def test_run_walk_spec_sets_walk_conflicts_to_the_walks_conflicts_json(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import run

    seen: dict[str, str] = {}

    class Playwright:
        """Popen's stand-in: records the environment, runs nothing."""

        pid = -1

        def __init__(self, args: list[str], **kwargs: Any) -> None:
            seen.update(kwargs["env"])

        def wait(self, timeout: float | None = None) -> int:
            return 0

    monkeypatch.setattr(subprocess, "Popen", Playwright)
    monkeypatch.setattr(run, "end_groups", lambda *args, **kwargs: None)
    walk = _plan(tmp_path)
    (walk.out_dir / "logs").mkdir(parents=True)

    code = run.walk_spec(tmp_path, walk, "synthetic", {SET: []}, smoke=False, started_at=STARTED)

    assert code == 0
    walk_conflicts = seen.get("WALK_CONFLICTS")  # never the whole environment in a message
    assert walk_conflicts == str(walk.out_dir / "conflicts.json"), "WALK_CONFLICTS is not the walk's"
