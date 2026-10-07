"""S17-F6, the review bar: the findings that do not block are listed for filing as issues.

The owner's ruling (7 Oct 2026, session 17): "... keeping 50-74 blocking only on strict paths (security
walls, migrations, money, readers), filing the rest as issues ...".

Seam (named by this ticket): `python -m scripts.ledger to-file --from <file> --head <sha>` reads the same
decision input as `decide` (refusing what `decide` refuses, exit 2) and prints one JSON line,
`{"to_file": [<id>, ...]}`: the ids, in the order of the input, of the findings that stand (CONFIRMED,
UNPROVEN, or `-` when no refuter judged them) and score 50 to 74 with a file off the strict paths. Never
a refuted one, one under 50, or one that blocks (75 or more, or 50 or more on a strict path or with no
file). It prints ids only, never a finding's text (the ledger's rule)."""

import json
from pathlib import Path

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
PASS = f"VERDICT: PASS at {H}"
BADGE = "web/src/components/badge.tsx"
RATES = "vextrus/rates/table.py"


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def unused_scan(text: str) -> int:
    raise AssertionError("to-file scans nothing")


def unused_post(pr: int, body: str) -> int:
    raise AssertionError("to-file posts nothing")


def to_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], *rows: str, head: str = H
) -> tuple[int, str, str]:
    """`python -m scripts.ledger to-file --from <rows> --head <head>`: exit code, stdout, stderr."""
    from scripts.ledger import main

    source = tmp_path / "final.txt"
    source.write_text("".join(f"{row}\n" for row in rows))
    code = main(
        ["to-file", "--from", str(source), "--head", head],
        scan=unused_scan,
        post=unused_post,
        ledger_dir=tmp_path / "ledger",
    )
    out = capsys.readouterr()
    return code, out.out, out.err


def listed(code: int, out: str, err: str) -> list[str]:
    assert code == 0, out + err
    [line] = [row for row in out.splitlines() if row.strip()]
    loaded = json.loads(line)
    assert set(loaded) == {"to_file"}, loaded
    ids: list[str] = loaded["to_file"]
    return ids


def test_the_list_names_each_standing_50_to_74_off_a_strict_path_and_no_other(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        PASS,
        f"FINDING f1 74 CONFIRMED {BADGE}",
        f"FINDING f2 70 REFUTED {BADGE}",
        f"FINDING f3 60 UNPROVEN {BADGE}",
        f"FINDING f4 49 CONFIRMED {BADGE}",
        f"FINDING f5 75 CONFIRMED {BADGE}",
        f"FINDING f6 60 CONFIRMED {RATES}",
        "FINDING f7 60 CONFIRMED",
        f"FINDING f8 50 - {BADGE}",
    )
    assert listed(*to_file(tmp_path, capsys, *rows)) == ["f1", "f3", "f8"]


def test_the_list_is_the_same_whatever_the_reviewers_verdict(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (PASS, f"VERDICT: FIX at {H}", f"FINDING f1 55 CONFIRMED {BADGE}")
    assert listed(*to_file(tmp_path, capsys, *rows)) == ["f1"]


def test_the_list_is_empty_when_nothing_is_to_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (PASS, f"FINDING f1 80 CONFIRMED {BADGE}", f"FINDING f2 30 - {BADGE}")
    assert listed(*to_file(tmp_path, capsys, *rows)) == []


def test_the_list_prints_ids_never_text(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    code, out, err = to_file(tmp_path, capsys, PASS, f"FINDING f1 60 CONFIRMED {BADGE}")
    assert listed(code, out, err) == ["f1"]
    assert BADGE not in out


@pytest.mark.parametrize(
    ("rows", "named"),
    [
        ((f"VERDICT: PASS at {OTHER}", f"FINDING f1 60 CONFIRMED {BADGE}"), H),
        ((PASS, f"FINDING f1 60 MAYBE {BADGE}"), None),
        ((PASS, f"FINDING f1 60 CONFIRMED {BADGE}", f"FINDING f1 61 CONFIRMED {BADGE}"), "f1"),
        ((PASS, f"FINDING f1 75 - {BADGE}"), "f1"),
        ((f"FINDING f1 60 CONFIRMED {BADGE}",), None),
    ],
    ids=["another-head", "unknown-word", "duplicate-id", "a-blocker-unrefuted", "no-verdict-line"],
)
def test_input_decide_refuses_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], rows: tuple[str, ...], named: str | None
) -> None:
    code, out, err = to_file(tmp_path, capsys, *rows)
    assert code == 2, out + err
    assert "to_file" not in out
    if named is not None:
        assert named in out + err, f"the refusal does not name {named}: {out + err}"
