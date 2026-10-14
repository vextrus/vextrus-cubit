"""S27-G1 fix round 1: a read file's Discipline changed by the QS matches the set's Plot again, as a
job (`takeoff.tasks.match_plot`), never in the request; till the job has run, the Plot's row reads
"Plot: waiting for its DWG…", never "0 of 8 matched".

The set, invented: a DWG guessed General by its name whose eight sheets (01 to 08) are the
structure's, and a Structural Plot of eight pages, page k naming sheet 0k. A Structural Plot never
plots a General sheet (#827), so it matches none until the QS sets the DWG's Discipline to
Structural; then every sheet ends on its page. And the other way: a Plot of no Discipline that
plotted the General sheets, set to Structural, lets them go.
"""

import uuid

import pytest
from django.db import connection

from engine.fixtures.pdf._writer import Page, Pdf, document, text, truetype_font
from vextrus.drawings import services
from vextrus.drawings.messages import files as words
from vextrus.takeoff.services.read_propose import plot
from vextrus.takeoff.tasks import match_plot, read_file
from vextrus.testing.drawings import QsProject, add, drawing, read_dwg
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

NUMBERS = [f"{k:02d}" for k in range(1, 9)]


@pytest.fixture(autouse=True)
def _reader_unsandboxed(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VEXTRUS_SANDBOX", "off")


def _plot_pdf() -> bytes:
    pdf = Pdf()
    fonts = {"F1": truetype_font(pdf)}
    pages = [Page(content=text(60, 60, n, size=10), fonts=fonts) for n in NUMBERS]
    return document(pdf, pages, info={"Producer": "DWG To PDF.hdi 27.0.0 (AutoCAD 2027)"})


def _dwg(qs: QsProject, name: str) -> uuid.UUID:
    file_id = add(qs.member, qs.project_id, name, drawing(marker=name)).file.id
    read_dwg(qs.member, file_id, NUMBERS, titles=[f"PLAN {n}" for n in NUMBERS])
    with qs.member.acting():
        plot.match(file_id)  # the DWG's `finishing` step's match
    return file_id


def _pdf(qs: QsProject, name: str) -> uuid.UUID:
    file_id = add(qs.member, qs.project_id, name, _plot_pdf()).file.id
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        file_id=file_id,
    )
    return file_id


def _pages(qs: QsProject, dwg_id: uuid.UUID) -> dict[str, int | None]:
    with qs.member.acting():
        listed = services.sheets(services.file(dwg_id).set_id)
    return {s.number or "": s.plot.page for s in listed if s.file_id == dwg_id}


def _status(qs: QsProject, file_id: uuid.UUID) -> object:
    with qs.member.acting():
        return services.file(file_id).status


def _change(qs: QsProject, file_id: uuid.UUID, key: str) -> int:
    """The QS sets the file's Discipline; the job queued for the set's Plot."""
    with qs.member.acting():
        services.set_discipline(file_id, key, actor_name=qs.member.user.name)
        queued = services.plot_queued(services.file(file_id).set_id)
    assert queued is not None, "no Plot match queued after the Discipline changed"
    return queued


def _run(qs: QsProject, job_id: int, file_id: uuid.UUID) -> None:
    """The queued job run here as its worker runs it: its row taken (`doing`), then ended."""
    with connection.cursor() as cursor:  # the worker's own updates
        cursor.execute("update procrastinate_jobs set status = 'doing' where id = %s", [job_id])
    run_inline(
        match_plot.match_plot,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        job_id=job_id,
        file_id=file_id,
    )
    with connection.cursor() as cursor:
        cursor.execute("update procrastinate_jobs set status = 'succeeded' where id = %s", [job_id])


def test_a_dwg_set_to_the_plots_discipline_ends_with_every_sheet_on_its_page(
    qs_project: QsProject,
) -> None:
    qs = qs_project
    dwg_id = _dwg(qs, "KR-GENERAL-NOTES-R0.dwg")
    pdf_id = _pdf(qs, "KR-STR-R0.pdf")
    with qs.member.acting():
        assert services.file(dwg_id).discipline == "general"
        assert services.file(pdf_id).discipline == "structural"
    assert set(_pages(qs, dwg_id).values()) == {None}
    assert _status(qs, pdf_id) == words.PLOT_WAITING()

    job_id = _change(qs, dwg_id, "structural")

    # Queued, not run: the request matched nothing, and the row waits rather than "0 of 8 matched".
    assert set(_pages(qs, dwg_id).values()) == {None}
    assert _status(qs, pdf_id) == words.PLOT_WAITING()

    _run(qs, job_id, dwg_id)

    assert _pages(qs, dwg_id) == {n: k for k, n in enumerate(NUMBERS, start=1)}
    assert _status(qs, pdf_id) == words.PLOT_MATCHED(matched=8, pages=8)
    with qs.member.acting():
        assert services.plot_queued(services.file(dwg_id).set_id) is None


def test_a_plot_given_a_discipline_lets_go_of_another_disciplines_sheets(qs_project: QsProject) -> None:
    qs = qs_project
    dwg_id = _dwg(qs, "KR-GENERAL-NOTES-R0.dwg")
    pdf_id = _pdf(qs, "KR-PLOT-R0.pdf")
    assert _pages(qs, dwg_id) == {n: k for k, n in enumerate(NUMBERS, start=1)}

    job_id = _change(qs, pdf_id, "structural")
    _run(qs, job_id, pdf_id)

    assert set(_pages(qs, dwg_id).values()) == {None}
    assert _status(qs, pdf_id) == words.PLOT_WAITING()


def test_a_later_change_keeps_its_own_job_waited_for(qs_project: QsProject) -> None:
    """An earlier job that runs after a second change was queued lets go of its own wait only."""
    qs = qs_project
    dwg_id = _dwg(qs, "KR-GENERAL-NOTES-R0.dwg")
    pdf_id = _pdf(qs, "KR-STR-R0.pdf")
    first = _change(qs, dwg_id, "structural")
    second = _change(qs, dwg_id, "architectural")
    assert second != first

    _run(qs, first, dwg_id)

    with qs.member.acting():
        assert services.plot_queued(services.file(dwg_id).set_id) == second
    assert _status(qs, pdf_id) == words.PLOT_WAITING()


def test_a_file_not_read_queues_no_plot_match(qs_project: QsProject) -> None:
    qs = qs_project
    _pdf(qs, "KR-STR-R0.pdf")
    waiting = add(qs.member, qs.project_id, "KR-GENERAL-NOTES-R0.dwg", drawing(marker="w")).file.id
    with qs.member.acting():
        services.set_discipline(waiting, "structural", actor_name=qs.member.user.name)
        assert services.plot_queued(services.file(waiting).set_id) is None
