"""S25-F2, the bar (the owner's Q13): what the bar leaves over is filed, and each filed finding names
the check it still owes.

Q13: "An edge-case or rule-only finding scoring 50-74 is filed as an issue that still owes its committed
check." Session 25's brief (step 3, F2): "each lens tags a finding's class (user-facing, edge,
rule-only)" and "a check that every filed 50-74 issue names its owed check". The owner's ruling at the
session's start: a finding of 50-74 on a trust boundary still blocks, so it is never filed. S28-R1 (the
owner's ruling, 14 Oct 2026; ts28r1): UNPROVEN no longer stands, and a user-facing 50-74 is filed unless
its lens tags it `observed=yes`; below, a user-facing 60 that is not filed carries it.

Seams:
- `python -m scripts.ledger to-file` (S17-F6; its output, `{"to_file": [<id>, ...]}`, ids only and in
  the input's order, is pinned there) over FINDING lines tagged as in
  test_verdict_follows_the_class_bar.py (`class=<class> boundary=<yes|no>` after the file).
- The lens's answer: `scripts.factory.review.FINDING_SCHEMA` (the `--json-schema` each lens answers in)
  asks for the class (exactly the three words), whether the finding sits on a trust boundary (a
  boolean), and the check it owes (a string). Pinned by content, not by key name, and not as
  `required`: the lens replies of S14-R2's and S17-F6's acceptance tests carry none of them and must
  still be read (a finding with no tags keeps the path bar).
- The fix message: `scripts.factory.review.fix_text(pr, head, views)` (what `fix-message
  --from-verdict` prints) puts each finding to file on its own `file:line` line naming its owed check.
  A kept finding's view carries the lens's tags as `class`, `trust_boundary` and `owed_check` (key
  names assumed here: the authority names the tags, not their keys)."""

import json
from pathlib import Path
from typing import Any

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
LAX = "web/src/components/badge.tsx"
CLASSES = {"user-facing", "edge", "rule-only"}


def lens(word: str) -> str:
    return f"VERDICT: {word} at {H}"


def finding(
    name: str, score: int, word: str, kind: str, boundary: str, observed: str | None = None
) -> str:
    """A tagged line; S28-R1's `observed=` third tag only when given (a line without it reads no)."""
    tags = f"class={kind} boundary={boundary}" + ("" if observed is None else f" observed={observed}")
    return f"FINDING {name} {score} {word} {LAX} {tags}"


@pytest.fixture(autouse=True)
def local_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CLAUDE_CODE_REMOTE", raising=False)


def unused_scan(text: str) -> int:
    raise AssertionError("to-file scans nothing")


def unused_post(pr: int, body: str) -> int:
    raise AssertionError("to-file posts nothing")


def listed(tmp_path: Path, capsys: pytest.CaptureFixture[str], *rows: str) -> list[str]:
    """The ids `python -m scripts.ledger to-file` prints for these final lines."""
    from scripts.ledger import main

    source = tmp_path / "final.txt"
    source.write_text("".join(f"{row}\n" for row in rows))
    code = main(
        ["to-file", "--from", str(source), "--head", H],
        scan=unused_scan,
        post=unused_post,
        ledger_dir=tmp_path / "ledger",
    )
    out = capsys.readouterr()
    assert code == 0, f"to-file refused tagged lines: {out.out + out.err}"
    [line] = [row for row in out.out.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return list(loaded["to_file"])


def test_the_list_names_each_edge_or_rule_only_50_to_74_off_a_trust_boundary_and_no_other(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        lens("FIX"),
        finding("f1", 74, "CONFIRMED", "edge", "no"),
        finding("f2", 60, "UNPROVEN", "rule-only", "no"),
        finding("f3", 50, "-", "edge", "no"),
        finding("f4", 60, "CONFIRMED", "user-facing", "no", observed="yes"),
        finding("f5", 60, "CONFIRMED", "edge", "yes"),
        finding("f6", 70, "REFUTED", "rule-only", "no"),
        finding("f7", 49, "CONFIRMED", "edge", "no"),
        finding("f8", 75, "CONFIRMED", "edge", "no"),
        finding("f9", 55, "CONFIRMED", "rule-only", "yes"),  # S28-R1: UNPROVEN no longer stands
    )
    assert listed(tmp_path, capsys, *rows) == ["f1", "f2", "f3"]


def test_an_observed_user_facing_or_trust_boundary_60_is_never_filed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        lens("PASS"),
        finding("f1", 60, "CONFIRMED", "user-facing", "no", observed="yes"),
        finding("f2", 60, "CONFIRMED", "user-facing", "yes"),
        finding("f3", 60, "CONFIRMED", "rule-only", "yes"),
    )
    assert listed(tmp_path, capsys, *rows) == []


def asked(schema: dict[str, Any]) -> dict[str, Any]:
    properties: dict[str, Any] = schema["properties"]
    return properties


def test_each_lens_must_tag_a_findings_class_with_exactly_the_three_words() -> None:
    from scripts.factory.review import FINDING_SCHEMA

    enums = [set(spec.get("enum", [])) for spec in asked(FINDING_SCHEMA).values()]
    assert CLASSES in enums, "the lens's finding asks no class of the three words"


def test_each_lens_must_say_whether_a_finding_sits_on_a_trust_boundary() -> None:
    from scripts.factory.review import FINDING_SCHEMA

    booleans = [name for name, spec in asked(FINDING_SCHEMA).items() if spec.get("type") == "boolean"]
    assert booleans, "the lens's finding asks no trust-boundary boolean"


def test_each_lens_must_name_the_check_a_finding_owes() -> None:
    from scripts.factory.review import FINDING_SCHEMA

    strings = [
        name
        for name, spec in asked(FINDING_SCHEMA).items()
        if spec.get("type") == "string"
        and name not in ("file", "summary")
        and "check" in str(spec.get("description", "")).lower()
    ]
    assert strings, "the lens's finding asks no owed check"


def view(
    name: str, score: int, line: int, kind: str, boundary: bool, owed: str, observed: bool = False
) -> dict[str, Any]:
    """A kept finding as `fix-message` reads it (review.py's view), with the lens's tags (S28-R1's
    `observed` among them)."""
    return {
        "id": name,
        "score": score,
        "file": LAX,
        "line": line,
        "summary": f"finding {name} of the badge",
        "status": "CONFIRMED",
        "method": "refuter",
        "on_tree": True,
        "class": kind,
        "trust_boundary": boundary,
        "owed_check": owed,
        "observed": observed,
    }


def test_the_fix_message_files_an_edge_60_naming_its_owed_check_and_fixes_an_observed_60() -> None:
    from scripts.factory.review import fix_text

    owed = "a test that the badge counts a deleted Element"
    edge = view("f1", 60, 12, "edge", False, owed)
    user = view("f2", 60, 30, "user-facing", False, "a test that the badge names its Storey", True)
    text = fix_text(12, H, [edge, user])
    lines = text.splitlines()
    [edge_line] = [row for row in lines if f"{LAX}:12" in row]
    assert owed in edge_line, f"the filed line does not name its owed check: {edge_line}"
    [user_line] = [row for row in lines if f"{LAX}:30" in row]
    heading = next(i for i, row in enumerate(lines) if row.startswith("File as issues"))
    assert lines.index(user_line) < heading < lines.index(edge_line), text


def test_the_fix_message_never_files_a_trust_boundary_60() -> None:
    from scripts.factory.review import fix_text

    owed = "a test that a second tenant cannot read the badge"
    wall = view("f1", 60, 12, "edge", True, owed)
    text = fix_text(12, H, [wall])
    assert "File as issues" not in text, f"a trust-boundary 60 was filed: {text}"
    assert f"{LAX}:12" in text
