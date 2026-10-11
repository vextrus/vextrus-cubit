"""T-W318's invented sets: DWG files taken to "read" through the drawings services as the read job
takes them (artefact, reports, sheets, views), each Sheet with the storey words its title states and
its Views with the storeys their titles gave, then proposed. No real drawing text: every number, title
and storey word is invented.

A `ViewCandidate` given a `storeys_source` is built from keyword arguments (`view`), so this module
type-checks before T-W318 adds the field; until then such a View fails with a TypeError.
"""

import uuid
from dataclasses import dataclass, field, replace
from typing import Any

from engine.check.bangla_ansi import BanglaAnsi
from engine.recognise.types import (
    Box,
    CheckOutcome,
    CheckResult,
    SheetCandidate,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from engine.render import buffers
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1 as step1_services
from vextrus.takeoff.services.read_propose import proposals as read_propose
from vextrus.testing.drawings import add, artefact_for, drawing, frame, sheet_candidate
from vextrus.testing.tenancy import Member

CODE = "engine.storey_titles.differs"
CHECK = "storey_titles"
OPTIONS = ["plans_right", "title_right", "keep_open"]


@dataclass(frozen=True)
class Plan:
    """A View of a Sheet: a plan unless told, its storeys as its title gave them (none: it states
    none), `source` the storeys' source key (`"sheet_title"`), else None."""

    storeys: tuple[str, ...] = ()
    kind: ViewKind = ViewKind.PLAN
    meaning: StoreysMeaning = StoreysMeaning.AT_FLOOR_LEVEL
    subject: str | None = None
    title: str | None = None
    source: str | None = None


@dataclass(frozen=True)
class Sheet:
    number: str | None
    stated: str | None
    views: tuple[Plan, ...] = ()
    title: str = ""
    discipline: str | None = "structural"
    extra: dict[str, Any] = field(default_factory=dict)


def view(i: int, plan: Plan, ordinal: int) -> ViewCandidate:
    """The `ordinal`-th View of frame `i`: a box of its own inside the frame."""
    box = frame(i)
    x0 = box.x0 + 10 + 40 * ordinal
    given: dict[str, Any] = {
        "box": Box(x0, 40.0, x0 + 35, 140.0),
        "kind": plan.kind,
        "title": plan.title,
        "subject": plan.subject,
    }
    if plan.storeys:
        given |= {"storeys": plan.storeys, "storeys_meaning": plan.meaning}
        if plan.source is None:
            given["storeys_as_stated"] = plan.title
    if plan.source is not None:
        given["storeys_source"] = plan.source
    return ViewCandidate(**given)


def record(member: Member, project_id: uuid.UUID, name: str, listed: list[Sheet]) -> list[uuid.UUID]:
    """Take one invented DWG to read with these Sheets and Views; the printed sheets' ids in order."""
    with member.acting():
        found = drawings.file(add(member, project_id, name, drawing()).file.id)
        artefact = artefact_for(found.sha256, found.name, len(listed))
        drawings.store_artefact(found.id, artefact)
        drawings.record_reports(
            found.id,
            cross_check=CheckResult(code="decoders_agree", outcome=CheckOutcome.PASSED),
            bangla_ansi=BanglaAnsi(()),
        )
        candidates = []
        for i, sheet in enumerate(listed):
            made = sheet_candidate(i, found.group, number=sheet.number, title=sheet.title or None)
            stated = (
                None if sheet.stated is None else Sourced(sheet.stated, ValueSource.TITLE_BLOCK_TEXT)
            )
            discipline = (
                None if sheet.discipline is None else Sourced(sheet.discipline, ValueSource.FILE)
            )
            candidates.append(replace(made, storeys_as_stated=stated, discipline=discipline))
        printed = drawings.record_sheets(found.id, candidates)
        for i, (sheet, kept) in enumerate(zip(listed, printed, strict=True)):
            box = frame(i)
            block = ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK)
            drawn = [view(i, plan, n) for n, plan in enumerate(sheet.views)]
            drawings.record_views(kept.id, [*drawn, block])
            built = buffers.build(artefact, SheetCandidate(SheetLocation(box=box)))
            drawings.record_render(kept.id, built)
        drawings.mark_read(found.id)
        for kept in printed:
            step1_services.propose_sheet(kept.id)
        return [s.id for s in printed]


def redraw(member: Member, sheet_id: uuid.UUID, place: int, plans: list[Plan]) -> None:
    """The Views of the Sheet at `place` in its file read again with these plans (a new reading of
    it, as when the QS's correction is read)."""
    with member.acting():
        box = frame(place)
        block = ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK)
        drawings.record_views(sheet_id, [*(view(place, p, n) for n, p in enumerate(plans)), block])


def ask(member: Member, project_id: uuid.UUID) -> None:
    """The set's Questions, as the read job asks them after proposing."""
    with member.acting():
        read_propose.set_questions(project_id)
