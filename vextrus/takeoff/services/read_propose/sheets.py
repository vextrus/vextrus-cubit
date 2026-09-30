"""The read job's steps per sheet (ticket 21b; docs/plans/M0.md, 21b): a DWG's sheets found and each
sheet read, through `drawings.services`, each step kept once by `drawings`' StepStore. They run
inside the file's read job (21a's `files.read`), between `second_reader` and `finishing`; a held
file reads none.

    found = read(steps, file_id, load, keyed_by)        # `load()`: the file's kept ReadArtefact
    drawings.mark_read(file_id, found.not_read_in_full)  # in the `finishing` step

`found.not_read_in_full` is every step's "Not read in full" in the job's order (the `sheets` step's,
in `SHEETS_STEP_LIMITS` order, then each sheet's, in sheet order), a kept step's too: the file's
finding is the first, and its report says each (`drawings.services.mark_read`).

**`sheets`**: 13's finder on the kept artefact, with **the conventions the product reads with**
(`conventions(file_id)`: 13's and 17's defaults, with the file's Market's Discipline rows from
`drawings.services.conventions` over 13's), the file's Discipline as its default. Each candidate is
stamped with the file's group (its Building's id, "site" for the Site's; A10) and recorded
(`record_sheets`). Its result keeps the finder's budget report (`sheet_report`: every count,
each of `finder.LIMITS` even at 0), the filled "Not read in full" messages (`not_read_in_full`: a
`takeoff.read_file.not_read_in_full {limit}` once per limit above 0, as `{code, params}`), and each
recorded sheet's id with its candidate as JSON, so a restart reads the sheets without finding them
again.

**`sheet_<n>`**, for the n-th recorded sheet (`drawings.sheet_step`; the list's "Reading sheet 12
of 38"): 17's views (`record_views`), 11's render buffers (`record_render`), and its Plot where the
sheet alone decides it: a sheet with no number can match no page (`PlotNone.NO_NUMBER`). What the
view finder's limits cut while reading the sheet is its result's `view_report` (by `views_<limit>`);
the first sheet a limit cut says it, once for the file, in its result's `not_read_in_full`.
The matching of the set's PDF pages to sheets is the file's `finishing` step's and a PDF's
`matching` step's (`read_propose.plot`, ticket 157); F1 is not run here yet.

Each step's key holds the file's sha256, its reader, the conventions' digest, and the file's
Discipline and group: the same file read again as it was skips every kept step. A run that resumes
after kept sheet steps walks those sheets' views again (nothing recorded) before reading the next,
so the view finder's file-wide bounds are spent as in a run never stopped.
"""

import hashlib
import json
import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, replace
from functools import partial
from typing import Any, cast

from engine.messages import Message
from engine.read import ReadArtefact
from engine.read.anchor import anchor_from_json
from engine.recognise import sheets as finder
from engine.recognise import views as view_finder
from engine.recognise.types import (
    Box,
    Exclusion,
    ExclusionReason,
    SheetCandidate,
    SheetConventions,
    SheetLocation,
    Sourced,
    ValueSource,
    ViewConventions,
)
from engine.render import buffers as render
from vextrus.drawings import services as drawings
from vextrus.platform.services import jobs
from vextrus.takeoff.messages import read_file as said

VIEW_LIMIT = "views_{}"
"""A view finder's limit, as `not_read_in_full` says it (its own keys: the sheet finder's
`read_budget` is another limit)."""
VIEW_LIMITS = tuple(VIEW_LIMIT.format(limit) for limit in view_finder.LIMITS)
RENDER_BUDGET = "render_budget"
"""The file's render time was spent: the sheets after it are kept with no render (said once)."""
SHEET_STEP_LIMITS = (*VIEW_LIMITS, RENDER_BUDGET)
"""What a sheet's step says in `not_read_in_full`, each once for the file."""
UNREADABLE_TEXT = "sheet_text_unreadable"
"""Sheets whose number, title or other words still hold a drawing's raw codes: not kept, counted in
the `sheets` step's `sheet_report` and said once."""
SHEETS_STEP_LIMITS = (*finder.LIMITS, UNREADABLE_TEXT)
RENDER_SECONDS = 900.0
"""What drawing one file's sheets may take together (11's `Limits.seconds` bounds one sheet, 300 s),
spent across restarts: each sheet's render gets the smaller of the two."""
GIVEN_DISCIPLINE = frozenset({"file_name", "qs"})
"""A file's Discipline sources that come before its reading (`FileView.discipline_source`)."""
RAW_CODES = ("%%", "\\P", "\\f", "\\S", "^J", "{\\")
"""The codes `drawings` refuses in a sheet's words (`sheet_list._RAW_CODES`; a test holds them
equal): a sheet holding one is left out alone, never the file's whole list."""
_SOURCED = ("number", "title", "discipline", "revision_mark", "issue_date", "storeys_as_stated")


def conventions(file_id: uuid.UUID) -> tuple[SheetConventions, ViewConventions]:
    """What the file's sheets and views are read with: 13's default sheet conventions with the
    Market's Discipline rows over its Disciplines, and 17's default view conventions."""
    market = drawings.conventions(file_id)
    return replace(finder.default_conventions(), disciplines=market), view_finder.default_conventions()


def digest(sheet: SheetConventions, view: ViewConventions) -> str:
    text = json.dumps([sheet.to_json(), view.to_json()], sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode()).hexdigest()


@dataclass(frozen=True)
class SheetsRead:
    sheets: int
    """How many sheets were recorded."""
    not_read_in_full: tuple[Message, ...]
    """Every limit that cut the file, each once, in the job's order (see the module)."""
    unread: int = 0
    """Sheets left out for unreadable writing (`UNREADABLE_TEXT`; 21c's Coverage counts them, #135)."""


def read(
    steps: jobs.Steps,
    file_id: uuid.UUID,
    load: Callable[[], ReadArtefact],
    keyed_by: Mapping[str, object],
    done_before: int,
    after: int,
) -> SheetsRead:
    """Find the file's sheets and read each (see the module).
    `keyed_by`: the file's sha256 and reader, in every step's key; `done_before` and `after`: the
    file's steps before these and after them (the job's total)."""
    # Read inside the steps, acting in the file's tenant (the Market's rows are its Market's).
    held = once(lambda: conventions(file_id))

    def key(**more: object) -> Callable[[], dict[str, object]]:
        def inputs() -> dict[str, object]:
            # What the finder reads besides the artefact: the file's Discipline (its default) and
            # its group (the candidates' stamp), which the QS may change before "Try again".
            view = drawings.file(file_id)
            return {
                **keyed_by,
                "conventions": digest(*held()),
                # Only a Discipline given (by the QS or the file's name): the one the sheets step
                # derives from the sheet numbers is written by that step itself.
                "discipline": view.discipline if view.discipline_source in GIVEN_DISCIPLINE else None,
                "group": view.group,
                **more,
            }

        return inputs

    found = steps.run(drawings.SHEETS, lambda: _find(file_id, load(), held()[0]), inputs=key())
    recorded = cast(list[dict[str, Any]], found["sheets"])
    cut = _messages(found.get("not_read_in_full", []))
    steps.expect(done_before + 1 + len(recorded) + after)
    seen: dict[str, int] = {}
    said_for_file: set[str] = set()
    render_left = [RENDER_SECONDS]
    # The view finder's bounds are the file's, held by the artefact loaded in this run: sheets whose
    # steps were kept by an earlier run are walked again (nothing recorded) before the next sheet is
    # read, so a stop never hands the rest of the file a fresh budget.
    unwalked: list[SheetCandidate] = []
    read_here: list[uuid.UUID] = []

    def read_one(sheet_id: uuid.UUID, candidate: SheetCandidate) -> jobs.StepResult:
        read_here.append(sheet_id)
        artefact, view_conventions = load(), held()[1]
        for earlier in unwalked:
            spent = view_finder.find(artefact, earlier, view_conventions).limits
            seen.clear()
            seen.update(spent or {})
        unwalked.clear()
        return _read_sheet(
            sheet_id, candidate, artefact, view_conventions, seen, said_for_file, render_left[0]
        )

    for position, kept in enumerate(recorded, start=1):
        sheet_id = uuid.UUID(kept["id"])
        candidate = candidate_from_json(kept["candidate"])
        done = steps.run(
            drawings.sheet_step(position),
            partial(read_one, sheet_id, candidate),
            inputs=key(sheet=sheet_id),
        )
        if sheet_id not in read_here:  # kept by an earlier run: skipped here
            unwalked.append(candidate)
        # A kept step's words count too: a restart never says a limit the file already said.
        said = _messages(done.get("not_read_in_full", []))
        said_for_file.update(str(m["params"]["limit"]) for m in said)
        cut += said
        # A kept step's render time is spent too: a stop never hands the rest a fresh budget.
        render_left[0] -= float(cast(float, done.get("render_seconds", 0.0)))
    report = cast(dict[str, int], found.get("sheet_report", {}))
    return SheetsRead(len(recorded), tuple(cut), int(report.get(UNREADABLE_TEXT, 0)))


def _messages(kept: object) -> list[Message]:
    """A step's kept `not_read_in_full`, as Messages."""
    return [Message(code=m["code"], params=dict(m["params"])) for m in cast(list[dict[str, Any]], kept)]


def once[T](make: Callable[[], T]) -> Callable[[], T]:
    """`make()`, made at the first call and given again after."""
    made: list[T] = []

    def get() -> T:
        if not made:
            made.append(make())
        return made[0]

    return get


def _find(
    file_id: uuid.UUID, artefact: ReadArtefact, sheet_conventions: SheetConventions
) -> jobs.StepResult:
    view = drawings.file(file_id)
    found = finder.find(artefact, view.discipline, sheet_conventions)
    stamped = [replace(candidate, group=view.group) for candidate in found]
    candidates = [c for c in stamped if not _has_raw_codes(c)]
    report = {**found.budget.report(), UNREADABLE_TEXT: len(stamped) - len(candidates)}
    recorded = drawings.record_sheets(file_id, candidates, empty_layouts=report.get("layout_empty", 0))
    result: dict[str, Any] = {
        "sheet_report": report,
        "not_read_in_full": not_read_in_full(report, SHEETS_STEP_LIMITS),
        "sheets": [
            {"id": sr.id, "candidate": candidate_json(candidates[sr.ordinal - 1])} for sr in recorded
        ],
    }
    return result


def _has_raw_codes(candidate: SheetCandidate) -> bool:
    words = [getattr(candidate, name) for name in _SOURCED]
    texts = [w.value for w in words if w is not None]
    if candidate.exclusion is not None and candidate.exclusion.text:
        texts.append(candidate.exclusion.text)
    return any(code in text for text in texts for code in RAW_CODES)


def _read_sheet(
    sheet_id: uuid.UUID,
    candidate: SheetCandidate,
    artefact: ReadArtefact,
    view_conventions: ViewConventions,
    seen: dict[str, int],
    said_for_file: set[str],
    render_left: float = RENDER_SECONDS,
) -> jobs.StepResult:
    """`seen`: the view finder's limits as the last sheet read with this artefact left them;
    `said_for_file`: the view limits an earlier sheet's step already said (once for the file: the
    words are the file's; `view_report` says which sheets a limit cut)."""
    views = view_finder.find(artefact, candidate, view_conventions)
    kept = drawings.record_views(sheet_id, list(views))
    # The view finder's bounds are the file's, spent across its sheets: this sheet's cut is what
    # they left unread while reading it.
    now = dict(views.limits or {})
    cut = {
        VIEW_LIMIT.format(limit): max(0, now.get(limit, 0) - seen.get(limit, 0))
        for limit in view_finder.LIMITS
    }
    seen.clear()
    seen.update(now)
    started = time.monotonic()
    has_render = render_left > 0 and _render(sheet_id, artefact, candidate, render_left)
    render_seconds = time.monotonic() - started
    cut[RENDER_BUDGET] = int(not has_render and render_left <= 0)
    if candidate.number is None:
        drawings.record_plot(sheet_id, drawings.PlotNone.NO_NUMBER)
    result: dict[str, Any] = {
        "views": len(kept),
        "view_report": cut,
        "not_read_in_full": not_read_in_full(
            cut, [limit for limit in SHEET_STEP_LIMITS if limit not in said_for_file]
        ),
        "render": has_render,
        "render_seconds": render_seconds,
    }
    return result


def _render(
    sheet_id: uuid.UUID, artefact: ReadArtefact, candidate: SheetCandidate, seconds: float
) -> bool:
    """Keep the sheet's render; a sheet whose paper cannot be drawn (none, or larger than any
    sheet's) or whose render cannot be written has none, and its step says so (`render`)."""
    try:
        # Encoded here: a name the file holds that no text can carry (a lone surrogate the reader
        # kept from bytes it could not decode) fails the encoding, a ValueError, not the job.
        limits = replace(render.DEFAULT_LIMITS, seconds=min(render.DEFAULT_LIMITS.seconds, seconds))
        content = render.build(artefact, candidate, limits=limits).to_bytes()
    except ValueError:
        return False
    drawings.record_render(sheet_id, content)
    return True


def not_read_in_full(report: Mapping[str, int], limits: Sequence[str]) -> list[Message]:
    """`takeoff.read_file.not_read_in_full {limit}` once per limit above 0, in `limits`' order."""
    return [said.NOT_READ_IN_FULL(limit=limit) for limit in limits if report.get(limit, 0) > 0]


# A candidate kept in its step's result --------------------------------------------------------------


def candidate_json(candidate: SheetCandidate) -> dict[str, Any]:
    """A sheet candidate as JSON (`candidate_from_json` reads it back as it was)."""
    location = candidate.location
    exclusion = candidate.exclusion
    return {
        "location": {
            "layout": location.layout,
            "box": None if location.box is None else location.box.to_json(),
        },
        **{
            name: None if value is None else {"value": value.value, "source": str(value.source)}
            for name in _SOURCED
            for value in (getattr(candidate, name),)
        },
        "exclusion": None
        if exclusion is None
        else {"reason": str(exclusion.reason), "text": exclusion.text},
        "anchors": [anchor.to_json() for anchor in candidate.anchors],
        "group": candidate.group,
    }


def candidate_from_json(data: Mapping[str, Any]) -> SheetCandidate:
    location = data["location"]
    box = location["box"]
    exclusion = data["exclusion"]
    return SheetCandidate(
        location=SheetLocation(
            layout=location["layout"], box=None if box is None else Box.from_json(box)
        ),
        **{
            name: None
            if data[name] is None
            else Sourced(data[name]["value"], ValueSource(data[name]["source"]))
            for name in _SOURCED
        },
        exclusion=None
        if exclusion is None
        else Exclusion(ExclusionReason(exclusion["reason"]), exclusion["text"]),
        anchors=tuple(anchor_from_json(anchor) for anchor in data["anchors"]),
        group=data["group"],
    )
