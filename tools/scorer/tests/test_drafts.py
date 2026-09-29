"""The orchestrator's ruling of session 06 on drafted keys: a draft records the drawing files it keys and
their sha256, and the review page and the custody script refuse one whose sha256 is not the file's,
naming the file and never a key's value. Invented files and keys only."""

import hashlib
import json
from pathlib import Path

import pytest

from tools.scorer import drafts, review

SECRET = "QZ-SECRET-901"


def a_set(root: Path) -> Path:
    folder = root / "reference" / "invented-set"
    folder.mkdir(parents=True)
    (folder / "first.dwg").write_bytes(b"invented first drawing")
    (folder / "second.dwg").write_bytes(b"invented second drawing")
    return folder


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def draft(root: Path, keyed: bytes = b"invented first drawing", **sheet: object) -> Path:
    folder = root / "keys-draft"
    folder.mkdir(exist_ok=True)
    key = {
        "set": "invented-set",
        "held_out": False,
        "files": {"first.dwg": sha(keyed)},
        "sheets": [
            {
                "file": "first.dwg",
                "layout": "Invented layout",
                "number": SECRET,
                "title": "Invented plan",
                "views": [{"box": [0, 0, 10, 10], "title": "Plan", "kind": "plan", "subject": "slab"}],
            }
            | sheet
        ],
    }
    path = folder / "invented-set.json"
    path.write_text(json.dumps(key))
    return path


def test_a_draft_that_keys_the_files_it_names_passes(tmp_path: Path) -> None:
    folder = a_set(tmp_path)

    assert drafts.check([draft(tmp_path)], folder) == []


def test_a_draft_whose_sha256_is_another_files_is_refused_naming_the_file(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    folder = a_set(tmp_path)
    path = draft(tmp_path, keyed=b"invented second drawing")  # keyed the second under the first's name

    assert drafts.main(["--reference", str(folder), str(path)]) == 1
    err = capsys.readouterr().err
    assert "first.dwg: the draft's sha256 is not this file's" in err, err
    assert SECRET not in err


@pytest.mark.parametrize(
    ("change", "said"),
    [
        ({"files": {"missing.dwg": "0" * 64}}, "missing.dwg: no file is named so"),
        ({"files": {}}, "records no drawing files"),
        ({"files": {"../first.dwg": "0" * 64}}, "not a plain file name"),
        ({"files": {"first.dwg": "short"}}, "first.dwg: the draft records no sha256"),
    ],
)
def test_a_draft_without_its_files_sha256_is_refused(
    tmp_path: Path, change: dict[str, object], said: str
) -> None:
    folder = a_set(tmp_path)
    path = draft(tmp_path)
    key = json.loads(path.read_text()) | change
    path.write_text(json.dumps(key))

    found = drafts.check([path], folder)
    assert any(said in line for line in found), found


def test_a_sheet_naming_a_file_the_draft_does_not_record_is_refused(tmp_path: Path) -> None:
    folder = a_set(tmp_path)

    found = drafts.check([draft(tmp_path, file="second.dwg")], folder)
    path = tmp_path / "keys-draft" / "invented-set.json"
    assert found == [f"{path}: sheet 1: names no drawing file the draft records"]


def test_two_files_of_one_name_in_the_set_are_refused(tmp_path: Path) -> None:
    folder = a_set(tmp_path)
    (folder / "again").mkdir()
    (folder / "again" / "first.dwg").write_bytes(b"invented first drawing")

    found = drafts.check([draft(tmp_path)], folder)
    assert any("several files are named so" in line for line in found), found


def test_the_review_page_refuses_a_mismatched_draft_and_writes_no_page(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    a_set(tmp_path)
    good = draft(tmp_path)
    reference = tmp_path / "reference"
    assert review.main(["--drafts", str(good.parent), "--reference", str(reference)]) == 0
    draft(tmp_path, keyed=b"invented second drawing")

    assert review.main(["--drafts", str(good.parent), "--reference", str(reference)]) == 1
    err = capsys.readouterr().err
    assert "invented-set.json: first.dwg: the draft's sha256 is not this file's" in err, err
    assert SECRET not in err
    assert not (good.parent / "review" / "index.html").exists()


def test_the_review_page_shows_each_sheets_image_beside_its_numbered_lines(tmp_path: Path) -> None:
    a_set(tmp_path)
    folder = tmp_path / "keys-draft"
    folder.mkdir()
    (folder / "sheet-1.png").write_bytes(b"invented picture")
    draft(tmp_path, image="sheet-1.png")

    index = review.write(folder, tmp_path / "reference")

    page = index.read_text()
    assert index.parent == folder / "review"
    assert '<img src="img/invented-set.S1.png"' in page
    assert (folder / "review" / "img" / "invented-set.S1.png").read_bytes() == b"invented picture"
    assert 'data-line="invented-set.S1.L4" data-field="number"' in page
    assert 'data-line="invented-set.S1.V1.L4" data-field="view 1 subject"' in page


def test_the_review_page_never_takes_an_image_from_outside_the_drafts(tmp_path: Path) -> None:
    a_set(tmp_path)
    (tmp_path / "outside.png").write_bytes(b"not a draft's")
    folder = tmp_path / "keys-draft"
    folder.mkdir()
    (folder / "link.png").symlink_to(tmp_path / "outside.png")
    draft(tmp_path, image="../outside.png")
    index = review.write(folder, tmp_path / "reference")
    assert "<img" not in index.read_text()

    draft(tmp_path, image="link.png")
    index = review.write(folder, tmp_path / "reference")
    assert "<img" not in index.read_text()
