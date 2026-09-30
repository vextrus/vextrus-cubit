"""Every row state of 4.5 is on the seed, the job-borne ones among them (#125, #131; m0-screens §7).

§7, "Projects": "**Every row state of 4.5 is on the seed.** KR-01's files show Read, readers agree;
Read, with flags; Held; PDF matched; and Refused scan, and BP-02's stalled DWG (14's) shows Reading a
DWG. The rest go on BP-02 and MG-01: 14 … Waiting; Read; Cancelled; Failed; Read by one reader only …;
Old AutoCAD version; PDF before its DWG; and Held. 21a seeds the states a read job carries, Reading a
PDF with its time left and Interrupted, retrying … 19a seeds Held, answered." "Uploading, Upload
stopped and Stopping are moments, not rows: the seed holds none of them."

#125: "the seed's job-borne m0-screens 4.5 states on BP-02 and MG-01 … what stands is that the
stalled-job retrier would take up a seeded running job as soon as a worker starts. Seed them in a
state the retrier leaves alone (or mark them so)."

Each state is read at the Drawing Set's API (`GET …/drawings/files`) by its message code
(`vextrus/drawings/messages/files.py`, worded in 4.5's table) and the row's `state`.
"""

from collections.abc import Callable
from typing import Any

import pytest

from vextrus.seed.demo import Demo
from vextrus.testing.auth import Api
from vextrus.testing.jobs import retry_stalled_now

from .seeded import *  # noqa: F403 (its fixtures, which pytest finds by name)
from .seeded import every_seeded_file

type Row = dict[str, Any]

W = "drawings.files."
DWG_STEPS = {W + s for s in ("opening_file", "reading_drawing", "second_reader", "finding_sheets",
                             "reading_sheet", "reading_sheet_left", "finishing")}  # fmt: skip
PDF_STEPS = {W + s for s in ("opening_pdf", "reading_page", "reading_page_left", "matching_pages")}
READ_ONCE = {
    "engine.decoders_agree." + s for s in ("not_installed", "not_pinned", "stopped", "too_many")
}
"""The findings of 4.5's "Read by one reader only" (engine.messages.decoders_agree)."""
JOB_BORNE_PROJECTS = {"BP-02", "MG-01"}


def code(row: Row) -> str:
    return str(row["status"]["code"])


def finding(row: Row) -> str | None:
    return row["finding"]["code"] if row["finding"] else None


def reading_a_pdf_with_time_left(row: Row) -> bool:
    return (
        row["project"] in JOB_BORNE_PROJECTS
        and row["format"] == "pdf"
        and row["state"] == "reading"
        and code(row) == W + "reading_page_left"
    )


def interrupted_retrying(row: Row) -> bool:
    if row["project"] not in JOB_BORNE_PROJECTS or row["state"] != "retrying":
        return False
    params = row["status"]["params"]
    # "Reading was interrupted. Trying again by itself (try 2 of 3).": a second try or later.
    return code(row) == W + "retrying" and 2 <= params["attempt"] <= params["tries"]


STATES: dict[str, Callable[[Row], bool]] = {
    "Waiting": lambda r: code(r) == W + "waiting",
    "Reading a DWG": lambda r: r["format"] == "dwg" and r["state"] == "reading" and code(r) in DWG_STEPS,
    "Reading a PDF": lambda r: r["format"] == "pdf" and r["state"] == "reading" and code(r) in PDF_STEPS,
    "Reading a PDF with its time left": reading_a_pdf_with_time_left,
    "Cancelled": lambda r: code(r) == W + "cancelled",
    "Interrupted, retrying": interrupted_retrying,
    "Failed": lambda r: code(r) == W + "failed" and finding(r) not in READ_ONCE,
    "Read by one reader only": lambda r: code(r) == W + "failed" and finding(r) in READ_ONCE,
    "Old AutoCAD version": lambda r: code(r) == W + "old_version",
    "Read, readers agree": lambda r: code(r) == W + "read",
    "Read, with flags": lambda r: code(r) == W + "read_bangla",
    "Held": lambda r: code(r) == W + "held",
    "Held, answered": lambda r: (
        code(r) in {W + "held_read_anyway", W + "await_resaved", W + "sent_to_vextrus"}
    ),
    "PDF matched": lambda r: (
        code(r) in {W + "plot_matched", W + "plot_matched_lines"}
        and r["status"]["params"]["matched"] > 0
    ),
    "PDF before its DWG": lambda r: code(r) == W + "plot_waiting",
    "Refused scan": lambda r: code(r) == W + "refused_scan",
}


@pytest.mark.django_db(databases=["default", "owner"])
@pytest.mark.parametrize("state", list(STATES))
def test_every_row_state_of_4_5_is_on_the_seed(demo: Demo, nusrat: Api, tanvir: Api, state: str) -> None:
    rows = every_seeded_file(demo, nusrat, tanvir)

    shown = [f"{r['project']} {r['name']}: {r['state']} {r['status']}" for r in rows]
    assert any(STATES[state](r) for r in rows), f"no seeded file shows {state!r}; the seed shows {shown}"


@pytest.mark.django_db(databases=["default", "owner"])
def test_the_seed_holds_no_stopping_row(demo: Demo, nusrat: Api, tanvir: Api) -> None:
    rows = every_seeded_file(demo, nusrat, tanvir)

    assert [r["name"] for r in rows if r["state"] == "stopping"] == []


@pytest.mark.django_db(transaction=True, databases=["default", "owner"])
def test_the_stalled_job_retrier_leaves_the_seeded_job_borne_states_alone(
    demo: Demo, nusrat: Api, tanvir: Api, settings: Any
) -> None:
    before = every_seeded_file(demo, nusrat, tanvir)
    reading = [r["id"] for r in before if reading_a_pdf_with_time_left(r)]
    retrying = [r["id"] for r in before if interrupted_retrying(r)]
    assert reading, "no seeded PDF is reading with its time left on BP-02 or MG-01"
    assert retrying, "no seeded file is interrupted and retrying on BP-02 or MG-01"

    # Every worker counts as silent: the retrier takes up any running job it can.
    settings.VEXTRUS_JOB_STALLED_SECONDS = 0
    retry_stalled_now()

    after = {r["id"]: r for r in every_seeded_file(demo, nusrat, tanvir)}
    assert [reading_a_pdf_with_time_left(after[i]) for i in reading] == [True] * len(reading)
    assert [interrupted_retrying(after[i]) for i in retrying] == [True] * len(retrying)
