"""Ticket 21b, the read job per sheet (`takeoff.services.read_propose.sheets`): the conventions it
reads with, the candidates it keeps between steps, and the `sheet_<n>` steps, run through 21a's read
job with readers a test gives: 13's and 17's hand-built drawing (`engine.recognise.tests.drawing`),
three frames in model space, each with a title block and one titled view (11's plain three frames
have no title block, so the finder reads no sheet from them). Mechanics only, never a reading.
"""

import hashlib
import re
import uuid
from pathlib import Path
from typing import Any

import pytest
from django.conf import settings
from procrastinate.job_context import AbortReason

from engine.check.bangla_ansi import BanglaAnsi
from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.read.anchor import DwgAnchor
from engine.read.pdf.types import PdfReport
from engine.recognise import sheets as finder
from engine.recognise import views as view_finder
from engine.recognise.tests.drawing import Sheets, frame_block, value_at
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
)
from engine.render import fonts
from vextrus.drawings import library as drawings_library
from vextrus.drawings import services as drawings
from vextrus.platform.services import jobs
from vextrus.takeoff.services.read_propose import files, sheets
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report
from vextrus.testing.jobs import run_inline
from vextrus.testing.read_steps import kept_steps, view_ids
from vextrus.testing.tenancy import Member

FRAMES = 3
AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)


# The conventions the product reads with (the plan's reviews A7 and Q8) -------------------------------


def test_13s_default_disciplines_are_every_markets_rows_by_key_and_prefix() -> None:
    default = [(d.key, d.prefixes) for d in finder.default_conventions().disciplines]
    assert drawings_library.DISCIPLINES, "no Market has Disciplines"
    for rows in drawings_library.DISCIPLINES.values():
        assert default == [(row.key, row.prefixes) for row in rows]


def test_the_disciplines_17_names_are_a_markets_disciplines() -> None:
    named = {*view_finder.STEP_DISCIPLINES, view_finder.PLUMBING_PART}
    for rows in drawings_library.DISCIPLINES.values():
        assert named <= {row.key for row in rows}


@pytest.mark.django_db
def test_a_file_is_read_with_its_markets_disciplines_over_13s_defaults(qs_project: QsProject) -> None:
    file_id = added(qs_project)

    with qs_project.member.acting():
        sheet_conventions, view_conventions = sheets.conventions(file_id)
        market = drawings.conventions(file_id)

    assert market
    assert sheet_conventions.disciplines == market
    default = finder.default_conventions()
    assert sheet_conventions.title_block_fields == default.title_block_fields
    assert view_conventions == view_finder.default_conventions()


# A candidate kept between steps ------------------------------------------------------------------


def test_a_candidate_is_read_back_from_its_json_as_it_was() -> None:
    anchor = DwgAnchor("a" * 64, "libredwg", "0.14", "", ("1F",), "2A")
    candidates = [
        SheetCandidate(
            location=SheetLocation(box=Box(0.5, 0.0, 210.25, 148.0)),
            number=Sourced("S-101", ValueSource.TITLE_BLOCK_ATTRIBUTE),
            title=Sourced("BEAM LAYOUT\nPLAN", ValueSource.TITLE_BLOCK_TEXT),
            discipline=Sourced("structural", ValueSource.FILE),
            revision_mark=Sourced("R1", ValueSource.FILE_NAME),
            issue_date=Sourced("12.08.2026", ValueSource.TITLE_BLOCK_TEXT),
            storeys_as_stated=Sourced("2ND & 4TH FLOOR", ValueSource.TITLE_BLOCK_TEXT),
            exclusion=Exclusion(ExclusionReason.OTHER, "The QS's words"),
            anchors=(anchor,),
            group=str(uuid.uuid4()),
        ),
        SheetCandidate(
            location=SheetLocation(layout="S-102"),
            exclusion=Exclusion(ExclusionReason.BLANK),
            group="site",
        ),
    ]

    for candidate in candidates:
        assert sheets.candidate_from_json(sheets.candidate_json(candidate)) == candidate


# The steps per sheet -----------------------------------------------------------------------------


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


SCALE = 50.0


def three_sheets(sha256: str, name: str) -> ReadArtefact:
    """Three A1 frames at 1:50 in model space, numbered S-101 to S-103, each with one titled view
    (a grid of lines), stamped with the file's sha256 (a kept artefact must be its file's)."""
    d = Sheets(source_name=name)
    block = frame_block(d)
    for i in range(FRAMES):
        ox = 10_000.0 + i * 60_000.0
        insert = d.insert(block, (ox, 0.0, 0.0), scale=(SCALE, SCALE, SCALE))
        placed = chain_transform(chain(d.artefact(), [insert]))
        for cell, text in {0: "GENERAL ARRANGEMENT", 2: f"S-{i + 101}"}.items():
            x, y, _ = placed.apply(value_at(cell))
            d.text(text, (x, y, 0.0), height=5.0 * SCALE)
        x0, y0, x1, y1 = ox + 40 * SCALE, 300 * SCALE, ox + 340 * SCALE, 560 * SCALE
        for k in range(5):
            d.line((x0 + (x1 - x0) * k / 4, y0), (x0 + (x1 - x0) * k / 4, y1))
            d.line((x0, y0 + (y1 - y0) * k / 4), (x1, y0 + (y1 - y0) * k / 4))
        d.text("GROUND FLOOR BEAM LAYOUT PLAN", (x0, y0 - 12 * SCALE, 0.0), height=6.0 * SCALE)
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


def readers() -> files.Readers:
    def first(path: Path, name: str) -> ReadArtefact:
        return three_sheets(_sha(path), name)

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
    abort_reason: Any = lambda: None,
) -> None:
    monkeypatch.setattr(files, "READERS", readers())
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        abort_reason=abort_reason,
        file_id=file_id,
    )


def added(qs: QsProject) -> uuid.UUID:
    return add(qs.member, qs.project_id, "KR-STR-R0.dwg", drawing("dwg")).file.id


def kept(member: Member, file_id: uuid.UUID) -> dict[str, Any]:
    rows = kept_steps(member, file_id)
    names = [row.step for row in rows]
    assert len(names) == len(set(names)), f"a step kept twice: {names}"
    return {row.step: row for row in rows}


def printed(member: Member, file_id: uuid.UUID) -> list[drawings.SheetView]:
    with member.acting():
        found = drawings.file(file_id)
        return [s for s in drawings.sheets(found.set_id) if s.file_id == file_id]


class SheetReads:
    """How many sheets were read (a skipped `sheet_<n>` step reads none)."""

    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.count = 0
        original = sheets._read_sheet

        def counted(*args: Any) -> Any:
            self.count += 1
            return original(*args)

        monkeypatch.setattr(sheets, "_read_sheet", counted)


@pytest.mark.django_db
def test_each_sheet_is_read_by_its_own_step_after_the_sheets_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    names = list(kept(qs_project.member, file_id))
    per_sheet = [drawings.sheet_step(n) for n in range(1, FRAMES + 1)]
    assert names == [
        drawings.OPENING,
        drawings.READING,
        drawings.SECOND_READER,
        drawings.SHEETS,
        *per_sheet,
        drawings.FINISHING,
    ]
    with qs_project.member.acting():
        view = drawings.file(file_id)
    assert view.state == drawings.FileState.READ
    assert view.sheets_found == FRAMES


@pytest.mark.django_db
def test_the_sheets_are_stamped_with_the_files_group_and_each_gets_its_views_and_render(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    with qs_project.member.acting():
        view = drawings.file(file_id)
        found = printed(qs_project.member, file_id)
        assert len(found) == FRAMES
        assert {s.building_id for s in found} == {view.building_id}
        assert {s.discipline for s in found} == {"structural"}
        for s in found:
            assert s.has_render
            assert drawings.render(s.id)
            assert [v.title for v in drawings.views(s.id)] == ["GROUND FLOOR BEAM LAYOUT PLAN"]
    steps = kept(qs_project.member, file_id)
    kept_candidates = steps[drawings.SHEETS].result["sheets"]
    assert {c["candidate"]["group"] for c in kept_candidates} == {view.group}
    for n in range(1, FRAMES + 1):
        assert steps[drawings.sheet_step(n)].result["render"] is True


@pytest.mark.django_db
def test_a_stop_after_the_first_sheet_resumes_at_the_second(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """What the toolchain acceptance test means, stopped by a count (a job's abort check reads no
    data outside a step)."""
    file_id = added(qs_project)
    member = qs_project.member
    reads = SheetReads(monkeypatch)

    def stop_once_sheet_1_is_read() -> AbortReason | None:
        return AbortReason.SHUTDOWN if reads.count >= 1 else None

    with pytest.raises(jobs.Stopped):
        run_job(member, file_id, monkeypatch, abort_reason=stop_once_sheet_1_is_read)
    before = kept(member, file_id)
    assert drawings.sheet_step(1) in before
    assert drawings.sheet_step(2) not in before
    # The sheet list shows only read files: sheet 1 by the `sheets` step's result.
    sheet_1 = uuid.UUID(before[drawings.SHEETS].result["sheets"][0]["id"])
    views_1 = view_ids(member, sheet_1)
    assert views_1

    run_job(member, file_id, monkeypatch)

    assert reads.count == FRAMES  # sheet 1 is not read again
    after = kept(member, file_id)
    assert {name: after[name].id for name in before} == {n: row.id for n, row in before.items()}
    assert {drawings.sheet_step(n) for n in range(1, FRAMES + 1)} <= set(after)
    assert view_ids(member, sheet_1) == views_1
    with member.acting():
        assert drawings.file(file_id).state == drawings.FileState.READ


@pytest.mark.django_db
def test_reading_the_file_again_reads_no_sheet_again(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = added(qs_project)
    run_job(qs_project.member, file_id, monkeypatch)
    first = {name: (row.id, row.result) for name, row in kept(qs_project.member, file_id).items()}
    reads = SheetReads(monkeypatch)

    run_job(qs_project.member, file_id, monkeypatch)

    assert reads.count == 0
    again = {name: (row.id, row.result) for name, row in kept(qs_project.member, file_id).items()}
    assert again == first


@pytest.mark.django_db
def test_a_view_limit_a_sheet_reached_is_said_by_that_sheets_step(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The view finder's scan bound, lowered so the first sheet spends it: its step says
    `views_scan_budget`; the sheet finder's `not_read_in_full` is left as it is."""
    monkeypatch.setattr(view_finder, "MAX_SCANS", 1)
    file_id = added(qs_project)

    run_job(qs_project.member, file_id, monkeypatch)

    steps = kept(qs_project.member, file_id)
    assert steps[drawings.SHEETS].result["not_read_in_full"] == []
    said = [steps[drawings.sheet_step(n)].result["not_read_in_full"] for n in range(1, FRAMES + 1)]
    limits = {m["params"]["limit"] for messages in said for m in messages}
    assert limits == {"views_scan_budget"}
    assert all(m["code"] == "takeoff.read_file.not_read_in_full" for ms in said for m in ms)
    for messages in said:
        assert len(messages) == len({m["params"]["limit"] for m in messages})


def test_not_read_in_full_words_every_view_limit_apart() -> None:
    po = Path(settings.BASE_DIR) / "web/src/messages/takeoff/read_file/en.po"
    [entry] = [e for e in po.read_text().split("\n\n") if "takeoff.read_file.not_read_in_full" in e]
    worded = dict(re.findall(r"(\w+) \{([^{}]*)\}", entry.split("msgstr", 1)[1]))
    assert set(sheets.VIEW_LIMITS) <= set(worded)
    assert not set(sheets.VIEW_LIMITS) & set(finder.LIMITS), "a view limit's key is a sheet limit's"
