"""What a read job keeps through `drawings` (ticket 14; for 21a): the StepStore, the kept ReadArtefact,
the reports, and a file's end, each refusing what is not its file's."""

import json
import uuid
from collections.abc import Callable
from typing import Any

import pytest
from django.db import connection

from engine.check.bangla_ansi import BanglaAnsi, Flagged, FoundBy
from engine.read.artefact import VERSION
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render.fixtures.artefacts import Drawing
from vextrus.drawings import services
from vextrus.drawings.messages import files as said
from vextrus.platform.services import auth, jobs, storage
from vextrus.projects import services as projects
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, pdf_report
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def one(statement: str, params: list[Any] | None = None) -> Any:
    with connection.cursor() as cursor:
        cursor.execute(statement, params or [])
        [(value,)] = cursor.fetchall()
    return value


@pytest.fixture
def dwg(qs_project: QsProject) -> tuple[Member, services.FileView]:
    return qs_project.member, add(
        qs_project.member, qs_project.project_id, "KR-STR-R0.dwg", drawing()
    ).file


# The kept ReadArtefact ----------------------------------------------------------------------------


def test_an_artefact_is_kept_as_canonical_json_under_its_reader_and_versions(
    dwg: tuple[Member, services.FileView],
) -> None:
    member, found = dwg
    artefact = artefact_for(found.sha256, found.name, 2)
    with member.acting():
        ref = services.store_artefact(found.id, artefact)
        again = services.store_artefact(found.id, artefact)
        loaded = services.artefact(found.id)
        content = storage.get(ref.key)
        counted = one("select count(*) from drawings_artefact")

    version = artefact.to_json()["version"]
    assert ref == again
    assert ref.key.endswith(f"/drawings/{found.sha256}/artefact@synthetic@1@v{version}.json")
    assert content == json.dumps(artefact.to_json(), sort_keys=True, separators=(",", ":")).encode()
    assert loaded.to_json() == artefact.to_json()
    assert counted == 1


def test_an_artefact_holding_nan_is_kept_and_loaded_back_as_written(
    dwg: tuple[Member, services.FileView],
) -> None:
    member, found = dwg
    d = Drawing()
    d.text("NO HEIGHT KNOWN", (0.0, 0.0, 0.0), kind="MTEXT", height=float("nan"))
    d.entity("CIRCLE", {"center": [0.0, 0.0, 0.0], "radius": float("nan")})
    made = d.artefact()
    s = made.summary
    artefact = type(made).build(
        source_sha256=found.sha256, source_name=found.name, format=s.format, reader=s.reader,
        reader_version=s.reader_version, layouts=s.layouts, insunits=s.insunits, notes=s.notes,
        blocks=made.blocks.values(), entities=made.entities.values(),
    )  # fmt: skip
    with member.acting():
        ref = services.store_artefact(found.id, artefact)
        again = services.store_artefact(found.id, artefact)
        loaded = services.artefact(found.id)

    written = json.dumps(artefact.to_json(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    back = json.dumps(loaded.to_json(), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    assert ref == again
    assert "NaN" in written
    assert back == written
    assert artefact.to_json()["version"] == VERSION


def test_an_artefact_holding_a_lone_surrogate_is_kept_and_loaded_back_the_same(
    dwg: tuple[Member, services.FileView],
) -> None:
    """The LibreDWG DXF path reads with errors="surrogateescape", and an entity keeps every value it
    read: a byte it could not decode stays a lone surrogate, which UTF-8 cannot hold."""
    member, found = dwg
    d = Drawing()
    d.text("T\udc81", (0.0, 0.0, 0.0), height=2.5)
    d.entity("CIRCLE", {"center": [0.0, 0.0, 0.0], "radius": 1.0, "thickness": "style\udc81"})
    made = d.artefact()
    s = made.summary
    artefact = type(made).build(
        source_sha256=found.sha256, source_name=found.name, format=s.format, reader=s.reader,
        reader_version=s.reader_version, layouts=s.layouts, insunits=s.insunits, notes=s.notes,
        blocks=made.blocks.values(), entities=made.entities.values(),
    )  # fmt: skip
    with member.acting():
        services.store_artefact(found.id, artefact)
        loaded = services.artefact(found.id)

    assert "style\udc81" in json.dumps(artefact.to_json(), ensure_ascii=False)
    assert loaded.to_json() == artefact.to_json()


def test_another_reader_version_keeps_its_own_copy(dwg: tuple[Member, services.FileView]) -> None:
    member, found = dwg
    first = artefact_for(found.sha256, found.name, 1)
    s = first.summary
    newer = type(first).build(
        source_sha256=s.source_sha256, source_name=s.source_name, format=s.format, reader="lib redwg",
        reader_version="0.14/2", layouts=s.layouts, insunits=s.insunits, notes=s.notes,
        blocks=first.blocks.values(), entities=first.entities.values(),
    )  # fmt: skip
    with member.acting():
        a = services.store_artefact(found.id, first)
        b = services.store_artefact(found.id, newer)
        assert services.artefact(found.id, reader_version="1").summary.reader == "synthetic"
        assert services.artefact(found.id, reader_version="0.14/2").summary.reader == "lib redwg"

    assert a.key != b.key
    assert "lib redwg" not in b.key  # named by a digest, never raw
    assert "0.14/2" not in b.key


def test_an_artefact_of_another_file_or_of_a_pdf_is_refused(qs_project: QsProject) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "S.dwg", drawing()).file
    pdf = add(member, qs_project.project_id, "S.pdf", drawing("pdf")).file
    with member.acting():
        with pytest.raises(auth.Refused) as other:
            services.store_artefact(dwg.id, artefact_for("0" * 64, "S.dwg", 1))
        with pytest.raises(auth.Refused) as wrong_kind:
            services.store_artefact(pdf.id, artefact_for(pdf.sha256, "S.pdf", 1))
        assert one("select count(*) from drawings_artefact") == 0
    assert (other.value.status, other.value.message) == (
        400,
        {"code": "drawings.reads.not_its_reading", "params": {"file": "S.dwg"}},
    )
    assert wrong_kind.value.message == {"code": "drawings.reads.wrong_kind", "params": {"file": "S.pdf"}}


# Reports -------------------------------------------------------------------------------------------


def test_a_dwgs_reports_are_kept_as_codes_and_the_bangla_flag_shows(
    dwg: tuple[Member, services.FileView],
) -> None:
    member, found = dwg
    with member.acting():
        services.record_reports(
            found.id,
            cross_check=CheckResult("decoders_agree", CheckOutcome.PASSED),
            bangla_ansi=BanglaAnsi((Flagged("1A", FoundBy.FONT, "SutonnyMJ"),)),
        )
        read = services.mark_read(found.id)
        kept = one("select cross_check from drawings_drawingfile where id = %s", [found.id])
    assert json.loads(kept) == {"code": "decoders_agree", "outcome": "passed", "finding": None}
    assert read.status == said.READ_BANGLA()


def test_a_pdfs_report_counts_its_pages_and_a_scan_is_refused(qs_project: QsProject) -> None:
    member = qs_project.member
    pdf = add(member, qs_project.project_id, "site-photos.pdf", drawing("pdf")).file
    with member.acting():
        refused = services.record_reports(pdf.id, upload_report=pdf_report(pdf.sha256, 2, refused=True))
        pages = one("select sheets_total from drawings_drawingfile where id = %s", [pdf.id])
    assert (refused.state, refused.status) == ("refused", said.REFUSED_SCAN())
    assert refused.finding == {"code": "engine.pdf_report.refused_scan", "params": {}}
    assert pages == 2


def test_a_report_of_another_file_or_kind_is_refused(qs_project: QsProject) -> None:
    member = qs_project.member
    dwg = add(member, qs_project.project_id, "S.dwg", drawing()).file
    pdf = add(member, qs_project.project_id, "S.pdf", drawing("pdf")).file
    with member.acting():
        with pytest.raises(auth.Refused) as dwg_given_pdf:
            services.record_reports(dwg.id, upload_report=pdf_report(dwg.sha256, 1))
        with pytest.raises(auth.Refused) as other_file:
            services.record_reports(pdf.id, upload_report=pdf_report(dwg.sha256, 1))
        with pytest.raises(auth.Refused) as pdf_given_dwg:
            services.record_reports(
                pdf.id,
                upload_report=pdf_report(pdf.sha256, 1),
                cross_check=CheckResult("decoders_agree", CheckOutcome.PASSED),
            )
    assert dwg_given_pdf.value.message["code"] == "drawings.reads.wrong_kind"
    assert other_file.value.message["code"] == "drawings.reads.not_its_reading"
    assert pdf_given_dwg.value.message["code"] == "drawings.reads.wrong_kind"


# The StepStore and a file's end ----------------------------------------------------------------------


def test_the_step_store_keeps_a_step_once_and_writes_progress_while_in_flight(
    dwg: tuple[Member, services.FileView],
) -> None:
    member, found = dwg
    store = services.step_store()
    key = jobs.StepKey(found.id, "opening", "c" * 64)
    with member.acting():
        assert store.completed(key) is None
        store.record(key, {"n": 1})
        assert store.completed(key) == {"n": 1}
        store.progress(found.id, jobs.Progress(0, 5, services.sheet_step(3)))
        after = services.file(found.id)
        services.cancel(found.id, actor_name="N")
        store.progress(found.id, jobs.Progress(1, 5, services.sheet_step(4)))
        step = one("select read_step from drawings_drawingfile where id = %s", [found.id])
    assert after.state == "reading"
    assert step == "sheet_3"


def test_a_file_cancelled_meanwhile_is_never_marked_read_held_or_failed(
    dwg: tuple[Member, services.FileView],
) -> None:
    member, found = dwg
    with member.acting():
        services.cancel(found.id, actor_name="Nusrat Jahan")
        read = services.mark_read(found.id)
        held = services.quarantine(found.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        failed = services.mark_failed(found.id, {"code": "engine.decoders_agree.stopped", "params": {}})
    assert {read.state, held.state, failed.state} == {"cancelled"}


def test_an_old_autocad_file_reads_its_own_row(dwg: tuple[Member, services.FileView]) -> None:
    member, found = dwg
    with member.acting():
        shown = services.mark_failed(found.id, said.OLD_VERSION())
        with pytest.raises(auth.Refused) as restart:
            services.restart(found.id)
    assert (shown.state, shown.status) == ("unreadable", said.OLD_VERSION())
    assert (restart.value.status, restart.value.message) == (409, said.OLD_VERSION())


def test_a_read_job_is_attached_only_when_it_is_the_developers_own(
    dwg: tuple[Member, services.FileView], sign_in: Callable[..., Member]
) -> None:
    member, found = dwg
    stranger = sign_in(role="qs")
    with stranger.acting():
        theirs = projects.create(code="TH-4", name="Theirs")
    their_file = add(stranger, theirs.id, "T.dwg", drawing()).file
    from vextrus.testing.drawings import read_stub

    with stranger.acting():
        their_job = read_stub.defer(file_id=their_file.id)
    with member.acting():
        for job_id in (their_job, 10**12, "1"):
            with pytest.raises(auth.NotFound):
                services.attach_read_job(found.id, job_id)  # type: ignore[arg-type]
        assert one("select read_job_id from drawings_drawingfile where id = %s", [found.id]) is None


def test_the_original_is_a_checked_private_copy(dwg: tuple[Member, services.FileView]) -> None:
    member, found = dwg
    with member.acting(), services.original(found.id) as path:
        assert path.read_bytes().startswith(b"AC1032")
        copy = path
    assert not copy.exists()


def test_a_held_file_is_answered_only_while_held(dwg: tuple[Member, services.FileView]) -> None:
    member, found = dwg
    with member.acting():
        with pytest.raises(auth.NotFound):
            services.answer_held(found.id, "read_anyway")
        services.quarantine(found.id, {"code": "engine.decoders_agree.disagree", "params": {}})
        answered = services.answer_held(found.id, services.HeldAnswer.AWAIT_RESAVED)
    assert (answered.state, answered.status) == ("held", said.AWAIT_RESAVED())


def test_another_developers_file_is_not_found_by_any_read_service(
    dwg: tuple[Member, services.FileView], sign_in: Callable[..., Member]
) -> None:
    _member, found = dwg
    stranger = sign_in(role="qs")
    calls: list[Callable[[], object]] = [
        lambda: services.file(found.id),
        lambda: services.store_artefact(found.id, artefact_for(found.sha256, found.name, 1)),
        lambda: services.record_reports(found.id),
        lambda: services.mark_read(found.id),
        lambda: services.quarantine(found.id, said.HELD()),
        lambda: services.cancel(found.id),
        lambda: services.restart(found.id),
        lambda: services.set_discipline(found.id, "structural"),
        lambda: services.step_store().completed(jobs.StepKey(found.id, "opening", "d" * 64)),
        lambda: services.conventions(found.id),
        lambda: services.record_sheets(found.id, []),
    ]
    with stranger.acting():
        for call in calls:
            with pytest.raises(auth.NotFound):
                call()
    assert uuid.UUID(str(found.id))
