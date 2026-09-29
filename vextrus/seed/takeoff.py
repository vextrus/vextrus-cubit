"""The demo seed's `takeoff` rows (ticket 19a; docs/design/m0-screens.md §7): KR-01's Step 1 before
the QS's walk, and BP-02's "Held, answered". All invented; everything goes through
`takeoff.services.step1`, as 21c's read job will write it.

**KR-01:** each of its 24 printed sheets a Proposal. Where a sheet's kind was read, Jev's answer about
it is kept on its Proposal: the kind, among the kinds its Discipline's sheets carry, answered by a
stand-in for TypeSafe (no call leaves the machine; the answer goes through `jev.ask` into the
tenant's cache, as a job's would). The five Questions are asked in §7's queue order: Q1
KR-STR-old.dwg may be misread; Q2 two sheets numbered S-07 (rev B pre-picked); Q3 the unnumbered door
and window schedule; Q4 the kind of A-05; Q5 S-13 on the drawing list in no file. Every view's
Coverage row: 70 views, 68 proposed, 2 unaccounted (S-10's loose boxes). Step 1's progress rows, one
per Discipline.

**BP-02, "Held, answered":** BP-ARC-old.dwg, held (its two readers disagree), its `file_misread`
Question answered by Nusrat Jahan: read anyway (m0-screens 4.5, "Held, read anyway: its sheets are
marked"; it has none).

For 21a (a named shared edit, after 19a merges): a read job's states on BP-02 and MG-01 go in a
function of their own called from `run`, beside `bokul_held`; `demo` holds each file's id as
`file:<code>:<name>` and each Question's as `question:<code>:<n>`.
"""

import json
import uuid
from collections.abc import Sequence
from decimal import Decimal

import httpx

from engine.check.decoders_agree import CODE as DECODERS_AGREE
from engine.messages import conflicts as conflict_codes
from engine.messages import decoders_agree as agree_codes
from engine.messages import register_check as list_codes
from engine.recognise.types import CheckOutcome, CheckResult
from vextrus.drawings import services as drawings
from vextrus.platform.services import jev, tenancy
from vextrus.seed.demo import Demo
from vextrus.seed.drawings import added, invented
from vextrus.takeoff.messages import step1 as step1_codes
from vextrus.takeoff.services import step1

KIND_QUESTION = "What kind of sheet is this?"
"""The question the seed's stand-in answers (21c asks 13's own)."""


def run(demo: Demo) -> None:
    with tenancy.acting_in(demo["developer:shapla"], user_id=demo["user:nusrat"]):
        kadam(demo)
        bokul_held(demo)


# KR-01 --------------------------------------------------------------------------------------------


def kadam(demo: Demo) -> None:
    code = "KR-01"
    project_id = demo[f"project:{code}"]
    sheets = drawings.sheets(demo[f"drawing_set:{code}"])
    kinds: dict[str | None, list[str]] = {}
    for sheet in sheets:
        if sheet.kind and sheet.kind not in kinds.setdefault(sheet.discipline, []):
            kinds[sheet.discipline].append(sheet.kind)
    proposal_of = {}
    with jev.using(_stand_in()):
        for sheet in sheets:
            answer = _jev_answer(sheet, kinds.get(sheet.discipline, []))
            proposal_of[sheet.id] = step1.propose_sheet(sheet.id, answer=answer)
            step1.record_coverage(sheet.id)
    for key, sheet_id in list(demo.items()):
        if key.startswith(f"sheet:{code}:") and sheet_id in proposal_of:
            demo[f"proposal:{code}:{key.removeprefix(f'sheet:{code}:')}"] = proposal_of[sheet_id]
    ask_five(demo, code, project_id)
    step1.record_progress(project_id)


def ask_five(demo: Demo, code: str, project_id: uuid.UUID) -> None:
    """§7's five Questions, in queue order."""
    held_id = demo[f"file:{code}:KR-STR-old.dwg"]
    held = drawings.file(held_id)
    asked = [
        step1.raise_question(
            project_id,
            "file_misread",
            held.finding
            or agree_codes.DISAGREE(items=0, only_first=0, only_second=0, kinds=0, layers=0, unread=0),
            subject_id=held_id,
            discipline=held.discipline,
            options=_options("read_anyway", "await_resaved", "sent_to_vextrus", "keep_open"),
        ),
        step1.raise_question(
            project_id,
            "conflict",
            conflict_codes.SAME_NUMBER(number="S-07", copies=2),
            subject_id=demo[f"sheet:{code}:S-07 rev B"],
            discipline="structural",
            options=_options("keep_b", "keep_a", "keep_both", "keep_open", picked="keep_b"),
            blocks=[demo[f"proposal:{code}:S-07 rev A"], demo[f"proposal:{code}:S-07 rev B"]],
        ),
        step1.raise_question(
            project_id,
            "missing",
            step1_codes.NO_NUMBER(),
            subject_id=demo[f"sheet:{code}:door and window schedule"],
            discipline="architectural",
            options=_options("no_number", "type_number", "keep_open"),
            blocks=[demo[f"proposal:{code}:door and window schedule"]],
        ),
        step1.raise_question(
            project_id,
            "low_confidence",
            step1_codes.WHICH_KIND(number="A-05"),
            subject_id=demo[f"sheet:{code}:A-05"],
            discipline="architectural",
            options=_options("elevation", "section", "floor_plan", "keep_open"),
            blocks=[demo[f"proposal:{code}:A-05"]],
        ),
        step1.raise_question(
            project_id,
            "check",
            list_codes.NOT_FOUND(number="S-13"),
            discipline="structural",
            options=_options("not_sent_yet", "not_in_set", "file_not_added", "keep_open"),
            check_code="register",
        ),
    ]
    for n, question_id in enumerate(asked, start=1):
        demo[f"question:{code}:{n}"] = question_id


def _options(*keys: str, picked: str | None = None) -> list[dict[str, object]]:
    """A Question's options by key, in order, the pre-picked one marked (words are the web's)."""
    return [{"key": key, "picked": key == picked} for key in keys]


# Jev's answers, from a stand-in -----------------------------------------------------------------------


def _jev_answer(sheet: drawings.SheetView, kinds: Sequence[str]) -> jev.Answer | None:
    """Jev's answer about a sheet's kind: the kind read first among its Discipline's kinds (up to
    four); none where no kind was read or its Discipline offers one kind only."""
    if not sheet.kind:
        return None
    options = [sheet.kind, *[k for k in kinds if k != sheet.kind]][:4]
    if len(options) < 2:
        return None
    facts = {
        "title": sheet.title,
        "discipline": sheet.discipline or "",
        "view_titles": [v.title for v in drawings.views(sheet.id)],
    }
    answer = jev.ask(jev.SHEET_TYPE, facts, KIND_QUESTION, options)
    return answer if isinstance(answer, jev.Answer) else None


def _stand_in() -> jev.Client:
    """A client whose TypeSafe is a function here: it picks the first option offered, at 0.86."""

    def answer(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        [(node, asked)] = body["questions"].items()
        options = list(asked["criteria"])
        rest = (Decimal("0.14") / (len(options) - 1)).quantize(Decimal("0.0001"))
        probabilities = {option: str(rest) for option in options[1:]} | {options[0]: "0.86"}
        choice = {"type": "choice", "choice": options[0], "confidence": 0.86}
        choice["probabilities"] = {o: float(p) for o, p in probabilities.items()}
        return httpx.Response(200, json={"model": body["model"], "answers": {node: choice}})

    return jev.Client(transport=httpx.MockTransport(answer), key=lambda: "seed-stand-in")


# BP-02: Held, answered -------------------------------------------------------------------------------


def bokul_held(demo: Demo) -> None:
    """A held file on BP-02 whose `file_misread` Question Nusrat Jahan answered: read anyway."""
    code = "BP-02"
    project_id = demo[f"project:{code}"]
    held = added(demo, code, project_id, "BP-ARC-old.dwg", invented("dwg", "BP-ARC-old"))
    disagree = agree_codes.DISAGREE(items=96, only_first=80, only_second=16, kinds=1, layers=2, unread=0)
    drawings.record_reports(
        held.id, cross_check=CheckResult(DECODERS_AGREE, CheckOutcome.FIRED, finding=disagree)
    )
    drawings.quarantine(held.id, disagree)
    question_id = step1.raise_question(
        project_id,
        "file_misread",
        disagree,
        subject_id=held.id,
        discipline=held.discipline,
        options=_options("read_anyway", "await_resaved", "sent_to_vextrus", "keep_open"),
    )
    drawings.answer_held(held.id, drawings.HeldAnswer.READ_ANYWAY)
    step1.answer_question(project_id, question_id, {"key": "read_anyway"})
    demo[f"question:{code}:held"] = question_id
