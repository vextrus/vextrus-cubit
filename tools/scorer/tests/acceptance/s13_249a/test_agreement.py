"""Ticket T-249 (PR A), A3: `vx-score --agreement <set> <draft>`, a second keyer's agreement with the
key (section 3, A3): the reading bar's true ceiling (S1) is unmeasured while nothing scores a second
analyst's blind draft against a key.

A draft has the key's shape (`files` plus sheets) and both are read by the key's own reader; sheets
join by the key rule (layout, or frame IoU), views by IoU 0.8 and kind. The answer is aggregate
lines only (`sheets n / N`, `views n / N`, one line per field, `view titles n / N`, `view subjects
n / N`, `sheets in the draft only: k`, `views in the draft only: k`), N the key's count; nothing per
Sheet, no layout, no value. Refusals exit 2 with a message naming the rule, no value, and nothing
logged as scored. Today `--agreement` is refused as "not a run id" (`score.py:207-215`).

Invented keys and drafts only.
"""

import json
import os
from pathlib import Path
from typing import Any

import pytest

from tools.scorer import score

from .places import RUN_ID, SET, Place, export_sheet, key_sheet, key_view, total

FILES = {"qx-invented-a.dwg": "1" * 64, "qx-invented-b.dwg": "2" * 64}
FIELDS = ("number", "title", "discipline", "storeys", "revision", "date")


def box(x: float, y: float) -> list[float]:
    return [x, y, x + 100.0, y + 80.0]


def sheets() -> list[dict[str, Any]]:
    """Four invented sheets of two views each, laid out on their own layouts."""
    made = []
    for n, (kinds, subjects) in enumerate(
        [
            (("plan", "section"), ("slab", "beam")),
            (("plan", "detail"), ("column", "stair")),
            (("elevation", "section"), ("shear wall", "beam")),
            (("plan", "schedule"), ("pile cap", "pile")),
        ],
        1,
    ):
        views = [
            key_view(box(20.0 + 200.0 * i, 30.0), f"Made-up view {n}{i}", kind, subject)
            for i, (kind, subject) in enumerate(zip(kinds, subjects, strict=True))
        ]
        sheet = key_sheet(
            f"Tab A{n}",
            f"QZ-6{n}0",
            f"Made-up agreement sheet {n}",
            "",
            views,
        )
        sheet["storeys"] = ["seventh floor"]  # a key keeps storeys as a list
        sheet["file"] = "qx-invented-a.dwg" if n % 2 else "qx-invented-b.dwg"
        made.append(sheet)
    return made


def write_key(place: Place) -> None:
    place.keys.mkdir(exist_ok=True)
    key = {"set": SET, "held_out": False, "files": FILES, "sheets": sheets()}
    (place.keys / f"{SET}.json").write_text(json.dumps(key))


def write_draft(place: Place, drafted: list[dict[str, Any]], **top: Any) -> Path:
    path = place.root / "second-keyer-draft.json"
    document = {"set": SET, "held_out": False, "files": FILES, "sheets": drafted} | top
    path.write_text(json.dumps(document))
    return path


def agree(place: Place, argv: list[str]) -> int:
    place.log.touch()
    return score.main(argv, drop=place.drop, keys=place.keys, log=place.log, writer=os.getuid())


def answered(place: Place, draft: Path, capfd: pytest.CaptureFixture[str]) -> str:
    code = agree(place, ["--agreement", SET, str(draft)])
    captured = capfd.readouterr()
    assert code == 0, captured.err
    return captured.out + captured.err


def test_an_identical_draft_agrees_on_every_total_and_says_nothing_per_sheet(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)

    output = answered(place, write_draft(place, sheets()), capfd)

    assert any(line.startswith(f"agreement {SET}") for line in output.splitlines()), output
    for name, n in (("sheets", 4), ("views", 8), *((f, 4) for f in FIELDS)):
        assert total(output, name, n, n), (name, output)
    assert total(output, "view titles", 8, 8), output
    assert total(output, "view subjects", 8, 8), output
    assert "sheets in the draft only: 0" in output
    assert "views in the draft only: 0" in output
    for word in ("Tab A", "layout", "pass", "fail", "Made-up", "QZ-6", "seventh"):
        assert word not in output, word


def test_known_differences_give_the_totals_counted_by_hand(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Sheet 1: another title and one view of another kind; sheet 2: another storeys list; sheet 3:
    both views' boxes moved (IoU 0.25 and 0.67); sheet 4 as the key. By hand: sheets 1 / 4 (only
    sheet 4 has every field and view right); views 5 / 8 (one of another kind, two moved); each
    field 4 / 4 but title and storeys 3 / 4; of the 5 joined views every title and subject agree;
    the draft's 3 unjoined views are its own."""
    place = Place(tmp_path)
    write_key(place)
    drafted = sheets()
    drafted[0]["title"] = "Made-up agreement sheet one, other"
    drafted[0]["views"][1]["kind"] = "elevation"
    drafted[1]["storeys"] = ["eighth floor"]
    drafted[2]["views"][0]["box"] = [80.0, 30.0, 180.0, 110.0]  # moved 60 mm: IoU 40/160 = 0.25
    drafted[2]["views"][1]["box"] = [240.0, 30.0, 340.0, 110.0]  # moved 20 mm: IoU 80/120 = 0.67

    output = answered(place, write_draft(place, drafted), capfd)

    expected = {
        "sheets": (1, 4),
        "views": (5, 8),
        "number": (4, 4),
        "title": (3, 4),
        "discipline": (4, 4),
        "storeys": (3, 4),
        "revision": (4, 4),
        "date": (4, 4),
        "view titles": (5, 5),
        "view subjects": (5, 5),
    }
    for name, (n, of) in expected.items():
        assert total(output, name, n, of), (name, output)
    assert "sheets in the draft only: 0" in output
    assert "views in the draft only: 3" in output
    assert "other" not in output


def test_a_missing_and_an_extra_sheet_are_counted(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)
    drafted = sheets()
    drafted[3]["layout"] = "Tab Z9"  # the key's fourth sheet is missing; the draft's is its own

    output = answered(place, write_draft(place, drafted), capfd)

    assert total(output, "sheets", 3, 4), output
    assert total(output, "views", 6, 8), output  # the missing sheet's two views are missing
    assert total(output, "number", 3, 4), output
    assert "sheets in the draft only: 1" in output
    assert "Tab Z9" not in output


def _refused(
    place: Place, argv: list[str], capfd: pytest.CaptureFixture[str], *, own_rule: bool = True
) -> str:
    """Refused (exit 2) with nothing shown or logged as scored and no value; `own_rule`: by the
    agreement's own rule, never as "not a run id" (main's refusal of any `--agreement`)."""
    code = agree(place, argv)
    captured = capfd.readouterr()
    assert code == score.REFUSED, (code, captured)
    assert captured.out == "", captured.out
    assert "refused" in captured.err
    assert "scored" not in place.logged()
    for marker in ("Made-up", "QZ-6", "seventh", "qx-invented"):
        assert marker not in captured.err, marker
        assert marker not in place.logged(), marker
    if own_rule:
        assert "run id" not in captured.err, captured.err
    return captured.err


def test_the_wrong_number_of_arguments_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)
    draft = write_draft(place, sheets())

    for argv in (["--agreement"], ["--agreement", SET], ["--agreement", SET, str(draft), "x"]):
        _refused(place, argv, capfd, own_rule=False)


@pytest.mark.parametrize("name", ["../keys", "Invented Set", "", "-x", "a" * 70])
def test_a_set_name_that_is_not_a_plain_name_is_refused(
    name: str, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)

    _refused(place, ["--agreement", name, str(write_draft(place, sheets()))], capfd)


def test_a_set_with_no_key_is_refused(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    write_key(place)

    _refused(place, ["--agreement", "qx-unkeyed-set", str(write_draft(place, sheets()))], capfd)


def _link(place: Place, draft: Path) -> Path:
    link = place.root / "draft-link.json"
    link.symlink_to(draft)
    return link


def _folder(place: Place, draft: Path) -> Path:
    folder = place.root / "draft-folder.json"
    folder.mkdir()
    return folder


def _not_json(place: Place, draft: Path) -> Path:
    draft.write_text("{ not json: Made-up")
    return draft


def _a_list(place: Place, draft: Path) -> Path:
    draft.write_text(json.dumps([{"files": FILES, "sheets": sheets()}]))
    return draft


def _other_digest(place: Place, draft: Path) -> Path:
    return write_draft(place, sheets(), files={**FILES, "qx-invented-b.dwg": "3" * 64})


def _other_name(place: Place, draft: Path) -> Path:
    files = {"qx-invented-a.dwg": "1" * 64, "qx-invented-c.dwg": "2" * 64}
    return write_draft(place, sheets(), files=files)


def _one_file_fewer(place: Place, draft: Path) -> Path:
    return write_draft(place, sheets(), files={"qx-invented-a.dwg": "1" * 64})


def _no_files(place: Place, draft: Path) -> Path:
    data = json.loads(draft.read_text())
    del data["files"]
    draft.write_text(json.dumps(data))
    return draft


def _the_key_itself(place: Place, draft: Path) -> Path:
    return place.keys / f"{SET}.json"


def _a_hard_link_to_the_key(place: Place, draft: Path) -> Path:
    linked = place.root / "hard-linked-key.json"
    os.link(place.keys / f"{SET}.json", linked)
    return linked


DRAFTS = {
    "a link": _link,
    "a directory": _folder,
    "not JSON": _not_json,
    "not an object": _a_list,
    "files with another sha256": _other_digest,
    "files with another name": _other_name,
    "files missing one": _one_file_fewer,
    "no files": _no_files,
    "the key's own file": _the_key_itself,
    "a hard link to the key": _a_hard_link_to_the_key,
}


@pytest.mark.parametrize("case", sorted(DRAFTS))
def test_a_draft_that_is_not_a_plain_draft_of_the_keys_drawings_is_refused(
    case: str, tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)
    draft = DRAFTS[case](place, write_draft(place, sheets()))

    _refused(place, ["--agreement", SET, str(draft)], capfd)


def test_a_draft_over_the_most_bytes_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    place = Place(tmp_path)
    write_key(place)
    draft = write_draft(place, sheets())
    key_size = (place.keys / f"{SET}.json").stat().st_size
    draft.write_bytes(draft.read_bytes() + b" " * (key_size + 4096))
    monkeypatch.setattr(score, "MOST", key_size + 1024)

    _refused(place, ["--agreement", SET, str(draft)], capfd)


def test_a_key_the_caller_does_not_own_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Only the keys' owner can run it: the key is read as today (`_key` demands that the caller's
    uid owns it)."""
    place = Place(tmp_path)
    write_key(place)
    draft = write_draft(place, sheets())
    someone_else = os.getuid() + 4321
    monkeypatch.setattr(os, "getuid", lambda: someone_else)

    _refused(place, ["--agreement", SET, str(draft)], capfd)


def test_a_run_id_is_still_scored_as_before(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    place.write_keys([key_sheet("Tab R1", "QZ-701", "Made-up run sheet", "ninth floor", [])])
    place.write_run([export_sheet("Tab R1", "QZ-701", "Made-up run sheet", "ninth floor", [])])

    assert agree(place, [RUN_ID]) == 0
    output = capfd.readouterr().out
    assert total(output, "sheets", 1, 1), output
    assert "scored" in place.logged()


def test_a_log_that_cannot_be_written_refuses_and_shows_nothing(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)
    draft = write_draft(place, sheets())

    code = score.main(
        ["--agreement", SET, str(draft)],
        drop=place.drop,
        keys=place.keys,
        log=tmp_path / "no-such-folder" / "score.log",
        writer=os.getuid(),
    )

    captured = capfd.readouterr()
    assert code == score.REFUSED
    assert captured.out == ""
    assert captured.err.strip() == score.UNLOGGED


def test_the_log_holds_the_agreement_and_only_its_totals(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    write_key(place)
    drafted = sheets()
    drafted[1]["storeys"] = ["eighth floor"]

    answered(place, write_draft(place, drafted), capfd)

    [line] = [line for line in place.logged().splitlines() if "agreement" in line]
    assert SET in line
    assert "3 / 4" in line  # storeys
    assert "8 / 8" in line  # views
    assert "draft only" not in line
    for marker in ("Made-up", "QZ-6", "seventh", "eighth", "Tab A", "qx-invented"):
        assert marker not in line, marker
