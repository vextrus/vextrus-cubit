"""The export's burden block (ticket T-249, part 1): what Step 1 would ask of the QS for a Project, per
Discipline, in counts only, so the real-drawing check's posting run can see a PR that doubles the
Questions per Discipline (until now only the G1 walk counted it, from its own API calls).

    {"version": 1, "disciplines": {<Discipline key or "none">: {sheets, sheets_counted,
     bulk_confirmable, one_source, held, questions_open: {<kind>: n}, conflicts: {same_number,
     same_title, same_storey}, gap_questions, gap_files, machine_doubt, counted_toward_cap,
     plan_sheets_no_storey, proposed_out, proposed_out_by_reason: {<reason>: n}}}}

Read from Step 1's own public answers (`step1.proposals`, `step1.questions`, `step1.proposed_out`),
so the block follows whatever those make `agrees` and a Question's kind mean, and taken before any act
(the export acts for no one). Definitions (the ticket's section 3, A1):

- `sheets`: the sheet list's rows of the Discipline; `sheets_counted`: those not proposed out;
- `bulk_confirmable`: `agrees and not held`; `one_source`: `not agrees` (the walk's own rules);
- `questions_open`: the open Questions by kind;
- `conflicts`: the open Questions by the three conflict codes, outside the cap;
- `gap_questions`: the open Questions of a numbering gap (by message code: every register Check's
  Question shares the check code `register`); `gap_files`: the distinct files they sit on (the file of
  a Question's first held sheet; a gap Question on no file counts once for its Discipline);
- `machine_doubt`: the open Questions that are neither a conflict nor a gap;
- `counted_toward_cap`: `machine_doubt + gap_files` (Q5 refined: numbering gaps count once per file);
- `plan_sheets_no_storey`: sheets with a plan view, no storey on any view and none stated by the sheet;
- `proposed_out`, `proposed_out_by_reason`: sheets the read proposed out, by the exclusion reason.

A sheet or Question of no Discipline, or of one the Market does not name, is in the row "none". No
title, number, layout or other drawing text is ever written: every leaf is a count, every key a
Discipline key or a word of a closed list (`QuestionKind`, `ExclusionReason`, the conflict codes).
"""

import uuid
from typing import Any

from engine.recognise.types import ExclusionReason, ViewKind
from vextrus.drawings import services as drawings
from vextrus.takeoff.models import QuestionKind, QuestionStatus
from vextrus.takeoff.services import step1

VERSION = 1
NONE = "none"
"""The row of the sheets and Questions of no Discipline (or one the Market does not name)."""
CONFLICTS = {
    "engine.conflicts.same_number": "same_number",
    "engine.conflicts.same_title": "same_title",
    "engine.conflicts.same_storey": "same_storey",
}
"""The conflict Questions by message code: true defects of a set, outside the cap (Q5 refined)."""
GAPS = frozenset({"engine.register_check.gap", "engine.register_check.gaps"})
"""A numbering gap's Question, one gap or a Discipline's gaps asked as one (t229)."""
KINDS = tuple(kind.value for kind in QuestionKind)
REASONS = tuple(reason.value for reason in ExclusionReason)
_NO_FILE = "no file"


def burden(project_id: uuid.UUID) -> dict[str, Any]:
    """The Project's burden block (see the module); acting in its Developer."""
    known = {d.key for d in drawings.disciplines()}
    proposals = step1.proposals(project_id)
    questions = step1.questions(project_id)
    found = drawings.set_of(project_id)
    printed = {s.id: s for s in drawings.sheets(found.id)} if found is not None else {}
    file_of = {p.id: p.file_id for p in proposals} | {p.sheet_id: p.file_id for p in proposals}

    rows: dict[str, dict[str, Any]] = {}

    def row(discipline: str | None) -> dict[str, Any]:
        key = discipline if discipline in known else NONE
        return rows.setdefault(key, _row())

    for p in proposals:
        counts = row(p.discipline)
        counts["sheets"] += 1
        sheet = printed.get(p.sheet_id)
        out = step1.proposed_out(sheet) if sheet is not None else False
        counts["sheets_counted"] += not out
        counts["bulk_confirmable"] += p.agrees and not p.held
        counts["one_source"] += not p.agrees
        counts["held"] += p.held
        if out and p.proposed_exclusion in REASONS:
            counts["proposed_out"] += 1
            counts["proposed_out_by_reason"][p.proposed_exclusion] += 1
        elif out:
            counts["proposed_out"] += 1
            counts["proposed_out_by_reason"][ExclusionReason.OTHER.value] += 1
        counts["plan_sheets_no_storey"] += _plan_with_no_storey(p)

    gap_files: dict[str, set[str]] = {}
    for q in questions:
        if q.status != QuestionStatus.OPEN:
            continue
        counts = row(q.discipline)
        if q.kind in counts["questions_open"]:
            counts["questions_open"][q.kind] += 1
        if q.code in CONFLICTS:
            counts["conflicts"][CONFLICTS[q.code]] += 1
        elif q.code in GAPS:
            counts["gap_questions"] += 1
            on = [file_of[p] for p in [*q.proposals, q.subject_id] if p in file_of]
            key = q.discipline if q.discipline in known else NONE
            gap_files.setdefault(key, set()).add(str(on[0]) if on else _NO_FILE)
        else:
            counts["machine_doubt"] += 1
    for key, counts in rows.items():
        counts["gap_files"] = len(gap_files.get(key, ()))
        counts["counted_toward_cap"] = counts["machine_doubt"] + counts["gap_files"]
    return {"version": VERSION, "disciplines": {key: rows[key] for key in sorted(rows)}}


def _row() -> dict[str, Any]:
    return {
        "sheets": 0,
        "sheets_counted": 0,
        "bulk_confirmable": 0,
        "one_source": 0,
        "held": 0,
        "questions_open": dict.fromkeys(KINDS, 0),
        "conflicts": dict.fromkeys(CONFLICTS.values(), 0),
        "gap_questions": 0,
        "gap_files": 0,
        "machine_doubt": 0,
        "counted_toward_cap": 0,
        "plan_sheets_no_storey": 0,
        "proposed_out": 0,
        "proposed_out_by_reason": dict.fromkeys(REASONS, 0),
    }


def _plan_with_no_storey(p: step1.ProposalView) -> bool:
    """A sheet with at least one plan view, no storey on any of its views and none stated by it."""
    return (
        any(view.kind == ViewKind.PLAN for view in p.views)
        and not any(view.storeys for view in p.views)
        and not p.storeys_as_stated.strip()
    )
