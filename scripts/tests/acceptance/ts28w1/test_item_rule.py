"""S28-W1: G1's evidence bar, at the agent layer's scripted path (the owner's ruling Q24, 14 Oct 2026).

docs/plans/factory-s29.md, Q24: "G1: BLOCKS fail; a misleading finding fails only with a reproduction on
that head". The ticket: "An item FAILs only on a BLOCKS finding (a wrong number, a blocked demo, blocked
signing) or on a misleading finding that carries reproduction steps on that head. Every other finding is
OTHER: filed as a walk issue ...; its item stays PASS." "triage turns a critic's FAIL into PASS only when
EVERY finding naming the item is OTHER, and records those finding ids in the verdict." "A 'misleading'
finding without reproduction steps is OTHER." Reproduction steps are "kept in the walk's private folder
under .private/, never in an issue": here `<walks-dir>/<sha40>/repro/<finding id>.md`.

The recorded ids are pinned as `agent_layer.turned_pass`: the ids of the OTHER findings under each item
a critic failed and the verdict lists PASS (an empty list when none). S27-G8 still holds: an item FAIL
that no finding names is refused, never judged.

Each test runs triage.json -> `issues draft` -> `issues record` -> `scripts.walk.verdict` on synthetic
data (`_g1`), so the rule may live in `record` or in the verdict.
"""

import json
from pathlib import Path

import pytest

from scripts.tests.acceptance.ts28w1._g1 import (
    REPRO_SENTINEL,
    finding,
    item_status,
    judged,
    lay_out,
    run_chain,
    triaged,
    write_repro,
)

ITEM = "M0-FL7"


def _paths(tmp_path: Path) -> tuple[Path, Path, Path]:
    walks, expect_dir = tmp_path / "walks", tmp_path / "expect"
    return walks, expect_dir, lay_out(walks, expect_dir)


# OTHER findings leave their item PASS -------------------------------------------------------------


def test_an_item_a_critic_failed_on_other_findings_only_is_judged_pass(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged({ITEM: "FAIL"}, [finding(1, ITEM), finding(2, ITEM, screen="takeoff.step1.sheet")])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 0], f"exits {codes}: the walk is not PASS"
    written = judged(folder)
    assert written["result"] == "PASS"
    assert item_status(written, ITEM) == "PASS"


def test_the_verdict_records_the_other_finding_ids_that_turned_a_fail_to_pass(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged(
        {ITEM: "FAIL"},
        [finding(1, ITEM), finding(2, ITEM, screen="takeoff.step1.sheet"), finding(3, "M0-FL2")],
    )

    run_chain(monkeypatch, walks, expect_dir, layer)

    written = judged(folder)
    assert sorted(written["agent_layer"]["turned_pass"]) == ["f-1", "f-2"]


def test_an_other_finding_under_an_item_a_critic_passed_turns_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)

    codes = run_chain(monkeypatch, walks, expect_dir, triaged({}, [finding(1, ITEM)]))

    assert codes == [0, 0, 0]
    written = judged(folder)
    assert item_status(written, ITEM) == "PASS"
    assert written["agent_layer"]["turned_pass"] == []


def test_a_misleading_finding_without_reproduction_steps_is_other(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged({ITEM: "FAIL"}, [finding(1, ITEM, misleading=True)])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 0], f"exits {codes}: an unreproduced misleading finding failed the walk"
    written = judged(folder)
    assert written["result"] == "PASS"
    assert item_status(written, ITEM) == "PASS"
    assert written["agent_layer"]["misleading"] == 0


def test_a_misleading_finding_with_an_empty_reproduction_file_is_other(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    (folder / "repro").mkdir()
    (folder / "repro" / "f-1.md").write_text("")
    layer = triaged({}, [finding(1, ITEM, misleading=True)])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 0], f"exits {codes}: an empty reproduction counted as one"
    assert judged(folder)["result"] == "PASS"


# What still fails ----------------------------------------------------------------------------------


@pytest.mark.parametrize("critic", ["FAIL", "PASS"])
def test_a_blocks_finding_still_fails_the_walk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, critic: str
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged({ITEM: critic}, [finding(1, ITEM, severity="BLOCKS", defect_class="number_wrong")])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 1]
    written = judged(folder)
    assert written["result"] == "FAIL"
    assert written["agent_layer"]["blocks"] == 1
    assert "f-1" not in written["agent_layer"]["turned_pass"]


def test_a_blocks_finding_keeps_its_item_fail_beside_other_findings(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged(
        {ITEM: "FAIL"},
        [finding(1, ITEM), finding(2, ITEM, severity="BLOCKS", defect_class="number_wrong")],
    )

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 1]
    written = judged(folder)
    assert item_status(written, ITEM) == "FAIL"
    assert written["agent_layer"]["turned_pass"] == []


def test_a_misleading_finding_with_reproduction_steps_fails_its_item_and_the_walk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    write_repro(folder, "f-1")
    layer = triaged({ITEM: "FAIL"}, [finding(1, ITEM, misleading=True)])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes == [0, 0, 1]
    written = judged(folder)
    assert written["result"] == "FAIL"
    assert item_status(written, ITEM) == "FAIL"
    assert written["agent_layer"]["misleading"] == 1


def test_an_item_fail_no_finding_names_is_still_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # S27-G8: "every finding naming the item is OTHER" never holds of an item no finding names.
    walks, expect_dir, folder = _paths(tmp_path)
    layer = triaged({ITEM: "FAIL", "M0-FL2": "FAIL"}, [finding(1, "M0-FL2")])

    codes = run_chain(monkeypatch, walks, expect_dir, layer)

    assert codes[-1] == 2
    assert not (folder / "verdict.json").exists()


# The reproduction steps stay private ----------------------------------------------------------------


def test_the_reproduction_steps_never_reach_an_issue_draft_or_the_verdict(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    walks, expect_dir, folder = _paths(tmp_path)
    write_repro(folder, "f-1")
    write_repro(folder, "f-2")
    layer = triaged(
        {ITEM: "FAIL"}, [finding(1, ITEM, misleading=True), finding(2, "M0-FL2", misleading=True)]
    )

    run_chain(monkeypatch, walks, expect_dir, layer)

    reached = [
        path.relative_to(folder).as_posix()
        for path in sorted(folder.rglob("*"))
        if path.is_file()
        and path.parent.name != "repro"
        and REPRO_SENTINEL in path.read_text(errors="replace")
    ]
    assert reached == []
    drafts = json.loads((folder / "public" / "issue-drafts.json").read_text())
    assert drafts["new"], "the misleading findings were filed as walk issues"
