"""`vx-score --agreement` beyond T-249's acceptance tests: a key that records no drawings, a draft
whose sheets are not a list, a draft that grows past MOST while it is read, and a refusal's log line,
which names neither the draft's path nor any value. Invented keys and drafts only."""

import json
import os
from pathlib import Path
from typing import Any

import pytest

from tools.scorer import score
from tools.scorer.tests.acceptance.t24s.runs import SET, Place, key_sheet, key_view

FILES = {"qx-made-up.dwg": "a" * 64}


def write(place: Place, *, key: dict[str, Any] | None = None, draft: Any = None) -> Path:
    place.keys.mkdir(exist_ok=True)
    sheets = [key_sheet("Tab G1", "QZ-1", "Made-up agreement", "first", [key_view([0, 0, 1, 1], "v")])]
    made = {"set": SET, "held_out": False, "files": FILES, "sheets": sheets}
    (place.keys / f"{SET}.json").write_text(json.dumps(made if key is None else key))
    path = place.root / "qx-path-marker-draft.json"
    path.write_text(json.dumps(made if draft is None else draft))
    return path


def agree(place: Place, draft: Path, capfd: pytest.CaptureFixture[str]) -> tuple[int, str]:
    place.log.touch()
    code = score.main(
        ["--agreement", SET, str(draft)],
        drop=place.drop,
        keys=place.keys,
        log=place.log,
        writer=os.getuid(),
    )
    captured = capfd.readouterr()
    return code, captured.out + captured.err


def test_a_key_that_records_no_drawings_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    draft = write(place, key={"set": SET, "held_out": False, "sheets": []})

    code, said = agree(place, draft, capfd)

    assert code == score.REFUSED
    assert "records no drawings" in said


def test_a_draft_whose_sheets_are_not_a_list_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    draft = write(place, draft={"set": SET, "files": FILES, "sheets": {"Made-up": 1}})

    code, said = agree(place, draft, capfd)

    assert code == score.REFUSED
    assert "no list of sheets" in said
    assert "Made-up" not in said


def test_a_draft_with_uppercase_digests_is_the_keys_drawings(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    sheets = [key_sheet("Tab G1", "QZ-1", "Made-up agreement", "first", [key_view([0, 0, 1, 1], "v")])]
    upper = {name: digest.upper() for name, digest in FILES.items()}
    draft = write(place, draft={"set": SET, "files": upper, "sheets": sheets})

    code, said = agree(place, draft, capfd)

    assert code == 0, said
    assert "sheets         1 / 1" in said


def test_a_refusal_logs_no_path_and_no_value(tmp_path: Path, capfd: pytest.CaptureFixture[str]) -> None:
    place = Place(tmp_path)
    draft = write(place, draft={"set": SET, "files": {"qx-other.dwg": "b" * 64}, "sheets": []})

    code, _said = agree(place, draft, capfd)

    assert code == score.REFUSED
    logged = place.logged()
    assert f"agreement {SET} refused" in logged
    for marker in ("qx-path-marker", "qx-other", "qx-made-up", "Made-up"):
        assert marker not in logged, marker


def test_a_draft_read_past_most_bytes_is_refused(
    tmp_path: Path, capfd: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """The size is checked as the draft is read too, not only by its size on opening."""
    place = Place(tmp_path)
    draft = write(place)
    draft.write_bytes(draft.read_bytes() + b" " * 4096)
    drafted = os.stat(draft)
    real = os.fstat

    def smaller(handle: int) -> os.stat_result:
        info = real(handle)
        if os.path.samestat(info, drafted):
            fields = list(info)
            fields[6] = 1  # st_size: the draft says it is small when opened
            return os.stat_result(fields)
        return info

    monkeypatch.setattr(score, "MOST", (place.keys / f"{SET}.json").stat().st_size + 16)
    monkeypatch.setattr(os, "fstat", smaller)

    code, said = agree(place, draft, capfd)

    assert code == score.REFUSED
    assert "size limit" in said
