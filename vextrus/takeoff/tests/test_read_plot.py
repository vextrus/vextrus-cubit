"""Ticket 157's own tests of the Plot matched in the read job (`read_propose.plot`): what is kept when
a set has more than one Plot, a Plot's unmatched pages in its report, Step 1's Plots per Discipline,
and the set's matching held one at a time. The acceptance tests are `acceptance/t157/`.

The toolchain tests use t157's acceptance fixtures (13's set A, 18's Plot of it) and a partial Plot
that plots S-101 alone. Needs the toolchain:

    uv run pytest -m "needs_toolchain and needs_bwrap" -rf vextrus/takeoff/tests/test_read_plot.py
"""

import uuid

import pytest
from django.db import connection, transaction

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
