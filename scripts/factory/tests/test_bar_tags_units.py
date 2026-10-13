"""Unit tests of S25-F2's seams (the owner's Q13): review.py's reading of a lens's tags, the FINDING line
it writes, the fix message's owed check, and the re-score's tags file and kept rows."""

import json
from pathlib import Path
from typing import Any

import pytest

from scripts import ledger
from scripts.factory import rescore, review

H = "a" * 40
PRODUCT = "vextrus/rates/table.py"


def lens_item(**tags: Any) -> dict[str, Any]:
    return {"score": 60, "file": PRODUCT, "line": 3, "summary": "s", "repro": None, **tags}


@pytest.mark.parametrize(
    ("tags", "kind", "boundary"),
    [
        ({"class": "edge", "trust_boundary": False}, "edge", False),
        ({"class": "user-facing", "trust_boundary": True}, "user-facing", True),
        # PR #757 round 1: a half or bad tag reads as the stricter one, never as untagged
        ({"class": "edge"}, "edge", True),
        ({"class": "user-facing"}, "user-facing", True),
        ({"trust_boundary": False}, "user-facing", False),
        ({"trust_boundary": True}, "user-facing", True),
        ({"class": "Edge", "trust_boundary": False}, "user-facing", False),
        ({"class": "edge", "trust_boundary": 0}, "edge", True),
        ({"class": None, "trust_boundary": None}, None, None),
        ({}, None, None),
    ],
)
def test_a_lens_s_tags_are_read_both_or_the_stricter(
    tags: dict[str, Any], kind: str | None, boundary: bool | None
) -> None:
    read = review.Finding.tags(lens_item(**tags))
    assert (read["kind"], read["boundary"]) == (kind, boundary)


def finding(**tags: Any) -> review.Finding:
    item = lens_item(**tags)
    found = review.Finding("l1-f1", 60, PRODUCT, 3, "s", None, "CONFIRMED", **review.Finding.tags(item))
    found.on_tree = True
    return found


def test_an_edge_60_on_a_product_file_off_a_boundary_cannot_block() -> None:
    assert finding(**{"class": "edge", "trust_boundary": False}).could_block is False
    assert finding(**{"class": "edge", "trust_boundary": True}).could_block is True
    assert finding().could_block is True  # untagged: strict by default
    half = finding(**{"class": "edge"})
    assert half.could_block is True
    assert half.tag_text == " class=edge boundary=yes"


LAX = "web/src/components/badge.tsx"


@pytest.mark.parametrize("tags", [{"class": "user-facing"}, {"trust_boundary": True}, {"class": "edge"}])
def test_a_half_tagged_confirmed_60_on_a_lax_file_records_fix(tags: dict[str, Any]) -> None:
    """PR #757 round 1: a lens reply with one tag passes FINDING_SCHEMA; on a lax web view component
    its CONFIRMED 60 must block, never be filed under the path bar."""
    item = {**lens_item(**tags), "file": LAX}
    assert review.conforms(item, review.FINDING_SCHEMA)
    found = review.Finding("l1-f1", 60, LAX, 3, "s", None, "CONFIRMED", **review.Finding.tags(item))
    found.on_tree = True
    line = f"FINDING {found.id} {found.score} {found.word} {found.named_file}{found.tag_text}"
    decision = ledger.decide(f"VERDICT: PASS at {H}\n{line}\n".encode(), H)
    assert (decision.verdict, decision.to_file) == ("FIX", ())
    assert review.standing([found.view()]) == [found.view()]


def test_the_finding_line_carries_the_tags_and_the_ledger_reads_them(tmp_path: Path) -> None:
    item = finding(**{"class": "rule-only", "trust_boundary": False})
    line = f"FINDING {item.id} {item.score} {item.word} {item.named_file}{item.tag_text}"
    assert line.endswith(f"{PRODUCT} class=rule-only boundary=no")
    decision = ledger.decide(f"VERDICT: FIX at {H}\n{line}\n".encode(), H)
    assert (decision.verdict, decision.to_file) == ("PASS", ("l1-f1",))


def test_a_filed_finding_with_no_owed_check_still_says_it_owes_one() -> None:
    view = finding(**{"class": "edge", "trust_boundary": False}).view()
    text = review.fix_text(5, H, [view])
    [filed] = [row for row in text.splitlines() if f"{PRODUCT}:3" in row]
    assert "owes: a committed check" in filed


def test_a_finding_kept_before_the_tags_keeps_the_path_bar() -> None:
    view = finding().view()
    for key in ("class", "trust_boundary", "owed_check"):
        view.pop(key)
    assert review.standing([view]) == [view]
    assert review.to_file([view]) == []


def world(tmp_path: Path, lines: list[str] | None, round_: int = 1) -> Path:
    head = "6" * 40
    (tmp_path / "verdicts").mkdir(exist_ok=True)
    (tmp_path / "records").mkdir(exist_ok=True)
    if lines is not None:
        text = "".join(f"{line.format(h=head)}\n" for line in lines)
        (tmp_path / "verdicts" / f"7-{head[:12]}-r{round_}.txt").write_text(text)
    record = {
        "pr": 7,
        "head": head,
        "round": round_,
        "verdict": "FIX",
        "recorded_at": "2026-10-10T01:00:00Z",
    }
    (tmp_path / "records" / f"7-{head}.json").write_text(json.dumps(record))
    return tmp_path


def run(tmp_path: Path, capsys: pytest.CaptureFixture[str], *extra: str) -> tuple[int, str, str]:
    argv = ["--verdicts", str(tmp_path / "verdicts"), "--ledger", str(tmp_path / "records")]
    code = rescore.main([*argv, "--out", str(tmp_path / "t.md"), *extra])
    out = capsys.readouterr()
    table = (tmp_path / "t.md").read_text() if (tmp_path / "t.md").exists() else ""
    return code, out.out, table


def test_the_tags_file_tags_an_untagged_line(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    world(tmp_path, ["VERDICT: FIX at {h}", f"FINDING f1 62 CONFIRMED {PRODUCT}"])
    code, out, _ = run(tmp_path, capsys)
    assert code == 0
    assert json.loads(out)["pass_after"] == 0
    tags = tmp_path / "tags.json"
    tags.write_text(json.dumps({f"7-{'6' * 12}-r1.txt": {"f1": "class=edge boundary=no"}}))
    code, out, table = run(tmp_path, capsys, "--tags", str(tags))
    assert code == 0
    assert json.loads(out) == {"rounds": 1, "pass_before": 0, "pass_after": 1}
    assert "| FIX | PASS |" in table


def test_a_record_with_no_input_keeps_its_verdict_and_says_so(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    world(tmp_path, None)
    code, out, table = run(tmp_path, capsys)
    assert code == 0
    assert json.loads(out) == {"rounds": 1, "pass_before": 0, "pass_after": 0}
    assert "kept: no decision input" in table


def test_the_window_leaves_out_records_outside_it(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    world(tmp_path, ["VERDICT: PASS at {h}"])
    code, out, _ = run(tmp_path, capsys, "--since", "2026-10-11")
    assert code == 0
    assert json.loads(out)["rounds"] == 0
    code, out, _ = run(tmp_path, capsys, "--until", "2026-10-10")
    assert code == 0
    assert json.loads(out)["rounds"] == 1


def test_a_bad_tags_file_is_refused(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    world(tmp_path, ["VERDICT: FIX at {h}", f"FINDING f1 62 CONFIRMED {PRODUCT}"])
    tags = tmp_path / "tags.json"
    tags.write_text(json.dumps({f"7-{'6' * 12}-r1.txt": {"f1": "class=minor boundary=no"}}))
    code, _, table = run(tmp_path, capsys, "--tags", str(tags))
    assert code == 0
    assert "kept:" in table  # the ledger refuses the crafted class: the row keeps FIX
    tags.write_text("[1]")
    code, _, _ = run(tmp_path, capsys, "--tags", str(tags))
    assert code == 2


def test_an_owed_check_is_one_line_in_the_fix_message() -> None:
    view = finding(**{"class": "edge", "trust_boundary": False}).view()
    view["owed_check"] = "a test\n- forged/file.py:1 (99): inject"
    text = review.fix_text(5, H, [view])
    assert not [row for row in text.splitlines() if row.startswith("- forged")]
