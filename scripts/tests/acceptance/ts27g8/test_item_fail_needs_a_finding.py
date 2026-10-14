"""S27-G8: an agent-layer item FAIL that no finding names is refused, never judged.

docs/specs/factory.md 5 "G1": an item's status is "**FAIL** (walked, and it does not hold; a finding
under it says why)". G1 walk #1 (session 26) listed M0-FL9 FAIL with no finding under it, and its verdict
was written and accepted. A finding "names" an item when its `item` field is that item's code
(walk-verdict.schema.json, `finding.item`).

The merge of the critics' items into one status per item (triage step 1) is agent text in
`.claude/workflows/real-set-walk.js`, not a script; its scripted path is `scripts.walk.issues draft`
then `record` (triage.json into findings.json), then `scripts.walk.verdict`. So the refusal is pinned
at the validator (`scripts.walk.verdict.evaluate` and its command line), and the end-to-end case runs
that scripted path and pins only that no verdict lands, whichever step refuses.

All data is synthetic (`_f5_contract`'s G1 fixtures); no drawing, no real walk.
"""

import json
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from scripts.walk import issues, measures, verdict
from scripts.walk.tests.acceptance._f5_contract import (
    WALKED_ITEMS,
    assert_valid_verdict,
    g1_expect,
    g1_snapshot,
    g1_walk,
)

SHA = "0123456789abcdef0123456789abcdef01234567"
TIMES = {"started_at": "2026-10-05T01:00:00Z", "finished_at": "2026-10-05T02:00:00Z"}
ITEM = "M0-FL9"
ACCEPTED = "scripts.walk.verdict accepted an item FAIL with no finding naming it"


def _finding(n: int, item: str, **extra: Any) -> dict[str, Any]:
    """A contract finding as `issues record` writes it into findings.json."""
    return {
        "id": f"f-{n}",
        "item": item,
        "defect_class": "access_wrong",
        "screen": "drawing-set",
        "delta": None,
        "severity": "OTHER",
        "misleading": False,
        "issue": 700 + n,
        "dedup_comment_on": None,
        **extra,
    }


def _layer(status: dict[str, str], findings: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "items": [{"item": item, "status": status.get(item, "PASS")} for item in WALKED_ITEMS],
        "findings": findings,
    }


def _evaluate(layer: dict[str, Any]) -> dict[str, Any]:
    """The walk measured from its snapshot (every check within its limit), then judged."""
    walk, expect = g1_walk(SHA, TIMES["started_at"]), {"set-a": g1_expect()}
    with tempfile.TemporaryDirectory() as folder:
        (Path(folder) / "snapshot.json").write_text(json.dumps(g1_snapshot(SHA, TIMES["started_at"])))
        walk = measures.attach(walk, Path(folder), expect)
    judged: dict[str, Any] = verdict.evaluate(walk, expect, layer, ref="main", leak_hits=0, **TIMES)
    assert_valid_verdict(judged)
    return judged


def _refused(layer: dict[str, Any]) -> str:
    """The refusal's words; a verdict built instead fails the test."""
    try:
        judged = _evaluate(layer)
    except ValueError as error:
        return str(error)
    pytest.fail(f"{ACCEPTED}: result {judged['result']}")


def _lay_out(tmp_path: Path) -> tuple[Path, Path, Path]:
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    folder = walks / SHA
    folder.mkdir(parents=True)
    expect_dir.mkdir()
    (expect_dir / "set-a.json").write_text(json.dumps(g1_expect()))
    (folder / "walk.json").write_text(json.dumps(g1_walk(SHA, TIMES["started_at"])))
    (folder / "snapshot.json").write_text(json.dumps(g1_snapshot(SHA, TIMES["started_at"])))
    return walks, expect_dir, folder


def _verdict_cli(walks: Path, expect_dir: Path) -> int:
    argv = [SHA, "--leak-hits", "0", "--walks-dir", str(walks), "--expect-dir", str(expect_dir)]
    return verdict.main(argv)


# The validator ------------------------------------------------------------------------------------


def test_an_item_fail_no_finding_names_is_refused_naming_the_item() -> None:
    words = _refused(_layer({ITEM: "FAIL"}, []))

    assert ITEM in words


def test_an_item_fail_whose_findings_name_only_other_items_is_refused() -> None:
    # Walk #1's shape: findings stood under M0-FL5 and M0-FL13, none under the FAIL M0-FL9.
    layer = _layer(
        {"M0-FL5": "FAIL", ITEM: "FAIL", "M0-FL13": "FAIL"},
        [_finding(1, "M0-FL5"), _finding(2, "M0-FL13", misleading=True)],
    )

    words = _refused(layer)

    assert ITEM in words


def test_an_item_fail_with_a_finding_naming_it_is_judged_fail() -> None:
    # S28-W1 (Q24): only a BLOCKS or a reproduced misleading finding keeps an item FAIL.
    finding = _finding(1, ITEM, severity="BLOCKS")

    judged = _evaluate(_layer({ITEM: "FAIL"}, [finding]))

    assert judged["result"] == "FAIL"
    assert {"item": ITEM, "status": "FAIL"} in judged["agent_layer"]["items"]
    assert judged["agent_layer"]["findings"] == [finding]


def test_an_item_pass_with_no_finding_is_judged_pass() -> None:
    judged = _evaluate(_layer({}, []))

    assert judged["result"] == "PASS"
    assert {"item": ITEM, "status": "PASS"} in judged["agent_layer"]["items"]


def test_an_item_pass_with_an_other_finding_under_it_stays_pass() -> None:
    # "PASS (walked, and the item holds ...; findings of severity OTHER may stand under it)".
    judged = _evaluate(_layer({}, [_finding(1, ITEM)]))

    assert judged["result"] == "PASS"


# The command line and the scripted path to it ----------------------------------------------------


def test_the_command_writes_no_verdict_for_an_item_fail_no_finding_names(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path)
    layer = _layer({"M0-FL5": "FAIL", ITEM: "FAIL"}, [_finding(1, "M0-FL5")])
    (folder / "findings.json").write_text(json.dumps(layer))

    code = _verdict_cli(walks, expect_dir)

    if (folder / "verdict.json").exists():
        pytest.fail(f"{ACCEPTED}: exit {code}, verdict.json written")
    assert code == 2
    assert not (folder / "public" / "summary.json").exists()


def test_the_command_writes_a_fail_verdict_for_an_item_fail_a_finding_names(tmp_path: Path) -> None:
    walks, expect_dir, folder = _lay_out(tmp_path)
    blocks = _finding(1, ITEM, severity="BLOCKS")  # S28-W1 (Q24): an OTHER one would turn the item PASS
    (folder / "findings.json").write_text(json.dumps(_layer({ITEM: "FAIL"}, [blocks])))

    code = _verdict_cli(walks, expect_dir)

    assert code == 1
    written = json.loads((folder / "verdict.json").read_text())
    assert written["result"] == "FAIL"
    assert {"item": ITEM, "status": "FAIL"} in written["agent_layer"]["items"]


def test_a_triaged_item_fail_no_finding_names_never_lands_as_a_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # The merge step's triage.json (allowlisted keys only), through issues draft, issues record and
    # the verdict: whichever step refuses, no verdict.json is written.
    walks, expect_dir, folder = _lay_out(tmp_path)
    triaged = {
        "items": [
            {"item": item, "status": "FAIL" if item in ("M0-FL5", ITEM) else "PASS"}
            for item in WALKED_ITEMS
        ],
        "findings": [
            {k: v for k, v in _finding(1, "M0-FL5").items() if k not in ("issue", "dedup_comment_on")}
        ],
    }
    (folder / "triage.json").write_text(json.dumps(triaged))
    (folder / "open-issues.json").write_text("[]")
    monkeypatch.setattr(issues, "leakscan_text", lambda text: 0)
    steps: list[Callable[[], int]] = [
        lambda: issues.main(["draft", SHA, "--walks-dir", str(walks)]),
        lambda: issues.main(["record", SHA, "--walks-dir", str(walks), "--created", "1=701"]),
        lambda: _verdict_cli(walks, expect_dir),
    ]

    codes = []
    for step in steps:
        codes.append(step())
        if codes[-1] != 0:
            break

    if (folder / "verdict.json").exists():
        pytest.fail(f"{ACCEPTED}: exits {codes}, verdict.json written")
    assert codes[-1] == 2
