"""Ticket 157's own tests of the Plot matched in the read job (`read_propose.plot`): what is kept when
a set has more than one Plot, a Plot's unmatched pages in its report, Step 1's Plots per Discipline,
and the set's matching held one at a time. The acceptance tests are `acceptance/t157/`.

The toolchain tests use t157's acceptance fixtures (13's set A, 18's Plot of it) and a partial Plot
that plots S-101 alone. Needs the toolchain:

    uv run pytest -m "needs_toolchain and needs_bwrap" -rf vextrus/takeoff/tests/test_read_plot.py
"""

import uuid
from pathlib import Path

import pytest
from django.conf import settings
from django.db import connection, transaction

from engine.read import ReadError
from engine.read import pdf as pdf_reader
from vextrus.drawings import services as drawings
from vextrus.drawings.messages import sheets as said
from vextrus.platform.services import auth
from vextrus.takeoff.schemas.step1 import Step1ProgressOut
from vextrus.takeoff.services import step1
from vextrus.takeoff.tests.acceptance.t157.test_plot_matched_toolchain import (  # noqa: F401 (fixtures)
    dumper,
    engine_readers,
    plot,
    run_job,
    set_a,
    sheets_of,
)
from vextrus.testing.drawings import QsProject, add
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


@pytest.fixture(scope="module")
def partial_plot() -> bytes:
    """A Plot of set A's S-101 alone, its title block in text (18's page for it)."""
    from engine.fixtures.pdf._writer import Page, Pdf, document, truetype_font
    from engine.plot.tests.acceptance.t18.test_plot_registration import A1, _landscape

    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    page = Page(
        content=_landscape("S-101", ("PILE CAP", "LAYOUT PLAN"), "R1", "12.08.2026"),
        size=A1,
        fonts=fonts,
    )
    return document(pdf, [page], info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_a_set_with_two_plots_keeps_each_sheet_on_the_first_page_found_and_says_what_matched_none(
    qs_project: QsProject,
    set_a: bytes,  # noqa: F811 (the acceptance module's fixtures)
    plot: bytes,  # noqa: F811
    partial_plot: bytes,
    engine_readers: None,  # noqa: F811
) -> None:
    member = qs_project.member
    ids = {}
    for name, content in (
        ("KR-STR-R0.dwg", set_a),
        ("KR-STR-PART.pdf", partial_plot),
        ("KR-STR-PLOT.pdf", plot),
    ):
        ids[name] = add(member, qs_project.project_id, name, content).file.id
        run_job(member, ids[name])
        if name == "KR-STR-PART.pdf":
            after_part = sheets_of(member, ids["KR-STR-R0.dwg"])
    dwg, part, full = ids["KR-STR-R0.dwg"], ids["KR-STR-PART.pdf"], ids["KR-STR-PLOT.pdf"]

    # The partial Plot matched S-101; the others were tried against it and found no page.
    assert (after_part["S-101"].plot.file_id, after_part["S-101"].plot.page) == (part, 1)
    for number in ("S-102", "S-103"):
        assert after_part[number].plot.none == said.PLOT_NO_PAGE(plot_file="KR-STR-PART.pdf")

    # The full Plot gives the others their pages; S-101 keeps the first Plot's page.
    sheets = sheets_of(member, dwg)
    assert {n: (s.plot.file_id, s.plot.page) for n, s in sheets.items()} == {
        "S-101": (part, 1),
        "S-102": (full, 1),
        "S-103": (full, 3),
    }
    with member.acting():
        report = drawings.report(full)
    unmatched = [dict(m) for m in report.pages if m["code"].startswith("engine.plot.")]
    assert unmatched == [{"code": "engine.plot.names_no_sheet", "params": {"page": 4}}]

    # Step 1 names the Plots read for the Discipline, first added first (for the one-source toast).
    with member.acting():
        progress = step1.progress(qs_project.project_id)
    [structural] = [d for d in progress.disciplines if d.discipline == "structural"]
    assert structural.plots == (
        step1.PlotFile(part, "KR-STR-PART.pdf"),
        step1.PlotFile(full, "KR-STR-PLOT.pdf"),
    )
    shown = Step1ProgressOut.from_view(progress).model_dump(mode="json")
    [row] = [d for d in shown["disciplines"] if d["discipline"] == "structural"]
    assert row["plots"] == [
        {"file_id": str(part), "name": "KR-STR-PART.pdf"},
        {"file_id": str(full), "name": "KR-STR-PLOT.pdf"},
    ]


def _plots(member: Member, dwg: uuid.UUID) -> dict[str, tuple[object, ...]]:
    found: dict[str, tuple[object, ...]] = {}
    for n, s in sheets_of(member, dwg).items():
        none = s.plot.none
        found[n] = (
            s.plot.file_id,
            s.plot.page,
            None if none is None else none["code"],
            None if none is None else none["params"],
        )
    return found


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
@pytest.mark.parametrize("dwg_first", [True, False], ids=["dwg-first", "dwg-last"])
def test_with_two_plots_the_first_added_keeps_each_sheet_whichever_is_read_first(
    qs_project: QsProject,
    set_a: bytes,  # noqa: F811
    plot: bytes,  # noqa: F811
    partial_plot: bytes,
    engine_readers: None,  # noqa: F811
    dwg_first: bool,
) -> None:
    """The refuter's case (157): the full Plot added before the partial one, the partial read first;
    S-101, which both plot, was the partial's when the DWG was read first and the full's when last."""
    member = qs_project.member
    dwg = None
    if dwg_first:
        dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
        run_job(member, dwg)
    full = add(member, qs_project.project_id, "KR-STR-PLOT.pdf", plot).file.id
    part = add(member, qs_project.project_id, "KR-STR-PART.pdf", partial_plot).file.id
    run_job(member, part)
    run_job(member, full)
    if dwg is None:
        dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
        run_job(member, dwg)

    found = _plots(member, dwg)
    assert {n: v[:2] for n, v in found.items()} == {
        "S-101": (full, 2),
        "S-102": (full, 1),
        "S-103": (full, 3),
    }


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_a_plot_that_cannot_be_read_again_is_never_named_as_having_no_page_for_a_sheet(
    qs_project: QsProject,
    set_a: bytes,  # noqa: F811
    plot: bytes,  # noqa: F811
    partial_plot: bytes,
    engine_readers: None,  # noqa: F811
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The refuter's case (157): the full Plot, added first, fails its second reading at the DWG's
    finishing; S-102 and S-103 said "no page of" it, though it was never tried (and plots both)."""
    member = qs_project.member
    full = add(member, qs_project.project_id, "KR-STR-PLOT.pdf", plot).file.id
    run_job(member, full)
    part = add(member, qs_project.project_id, "KR-STR-PART.pdf", partial_plot).file.id
    run_job(member, part)
    real, calls = pdf_reader.page_text, []

    def once_unreadable(path: Path) -> object:
        calls.append(path)
        if len(calls) == 1:
            raise ReadError({"code": "engine.read.reader_failed", "params": {}})
        return real(path)

    monkeypatch.setattr(pdf_reader, "page_text", once_unreadable)
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id
    run_job(member, dwg)

    found = _plots(member, dwg)
    with member.acting():
        assert drawings.file(dwg).state == drawings.FileState.READ
    assert found["S-101"][:2] == (part, 1)
    for number in ("S-102", "S-103"):
        assert found[number][2:] == (said.PLOT_NO_PAGE.code, {"plot_file": "KR-STR-PART.pdf"}), number


@pytest.mark.needs_toolchain
@pytest.mark.needs_bwrap
def test_a_damaged_copy_of_another_read_plot_does_not_fail_the_dwgs_read(
    qs_project: QsProject,
    set_a: bytes,  # noqa: F811
    plot: bytes,  # noqa: F811
    engine_readers: None,  # noqa: F811
) -> None:
    """The refuter's case (157): a read Plot's stored copy damaged, then its DWG read: the DWG's job
    failed on the Plot's copy, every try. The Plot is left out, the DWG is read."""
    member = qs_project.member
    full = add(member, qs_project.project_id, "KR-STR-PLOT.pdf", plot).file
    run_job(member, full.id)
    [copy] = [
        p
        for p in Path(settings.VEXTRUS_STORAGE_ROOT).rglob(f"{full.sha256}/original.pdf")
        if str(qs_project.project_id) in str(p)
    ]
    copy.write_bytes(b"%PDF-1.7 damaged")
    dwg = add(member, qs_project.project_id, "KR-STR-R0.dwg", set_a).file.id

    run_job(member, dwg)

    with member.acting():
        assert drawings.file(dwg).state == drawings.FileState.READ
    assert all(v[1] is None for v in _plots(member, dwg).values())


def test_the_sets_plot_matching_is_held_until_the_transaction_ends(qs_project: QsProject) -> None:
    member = qs_project.member
    added = add(member, qs_project.project_id, "KR-STR-R0.dwg", b"AC1032 not read").file

    def advisory_locks() -> int:
        with connection.cursor() as cursor:
            cursor.execute(
                "select count(*) from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()"
            )
            return int(cursor.fetchone()[0])

    with member.acting(), transaction.atomic():
        before = advisory_locks()
        drawings.hold_plots(added.set_id)
        held = advisory_locks()
    assert held == before + 1


def test_holding_a_sets_plot_matching_is_refused_for_a_set_out_of_reach(qs_project: QsProject) -> None:
    with qs_project.member.acting(), transaction.atomic(), pytest.raises(auth.NotFound):
        drawings.hold_plots(uuid.uuid4())


def test_of_two_pages_with_a_sheets_number_whole_the_one_its_drawing_fits_is_its_page() -> None:
    """Measured on a real set (157): two pages of one PDF carried a sheet's number whole; the one
    named first, in text as large, fitted the sheet at the residual's ceiling, and took it from its
    own page. Whole before not, then the fit, then the text's size."""
    from types import SimpleNamespace

    from engine.read.anchor import PdfAnchor
    from engine.read.pdf.types import Page, TextItem, TextSource
    from engine.recognise.types import PlotMatch, SheetCandidate, SheetLocation
    from vextrus.takeoff.services.read_propose.plot import _surest

    sha = "b" * 64

    def page(number: int, text: str, size: float) -> Page:
        box = (10.0, 10.0, 10.0 + size * len(text), 10.0 + size)
        item = TextItem(
            text,
            TextSource.TEXT,
            PdfAnchor(sha, "pdfminer", "1", number, 0, box),
            size,
            0.0,
            False,
            None,
        )
        return Page(sha, number, 2384.0, 1684.0, 0, (0.0, 0.0, 2384.0, 1684.0), False, (item,))

    candidate = SheetCandidate(SheetLocation(layout="50"))
    sheet = SimpleNamespace(id=uuid.uuid4(), number="50")
    pdf = SimpleNamespace(id=uuid.uuid4())

    def surest(*matches: PlotMatch) -> int:
        found = _surest(matches, {id(candidate): sheet}, {sha: pdf})  # type: ignore[dict-item]
        return found[(sheet.id, pdf.id)]

    misfit = PlotMatch(page(14, "50", 8.0), sheet=candidate, residual=3.0)
    own = PlotMatch(page(50, "50", 8.0), sheet=candidate, residual=0.25)
    referred = PlotMatch(page(3, "SEE 50", 30.0), sheet=candidate, residual=0.0)
    assert surest(misfit, own) == 1
    assert surest(own, misfit) == 0
    assert surest(referred, misfit) == 1  # whole before a mention among other words
    unplaced = PlotMatch(page(14, "50", 12.0), sheet=candidate)
    assert surest(unplaced, own) == 1  # a page never placed fits worse than one placed
