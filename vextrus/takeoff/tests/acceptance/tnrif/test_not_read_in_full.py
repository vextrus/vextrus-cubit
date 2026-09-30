"""Ticket nrif: "not read in full" reaches the QS (session 07's adversary finding F1, on 21a and 21b).

The rule (the session-06 brief, for 21a): "A limit above 0 tells the QS the file was not read in full,
by which limit, never a bare 'no sheets'". 21b fills `takeoff.read_file.not_read_in_full {limit}` in
its steps' results only; the web (20b's `ReportPanel`) shows the file's `finding` when its code starts
`takeoff.read_file.`. Pinned here, through the API a QS's screen reads (GET the file, GET its report),
on synthetic drawings (the repo's hand-built `engine.recognise.tests.drawing` and 11's
`artefact_for`), each limit made to fire by lowering its cap:

- the file's `finding` is `takeoff.read_file.not_read_in_full` with the limit that fired;
- the report's `sheets` section says `takeoff.read_file.not_read_in_full {limit}` once for every
  limit that fired (so it never says "no sheets" without its reason);
- a file read in full keeps `finding` null and its report says no limit;
- the file stays `read` (a file cut short is still read).

The shape chosen for several limits (a Message's params are `str | int`, so no list fits in one
`{limit}`): the file's `finding` names one of the limits that fired, and the report's `sheets` section
names every one of them, each once. No toolchain: the readers are given, as in 21b's tests.
"""

import hashlib
import uuid
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from engine.check.bangla_ansi import BanglaAnsi
from engine.geometry.placement import chain, chain_transform
from engine.read import ReadArtefact
from engine.read.pdf.types import PdfReport
from engine.recognise import sheets as finder
from engine.recognise import views as view_finder
from engine.recognise.tests.drawing import Sheets, frame_block, value_at
from engine.recognise.types import CheckOutcome, CheckResult
from engine.render import fonts
from vextrus.takeoff.services.read_propose import files, sheets
from vextrus.takeoff.tasks import read_file
from vextrus.testing.drawings import QsProject, add, artefact_for, drawing, pdf_report
from vextrus.testing.jobs import run_inline

pytestmark = pytest.mark.django_db

NOT_READ_IN_FULL = "takeoff.read_file.not_read_in_full"
NO_SHEETS = "drawings.reports.no_sheets"
AGREE = CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED)
SCALE = 50.0


# Synthetic drawings -------------------------------------------------------------------------------


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def titled_sheets(sha256: str, name: str) -> ReadArtefact:
    """Three A1 frames at 1:50 in model space, each with a title block (S-101 to S-103) and one
    titled view (a grid of lines): the finders read three sheets and their views."""
    d = Sheets(source_name=name)
    block = frame_block(d)
    for i in range(3):
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


def plain_frames(sha256: str, name: str) -> ReadArtefact:
    """11's three plain frames (no title block): the sheet finder reads no sheet from them."""
    return artefact_for(sha256, name, 3)


def readers(make: Callable[[str, str], ReadArtefact]) -> files.Readers:
    def first(path: Path, name: str) -> ReadArtefact:
        return make(_sha(path), name)

    def pdf(path: Path) -> PdfReport:
        return pdf_report(_sha(path), 1)

    return files.Readers(
        dwg=first,
        second=lambda path, artefact: AGREE,
        fonts=fonts.report,
        bangla_ansi=lambda artefact: BanglaAnsi(()),
        pdf=pdf,
    )


# Through the job and the API ----------------------------------------------------------------------


def read_through_the_api(
    qs: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    make: Callable[[str, str], ReadArtefact] = titled_sheets,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Add a DWG, run its read job inline with the given reader, and GET the file and its report as
    the QS who added it."""
    file_id: uuid.UUID = add(qs.member, qs.project_id, "KR-STR-R0.dwg", drawing("dwg")).file.id
    monkeypatch.setattr(files, "READERS", readers(make))
    run_inline(
        read_file.read_file,
        tenant_id=qs.member.developer_id,
        user_id=qs.member.user.pk,
        abort_reason=lambda: None,
        file_id=file_id,
    )
    base = f"/api/projects/{qs.project_id}/drawings/files/{file_id}"
    got = qs.member.client.get(base)
    assert got.status_code == 200, got.content
    report = qs.member.client.get(base + "/report")
    assert report.status_code == 200, report.content
    return got.json(), report.json()


def limits_said(section: list[dict[str, Any]]) -> list[str]:
    return [str(m["params"]["limit"]) for m in section if m["code"] == NOT_READ_IN_FULL]


# Each limit, made to fire alone by lowering its cap: (module, cap, lowered value, drawing, limit).
# The sheet finder's (13's), the view finder's (17's, said as `views_<limit>`), and 21b's own.
ONE_LIMIT = [
    pytest.param(finder, "MAX_TEXTS", 1, titled_sheets, "texts_capped", id="texts_capped"),
    pytest.param(finder, "MAX_FRAMES", 1, titled_sheets, "frames_capped", id="frames_capped"),
    pytest.param(finder, "MAX_READS", 1, titled_sheets, "read_budget", id="read_budget"),
    pytest.param(finder, "MAX_PAIRS", 1, titled_sheets, "pair_budget", id="pair_budget"),
    pytest.param(
        finder, "MAX_LABELS", 1, titled_sheets, "frame_labels_capped", id="frame_labels_capped"
    ),
    pytest.param(
        finder, "MAX_VALUES", 1, titled_sheets, "frame_values_capped", id="frame_values_capped"
    ),
    pytest.param(finder, "MAX_VISITS", 1, titled_sheets, "walk_visit_limit", id="walk_visit_limit"),
    pytest.param(
        view_finder, "MAX_SCANS", 1, titled_sheets, "views_scan_budget", id="views_scan_budget"
    ),
    pytest.param(
        view_finder, "MAX_READS", 1, titled_sheets, "views_read_budget", id="views_read_budget"
    ),
    pytest.param(sheets, "RENDER_SECONDS", 0.0, titled_sheets, "render_budget", id="render_budget"),
    pytest.param(
        sheets, "RAW_CODES", ("S-",), titled_sheets, "sheet_text_unreadable", id="sheet_text_unreadable"
    ),
    pytest.param(finder, "MAX_FRAMES", 1, plain_frames, "frames_capped", id="frames_capped_no_sheets"),
]


@pytest.mark.parametrize(("module", "cap", "lowered", "make", "limit"), ONE_LIMIT)
def test_a_file_a_limit_cut_says_not_read_in_full_by_that_limit_in_its_finding(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    module: Any,
    cap: str,
    lowered: object,
    make: Callable[[str, str], ReadArtefact],
    limit: str,
) -> None:
    monkeypatch.setattr(module, cap, lowered)

    got, _ = read_through_the_api(qs_project, monkeypatch, make)

    assert got["finding"] == {"code": NOT_READ_IN_FULL, "params": {"limit": limit}}


@pytest.mark.parametrize(("module", "cap", "lowered", "make", "limit"), ONE_LIMIT)
def test_the_report_says_the_limit_that_cut_the_file_in_its_sheets_section(
    qs_project: QsProject,
    monkeypatch: pytest.MonkeyPatch,
    module: Any,
    cap: str,
    lowered: object,
    make: Callable[[str, str], ReadArtefact],
    limit: str,
) -> None:
    monkeypatch.setattr(module, cap, lowered)

    _, report = read_through_the_api(qs_project, monkeypatch, make)

    assert limits_said(report["sheets"]) == [limit]
    assert report["file"]["finding"] == {"code": NOT_READ_IN_FULL, "params": {"limit": limit}}


@pytest.mark.parametrize(
    ("cap", "limit"),
    [("MAX_TEXTS", "texts_capped"), ("MAX_FRAMES", "frames_capped"), ("MAX_VISITS", "walk_visit_limit")],
)
def test_no_sheets_is_never_said_without_the_limit_that_cut_the_file(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, cap: str, limit: str
) -> None:
    """The finding's own case: a limit left the file with no sheet kept, and the report used to say
    a bare "no sheets"."""
    monkeypatch.setattr(finder, cap, 1)

    _, report = read_through_the_api(qs_project, monkeypatch, plain_frames)

    codes = [m["code"] for m in report["sheets"]]
    assert NO_SHEETS in codes  # the drawing holds no sheet the finder kept
    assert limits_said(report["sheets"]) == [limit], codes


def test_a_file_several_limits_cut_names_every_limit_in_its_report_and_one_in_its_finding(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    """One limit in the sheets step, one in a sheet's views and the file's render time: each said
    once, whichever step said it."""
    monkeypatch.setattr(finder, "MAX_PAIRS", 1)
    monkeypatch.setattr(view_finder, "MAX_SCANS", 1)
    monkeypatch.setattr(sheets, "RENDER_SECONDS", 0.0)
    fired = {"pair_budget", "views_scan_budget", "render_budget"}

    got, report = read_through_the_api(qs_project, monkeypatch)

    said = limits_said(report["sheets"])
    assert sorted(said) == sorted(fired)
    assert got["finding"]["code"] == NOT_READ_IN_FULL
    assert set(got["finding"]["params"]) == {"limit"}
    assert got["finding"]["params"]["limit"] in fired


def test_a_file_a_limit_cut_is_still_read(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(finder, "MAX_FRAMES", 1)

    got, report = read_through_the_api(qs_project, monkeypatch, plain_frames)

    assert got["state"] == "read"
    assert got["status"]["code"] == "drawings.files.read"
    assert got["finding"] is not None
    assert report["file"]["state"] == "read"


@pytest.mark.parametrize("make", [titled_sheets, plain_frames], ids=["titled_sheets", "plain_frames"])
def test_a_file_read_in_full_keeps_its_finding_null(
    qs_project: QsProject, monkeypatch: pytest.MonkeyPatch, make: Callable[[str, str], ReadArtefact]
) -> None:
    got, report = read_through_the_api(qs_project, monkeypatch, make)

    assert got["state"] == "read"
    assert got["finding"] is None
    assert report["file"]["finding"] is None
    assert limits_said(report["sheets"]) == []
