"""S14-R3 (factory-next.md section 8, row 11; issue #368), "Replay gate and cutover": "Replay `review.py`
on at least 12 session-13 heads with confirmed findings; recall of at least 90 % is required", checked by
"script `replay.py` exits non-zero below 90 % recall". The machine's real review journals cannot be in a
committed test, so the gate is pinned on synthetic cases.

The seam (named here; the builder documents it in the script):

    python -m scripts.factory.replay --cases <dir> [--reviews <dir>]

- A case is a folder `<cases>/<name>/` holding `case.json`:
  `{"pr": <int>, "head": "<40 hex>", "confirmed": [{"file": ..., "line": <int>, "summary": ...}, ...]}`,
  the PR head and the findings confirmed on it (file and line plus a summary).
- Its review result is `<cases>/<name>/review.json`: the JSON object that
  `python -m scripts.factory.review run` prints
  (`{"pr", "head", "findings": [{"id", "score", "file", "line", "summary", "status", "method"}]}`).
  With `--reviews <dir>` it is read from `<dir>/<name>.json` instead, so real results can be fed from
  wherever the builder's runs left them.
- A confirmed finding is recalled when the review reports a finding (not one it REFUTED) on the same file
  within a few lines of it. The script prints the recall (a line naming "recall" with its per cent) and
  exits 0 at 90 % or more, non-zero below; no case, no confirmed finding, a case without its review or a
  review of another head is refused (non-zero).
"""

import json
import os
import re
import subprocess
import sys
from collections.abc import Callable
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
FILES = (
    "scripts/factory/review.py",
    "scripts/ledger.py",
    "vextrus/takeoff/views.py",
    "engine/reading/step1.py",
)
PERCENT = re.compile(r"(\d+(?:\.\d+)?)\s*%")


def head(n: int) -> str:
    return f"{n:040x}"


def confirmed(n: int) -> list[dict[str, object]]:
    """`n` confirmed findings, each on its own file and line, far apart."""
    return [
        {"file": FILES[i % len(FILES)], "line": 100 * (i + 1), "summary": f"finding {i + 1} is real"}
        for i in range(n)
    ]


def reported(
    found: dict[str, object], *, shift: int = 0, file: str | None = None, status: str = "CONFIRMED"
) -> dict[str, object]:
    """A review finding of 50 or more at (or `shift` lines from) a confirmed one, as review.py
    views it."""
    return {
        "id": "A1",
        "score": 75,
        "file": file or found["file"],
        "line": int(found["line"]) + shift,  # type: ignore[call-overload]
        "summary": "the review says so too",
        "status": status,
        "method": "replay" if status == "CONFIRMED" else "refuter",
    }


def write_case(
    cases: Path,
    name: str,
    pr: int,
    found: list[dict[str, object]],
    findings: list[dict[str, object]] | None,
    *,
    reviewed: str | None = None,
    reviews: Path | None = None,
) -> None:
    """One case; its review reports `findings` (None: no review result is written)."""
    folder = cases / name
    folder.mkdir(parents=True)
    (folder / "case.json").write_text(json.dumps({"pr": pr, "head": head(pr), "confirmed": found}))
    if findings is None:
        return
    review = {
        "pr": pr,
        "head": reviewed or head(pr),
        "verdict": "FIX" if findings else "PASS",
        "findings": [dict(item, id=f"A{i}") for i, item in enumerate(findings, start=1)],
    }
    target = (reviews / f"{name}.json") if reviews else (folder / "review.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(review))


def corpus(tmp_path: Path, sizes: list[int], recalled: int) -> Path:
    """Cases of `sizes` confirmed findings each; the reviews find the first `recalled` of them."""
    cases = tmp_path / "cases"
    left = recalled
    for index, size in enumerate(sizes, start=1):
        found = confirmed(size)
        hits = found[: max(0, min(size, left))]
        left -= len(hits)
        write_case(cases, f"pr{400 + index}", 400 + index, found, [reported(f) for f in hits])
    return cases


def eleven(tmp_path: Path) -> Path:
    """Eleven one-finding heads, each fully recalled; a twelfth (`last_case`) decides the gate."""
    cases = tmp_path / "cases"
    for index in range(1, 12):
        found = confirmed(1)
        write_case(cases, f"pr{500 + index}", 500 + index, found, [reported(found[0])])
    return cases


def replay(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "scripts.factory.replay", *args],
        cwd=REPO, env={**os.environ, "PYTHONPATH": str(REPO)},
        capture_output=True, text=True, check=False, timeout=300,
    )  # fmt: skip


def recall(done: subprocess.CompletedProcess[str]) -> float:
    """The per cent on the line that names the recall."""
    for line in done.stdout.splitlines():
        if "recall" in line.lower() and (found := PERCENT.search(line)):
            return float(found.group(1))
    raise AssertionError(f"no recall printed: {done.stdout!r} {done.stderr!r}")


def refused(done: subprocess.CompletedProcess[str]) -> None:
    """Refused by the replay itself: a non-zero exit with its own words, not a crash or a missing
    module."""
    out = done.stdout + done.stderr
    assert done.returncode != 0, out
    assert "Traceback" not in out, out
    assert "No module named" not in out, out


def last_case(
    cases: Path, findings_of: Callable[[list[dict[str, object]]], list[dict[str, object]]]
) -> Path:
    """Add the deciding twelfth head: 9 confirmed findings (20 in all), its review's findings made by
    `findings_of` from them: all 9 recalled reads 100 %, none 55 %."""
    found = confirmed(9)
    write_case(cases, "pr512", 512, found, findings_of(found))
    return cases


# Twelve heads, 100 confirmed findings: four of 9 and eight of 8.
SIZES = [9, 9, 9, 9, 8, 8, 8, 8, 8, 8, 8, 8]


def test_ninety_per_cent_recall_passes_the_gate(tmp_path: Path) -> None:
    done = replay("--cases", str(corpus(tmp_path, SIZES, recalled=90)))
    assert done.returncode == 0, done.stdout + done.stderr
    assert abs(recall(done) - 90) < 0.51


def test_eighty_nine_per_cent_recall_fails_the_gate(tmp_path: Path) -> None:
    done = replay("--cases", str(corpus(tmp_path, SIZES, recalled=89)))
    assert done.returncode != 0, done.stdout + done.stderr
    assert abs(recall(done) - 89) < 0.51


def test_full_recall_passes_and_prints_one_hundred(tmp_path: Path) -> None:
    done = replay("--cases", str(corpus(tmp_path, SIZES, recalled=100)))
    assert done.returncode == 0, done.stdout + done.stderr
    assert abs(recall(done) - 100) < 0.51


def test_no_cases_is_refused(tmp_path: Path) -> None:
    cases = tmp_path / "cases"
    cases.mkdir()
    done = replay("--cases", str(cases))
    refused(done)


def test_a_missing_cases_folder_is_refused(tmp_path: Path) -> None:
    done = replay("--cases", str(tmp_path / "nowhere"))
    refused(done)


def test_cases_with_no_confirmed_finding_are_refused(tmp_path: Path) -> None:
    cases = tmp_path / "cases"
    for index in range(1, 13):
        write_case(cases, f"pr{600 + index}", 600 + index, [], [])
    done = replay("--cases", str(cases))
    refused(done)


def test_a_finding_reported_a_few_lines_away_is_recalled(tmp_path: Path) -> None:
    cases = last_case(eleven(tmp_path), lambda found: [reported(f, shift=2) for f in found])
    done = replay("--cases", str(cases))
    assert done.returncode == 0, done.stdout + done.stderr
    assert abs(recall(done) - 100) < 0.51


def test_a_finding_reported_far_from_the_confirmed_line_is_not_recalled(tmp_path: Path) -> None:
    cases = last_case(eleven(tmp_path), lambda found: [reported(f, shift=30) for f in found])
    done = replay("--cases", str(cases))
    assert done.returncode != 0, done.stdout + done.stderr
    assert abs(recall(done) - 55) < 0.51  # 11 of 20


def test_the_same_line_in_another_file_is_not_recalled(tmp_path: Path) -> None:
    cases = last_case(
        eleven(tmp_path), lambda found: [reported(f, file="docs/elsewhere.md") for f in found]
    )
    done = replay("--cases", str(cases))
    assert done.returncode != 0, done.stdout + done.stderr
    assert abs(recall(done) - 55) < 0.51


def test_a_finding_the_review_refuted_does_not_recall(tmp_path: Path) -> None:
    cases = last_case(eleven(tmp_path), lambda found: [reported(f, status="REFUTED") for f in found])
    done = replay("--cases", str(cases))
    assert done.returncode != 0, done.stdout + done.stderr
    assert abs(recall(done) - 55) < 0.51


def test_a_case_without_its_review_result_is_refused(tmp_path: Path) -> None:
    # Thirteen one-finding heads, every review finds its finding, one review is missing: counted as a
    # miss it would still read 92 %, so only a refusal fails it.
    cases = tmp_path / "cases"
    for index in range(1, 14):
        found = confirmed(1)
        findings = None if index == 13 else [reported(found[0])]
        write_case(cases, f"pr{700 + index}", 700 + index, found, findings)
    done = replay("--cases", str(cases))
    refused(done)


def test_a_review_of_another_head_is_refused(tmp_path: Path) -> None:
    cases = tmp_path / "cases"
    for index in range(1, 14):
        found = confirmed(1)
        stale = head(9999) if index == 13 else None
        write_case(cases, f"pr{800 + index}", 800 + index, found, [reported(found[0])], reviewed=stale)
    done = replay("--cases", str(cases))
    refused(done)


def test_review_results_are_read_from_the_reviews_folder_when_given(tmp_path: Path) -> None:
    cases, reviews = tmp_path / "cases", tmp_path / "reviews"
    for index in range(1, 13):
        found = confirmed(2)
        write_case(
            cases, f"pr{900 + index}", 900 + index, found, [reported(f) for f in found], reviews=reviews
        )
    assert not list(cases.glob("*/review.json"))
    done = replay("--cases", str(cases), "--reviews", str(reviews))
    assert done.returncode == 0, done.stdout + done.stderr
    assert abs(recall(done) - 100) < 0.51
