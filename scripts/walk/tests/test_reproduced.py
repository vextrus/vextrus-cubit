"""`verdict.reproduced`: a misleading finding counts only with a non-empty reproduction file on that
head (the owner's ruling Q24, 14 Oct 2026); and `_agent_layer`'s OTHER-only turn."""

from pathlib import Path
from typing import Any

from scripts.walk import verdict


def _finding(
    n: int, *, misleading: bool = True, severity: str = "OTHER", item: str = "M0-FL7"
) -> dict[str, Any]:
    return {
        "id": f"f-{n}",
        "item": item,
        "defect_class": "access_wrong",
        "screen": "drawing-set",
        "delta": None,
        "severity": severity,
        "misleading": misleading,
        "issue": 800 + n,
        "dedup_comment_on": None,
    }


def _misleading(folder: Path, finding: dict[str, Any]) -> bool:
    kept = verdict.reproduced({"items": [], "findings": [finding]}, folder)
    return bool(kept["findings"][0]["misleading"])


def test_a_non_empty_reproduction_file_keeps_a_finding_misleading(tmp_path: Path) -> None:
    (tmp_path / "repro").mkdir()
    (tmp_path / "repro" / "f-1.md").write_text("1. Open the screen.\n")

    assert _misleading(tmp_path, _finding(1))


def test_a_missing_or_blank_reproduction_file_makes_it_other(tmp_path: Path) -> None:
    (tmp_path / "repro").mkdir()
    (tmp_path / "repro" / "f-2.md").write_text(" \n\t\n")

    assert not _misleading(tmp_path, _finding(1))
    assert not _misleading(tmp_path, _finding(2))


def test_a_linked_reproduction_file_is_not_one(tmp_path: Path) -> None:
    elsewhere = tmp_path / "elsewhere.md"
    elsewhere.write_text("1. Open the screen.\n")
    (tmp_path / "repro").mkdir()
    (tmp_path / "repro" / "f-1.md").symlink_to(elsewhere)

    assert not _misleading(tmp_path, _finding(1))


def test_a_folder_named_like_a_reproduction_file_is_not_one(tmp_path: Path) -> None:
    (tmp_path / "repro" / "f-1.md").mkdir(parents=True)

    assert not _misleading(tmp_path, _finding(1))


def test_an_id_outside_its_closed_set_is_never_looked_up(tmp_path: Path) -> None:
    (tmp_path / "x.md").write_text("1. Open the screen.\n")
    finding = {**_finding(1), "id": "../x"}

    assert not _misleading(tmp_path / "repro", finding)


def test_malformed_input_is_left_for_evaluate(tmp_path: Path) -> None:
    assert verdict.reproduced({"items": [], "findings": "x"}, tmp_path) == {"items": [], "findings": "x"}
    assert verdict.reproduced({"items": [], "findings": [3]}, tmp_path)["findings"] == [3]


def test_only_a_fail_item_every_finding_names_as_other_is_turned() -> None:
    layer = verdict._agent_layer(
        {
            "items": [
                {"item": "M0-FL7", "status": "FAIL"},
                {"item": "M0-FL5", "status": "FAIL"},
                {"item": "M0-FL9", "status": "PASS"},
            ],
            "findings": [
                _finding(1, misleading=False),
                _finding(2, misleading=False, item="M0-FL5"),
                _finding(3, item="M0-FL5"),
                _finding(4, misleading=False, item="M0-FL9"),
            ],
        }
    )

    status = {i["item"]: i["status"] for i in layer["items"]}
    assert (status["M0-FL7"], status["M0-FL5"], status["M0-FL9"]) == ("PASS", "FAIL", "PASS")
    assert layer["turned_pass"] == ["f-1"]


def test_a_linked_reproduction_folder_is_not_one(tmp_path: Path) -> None:
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    (elsewhere / "f-1.md").write_text("1. Open the screen.\n")
    walk = tmp_path / "walk"
    walk.mkdir()
    (walk / "repro").symlink_to(elsewhere, target_is_directory=True)

    assert not _misleading(walk, _finding(1))


def test_a_re_walk_of_one_head_sets_the_earlier_reproduction_steps_aside(tmp_path: Path) -> None:
    # Ids restart at f-1 each walk: walk A's repro/f-1.md must not reproduce walk B's f-1.
    from scripts.walk import run

    for walk_n in (1, 2):
        (tmp_path / "repro").mkdir()
        (tmp_path / "repro" / "f-1.md").write_text(f"1. Step of walk {walk_n}.\n")
        run.set_aside(tmp_path)
        assert not (tmp_path / "repro").exists()

    kept = sorted((p / "f-1.md").read_text() for p in tmp_path.glob("repro.*"))
    assert kept == ["1. Step of walk 1.\n", "1. Step of walk 2.\n"]
    assert not _misleading(tmp_path, _finding(1))
