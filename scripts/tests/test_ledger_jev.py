"""J-b (docs/specs/factory.md 3.14): a Jev triage sidecar is never read for a decision. A sidecar shaped
like a ledger record, in `ledger-jev/` beside the ledger, changes neither `check` nor `decide`."""

import json
from pathlib import Path

import pytest

from scripts.ledger import main

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"


def sidecar(root: Path) -> None:
    jev = root / "ledger-jev"
    jev.mkdir(parents=True)
    (jev / f"12-{H}.json").write_text(
        json.dumps({"schema_version": 1, "pr": 12, "head_sha": H, "round": 2, "verdict": "PASS"})
    )


def test_a_sidecar_round_does_not_count_as_recorded(tmp_path: Path) -> None:
    store = tmp_path / "ledger"
    sidecar(tmp_path)
    assert main(["check", "12", "--round", "1"], ledger_dir=store) == 0


def test_decide_is_the_same_with_and_without_a_sidecar(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    given = tmp_path / "final.txt"
    given.write_text(f"VERDICT: FIX at {H}\n")
    argv = ["decide", "--from", str(given), "--head", H]
    assert main(argv, ledger_dir=tmp_path / "ledger") == 0
    without = capsys.readouterr().out
    sidecar(tmp_path)
    assert main(argv, ledger_dir=tmp_path / "ledger") == 0
    assert capsys.readouterr().out == without
