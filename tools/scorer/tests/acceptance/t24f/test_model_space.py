"""Ticket 24f, F0 (session 06's ruling, item 5): "a key sheet whose layout is "model" (any case) is a
model-space sheet; it joins, within the drawing file its key sheet names, the export sheet with
`location.layout` null (or "model", any case) whose `location.box` has IoU >= 0.8 with the key's `frame`.
Layout sheets join on the layout name as before."

The export is shaped as 13's (`engine/export.py`: `location: {layout, box}`; a model-space sheet's layout
null and its frame as the box, in model units). Invented keys and exports only.
"""

import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

import pytest

from scripts.real_drawings.tests import exports
from tools.scorer.tests.acceptance.t24s.runs import (
    HEAD,
    MAIN,
    RUN_ID,
    SET,
    Place,
    export_sheet,
    key_sheet,
)

JSON = dict[str, Any]

# Frames in model units (a drawing in mm): two sheets drawn side by side in model space.
FRAME_1 = [100000.0, 50000.0, 142000.0, 79700.0]
FRAME_2 = [150000.0, 50000.0, 192000.0, 79700.0]
# IoU with FRAME_1: 42000 x 20790 over 42000 x 29700 = 0.7
FRAME_1_AT_0_7 = [100000.0, 50000.0, 142000.0, 70790.0]
FILE_A = f"invented-{exports.SHA_A[:4]}.dwg"
FILE_B = f"invented-{exports.SHA_B[:4]}.dwg"


def total(output: str, name: str, n: int, of: int) -> bool:
    return (
        re.search(rf"(?im)^.*\b{re.escape(name)}\b.*(?<![\d/])\b{n} / {of}\b(?![\d/])", output)
        is not None
    )


def model_key(number: str, title: str, frame: list[float], *, layout: str = "model") -> JSON:
    return key_sheet(layout, number, title, "first floor", [], frame=frame) | {"file": FILE_A}


def model_export(number: str, title: str, box: list[float], *, layout: str | None = None) -> JSON:
    sheet = export_sheet("unused", number, title, "first floor", [], box=box)
    sheet["location"] = {"layout": layout, "box": box}
    return sheet


def write_files(place: Place, files: list[JSON]) -> None:
    """The run's folder as `Place.write_run` writes it, with more than one drawing file."""
    place.drop.mkdir(exist_ok=True)
    place.run.mkdir(mode=0o750)
    os.chmod(place.run, 0o750)
    document = exports.export(*files)
    document["run"]["id"] = RUN_ID
    document["run"]["commit"] = HEAD
    data = json.dumps(document).encode()
    (place.run / f"export-{SET}.json").write_bytes(data)
    metadata = {
        "run_id": RUN_ID,
        "target": "main",
        "pr": None,
        "commit": HEAD,
        "code_hash": "c" * 64,
        "main_commit": MAIN,
        "main_code_hash": "d" * 64,
        "sets": {SET: {"set_sha256": "e" * 64, "export_sha256": hashlib.sha256(data).hexdigest()}},
        "seconds": 1,
    }
    (place.run / "metadata.json").write_text(json.dumps(metadata))
    (place.run / "summary.json").write_text(json.dumps({"run_id": RUN_ID, "verdict": "accepted"}))


def shown(capfd: pytest.CaptureFixture[str]) -> str:
    output = capfd.readouterr()
    return output.out + output.err


@pytest.mark.parametrize("key_layout", ["model", "Model", "MODEL"])
@pytest.mark.parametrize("export_layout", [None, "Model"], ids=["layout-null", "layout-Model"])
def test_a_model_space_key_sheet_joins_the_export_sheet_on_its_frame(
    tmp_path: Path,
    capfd: pytest.CaptureFixture[str],
    key_layout: str,
    export_layout: str | None,
) -> None:
    place = Place(tmp_path)
    place.write_keys([model_key("QZ-901", "Invented first plan", FRAME_1, layout=key_layout)])
    write_files(
        place,
        [
            exports.dwg(
                exports.SHA_A,
                model_export("QZ-901", "Invented first plan", FRAME_1, layout=export_layout),
            )
        ],
    )

    assert place.score() == 0
    text = shown(capfd)
    assert total(text, "sheets", 1, 1), text
    assert "the sheet missing" not in text, text
    assert "wrong" not in text, text


def test_a_model_space_sheet_below_an_iou_of_0_8_does_not_join(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys([model_key("QZ-901", "Invented first plan", FRAME_1)])
    write_files(
        place,
        [exports.dwg(exports.SHA_A, model_export("QZ-901", "Invented first plan", FRAME_1_AT_0_7))],
    )

    assert place.score() == 0
    text = shown(capfd)
    assert total(text, "sheets", 0, 1), text
    assert "the sheet missing" in text, text


def test_model_space_sheets_of_one_file_pair_on_their_frames(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [
            model_key("QZ-901", "Invented first plan", FRAME_1),
            model_key("QZ-902", "Invented second plan", FRAME_2),
        ]
    )
    # The export lists them the other way round: only the frame can pair them.
    write_files(
        place,
        [
            exports.dwg(
                exports.SHA_A,
                model_export("QZ-902", "Invented second plan", FRAME_2),
                model_export("QZ-901", "Invented first plan", FRAME_1),
            )
        ],
    )

    assert place.score() == 0
    text = shown(capfd)
    assert total(text, "sheets", 2, 2), text
    assert "wrong" not in text, text


def test_a_model_space_sheet_joins_only_within_the_file_its_key_names(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    """Two files each hold a model-space sheet at the same frame; the key names the second."""
    place = Place(tmp_path)
    place.write_keys([model_key("QZ-902", "Invented second plan", FRAME_1) | {"file": FILE_B}])
    write_files(
        place,
        [
            exports.dwg(exports.SHA_A, model_export("QZ-901", "Invented first plan", FRAME_1)),
            exports.dwg(exports.SHA_B, model_export("QZ-902", "Invented second plan", FRAME_1)),
        ],
    )

    assert place.score() == 0
    text = shown(capfd)
    assert total(text, "sheets", 1, 1), text
    assert "wrong" not in text, text
    assert "extra sheets 1" in text, text


def test_a_layout_sheet_still_joins_on_its_layouts_name(
    tmp_path: Path, capfd: pytest.CaptureFixture[str]
) -> None:
    place = Place(tmp_path)
    place.write_keys(
        [key_sheet("Sheet A", "QZ-901", "Invented first plan", "first floor", []) | {"file": FILE_A}]
    )
    write_files(
        place,
        [
            exports.dwg(
                exports.SHA_A,
                model_export("QZ-902", "Invented second plan", FRAME_1),
                export_sheet("Sheet A", "QZ-901", "Invented first plan", "first floor", []),
            )
        ],
    )

    assert place.score() == 0
    text = shown(capfd)
    assert "sheet 1 (layout Sheet A): pass" in text, text
    assert total(text, "sheets", 1, 1), text
