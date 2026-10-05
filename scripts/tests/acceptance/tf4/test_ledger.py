"""Ticket f4, T6: the review ledger (`python -m scripts.ledger`; docs/specs/factory.md 2.2
"Review record").

`decide` is the only place a verdict is computed, from the reviewers' and refuters' final lines; `check`
refuses a round past the cap before any reviewer starts; `record` writes the local record of truth
(`contracts/ledger-record.schema.json`) once per PR and head, after a leak scan and one marker comment.

Seam (fixed by the ticket): `scripts.ledger.main(argv, *, scan, post, ledger_dir)`; `scan(text)` returns
the leak-hit count (an exception: the scanner is unavailable); `post(pr, body)` posts a PR comment and
returns its id. Exit codes: 0 ok, 2 bad input or usage, 3 refused.

Decision input, one record per line: `VERDICT: PASS|FIX|BLOCK at <40-hex>` (one per reviewer lens) and
`FINDING <id> <score 0-100> <CONFIRMED|REFUTED|UNPROVEN|->` (the refuter's verdict; `-`: none run).
"""

import hashlib
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.tf4._schema import contract, errors

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
PR = 12
COUNT_KEYS = {
    "reviewers",
    "findings",
    "findings_ge_50",
    "confirmed",
    "refuted",
    "unproven",
    "unrefuted_ge_50",
}


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """The record of truth is written in a local session; these tests run as one unless they say not."""
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


class Poster:
    def __init__(self, comment_id: int = 4242) -> None:
        self.calls: list[tuple[int, str]] = []
        self.comment_id = comment_id

    def __call__(self, pr: int, body: str) -> int:
        self.calls.append((pr, body))
        return self.comment_id


class Scanner:
    def __init__(self, hits: int = 0, fail: bool = False) -> None:
        self.texts: list[str] = []
        self.hits = hits
        self.fail = fail

    def __call__(self, text: str) -> int:
        self.texts.append(text)
        if self.fail:
            raise OSError("leak scan unavailable")
        return self.hits


def ledger(
    argv: list[str],
    capsys: pytest.CaptureFixture[str],
    ledger_dir: Path,
    *,
    scan: Callable[[str], int] | None = None,
    post: Callable[[int, str], int] | None = None,
) -> tuple[int, str]:
    """Run the ledger's command line; its exit code and everything it printed."""
    from scripts.ledger import main

    code = main(argv, scan=scan or Scanner(), post=post or Poster(), ledger_dir=ledger_dir)
    out = capsys.readouterr()
    return code, out.out + out.err


def lines(path: Path, *rows: str) -> Path:
    path.write_text("".join(f"{row}\n" for row in rows))
    return path


def decided(output: str) -> dict[str, Any]:
    """The one JSON line `decide` prints."""
    [line] = [row for row in output.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return loaded


def counts(**given: int) -> dict[str, int]:
    return {key: given.get(key, 0) for key in COUNT_KEYS}


PASS2 = (f"VERDICT: PASS at {H}", f"VERDICT: PASS at {H}")


def test_all_reviewers_pass_with_no_findings_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = lines(tmp_path / "final.txt", *PASS2)
    code, out = ledger(["decide", "--from", str(source), "--head", H], capsys, tmp_path / "ledger")
    assert code == 0
    result = decided(out)
    assert set(result) == {"verdict", "counts", "decision_input_sha256"}
    assert result["verdict"] == "PASS"
    assert result["counts"] == counts(reviewers=2)
    assert result["decision_input_sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()


def test_a_finding_of_50_or_more_with_no_refuter_verdict_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = lines(tmp_path / "final.txt", *PASS2, "FINDING f1 75 -")
    code, out = ledger(["decide", "--from", str(source), "--head", H], capsys, tmp_path / "ledger")
    assert code == 2
    assert "f1" in out
    assert '"PASS"' not in out


@pytest.mark.parametrize(
    ("finding", "verdict", "expected"),
    [
        (
            "FINDING f1 75 CONFIRMED",
            "FIX",
            counts(reviewers=2, findings=1, findings_ge_50=1, confirmed=1),
        ),
        ("FINDING f1 75 UNPROVEN", "FIX", counts(reviewers=2, findings=1, findings_ge_50=1, unproven=1)),
        ("FINDING f1 75 REFUTED", "PASS", counts(reviewers=2, findings_ge_50=1, refuted=1)),
        ("FINDING f2 49 -", "PASS", counts(reviewers=2, findings=1)),
    ],
    ids=["confirmed-stands", "unproven-stands", "refuted-dropped", "below-50-stands-but-passes"],
)
def test_a_finding_stands_unless_refuted_and_only_50_or_more_raises_pass_to_fix(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    finding: str,
    verdict: str,
    expected: dict[str, int],
) -> None:
    source = lines(tmp_path / "final.txt", *PASS2, finding)
    code, out = ledger(["decide", "--from", str(source), "--head", H], capsys, tmp_path / "ledger")
    assert code == 0
    result = decided(out)
    assert result["verdict"] == verdict
    assert result["counts"] == expected


@pytest.mark.parametrize(
    ("rows", "verdict"),
    [
        ((f"VERDICT: PASS at {H}", f"VERDICT: BLOCK at {H}", f"VERDICT: FIX at {H}"), "BLOCK"),
        ((f"VERDICT: PASS at {H}", f"VERDICT: FIX at {H}"), "FIX"),
    ],
    ids=["block-wins", "fix-over-pass"],
)
def test_the_worst_reviewer_verdict_wins(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rows: tuple[str, ...], verdict: str
) -> None:
    source = lines(tmp_path / "final.txt", *rows)
    code, out = ledger(["decide", "--from", str(source), "--head", H], capsys, tmp_path / "ledger")
    assert code == 0
    assert decided(out)["verdict"] == verdict
    assert decided(out)["counts"]["reviewers"] == len(rows)


@pytest.mark.parametrize(
    "rows",
    [
        (f"VERDICT: PASS at {OTHER}",),
        (f"VERDICT: PASS at {H}", f"VERDICT: PASS at {OTHER}"),
        (),
        (f"VERDICT: PASS at {H}", "the reviewer says it is fine"),
        (f"VERDICT: GOOD at {H}",),
        (f"VERDICT: PASS at {H}", "FINDING f1 101 CONFIRMED"),
        (f"VERDICT: PASS at {H}", "FINDING f1 -1 CONFIRMED"),
        (f"VERDICT: PASS at {H}", "FINDING f1 60 MAYBE"),
        (f"VERDICT: PASS at {H}", "FINDING f1 20 -", "FINDING f1 30 -"),
        ("FINDING f1 20 -",),
    ],
    ids=[
        "another-head",
        "one-line-another-head",
        "empty",
        "free-text",
        "unknown-verdict",
        "score-over-100",
        "score-below-0",
        "unknown-refuter-word",
        "duplicate-finding-id",
        "no-verdict-line",
    ],
)
def test_a_bad_decision_input_is_refused_as_bad_input(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rows: tuple[str, ...]
) -> None:
    source = lines(tmp_path / "final.txt", *rows)
    code, _ = ledger(["decide", "--from", str(source), "--head", H], capsys, tmp_path / "ledger")
    assert code == 2


@pytest.mark.parametrize(
    ("argv", "code"),
    [
        (["--round", "1"], 0),
        (["--round", "2"], 0),
        (["--round", "3"], 3),
        (["--round", "3", "--exception", "crash", "--reason", "the Takeoff page crashes"], 0),
        (["--round", "3", "--exception", "security75", "--reason", "a tenant reads another's"], 0),
        (["--round", "3", "--exception", "false-statement", "--reason", "a wrong total"], 0),
        (["--round", "3", "--exception", "deadline", "--reason", "we are late"], 3),
    ],
    ids=["1", "2", "3-no-exception", "3-crash", "3-security75", "3-false-statement", "3-unknown"],
)
def test_check_refuses_a_third_round_without_an_allowed_exception(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], argv: list[str], code: int
) -> None:
    assert ledger(["check", str(PR), *argv], capsys, tmp_path / "ledger")[0] == code


def test_check_refuses_a_round_not_above_the_highest_recorded(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(tmp_path / "final.txt", f"VERDICT: FIX at {H}")
    recorded = ["record", str(PR), "--round", "2", "--head", H, "--from", str(source)]
    assert ledger(recorded, capsys, store)[0] == 0
    assert ledger(["check", str(PR), "--round", "2"], capsys, store)[0] == 3
    assert ledger(["check", str(PR), "--round", "1"], capsys, store)[0] == 3
    allowed = ["--round", "3", "--exception", "crash", "--reason", "the export crashes"]
    assert ledger(["check", str(PR), *allowed], capsys, store)[0] == 0
    assert ledger(["check", str(PR + 1), "--round", "1"], capsys, store)[0] == 0


def test_record_writes_the_contracts_record_after_posting_one_marker(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(tmp_path / "final.txt", *PASS2)
    post = Poster(comment_id=987654)
    code, _ = ledger(
        ["record", str(PR), "--round", "1", "--head", H, "--from", str(source)], capsys, store, post=post
    )
    assert code == 0
    assert post.calls == [(PR, f"<!-- vextrus-review round=1 head={H} verdict=PASS findings=0 -->")]
    record = json.loads((store / f"{PR}-{H}.json").read_text())
    schema = contract("ledger-record.schema.json")
    assert set(record) == set(schema["required"])
    assert errors(record, schema) == []
    assert record["schema_version"] == 1
    assert (record["pr"], record["head"], record["round"]) == (PR, H, 1)
    assert record["verdict"] == "PASS"
    assert record["counts"] == counts(reviewers=2)
    assert record["decision_input_sha256"] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert record["comment_id"] == 987654
    assert record["exception"] is None
    assert record["source"] == "review-pr"


def test_the_markers_findings_count_is_the_standing_findings(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(
        tmp_path / "final.txt",
        *PASS2,
        "FINDING a 80 CONFIRMED",
        "FINDING b 70 REFUTED",
        "FINDING c 10 -",
    )
    post = Poster()
    argv = ["record", str(PR), "--round", "2", "--head", H, "--from", str(source)]
    assert ledger(argv, capsys, store, post=post)[0] == 0
    assert post.calls == [(PR, f"<!-- vextrus-review round=2 head={H} verdict=FIX findings=2 -->")]
    assert json.loads((store / f"{PR}-{H}.json").read_text())["counts"]["findings"] == 2


def test_a_record_is_never_overwritten(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    fix = lines(tmp_path / "fix.txt", f"VERDICT: FIX at {H}")
    passing = lines(tmp_path / "pass.txt", *PASS2)
    post = Poster()
    assert (
        ledger(
            ["record", str(PR), "--round", "1", "--head", H, "--from", str(fix)],
            capsys,
            store,
            post=post,
        )[0]
        == 0
    )
    first = (store / f"{PR}-{H}.json").read_bytes()
    again = ["record", str(PR), "--round", "2", "--head", H, "--from", str(passing)]
    assert ledger(again, capsys, store, post=post)[0] == 3
    assert (store / f"{PR}-{H}.json").read_bytes() == first
    assert len(post.calls) == 1


@pytest.mark.parametrize("scanner", [Scanner(hits=2), Scanner(fail=True)], ids=["hit", "unavailable"])
def test_record_refuses_on_a_leak_hit_or_no_scanner_and_echoes_nothing_scanned(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], scanner: Scanner
) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(tmp_path / "final.txt", *PASS2)
    post = Poster()
    argv = ["record", str(PR), "--round", "1", "--head", H, "--from", str(source)]
    code, out = ledger(argv, capsys, store, scan=scanner, post=post)
    assert code == 3
    assert post.calls == []
    assert list(store.iterdir()) == []
    assert scanner.texts, "record scans the text it would post"
    for text in scanner.texts:
        assert text.strip() not in out


def test_a_third_round_is_recorded_only_with_an_exception_and_its_reason(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(tmp_path / "final.txt", *PASS2)
    post = Poster()
    bare = ["record", str(PR), "--round", "3", "--head", H, "--from", str(source)]
    assert ledger(bare, capsys, store, post=post)[0] == 3
    assert ledger([*bare, "--exception", "crash"], capsys, store, post=post)[0] == 3
    assert post.calls == []
    assert list(store.iterdir()) == []
    reason = "the Priced BOQ export crashes on an empty Building"
    assert ledger([*bare, "--exception", "crash", "--reason", reason], capsys, store, post=post)[0] == 0
    record = json.loads((store / f"{PR}-{H}.json").read_text())
    assert record["round"] == 3
    assert record["exception"] == {"kind": "crash", "reason": reason}
    assert errors(record, contract("ledger-record.schema.json")) == []


def test_record_refuses_in_a_cloud_session(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CLAUDE_CODE_REMOTE", "true")
    store = tmp_path / "ledger"
    store.mkdir()
    source = lines(tmp_path / "final.txt", *PASS2)
    post = Poster()
    argv = ["record", str(PR), "--round", "1", "--head", H, "--from", str(source)]
    assert ledger(argv, capsys, store, post=post)[0] == 3
    assert post.calls == []
    assert list(store.iterdir()) == []


def test_a_jev_sidecar_never_changes_the_decision_or_the_record(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = lines(tmp_path / "final.txt", *PASS2, "FINDING f1 80 CONFIRMED")
    seen: list[tuple[str, dict[str, Any]]] = []
    for name, sidecar in (("plain", False), ("with-jev", True)):
        store = tmp_path / name / "ledger"
        store.mkdir(parents=True)
        if sidecar:
            jev = tmp_path / name / "ledger-jev"
            jev.mkdir()
            (jev / f"{PR}-{H}.json").write_text(json.dumps({"verdict": "PASS", "p_real": 0.99}))
        _, out = ledger(["decide", "--from", str(source), "--head", H], capsys, store)
        argv = ["record", str(PR), "--round", "1", "--head", H, "--from", str(source)]
        assert ledger(argv, capsys, store)[0] == 0
        record = json.loads((store / f"{PR}-{H}.json").read_text())
        record.pop("recorded_at")
        seen.append((out, record))
    assert seen[0] == seen[1]
    assert seen[0][1]["verdict"] == "FIX"
