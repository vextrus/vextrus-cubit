"""Opening a Trace anchor (ticket 14; ADR 0031 §2): the file, the printed sheet and the entity with
its insert chain, against the anchor's own reader version only; anything else one "not found"."""

import uuid
from collections.abc import Callable
from dataclasses import replace
from typing import Any

import pytest

from engine.read.anchor import DwgAnchor, PdfAnchor
from engine.read.artefact import ReadArtefact
from engine.read.pdf.types import Page
from engine.recognise.types import PlotMatch
from engine.render.fixtures.artefacts import Drawing
from vextrus.drawings import services
from vextrus.drawings.schemas.anchors import StoredAnchor
from vextrus.platform.services import auth
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, add, drawing, pdf_report, sheet_candidate
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def chained(sha256: str) -> tuple[ReadArtefact, tuple[str, str, str]]:
    """A pile in a cap, the cap placed in the drawing: (outer insert, inner insert, the circle)."""
    d = Drawing()
    pile = d.block("PILE")
    circle = d.entity("CIRCLE", {"center": [10.0, 0.0, 0.0], "radius": 3.0}, owner=pile)
    cap = d.block("CAP")
    inner = d.insert(pile, (0, 0, 0), owner=cap)
    outer = d.insert(cap, (100, 100, 0))
    made = d.artefact()
    s = made.summary
    artefact = ReadArtefact.build(
        source_sha256=sha256, source_name="S.dwg", format=s.format, reader=s.reader,
        reader_version=s.reader_version, layouts=s.layouts, insunits=s.insunits, notes=s.notes,
        blocks=made.blocks.values(), entities=made.entities.values(),
    )  # fmt: skip
    return artefact, (outer, inner, circle)


@pytest.fixture
def anchored(qs_project: QsProject) -> tuple[QsProject, services.SheetView, DwgAnchor]:
    member = qs_project.member
    found = add(member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    artefact, (outer, inner, circle) = chained(found.sha256)
    anchor = DwgAnchor(found.sha256, "synthetic", "1", "model/1", (outer, inner), circle)
    with member.acting():
        services.store_artefact(found.id, artefact)
        [printed] = services.record_sheets(
            found.id, [sheet_candidate(0, found.group, number="S-02", anchors=(anchor,))]
        )
        services.mark_read(found.id)
    return qs_project, printed, anchor


def test_a_dwg_anchor_opens_its_entity_through_its_insert_chain(
    anchored: tuple[QsProject, services.SheetView, DwgAnchor],
) -> None:
    project, printed, anchor = anchored
    stored = StoredAnchor.of(anchor, sheet_revision_id=printed.id)
    with project.member.acting():
        found = services.resolve(stored.anchor(), sheet_revision_id=stored.sheet_revision_id)

    assert found.file.id == printed.file_id
    assert found.sheet.id == printed.id
    assert found.entity is not None
    assert found.entity.handle == anchor.handle
    assert [insert.handle for insert in found.chain] == list(anchor.inserts)
    assert printed.anchors == (stored,)
    assert (stored.source_sha256, stored.reader_version) == (anchor.source_sha256, "1")
    assert "source_sha256" not in stored.detail


@pytest.mark.parametrize(
    "change",
    [
        {"reader_version": "2"},
        {"reader": "libredwg"},
        {"handle": "FFFF"},
        {"inserts": ()},
        {"inserts": ("REVERSED",)},
        {"sheet": "model/2"},
        {"source_sha256": "e" * 64},
    ],
)
def test_an_anchor_not_there_is_not_found(
    anchored: tuple[QsProject, services.SheetView, DwgAnchor], change: dict[str, Any]
) -> None:
    project, printed, anchor = anchored
    if change.get("inserts") == ("REVERSED",):
        change = {"inserts": tuple(reversed(anchor.inserts))}
    wrong = replace(anchor, **change)
    with project.member.acting(), pytest.raises(auth.NotFound) as refused:
        services.resolve(wrong, sheet_revision_id=printed.id)
    assert refused.value.message == {"code": "platform.auth.not_found", "params": {}}


def test_another_developers_or_scopes_anchor_is_not_found(
    anchored: tuple[QsProject, services.SheetView, DwgAnchor], sign_in: Callable[..., Member]
) -> None:
    project, printed, anchor = anchored
    stranger = sign_in(role="qs")
    with project.member.acting():
        elsewhere = projects.create(code="EL-1", name="Elsewhere")
    scoped = sign_in(role="guest", developer_id=project.member.developer_id, projects=[elsewhere.id])
    for member in (stranger, scoped):
        with member.acting(), pytest.raises(auth.NotFound):
            services.resolve(anchor, sheet_revision_id=printed.id)
    with project.member.acting(), pytest.raises(auth.NotFound):
        services.resolve(anchor, sheet_revision_id=uuid.uuid4())


def test_a_pdf_anchor_opens_its_page_where_the_sheet_is_plotted(
    anchored: tuple[QsProject, services.SheetView, DwgAnchor],
) -> None:
    project, printed, _anchor = anchored
    pdf = add(project.member, project.project_id, "KR-STR-R0.pdf", drawing("pdf")).file
    with project.member.acting():
        services.record_reports(pdf.id, upload_report=pdf_report(pdf.sha256, 4))
        services.mark_read(pdf.id)
        page = Page(pdf.sha256, 3, 1190.0, 842.0, 0, (0.0, 0.0, 1190.0, 842.0), False, ())
        services.record_plot(printed.id, PlotMatch(page, sheet_candidate(0, "g", number="S-02")))
        here = PdfAnchor(pdf.sha256, "pdf", "1", 3, 7, (1.0, 2.0, 3.0, 4.0))
        found = services.resolve(here, sheet_revision_id=printed.id)
        for wrong in (
            replace(here, page=4),
            replace(here, page=9),
            replace(here, source_sha256="c" * 64),
        ):
            with pytest.raises(auth.NotFound):
                services.resolve(wrong, sheet_revision_id=printed.id)
    assert (found.file.id, found.page, found.path_index, found.box) == (
        pdf.id,
        3,
        7,
        (1.0, 2.0, 3.0, 4.0),
    )
