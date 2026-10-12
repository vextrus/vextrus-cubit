"""S24-L1: the ledger's verdict follows the bar, not the lenses' FIX or PASS lines.

The bar (the owner's ruling, 7 Oct 2026; ADR 0041 amended; scripts/factory/review_tiers.toml): a
standing finding blocks at 75, or at 50 on a strict path; one of 50-74 off the strict paths is filed as
an issue and never blocks. PR #698's rounds 1 and 2 were recorded FIX because one lens wrote FIX while
every finding scored 60-65 on a lax path, so no finding could block.

The rule (S24-L1), for `decide` and `record`:
- BLOCK when any lens says BLOCK (the approach is wrong, which only a lens can say);
- otherwise FIX when a finding that could block stands (CONFIRMED or UNPROVEN);
- otherwise PASS, whatever the lenses' FIX or PASS lines say.
A finding that could block with no refuter verdict (`-`) is still refused (exit 2).

Seam (fixed by f4, unchanged): `scripts.ledger.main(argv, *, scan, post, ledger_dir)`; the decision
input is `VERDICT: PASS|FIX|BLOCK at <40-hex>` and `FINDING <id> <score> <word> [<file>]` lines.
Lax here is a web view component (`web/src/components/**/*.tsx`), lax by the standing list, not by a
session's ruling; strict is `vextrus/rates/`."""

import json
from pathlib import Path
from typing import Any

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
PR = 12
LAX = "web/src/components/badge.tsx"
LAX_DOC = "docs/notes/storeys.md"
STRICT = "vextrus/rates/table.py"
ROOT = Path(__file__).resolve().parents[4]


def lens(word: str) -> str:
    return f"VERDICT: {word} at {H}"


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    """The record of truth is written in a local session."""
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


class Poster:
    def __init__(self) -> None:
        self.calls: list[tuple[int, str]] = []

    def __call__(self, pr: int, body: str) -> int:
        self.calls.append((pr, body))
        return 4242


def no_leak(text: str) -> int:
    return 0


def ledger(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], argv: list[str], post: Poster | None = None
) -> tuple[int, str]:
    from scripts.ledger import main

    code = main(argv, scan=no_leak, post=post or Poster(), ledger_dir=tmp_path / "ledger")
    out = capsys.readouterr()
    return code, out.out + out.err


def source(tmp_path: Path, *rows: str) -> str:
    path = tmp_path / "final.txt"
    path.write_text("".join(f"{row}\n" for row in rows))
    return str(path)


def one_json(code: int, out: str) -> dict[str, Any]:
    assert code == 0, out
    [line] = [row for row in out.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return loaded


def decided(tmp_path: Path, capsys: pytest.CaptureFixture[str], *rows: str) -> str:
    """The verdict `decide` prints for these final lines."""
    argv = ["decide", "--from", source(tmp_path, *rows), "--head", H]
    verdict: str = one_json(*ledger(tmp_path, capsys, argv))["verdict"]
    return verdict


def listed(tmp_path: Path, capsys: pytest.CaptureFixture[str], *rows: str) -> list[str]:
    """The ids `to-file` prints for these final lines."""
    argv = ["to-file", "--from", source(tmp_path, *rows), "--head", H]
    ids: list[str] = one_json(*ledger(tmp_path, capsys, argv))["to_file"]
    return ids


def test_a_lens_fix_with_only_a_lax_60_confirmed_decides_pass_and_files_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (lens("FIX"), f"FINDING f1 60 CONFIRMED {LAX}")
    got = decided(tmp_path, capsys, *rows)
    assert got == "PASS", f"the lens's FIX overrode the bar: {got}"
    assert listed(tmp_path, capsys, *rows) == ["f1"]


def test_a_lens_fix_with_no_findings_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    got = decided(tmp_path, capsys, lens("FIX"))
    assert got == "PASS", f"the lens's FIX overrode the bar: {got}"


def test_two_lenses_writing_fix_on_lax_60_to_65s_decide_pass_and_file_each(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """PR #698's shape: both lenses FIX, every finding 60-65 off the strict paths, none could block."""
    rows = (
        lens("FIX"),
        lens("FIX"),
        f"FINDING f1 60 CONFIRMED {LAX}",
        f"FINDING f2 65 UNPROVEN {LAX_DOC}",
        f"FINDING f3 62 - {LAX}",
        f"FINDING f4 80 REFUTED {STRICT}",
        f"FINDING f5 40 CONFIRMED {STRICT}",
    )
    got = decided(tmp_path, capsys, *rows)
    assert got == "PASS", f"the lens's FIX overrode the bar: {got}"
    assert listed(tmp_path, capsys, *rows) == ["f1", "f2", "f3"]


def test_a_lens_fix_with_a_refuted_80_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    got = decided(tmp_path, capsys, lens("FIX"), f"FINDING f1 80 REFUTED {STRICT}")
    assert got == "PASS", f"the lens's FIX overrode the bar: {got}"


def test_a_lens_pass_with_a_refuted_80_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    got = decided(tmp_path, capsys, lens("PASS"), f"FINDING f1 80 REFUTED {STRICT}")
    assert got == "PASS", got


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("said", ["PASS", "FIX"])
def test_a_standing_60_on_a_strict_path_decides_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], said: str, word: str
) -> None:
    rows = (lens(said), f"FINDING f1 60 {word} {STRICT}")
    assert decided(tmp_path, capsys, *rows) == "FIX"
    assert listed(tmp_path, capsys, *rows) == []


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
def test_a_lens_pass_with_a_standing_75_on_a_lax_path_decides_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], word: str
) -> None:
    rows = (lens("PASS"), lens("PASS"), f"FINDING f1 75 {word} {LAX}")
    assert decided(tmp_path, capsys, *rows) == "FIX"
    assert listed(tmp_path, capsys, *rows) == []


@pytest.mark.parametrize(
    "rows",
    [
        (lens("BLOCK"),),
        (lens("PASS"), lens("BLOCK")),
        (lens("FIX"), lens("BLOCK"), f"FINDING f1 60 CONFIRMED {LAX}"),
        (lens("BLOCK"), f"FINDING f1 80 REFUTED {STRICT}"),
    ],
    ids=["alone", "beside-a-pass", "beside-a-fix-and-a-lax-60", "with-a-refuted-80"],
)
def test_a_lens_block_decides_block(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rows: tuple[str, ...]
) -> None:
    assert decided(tmp_path, capsys, *rows) == "BLOCK"


@pytest.mark.parametrize("said", ["PASS", "FIX", "BLOCK"])
def test_a_finding_that_could_block_with_no_refuter_verdict_is_still_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], said: str
) -> None:
    for finding in (f"FINDING f1 75 - {LAX}", f"FINDING f1 50 - {STRICT}"):
        argv = ["decide", "--from", source(tmp_path, lens(said), finding), "--head", H]
        code, out = ledger(tmp_path, capsys, argv)
        assert code == 2, out
        assert "f1" in out
        assert '"verdict"' not in out


def test_record_writes_pass_for_a_lens_fix_with_only_a_lax_60(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """The record of truth (and its marker) carries the bar's verdict, the one merge_ready reads."""
    post = Poster()
    rows = (lens("FIX"), lens("PASS"), f"FINDING f1 60 CONFIRMED {LAX}")
    argv = ["record", str(PR), "--round", "1", "--head", H, "--from", source(tmp_path, *rows)]
    code, out = ledger(tmp_path, capsys, argv, post=post)
    assert code == 0, out
    record = json.loads((tmp_path / "ledger" / f"{PR}-{H}.json").read_text())
    assert record["verdict"] == "PASS", f"the lens's FIX overrode the bar: {record['verdict']}"
    assert post.calls == [(PR, f"<!-- vextrus-review round=1 head={H} verdict=PASS findings=1 -->")]


def test_the_ledger_record_contract_no_longer_says_the_worst_lens_verdict_wins() -> None:
    """The record's contract (ledger-record.schema.json) describes the verdict as the bar reads it."""
    schema = json.loads((ROOT / "docs/specs/factory/contracts/ledger-record.schema.json").read_text())
    text = schema["properties"]["verdict"]["description"]
    assert "BLOCK over FIX over PASS" not in text, "the contract still says the worst lens verdict wins"
    assert "worst" not in text, "the contract still says the worst lens verdict wins"
    assert "could block" in text


def test_the_ledgers_own_description_no_longer_says_the_worst_lens_verdict_wins() -> None:
    """`scripts/ledger.py`'s description of `decide` (the command's documented rule) matches the bar."""
    import scripts.ledger

    text = scripts.ledger.__doc__ or ""
    assert "BLOCK over FIX over PASS" not in text, "the ledger still says the worst lens verdict wins"
    assert "worst" not in text.lower(), "the ledger still says the worst lens verdict wins"
    assert "could block" in text


def test_the_reviewer_is_told_a_lax_50_to_74_never_makes_its_verdict_fix() -> None:
    """.claude/agents/pr-reviewer.md matches: FIX only for a finding that blocks, BLOCK for the approach,
    and code (not the lens) computes the recorded verdict."""
    text = " ".join((ROOT / ".claude/agents/pr-reviewer.md").read_text().split())
    assert "PASS when no finding that blocks stands" in text
    assert "BLOCK when the PR's approach cannot" in text
    assert "does not make your verdict FIX" in text
    assert "Code computes the recorded verdict from these lines" in text
