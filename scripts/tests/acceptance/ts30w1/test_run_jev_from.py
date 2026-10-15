"""S30-W1 acceptance, run.py's side: a G1 repeat walk starts from the earlier walk's Jev answers.

The owner's ruling (15 Oct 2026): "Re-run #2; #3 reuses its Jev answers". The contract:
1. "Before run.py drops `vextrus_walk_<sha8>` (step 7), it writes the walk's `platform_jevanswer` rows
   to `.private/work/walks/<sha40>/jev-answers.json` ... A failed export is an event line, never the
   walk's code."
2. "`--jev-from <sha40>`: after `seed_demo` and before the web stack serves or any read starts, insert
   those rows ... Refuse before serving, naming the reason, when the file is missing, malformed, or
   holds a model_version other than the pinned one."
3. "walk.json records `"jev_from": "<sha40>"` and `"jev_seeded": <rows>` (absent or null without the
   flag)."

The seams (this file's choice; no authority names them): `run.run(..., jev_from=<sha40>)` is the flag
`--jev-from`; `run.export_jev_answers` writes the file and `run.seed_jev_answers` inserts the rows
(each through `python -m scripts.walk.jev_answers`, test_jev_answers_seam.py's seam), returning how
many (`jev_seeded`). run.py itself adds the two keys to walk.json (a patched
`walk_spec` stands in for the spec here). The pinned model is read from the declared node
(`jev.SHEET_TYPE.model`).

Nothing here serves a stack or touches a database: every step is patched, in the manner of
scripts/walk/tests/acceptance/test_p6_walk_run.py. The Plan is built by hand from a synthetic sha.
"""

import importlib
import json
from pathlib import Path
from typing import Any

import pytest

from vextrus.platform.services import jev

run: Any = importlib.import_module("scripts.walk.run")

SHA = "0123456789abcdef0123456789abcdef01234567"
EARLIER = "89abcdef0123456789abcdef0123456789abcdef"
"""The earlier walk's head, whose answers the repeat starts from."""
DB = f"vextrus_walk_{SHA[:8]}"


def _plan(root: Path) -> Any:
    work = root / ".private" / "work"
    walk = run.Plan(
        sha=SHA,
        sha8=SHA[:8],
        db_name=DB,
        out_dir=work / "walks" / SHA,
        worktree=work / "walks" / "_src",
        web_port=5511,
        api_port=8811,
        env={
            "VEXTRUS_DB_NAME": DB,
            "VEXTRUS_WEB_PORT": "5511",
            "VEXTRUS_API_URL": "http://127.0.0.1:8811",
        },
    )
    (walk.out_dir / "logs").mkdir(parents=True)
    return walk


def _row(n: int, model: str | None = None) -> dict[str, Any]:
    return {
        "cache_key": f"{n:064x}",
        "node": "sheet_type",
        "model_version": model or jev.SHEET_TYPE.model,
        "options": ["floor_plan", "other"],
        "choice": "floor_plan",
        "confidence": "0.6100",
        "probabilities": {"floor_plan": "0.61", "other": "0.39"},
    }


def _answers(root: Path, sha: str, text: str) -> Path:
    """The earlier walk's jev-answers.json, where contract 1 writes it."""
    path = root / ".private" / "work" / "walks" / sha / "jev-answers.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


class Ledger:
    def __init__(self) -> None:
        self.seen: list[str] = []

    def note(self, name: str, value: Any = None) -> Any:
        self.seen.append(name)
        return value


def _steps(monkeypatch: pytest.MonkeyPatch, walk: Any, *, seed: bool = True) -> Ledger:
    """Every step of run() patched to a ledger; `seed=False` leaves run.seed_jev_answers real."""
    ledger = Ledger()
    monkeypatch.setattr(run, "prepare_checkout", lambda *a, **k: ledger.note("prepare_checkout"))
    monkeypatch.setattr(run, "prepare_database", lambda *a, **k: ledger.note("seed_demo"))
    monkeypatch.setattr(run, "serve", lambda *a, **k: ledger.note("serve"))
    monkeypatch.setattr(run, "write_sign_in", lambda *a, **k: None)
    monkeypatch.setattr(run, "judge_checks", lambda *a, **k: True)
    monkeypatch.setattr(run, "hold", lambda *a, **k: ledger.note("hold"))
    monkeypatch.setattr(run.Stack, "stop", lambda self: ledger.note("stop"))
    monkeypatch.setattr(run, "drop_database", lambda *a, **k: ledger.note("drop"))
    monkeypatch.setattr(run, "export_jev_answers", lambda *a, **k: ledger.note("export", 2))
    if seed:
        monkeypatch.setattr(run, "seed_jev_answers", lambda *a, **k: ledger.note("seed", 3))

    def walked(*args: Any, **kwargs: Any) -> int:
        ledger.note("walk_spec")
        (walk.out_dir / "walk.json").write_text(json.dumps({"sha": SHA}), encoding="utf-8")
        return 0

    monkeypatch.setattr(run, "walk_spec", walked)
    return ledger


def _record(walk: Any) -> dict[str, Any]:
    record: dict[str, Any] = json.loads((walk.out_dir / "walk.json").read_text(encoding="utf-8"))
    return record


def _details(root: Path) -> list[str]:
    """Each event line's detail, after `<UTC> WALK - <sha8> `."""
    log = root / ".private" / "work" / "factory" / "events.log"
    return [line.split(" ", 4)[4] for line in log.read_text(encoding="utf-8").splitlines()]


def test_a_repeat_seeds_after_seed_demo_and_before_the_stack_serves(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walk = _plan(tmp_path)
    _answers(tmp_path, EARLIER, json.dumps([_row(1), _row(2), _row(3)]))
    ledger = _steps(monkeypatch, walk)

    code = run.run(tmp_path, walk, sets={"set-a": []}, smoke=False, hold_minutes=0, jev_from=EARLIER)

    assert code == 0
    assert ledger.seen.count("seed") == 1
    assert ledger.seen.index("seed_demo") < ledger.seen.index("seed") < ledger.seen.index("serve")


def test_walk_json_records_jev_from_and_the_rows_seeded(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walk = _plan(tmp_path)
    _answers(tmp_path, EARLIER, json.dumps([_row(1), _row(2), _row(3)]))
    _steps(monkeypatch, walk)

    assert (
        run.run(tmp_path, walk, sets={"set-a": []}, smoke=False, hold_minutes=0, jev_from=EARLIER) == 0
    )

    record = _record(walk)
    assert record["jev_from"] == EARLIER
    assert record["jev_seeded"] == 3


def test_a_walk_without_the_flag_seeds_nothing_and_records_no_source(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walk = _plan(tmp_path)
    ledger = _steps(monkeypatch, walk)

    assert run.run(tmp_path, walk, sets={"set-a": []}, smoke=False, hold_minutes=0) == 0

    assert "seed" not in ledger.seen
    record = _record(walk)
    assert record.get("jev_from") is None
    assert record.get("jev_seeded") is None


def test_a_repeat_on_the_same_head_is_not_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Walk #3 repeats walk #2's head: its own folder's jev-answers.json is the source."""
    walk = _plan(tmp_path)
    _answers(tmp_path, SHA, json.dumps([_row(1)]))
    ledger = _steps(monkeypatch, walk)

    assert run.run(tmp_path, walk, sets={"set-a": []}, smoke=False, hold_minutes=0, jev_from=SHA) == 0

    assert "seed" in ledger.seen
    assert _record(walk)["jev_from"] == SHA


REFUSALS = {
    "missing": None,
    "malformed": '[{"cache_key": "00", "node": ',
    "another model": json.dumps([_row(1), _row(2, model="jev-0.0.1-not-pinned")]),
}


def _refused(root: Path, monkeypatch: pytest.MonkeyPatch, text: str | None) -> tuple[int, Ledger]:
    walk = _plan(root)
    if text is not None:
        _answers(root, EARLIER, text)
    ledger = _steps(monkeypatch, walk, seed=False)
    code = run.run(root, walk, sets={"set-a": []}, smoke=False, hold_minutes=0, jev_from=EARLIER)
    return code, ledger


@pytest.mark.parametrize("case", list(REFUSALS))
def test_a_repeat_refuses_before_serving_a_missing_malformed_or_other_model_file(
    case: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    code, ledger = _refused(tmp_path, monkeypatch, REFUSALS[case])

    assert code == 2
    assert "serve" not in ledger.seen
    assert "walk_spec" not in ledger.seen


def test_each_refusal_names_its_own_reason(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    said: dict[str, str] = {}
    for n, (case, text) in enumerate(REFUSALS.items()):
        capsys.readouterr()
        code, _ledger = _refused(tmp_path / str(n), monkeypatch, text)
        assert code == 2
        said[case] = capsys.readouterr().err.strip()
    assert len(set(said.values())) == len(REFUSALS), f"the reasons are not told apart: {said}"


@pytest.mark.parametrize("passed", [True, False], ids=["a passing walk", "a failing walk"])
def test_the_walks_answers_are_written_before_its_database_is_dropped(
    passed: bool, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A failing walk's answers are the ones a repeat needs (walk #2 failed a check)."""
    walk = _plan(tmp_path)
    ledger = _steps(monkeypatch, walk)
    monkeypatch.setattr(run, "judge_checks", lambda *a, **k: passed)

    code = run.run(tmp_path, walk, sets={"set-a": []}, smoke=False, hold_minutes=0)

    assert code == (0 if passed else 1)

    assert ledger.seen.count("export") == 1
    assert ledger.seen.index("walk_spec") < ledger.seen.index("export") < ledger.seen.index("drop")


def test_a_failed_export_is_an_event_line_and_never_the_walks_code(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    kept_root, failed_root = tmp_path / "kept", tmp_path / "failed"
    kept = _plan(kept_root)
    _steps(monkeypatch, kept)
    assert run.run(kept_root, kept, sets={"set-a": []}, smoke=False, hold_minutes=0) == 0

    failed = _plan(failed_root)
    ledger = _steps(monkeypatch, failed)

    def fails(*args: Any, **kwargs: Any) -> int:
        raise run.WalkError("export exited 1")

    monkeypatch.setattr(run, "export_jev_answers", fails)
    code = run.run(failed_root, failed, sets={"set-a": []}, smoke=False, hold_minutes=0)

    assert code == 0
    assert "drop" in ledger.seen, "the database is still dropped"
    details = _details(failed_root)
    assert "error" not in details
    assert set(details) - set(_details(kept_root)), "the failed export left no event line"


def test_the_flag_reaches_the_walk(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    taken: dict[str, Any] = {}
    monkeypatch.setattr(run, "plan", lambda *a, **k: _plan(tmp_path))
    monkeypatch.setattr(run, "set_files", lambda *a, **k: {"set-a": []})
    monkeypatch.setattr(run, "run", lambda *a, **k: taken.update(k) or 0)

    argv = [SHA, "--root", str(tmp_path), "--web-port", "5511", "--api-port", "8811"]
    run.main([*argv, "--jev-from", EARLIER])

    assert taken["jev_from"] == EARLIER


@pytest.mark.parametrize("given", ["0123abcd", "../../../reference", EARLIER.upper(), EARLIER + "0"])
def test_the_flag_refuses_anything_but_a_full_sha(
    given: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    ran: list[bool] = []
    monkeypatch.setattr(run, "plan", lambda *a, **k: _plan(tmp_path))
    monkeypatch.setattr(run, "set_files", lambda *a, **k: {"set-a": []})

    def runs(*args: Any, **kwargs: Any) -> int:
        ran.append(True)
        return 0

    monkeypatch.setattr(run, "run", runs)

    argv = [SHA, "--root", str(tmp_path), "--web-port", "5511", "--api-port", "8811"]
    assert run.main([*argv, "--jev-from", EARLIER]) == 0, "a full sha is taken"
    ran.clear()

    assert run.main([*argv, "--jev-from", given]) == 2

    assert ran == []
