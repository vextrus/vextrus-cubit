"""The read job's Step 1 proposals and Questions (ticket 21c; docs/plans/M0.md, 21c): the last steps
of a file's read job (21a's `files.read`), each kept once by `drawings`' StepStore.

    propose(file_id, load, unread=2)     # `proposals`: a read file's sheets and views proposed
    ask_held(file_id)                    # `held`: a held file's `file_misread` Question

**A read file's sheets** (those in the sheet list): each a Proposal of its own, with its Traces
(where its number and title were read, else its place) and Jev's answer about its kind, asked with
13's question (`engine.recognise.sheets.judgement`) through 15's `jev.ask_judgement`: Jev's first
choice is the proposed kind (#228, the owner's ruling "Propose Jev's top kind"), unless it is unsure
(`unsure`: under `jev.SHEET_TYPE.proposes`, its top two close, or the sheet's title naming another
kind), when a `low_confidence` Question offers the kinds most likely first, Jev's first picked; with
TypeSafe unavailable the kind is left to the QS, and nothing is asked. Each view a Proposal with
its Traces, and its Coverage row (`step1.record_coverage`: to its Takeoff Steps and its Discipline
Part, proposed out with a reason, or unaccounted). A sheet with no number is asked (`missing`), one
with no Discipline asked which it is (`missing_discipline`, #102).
A sheet the read proposed out with no number (a cover, a stale layout: `step1.proposed_out`) is
proposed and asked nothing (#162): it is no sheet of the set's, and the QS sees it proposed out.
The sheets 21b left out for unreadable writing are counted (`unread`; Coverage's `unread_sheets`).

**Then the set's Questions**, over every sheet in the sheet list, whichever file brought it: 19b's
Conflicts (`same_number`, `same_title`, `same_storey`) raised as `conflict` Questions holding their
sheets' Proposals, each Discipline's sheets compared among themselves, every Conflict trimmed to
its undecided sheets (a decided one keeps a run's context; copies of a number one of which is
confirmed are a Revision's question), and the sheets of no
Discipline only with the others of their own file (#161: each is asked its Discipline); a conflict
no longer found is retired, `withdrawn` and still listed, and asked again if found again (an
answered one is never touched); the conflicts are asked again after every act on Step 1
(`set_conflicts`); two plans of one subject whose floor-to-floor ranges meet at a storey asked where
the first ends (a `convention` Question: 19b raises no conflict for them); the drawing list read on
a sheet (13's register) kept per Discipline, and 19b's register Check run (`CheckRun`, trigger
`read`), each finding a `check` Question. A Question raised again is the one asked
(`step1.raise_question`).
"""

import re
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from typing import Any

from django.conf import settings

from engine.check import register as register_check
from engine.messages import conflicts as conflict_codes
from engine.messages import register_check as list_codes
from engine.read import ReadArtefact
from engine.recognise import conflicts as finder
from engine.recognise import register as register_reader
from engine.recognise import sheets as sheet_finder
from engine.recognise.types import (
    Box,
    CheckOutcome,
    Conflict,
    DrawingList,
    Layer,
    ListEntry,
    ListSource,
    RegisterEntry,
    SetReading,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    StoreysMeaning,
    ValueSource,
    ViewCandidate,
    ViewKind,
)
from vextrus.drawings import services as drawings
from vextrus.platform.services import jev
from vextrus.takeoff.messages import proposals as said
from vextrus.takeoff.messages import step1 as step1_codes
from vextrus.takeoff.services import step1

KEEP_OPEN = "keep_open"
"""Every Question's last option (m0-screens §5: "Keep open, ask the consultant")."""
HELD_OPTIONS = ("read_anyway", "await_resaved", "sent_to_vextrus", KEEP_OPEN)
SAME_NUMBER_OPTIONS = ("keep_latest", "keep_all", KEEP_OPEN)
CONFLICT_OPTIONS = ("keep_all", KEEP_OPEN)
MISSING_OPTIONS = ("no_number", "type_number", KEEP_OPEN)
LISTS_OPTIONS = ("use_read", "use_given", KEEP_OPEN)
BOUNDARY_OPTIONS = ("includes_storey", "excludes_storey", KEEP_OPEN)
CHECK_OPTIONS = ("not_sent_yet", "not_in_set", "file_not_added", KEEP_OPEN)


def options(keys: Sequence[str]) -> list[dict[str, object]]:
    """A Question's options by key, in order, none pre-picked (a pick needs two sources: 22; the one
    exception is #228's kind Question, Jev's first picked by the orchestrator's ruling)."""
    return [{"key": key, "picked": False} for key in keys]


# A held file ---------------------------------------------------------------------------------------


def ask_held(file_id: uuid.UUID) -> dict[str, Any]:
    """The held file's `file_misread` Question: its words are the file's finding (the two readers'
    counts), its options m0-screens §5's, none pre-picked."""
    view = drawings.file(file_id)
    assert view.finding is not None, "a held file carries its finding"
    question_id = step1.raise_question(
        view.project_id,
        "file_misread",
        view.finding,
        subject_id=file_id,
        discipline=view.discipline,
        options=options(HELD_OPTIONS),
    )
    return {"question": str(question_id)}


# A read file's sheets and views ------------------------------------------------------------------


def propose(
    file_id: uuid.UUID,
    load: Callable[[], ReadArtefact],
    conventions: SheetConventions,
    *,
    unread: int = 0,
) -> dict[str, Any]:
    """The `proposals` step (see the module); what it proposed and asked, as counts."""
    view = drawings.file(file_id)
    project_id = view.project_id
    listed = [s for s in drawings.sheets(view.set_id) if s.file_id == file_id]
    step1.record_unread(project_id, file_id, sheet_found=len(listed), unread=unread)
    proposed = 0
    for sheet in listed:
        views = drawings.views(sheet.id)
        out = step1.proposed_out(sheet)
        proposal_id = _propose_sheet(project_id, sheet, views, conventions, ask=not out)
        for seen in views:
            step1.propose_view(project_id, seen, traces=_view_traces(seen))
        step1.record_coverage(sheet.id)
        if sheet.number is None and not out:
            step1.raise_question(
                project_id,
                "missing",
                step1_codes.NO_NUMBER(),
                subject_id=sheet.id,
                discipline=sheet.discipline,
                options=options(MISSING_OPTIONS),
                blocks=[proposal_id],
            )
        if sheet.discipline is None and not out:
            keys = [d.key for d in drawings.disciplines()]
            step1.raise_question(
                project_id,
                "missing_discipline",
                said.WHICH_DISCIPLINE(**named(sheet)),
                subject_id=sheet.id,
                options=options([*keys, KEEP_OPEN]),
                blocks=[proposal_id],
            )
        proposed += 1
    if listed:
        _read_lists(listed, load, conventions)
    asked = set_questions(project_id, trigger_file=file_id)
    return {"sheets": proposed, "questions": asked}


def follow_discipline(file_id: uuid.UUID, actor_name: str = "") -> None:
    """After the QS changed a read file's Discipline (`drawings.on_discipline_changed`, in the change's
    transaction): its sheets' `missing_discipline` Questions are answered by it, and the set's
    Questions asked again under the sheets' new Discipline. A file not yet read has no sheet listed:
    its `proposals` step reads the choice itself (#159)."""
    view = drawings.file(file_id)
    listed = [s for s in drawings.sheets(view.set_id) if s.file_id == file_id]
    if not listed:
        return
    step1.answer_disciplines(view.project_id, listed, actor_name=actor_name)
    set_questions(view.project_id, trigger_file=file_id)


NAMED_STOREYS = frozenset(
    {
        "pile",
        "pile_cap",
        "foundation",
        "plinth",
        "lower_ground",
        "ground",
        "mezzanine",
        "podium",
        "roof",
        "stair_room_roof",
        "lift_machine_room",
        "lift_machine_room_roof",
        "typical",
        "top",
    }
)
"""The storeys the words name by key: every one of 13's storey words but the numbered `floor_<n>`
and `basement_<n>` (their own branches); `other` ("its top storey") only for a key 13 does not
have yet (a test holds this set to 13's conventions and the catalogue)."""


def storey_named(key: str) -> dict[str, str | int]:
    """A storey as a Question's words name it (13's keys): `level` `floor` or `basement` with its
    `number` (the words give "1st"), a named storey by its key (`NAMED_STOREYS`), else `other` (the
    words say "its top storey", never a key); `storey` is the key, for the record."""
    kind, _, number = key.rpartition("_")
    if kind in ("floor", "basement") and number.isdigit():
        return {"level": kind, "number": int(number), "storey": key}
    if key == "basement":
        return {"level": "basement", "number": 1, "storey": key}
    if key in NAMED_STOREYS:
        return {"level": key, "number": 0, "storey": key}
    return {"level": "other", "number": 0, "storey": key}


def named(sheet: drawings.SheetView, prefix: str = "") -> dict[str, str]:
    """A sheet as a Question's words name it: its number, else its title (quoted by the words), else
    neither (`named`: `number`, `title` or `none`)."""
    if sheet.number:
        return {f"{prefix}sheet": sheet.number, f"{prefix}named": "number"}
    if sheet.title.strip():
        return {f"{prefix}sheet": sheet.title, f"{prefix}named": "title"}
    return {f"{prefix}sheet": "", f"{prefix}named": "none"}


def _propose_sheet(
    project_id: uuid.UUID,
    sheet: drawings.SheetView,
    views: Sequence[drawings.ViewView],
    conventions: SheetConventions,
    *,
    ask: bool = True,
) -> uuid.UUID:
    request = sheet_finder.judgement(
        candidate(sheet), [v.title for v in views if v.title], conventions=conventions
    )
    answer = jev.ask_judgement(request) if request is not None else None
    sure = isinstance(answer, jev.Answer) and not unsure(answer, sheet.title)
    proposal_id = step1.propose_sheet(
        sheet.id,
        answer=answer if sure and isinstance(answer, jev.Answer) else None,
        traces=_sheet_traces(sheet),
    )
    if isinstance(answer, jev.Answer) and not sure and ask:
        step1.raise_question(
            project_id,
            "low_confidence",
            said.WHICH_KIND(**named(sheet)),
            subject_id=sheet.id,
            discipline=sheet.discipline,
            options=[
                {"key": key, "picked": at == 0} for at, key in enumerate([*answer.ranked(), KEEP_OPEN])
            ],
            blocks=[proposal_id],
        )
    return proposal_id


def unsure(answer: jev.Judgement, title: str) -> bool:
    """Whether Jev's kind for a sheet is asked rather than proposed (#228): never when Jev is sure
    (`jev.SHEET_TYPE.proposes`); else when its top two are close (its first's lead under
    `VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY`) or the title contradicts its first: `kinds_named` names kinds
    offered and none clears it. A named kind of its first's subject clears it only when the title
    also holds its first's last word: "BEAM LAYOUT & DETAILS" does not contradict `beam_details`,
    "BEAM LAYOUT" alone does (review 2, finding 2)."""
    if jev.SHEET_TYPE.proposes(answer):
        return False
    ranked = answer.ranked()
    first = ranked[0]
    if len(ranked) > 1:
        lead = answer.probability(first) - answer.probability(ranked[1])
        if lead < settings.VEXTRUS_JEV_SHEET_TYPE_CLOSE_BY:
            return True
    named = kinds_named(title, ranked)
    said = f" {_words(title)} "
    last = f" {_words(first.rpartition('_')[2])} "
    return bool(named) and not any(subject(k) == subject(first) and last in said for k in named)


def subject(kind: str) -> str:
    """A kind's subject: every word of its key but the last ("pile cap" of `pile_cap_details`)."""
    return kind.rpartition("_")[0]


def kinds_named(title: str, kinds: Sequence[str]) -> list[str]:
    """The kinds a sheet's title names word for word: each kind of two words or more whose key's
    words ("column schedule") stand together, whole, in the title ("TYPICAL COLUMN SCHEDULES"), case,
    punctuation and a plural "s" aside. Conservative: a one-word kind (`details`, `section`,
    `elevation`, `legend`) names nothing, as its word sits in many titles of other kinds ("STAIR
    SECTION & DETAILS" is `stair_details`); "SLAB REINFORCEMENT" names no kind at all."""
    said = f" {_words(title)} "
    return [kind for kind in kinds if "_" in kind and f" {_words(kind)} " in said]


def _words(text: str) -> str:
    """A title's or key's words as `kinds_named` compares them: case, punctuation, a plural "s" aside."""
    return " ".join(w.removesuffix("s") for w in re.findall(r"[^\W_]+", text.casefold()))


def _sheet_traces(sheet: drawings.SheetView) -> list[tuple[str, dict[str, Any]]]:
    """Where the sheet's facts were read: each anchor, else its place in the file."""
    traces = [(str(a.detail.get("role") or "sheet"), _anchor_json(a)) for a in sheet.anchors]
    return traces or [("place", {"sheet_revision_id": str(sheet.id), **sheet.location})]


def _view_traces(view: drawings.ViewView) -> list[tuple[str, dict[str, Any]]]:
    traces = [(str(a.detail.get("role") or "view"), _anchor_json(a)) for a in view.anchors]
    return traces or [
        ("place", {"sheet_revision_id": str(view.sheet_revision_id), "box": list(view.box)})
    ]


def _anchor_json(anchor: drawings.StoredAnchor) -> dict[str, Any]:
    return {
        "sheet_revision_id": str(anchor.sheet_revision_id),
        "source_sha256": anchor.source_sha256,
        "reader_version": anchor.reader_version,
        **anchor.detail,
    }


# The sheets as the engine's candidates -------------------------------------------------------------


def candidate(sheet: drawings.SheetView, group: str | None = None) -> SheetCandidate:
    """A printed sheet as 13's candidate again: its place, what was read on it, its group."""
    location = sheet.location
    if "layout" in location:
        place = SheetLocation(layout=str(location["layout"]))
    else:
        x0, y0, x1, y1 = (float(v) for v in location["box"])
        place = SheetLocation(box=Box(x0, y0, x1, y1))

    def sourced(value: str | None, name: str) -> Sourced | None:
        if not value:
            return None
        source = sheet.sources.get(name) or ValueSource.TITLE_BLOCK_TEXT
        return Sourced(value, ValueSource(source))

    anchors = []
    for stored in sheet.anchors:
        try:
            anchors.append(stored.anchor())
        except KeyError, TypeError, ValueError:  # an anchor kept in an older shape: not needed here
            continue
    return SheetCandidate(
        location=place,
        number=sourced(sheet.number, "number"),
        title=sourced(sheet.title, "title"),
        discipline=Sourced(sheet.discipline, ValueSource.FILE) if sheet.discipline else None,
        revision_mark=sourced(sheet.revision_mark, "revision_mark"),
        issue_date=sourced(sheet.issue_date, "issue_date"),
        storeys_as_stated=sourced(sheet.storeys_as_stated, "storeys_as_stated"),
        anchors=tuple(anchors),
        group=group,
    )


def view_candidate(view: drawings.ViewView) -> ViewCandidate:
    x0, y0, x1, y1 = (float(v) for v in view.box)
    meaning = StoreysMeaning(view.storeys_meaning) if view.storeys and view.storeys_meaning else None
    return ViewCandidate(
        box=Box(x0, y0, x1, y1),
        kind=ViewKind(view.kind),
        title=view.title or None,
        storeys=tuple(view.storeys) if meaning else (),
        storeys_meaning=meaning,
        subject=view.subject,
        layer=Layer(view.layer) if view.layer in {str(v) for v in Layer} else None,
    )


# The drawing lists read on the file's sheets -------------------------------------------------------


def _read_lists(
    listed: Sequence[drawings.SheetView],
    load: Callable[[], ReadArtefact],
    conventions: SheetConventions,
) -> None:
    """13's register on the file's sheets: each list kept for its Discipline, on its sheet."""
    candidates = [candidate(s, "file") for s in listed]
    entries = register_reader.find(load(), candidates, conventions=conventions)
    if not entries:
        return
    numbers = finder.Numbers(conventions, finder.recognisers(conventions))
    by_sheet: dict[int, dict[str, list[tuple[str, str]]]] = {}
    position = {id(c): i for i, c in enumerate(candidates)}
    for entry in entries:
        if entry.number is None or finder.normal(entry.number) is None:
            continue
        on = listed[position[id(entry.sheet)]]
        discipline = numbers.owner(entry.number) or on.discipline
        if discipline is None:
            continue
        rows = by_sheet.setdefault(position[id(entry.sheet)], {}).setdefault(discipline, [])
        rows.append((entry.number, entry.title or ""))
    for index, lists in by_sheet.items():
        for discipline, rows in lists.items():
            step1.record_read_list(listed[index].id, discipline, rows)


# The set's Questions ------------------------------------------------------------------------------


def set_questions(project_id: uuid.UUID, *, trigger_file: uuid.UUID | None = None) -> int:
    """The set's conflicts, boundary storeys and register Check, over every sheet in the sheet list
    (see the module); how many Questions they hold (asked now or before)."""
    drawing_set = drawings.set_of(project_id)
    if drawing_set is None:
        return 0
    listed = drawings.sheets(drawing_set.id)
    if not listed:
        return 0
    groups = {f.id: f.group for f in drawings.files(drawing_set.id)}
    conventions = step1.sheet_conventions()
    sheets = [candidate(s, groups.get(s.file_id, "site")) for s in listed]
    viewed = [drawings.views(s.id) for s in listed]
    views = [[view_candidate(v) for v in vs] for vs in viewed]
    proposal_of = step1.proposal_ids(project_id)
    recognisers = finder.recognisers(conventions)
    asked = _conflicts(project_id, listed, sheets, views, proposal_of, recognisers, conventions)
    asked += _boundaries(project_id, listed, viewed, proposal_of)
    asked += _register(project_id, listed, sheets, views, proposal_of, recognisers, conventions)
    return asked


def set_conflicts(project_id: uuid.UUID) -> int:
    """The set's conflicts asked again after an act decided or undid sheets (confirm, exclude, an
    answer, undo): those of sheets now decided retired, those of sheets undecided again asked again;
    how many are open. No Check is run (its runs are the reads')."""
    drawing_set = drawings.set_of(project_id)
    listed = drawings.sheets(drawing_set.id) if drawing_set is not None else []
    groups = {f.id: f.group for f in drawings.files(drawing_set.id)} if drawing_set else {}
    conventions = step1.sheet_conventions()
    return _conflicts(
        project_id,
        listed,
        [candidate(s, groups.get(s.file_id, "site")) for s in listed],
        [[view_candidate(v) for v in drawings.views(s.id)] for s in listed],
        step1.proposal_ids(project_id),
        finder.recognisers(conventions),
        conventions,
    )


def _conflicts(
    project_id: uuid.UUID,
    listed: Sequence[drawings.SheetView],
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    proposal_of: Mapping[uuid.UUID, uuid.UUID],
    recognisers: finder.Recognisers,
    conventions: SheetConventions,
) -> int:
    """19b's Conflicts over every listed sheet (a decided one keeps a run's or a storey's context),
    each trimmed to the sheets not yet decided (`_undecided`) and asked as a `conflict` Question;
    every one asked before and not found now retired (`step1.retire_questions`). How many were
    asked."""
    as_compared = [_compared(s, c) for s, c in zip(listed, sheets, strict=True)]
    found = finder.compare(as_compared, views, conventions=conventions, recognisers=recognisers)
    at = {id(c): i for i, c in enumerate(as_compared)}
    at |= {id(v): i for i, vs in enumerate(views) for v in vs}
    raised: list[uuid.UUID] = []
    for conflict in found:
        if not isinstance(conflict, Conflict):
            continue
        trimmed = _undecided(conflict, [listed[i] for i in _held_sheets(conflict, at)])
        if trimmed is not None:
            raised.append(_conflict(project_id, conflict.kind, *trimmed, proposal_of))
    step1.retire_questions(project_id, CONFLICT_CODES, raised)
    return len(raised)


def _undecided(
    conflict: Conflict, held: Sequence[drawings.SheetView]
) -> tuple[dict[str, Any], list[drawings.SheetView]] | None:
    """A Conflict's evidence and the sheets its Question holds: only those not yet decided, a
    confirmed or left-out sheet never grouped with another (#161). Copies of one number are a
    `same_number` Question only while none of them is confirmed (ruling 2 and the refuter's case of a
    copy confirmed by hand: a Revision's question) and two or more are undecided, its words counting
    those; a same title or storey stands while any of its sheets is undecided, its words the set's.
    None: nothing to ask."""
    undecided = [s for s in held if not s.decision]
    evidence = dict(conflict.evidence)
    if conflict.kind == finder.SAME_NUMBER:
        if len(undecided) < 2 or any(s.decision == CONFIRMED for s in held):
            return None
        assert undecided[0].number is not None
        evidence |= {"number": undecided[0].number, "copies": len(undecided)}
    elif not undecided:
        return None
    return evidence, undecided


CONFLICT_CODES = tuple(
    c.code for c in (conflict_codes.SAME_NUMBER, conflict_codes.SAME_TITLE, conflict_codes.SAME_STOREY)
)
"""19b's Conflicts as Questions: each round asks them all again and retires the rest (#161)."""
CONFIRMED = "confirmed"
"""A printed sheet's decision once the QS confirmed it (drawings' `Decision`)."""
NO_DISCIPLINE = "no_discipline"
"""The Discipline a sheet of none is compared under: only with its own file's other such sheets (a
group of their own), so even a Market's Discipline of this key would never meet them."""


def _compared(sheet: drawings.SheetView, found: SheetCandidate) -> SheetCandidate:
    """A sheet as 19b compares it (#161, the orchestrator's ruling 5): one of no Discipline only with
    the other sheets of its own file, under no Discipline's prefixes (19b leaves a sheet of none
    out)."""
    if found.discipline is not None:
        return found
    none = Sourced(NO_DISCIPLINE, ValueSource.FILE)
    return replace(found, discipline=none, group=f"{found.group}/{sheet.file_id}")


def _held_sheets(conflict: Conflict, at: Mapping[int, int]) -> list[int]:
    """The sheets a Conflict holds, by their place in the sheet list, each once (a view held is its
    sheet)."""
    held: list[int] = []
    for found in conflict.candidates:
        index = at.get(id(found))
        if index is not None and index not in held:
            held.append(index)
    return held


def _conflict(
    project_id: uuid.UUID,
    kind: str,
    evidence: Mapping[str, Any],
    held: Sequence[drawings.SheetView],
    proposal_of: Mapping[uuid.UUID, uuid.UUID],
) -> uuid.UUID:
    """A Conflict as a `conflict` Question holding its sheets' Proposals; the Question's id."""
    code = {
        finder.SAME_NUMBER: conflict_codes.SAME_NUMBER,
        finder.SAME_TITLE: conflict_codes.SAME_TITLE,
        finder.SAME_STOREY: conflict_codes.SAME_STOREY,
    }[kind]
    keys = SAME_NUMBER_OPTIONS if kind == finder.SAME_NUMBER else CONFLICT_OPTIONS
    disciplines = {s.discipline for s in held if s.discipline}
    worded = dict(evidence)
    if worded.get("discipline") == NO_DISCIPLINE:
        worded["discipline"] = ""
    message = code(**worded)
    blocks = [proposal_of[s.id] for s in held if s.id in proposal_of]
    return step1.asked_of(project_id, message, blocks) or step1.raise_question(
        project_id,
        "conflict",
        message,
        subject_id=held[0].id,
        discipline=disciplines.pop() if len(disciplines) == 1 else None,
        options=options(keys),
        blocks=blocks,
    )


def _boundaries(
    project_id: uuid.UUID,
    listed: Sequence[drawings.SheetView],
    viewed: Sequence[Sequence[drawings.ViewView]],
    proposal_of: Mapping[uuid.UUID, uuid.UUID],
) -> int:
    """Two floor-to-floor plans of one Discipline and subject where the first's range ends at the
    storey the second's starts: does the first include that storey? (m0-screens 6.7's boundary
    storey; 19b raises no conflict: consecutive ranges meet at a floor by the drafting convention.)"""
    ranges = [
        (i, v)
        for i, vs in enumerate(viewed)
        for v in vs
        if v.kind == ViewKind.PLAN
        and v.storeys_meaning == StoreysMeaning.FLOOR_TO_FLOOR
        and len(v.storeys) > 1
        and v.subject
    ]
    asked = 0
    for i, first in ranges:
        for j, then in ranges:
            if i == j or listed[i].discipline != listed[j].discipline or first.subject != then.subject:
                continue
            if first.storeys[-1] != then.storeys[0] or not (first.storeys_as_stated or first.title):
                continue  # no range as the drawing states it: nothing to ask it by
            sheet = listed[i]
            step1.raise_question(
                project_id,
                "convention",
                said.BOUNDARY_STOREY(
                    **named(sheet),
                    range=first.storeys_as_stated or first.title,
                    **named(listed[j], "next_"),
                    **storey_named(first.storeys[-1]),
                ),
                subject_id=first.id,
                discipline=sheet.discipline,
                options=options(BOUNDARY_OPTIONS),
                blocks=[proposal_of[sheet.id]] if sheet.id in proposal_of else [],
            )
            asked += 1
    return asked


def _register(
    project_id: uuid.UUID,
    listed: Sequence[drawings.SheetView],
    sheets: Sequence[SheetCandidate],
    views: Sequence[Sequence[ViewCandidate]],
    proposal_of: Mapping[uuid.UUID, uuid.UUID],
    recognisers: finder.Recognisers,
    conventions: SheetConventions,
) -> int:
    """19b's register Check over the set: the lists read on its sheets (kept per Discipline) and,
    where there is none, the QS's; each finding a `check` Question."""
    at = {s.id: i for i, s in enumerate(listed)}
    entries: list[RegisterEntry] = []
    for row in step1.read_lists(project_id):
        index = at.get(row.sheet_id)
        if index is None:
            continue  # a list read on a sheet no longer in the sheet list
        on = sheets[index]
        for number, title in row.entries:
            entries.append(
                RegisterEntry(on, Box(0.0, 0.0, 0.0, 0.0), number=number, title=title or None)
            )
    read_for = {
        (str(sheets[at[r.sheet_id]].group), r.discipline)
        for r in step1.read_lists(project_id)
        if r.sheet_id in at
    }
    lists = []
    for given in step1.given_lists(project_id):
        for group in sorted({str(s.group) for s in sheets}):
            if (group, given.discipline) in read_for:
                continue  # held back beside a list read on a sheet (the two are compared as a Question)
            lists.append(
                DrawingList(
                    group,
                    given.discipline,
                    ListSource(given.source),
                    tuple(ListEntry(n, line) for line, n in enumerate(given.numbers, start=1)),
                )
            )
    reading = SetReading(
        sheets=tuple(sheets),
        views=tuple(tuple(vs) for vs in views),
        register=tuple(entries),
        lists=tuple(lists),
        read=frozenset({"register", "views"}),
        conventions=conventions,
    )
    results = register_check.check(reading, recognisers=recognisers)
    fired = [r for r in results if r.outcome == CheckOutcome.FIRED and r.finding is not None]
    by_sheet = {id(c): i for i, c in enumerate(sheets)}
    findings = []
    for result in fired:
        assert result.finding is not None
        subject = result.subject
        if isinstance(subject, RegisterEntry):
            subject = subject.sheet
        index = by_sheet.get(id(subject)) if subject is not None else None
        sheet = listed[index] if index is not None else None
        params = dict(result.finding["params"])
        discipline = sheet.discipline if sheet is not None else params.get("discipline")
        # A number listed and in no file is about the list, not the sheet it is on.
        about_list = result.finding["code"] == list_codes.NOT_FOUND.code
        question_id = step1.raise_question(
            project_id,
            "check",
            result.finding,
            subject_id=None if about_list or sheet is None else sheet.id,
            discipline=str(discipline) if discipline else None,
            options=options(CHECK_OPTIONS),
            check_code=register_check.CODE,
            blocks=[proposal_of[sheet.id]]
            if sheet is not None and not about_list and sheet.id in proposal_of
            else [],
        )
        findings.append((result.finding, [sheet.id] if sheet else [], question_id))
    step1.record_check_run(
        project_id,
        register_check.CODE,
        register_check.VERSION,
        passed=len(results) - len(fired),
        total=len(results),
        findings=findings,
    )
    return len(fired)
