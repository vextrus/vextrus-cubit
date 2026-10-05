"""T-WALK-1 acceptance: a re-walk is judged on its own findings, and one walk gets one verdict.

The ticket (session 12 phase 6, closes #300): "A re-walk is judged with the previous walk's findings":
`set_aside` must move `findings.json`, `triage.json` and `drafts.json` aside with `walk.json`, never
overwriting an earlier move. "Two verdict runs on one walk can both succeed": `verdict.main` must make
`judged_once` and the write one step, so the second run meets the first's verdict and refuses (exit 2).

Synthetic data only, in f5's shapes (`test_f5_verdict.py`); every time is a fixed string.
"""

import contextlib
import json
import os
import threading
from pathlib import Path
from typing import Any

import pytest
from _f5_contract import WALKED_ITEMS  # type: ignore[import-not-found, unused-ignore]

SHA = "0123456789abcdef0123456789abcdef01234567"
FIRST_STARTED = "2026-10-05T01:00:00Z"
SECOND_STARTED = "2026-10-05T03:00:00Z"
STAMPS = (
    "2026-10-05T02:00:00Z",
    "2026-10-05T04:00:00Z",
    "2026-10-05T04:30:00Z",
    "2026-10-05T05:00:00Z",
)
MOVED = ("walk", "findings", "triage", "drafts")
FIXED_MTIME = 1_791_000_000  # 2026-10-03, a fixed second for both moves in T2


def _walk(started_at: str) -> dict[str, Any]:
    """A walk.json within every limit of `_expect()` (f5's passing walk), with its `started_at`."""
    return {
        "schema": 1,
        "sha": SHA,
        "started_at": started_at,
        "urls": {"web": "http://127.0.0.1:5511", "api": "http://127.0.0.1:8811"},
        "sets": {
            "set-a": {
                "files": [
                    {"id": 1, "state": "done", "read_seconds": 30},
                    {"id": 2, "state": "done", "read_seconds": 45},
                ],
                "acts": [
                    {"kind": kind, "ms": 100 + 10 * n, "read_running": True}
                    for n, kind in enumerate(["confirm", "answer", "exclude", "undo"] * 5)
                ],
                "questions": {
                    "structural": {"low_confidence": 2, "continuation": 1},
                    "architectural": {"low_confidence": 1},
                },
                "burden": {
                    "structural": {
                        "sheets": 10,
                        "one_source": 8,
                        "bulk_confirmable": 9,
                        "continuation_questions": 1,
                        "false_continuation_questions": 0,
                    },
                    "architectural": {
                        "sheets": 5,
                        "one_source": 5,
                        "bulk_confirmable": 5,
                        "continuation_questions": 0,
                        "false_continuation_questions": 0,
                    },
                },
            }
        },
    }


def _expect() -> dict[str, Any]:
    return {
        "files": 2,
        "p95_ms_max": 1000,
        "questions_max_per_discipline": 3,
        "bulk_confirmable_share_min": 0.8,
        "false_continuation_max": 0,
    }


def _finding(n: int) -> dict[str, Any]:
    from scripts.walk.sanitize import DEFECT_CLASSES, SCREENS

    return {
        "id": f"f-{n}",
        "item": "M0-FL3",
        "defect_class": sorted(DEFECT_CLASSES)[0],
        "screen": sorted(SCREENS)[0],
        "delta": 1.5,
        "severity": "OTHER",
        "misleading": False,
        "issue": 100 + n,
        "dedup_comment_on": None,
    }


def _layer() -> dict[str, Any]:
    """Every walked item PASS and one finding that neither blocks nor misleads: a PASS layer."""
    return {
        "items": [{"item": item, "status": "PASS"} for item in WALKED_ITEMS],
        "findings": [_finding(1)],
    }


def _lay_out(tmp_path: Path) -> tuple[Path, Path, dict[str, str]]:
    """`<walks>/<sha>/` with a passing walk.json, findings.json, triage.json and drafts.json."""
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(_expect()))
    folder = walks / SHA
    folder.mkdir(parents=True)
    texts = {
        "walk": json.dumps(_walk(FIRST_STARTED)),
        "findings": json.dumps(_layer()),
        "triage": json.dumps({"synthetic": "triage of the first walk"}),
        "drafts": json.dumps({"synthetic": "drafts of the first walk"}),
    }
    for name, text in texts.items():
        (folder / f"{name}.json").write_text(text)
    return walks, expect_dir, texts


def _argv(walks: Path, expect_dir: Path) -> list[str]:
    return [
        SHA,
        "--leak-hits",
        "0",
        "--ref",
        "main",
        "--walks-dir",
        str(walks),
        "--expect-dir",
        str(expect_dir),
    ]


@pytest.fixture
def fixed_stamps(monkeypatch: pytest.MonkeyPatch) -> None:
    """`verdict.utc_now` gives the fixed STAMPS in call order (thread-safe)."""
    from scripts.walk import verdict

    given = iter(STAMPS)
    lock = threading.Lock()

    def stamp() -> str:
        with lock:
            return next(given)

    monkeypatch.setattr(verdict, "utc_now", stamp)


def _dated(folder: Path, name: str) -> list[Path]:
    """`<name>.<stamp>.json` files (a dated copy set aside), not `<name>.json` itself."""
    return sorted(p for p in folder.glob(f"{name}.*.json") if p.name != f"{name}.json")


@pytest.mark.usefixtures("fixed_stamps")
def test_a_re_walk_is_never_judged_with_the_earlier_walks_findings(tmp_path: Path) -> None:
    from scripts.walk import run, verdict

    walks, expect_dir, texts = _lay_out(tmp_path)
    folder = walks / SHA

    assert verdict.main(_argv(walks, expect_dir)) == 0  # the first walk: a PASS
    first = json.loads((folder / "verdict.json").read_text())
    assert first["result"] == "PASS"
    assert first["started_at"] == FIRST_STARTED

    run.set_aside(folder)
    for name in MOVED:
        assert not (folder / f"{name}.json").exists(), f"{name}.json was not set aside"
        dated = _dated(folder, name)
        assert len(dated) == 1, f"{name}.json is set aside {len(dated)} times"
        assert dated[0].read_text() == texts[name], f"{name}.json's contents changed when set aside"

    (folder / "walk.json").write_text(json.dumps(_walk(SECOND_STARTED)))  # a re-walk, no findings yet
    code = verdict.main(_argv(walks, expect_dir))

    second = json.loads((folder / "verdict.json").read_text())
    assert second["started_at"] == SECOND_STARTED
    assert second["result"] != "PASS", "the re-walk was judged with the first walk's findings"
    assert code == 1
    assert second["agent_layer"]["findings"] == []
    assert {item["status"] for item in second["agent_layer"]["items"]} == {"NOT_WALKED"}


def test_set_aside_never_overwrites_an_earlier_move_in_the_same_second(tmp_path: Path) -> None:
    from scripts.walk import run

    folder = tmp_path / "walks" / SHA
    folder.mkdir(parents=True)
    for walk_n in (1, 2):
        for name in MOVED:
            path = folder / f"{name}.json"
            path.write_text(json.dumps({"synthetic": f"{name} of walk {walk_n}"}))
            os.utime(path, (FIXED_MTIME, FIXED_MTIME))
        run.set_aside(folder)

    for name in MOVED:
        assert not (folder / f"{name}.json").exists()
        kept = sorted(json.loads(p.read_text())["synthetic"] for p in _dated(folder, name))
        assert kept == [f"{name} of walk 1", f"{name} of walk 2"], f"{name}: {kept}"


@pytest.mark.usefixtures("fixed_stamps")
def test_two_concurrent_verdict_runs_on_one_walk_write_one_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from scripts.walk import verdict

    walks, expect_dir, _ = _lay_out(tmp_path)
    folder = walks / SHA
    real_evaluate = verdict.evaluate
    barrier = threading.Barrier(2, timeout=1)

    def meeting(*args: Any, **kwargs: Any) -> dict[str, Any]:
        # Both runs meet here if nothing holds the second back; a run waiting on a lock never
        # arrives, so the first goes on once the barrier breaks.
        with contextlib.suppress(threading.BrokenBarrierError):
            barrier.wait()
        judged: dict[str, Any] = real_evaluate(*args, **kwargs)
        return judged

    monkeypatch.setattr(verdict, "evaluate", meeting)
    codes: list[int] = []
    codes_lock = threading.Lock()

    def judge() -> None:
        code = verdict.main(_argv(walks, expect_dir))
        with codes_lock:
            codes.append(code)

    threads = [threading.Thread(target=judge) for _ in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    assert not any(thread.is_alive() for thread in threads), "a verdict run never finished"

    assert sorted(code == 2 for code in codes) == [False, True], f"exit codes {codes}"
    assert next(code for code in codes if code != 2) in (0, 1)
    written = sorted(p.name for p in folder.glob("verdict*.json"))
    assert len(written) == 1, f"two runs wrote {written}"
    left = [p.name for p in folder.rglob("*") if p.name.endswith(".tmp")]
    assert left == [], left
