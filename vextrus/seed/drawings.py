"""The demo seed's `drawings` rows (ticket 14): KR-01's files, reports, sheets, views and renders at
docs/design/m0-screens.md §7's state, BP-02's files in the Drawing Set's row states a file with no read
job can be in, and MG-01's one read DWG. All invented: nothing comes from a real Drawing Set.

Everything goes through `drawings.services`, as a read job would put it, and through real engine code:
each file's ReadArtefact is 11's synthetic `Drawing` (`ReadArtefact.build`, stamped with the file's
sha256), each sheet's render `engine.render.buffers.build` of it, the fonts' and the Bangla-ANSI
Check's reports the engine's own, a PDF's report `engine.read.pdf.rules` over invented page facts.
Titles are decoded by 11's `decode` from the drawing's own text (which holds `%%C`, `%%D`, `%%P`,
MTEXT's `\\P` and a stacked ½, as §7 has it); every view's box lies on its sheet's paper.

**KR-01 after reading** (§7): KR-STR-R0.dwg read, its 13 printed sheets (S-07 rev A and rev B in one
file); KR-STR-R0.pdf, 11 of its 12 pages matched (page 12 shows S-13, in no DWG; neither S-07 has a
page); KR-ARC-R0.dwg read with the Bangla flag, 8 sheets (6 laid out in the drawing, A-06 and A-07 on
layout tabs, one stale tab showing nothing), the schedule unnumbered, A-07 proposed to leave out;
KR-ARC-R0.pdf, 8 of 8 matched, lettering as lines; KR-ELE-R0.dwg read, 3 sheets, no PDF;
KR-STR-old.dwg held, no sheets; site-photos.pdf refused. 24 sheets (Structural 13, Architectural 8,
Electrical 3), 70 views: 23 title blocks, the key plan and the 3D view proposed to leave out, 43
proposed to a Takeoff Step or a Discipline Part, 2 unaccounted (S-10's loose boxes).

**BP-02** holds a row for each state its own columns hold, no read job (21a seeds those with its job):
BP-STR-R0.dwg stalled at "Reading sheet 7 of 12" (for the retrier, once 21a's job exists),
BP-ARC-R0.dwg waiting, BP-ARC-R0.pdf read before its DWG, BP-ELE-R0.dwg cancelled by Nusrat Jahan,
BP-PLB-R0.dwg failed, BP-FIRE-R0.dwg read by one reader only, BP-LIFT-R12.dwg saved by an old
AutoCAD. **MG-01** (Meghna) holds one small DWG, read.

The Market's Disciplines come first: `sync_library` runs here, as the owner (idempotent), so the
owner's `migrate` then `seed_demo` works; if it cannot, the seed refuses and names the command.

For later seeds (19a), `demo` gains `drawing_set:<code>`, `file:<code>:<name>`,
`sheet:<code>:<label>` (a printed sheet's id: `S-07 rev A`, `door and window schedule`) and
`views:<code>:<label>` (its views' ids, in reading order).

Takeoff Step keys on the views follow ADR 0007's fourteen names (`general_notes`, `foundations`,
`columns`, `beams`, `slabs`, `stairs`, `tanks`, `walls`, `rooms`, `roof`, `site_mep`); 19a's Library
keys are the steps' own and win where they differ.
"""

import io
import uuid
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.db import DatabaseError
from django.utils import timezone

from engine.check import bangla_ansi
from engine.check.decoders_agree import CODE as DECODERS_AGREE
from engine.messages import decoders_agree as agree_codes
from engine.messages import read as read_codes
from engine.read.artefact import Format, ReadArtefact
from engine.read.pdf import READER as PDF_READER
from engine.read.pdf import READER_VERSION as PDF_READER_VERSION
from engine.read.pdf import rules as pdf_rules
from engine.read.pdf.facts import DocumentFacts, PageFacts
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    Exclusion,
    ExclusionReason,
    PlotMatch,
    PlotTransform,
    SheetCandidate,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from engine.render import buffers, fonts
from engine.render.fixtures.artefacts import Drawing
from engine.text.decode import decode
from vextrus.drawings import services
from vextrus.drawings.messages import files as file_words
from vextrus.drawings.messages import reports as report_words
from vextrus.drawings.services.reads import ReadStepStore
from vextrus.platform.services import jobs, library, tenancy
from vextrus.seed.demo import Demo

PAPER = (841.0, 594.0)
"""Every sheet an A1, landscape, in millimetres (INSUNITS 4)."""
GAP = 1000.0
"""Sheets laid out in the drawing, side by side this far apart."""
NUSRAT = "Nusrat Jahan"
TANVIR = "Tanvir Ahmed"


class SeedRefused(RuntimeError):
    """The seed cannot write `drawings`' rows as they are (its Library is missing)."""


# What a sheet and its views are ---------------------------------------------------------------------


@dataclass(frozen=True)
class V:
    """A view: its kind, title and box as fractions of its sheet's paper, and its proposal."""

    kind: ViewKind
    title: str | None
    box: tuple[float, float, float, float]
    steps: tuple[str, ...] = ()
    part: str | None = None
    exclusion: ExclusionReason | None = None
    exclusion_text: str | None = None
    scale: str | None = None
    nts: bool = False
    storeys: str | None = None


TITLE_BLOCK = (0.72, 0.02, 0.98, 0.16)


@dataclass(frozen=True)
class S:
    """A printed sheet: its number (none for an unnumbered one), its title as drawn, its revision
    mark and where it came from, its kind, its place (a layout tab, else laid out in the drawing)."""

    label: str
    number: str | None
    title: str
    views: tuple[V, ...]
    mark: str = "R0"
    mark_source: ValueSource = ValueSource.FILE_NAME
    storeys: str | None = None
    kind: str | None = None
    layout: str | None = None
    title_block: bool = True
    exclusion: ExclusionReason | None = None
    bangla: int = 0
    """Texts in a Bangla-ANSI font on it (room names)."""
    codes: bool = False
    """Notes holding a drawing's codes (%%C, %%D, %%P, MTEXT's \\P, a stacked ½)."""


PLAN_BOX = (0.04, 0.2, 0.66, 0.95)


def plan(
    title: str,
    steps: tuple[str, ...],
    box: tuple[float, float, float, float] = PLAN_BOX,
    storeys: str | None = None,
) -> V:
    return V(ViewKind.PLAN, title, box, steps, scale="1:100", storeys=storeys)


STRUCTURAL = (
    S(
        "S-01",
        "S-01",
        "GENERAL NOTES",
        (
            V(ViewKind.NOTES, "GENERAL NOTES", (0.03, 0.4, 0.45, 0.95), ("general_notes",)),
            V(ViewKind.LEGEND, "LEGEND", (0.5, 0.55, 0.68, 0.95), part="structural"),
            V(ViewKind.SCHEDULE, "DRAWING LIST", (0.72, 0.2, 0.97, 0.95), ("general_notes",)),
        ),
        kind="general_notes",
        codes=True,
    ),
    S(
        "S-02",
        "S-02",
        "PILE LAYOUT",
        (
            plan("PILE LAYOUT", ("foundations",)),
            V(ViewKind.DETAIL, "PILE DETAIL", (0.7, 0.5, 0.97, 0.95), ("foundations",), scale="1:20"),
        ),
        kind="pile_layout",
    ),
    S(
        "S-03",
        "S-03",
        "PILE CAP LAYOUT",
        (
            plan("PILE CAP LAYOUT", ("foundations",)),
            V(ViewKind.SCHEDULE, "PILE CAP SCHEDULE", (0.7, 0.5, 0.97, 0.95), ("foundations",)),
        ),
        kind="pile_cap_layout",
    ),
    S(
        "S-04",
        "S-04",
        "GROUND FLOOR BEAM LAYOUT",
        (
            plan("GROUND FLOOR BEAM LAYOUT", ("beams",), storeys="GROUND FLOOR"),
            V(ViewKind.DETAIL, "LIFT PIT DETAIL", (0.3, 0.3, 0.45, 0.5), ("stairs",), scale="1:20"),
            V(
                ViewKind.DETAIL,
                "TIE DETAIL",
                (0.7, 0.5, 0.97, 0.95),
                ("foundations",),
                scale="N.T.S.",
                nts=True,
            ),
        ),
        storeys="GROUND FLOOR",
        kind="beam_layout",
    ),
    S(
        "S-05",
        "S-05",
        "1ST FLOOR BEAM LAYOUT",
        (
            plan("1ST FLOOR BEAM LAYOUT", ("beams",), storeys="1ST FLOOR"),
            V(ViewKind.SECTION, "SECTION 1-1", (0.7, 0.5, 0.97, 0.95), ("beams",), scale="1:50"),
        ),
        storeys="1ST FLOOR",
        kind="beam_layout",
    ),
    S(
        "S-06",
        "S-06",
        "3RD, 5TH & 7TH FLOOR BEAM LAYOUT",
        (plan("3RD, 5TH & 7TH FLOOR BEAM LAYOUT", ("beams",), storeys="3RD, 5TH & 7TH FLOOR"),),
        storeys="3RD, 5TH & 7TH FLOOR",
        kind="beam_layout",
    ),
    S(
        "S-07 rev A",
        "S-07",
        "TYPICAL FLOOR SLAB LAYOUT",
        (plan("TYPICAL FLOOR SLAB LAYOUT", ("slabs",), storeys="TYPICAL FLOOR"),),
        mark="A",
        mark_source=ValueSource.TITLE_BLOCK_TEXT,
        storeys="TYPICAL FLOOR",
        kind="slab_layout",
    ),
    S(
        "S-07 rev B",
        "S-07",
        "TYPICAL FLOOR SLAB LAYOUT",
        (plan("TYPICAL FLOOR SLAB LAYOUT", ("slabs",), storeys="TYPICAL FLOOR"),),
        mark="B",
        mark_source=ValueSource.TITLE_BLOCK_TEXT,
        storeys="TYPICAL FLOOR",
        kind="slab_layout",
    ),
    S(
        "S-08",
        "S-08",
        "COLUMN LAYOUT, PILE CAP TO 2ND FLOOR",
        (plan("COLUMN LAYOUT", ("columns",), storeys="PILE CAP TO 2ND FLOOR"),),
        storeys="PILE CAP TO 2ND FLOOR",
        kind="column_layout",
    ),
    S(
        "S-09",
        "S-09",
        "COLUMN SCHEDULE",
        (
            V(ViewKind.SCHEDULE, "COLUMN SCHEDULE", (0.03, 0.2, 0.66, 0.95), ("columns",)),
            V(ViewKind.NOTES, "NOTES ON COLUMNS", (0.7, 0.5, 0.97, 0.95), ("columns",)),
        ),
        kind="column_schedule",
    ),
    S(
        "S-10",
        "S-10",
        "STAIR DETAILS",
        (
            V(ViewKind.DETAIL, "STAIR PLAN", (0.03, 0.4, 0.33, 0.95), ("stairs",), scale="1:50"),
            V(ViewKind.DETAIL, "STAIR SECTION", (0.36, 0.4, 0.66, 0.95), ("stairs",), scale="1:50"),
            V(ViewKind.NOTES, None, (0.74, 0.17, 0.85, 0.24)),
            V(ViewKind.NOTES, None, (0.86, 0.17, 0.97, 0.24)),
        ),
        kind="stair_details",
    ),
    S(
        "S-11",
        "S-11",
        "ROOF BEAM LAYOUT",
        (
            plan("ROOF BEAM LAYOUT", ("beams",), storeys="ROOF"),
            V(ViewKind.SECTION, "SECTION 2-2", (0.7, 0.5, 0.97, 0.95), ("beams",), scale="1:50"),
        ),
        storeys="ROOF",
        kind="beam_layout",
    ),
    S(
        "S-12",
        "S-12",
        "OVERHEAD TANK AND LIFT MACHINE ROOM",
        (
            plan("OVERHEAD TANK PLAN", ("tanks",), box=(0.04, 0.5, 0.34, 0.95)),
            plan("LIFT MACHINE ROOM PLAN", ("stairs",), box=(0.36, 0.5, 0.66, 0.95)),
            V(
                ViewKind.SECTION,
                "SECTION THROUGH TANK",
                (0.04, 0.2, 0.66, 0.46),
                ("tanks",),
                scale="1:50",
            ),
        ),
        kind="tank_details",
    ),
)

ARCHITECTURAL = (
    S(
        "A-01",
        "A-01",
        "SITE PLAN",
        (
            plan("SITE PLAN", ("site_mep",)),
            V(
                ViewKind.KEY_PLAN,
                "KEY PLAN",
                (0.7, 0.6, 0.97, 0.95),
                exclusion=ExclusionReason.FOR_INFORMATION,
            ),
        ),
        kind="site_plan",
    ),
    S(
        "A-02",
        "A-02",
        "GROUND FLOOR PLAN",
        (
            plan("GROUND FLOOR PLAN", ("walls", "rooms"), storeys="GROUND FLOOR"),
            V(ViewKind.SECTION, "WALL SECTION", (0.7, 0.5, 0.97, 0.95), ("walls",), scale="1:20"),
        ),
        storeys="GROUND FLOOR",
        kind="floor_plan",
        bangla=5,
    ),
    S(
        "A-03",
        "A-03",
        "TYPICAL FLOOR PLAN",
        (
            plan("TYPICAL FLOOR PLAN", ("walls", "rooms"), storeys="TYPICAL FLOOR"),
            V(ViewKind.DETAIL, "TOILET DETAIL", (0.7, 0.5, 0.97, 0.95), ("rooms",), scale="1:20"),
        ),
        storeys="TYPICAL FLOOR",
        kind="floor_plan",
        bangla=4,
    ),
    S(
        "A-04",
        "A-04",
        "ROOF PLAN",
        (
            plan("ROOF PLAN", ("roof",), storeys="ROOF"),
            V(ViewKind.DETAIL, "PARAPET DETAIL", (0.7, 0.5, 0.97, 0.95), ("walls",), scale="1:10"),
        ),
        storeys="ROOF",
        kind="roof_plan",
    ),
    S(
        "A-05",
        "A-05",
        "SECTION A-A & ELEVATION",
        (
            V(ViewKind.SECTION, "SECTION A-A", (0.03, 0.2, 0.33, 0.95), ("walls",), scale="1:100"),
            V(ViewKind.ELEVATION, "FRONT ELEVATION", (0.36, 0.2, 0.66, 0.95), ("walls",), scale="1:100"),
        ),
    ),
    S(
        "door and window schedule",
        None,
        "DOOR AND WINDOW SCHEDULE",
        (V(ViewKind.SCHEDULE, "DOOR AND WINDOW SCHEDULE", (0.03, 0.2, 0.66, 0.95), ("walls",)),),
        mark_source=ValueSource.FILE_NAME,
        kind="schedule",
    ),
    S(
        "A-06",
        "A-06",
        "SIDE ELEVATIONS",
        (
            V(
                ViewKind.ELEVATION,
                "LEFT SIDE ELEVATION",
                (0.03, 0.2, 0.33, 0.95),
                ("walls",),
                scale="1:100",
            ),
            V(
                ViewKind.ELEVATION,
                "RIGHT SIDE ELEVATION",
                (0.36, 0.2, 0.66, 0.95),
                ("walls",),
                scale="1:100",
            ),
        ),
        layout="A-06",
        kind="elevation",
    ),
    S(
        "A-07",
        "A-07",
        "3D VIEW",
        (
            V(
                ViewKind.PERSPECTIVE,
                "3D VIEW",
                (0.05, 0.05, 0.95, 0.95),
                exclusion=ExclusionReason.FOR_INFORMATION,
            ),
        ),
        layout="A-07",
        title_block=False,
        exclusion=ExclusionReason.FOR_INFORMATION,
        kind="perspective",
    ),
)

ELECTRICAL = (
    S(
        "E-01",
        "E-01",
        "ELECTRICAL LEGEND AND NOTES",
        (
            V(ViewKind.LEGEND, "ELECTRICAL LEGEND", (0.03, 0.2, 0.45, 0.95), part="electrical"),
            V(ViewKind.NOTES, "ELECTRICAL NOTES", (0.5, 0.2, 0.68, 0.95), part="electrical"),
        ),
        kind="legend",
    ),
    S(
        "E-02",
        "E-02",
        "TYPICAL FLOOR LIGHTING AND POWER LAYOUT",
        (
            V(
                ViewKind.PLAN,
                "TYPICAL FLOOR LIGHTING LAYOUT",
                (0.03, 0.2, 0.66, 0.95),
                part="electrical",
                scale="1:100",
            ),
            V(
                ViewKind.DETAIL,
                "RISER DETAIL",
                (0.7, 0.5, 0.97, 0.95),
                part="electrical",
                scale="N.T.S.",
                nts=True,
            ),
        ),
        storeys="TYPICAL FLOOR",
        kind="lighting_power_layout",
    ),
    S(
        "E-03",
        "E-03",
        "TYPICAL FLOOR LIGHTING AND POWER LAYOUT",
        (
            V(
                ViewKind.PLAN,
                "TYPICAL FLOOR POWER LAYOUT",
                (0.03, 0.2, 0.66, 0.95),
                part="electrical",
                scale="1:100",
            ),
            V(
                ViewKind.SECTION,
                "BOARD SECTION",
                (0.7, 0.5, 0.97, 0.95),
                part="electrical",
                scale="1:20",
            ),
        ),
        storeys="TYPICAL FLOOR",
        kind="lighting_power_layout",
    ),
)

EMPTY_TAB = "Layout1"
"""A stale layout tab showing nothing: never a sheet (m0-screens 4.5; the plan's review Q7)."""

NOTES_WITH_CODES = (
    ("MTEXT", "{\\fArial|b1;REINFORCEMENT}\\PMAIN BARS %%C16 @ 150 C/C, \\S1/2; DIA HOOK"),
    ("TEXT", "CLEAR COVER 40 MM %%P5 MM"),
    ("TEXT", "BEND AT 45%%D"),
)


# The seed -----------------------------------------------------------------------------------------


def run(demo: Demo) -> None:
    library_ready()
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:nusrat"]):
        if not services.disciplines():
            raise SeedRefused(
                "The Market has no Disciplines in its Library, so no file can take one. Run"
                " `uv run manage.py sync_library` as the owner, then `uv run manage.py seed_demo`."
            )
        kadam(demo)
        bokul(demo)
    with tenancy.acting_in(demo["developer:meghna"], user_id=demo["user:tanvir"]):
        meghna(demo)


def library_ready() -> None:
    """Write the Markets' Disciplines as the owner (`sync_library`, idempotent), or refuse."""
    try:
        library.sync()
    except DatabaseError as error:
        raise SeedRefused(
            "The seed could not write the Markets' Disciplines as the owner. Run"
            " `uv run manage.py sync_library` as the owner, then `uv run manage.py seed_demo`."
        ) from error


def kadam(demo: Demo) -> None:
    code = "KR-01"
    project_id = demo[f"project:{code}"]
    structural = dwg(
        demo,
        code,
        project_id,
        "KR-STR-R0.dwg",
        STRUCTURAL,
        fonts_used=("arial.ttf", "romans.shx", "swissc.ttf"),
    )
    architectural = dwg(
        demo, code, project_id, "KR-ARC-R0.dwg", ARCHITECTURAL, fonts_used=("arial.ttf",), empty_tab=True
    )
    electrical = dwg(demo, code, project_id, "KR-ELE-R0.dwg", ELECTRICAL, fonts_used=("arial.ttf",))
    for sheet in electrical.values():
        services.record_plot(sheet.id, services.PlotNone.NO_PDF)
    structural_pdf, facts = pdf(
        demo, code, project_id, "KR-STR-R0.pdf", pages=12, turned=(3, 8), maker="autocad"
    )
    plot(structural_pdf, facts, structural, skip=("S-07 rev A", "S-07 rev B"))
    services.record_page_reasons(
        structural_pdf.id, [report_words.PAGE_SHEET_NOT_IN_DWG(page=12, sheet="S-13")]
    )
    architectural_pdf, facts = pdf(
        demo, code, project_id, "KR-ARC-R0.pdf", pages=8, maker="other", lines=True
    )
    plot(architectural_pdf, facts, architectural)
    held = added(demo, code, project_id, "KR-STR-old.dwg", invented("dwg", "KR-STR-old"))
    disagree = agree_codes.DISAGREE(
        items=212, only_first=187, only_second=25, kinds=2, layers=3, unread=0
    )
    services.record_reports(
        held.id, cross_check=CheckResult(DECODERS_AGREE, CheckOutcome.FIRED, finding=disagree)
    )
    services.quarantine(held.id, disagree)
    scan = added(demo, code, project_id, "site-photos.pdf", invented("pdf", "site-photos"))
    services.record_reports(scan.id, upload_report=pdf_rules.report(scan_facts(3), scan.sha256))


def bokul(demo: Demo) -> None:
    code = "BP-02"
    project_id = demo[f"project:{code}"]
    stalled = added(demo, code, project_id, "BP-STR-R0.dwg", invented("dwg", "BP-STR-R0"))
    stall(stalled, sheets=12, at=7)
    waiting = added(demo, code, project_id, "BP-ARC-R0.dwg", invented("dwg", "BP-ARC-R0"))
    assert waiting.state == services.FileState.WAITING
    early, _facts = pdf(demo, code, project_id, "BP-ARC-R0.pdf", pages=6, maker="autocad")
    assert early.status == file_words.PLOT_WAITING()
    cancelled = added(demo, code, project_id, "BP-ELE-R0.dwg", invented("dwg", "BP-ELE-R0"))
    services.cancel(cancelled.id, actor_name=NUSRAT)
    failed = added(demo, code, project_id, "BP-PLB-R0.dwg", invented("dwg", "BP-PLB-R0"))
    services.mark_failed(failed.id, read_codes.OBJECTS_MISSING(count=3), tries=3)
    once = added(demo, code, project_id, "BP-FIRE-R0.dwg", invented("dwg", "BP-FIRE-R0"))
    services.mark_failed(once.id, agree_codes.NOT_INSTALLED())
    old = added(
        demo, code, project_id, "BP-LIFT-R12.dwg", invented("dwg", "BP-LIFT-R12", head=b"AC1009")
    )
    services.mark_failed(old.id, file_words.OLD_VERSION())


def meghna(demo: Demo) -> None:
    code = "MG-01"
    project_id = demo[f"project:{code}"]
    foundation = plan("FOUNDATION LAYOUT", ("foundations",))
    beams = plan("GROUND FLOOR BEAM LAYOUT", ("beams",))
    small = (
        S("S-01", "S-01", "FOUNDATION LAYOUT", (foundation,), kind="pile_layout"),
        S("S-02", "S-02", "GROUND FLOOR BEAM LAYOUT", (beams,), kind="beam_layout"),
    )
    printed = dwg(
        demo, code, project_id, "MG-STR-R0.dwg", small, fonts_used=("arial.ttf",), actor=TANVIR
    )
    for sheet in printed.values():
        services.record_plot(sheet.id, services.PlotNone.NO_PDF)


# Files ----------------------------------------------------------------------------------------------


def invented(kind: str, marker: str, head: bytes | None = None) -> bytes:
    """A file's invented bytes, opening as a DWG or a PDF by its first bytes (no reader reads them:
    from 21c the seed's files are the committed fixture generators', read by the real job)."""
    if kind == "pdf":
        return pdf_bytes(marker, pages=1)
    return (head or b"AC1032") + b"\x00" * 122 + f"vextrus demo drawing {marker}\n".encode()


def pdf_bytes(marker: str, pages: int) -> bytes:
    """A small, well-formed PDF of blank A1 pages (invented)."""
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>"]
    kids = " ".join(f"{3 + n} 0 R" for n in range(pages))
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {pages} >>".encode())
    for _ in range(pages):
        objects.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 2384 1684] >>")
    out = io.BytesIO()
    out.write(b"%PDF-1.7\n% vextrus demo " + marker.encode() + b"\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(out.tell())
        out.write(f"{number} 0 obj\n".encode() + body + b"\nendobj\n")
    start = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets:
        out.write(f"{offset:010d} 00000 n \n".encode())
    out.write(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n".encode()
    )
    return out.getvalue()


def added(
    demo: Demo, code: str, project_id: uuid.UUID, name: str, content: bytes, actor: str = NUSRAT
) -> services.FileView:
    result = services.add_file(project_id, name=name, content=io.BytesIO(content), actor_name=actor)
    demo[f"drawing_set:{code}"] = result.file.set_id
    demo[f"file:{code}:{name}"] = result.file.id
    return result.file


# A DWG read ------------------------------------------------------------------------------------------


@dataclass
class _Built:
    artefact: ReadArtefact
    places: dict[str, SheetLocation]
    boxes: dict[str, tuple[float, float, float, float]]
    """Each sheet's paper, in its own space's units (drawing units, or the layout's)."""
    bangla: dict[str, list[str]] = field(default_factory=dict)
    """Each sheet's Bangla-ANSI texts, by handle."""


def dwg(
    demo: Demo,
    code: str,
    project_id: uuid.UUID,
    name: str,
    sheets: Sequence[S],
    *,
    fonts_used: tuple[str, ...],
    empty_tab: bool = False,
    actor: str = NUSRAT,
) -> dict[str, services.SheetView]:
    """A DWG taken through the services as a read job would take it, to "read"."""
    found = added(demo, code, project_id, name, invented("dwg", name.removesuffix(".dwg")), actor)
    built = draw(found.sha256, name, sheets, fonts_used)
    services.store_artefact(found.id, built.artefact)
    flagged = bangla_ansi.run(built.artefact)
    services.record_reports(
        found.id,
        cross_check=CheckResult(DECODERS_AGREE, CheckOutcome.PASSED),
        font_report=fonts.report(built.artefact),
        bangla_ansi=flagged,
    )
    candidates = [candidate(sheet, built, found) for sheet in sheets]
    printed = services.record_sheets(found.id, candidates, empty_layouts=1 if empty_tab else 0)
    by_label = {}
    for sheet, view in zip(sheets, printed, strict=True):
        by_label[sheet.label] = view
        demo[f"sheet:{code}:{sheet.label}"] = view.id
        if sheet.kind is not None:
            services.record_kind(view.id, sheet.kind)
        recorded = services.record_views(view.id, views_of(sheet, built.boxes[sheet.label]))
        demo[f"views:{code}:{sheet.label}"] = [v.id for v in recorded]
        services.record_render(
            view.id, buffers.build(built.artefact, SheetCandidate(built.places[sheet.label]))
        )
    handle_sheet = {handle: label for label, handles in built.bangla.items() for handle in handles}
    number_of = {sheet.label: sheet.number or sheet.title for sheet in sheets}
    lines = flagged.findings(lambda handle: number_of.get(handle_sheet.get(handle, "")))
    services.record_bangla_lines(found.id, lines)
    services.mark_read(found.id)
    return {label: services.sheet(view.id) for label, view in by_label.items()}


def draw(sha256: str, name: str, sheets: Sequence[S], fonts_used: tuple[str, ...]) -> _Built:
    """The file's drawing: each sheet's frame, title block, title, views' outlines and texts."""
    d = Drawing(insunits=4)
    places: dict[str, SheetLocation] = {}
    boxes: dict[str, tuple[float, float, float, float]] = {}
    bangla: dict[str, list[str]] = {}
    layouts: list[str] = [EMPTY_TAB]
    title_font, note_font, dim_font = (fonts_used * 3)[:3]
    drawn = 0
    for sheet in sheets:
        if sheet.layout is not None:
            owner = d.block(f"*Paper_Space{len(layouts)}")
            d.records[owner].layout = sheet.layout
            layouts.append(sheet.layout)
            x0, y0 = 0.0, 0.0
            places[sheet.label] = SheetLocation(layout=sheet.layout)
        else:
            owner = "1F"
            x0, y0 = drawn * GAP, 0.0
            drawn += 1
            places[sheet.label] = SheetLocation(box=Box(x0, y0, x0 + PAPER[0], y0 + PAPER[1]))
        width, height = PAPER
        boxes[sheet.label] = (x0, y0, x0 + width, y0 + height)

        def at(fx: float, fy: float) -> tuple[float, float]:
            return (x0 + fx * width, y0 + fy * height)  # noqa: B023 - the sheet's own origin

        frame = [[*at(0, 0), 0, 0, 0], [*at(1, 0), 0, 0, 0], [*at(1, 1), 0, 0, 0], [*at(0, 1), 0, 0, 0]]
        d.entity(
            "LWPOLYLINE", {"points": frame, "flags": 1, "lineweight": 50}, layer="FRAME", owner=owner
        )
        for view in sheet.views:
            corners = [at(view.box[0], view.box[1]), at(view.box[2], view.box[1]),
                       at(view.box[2], view.box[3]), at(view.box[0], view.box[3])]  # fmt: skip
            d.entity("LWPOLYLINE", {"points": [[*c, 0, 0, 0] for c in corners], "flags": 1,
                                    "lineweight": 25}, layer="VIEW", owner=owner)  # fmt: skip
            if view.title:
                d.text(view.title, (*at(view.box[0], view.box[1] - 0.02), 0.0), height=5.0,
                       font=title_font, owner=owner, layer="TITLES")  # fmt: skip
        if sheet.title_block:
            tb = TITLE_BLOCK
            d.line(at(tb[0], tb[1]), at(tb[2], tb[1]), owner=owner, layer="TITLE")
            d.line(at(tb[0], tb[3]), at(tb[2], tb[3]), owner=owner, layer="TITLE")
            d.text(sheet.title, (*at(0.73, 0.1), 0.0), height=6.0, font=title_font, owner=owner)
            if sheet.number:
                d.text(sheet.number, (*at(0.73, 0.04), 0.0), height=8.0, font=title_font, owner=owner)
        if sheet.codes:
            for n, (kind, raw) in enumerate(NOTES_WITH_CODES):
                d.text(raw, (*at(0.05, 0.35 - 0.04 * n), 0.0), kind=kind, height=3.5,
                       font=note_font, owner=owner)  # fmt: skip
        d.text("1:100", (*at(0.05, 0.03), 0.0), height=3.0, font=dim_font, owner=owner)
        for n in range(sheet.bangla):
            handle = d.text(f"†kvevi Ni {n + 1}", (*at(0.1 + 0.1 * n, 0.6), 0.0), height=3.0,
                            font="sutonnymj.ttf", owner=owner, layer="ROOM")  # fmt: skip
            bangla.setdefault(sheet.label, []).append(handle)
    made = d.artefact()
    s = made.summary
    artefact = ReadArtefact.build(
        source_sha256=sha256,
        source_name=name,
        format=Format("dwg", "AC1032"),
        reader=s.reader,
        reader_version=s.reader_version,
        layouts=["Model", *layouts],
        insunits=s.insunits,
        notes=s.notes,
        blocks=made.blocks.values(),
        entities=made.entities.values(),
    )
    return _Built(artefact, places, boxes, bangla)


def candidate(sheet: S, built: _Built, found: services.FileView) -> SheetCandidate:
    def read(value: str | None, source: ValueSource = ValueSource.TITLE_BLOCK_TEXT) -> Sourced | None:
        return None if value is None else Sourced(decode(value), source)

    return SheetCandidate(
        location=built.places[sheet.label],
        number=read(sheet.number),
        title=read(sheet.title),
        revision_mark=read(sheet.mark, sheet.mark_source),
        issue_date=read("12.09.2026"),
        storeys_as_stated=read(sheet.storeys),
        exclusion=Exclusion(sheet.exclusion) if sheet.exclusion else None,
        group=found.group,
    )


def views_of(sheet: S, paper: tuple[float, float, float, float]) -> list[ViewCandidate]:
    x0, y0, x1, y1 = paper
    width, height = x1 - x0, y1 - y0
    shown = []
    for view in sheet.views:
        fx0, fy0, fx1, fy1 = view.box
        shown.append(
            _view(view, Box(x0 + fx0 * width, y0 + fy0 * height, x0 + fx1 * width, y0 + fy1 * height))
        )
    if sheet.title_block:
        fx0, fy0, fx1, fy1 = TITLE_BLOCK
        box = Box(x0 + fx0 * width, y0 + fy0 * height, x0 + fx1 * width, y0 + fy1 * height)
        shown.append(ViewCandidate(box=box, kind=ViewKind.TITLE_BLOCK, title=None,
                                   exclusion=Exclusion(ExclusionReason.FOR_INFORMATION)))  # fmt: skip
    return shown


def _view(view: V, box: Box) -> ViewCandidate:
    return ViewCandidate(
        box=box,
        kind=view.kind,
        title=decode(view.title) if view.title else None,
        not_to_scale=view.nts,
        stated_scale=view.scale,
        storeys_as_stated=view.storeys,
        steps=view.steps,
        part=view.part,
        exclusion=Exclusion(view.exclusion, view.exclusion_text) if view.exclusion else None,
    )


# A PDF read, and its pages matched ------------------------------------------------------------------


def page_facts(number: int, *, turned: bool, maker: str, lines: bool, picture: bool) -> PageFacts:
    width, height = (1684.0, 2384.0) if turned else (2384.0, 1684.0)
    return PageFacts(
        number=number,
        readable=True,
        rotate=90 if turned else 0,
        width=width,
        height=height,
        crop=(0.0, 0.0, width, height),
        objects=400,
        strokes=380,
        fills=12,
        chars=0 if lines else 820,
        hidden_chars=0,
        unmapped_chars=0,
        images=1 if picture else 0,
        picture_share=0.02 if picture else 0.0,
        fonts=() if lines else (("Arial", "truetype", True),),
        layers=() if (lines or maker != "autocad") else ("FRAME", "VIEW", "TITLES"),
        shx_comments=0 if lines else 24,
        items=(),
    )


def pdf(
    demo: Demo,
    code: str,
    project_id: uuid.UUID,
    name: str,
    *,
    pages: int,
    maker: str,
    turned: tuple[int, ...] = (),
    lines: bool = False,
) -> tuple[services.FileView, DocumentFacts]:
    """A PDF read: its report from invented page facts by 12's own rules, then read."""
    found = added(demo, code, project_id, name, pdf_bytes(name, pages))
    facts = DocumentFacts(
        producer="DWG To PDF.hdi 25.0.0 (AutoCAD 2025)" if maker == "autocad" else "PDF Merge Tool 3.1",
        creator="AutoCAD 2025" if maker == "autocad" else None,
        extras={},
        pages=tuple(
            page_facts(n, turned=n in turned, maker=maker, lines=lines, picture=n == 1)
            for n in range(1, pages + 1)
        ),
    )
    services.record_reports(found.id, upload_report=pdf_rules.report(facts, found.sha256))
    return services.mark_read(found.id), facts


def plot(
    pdf_file: services.FileView,
    facts: DocumentFacts,
    sheets: dict[str, services.SheetView],
    skip: Sequence[str] = (),
) -> None:
    """Each sheet's page, in order, matched as 18's registration would (a pure 1:1 fit); the sheets
    skipped have no page in this PDF."""
    pages = pdf_rules.pages(facts, pdf_file.sha256, PDF_READER, PDF_READER_VERSION)
    matched = [label for label in sheets if label not in skip]
    for page, label in zip(pages, matched, strict=False):
        sheet = sheets[label]
        turned = page.rotate != 0
        transform = PlotTransform(2384.0 / PAPER[0], 90 if turned else 0, (0.0, 0.0))
        services.record_plot(
            sheet.id, PlotMatch(page, _as_candidate(sheet), transform, 0.18), render_f1=0.96
        )
    for label in skip:
        services.record_plot(sheets[label].id, services.PlotNone.NO_PAGE, pdf_file_id=pdf_file.id)


def _as_candidate(sheet: services.SheetView) -> SheetCandidate:
    location = sheet.location
    place = (
        SheetLocation(layout=location["layout"])
        if "layout" in location
        else SheetLocation(box=Box(*(float(v) for v in location["box"])))
    )
    number = Sourced(sheet.number, ValueSource.TITLE_BLOCK_TEXT) if sheet.number else None
    return SheetCandidate(location=place, number=number)


def scan_facts(pages: int) -> DocumentFacts:
    """Pages that are only pictures: a scan, which the report refuses (ADR 0014)."""
    scanned = tuple(
        PageFacts(
            number=n, readable=True, rotate=0, width=842.0, height=595.0, crop=(0.0, 0.0, 842.0, 595.0),
            objects=1, strokes=0, fills=0, chars=0, hidden_chars=0, unmapped_chars=0, images=1,
            picture_share=0.98, fonts=(), layers=(), shx_comments=0, items=(),
        )
        for n in range(1, pages + 1)
    )  # fmt: skip
    return DocumentFacts(producer="Scanner 2.0", creator=None, extras={}, pages=scanned)


# BP-02's stalled read ------------------------------------------------------------------------------


def stall(found: services.FileView, *, sheets: int, at: int) -> None:
    """A DWG whose read stopped at sheet `at` of `sheets` an hour ago, as its steps left it (its read
    job is 21a's): its artefact and sheets kept, its steps up to the sheet before recorded."""
    labels = [
        S(f"S-{n:02d}", f"S-{n:02d}", f"SHEET {n}", (plan(f"SHEET {n}", ("beams",)),))
        for n in range(1, sheets + 1)
    ]
    built = draw(found.sha256, found.name, labels, ("arial.ttf",))
    started = timezone.now() - timedelta(hours=1)

    def when(step: int) -> datetime:
        return started + timedelta(minutes=2 * step)

    store = ReadStepStore()
    names = [services.OPENING, services.READING, services.SECOND_READER, services.SHEETS]
    names += [services.sheet_step(n) for n in range(1, at)]
    for step, name in enumerate(names):
        ReadStepStore(clock=lambda step=step: when(step)).progress(
            found.id, jobs.Progress(step, len(names) + sheets, name)
        )
        if name == services.SHEETS:
            services.store_artefact(found.id, built.artefact)
            services.record_sheets(found.id, [candidate(sheet, built, found) for sheet in labels])
        store.record(jobs.StepKey(found.id, name, _hash(name)), {"step": name})
    ReadStepStore(clock=lambda: when(len(names))).progress(
        found.id, jobs.Progress(len(names), len(names) + sheets, services.sheet_step(at))
    )


def _hash(name: str) -> str:
    return jobs.input_hash({"file_step": name})
