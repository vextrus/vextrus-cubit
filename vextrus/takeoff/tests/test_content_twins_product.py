"""S19-B7: a copied title block over the next drawing, told apart by content twins in the product as
in the engine. The read job keeps each printed sheet's layer histogram (`SheetRevision.layers`) and
Step 1's conflicts read it back (`proposals.candidate`), so a pair the engine parts is a `same_title`
Question, not a Continuation. Hand-built artefacts through t21c's readers (no toolchain); every
title and layer is invented.
"""

import uuid
from collections.abc import Mapping, Sequence
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from engine.geometry.placement import chain, chain_transform
from engine.messages import conflicts as conflict_codes
from engine.read import ReadArtefact
from engine.recognise import conflicts, sheets
from engine.recognise.tests.drawing import frame_block, value_at
from engine.recognise.types import Conflict, Continuation
from vextrus.drawings import services as drawings
from vextrus.drawings.services import sheet_list
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.tests.acceptance.t21c.step1_whole import (
    AGREE,
    LABELS,
    SCALE,
    _Invented,
    _sha,
    jev_says,
    open_questions,
    proposals,
    run_job,
    the,
    uploaded,
)
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject
from vextrus.testing.jev import Offline

pytestmark = pytest.mark.django_db

NAME = "KR-STR-R0.dwg"
BASE = {"ZQ-GRID": 20, "ZQ-WALL": 30, "ZQ-LAMP": 40, "ZQ-SWITCH": 20}
FITTINGS = {**BASE, "ZQ-FAN": 15, "ZQ-OUTLET": 25}
TRUNKING = {**BASE, "ZQ-TRUNK": 30}
PAIR = "LIGHT LAYOUT"


def _drawn(
    fittings: Mapping[str, int], trunking: Mapping[str, int]
) -> list[tuple[str, str, Mapping[str, int]]]:
    """S-01 and S-02 the two rows' sheets (two stems); S-03 and S-04 one title, S-03 drawing the
    fittings row's content and S-04 the trunking row's."""
    return [
        ("S-01", "FITTING LAYOUT", {**fittings, "ZQ-LAMP": 38}),
        ("S-02", "TRUNKING LAYOUT", {**trunking, "ZQ-LAMP": 38}),
        ("S-03", PAIR, fittings),
        ("S-04", PAIR, trunking),
    ]


COPIED = _drawn(FITTINGS, TRUNKING)
ONE_DRAWING = _drawn(FITTINGS, {**FITTINGS, "ZQ-MARK": 2})
"""S-03 and S-04 draw one drawing: closer to each other than to their twins."""


def artefact(
    sha256: str, name: str, drawn: Sequence[tuple[str, str, Mapping[str, int]]]
) -> ReadArtefact:
    """Each sheet an A1 frame at 1:50 side by side in model space, its number and title under their
    labels, and `count` short lines on each of its layers inside the drawing area."""
    d = _Invented(name, sha256)
    block = frame_block(d, labels=LABELS)
    s = SCALE
    for n, (number, title, layers) in enumerate(drawn):
        ox = n * 100_000.0
        insert = d.insert(block, (ox, 0.0, 0.0), scale=(s, s, s))
        placed = chain_transform(chain(d.artefact(), [insert]))
        for cell, text in {0: title, 2: number, 3: "12.08.2026", 4: "R0"}.items():
            x, y, _ = placed.apply(value_at(cell))
            d.text(text, (x, y, 0.0), height=5.0 * s)
        for band, (layer, count) in enumerate(sorted(layers.items())):
            for k in range(count):
                x = ox + (40.0 + (k % 30) * 18.0) * s
                y = (40.0 + band * 60.0 + (k // 30) * 15.0) * s
                d.line((x, y), (x + 10.0 * s, y + 6.0 * s), layer=layer)
    return d.artefact()


def readers(drawn: Sequence[tuple[str, str, Mapping[str, int]]]) -> files.Readers:
    def first(path: Path, name: str) -> ReadArtefact:
        return artefact(_sha(path), name, drawn)

    from engine.render import fonts
    from vextrus.takeoff.tests.acceptance.t21c.step1_whole import _bangla
    from vextrus.testing.drawings import pdf_report

    return files.Readers(
        dwg=first,
        second=lambda path, read: AGREE,
        fonts=fonts.report,
        bangla_ansi=_bangla,
        pdf=lambda path: pdf_report(_sha(path), 1),
    )


@pytest.fixture(autouse=True)
def jev_sure(jev_offline: Offline) -> None:
    jev_says(jev_offline, "0.97")


def read(qs: QsProject, monkeypatch: pytest.MonkeyPatch, drawn: Any) -> uuid.UUID:
    file_id = uploaded(qs.member, qs.project_id, NAME)
    run_job(qs.member, file_id, monkeypatch, readers(drawn))
    return file_id


def engine_parts(drawn: Sequence[tuple[str, str, Mapping[str, int]]]) -> bool:
    """Whether the engine alone (13's finder, 19b's `find`) parts S-03/S-04."""
    conventions = sheets.default_conventions()
    found = [
        replace(c, group="site") for c in sheets.find(artefact("0" * 64, NAME, drawn), None, conventions)
    ]
    findings = conflicts.find(found, [()] * len(found), conventions)

    def numbers(named: Sequence[Any]) -> list[str]:
        return [s.number.value for s in named]

    runs = [numbers(c.sheets) for c in findings if isinstance(c, Continuation)]
    titles = [numbers(c.candidates) for c in findings if isinstance(c, Conflict)]
    assert (["S-03", "S-04"] in runs) != (["S-03", "S-04"] in titles), (runs, titles)
    return ["S-03", "S-04"] in titles


def test_the_engine_parts_the_copied_pair_and_keeps_one_drawing_over_two_sheets() -> None:
    assert engine_parts(COPIED)
    assert not engine_parts(ONE_DRAWING)


def test_a_copied_title_block_over_the_next_rows_drawing_is_a_same_title_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = read(qs_project, monkeypatch, COPIED)
    api = api_as(qs_project.member)
    listed = proposals(api, qs_project.project_id)

    [q] = open_questions(api, qs_project.project_id, "conflict")

    assert q["code"] == conflict_codes.SAME_TITLE.code
    assert sorted(q["proposals"]) == sorted(the(listed, n)["id"] for n in ("S-03", "S-04"))
    with qs_project.member.acting():
        found = drawings.file(file_id)
        stored = {v.title: v.layers for v in drawings.sheets(found.set_id) if v.file_id == file_id}
    # Read back through `drawings` as kept; "0" holds its frame insert and 4 texts.
    assert sorted(stored["FITTING LAYOUT"]) == sorted({**FITTINGS, "ZQ-LAMP": 38, "0": 5}.items())


def test_one_drawing_over_two_sheets_stays_a_continuation_with_no_question(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    read(qs_project, monkeypatch, ONE_DRAWING)
    api = api_as(qs_project.member)

    assert open_questions(api, qs_project.project_id, "conflict") == []


@pytest.mark.parametrize(
    "layers",
    [
        (("ZQ\x00A", 3),),
        (("\ud800", 3),),
        (("Z" * (sheet_list.MAX_LAYER_NAME + 1), 3),),
        tuple((f"ZQ-{k}", 1) for k in range(sheet_list.MAX_LAYERS + 1)),
    ],
    ids=["nul", "surrogate", "long-name", "too-many"],
)
def test_a_histogram_the_database_cannot_hold_as_given_is_kept_as_none(
    layers: tuple[tuple[str, int], ...],
) -> None:
    assert sheet_list._layers_json(layers) == []


@pytest.mark.parametrize(
    "stored",
    [None, {}, [["A"]], [["A", 0]], [["A", True]], [["A", 1.0]], [[1, 2]], [["A", 1], ["A", 2]]],
)
def test_a_stored_histogram_not_in_the_written_shape_reads_as_none(stored: object) -> None:
    assert sheet_list._layers_of(stored) == ()
    assert sheet_list._layers_of([["A", 2], ["B", 1]]) == (("A", 2), ("B", 1))
