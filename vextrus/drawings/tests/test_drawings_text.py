"""Every text drawings keeps, whatever the caller (ticket 14; review round 1, finding 1): a reading's
text is kept cleaned (no control, no lone surrogate), a value past its column refuses its item alone
and the file's report counts it; a person's words are kept as typed or refused in words. None of
these ever reaches the database as a bare error."""

import math
import uuid
from typing import Any, cast

import pytest

from engine.messages import Message
from engine.messages import read as read_codes
from engine.read.artefact import ReadArtefact
from engine.recognise.types import (
    Box,
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from vextrus.drawings import services
from vextrus.drawings.messages import reports as report_words
from vextrus.drawings.messages import sheets as said
from vextrus.platform.services import auth
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, frame

pytestmark = pytest.mark.django_db

NUL = "\x00"
LONE = "\udc81"


def kept_dwg(project: QsProject, frames: int = 3) -> services.FileView:
    found = add(project.member, project.project_id, "KR-STR-R0.dwg", drawing()).file
    with project.member.acting():
        services.store_artefact(found.id, artefact_for(found.sha256, found.name, frames))
    return found


def text(value: str) -> Sourced:
    return Sourced(value, ValueSource.TITLE_BLOCK_TEXT)


def candidate(
    found: services.FileView, i: int, *, layout: str | None = None, **fields: str
) -> SheetCandidate:
    location = SheetLocation(layout=layout) if layout is not None else SheetLocation(box=frame(i))
    return SheetCandidate(
        location=location,
        group=found.group,
        **{name: text(value) for name, value in fields.items()},  # type: ignore[arg-type]
    )


def view(**fields: Any) -> ViewCandidate:
    return ViewCandidate(box=Box(0, 0, 10, 10), kind=ViewKind.PLAN, **fields)


# A reading's text: kept cleaned -----------------------------------------------------------------------


def test_a_sheets_texts_are_kept_without_controls_or_lone_surrogates(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(
            found.id,
            [
                candidate(
                    found,
                    0,
                    number=f"S-{NUL}01",
                    title=f"GROUND{NUL} FLOOR\tPLAN\r\nBEAMS {LONE}",
                    revision_mark=f"R{NUL}1",
                    issue_date=f"12.{NUL}03.26",
                    storeys_as_stated=f"GF{LONE}",
                )
            ],
        )
    assert (printed.number, printed.title) == ("S-01", "GROUND FLOOR PLAN BEAMS \ufffd")
    assert (printed.revision_mark, printed.issue_date) == ("R1", "12.03.26")
    assert printed.storeys_as_stated == "GF\ufffd"


def test_a_layouts_name_is_kept_cleaned_in_its_place_and_key(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(
            found.id, [candidate(found, 0, layout=f"A1{NUL} LAYOUT{LONE}", number="S-01")]
        )
        again = services.record_sheets(
            found.id, [candidate(found, 0, layout=f"A1{NUL} LAYOUT{LONE}", number="S-01")]
        )
    assert printed.location == {"layout": "A1 LAYOUT\ufffd"}
    assert [s.id for s in again] == [printed.id]  # the same place, read again: the same row


def test_a_views_texts_are_kept_without_controls_or_lone_surrogates(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [candidate(found, 0, number="S-01")])
        [kept] = services.record_views(
            printed.id,
            [
                view(
                    title=f"PLAN{NUL} AT{LONE}",
                    stated_scale=f"1:{NUL}100",
                    storeys_as_stated=f"1st{NUL}",
                    exclusion=Exclusion(ExclusionReason.OTHER, f"not{NUL} ours{LONE}"),
                )
            ],
        )
    assert (kept.title, kept.stated_scale) == ("PLAN AT\ufffd", "1:100")
    assert kept.storeys_as_stated == "1st"  # a subject is a key: the engine refuses anything else
    assert kept.proposed_exclusion_text == "not ours\ufffd"


def test_a_finding_and_a_reports_words_are_kept_cleaned(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    finding = cast(  # a NaN is no Param, yet a caller may still hand one
        Message,
        {"code": "engine.read.reader_failed", "params": {"layer": f"A{NUL}{LONE}", "x": math.nan}},
    )
    with qs_project.member.acting():
        services.record_bangla_lines(found.id, [{"code": "engine.x", "params": {"text": f"a{NUL}"}}])
        shown = services.mark_failed(found.id, finding)
        report = services.report(found.id)
    assert shown.finding == {
        "code": "engine.read.reader_failed",
        "params": {"layer": "A\ufffd", "x": None},
    }
    assert report.bangla == ({"code": "engine.x", "params": {"text": "a"}},)


# A reading's text past its column: its item alone is not kept, and the report says so ----------------


@pytest.mark.parametrize("field", ["number", "revision_mark", "issue_date"])
def test_a_sheet_whose_text_is_past_its_column_is_not_kept_and_the_report_counts_it(
    qs_project: QsProject, field: str
) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        printed = services.record_sheets(
            found.id,
            [
                candidate(found, 0, number="S-01"),
                candidate(found, 1, **{"number": "S-02", field: "X" * 65}),
                candidate(found, 2, number="S-03"),
            ],
        )
        services.mark_read(found.id)
        shown = services.file(found.id)
        report = services.report(found.id)
    assert [(s.number, s.ordinal) for s in printed] == [("S-01", 1), ("S-03", 3)]
    assert shown.sheets_found == 2
    assert report_words.SHEETS_NOT_KEPT(sheets=1) in report.sheets


@pytest.mark.parametrize(
    "fields", [{"stated_scale": "1:" + "0" * 70}, {"subject": "s" * 65}], ids=["scale", "subject"]
)
def test_a_view_whose_text_is_past_its_column_is_not_kept_and_the_report_counts_it(
    qs_project: QsProject, fields: dict[str, str]
) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [candidate(found, 0, number="S-01")])
        kept = services.record_views(printed.id, [view(title="A"), view(**fields), view(title="C")])
        again = services.record_views(printed.id, [view(title="A"), view(**fields), view(title="C")])
        services.mark_read(found.id)
        report = services.report(found.id)
    assert [(v.title, v.ordinal) for v in kept] == [("A", 1), ("C", 3)]
    assert [(v.title, v.ordinal) for v in again] == [("A", 1), ("C", 3)]
    assert report_words.VIEWS_NOT_KEPT(views=1) in report.sheets  # counted once, read twice


def test_a_file_whose_every_sheet_was_not_kept_says_so_and_not_that_none_was_found(
    qs_project: QsProject,
) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        printed = services.record_sheets(
            found.id, [candidate(found, i, number=f"S-{i}", issue_date="D" * 65) for i in range(3)]
        )
        services.mark_read(found.id)
        report = services.report(found.id)
    assert printed == []
    assert report.sheets == (report_words.SHEETS_NOT_KEPT(sheets=3),)


def test_two_layouts_whose_names_differ_only_by_a_control_are_two_sheets(qs_project: QsProject) -> None:
    """Each place is keyed by its layout's name as read (escaped), so cleaning never makes two one."""
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        printed = services.record_sheets(
            found.id,
            [candidate(found, 0, layout="A1", number="S-01"), candidate(found, 1, layout=f"A1{NUL}")],
        )
        services.mark_read(found.id)
        shown = services.file(found.id)
    assert [s.location for s in printed] == [{"layout": "A1"}, {"layout": "A1"}]
    assert (len({s.id for s in printed}), shown.sheets_found) == (2, 2)


def test_a_kind_past_its_column_is_refused_in_words_by_either_path(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    long_key = "k" * 65
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [candidate(found, 0, number="S-01")])
        with pytest.raises(auth.Refused) as read_one:
            services.record_kind(printed.id, long_key)
        with pytest.raises(auth.Refused) as chosen:
            services.confirm_sheet(printed.id, confirmation_id=uuid.uuid4(), kind=long_key)
        services.record_kind(printed.id, "k" * 64)  # at its column: kept
    assert (read_one.value.status, read_one.value.message) == (
        400,
        {"code": "drawings.reads.kind_unknown", "params": {"file": "KR-STR-R0.dwg"}},
    )
    assert (chosen.value.status, chosen.value.message) == (400, said.KIND_UNKNOWN())


def test_a_reader_named_past_what_is_kept_is_refused_in_words(qs_project: QsProject) -> None:
    found = add(qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()).file
    made = artefact_for(found.sha256, found.name, 1)
    s = made.summary
    for reader, version in (("r" * 65, s.reader_version), (s.reader, f"1{NUL}")):
        artefact = ReadArtefact.build(
            source_sha256=s.source_sha256, source_name=s.source_name, format=s.format,
            reader=reader, reader_version=version, layouts=s.layouts, insunits=s.insunits,
            notes=s.notes, blocks=made.blocks.values(), entities=made.entities.values(),
        )  # fmt: skip
        with qs_project.member.acting(), pytest.raises(auth.Refused) as refused:
            services.store_artefact(found.id, artefact)
        assert (refused.value.status, refused.value.message) == (
            400,
            {"code": "drawings.reads.bad_reader", "params": {"file": "KR-STR-R0.dwg"}},
        )


# A person's words: kept as typed, or refused in words ----------------------------------------------


@pytest.mark.parametrize("words", [f"not {NUL} ours", f"not ours {LONE}", "bell\x07"])
def test_words_a_person_typed_that_cannot_be_kept_are_refused_and_nothing_changes(
    qs_project: QsProject, words: str
) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [candidate(found, 0, number="S-01")])
        services.mark_read(found.id)
        with pytest.raises(auth.Refused) as refused:
            services.exclude(printed.id, "other", words, confirmation_id=uuid.uuid4())
        after = services.sheet(printed.id)
    assert (refused.value.status, refused.value.message) == (400, said.TEXT_UNREADABLE())
    assert after.decision is None


def test_words_a_person_typed_keep_their_line_breaks(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        [printed] = services.record_sheets(found.id, [candidate(found, 0, number="S-01")])
        services.mark_read(found.id)
        left_out = services.exclude(
            printed.id,
            "other",
            "Issued twice.\nKeep R1.\tAsk the consultant.",
            confirmation_id=uuid.uuid4(),
        )
    assert left_out.excluded_text == "Issued twice.\nKeep R1.\tAsk the consultant."


def test_a_finding_code_from_the_engine_is_kept_as_it_is(qs_project: QsProject) -> None:
    found = kept_dwg(qs_project)
    with qs_project.member.acting():
        shown = services.mark_failed(found.id, read_codes.OBJECTS_MISSING(count=3))
    assert shown.finding == read_codes.OBJECTS_MISSING(count=3)
