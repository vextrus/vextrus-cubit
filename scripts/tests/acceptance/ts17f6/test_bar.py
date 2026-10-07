"""S17-F6, the review bar: `python -m scripts.ledger decide` blocks at 75, and at 50 on a strict path.

The owner's ruling (7 Oct 2026, session 17): yes to "Raise review's blocking bar to 75, keeping 50-74
blocking only on strict paths (security walls, migrations, money, readers), filing the rest as issues,
and refuting a sample rather than every finding."

So a finding that stands (CONFIRMED or UNPROVEN) raises a PASS to FIX when it scores 75 or more, or 50 or
more when its file is on a strict path (`scripts/factory/review_tiers.toml`, `[strict] paths`). One of
50-74 off the strict paths does not block (it is listed for filing: test_to_file.py), and needs no
refuter verdict. A finding of 50 or more that could block still needs one.

Seam (named by this ticket): the decision input's FINDING line carries the finding's file as an optional
fifth field, `FINDING <id> <score 0-100> <CONFIRMED|REFUTED|UNPROVEN|-> <file>`, the repository path the
reviewer named. A FINDING line with no file is judged as on a strict path (fail closed: nobody showed it
is off one); so is a path that resolves into a strict folder. `decide`'s output is unchanged (one JSON
line: verdict, counts, decision_input_sha256; pinned by tf4)."""

from pathlib import Path
from typing import Any

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
PASS = f"VERDICT: PASS at {H}"

OFF_STRICT = (
    "web/src/components/badge.tsx",
    "web/src/routes/takeoff/page.tsx",
    "scripts/factory/say.py",
)
# One path or more per kind the ruling names: security walls (tenancy and RLS, auth, the guard),
# migrations, money (the BOQ, rates) and readers (the engine's drawing readers).
STRICT = (
    "vextrus/platform/services/tenancy.py",
    "vextrus/platform/http/auth.py",
    ".claude/hooks/guard.mjs",
    "vextrus/platform/migrations/0003_row_level_security.py",
    "vextrus/takeoff/migrations/0042_a_new_table.py",
    "vextrus/boq/services/pricing.py",
    "vextrus/rates/table.py",
    "engine/read/libredwg/reader.py",
)


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def unused_scan(text: str) -> int:
    raise AssertionError("decide scans nothing")


def unused_post(pr: int, body: str) -> int:
    raise AssertionError("decide posts nothing")


def decide(tmp_path: Path, capsys: pytest.CaptureFixture[str], *rows: str) -> tuple[int, str]:
    """`python -m scripts.ledger decide --from <rows> --head H`: its exit code and all it printed."""
    from scripts.ledger import main

    source = tmp_path / "final.txt"
    source.write_text("".join(f"{row}\n" for row in rows))
    code = main(
        ["decide", "--from", str(source), "--head", H],
        scan=unused_scan,
        post=unused_post,
        ledger_dir=tmp_path / "ledger",
    )
    out = capsys.readouterr()
    return code, out.out + out.err


def verdict_of(code: int, output: str) -> str:
    import json

    assert code == 0, output
    [line] = [row for row in output.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return str(loaded["verdict"])


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("path", OFF_STRICT)
def test_a_standing_74_off_a_strict_path_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str, word: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 74 {word} {path}")) == "PASS"


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
def test_a_standing_75_off_a_strict_path_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], word: str
) -> None:
    row = f"FINDING f1 75 {word} web/src/components/badge.tsx"
    assert verdict_of(*decide(tmp_path, capsys, PASS, row)) == "FIX"


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("path", STRICT)
def test_a_standing_50_on_a_strict_path_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str, word: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 50 {word} {path}")) == "FIX"


@pytest.mark.parametrize("path", STRICT)
def test_a_49_on_a_strict_path_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 49 CONFIRMED {path}")) == "PASS"


def test_a_refuted_finding_on_a_strict_path_does_not_block(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    row = "FINDING f1 90 REFUTED vextrus/rates/table.py"
    assert verdict_of(*decide(tmp_path, capsys, PASS, row)) == "PASS"


def test_a_finding_with_no_file_is_judged_as_on_a_strict_path(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, "FINDING f1 50 CONFIRMED")) == "FIX"


def test_a_path_that_climbs_into_a_strict_folder_is_judged_strict(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    row = "FINDING f1 60 CONFIRMED web/../vextrus/rates/table.py"
    assert verdict_of(*decide(tmp_path, capsys, PASS, row)) == "FIX"


def test_the_worst_of_several_findings_decides(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        PASS,
        "FINDING f1 74 CONFIRMED web/src/components/badge.tsx",
        "FINDING f2 49 CONFIRMED vextrus/rates/table.py",
        "FINDING f3 55 UNPROVEN vextrus/boq/services/pricing.py",
    )
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


def test_an_unrefuted_50_to_74_off_a_strict_path_is_not_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        PASS,
        "FINDING f1 74 - web/src/components/badge.tsx",
        "FINDING f2 50 - scripts/factory/say.py",
    )
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "PASS"


@pytest.mark.parametrize(
    "row",
    [
        "FINDING f1 75 - web/src/components/badge.tsx",
        "FINDING f1 50 - vextrus/rates/table.py",
        "FINDING f1 60 -",
    ],
    ids=["75-off-strict", "50-on-strict", "60-no-file"],
)
def test_a_finding_that_could_block_with_no_refuter_verdict_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], row: str
) -> None:
    code, out = decide(tmp_path, capsys, PASS, row)
    assert code == 2, out
    assert "f1" in out
    assert '"PASS"' not in out
