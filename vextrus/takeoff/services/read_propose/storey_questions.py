"""19b's storey-titles Check over a read set, asked as Step 1's Questions (S15-E3, T-W318): each sheet
whose title names storeys its plans do not agree with is held by one `check` Question per Discipline,
retired when none is found again (the owner's ruling of 5 Oct 2026: one Question per Discipline, not
one per sheet); the Check's run recorded with its findings. Called by `proposals.set_questions`,
which reads the set once for every Check it runs.

    storey_questions.ask(project_id, listed, sheets, views, proposal_of, recognisers, conventions,
                         options=..., same_titles=...) -> int    (how many Questions were asked)

A stale copy (S21-C2) is asked by its `same_title` conflict alone: a sheet whose title's storeys are
exactly the plans' storeys of a sheet sharing its title (an open `same_title` conflict holding both),
not its own plans', is a title block copied onto the next sheet; the conflict's answer settles it, so
its finding is recorded under that conflict's Question and no storey-titles Question holds it.
"""

import json
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from engine.check import storey_titles
from engine.messages import Message
from engine.messages import storey_titles as storey_codes
from engine.recognise import conflicts as finder
from engine.recognise.types import (
    CheckOutcome,
    SetReading,
    SheetCandidate,
    SheetConventions,
    ViewCandidate,
    ViewKind,
)
from vextrus.drawings import services as drawings
from vextrus.takeoff.services import step1

PLANS = "plans"
"""The recorded storey-titles finding's evidence beyond its words: the storey keys of each of its
sheet's plans ("floor_2 floor_6; roof"), so an answer decides that disagreement only, never a later
one of the same counts (S15-E3's refuter: plans redrawn from the 6th to the 7th floor are asked again).
It is never worded: Step 1's Question takes the finding's own params."""


@dataclass(frozen=True)
class SameTitle:
    """A `same_title` conflict asked this round: its Question (folded into only while open) and every
    sheet 19b found sharing its title, decided ones too."""

    question_id: uuid.UUID
    sheets: Sequence[uuid.UUID]


def _drawn(views: Sequence[ViewCandidate]) -> frozenset[str]:
    """The storey keys a sheet's plans name."""
    return frozenset(s for v in views if v.kind == ViewKind.PLAN for s in v.storeys)


def _stale_copies(
    fired: Sequence[tuple[int, drawings.SheetView]],
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    listed: Sequence[drawings.SheetView],
    recognisers: finder.Recognisers,
    same_titles: Sequence[SameTitle],
) -> dict[uuid.UUID, uuid.UUID]:
    """The disagreeing sheets that are stale copies, by sheet id: the `same_title` conflict's Question
    each is asked by. A sheet's title storeys (13's keys, as the Check reads them) are its partner's
    plans' storeys exactly, and not its own plans'; the partner shares the conflict with it."""
    index = {s.id: i for i, s in enumerate(listed)}
    of: dict[uuid.UUID, list[SameTitle]] = {}
    for conflict in same_titles:
        for sheet_id in conflict.sheets:
            of.setdefault(sheet_id, []).append(conflict)
    copies: dict[uuid.UUID, uuid.UUID] = {}
    for at, sheet in fired:
        stated = sheets[at].storeys_as_stated
        if sheet.id not in of or stated is None:
            continue
        title = frozenset(recognisers.storeys(stated.value))
        if not title or title == _drawn(views[at]):
            continue
        partnered = next(
            (
                conflict.question_id
                for conflict in of[sheet.id]
                for other in conflict.sheets
                if other != sheet.id and other in index and _drawn(views[index[other]]) == title
            ),
            None,
        )
        if partnered is not None:
            copies[sheet.id] = partnered
    return copies


def _with_plans(finding: Message, views: Sequence[ViewCandidate]) -> Message:
    """The finding as recorded: its params and `PLANS`, its sheet's plans' storey keys in order."""
    plans = sorted(" ".join(v.storeys) for v in views if v.kind == ViewKind.PLAN)
    return Message(code=finding["code"], params={**finding["params"], PLANS: "; ".join(plans)})


def ask(
    project_id: uuid.UUID,
    listed: Sequence[drawings.SheetView],
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    proposal_of: Mapping[uuid.UUID, uuid.UUID],
    recognisers: finder.Recognisers,
    conventions: SheetConventions,
    *,
    options: Sequence[dict[str, object]],
    same_titles: Sequence[SameTitle] = (),
) -> int:
    """19b's storey-titles Check over the set: each sheet whose title names storeys its plans do not
    agree with, asked as one `check` Question per Discipline (`storey_codes.DIFFERS`, the first such
    sheet named as the example) holding its undecided disagreeing sheets; a sheet of no Discipline, a
    decided one, or one whose same disagreement the QS has answered (`step1.answered_findings`: never
    asked again, #436's review round 1), is held by none; nor is a stale copy (`_stale_copies`), asked
    by its open `same_title` conflict (`same_titles`). The Check's run is recorded with each finding,
    an answered one under the Question that answered it, a stale copy's under its conflict's. How
    many Questions were asked."""
    reading = SetReading(
        sheets=tuple(sheets),
        views=tuple(tuple(vs) for vs in views),
        read=frozenset({"views"}),
        conventions=conventions,
    )
    results = storey_titles.check(reading, recognisers=recognisers)
    at = {id(c): i for i, c in enumerate(sheets)}
    answered = step1.answered_findings(project_id, storey_titles.CODE)
    fired: list[tuple[Message, drawings.SheetView | None, uuid.UUID | None]] = []
    undecided: list[tuple[int, drawings.SheetView]] = []
    for result in results:
        if result.outcome != CheckOutcome.FIRED or result.finding is None:
            continue
        index = at.get(id(result.subject)) if result.subject is not None else None
        sheet = listed[index] if index is not None else None
        recorded = _with_plans(result.finding, views[index] if index is not None else ())
        said = json.dumps(dict(recorded["params"]), sort_keys=True, default=str)
        decided = answered.get((str(sheet.id), said)) if sheet is not None else None
        fired.append((recorded, sheet, decided))
        if decided is None and index is not None and sheet is not None and not sheet.decision:
            undecided.append((index, sheet))
    copies = _stale_copies(undecided, sheets, views, listed, recognisers, same_titles)
    if copies:
        still = step1.open_questions(project_id, copies.values())
        copies = {sheet_id: q for sheet_id, q in copies.items() if q in still}
    asked: dict[str, list[tuple[Message, drawings.SheetView]]] = {}
    for recorded, sheet, decided in fired:
        if decided is not None or sheet is None or not sheet.discipline or sheet.decision:
            continue
        if sheet.id not in copies:
            asked.setdefault(sheet.discipline, []).append((recorded, sheet))
    raised: dict[str, uuid.UUID] = {}
    for discipline, found in asked.items():
        example = {k: v for k, v in found[0][0]["params"].items() if k != PLANS}
        message = storey_codes.DIFFERS(discipline=discipline, count=len(found), **example)
        blocks = [proposal_of[s.id] for _, s in found if s.id in proposal_of]
        raised[discipline] = step1.raise_question(
            project_id,
            "check",
            message,
            discipline=discipline,
            options=options,
            check_code=storey_titles.CODE,
            blocks=blocks,
            keyed_by_holds=True,  # the same words over other sheets: another Question
            keyed_by=[json.dumps(dict(f["params"]), sort_keys=True, default=str) for f, _ in found],
        )
    step1.retire_questions(project_id, (storey_codes.DIFFERS.code,), raised.values())
    findings = [
        (
            finding,
            [sheet.id] if sheet is not None else [],
            decided
            or (
                copies.get(sheet.id) or raised.get(sheet.discipline or "")
                if sheet is not None and not sheet.decision
                else None
            ),
        )
        for finding, sheet, decided in fired
    ]
    step1.record_check_run(
        project_id,
        storey_titles.CODE,
        storey_titles.VERSION,
        passed=len(results) - len(fired),
        total=len(results),
        findings=findings,
    )
    return len(raised)
