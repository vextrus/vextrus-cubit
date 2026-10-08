"""The sheet list's batch reads (T-W319) give what the single-sheet reads give: each Plot reason
through `sheets()` equals `sheet()`'s at every state of the set's PDFs, `views_of_set` equals
`views()` when a sheet keeps views of an older reading, and a read with `anchors=False` refuses to
pass its anchors off as none. Every name and number is invented."""

import dataclasses
import uuid

import pytest

from engine.check.bangla_ansi import BanglaAnsi
from engine.messages import Message
from engine.read.anchor import DwgAnchor
from engine.recognise.types import Box, CheckOutcome, CheckResult, ViewCandidate, ViewKind
from vextrus.drawings import services
from vextrus.drawings.messages import sheets as said
from vextrus.drawings.models import SheetRevision
from vextrus.testing.drawings import (
    QsProject,
    add,
    artefact_for,
    drawing,
    frame,
    pdf_report,
    read_dwg,
    sheet_candidate,
)

pytestmark = pytest.mark.django_db


def _views(i: int, titles: tuple[str, ...] = ("Mock plan", "Mock section")) -> list[ViewCandidate]:
    box = frame(i)
    return [
        ViewCandidate(
            box=Box(box.x0 + 10 + 90 * n, 40, box.x0 + 90 + 90 * n, 140),
            kind=ViewKind.PLAN if n == 0 else ViewKind.SECTION,
            title=f"{title} {i}",
        )
        for n, title in enumerate(titles)
    ]


def test_each_plot_reason_through_the_list_is_the_single_sheet_reason(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    framed = add(member, project_id, "TR-STR-B2.dwg", drawing()).file
    [own] = read_dwg(member, framed.id, ["S-07"])
    loose = add(member, project_id, "survey-notes.dwg", drawing()).file
    [unfiled] = read_dwg(member, loose.id, ["Q-03"])
    with member.acting():
        set_id = services.set_of(project_id).id  # type: ignore[union-attr]

    def reasons() -> list[Message | None]:
        with member.acting():
            listed = {s.id: s.plot.none for s in services.sheets(set_id)}
            alone = {i: services.sheet(i).plot.none for i in (own.id, unfiled.id)}
        assert listed == alone
        return [listed[own.id], listed[unfiled.id]]

    no_pdf = reasons()
    add(member, project_id, "TR-ARC-B2.pdf", drawing("pdf"))  # another Discipline's, queued
    queued = reasons()
    photo = add(member, project_id, "TR-STR-photo.pdf", drawing("pdf")).file
    with member.acting():
        services.record_reports(photo.id, upload_report=pdf_report(photo.sha256, 1, refused=True))
    refused = reasons()
    failing = add(member, project_id, "TR-STR-B2.pdf", drawing("pdf")).file
    with member.acting():
        services.mark_failed(failing.id, {"code": "engine.read.reader_failed", "params": {}})
    unreadable = reasons()
    second = add(member, project_id, "TR-STR-B2 second.pdf", drawing("pdf")).file
    with member.acting():
        services.record_reports(second.id, upload_report=pdf_report(second.sha256, 1))
        services.mark_read(second.id)
    matched_none = reasons()

    assert no_pdf == [said.PLOT_NO_PDF(discipline="Structural"), said.PLOT_NO_PDF_ANY()]
    assert queued == [said.PLOT_NO_PDF(discipline="Structural"), said.PLOT_NOT_YET()]
    assert refused[0] == said.PLOT_PDF_REFUSED()
    assert unreadable[0] == said.PLOT_PDF_UNREAD()
    assert matched_none[0] == said.PLOT_NOT_MATCHED(plot_file="TR-STR-B2 second.pdf")


def test_the_views_of_a_set_are_each_sheets_views_at_its_kept_reading(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    found = add(member, project_id, "TR-STR-B2.dwg", drawing()).file
    first, renewed = read_dwg(member, found.id, ["S-11", "S-12"])
    with member.acting():
        services.record_views(first.id, _views(0))
        services.record_views(renewed.id, _views(1, ("Older plan", "Older section")))
        # A newer reader read the second sheet again: its views of the older reading stay stored
        # but are not its views.
        SheetRevision.objects.filter(id=renewed.id).update(reader_version="99.0-mock")
        set_id = services.set_of(project_id).id  # type: ignore[union-attr]
        batch = services.views_of_set(set_id)
        alone = {s: services.views(s) for s in (first.id, renewed.id)}

    assert {s: batch.get(s, []) for s in alone} == alone
    assert renewed.id not in batch
    assert [v.title for v in batch[first.id]] == ["Mock plan 0", "Mock section 0"]


def test_a_read_without_anchors_refuses_to_give_them(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    found = add(member, project_id, "TR-STR-B2.dwg", drawing(marker="mock-anchors")).file
    anchor = DwgAnchor(found.sha256, "synthetic", "1", "model/9", (), "4C2")
    with member.acting():
        services.store_artefact(found.id, artefact_for(found.sha256, found.name, 1))
        services.record_reports(
            found.id,
            cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
            bangla_ansi=BanglaAnsi(()),
        )
        [printed] = services.record_sheets(
            found.id, [sheet_candidate(0, found.group, number="S-21", anchors=(anchor,))]
        )
        services.record_views(printed.id, _views(0))
        services.mark_read(found.id)
        set_id = services.set_of(project_id).id  # type: ignore[union-attr]
        full = services.sheets(set_id)
        light = services.sheets(set_id, anchors=False)
        full_views = services.views_of_set(set_id)
        light_views = services.views_of_set(set_id, anchors=False)
        among = services.sheets(set_id, anchors=False, among=[printed.id, uuid.uuid4()])

    assert len(full[0].anchors) == 1
    for unread in (light[0].anchors, light_views[printed.id][0].anchors):
        with pytest.raises(services.AnchorsNotLoaded):
            list(unread)
        with pytest.raises(services.AnchorsNotLoaded):
            len(unread)
        with pytest.raises(services.AnchorsNotLoaded):
            bool(unread)
    # Everything else is the same read.
    assert dataclasses.replace(light[0], anchors=()) == dataclasses.replace(full[0], anchors=())
    assert [dataclasses.replace(v, anchors=()) for v in light_views[printed.id]] == [
        dataclasses.replace(v, anchors=()) for v in full_views[printed.id]
    ]
    assert [s.id for s in among] == [printed.id]


def test_the_facts_of_the_list_are_the_lists_sheets_in_its_order(qs_project: QsProject) -> None:
    member, project_id = qs_project.member, qs_project.project_id
    found = add(member, project_id, "TR-STR-B2.dwg", drawing()).file
    read_dwg(member, found.id, ["S-10", "S-9", None, "S-9A"])
    with member.acting():
        set_id = services.set_of(project_id).id  # type: ignore[union-attr]
        listed = services.sheets(set_id)
        facts = services.sheet_facts(set_id)

    assert [(f.id, f.number, f.discipline, f.decision, f.plot_page) for f in facts] == [
        (s.id, s.number, s.discipline, s.decision, s.plot.page) for s in listed
    ]
    assert [f.number for f in facts] == ["S-9", "S-9A", "S-10", None]
