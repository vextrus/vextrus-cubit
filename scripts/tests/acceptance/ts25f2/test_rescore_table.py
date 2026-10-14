"""S25-F2: sessions 18-24's recorded round-1 verdicts, re-scored under the new bar (the Q14 pilot's
"before" baseline).

Session 25's brief (step 3, F2): "Re-score sessions 18-24's round-1 verdicts under the new bar first:
that is the Q14 pilot's baseline, or the pilot mixes the two changes." Q14: the pilot "is measured by
round-1 PASS before and after".

Seam (named here: the authority names the job, not the script): `scripts.factory.rescore.main(argv) ->
int`, run as
    python -m scripts.factory.rescore --verdicts <folder> --ledger <folder> --out <table>
- `--verdicts`: review.py's kept decision inputs, `<PR>-<head12>-r<round>.txt` (VERDICT and FINDING
  lines; for the re-score, each FINDING line tagged `class=<class> boundary=<yes|no>` after its file, as
  in test_verdict_follows_the_class_bar.py).
- `--ledger`: the ledger's records, `<PR>-<head40>.json` (`round`, `verdict`, `head`, `pr`).
It re-decides each round-1 input with `scripts.ledger`'s bar, writes the table to `--out` (one row per
round-1 record: its PR, the recorded verdict, then the re-scored verdict) and prints one JSON line on
stdout, `{"rounds": <n>, "pass_before": <n>, "pass_after": <n>}`: round 1's PASS count as recorded and
as re-scored. A round-2 record is no row. Which sessions' PRs are read (a date or PR window) is the
builder's: not pinned. Every file here is synthetic, made in the test's folder."""

import importlib
import json
from pathlib import Path
from typing import Any

import pytest

LAX = "web/src/components/badge.tsx"
EDGE = f"{LAX} class=edge boundary=no"
USER = f"{LAX} class=user-facing boundary=no"
OBSERVED = f"{USER} observed=yes"  # S28-R1's third tag (the owner's ruling, 14 Oct 2026)
HEADS = {
    601: "6010000000000000000000000000000000000001",
    602: "6020000000000000000000000000000000000002",
    603: "6030000000000000000000000000000000000003",
    604: "6040000000000000000000000000000000000004",
    605: "6050000000000000000000000000000000000005",
    606: "6060000000000000000000000000000000000006",
}
# PR: (round, the recorded verdict, its decision lines with the head's sha filled in)
ROUNDS: dict[int, tuple[int, str, tuple[str, ...]]] = {
    # an edge 62 off a trust boundary: recorded FIX under the old bar, PASS under the new
    601: (1, "FIX", ("VERDICT: FIX at {h}", f"FINDING f1 62 CONFIRMED {EDGE}")),
    # a user-facing 60 a QS would meet (observed=yes): FIX before and after
    602: (1, "FIX", ("VERDICT: FIX at {h}", f"FINDING f1 60 CONFIRMED {OBSERVED}")),
    # nothing found: PASS before and after
    603: (1, "PASS", ("VERDICT: PASS at {h}",)),
    # a round 2: no row
    604: (2, "PASS", ("VERDICT: PASS at {h}",)),
    # a lens BLOCK: BLOCK before and after
    605: (1, "BLOCK", ("VERDICT: BLOCK at {h}", f"FINDING f1 55 CONFIRMED {EDGE}")),
    # S28-R1: a user-facing 60 kept before the observed= tag reads as not observed: FIX, then PASS
    606: (1, "FIX", ("VERDICT: FIX at {h}", f"FINDING f1 60 CONFIRMED {USER}")),
}


@pytest.fixture
def world(tmp_path: Path) -> Path:
    verdicts, records = tmp_path / "verdicts", tmp_path / "records"
    verdicts.mkdir()
    records.mkdir()
    for pr, (round_, recorded, lines) in ROUNDS.items():
        head = HEADS[pr]
        text = "".join(line.format(h=head) + "\n" for line in lines)
        (verdicts / f"{pr}-{head[:12]}-r{round_}.txt").write_text(text)
        record = {
            "schema_version": 1,
            "pr": pr,
            "head": head,
            "round": round_,
            "verdict": recorded,
            "counts": {"reviewers": 1},
            "decision_input_sha256": "0" * 64,
            "comment_id": 1,
            "exception": None,
            "source": "review-pr",
            "recorded_at": "2026-10-10T00:00:00Z",
        }
        (records / f"{pr}-{head}.json").write_text(json.dumps(record) + "\n")
    return tmp_path


def rescore(world: Path, capsys: pytest.CaptureFixture[str]) -> tuple[dict[str, Any], list[str]]:
    rescore_module: Any = importlib.import_module("scripts.factory.rescore")

    out = world / "table.md"
    argv = ["--verdicts", str(world / "verdicts"), "--ledger", str(world / "records"), "--out", str(out)]
    code = rescore_module.main(argv)
    printed = capsys.readouterr()
    assert code == 0, printed.out + printed.err
    [line] = [row for row in printed.out.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return loaded, out.read_text().splitlines()


def row_of(table: list[str], pr: int) -> str:
    [row] = [line for line in table if str(pr) in line]
    return row


def test_the_summary_counts_round_1_and_its_pass_before_and_after(
    world: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    summary, _ = rescore(world, capsys)
    assert summary == {"rounds": 5, "pass_before": 1, "pass_after": 3}  # S28-R1: 606 added


@pytest.mark.parametrize(
    ("pr", "before", "after"),
    [
        (601, "FIX", "PASS"),
        (602, "FIX", "FIX"),
        (603, "PASS", "PASS"),
        (605, "BLOCK", "BLOCK"),
        (606, "FIX", "PASS"),
    ],
)
def test_each_round_1_record_is_one_row_with_its_recorded_then_its_rescored_verdict(
    world: Path, capsys: pytest.CaptureFixture[str], pr: int, before: str, after: str
) -> None:
    _, table = rescore(world, capsys)
    row = row_of(table, pr)
    words = [word for word in row.replace("|", " ").split() if word in ("PASS", "FIX", "BLOCK")]
    assert words == [before, after], row


def test_a_round_2_record_is_no_row(world: Path, capsys: pytest.CaptureFixture[str]) -> None:
    _, table = rescore(world, capsys)
    assert not [line for line in table if "604" in line]
