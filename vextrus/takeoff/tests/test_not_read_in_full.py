"""Ticket nrif: a limit that cut a file's reading reaches the file's finding and its report, from the
current reading only. The acceptance tests (`acceptance/tnrif`) pin one run; these pin a run
resumed ("Try again") and a re-read in full, on 21b's synthetic three sheets. Mechanics only."""

import re
import uuid
from pathlib import Path

import pytest
from django.conf import settings

from engine.read import ReadArtefact
from engine.recognise import sheets as finder
from engine.render.fonts import FontReport
from vextrus.drawings import services as drawings
from vextrus.takeoff.messages import read_file as said
from vextrus.takeoff.services.read_propose import files, sheets
from vextrus.takeoff.tasks import read_file
from vextrus.takeoff.tests.test_read_sheet import added, readers
from vextrus.testing.drawings import QsProject
from vextrus.testing.jobs import run_inline
from vextrus.testing.tenancy import Member

pytestmark = pytest.mark.django_db


def run(member: Member, file_id: uuid.UUID) -> None:
    run_inline(
        read_file.read_file,
        tenant_id=member.developer_id,
        user_id=member.user.pk,
        file_id=file_id,
    )


class Fault(Exception):
    pass


def fonts_fail(artefact: ReadArtefact) -> FontReport:
    raise Fault


def cut_then_failed(qs: QsProject, monkeypatch: pytest.MonkeyPatch) -> uuid.UUID:
    """A reading the frame cap cut (its `sheets` step kept) that faulted in its last step, and that
    the QS then cancelled."""
    monkeypatch.setattr(finder, "MAX_FRAMES", 1)
    file_id = added(qs)
    use = files.Readers(**{**vars(readers()), "fonts": fonts_fail})
    monkeypatch.setattr(files, "READERS", use)
    with pytest.raises(Fault):
        run(qs.member, file_id)
    with qs.member.acting():
        assert drawings.cancel(file_id).state == drawings.FileState.CANCELLED
    return file_id


def test_try_again_still_says_the_limit_a_kept_step_said(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    file_id = cut_then_failed(qs_project, monkeypatch)
    monkeypatch.setattr(files, "READERS", readers())

    with qs_project.member.acting():
        drawings.restart(file_id)
    run(qs_project.member, file_id)

    with qs_project.member.acting():
        found = drawings.file(file_id)
        report = drawings.report(file_id)
    assert found.state == drawings.FileState.READ
    assert found.finding == said.NOT_READ_IN_FULL(limit="frames_capped")
    assert [m for m in report.sheets if m["code"] == said.NOT_READ_IN_FULL.code] == [
        said.NOT_READ_IN_FULL(limit="frames_capped")
    ]


def test_a_re_read_in_full_clears_the_finding(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The QS changes the Discipline and tries again: the sheets are found again (another key), in
    full this time, and the kept step that was cut is not this reading's."""
    file_id = cut_then_failed(qs_project, monkeypatch)
    monkeypatch.setattr(finder, "MAX_FRAMES", 50)
    monkeypatch.setattr(files, "READERS", readers())

    with qs_project.member.acting():
        drawings.set_discipline(file_id, "architectural")
        drawings.restart(file_id)
    run(qs_project.member, file_id)

    with qs_project.member.acting():
        found = drawings.file(file_id)
        report = drawings.report(file_id)
    assert found.state == drawings.FileState.READ
    assert found.finding is None
    assert [m for m in report.sheets if m["code"] == said.NOT_READ_IN_FULL.code] == []


def test_every_limit_a_finding_can_name_has_its_own_words() -> None:
    """The committed check for the class: a limit the job can say, worded by the catalogue's
    `{limit, select}` in a branch of its own (never `other`, which names no limit)."""
    po = Path(settings.BASE_DIR) / "web/src/messages/takeoff/read_file/en.po"
    [entry] = [e for e in po.read_text().split("\n\n") if said.NOT_READ_IN_FULL.code in e]
    worded = set(re.findall(r"(\w+) \{[^{}]*\}", entry.split("msgstr", 1)[1])) - {"other"}
    missing = (set(sheets.SHEETS_STEP_LIMITS) | set(sheets.SHEET_STEP_LIMITS)) - worded
    assert not missing, f"limits with no words of their own: {sorted(missing)}"
