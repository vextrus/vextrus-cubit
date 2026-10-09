"""S17-F6 and S18-F6, the review bar: `python -m scripts.ledger decide` blocks at 75, and at 50 on a
strict path.

The owner's ruling (7 Oct 2026, session 17): yes to "Raise review's blocking bar to 75, keeping 50-74
blocking only on strict paths (security walls, migrations, money, readers), filing the rest as issues,
and refuting a sample rather than every finding."

S18-F6 (lesson (e): listing the walls never converged): strict is the default, and only a short list is
lax, the web's view components and the docs' Markdown, less the walls inside them (`_paths.py` holds the
table). So a finding that stands (CONFIRMED or UNPROVEN) raises a PASS to FIX when it scores 75 or more,
or 50 or more when its file is strict. One of 50-74 on a lax path does not block (it is listed for
filing: test_to_file.py), and needs no refuter verdict. A finding of 50 or more that could block still
needs one.

Seam (named by S17-F6): the decision input's FINDING line carries the finding's file as an optional
fifth field, `FINDING <id> <score 0-100> <CONFIRMED|REFUTED|UNPROVEN|-> <file>`, the repository path the
reviewer named. A FINDING line with no file is judged strict (fail closed: nobody showed it is lax); so
is a path that is not a plain relative path or climbs out of its folder. `decide`'s output is unchanged
(one JSON line: verdict, counts, decision_input_sha256; pinned by tf4)."""

from pathlib import Path
from typing import Any

import pytest

from scripts.tests.acceptance.ts17f6._paths import (
    CRAFTED,
    DOCS_CARVED,
    ELSEWHERE,
    LAX,
    STRICT,
    WEB_CARVED,
)

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
PASS = f"VERDICT: PASS at {H}"


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


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN", "-"])
@pytest.mark.parametrize("path", LAX)
def test_a_standing_74_on_a_lax_path_passes(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str, word: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 74 {word} {path}")) == "PASS"


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("path", ["web/src/ui/Button.tsx", "docs/milestones.md"])
def test_a_standing_75_on_a_lax_path_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str, word: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 75 {word} {path}")) == "FIX"


@pytest.mark.parametrize("path", WEB_CARVED)
def test_a_standing_50_on_a_wall_inside_the_web_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 50 CONFIRMED {path}")) == "FIX"


@pytest.mark.parametrize("path", DOCS_CARVED)
def test_a_standing_50_on_a_doc_a_gate_reads_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 50 CONFIRMED {path}")) == "FIX"


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("path", ELSEWHERE)
def test_a_standing_50_on_a_path_off_the_lax_list_raises_pass_to_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str, word: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 50 {word} {path}")) == "FIX"


@pytest.mark.parametrize("path", CRAFTED)
def test_a_crafted_form_of_a_lax_looking_path_is_judged_strict(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], path: str
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, f"FINDING f1 60 CONFIRMED {path}")) == "FIX"


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


def test_a_finding_with_no_file_is_judged_strict(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    assert verdict_of(*decide(tmp_path, capsys, PASS, "FINDING f1 50 CONFIRMED")) == "FIX"


def test_the_worst_of_several_findings_decides(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        PASS,
        "FINDING f1 74 CONFIRMED web/src/ui/Button.tsx",
        "FINDING f2 74 CONFIRMED docs/milestones.md",
        "FINDING f3 49 CONFIRMED vextrus/rates/table.py",
        "FINDING f4 55 UNPROVEN web/src/api/client.ts",
    )
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


def test_an_unrefuted_50_to_74_on_a_lax_path_is_not_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        PASS,
        "FINDING f1 74 - web/src/ui/Button.tsx",
        "FINDING f2 50 - docs/adr/0043-reviews-run-by-code.md",
    )
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "PASS"


@pytest.mark.parametrize(
    "row",
    [
        "FINDING f1 75 - web/src/ui/Button.tsx",
        "FINDING f1 50 - vextrus/rates/table.py",
        "FINDING f1 50 - web/src/routes/_app/route.tsx",
        "FINDING f1 50 - docs/rulings.md",
        "FINDING f1 60 -",
    ],
    ids=["75-lax", "50-strict", "50-web-route", "50-rulings", "60-no-file"],
)
def test_a_finding_that_could_block_with_no_refuter_verdict_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], row: str
) -> None:
    code, out = decide(tmp_path, capsys, PASS, row)
    assert code == 2, out
    assert "f1" in out
    assert '"PASS"' not in out
