"""Ticket T-W332's acceptance, through the read job (the ticket's section 3 C4 to C9; #332): a numbered
Sheet whose title block gives no title, drawing one titled View, is titled by that View in its
`sheet_<n>` step, source "view_title"; the `sheets` step's candidates stay as the finder read them; the
title is one source, never two (the bulk act leaves it out); it reaches Jev's kind judgement, the
Question's words and the export.

Modelled on `vextrus/takeoff/tests/test_read_sheet.py` (its readers, `run_job`, `kept`, `printed`):
a local copy of its three frames in which sheet 2's title block holds no title. Jev is down unless a
test stands in for it. Every word drawn here is invented.

    uv run pytest vextrus/takeoff/tests/acceptance/w332/test_job_titles_the_sheet.py
"""

import hashlib
import uuid
from dataclasses import replace
from decimal import Decimal
from pathlib import Path
from typing import Any, cast

import pytest
from procrastinate.job_context import AbortReason

from engine.check.bangla_ansi import BanglaAnsi
from engine.export import load_schema
from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.read.pdf.types import PdfReport
from engine.recognise.tests.drawing import Sheets, frame_block, value_at
from engine.recognise.types import CheckOutcome, CheckResult, JudgementRequest
from engine.render import fonts
from scripts.real_drawings.schema import problems
from vextrus.drawings import services as drawings
from vextrus.platform.services import jev, jobs
from vextrus.takeoff.services import export, step1
from vextrus.takeoff.services.read_propose import files
from vextrus.takeoff.services.read_propose import sheets as read_sheets
from vextrus.takeoff.tasks import read_file
from vextrus.testing.auth import api_as
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report
from vextrus.testing.jobs import run_inline
from vextrus.testing.read_steps import kept_steps
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db

FRAMES = 3
SCALE = 50.0
AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
NUMBERS = ("S-201", "S-202", "S-203")
BLOCK_TITLES = {"S-201": "1ST FLOOR BEAM LAYOUT", "S-203": "2ND FLOOR BEAM LAYOUT"}
"""The title block's title on sheets 1 and 3; sheet 2's title cell is left empty."""
DRAWN = {"S-201": "1ST FLOOR BEAM LAYOUT PLAN", "S-203": "2ND FLOOR BEAM LAYOUT PLAN"}
"""The one View's title on sheets 1 and 3 (two storeys: no Conflict between them)."""
SHEET_2_VIEW = "8TH FLOOR CANOPY SLAB DETAIL"
"""Sheet 2's one View's title, and so its title."""
SHEET_2_OTHER = "SECTION C-C PARAPET WALL"
"""A second View on sheet 2, titled differently (the no-guess case)."""
TITLE_BLOCK = {"title_block_attribute", "title_block_text"}
RUN = {
    "id": "invented-run",
    "commit": None,
    "code_hash": None,
    "started_at": "2026-10-05T00:00:00Z",
    "seconds": 1.5,
}


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _grid(d: Sheets, x0: float, y0: float, x1: float, y1: float, title: str) -> None:
    for k in range(5):
        d.line((x0 + (x1 - x0) * k / 4, y0), (x0 + (x1 - x0) * k / 4, y1))
        d.line((x0, y0 + (y1 - y0) * k / 4), (x1, y0 + (y1 - y0) * k / 4))
    d.text(title, (x0, y0 - 12 * SCALE, 0.0), height=6.0 * SCALE)


def three_sheets(sha256: str, name: str, *, two_views: bool = False) -> ReadArtefact:
    """`test_read_sheet.three_sheets`, numbered S-201 to S-203: sheet 2 writes no title in its title
    block and its one View is titled `SHEET_2_VIEW` (with `two_views`, a second View beside it titled
    `SHEET_2_OTHER`); sheets 1 and 3 are titled by `BLOCK_TITLES` and draw one View titled by `DRAWN`."""
    d = Sheets(source_name=name)
    block = frame_block(d)
    for i in range(FRAMES):
        ox = 10_000.0 + i * 60_000.0
        insert = d.insert(block, (ox, 0.0, 0.0), scale=(SCALE, SCALE, SCALE))
        placed = chain_transform(chain(d.artefact(), [insert]))
        number = NUMBERS[i]
        cells = {2: number} if i == 1 else {0: BLOCK_TITLES[number], 2: number}
        for cell, text in cells.items():
            x, y, _ = placed.apply(value_at(cell))
            d.text(text, (x, y, 0.0), height=5.0 * SCALE)
        if i == 1 and two_views:
            _grid(d, ox + 40 * SCALE, 300 * SCALE, ox + 300 * SCALE, 560 * SCALE, SHEET_2_VIEW)
            _grid(d, ox + 360 * SCALE, 300 * SCALE, ox + 620 * SCALE, 560 * SCALE, SHEET_2_OTHER)
        else:
            title = SHEET_2_VIEW if i == 1 else DRAWN[number]
            _grid(d, ox + 40 * SCALE, 300 * SCALE, ox + 340 * SCALE, 560 * SCALE, title)
    made = d.artefact()
    s = made.summary
    return ReadArtefact.build(
        source_sha256=sha256,
        source_name=name,
        format=s.format,
        reader=s.reader,
        reader_version=s.reader_version,
        layouts=list(s.layouts),
        insunits=s.insunits,
        notes=list(s.notes),
        blocks=made.blocks.values(),
        entities=made.entities.values(),
    )


def readers(*, two_views: bool = False) -> files.Readers:
    def first(path: Path, name: str) -> ReadArtefact:
        return three_sheets(_sha(path), name, two_views=two_views)

    def pdf(path: Path) -> PdfReport:
        return pdf_report(_sha(path), 1)

    return files.Readers(
        dwg=first,
        second=lambda path, artefact: AGREE,
        fonts=fonts.report,
        bangla_ansi=lambda artefact: BanglaAnsi(()),
        pdf=pdf,
    )


def run_job(
    member: Member,
    file_id: uuid.UUID,
    monkeypatch: pytest.MonkeyPatch,
    *,
    two_views: bool = False,
    abort_reason: Any = lambda: None,
) -> None:
    monkeypatch.setattr(files, "READERS", readers(two_views=two_views))
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=abort_reason,
        file_id=file_id,
    )


def added(qs: QsProject) -> uuid.UUID:
    return add(qs.member, qs.project_id, "KR-STR-R4.dwg", drawing("dwg")).file.id


def kept(member: Member, file_id: uuid.UUID) -> dict[str, Any]:
    rows = kept_steps(member, file_id)
    names = [row.step for row in rows]
    assert len(names) == len(set(names)), f"a step kept twice: {names}"
    return {row.step: row for row in rows}


def printed(member: Member, file_id: uuid.UUID) -> list[drawings.SheetView]:
    with member.acting():
        found = drawings.file(file_id)
        return [s for s in drawings.sheets(found.set_id) if s.file_id == file_id]


def by_number(member: Member, file_id: uuid.UUID) -> dict[str | None, drawings.SheetView]:
    listed = printed(member, file_id)
    numbers = [s.number for s in listed]
    assert len(numbers) == len(set(numbers)), f"a sheet listed twice: {numbers}"
    return {s.number: s for s in listed}


def proposals(qs: QsProject) -> dict[str | None, dict[str, Any]]:
    body = api_as(qs.member).get(f"/api/projects/{qs.project_id}/takeoff/step1/proposals").json()
    return {p["number"]: p for p in body["proposals"]}


class SheetReads:
    """How many sheets were read (a skipped `sheet_<n>` step reads none)."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.count = 0
        original = read_sheets._read_sheet

        def counted(*args: Any, **kwargs: Any) -> Any:
            self.count += 1
            return original(*args, **kwargs)

        monkeypatch.setattr(read_sheets, "_read_sheet", counted)


def test_the_job_titles_an_untitled_numbered_sheet_by_its_one_view(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    sheets = by_number(qs_project.member, file_id)
    assert set(sheets) == set(NUMBERS)
    titled = sheets["S-202"]
    assert titled.title == SHEET_2_VIEW
    assert titled.sources["title"] == "view_title"
    assert titled.storeys_as_stated == "8TH FLOOR"
    assert titled.sources["storeys_as_stated"] == "view_title"
    assert titled.sources["number"] in TITLE_BLOCK
    for number in ("S-201", "S-203"):
        assert sheets[number].title == BLOCK_TITLES[number]
        assert sheets[number].sources["title"] in TITLE_BLOCK
    assert proposals(qs_project)["S-202"]["title_source"] == "view_title"
    assert proposals(qs_project)["S-202"]["title"] == SHEET_2_VIEW


def test_the_finders_candidates_stay_as_read_and_the_sheet_step_says_it_titled(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    steps = kept(qs_project.member, file_id)
    candidates = {
        c["candidate"]["number"]["value"]: c["candidate"]
        for c in steps[drawings.SHEETS].result["sheets"]
    }
    assert candidates["S-202"]["title"] is None
    assert candidates["S-202"]["storeys_as_stated"] is None
    assert candidates["S-201"]["title"]["value"] == BLOCK_TITLES["S-201"]
    order = [c["candidate"]["number"]["value"] for c in steps[drawings.SHEETS].result["sheets"]]
    titled_by_view = {
        number: steps[drawings.sheet_step(n)].result["titled_by_view"]
        for n, number in enumerate(order, start=1)
    }
    assert titled_by_view == {"S-201": False, "S-202": True, "S-203": False}


def test_reading_the_file_again_reads_no_sheet_and_keeps_the_title(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    before = by_number(qs_project.member, file_id)["S-202"]
    reads = SheetReads(monkeypatch)

    run_job(qs_project.member, file_id, monkeypatch)

    assert reads.count == 0
    after = by_number(qs_project.member, file_id)["S-202"]
    assert (after.title, after.sources) == (before.title, before.sources)
    assert after.title == SHEET_2_VIEW


def test_a_stop_after_the_titled_sheet_and_a_resume_leave_one_title_once(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    member = qs_project.member
    reads = SheetReads(monkeypatch)

    def stop_once_sheet_2_is_read() -> AbortReason | None:
        return AbortReason.SHUTDOWN if reads.count >= 2 else None

    with pytest.raises(jobs.Stopped):
        run_job(member, file_id, monkeypatch, abort_reason=stop_once_sheet_2_is_read)
    before = kept(member, file_id)
    assert drawings.sheet_step(2) in before
    assert drawings.sheet_step(3) not in before

    run_job(member, file_id, monkeypatch)

    assert reads.count == FRAMES
    assert [s.number for s in printed(member, file_id)].count("S-202") == 1
    sheets = by_number(member, file_id)
    assert sheets["S-202"].title == SHEET_2_VIEW
    assert sheets["S-202"].sources["title"] == "view_title"
    assert kept(member, file_id)[drawings.sheet_step(2)].result["titled_by_view"] is True


def test_two_differently_titled_views_leave_the_sheet_untitled(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch, two_views=True)

    sheet = by_number(qs_project.member, file_id)["S-202"]
    with qs_project.member.acting():
        drawn = [v.title for v in drawings.views(sheet.id) if v.kind != "title_block"]
    assert sorted(drawn) == sorted([SHEET_2_VIEW, SHEET_2_OTHER])  # the fixture draws two Views
    assert sheet.title == ""
    assert "title" not in sheet.sources
    steps = kept(qs_project.member, file_id)
    order = [c["candidate"]["number"]["value"] for c in steps[drawings.SHEETS].result["sheets"]]
    assert steps[drawings.sheet_step(order.index("S-202") + 1)].result["titled_by_view"] is False


def test_a_title_from_a_view_is_one_source_and_never_agrees(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """m0-screens §5, "What 'agrees' means": a sheet agrees once a second source confirms its
    title-block number and title; a title read from a View is not a title-block title. With no list,
    S-201 to S-203 run without a gap and each one's Plot page matched (driven as
    `test_step1_agrees.py` drives it): sheets 1 and 3 agree, sheet 2 does not."""
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    real = step1._sheets

    def with_plots(project_id: uuid.UUID) -> list[drawings.SheetView]:
        return [replace(s, plot=replace(s.plot, page=i + 1)) for i, s in enumerate(real(project_id))]

    monkeypatch.setattr(step1, "_sheets", with_plots)

    agrees = {number: p["agrees"] for number, p in proposals(qs_project).items()}
    assert agrees == {"S-201": True, "S-202": False, "S-203": True}


class Judged:
    """Jev standing in: each sheet_type request kept; it answers unsure (below the propose line), so
    the QS is asked the kind."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.requests: list[JudgementRequest] = []
        monkeypatch.setattr(jev, "ask_judgement", self.ask)

    def ask(self, request: JudgementRequest) -> jev.Answer:
        self.requests.append(request)
        share = Decimal(1) / len(request.options)
        return jev.Answer(
            node=request.node,
            model=jev.SHEET_TYPE.model,
            choice=request.options[0],
            confidence=share.quantize(Decimal("0.000001")),
            probabilities=tuple((o, share.quantize(Decimal("0.000001"))) for o in request.options),
            id=uuid.uuid4(),
        )


def test_jevs_kind_judgement_is_given_the_title_from_the_view(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    judged = Judged(monkeypatch)
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    asked = [r for r in judged.requests if SHEET_2_VIEW in r.facts["view_titles"]]
    assert asked, "sheet 2's kind was not asked"
    assert {r.facts["title"] for r in asked} == {SHEET_2_VIEW}


def test_the_kind_question_names_the_sheet_by_number_and_its_title_is_the_views(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Question card's words for a numbered sheet with no title ("It has no title, so nothing says
    which kind of sheet … is") come from an empty title: sheet 2 now has one. A kind Question asks a
    group of sheets (S18-Q1) and names no one subject; the one that holds sheet 2 is found by what it
    holds, as Step 1 lists it."""
    Judged(monkeypatch)
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    proposal = proposals(qs_project)["S-202"]
    path = f"/api/projects/{qs_project.project_id}/takeoff/step1/questions"
    body = api_as(qs_project.member).get(path)
    kinds = [
        q
        for q in body.json()["questions"]
        if q["status"] == "open"
        and q["code"].endswith(".which_kind")
        and proposal["id"] in q["proposals"]
    ]
    assert len(kinds) == 1
    assert kinds[0]["params"]["named"] == "number"
    assert kinds[0]["params"]["sheet"] == "S-202"
    assert proposal["title"] == SHEET_2_VIEW


def test_the_export_carries_the_view_title_source_and_validates(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    with qs_project.member.acting():
        sha256 = drawings.file(file_id).sha256

    document = export.export(
        qs_project.member.developer_id,
        qs_project.project_id,
        {"structural/KR-STR-R4.dwg": sha256},
        folder=Path("/nonexistent"),
        run=RUN,
    )

    assert problems(document, load_schema()) == []
    [file] = cast(list[dict[str, Any]], document["files"])
    titles = {s["number"]["value"]: s["title"] for s in file["sheets"]}
    assert titles["S-202"] == {"value": SHEET_2_VIEW, "source": "view_title"}
    assert titles["S-201"]["source"] in TITLE_BLOCK
