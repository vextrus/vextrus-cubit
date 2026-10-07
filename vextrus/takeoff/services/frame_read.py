"""The frame read (S16-T1; docs/plans/M1.md C4, the session-16 contract's "takeoff T1"): the
registered families run on a Building's Step-1-confirmed views, and what they recognise is written as
Proposals with their ProposalTraces, for the QS to confirm at Steps 3, 4 and 6.

    found = frame_read.run(building_id)      # FrameReadResult(proposals=12, questions=1)
    # the job: vextrus.takeoff.tasks.frame_read.read_frame(building_id)

**The views read** are the confirmed views of the Building's printed sheets: a view whose Coverage
was confirmed by an act not undone (Step 1's `confirm`, `assign`), assigned or used, never one left
out or still proposed. Each is given to every family as a `ViewArtefact`: its file's kept
ReadArtefact and its view as Step 1 left it (its standing Takeoff Steps among them), so a family
reads only the views it wants. A sheet of no Building is the Building's when the Project has only it.

**Each candidate is one Proposal**, named by its family's step and its `candidate_key` within the
Building (`<building id>:<candidate_key>`; the families key a candidate by the view it was read on),
so a second run writes no duplicate: an open Proposal takes what the read found again (an anchor
not read before is added: Traces are append-only); one the QS decided is left as it stands, its
Traces too. Its `values` keep
the drawing units and the verbatim text (`{"value": "254", "unit": "mm", "text": ...}`, a decimal as
a string, never a float), with the candidate's `mark`, `storey`, `band` and `at`. Each fact's anchor
is a ProposalTrace, its sheet and view named (`sheet_id`, `view_id`) when the candidate names its view.

**A family that raises writes a Question, never silence**: `takeoff.frame.family_failed {family}`,
asked once per Building and family, while the other families still write (its own writes are rolled
back whole). A later run that reads it again withdraws the Question; one failing again reopens it.
A Question a family raises (`QuestionRaised`) is written as a Question of its step.

The registry is looked up when the job runs (`registry.families()`, never imported by name), so the
families are the ones registered then.
"""

import dataclasses
import enum
import hashlib
import importlib
import json
import logging
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from types import ModuleType, SimpleNamespace
from typing import Any

from django.db import transaction

from engine.messages import Message, MessageCode
from vextrus.drawings import services as drawings
from vextrus.platform.services import auth, tenancy
from vextrus.projects import services as projects
from vextrus.takeoff.models import (
    Coverage,
    CoverageStatus,
    Proposal,
    ProposalStatus,
    ProposalSubject,
    ProposalTrace,
    Question,
    QuestionKind,
    QuestionStatus,
)
from vextrus.takeoff.services import step1
from vextrus.takeoff.services.read_propose.proposals import view_candidate

log = logging.getLogger(__name__)

FAMILY_FAILED = MessageCode("takeoff.frame.family_failed", params=("family",))
"""A family raised on the Building's views: what it reads is not proposed until a run reads it."""

_SUBJECTS = uuid.UUID("6f1d3a52-2b8e-4c41-9d1a-5e0c7b4f8a10")
"""The namespace of a candidate's subject id (no Element exists until the QS confirms it)."""

_READ = (CoverageStatus.ASSIGNED, CoverageStatus.USED)


@dataclass(frozen=True)
class FrameReadResult:
    proposals: int
    """The Proposals this run wrote or found again."""
    questions: int
    """The Questions this run asked (or found asked): a family's failures and its own Questions."""


def run(building_id: uuid.UUID) -> FrameReadResult:
    """Run the registered families on the Building's confirmed views (see the module)."""
    project_id = _project_of(building_id)
    views = _views(project_id, building_id)
    if not views:
        return FrameReadResult(0, 0)
    types = importlib.import_module("engine.families.types")
    confirmed, setup, profile = types.ConfirmedFacts(), types.ProjectSetup(), _profile(types)
    views = _with_top_bound(views)
    proposed = asked = 0
    frame: Any = None
    with transaction.atomic():
        proposed += _propose_storeys(project_id, building_id, views)
        for family in _families():
            manifest = _part(family, "manifest", "MANIFEST")
            key, step = str(manifest.key), str(manifest.step)
            try:
                with transaction.atomic():
                    recognise = _part(family, "recognise", "recognise")
                    read = _read_by(step, views)
                    recognised, owner = _per_view(recognise, read, confirmed, setup, profile)
                    if key == "grid_line":
                        frame = _frame(recognise, read, confirmed, setup, profile)
                    placed = _placed(frame, recognised.candidates) if key != "grid_line" else {}
                    written = _propose(
                        project_id, building_id, key, step, recognised.candidates, owner, placed
                    )
                    raised = _raise(project_id, building_id, step, recognised.questions)
            except Exception:
                log.exception("the %s family failed on building %s", key, building_id)
                _ask_failed(project_id, building_id, key, step)
                asked += 1
                continue
            _withdraw_failed(project_id, building_id, key)
            _supersede_unread(project_id, building_id, step, recognised.candidates)
            confirmed = _with_best(types, confirmed, key, recognised.candidates)
            proposed += written
            asked += raised
    return FrameReadResult(proposed, asked)


def _with_best(types: ModuleType, confirmed: Any, family: str, candidates: Sequence[Any]) -> Any:
    """C5: each later family is given the earlier families' best candidates as confirmed facts (the
    column family places its columns on the grid read before it)."""
    facts = tuple(
        types.ElementFacts(
            family=family,
            element_id=str(c.candidate_key),
            mark=_text(getattr(c, "mark", "")),
            storey=_text(getattr(c, "storey", "")),
            values={str(k): _plain(v) for k, v in (c.values or {}).items()},
        )
        for c in candidates
    )
    return types.ConfirmedFacts(facts=(*confirmed.facts, *facts))


def _plain(value: Any) -> Any:
    """A candidate's value as a fact: its `.value`, a number as a Decimal."""
    held = getattr(value, "value", value)
    if isinstance(held, (int, float)) and not isinstance(held, bool):
        return Decimal(str(held))
    return held


def _supersede_unread(
    project_id: uuid.UUID, building_id: uuid.UUID, step: str, candidates: Sequence[Any]
) -> None:
    """An open Proposal of the step that this read no longer proposes is superseded (a later read
    replaces the earlier one's); one the QS decided is left as it is."""
    keys = {f"{building_id}:{c.candidate_key}" for c in candidates}
    Proposal.objects.filter(
        project_id=project_id,
        step=step,
        status=ProposalStatus.OPEN,
        candidate_key__startswith=f"{building_id}:",
    ).exclude(candidate_key__in=keys).update(status=ProposalStatus.SUPERSEDED)


def _families() -> tuple[ModuleType, ...]:
    return tuple(importlib.import_module("engine.families.registry").families())


def _part(family: ModuleType, module: str, name: str) -> Any:
    """A family's `name` from its package's `module` (`<family>.manifest`'s MANIFEST, `<family>.
    recognise`'s recognise), or held by the family module itself (as a test's fake holds it)."""
    found = getattr(family, name, None)
    if found is None or isinstance(found, ModuleType):
        found = getattr(importlib.import_module(f"{family.__name__}.{module}"), name)
    return found


def _profile(types: ModuleType) -> Any:
    """The Drafting Profile's parts the families read (none kept yet in the slice: the default)."""
    return types.ProfileParts()


def _tenant() -> uuid.UUID:
    found = tenancy.current_tenant_id()
    if found is None:
        raise auth.NotFound
    return found


def _project_of(building_id: uuid.UUID) -> uuid.UUID:
    """The Building's Project, among those the acting Membership may open; else NotFound."""
    _tenant()
    for project in projects.list():
        if any(b.id == building_id for b in projects.buildings(project.id)):
            return project.id
    raise auth.NotFound


# The views read ---------------------------------------------------------------------------------------


def _views(project_id: uuid.UUID, building_id: uuid.UUID) -> list[Any]:
    """The Building's confirmed views, each a ViewArtefact, in sheet and reading order."""
    drawing_set = drawings.set_of(project_id)
    if drawing_set is None:
        return []
    alone = len(projects.buildings(project_id)) == 1
    sheets = [
        s
        for s in drawings.sheets(drawing_set.id, anchors=False)
        if s.building_id == building_id or (s.building_id is None and alone)
    ]
    rows = list(
        Coverage.objects.select_related("confirmation").filter(
            project_id=project_id,
            drawing_set_state_id=None,
            sheet_revision_id__in=[s.id for s in sheets],
            status__in=_READ,
            confirmation__isnull=False,
            confirmation__undone_at__isnull=True,
        )
    )
    if not rows:
        return []
    deciding = {s.id: s.confirmation_id for s in sheets}
    standing = step1._steps_standing(rows, deciding)
    confirmed = {r.view_id: r for r in rows}
    viewed = drawings.views_of_set(drawing_set.id, anchors=True)
    types = importlib.import_module("engine.families.types")
    artefacts: dict[uuid.UUID, Any] = {}
    found = []
    for sheet in sheets:
        for view in viewed.get(sheet.id, []):
            row = confirmed.get(view.id)
            if row is None:
                continue
            if sheet.file_id not in artefacts:
                artefacts[sheet.file_id] = drawings.artefact(sheet.file_id)
            steps = tuple(s.step for s in standing.get(row.id, []))
            found.append(
                types.ViewArtefact(
                    view_id=str(view.id),
                    sheet_id=str(sheet.id),
                    artefact=artefacts[sheet.file_id],
                    view=_candidate_of(view, steps),
                )
            )
    return found


# The steps whose plans a family's step reads: a family reads the plan views Step 1 gave its own step;
# the grid is drawn on the plans of the steps that need it (C9: columns need the grid), and Step 1
# gives no view to the grid step itself.
_READS_PLANS_OF: dict[str, tuple[str, ...]] = {"grid": ("grid", "columns")}


_STOREY_RANK = {
    "pile": 0, "pile_cap": 1, "foundation": 2, "lower_ground": 150, "plinth": 160, "ground": 200,
    "mezzanine": 210, "podium": 220, "typical": 500, "top": 900, "roof": 1000,
}  # fmt: skip
"""The canonical storeys' order (engine.recognise.storeys' ranks; `floor_<n>` at 300 + n, `basement_<n>`
at 100 - n; `top` as read, bound to a floor by the QS in Step 3)."""


def _storey_rank(name: str) -> int:
    if name in _STOREY_RANK:
        return _STOREY_RANK[name]
    stem, _, number = name.rpartition("_")
    if number.isdigit() and stem == "floor":
        return 300 + int(number)
    if number.isdigit() and stem == "basement":
        return 100 - int(number)
    return 800


def _propose_storeys(project_id: uuid.UUID, building_id: uuid.UUID, views: Sequence[Any]) -> int:
    """Step 3's Proposals: one storey per storey the confirmed plan views name, low to high
    (idempotent: an open one is left as it is; levels are the QS's to type)."""
    plans = [v for v in views if str(v.view.kind) == "plan"]
    names = {str(n) for v in plans for n in (v.view.storeys or ()) if n != "not_stated"}
    tenant_id = _tenant()
    for order, name in enumerate(sorted(names, key=lambda n: (_storey_rank(n), n)), start=1):
        key = f"{building_id}:storey:{name}"
        row = Proposal.objects.filter(
            tenant_id=tenant_id, project_id=project_id, step="storeys", candidate_key=key
        ).first()
        if row is None:
            Proposal.objects.create(
                tenant_id=tenant_id,
                project_id=project_id,
                step="storeys",
                candidate_key=key,
                subject=ProposalSubject.ELEMENT,
                subject_id=uuid.uuid5(_SUBJECTS, f"{project_id}:storeys:{key}"),
                family_key="storey",
                values={"name": name, "order": order},
                source="reader",
            )
    return len(names)


def _with_top_bound(views: Sequence[Any]) -> list[Any]:
    """A plan view naming "top" ("1st to top") is read on every floor up to the highest floor any
    plan names (the top floor); the QS sees and corrects the storeys in Step 3."""
    floors = [
        int(n.rpartition("_")[2])
        for v in views
        for n in (getattr(v.view, "storeys", ()) or ())
        if n.startswith("floor_") and n.rpartition("_")[2].isdigit()
    ]
    if not floors:
        return list(views)
    top = max(floors)
    bound = []
    for v in views:
        named = tuple(getattr(v.view, "storeys", ()) or ())
        if "top" not in named:
            bound.append(v)
            continue
        own = [int(n[6:]) for n in named if n.startswith("floor_") and n[6:].isdigit()]
        start = min(own) if own else 1
        listed = tuple(n for n in named if n != "top" and not n.startswith("floor_"))
        floors_up = tuple(f"floor_{k}" for k in range(start, top + 1))
        bound.append(
            dataclasses.replace(v, view=dataclasses.replace(v.view, storeys=listed + floors_up))
        )
    return bound


def _per_view(
    recognise: Any, views: Sequence[Any], confirmed: Any, setup: Any, profile: Any
) -> tuple[Any, dict[str, Any]]:
    """The family read view by view, so each candidate keeps the view (and sheet) it was read on."""
    candidates: list[Any] = []
    questions: list[Any] = []
    owner: dict[str, Any] = {}
    for view in views:
        found = recognise([view], confirmed, setup, profile)
        candidates.extend(found.candidates)
        questions.extend(q for q in found.questions if repr(q) not in {repr(x) for x in questions})
        for c in found.candidates:
            owner.setdefault(str(c.candidate_key), view)
    return SimpleNamespace(candidates=tuple(candidates), questions=tuple(questions)), owner


def _frame(recognise: Any, views: Sequence[Any], confirmed: Any, setup: Any, profile: Any) -> Any:
    """The grid registered across the plans (R1's frame), read view by view."""
    register = importlib.import_module("engine.families.grid_line.frame").register
    return register(
        {str(v.view_id): recognise([v], confirmed, setup, profile).candidates for v in views}
    )


def _placed(frame: Any, candidates: Sequence[Any]) -> dict[str, tuple[str, str]]:
    """Each candidate's place in the registered grid frame (drawing units): its grid point plus its
    offset from it; none without a frame or a grid reference."""
    placed: dict[str, tuple[str, str]] = {}
    if frame is None:
        return placed
    for c in candidates:
        at = getattr(c, "at", None)
        if not isinstance(at, (list, tuple)) or len(at) < 3:
            continue
        try:
            x, y = frame.point(str(at[0]))
            placed[str(c.candidate_key)] = (
                str(x + Decimal(str(at[1]))),
                str(y + Decimal(str(at[2]))),
            )
        except ValueError, KeyError, InvalidOperation, TypeError:
            continue
    return placed


def _read_by(step: str, views: Sequence[Any]) -> list[Any]:
    """The views a family of `step` reads: plan views whose standing steps meet the steps it reads."""
    reads = set(_READS_PLANS_OF.get(step, (step,)))
    return [v for v in views if str(v.view.kind) == "plan" and reads & set(v.view.steps)]


def _candidate_of(view: drawings.ViewView, steps: tuple[str, ...]) -> Any:
    """The view as Step 1 left it: its kind as confirmed and its standing Takeoff Steps."""
    read = view_candidate(view)
    kind = view.confirmed_kind or view.kind
    anchors = tuple(stored.anchor() for stored in view.anchors)
    return dataclasses.replace(read, kind=type(read.kind)(kind), steps=steps, anchors=anchors)


# What the families found -------------------------------------------------------------------------------


def _propose(
    project_id: uuid.UUID,
    building_id: uuid.UUID,
    family: str,
    step: str,
    candidates: Sequence[Any],
    views: Mapping[str, Any],
    placed: Mapping[str, tuple[str, str]] | None = None,
) -> int:
    """Each candidate as one Proposal with its Traces, named by its step and its key within the
    Building (idempotent): an open Proposal takes the read again; one the QS decided is left as it
    is, its evidence with it."""
    tenant_id = _tenant()
    for candidate in candidates:
        key = f"{building_id}:{candidate.candidate_key}"
        values = {
            "mark": _text(getattr(candidate, "mark", "")),
            "storey": _text(getattr(candidate, "storey", "")),
            "band": _text(getattr(candidate, "band", "")),
            "at": _json(getattr(candidate, "at", None)),
            **{str(fact): _json(value) for fact, value in (candidate.values or {}).items()},
        }
        if str(candidate.candidate_key) in (placed or {}):
            values["x"], values["y"] = (placed or {})[str(candidate.candidate_key)]
        read = {
            "values": values,
            "source": _text(getattr(candidate, "source", "reader"))[:32] or "reader",
            "confidence": _confidence(getattr(candidate, "confidence", None)),
            "candidate_geometry": _json(getattr(candidate, "geometry", None)),
        }
        row = (
            Proposal.objects.select_for_update()
            .filter(tenant_id=tenant_id, project_id=project_id, step=step, candidate_key=key)
            .first()
        )
        if row is None:
            row = Proposal.objects.create(
                tenant_id=tenant_id,
                project_id=project_id,
                step=step,
                candidate_key=key,
                subject=ProposalSubject.ELEMENT,
                subject_id=uuid.uuid5(_SUBJECTS, f"{project_id}:{step}:{key}"),
                family_key=family,
                **read,
            )
        elif row.status == ProposalStatus.OPEN:
            for name, value in read.items():
                setattr(row, name, value)
            row.save(update_fields=list(read))
        else:
            continue
        _trace(row, candidate, views.get(str(candidate.candidate_key)) or _view_of(candidate, views))
    return len(candidates)


def _trace(proposal: Proposal, candidate: Any, view: Any) -> None:
    """Each fact's anchor as a Trace, its sheet and view named when known. Traces are append-only (the
    app may neither change nor delete one): an anchor read before stays as the Proposal's history."""
    where = {
        "sheet_id": str(view.sheet_id) if view is not None else None,
        "view_id": str(view.view_id) if view is not None else None,
    }
    for fact, given in (getattr(candidate, "anchors", None) or {}).items():
        anchors = given if isinstance(given, (list, tuple)) else (given,)
        for anchor in anchors:
            ProposalTrace.objects.get_or_create(
                tenant_id=proposal.tenant_id,
                project_id=proposal.project_id,
                proposal=proposal,
                fact=str(fact)[:64],
                anchor={**_anchor(anchor), **where},
            )


def _view_of(candidate: Any, views: Mapping[str, Any]) -> Any:
    """The view a candidate was read on: the one it names, else the only one given, else None."""
    named = getattr(candidate, "view_id", None)
    if named is not None:
        return views.get(str(named))
    if len(views) == 1:
        return next(iter(views.values()))
    key = str(candidate.candidate_key)
    found = [v for vid, v in views.items() if vid in key]
    return found[0] if len(found) == 1 else None


def _raise(project_id: uuid.UUID, building_id: uuid.UUID, step: str, questions: Sequence[Any]) -> int:
    """Each Question a family raised, asked once per Building and words; an open one of the step that
    this read no longer raises is withdrawn (a later read replaces the earlier one's Questions)."""
    asked: set[str] = set()
    for question in questions:
        message = _message(question)
        kind = str(getattr(question, "kind", "") or QuestionKind.MISSING)
        _ask(
            project_id,
            building_id,
            step,
            message,
            kind=kind if kind in QuestionKind.values else QuestionKind.MISSING,
            key=_key("raised", building_id, step, message, getattr(question, "candidate_key", "")),
        )
        asked.add(_key("raised", building_id, step, message, getattr(question, "candidate_key", "")))
    Question.objects.filter(
        project_id=project_id,
        building_id=building_id,
        step=step,
        status=QuestionStatus.OPEN,
        message_code__startswith="engine.",
    ).exclude(question_key__in=asked).update(status=QuestionStatus.WITHDRAWN)
    return len(questions)


def _message(question: Any) -> Message:
    found = getattr(question, "message", None)
    if isinstance(found, Mapping):
        return {"code": str(found["code"]), "params": _json(dict(found.get("params", {})))}
    params = getattr(question, "params", None) or {}
    return {"code": str(question.code), "params": _json(dict(params))}


def _ask_failed(project_id: uuid.UUID, building_id: uuid.UUID, family: str, step: str) -> None:
    """The family's failure as its one Question: asked again if a past run withdrew it."""
    key = _key(FAMILY_FAILED.code, building_id, family)
    row = _ask(project_id, building_id, step, FAMILY_FAILED(family=family), QuestionKind.MISSING, key)
    if row.status == QuestionStatus.WITHDRAWN and row.withdrawn_by_id is None:
        row.status = QuestionStatus.OPEN
        row.save(update_fields=["status"])


def _withdraw_failed(project_id: uuid.UUID, building_id: uuid.UUID, family: str) -> None:
    """The family read again: its failure, while still open, is withdrawn (never one answered)."""
    Question.objects.filter(
        project_id=project_id,
        question_key=_key(FAMILY_FAILED.code, building_id, family),
        status=QuestionStatus.OPEN,
    ).update(status=QuestionStatus.WITHDRAWN)


def _ask(
    project_id: uuid.UUID,
    building_id: uuid.UUID,
    step: str,
    message: Message,
    kind: str,
    key: str,
) -> Question:
    row, _made = Question.objects.get_or_create(
        tenant_id=_tenant(),
        project_id=project_id,
        question_key=key,
        defaults={
            "step": step,
            "building_id": building_id,
            "kind": kind,
            "message_code": message["code"],
            "params": dict(message["params"]),
        },
    )
    return row


def _key(*parts: object) -> str:
    identity = json.dumps([_json(p) for p in parts], sort_keys=True, default=str)
    return hashlib.sha256(identity.encode()).hexdigest()


# As JSON: drawing units and verbatim text kept --------------------------------------------------------


def _json(value: Any) -> Any:
    """A family's value as JSON: a decimal as its plain string (never a float), a fact's value
    object (`value`, `unit`, `text`) or any dataclass as an object, an enum as its value."""
    if value is None or isinstance(value, (bool, str, int)):
        return value
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, float):
        return format(Decimal(repr(value)), "f")
    if isinstance(value, enum.Enum):
        return _json(value.value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if hasattr(value, "to_json"):  # an anchor: its own JSON (its kind among it)
        return _json(value.to_json())
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: _json(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, Mapping):
        return {str(k): _json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_json(v) for v in value]
    if hasattr(value, "value"):
        held = ("value", "unit", "text")
        return {name: _json(getattr(value, name)) for name in held if hasattr(value, name)}
    return str(value)


def _anchor(anchor: Any) -> dict[str, Any]:
    found = _json(anchor)
    return found if isinstance(found, dict) else {"anchor": found}


def _text(value: Any) -> str:
    return "" if value is None else str(_json(value))


def _confidence(value: Any) -> Decimal | None:
    if value is None:
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.0001"))
    except InvalidOperation:
        return None
