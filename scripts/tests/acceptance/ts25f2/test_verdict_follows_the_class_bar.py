"""S25-F2, the bar (the owner's Q13, 13 Oct 2026): the ledger's verdict reads each finding's class and
whether it sits on a trust boundary.

Q13: "a finding blocks when it scores 75 or more, or when a QS or MD would hit it (user-facing). An
edge-case or rule-only finding scoring 50-74 is filed as an issue that still owes its committed check."
The owner's answer to Q13's open question (session 25's start): a finding of 50-74 on a trust boundary
(a tenant wall, a parser of hostile input, a gate, a ledger: builder.md's list) STILL blocks.

S28-R1 (the owner's ruling, 14 Oct 2026; ts28r1) amends it: UNPROVEN no longer stands, and a user-facing
50-74 blocks only when its lens tags it `observed=yes` (a third tag; a line without it reads no). Below,
"user-facing" at 50-74 off a boundary carries `observed=yes`.

So a standing finding (CONFIRMED; UNPROVEN too until S28-R1) makes the verdict FIX when it scores 75 or
more, or when it is user-facing and scores 50 or more, or when it sits on a trust boundary and scores 50
or more. An edge or rule-only finding of 50-74 off a trust boundary never blocks and needs no refuter
verdict. A finding that could block with no refuter verdict (`-`) is still refused (exit 2), as S17-F6
and S24-L1 pinned.

Seam (assumed here: the authority names the tags, not their spelling): the decision input's FINDING line
carries two trailing tags after its file, `class=<user-facing|edge|rule-only>` and
`boundary=<yes|no>`:
    FINDING <id> <score> <CONFIRMED|REFUTED|UNPROVEN|-> <file> class=<class> boundary=<yes|no>
Every row here names a lax file (a web view component, lax by the standing tiers list), so the
strict-path rule of S17-F6 cannot be what blocks: only the class and the boundary can. Not pinned
here: a FINDING line with no tags (S17-F6 and S24-L1 pin it, by its path) and a tagged finding on a
strict path."""

import json
from pathlib import Path
from typing import Any

import pytest

H = "1f0e2d3c4b5a69788796a5b4c3d2e1f00112233a"
LAX = "web/src/components/badge.tsx"


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
    assert code == 0, f"decide refused tagged lines: {output}"
    [line] = [row for row in output.splitlines() if row.strip()]
    loaded: dict[str, Any] = json.loads(line)
    return str(loaded["verdict"])


@pytest.mark.parametrize("word", ["CONFIRMED"])  # S28-R1: UNPROVEN no longer stands (ts28r1)
@pytest.mark.parametrize("said", ["PASS", "FIX"])
def test_a_standing_observed_user_facing_50_off_a_trust_boundary_decides_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], said: str, word: str
) -> None:
    """S28-R1 (14 Oct 2026): a user-facing 50-74 blocks when its input is one a QS would meet."""
    rows = (lens(said), finding("f1", 50, word, "user-facing", "no", observed="yes"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


def test_a_user_facing_49_decides_pass(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    rows = (lens("FIX"), finding("f1", 49, "CONFIRMED", "user-facing", "yes"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "PASS"


@pytest.mark.parametrize("word", ["CONFIRMED", "UNPROVEN"])
@pytest.mark.parametrize("kind", ["edge", "rule-only"])
def test_a_standing_edge_or_rule_only_74_off_a_trust_boundary_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], kind: str, word: str
) -> None:
    rows = (lens("FIX"), finding("f1", 74, word, kind, "no"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "PASS"


@pytest.mark.parametrize("kind", ["edge", "rule-only"])
def test_a_standing_edge_or_rule_only_75_off_a_trust_boundary_decides_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], kind: str
) -> None:
    rows = (lens("PASS"), finding("f1", 75, "CONFIRMED", kind, "no"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


@pytest.mark.parametrize("word", ["CONFIRMED"])  # S28-R1: UNPROVEN no longer stands (ts28r1)
@pytest.mark.parametrize("kind", ["edge", "rule-only"])
def test_a_standing_50_on_a_trust_boundary_still_decides_fix(
    tmp_path: Path, capsys: pytest.CaptureFixture[str], kind: str, word: str
) -> None:
    """The owner's ruling at session 25's start: a trust-boundary finding of 50-74 still blocks."""
    rows = (lens("PASS"), finding("f1", 50, word, kind, "yes"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


def test_a_refuted_74_on_a_trust_boundary_decides_pass(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (lens("FIX"), finding("f1", 74, "REFUTED", "edge", "yes"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "PASS"


def test_the_worst_of_several_tagged_findings_decides(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (
        lens("PASS"),
        finding("f1", 74, "CONFIRMED", "edge", "no"),
        finding("f2", 70, "CONFIRMED", "rule-only", "no"),
        finding("f3", 49, "CONFIRMED", "user-facing", "yes"),
        finding("f4", 55, "CONFIRMED", "edge", "yes"),  # S28-R1: UNPROVEN no longer stands
    )
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "FIX"


def test_a_lens_block_decides_block_over_a_filed_edge_finding(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    rows = (lens("BLOCK"), finding("f1", 60, "CONFIRMED", "edge", "no"))
    assert verdict_of(*decide(tmp_path, capsys, *rows)) == "BLOCK"


@pytest.mark.parametrize(
    ("score", "kind", "boundary", "observed"),
    [
        (60, "user-facing", "no", "yes"),  # S28-R1: observed, so it could block
        (50, "edge", "yes", None),
        (60, "rule-only", "yes", None),
        (75, "edge", "no", None),
    ],
    ids=["user-facing-60-observed", "edge-50-on-a-boundary", "rule-only-60-on-a-boundary", "edge-75"],
)
def test_a_finding_that_could_block_with_no_refuter_verdict_is_refused_naming_it(
    tmp_path: Path,
    capsys: pytest.CaptureFixture[str],
    score: int,
    kind: str,
    boundary: str,
    observed: str | None,
) -> None:
    """An edge 60 off a trust boundary with no refuter verdict decides (it cannot block); one that
    could block, with none, is refused naming its id."""
    unjudged = (lens("PASS"), finding("f1", 60, "-", "edge", "no"))
    assert verdict_of(*decide(tmp_path, capsys, *unjudged)) == "PASS"
    code, out = decide(
        tmp_path, capsys, lens("PASS"), finding("f1", score, "-", kind, boundary, observed)
    )
    assert code == 2, out
    assert "f1" in out
    assert '"verdict"' not in out


def test_a_class_outside_the_three_is_refused(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A crafted class word never decides: only user-facing, edge and rule-only are classes."""
    known = (lens("PASS"), finding("f1", 60, "CONFIRMED", "edge", "no"))
    assert verdict_of(*decide(tmp_path, capsys, *known)) == "PASS"
    for crafted in ("minor", "Edge", "edge,user-facing", ""):
        row = f"FINDING f1 60 CONFIRMED {LAX} class={crafted} boundary=no"
        code, out = decide(tmp_path, capsys, lens("PASS"), row)
        assert code == 2, f"class={crafted!r} decided: {out}"
        assert '"verdict"' not in out
