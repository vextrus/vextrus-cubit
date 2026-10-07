"""Steps 3, 4 and 6 (storeys, grid, columns): the read, the lists and the QS's acts (ticket S16-T2;
session 16's contract; M1.md C9, C17).

The read job (T1's `vextrus.takeoff.tasks.frame_read.read_frame`) leaves Proposals with
`step` one of `storeys`, `grid` or `columns`, their values in drawing units with the text as read.
Nothing here reaches the Live Model but the QS's acts: each act is one Confirmation, one DomainEvent
and one call of `live_model.services.apply` with the confirmed Elements' changes, in SI metres
(a Proposal not confirmed never becomes a change). The seams of `live_model` are looked up on the
module at call time (the contract's seam 2), so a test or a later ticket may replace them.

A storey is a Proposal of step `storeys` and family `storey`; its typed level is kept in its values
(`level_m`, `level_basis: "typed"`). A view put on storeys is a Proposal of step `storeys`, family
`view_placement`, about the view; neither is ever counted as an Element.
"""

import dataclasses
import uuid
from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from importlib import import_module
from typing import Any

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from vextrus import live_model
from vextrus.platform.ids import new_id
from vextrus.platform.services import auth, events, tenancy
from vextrus.projects import services as projects
from vextrus.takeoff.messages import frame as said
from vextrus.takeoff.models import (
    Confirmation,
    ConfirmationKind,
    Coverage,
    Proposal,
    ProposalStatus,
    ProposalSubject,
    ProposalTrace,
    Question,
    QuestionLink,
    QuestionStatus,
)

STOREYS = "storeys"
GRID = "grid"
COLUMNS = "columns"
STEPS = (STOREYS, GRID, COLUMNS)
"""The frame's Takeoff Steps, in their order (ADR 0007): Steps 3, 4 and 6."""

FAMILY_OF = {STOREYS: "storey", GRID: "grid_line", COLUMNS: "column"}
PLACEMENT = "view_placement"
"""The family key of a view put on storeys (never an Element)."""

READ_TASK = "vextrus.takeoff.tasks.frame_read"
"""T1's read job, imported at call time by its path."""

SIZE_NOT_READ = "engine.column.size_not_read"
TYPED = "typed"
DEFAULT = "default"

TO_METRES = {
    "mm": Decimal("0.001"),
    "cm": Decimal("0.01"),
    "m": Decimal("1"),
    "in": Decimal("0.0254"),
    "ft": Decimal("0.3048"),
}
"""A typed or drawn length's unit to metres (the drawing unit is `mm` unless the values say)."""

DRAWING_UNIT = "mm"
DECIDED = (ProposalStatus.REJECTED, ProposalStatus.SUPERSEDED)
"""Statuses that leave a Proposal out of N."""


class Act:
    CONFIRM = "confirm"
    EXCLUDE = "exclude"
    EDIT = "edit"
    UNCONFIRM = "unconfirm"
    ALL = (CONFIRM, EXCLUDE, EDIT, UNCONFIRM)


@dataclass(frozen=True)
class StepRow:
    step: str
    status: str
    n: int
    N: int
    open_questions: int


@dataclass(frozen=True)
class TraceRow:
    fact: str
    sheet_id: str | None
    view_id: str | None
    anchor: dict[str, Any]


@dataclass(frozen=True)
class ProposalRow:
    id: uuid.UUID
    family: str
    mark: str
    storey: str | None
    values: dict[str, Any]
    state: str
    questions: list[dict[str, Any]]
    trace: list[TraceRow]


@dataclass(frozen=True)
class Group:
    key: str
    label: str
    proposals: list[ProposalRow]


@dataclass(frozen=True)
class StoreyRow:
    id: uuid.UUID
    name: str
    order: int
    level_m: str | None
    height_m: str | None
    level_basis: str


@dataclass(frozen=True)
class PlacementRow:
    view_id: uuid.UUID
    sheet_number: str
    storeys: list[uuid.UUID]


@dataclass(frozen=True)
class StoreyList:
    storeys: list[StoreyRow]
    view_placements: list[PlacementRow]


@dataclass(frozen=True)
class ActDone:
    confirmation_id: uuid.UUID
    model_version_seq: int | None
    figures_changed: bool


@dataclass(frozen=True)
class PrimitiveRow:
    kind: str
    polygon: list[list[str]]
    z0: str
    z1: str


@dataclass(frozen=True)
class ElementPrimitivesRow:
    element_id: uuid.UUID
    family: str
    storey: str | None
    part: str
    state: str
    primitives: list[PrimitiveRow] = field(default_factory=list)


@dataclass(frozen=True)
class _StateChange:
    """The seam's StateChange (session 16's seam 3), used only while `live_model.services` has none."""

    family: str
    identity_key: str
    mark: str
    grid_ref: str
    attrs: dict[str, str]
    trace: list[dict[str, Any]]


def _live() -> Any:
    """`live_model.services`, looked up at call time (its seams may be replaced)."""
    return import_module(f"{live_model.__name__}.services")


# Common ------------------------------------------------------------------------------------------


def _tenant() -> uuid.UUID:
    found = tenancy.current_tenant_id()
    if found is None:
        raise auth.NotFound
    return found


def _user() -> uuid.UUID:
    user_id = tenancy.current().user_id
    if user_id is None:
        raise auth.NotSignedIn
    return user_id


def _step(step: str) -> str:
    if step not in STEPS:
        raise auth.Refused(said.STEP_UNKNOWN(), status=400)
    return step


def _buildings(project_id: uuid.UUID) -> list[Any]:
    """The Project's Buildings; a Project the acting Developer cannot read (another Developer's,
    whatever the Membership's scope says) is the one 404."""
    try:
        return list(projects.buildings(project_id))
    except projects.ProjectNotFound:
        raise auth.NotFound from None


def building_of(project_id: uuid.UUID) -> uuid.UUID:
    """The Project's first Building (one in M1's slice): the Model the acts change."""
    found = _buildings(project_id)
    if not found:
        raise auth.Refused(said.NO_BUILDING(), status=409)
    return uuid.UUID(str(found[0].id))


def _decimal(value: object) -> Decimal:
    """A typed or read number: a decimal string or number, else a 400."""
    if isinstance(value, bool) or value is None:
        raise auth.Refused(said.NOT_A_NUMBER(), status=400)
    try:
        number = Decimal(str(value).strip())
    except InvalidOperation:
        raise auth.Refused(said.NOT_A_NUMBER(), status=400) from None
    if not number.is_finite():
        raise auth.Refused(said.NOT_A_NUMBER(), status=400)
    return number


def _plain(number: Decimal) -> str:
    """A decimal as a plain string, its trailing zeros dropped ("0.254", never "2.54E-1")."""
    text = format(number.normalize(), "f")
    return "0" if text in ("-0", "") else text


def _fact(values: Mapping[str, Any], name: str) -> tuple[object, str | None]:
    """A fact's value and unit, whether held plainly or as `{value, unit, text}` (C4's FactValue)."""
    raw = values.get(name)
    if isinstance(raw, Mapping):
        unit = raw.get("unit")
        return raw.get("value"), str(unit) if unit else None
    return raw, None


def _metres(values: Mapping[str, Any], name: str) -> str | None:
    """A length fact in metres, from the drawing unit (or the fact's own, or the values' `unit`)."""
    raw, unit = _fact(values, name)
    if raw is None or raw == "":
        return None
    try:
        number = Decimal(str(raw).strip())
    except InvalidOperation:
        return None
    scale = TO_METRES.get(unit or str(values.get("unit") or DRAWING_UNIT))
    if scale is None or not number.is_finite():
        return None
    return _plain(number * scale)


def _centre_m(geometry: Any, values: Mapping[str, Any]) -> dict[str, str]:
    """The column's place in metres (`x_m`, `y_m`): its read outline's centre, in the unit its size
    was read in; none when the outline is not a list of points."""
    _raw, unit = _fact(values, "section_b")
    scale = TO_METRES.get(unit or str(values.get("unit") or DRAWING_UNIT))
    if values.get("x") is not None and values.get("y") is not None:
        geometry = [(values["x"], values["y"])]  # its place in the registered grid frame
    try:
        points = [(Decimal(str(x)), Decimal(str(y))) for x, y in geometry]
    except TypeError, ValueError, InvalidOperation:
        return {}
    if not points or scale is None:
        return {}
    x = sum((p[0] for p in points), Decimal(0)) / len(points) * scale
    y = sum((p[1] for p in points), Decimal(0)) / len(points) * scale
    return {"x_m": _plain(x.quantize(Decimal("0.001"))), "y_m": _plain(y.quantize(Decimal("0.001")))}


def _grid_ref(values: Mapping[str, Any]) -> str:
    at = values.get("at")
    if isinstance(at, Mapping):
        return str(at.get("ref") or at.get("grid_ref") or "")
    return str(at or values.get("grid_ref") or "")


def _of_project(project_id: uuid.UUID) -> Any:
    return Proposal.objects.filter(project_id=project_id)


# Reading ------------------------------------------------------------------------------------------


def steps(project_id: uuid.UUID) -> list[StepRow]:
    """Steps 3, 4 and 6: their status, n of N (the step's Elements confirmed of those proposed and
    not excluded) and their open Questions; a few queries, whatever the count."""
    _buildings(project_id)
    counts: dict[tuple[str, str], int] = defaultdict(int)
    rows = (
        _of_project(project_id)
        .filter(step__in=STEPS)
        .exclude(family_key=PLACEMENT)
        .values_list("step", "status")
    )
    for step, status in rows.iterator():
        counts[(step, status)] += 1
    asked: dict[str, int] = defaultdict(int)
    for step in (
        Question.objects.filter(project_id=project_id, step__in=STEPS, status=QuestionStatus.OPEN)
        .values_list("step", flat=True)
        .iterator()
    ):
        asked[step] += 1
    found = []
    for step in STEPS:
        total = sum(c for (s, status), c in counts.items() if s == step and status not in DECIDED)
        confirmed = counts[(step, ProposalStatus.CONFIRMED)]
        if total == 0:
            status = "not_started"
        elif confirmed == total and not asked[step]:
            status = "confirmed"
        else:
            status = "in_review"
        found.append(StepRow(step, status, confirmed, total, asked[step]))
    return found


def _questions_by_proposal(
    project_id: uuid.UUID, ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[uuid.UUID]]:
    """The open Questions about each Proposal: by `subject_id`, or holding it through a link."""
    wanted = list(ids)
    held: dict[uuid.UUID, list[uuid.UUID]] = defaultdict(list)
    if not wanted:
        return held
    for question_id, subject_id in Question.objects.filter(
        project_id=project_id, subject_id__in=wanted, status=QuestionStatus.OPEN
    ).values_list("id", "subject_id"):
        if subject_id is not None:
            held[subject_id].append(question_id)
    for question_id, proposal_id in QuestionLink.objects.filter(
        project_id=project_id,
        proposal_id__in=wanted,
        question__status=QuestionStatus.OPEN,
    ).values_list("question_id", "proposal_id"):
        if question_id not in held[proposal_id]:
            held[proposal_id].append(question_id)
    return held


def _state(proposal: Proposal, questions: Sequence[uuid.UUID]) -> str:
    if proposal.status == ProposalStatus.CONFIRMED:
        return "confirmed"
    if proposal.status == ProposalStatus.REJECTED:
        return "excluded"
    if proposal.status == ProposalStatus.SUPERSEDED:
        return "superseded"
    if questions or proposal.status in (ProposalStatus.HELD, ProposalStatus.BLOCKED):
        return "held"
    return "proposed"


def _group_key(group: str, proposal: Proposal) -> tuple[str, str]:
    """The group a Proposal falls in: `mark:<mark>` or `band:<band or storey>`, and its label."""
    values = proposal.values or {}
    if group == "band":
        band = str(values.get("band") or values.get("storey") or "")
        return f"band:{band}", band
    mark = str(values.get("mark") or "")
    return f"mark:{mark}", mark


def proposals(project_id: uuid.UUID, step: str, group: str = "mark") -> list[Group]:
    """A step's Proposals (superseded ones left out), grouped by mark or by band, each with its
    state, open Questions and Trace."""
    _step(step)
    _buildings(project_id)
    group = "band" if group == "band" else "mark"
    found = list(
        _of_project(project_id)
        .filter(step=step)
        .exclude(family_key=PLACEMENT)
        .exclude(status=ProposalStatus.SUPERSEDED)
        .order_by("created_at", "id")
    )
    ids = [p.id for p in found]
    held = _questions_by_proposal(project_id, ids)
    traces: dict[uuid.UUID, list[TraceRow]] = defaultdict(list)
    for proposal_id, fact, anchor in ProposalTrace.objects.filter(
        project_id=project_id, proposal_id__in=ids
    ).values_list("proposal_id", "fact", "anchor"):
        anchor = dict(anchor or {})
        sheet, view = anchor.get("sheet_id"), anchor.get("view_id")
        traces[proposal_id].append(
            TraceRow(fact, str(sheet) if sheet else None, str(view) if view else None, anchor)
        )
    groups: dict[str, Group] = {}
    for proposal in found:
        key, label = _group_key(group, proposal)
        values = dict(proposal.values or {})
        storey = values.get("storey")
        row = ProposalRow(
            id=proposal.id,
            family=proposal.family_key,
            mark=str(values.get("mark") or ""),
            storey=None if storey is None else str(storey),
            values=values,
            state=_state(proposal, held[proposal.id]),
            questions=[{"id": str(q)} for q in held[proposal.id]],
            trace=traces[proposal.id],
        )
        groups.setdefault(key, Group(key, label, [])).proposals.append(row)
    return sorted(groups.values(), key=lambda g: _natural(g.label))


def _natural(text: str) -> tuple[Any, ...]:
    """Natural order: "C2" before "C10"."""
    parts: list[Any] = []
    digits = ""
    letters = ""
    for char in text:
        if char.isdigit():
            if letters:
                parts.append((1, letters))
                letters = ""
            digits += char
        else:
            if digits:
                parts.append((0, int(digits)))
                digits = ""
            letters += char
    if digits:
        parts.append((0, int(digits)))
    if letters:
        parts.append((1, letters))
    return tuple(parts)


def _storey_proposals(project_id: uuid.UUID) -> list[Proposal]:
    found = list(
        _of_project(project_id)
        .filter(step=STOREYS, family_key=FAMILY_OF[STOREYS])
        .exclude(status__in=DECIDED)
    )
    return sorted(found, key=lambda p: (_order(p), str((p.values or {}).get("name") or ""), str(p.id)))


def _order(proposal: Proposal) -> int:
    try:
        return int((proposal.values or {}).get("order") or 0)
    except TypeError, ValueError:
        return 0


def _level(values: Mapping[str, Any]) -> str | None:
    raw = values.get("level_m")
    if raw is None or raw == "":
        return None
    try:
        return _plain(Decimal(str(raw)))
    except InvalidOperation:
        return None


def storeys(project_id: uuid.UUID) -> StoreyList:
    """The storeys by order, each with its level (typed, else read, else none) and its height (the
    next storey's level less its own, else as read), and the views put on them."""
    _buildings(project_id)
    found = _storey_proposals(project_id)
    levels = [_level(p.values or {}) for p in found]
    rows = []
    for index, proposal in enumerate(found):
        values = proposal.values or {}
        level = levels[index]
        following = levels[index + 1] if index + 1 < len(levels) else None
        if level is not None and following is not None:
            height: str | None = _plain(Decimal(following) - Decimal(level))
        else:
            height = _level({"level_m": values.get("height_m")})
        rows.append(
            StoreyRow(
                id=proposal.id,
                name=str(values.get("name") or ""),
                order=_order(proposal),
                level_m=level,
                height_m=height,
                level_basis=TYPED if values.get("level_basis") == TYPED else DEFAULT,
            )
        )
    placements = [
        PlacementRow(
            view_id=p.subject_id,
            sheet_number=str((p.values or {}).get("sheet_number") or ""),
            storeys=[uuid.UUID(s) for s in (p.values or {}).get("storey_ids", [])],
        )
        for p in _of_project(project_id)
        .filter(step=STOREYS, family_key=PLACEMENT)
        .order_by("created_at", "id")
    ]
    return StoreyList(rows, placements)


# The QS's acts ------------------------------------------------------------------------------------


def _chosen(
    project_id: uuid.UUID, step: str, proposal_ids: Sequence[uuid.UUID], group_key: str | None
) -> list[Proposal]:
    """The act's Proposals of this Project and step: by id (one not of them is the one 404), or by
    a group key of `proposals`' groups."""
    family_q = ~Q(family_key=PLACEMENT)
    if proposal_ids:
        wanted = set(proposal_ids)
        found = list(
            _of_project(project_id).filter(family_q, step=step, id__in=wanted).select_for_update()
        )
        if len(found) != len(wanted):
            raise auth.NotFound
        return found
    if group_key:
        kind = "band" if group_key.startswith("band:") else "mark"
        candidates = (
            _of_project(project_id)
            .filter(family_q, step=step)
            .exclude(status__in=DECIDED)
            .select_for_update()
        )
        found = [p for p in candidates if _group_key(kind, p)[0] == group_key]
        if found:
            return found
    raise auth.Refused(said.NOTHING_CHOSEN(), status=400)


def _storey_names(project_id: uuid.UUID) -> dict[str, str]:
    """Each storey's key as a column's values may name it (its id or name) to its identity name."""
    named: dict[str, str] = {}
    for proposal in _storey_proposals(project_id):
        name = str((proposal.values or {}).get("name") or proposal.id)
        named[str(proposal.id)] = name
        named[name] = name
    return named


def _identity_name(text: str) -> str:
    return "_".join(text.lower().split()) or "-"


def _trace_of(rows: Iterable[tuple[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"fact": fact, "kind": "sheet_entity", "anchor": dict(anchor or {})} for fact, anchor in rows
    ]


def _change(
    proposal: Proposal,
    storey_names: Mapping[str, str],
    traces: Mapping[uuid.UUID, list[tuple[str, Any]]],
    *,
    withdrawn: bool = False,
    heights: Mapping[str, str | None] | None = None,
    placed: Mapping[str, Any] | None = None,
) -> Any:
    """The StateChange of one Proposal for `apply`: the family's attributes in SI metres (C8), its
    identity key (C7: `<family>|<grid ref>|<storey>`) and its Trace. A withdrawn Element (unconfirmed,
    or excluded once confirmed) is its change with no attributes."""
    values = proposal.values or {}
    family = proposal.family_key
    storey = values.get("storey")
    storey_name = _identity_name(storey_names.get(str(storey), str(storey or ""))) if storey else "-"
    grid_ref = _grid_ref(values)
    mark = str(values.get("mark") or values.get("name") or "")
    attrs: dict[str, str] = {}
    if family == FAMILY_OF[COLUMNS]:
        for fact in ("section_b", "section_d", "diameter"):
            metres = _metres(values, fact)
            if metres is not None:
                attrs[f"vx.column.{fact}"] = metres
        attrs.update(_centre_m(proposal.candidate_geometry, values))
        place = grid_ref or mark
    elif family == FAMILY_OF[STOREYS]:
        level = _level(values)
        if level is not None:
            attrs["vx.storey.slab_level"] = level
        attrs["vx.storey.index"] = str(_order(proposal))
        height = _level({"level_m": values.get("height_m")}) or (heights or {}).get(str(proposal.id))
        if height is not None:
            attrs["vx.storey.height"] = height
        place = _identity_name(str(values.get("name") or mark))
        storey_name = place
    else:
        place = mark or str(proposal.candidate_key)
    make = getattr(_live(), "StateChange", _StateChange)
    change = make(
        family=family,
        identity_key=f"{family}|{place}|{storey_name}",
        mark=mark,
        grid_ref=grid_ref,
        attrs={} if withdrawn else attrs,
        trace=[] if withdrawn else _trace_of(traces.get(proposal.id, [])),
    )
    storey_id = (placed or {}).get(storey_name) if family != FAMILY_OF[STOREYS] else None
    if storey_id is not None and hasattr(change, "storey_id"):
        change = dataclasses.replace(change, storey_id=storey_id)
    return change


def _once(changes: Sequence[Any]) -> list[Any]:
    """One change per identity: an Element read on several views (a grid line on each column plan)
    is one Element, its Traces together."""
    kept: dict[str, Any] = {}
    for change in changes:
        key = str(change.identity_key)
        if key in kept and hasattr(kept[key], "trace"):
            held = kept[key]
            kept[key] = dataclasses.replace(held, trace=[*held.trace, *change.trace])
        else:
            kept.setdefault(key, change)
    return list(kept.values())


def act(
    project_id: uuid.UUID,
    *,
    act: str,
    step: str,
    proposal_ids: Sequence[uuid.UUID] = (),
    group_key: str | None = None,
    values: Mapping[str, Any] | None = None,
    reason: str | None = None,
    actor_name: str,
) -> ActDone:
    """One act of the QS on a step's Proposals: one Confirmation, one DomainEvent and one call of
    `live_model.services.apply` (whose changes hold only the Elements this act confirms, changes
    while confirmed, or withdraws), in one transaction.

    - `confirm`: the Proposals become Elements.
    - `exclude`: left out (`reason` kept); a confirmed one is withdrawn from the Model.
    - `edit`: the QS's typed values (the size answer: `section_b`, `section_d`, `unit`) replace the
      read ones; the size Questions about them are answered. A confirmed one's change goes to the
      Model; an unconfirmed one stays a Proposal.
    - `unconfirm`: confirmed ones become Proposals again and leave the Model.
    """
    _step(step)
    if act not in Act.ALL:
        raise auth.Refused(said.ACT_UNKNOWN(), status=400)
    typed = _size(values) if act == Act.EDIT else None
    tenant, user = _tenant(), _user()
    building_id = building_of(project_id)
    with transaction.atomic():
        chosen = _chosen(project_id, step, proposal_ids, group_key)
        confirmation_id = new_id()
        was_confirmed = {p.id for p in chosen if p.status == ProposalStatus.CONFIRMED}
        answered = 0
        if act == Act.CONFIRM:
            changed = [p for p in chosen if p.status != ProposalStatus.CONFIRMED]
            for p in changed:
                p.status = ProposalStatus.CONFIRMED
                p.rejected_reason = ""
            to_model, withdrawn = changed, []
        elif act == Act.EXCLUDE:
            changed = [p for p in chosen if p.status != ProposalStatus.REJECTED]
            for p in changed:
                p.status = ProposalStatus.REJECTED
                p.rejected_reason = (reason or "")[:64]
            to_model, withdrawn = [], [p for p in changed if p.id in was_confirmed]
        elif act == Act.UNCONFIRM:
            changed = [p for p in chosen if p.status == ProposalStatus.CONFIRMED]
            for p in changed:
                p.status = ProposalStatus.OPEN
            to_model, withdrawn = [], changed
        else:
            assert typed is not None
            changed = chosen
            for p in changed:
                p.values = {**(p.values or {}), **typed}
            to_model, withdrawn = [p for p in changed if p.id in was_confirmed], []
            answered = _answer_size(project_id, [p.id for p in changed], typed, user)
        for p in changed:
            p.confirmation_id = confirmation_id
        Proposal.objects.bulk_update(
            changed, ["status", "rejected_reason", "values", "confirmation"], batch_size=500
        )
        traces: dict[uuid.UUID, list[tuple[str, Any]]] = defaultdict(list)
        if to_model:
            for proposal_id, fact, anchor in ProposalTrace.objects.filter(
                project_id=project_id, proposal_id__in=[p.id for p in to_model]
            ).values_list("proposal_id", "fact", "anchor"):
                traces[proposal_id].append((fact, anchor))
        names = _storey_names(project_id) if to_model or withdrawn else {}
        heights = {str(r.id): r.height_m for r in storeys(project_id).storeys} if to_model else {}
        placed = {str(s.name): s.id for s in _live().snapshot(building_id).storeys} if to_model else {}
        changes = _once(
            [_change(p, names, traces, heights=heights, placed=placed) for p in to_model]
            + [_change(p, names, traces, withdrawn=True) for p in withdrawn]
        )
        version = _live().apply(building_id, confirmation_id, changes, cause="confirmation")
        seq = getattr(version, "seq", None)
        Confirmation.objects.create(
            id=confirmation_id,
            tenant_id=tenant,
            project_id=project_id,
            step=step,
            building_id=building_id,
            user_id=user,
            by_name=actor_name,
            kind=_kind(act, len(chosen), answered),
            act=act,
            proposals=len(changed),
            model_version_seq=seq,
            before={"proposals": {str(p.id): str(p.status) for p in chosen}},
        )
        events.record(
            _EVENT[act],
            subject_type="confirmation",
            subject_id=confirmation_id,
            actor_user_id=user,
            project_id=project_id,
            building_id=building_id,
            payload={"count": len(changed)},
        )
    return ActDone(confirmation_id, seq, bool(getattr(version, "figures_changed", False)))


_EVENT = {
    Act.CONFIRM: said.CONFIRMED,
    Act.EXCLUDE: said.EXCLUDED,
    Act.EDIT: said.EDITED,
    Act.UNCONFIRM: said.UNCONFIRMED,
}


def _kind(act: str, chosen: int, answered: int) -> str:
    if act == Act.UNCONFIRM:
        return ConfirmationKind.UNCONFIRM
    if answered:
        return ConfirmationKind.QUESTION_ANSWER
    return ConfirmationKind.BULK if chosen > 1 else ConfirmationKind.SINGLE


def _size(values: Mapping[str, Any] | None) -> dict[str, str]:
    """The size answer: both sides, positive, in a unit the API knows; kept as typed."""
    values = values or {}
    unit = str(values.get("unit") or "")
    if (
        unit not in TO_METRES
        or values.get("section_b") in (None, "")
        or values.get("section_d")
        in (
            None,
            "",
        )
    ):
        raise auth.Refused(said.SIZE_NEEDED(), status=400)
    b, d = _decimal(values["section_b"]), _decimal(values["section_d"])
    if b <= 0 or d <= 0:
        raise auth.Refused(said.SIZE_NEEDED(), status=400)
    return {"section_b": _plain(b), "section_d": _plain(d), "unit": unit, "size_basis": TYPED}


def _answer_size(
    project_id: uuid.UUID, proposal_ids: Sequence[uuid.UUID], typed: Mapping[str, str], user: uuid.UUID
) -> int:
    """Answer the open size Questions about these Proposals with the typed size."""
    linked = QuestionLink.objects.filter(project_id=project_id, proposal_id__in=proposal_ids).values(
        "question_id"
    )
    return Question.objects.filter(
        Q(subject_id__in=proposal_ids) | Q(id__in=linked),
        project_id=project_id,
        message_code=SIZE_NOT_READ,
        status=QuestionStatus.OPEN,
    ).update(
        status=QuestionStatus.ANSWERED,
        answer={"typed": dict(typed)},
        answered_by_id=user,
        answered_at=timezone.now(),
    )


def type_levels(
    project_id: uuid.UUID, levels: Sequence[tuple[uuid.UUID, object]], *, actor_name: str
) -> StoreyList:
    """Storey levels typed by the QS (metres above the Building's datum): kept on each storey as
    typed, one DomainEvent for the act."""
    _buildings(project_id)
    parsed = [(storey_id, _decimal(level)) for storey_id, level in levels]
    user = _user()
    with transaction.atomic():
        found = {
            p.id: p
            for p in _of_project(project_id)
            .filter(step=STOREYS, family_key=FAMILY_OF[STOREYS], id__in=[s for s, _ in parsed])
            .select_for_update()
        }
        if len(found) != len({s for s, _ in parsed}):
            raise auth.Refused(said.STOREY_UNKNOWN(), status=400)
        for storey_id, level in parsed:
            proposal = found[storey_id]
            proposal.values = {**(proposal.values or {}), "level_m": _plain(level), "level_basis": TYPED}
        Proposal.objects.bulk_update(found.values(), ["values"])
        events.record(
            said.LEVELS_TYPED,
            subject_type="project",
            subject_id=project_id,
            actor_user_id=user,
            project_id=project_id,
            payload={"count": len(found)},
        )
    return storeys(project_id)


def place_view(
    project_id: uuid.UUID, view_id: uuid.UUID, storey_ids: Sequence[uuid.UUID], *, actor_name: str
) -> StoreyList:
    """Put a view on storeys (the QS's word over the read's): one DomainEvent for the act. The view
    must be one of the Project's (its Coverage row, Step 1's): any other is the one 404."""
    _buildings(project_id)
    tenant, user = _tenant(), _user()
    wanted = set(storey_ids)
    with transaction.atomic():
        if not Coverage.objects.filter(project_id=project_id, view_id=view_id).exists():
            raise auth.NotFound
        known = set(
            _of_project(project_id)
            .filter(step=STOREYS, family_key=FAMILY_OF[STOREYS], id__in=wanted)
            .exclude(status__in=DECIDED)
            .values_list("id", flat=True)
        )
        if known != wanted:
            raise auth.Refused(said.STOREY_UNKNOWN(), status=400)
        ordered = [str(s) for s in storey_ids if s in known]
        placement, made = Proposal.objects.select_for_update().get_or_create(
            tenant_id=tenant,
            project_id=project_id,
            step=STOREYS,
            candidate_key=f"{PLACEMENT}|{view_id}",
            defaults={
                "subject": ProposalSubject.VIEW,
                "subject_id": view_id,
                "family_key": PLACEMENT,
                "source": "qs",
                "values": {"storey_ids": ordered},
            },
        )
        if not made:
            placement.values = {**(placement.values or {}), "storey_ids": ordered}
            placement.save(update_fields=["values"])
        events.record(
            said.VIEW_PLACED,
            subject_type="view",
            subject_id=view_id,
            actor_user_id=user,
            project_id=project_id,
            payload={"count": len(ordered)},
        )
    return storeys(project_id)


def read(project_id: uuid.UUID, step: str) -> uuid.UUID:
    """Queue T1's frame read for the Project's Building (the job reads every frame step)."""
    _step(step)
    building_id = building_of(project_id)
    task = import_module(READ_TASK).read_frame
    task.defer(building_id=building_id)
    return building_id


# The 3D's data (C17) ------------------------------------------------------------------------------


def _get(row: object, name: str, default: Any = None) -> Any:
    if isinstance(row, Mapping):
        return row.get(name, default)
    return getattr(row, name, default)


def _square(b: Decimal, d: Decimal, x: Decimal, y: Decimal) -> list[list[str]]:
    hb, hd = b / 2, d / 2
    return [
        [_plain(x - hb), _plain(y - hd)],
        [_plain(x + hb), _plain(y - hd)],
        [_plain(x + hb), _plain(y + hd)],
        [_plain(x - hb), _plain(y + hd)],
    ]


def _confirmed_from_snapshot(building_id: uuid.UUID, seq: int | None) -> list[ElementPrimitivesRow]:
    """Confirmed columns as prisms b x d x their storey's height (from the snapshot), standing on
    the storey's level; at the column's `x_m`, `y_m` when the state holds them, else the origin."""
    snap = _live().snapshot(building_id, seq)
    storeys_by_id = {str(_get(s, "id")): s for s in (_get(snap, "storeys") or [])}
    rows = []
    for state in _get(snap, "elements") or _get(snap, "states") or []:
        if _get(state, "family") != FAMILY_OF[COLUMNS]:
            continue
        attrs = _get(state, "attrs") or {}
        storey = storeys_by_id.get(str(_get(state, "storey_id")))
        try:
            b = Decimal(str(attrs["vx.column.section_b"]))
            d = Decimal(str(attrs["vx.column.section_d"]))
            h = Decimal(str(_get(storey, "height_m")))
        except KeyError, InvalidOperation, TypeError:
            continue
        z0 = Decimal(str(_get(storey, "level_m") or 0))
        x = Decimal(str(_get(state, "x_m") or attrs.get("x_m") or 0))
        y = Decimal(str(_get(state, "y_m") or attrs.get("y_m") or 0))
        rows.append(
            ElementPrimitivesRow(
                element_id=uuid.UUID(str(_get(state, "element_id"))),
                family=FAMILY_OF[COLUMNS],
                storey=None if storey is None else str(_get(storey, "name") or _get(storey, "id")),
                part="structural",
                state="held" if _get(state, "held_by_question_id") else "confirmed",
                primitives=[PrimitiveRow("prism", _square(b, d, x, y), _plain(z0), _plain(z0 + h))],
            )
        )
    return rows


def _row_of(found: object) -> ElementPrimitivesRow:
    prims = [
        PrimitiveRow(
            kind=str(_get(p, "kind") or "prism"),
            polygon=[[str(c) for c in point] for point in (_get(p, "polygon") or [])],
            z0=str(_get(p, "z0")),
            z1=str(_get(p, "z1")),
        )
        for p in (_get(found, "primitives") or [])
    ]
    return ElementPrimitivesRow(
        element_id=uuid.UUID(str(_get(found, "element_id"))),
        family=str(_get(found, "family") or ""),
        storey=None if _get(found, "storey") is None else str(_get(found, "storey")),
        part=str(_get(found, "part") or "structural"),
        state=str(_get(found, "state") or "confirmed"),
        primitives=prims,
    )


def _candidate_primitives(geometry: object) -> list[PrimitiveRow]:
    """A Proposal's candidate geometry as C4 primitives: a list, `{primitives: [...]}`, or one."""
    if isinstance(geometry, Mapping) and "primitives" in geometry:
        items = geometry["primitives"]
    elif isinstance(geometry, Mapping):
        items = [geometry]
    elif isinstance(geometry, list):
        items = geometry
    else:
        return []
    found = []
    for item in items:
        if not isinstance(item, Mapping) or "polygon" not in item:
            continue
        found.append(
            PrimitiveRow(
                kind=str(item.get("kind") or "prism"),
                polygon=[[str(c) for c in point] for point in item["polygon"]],
                z0=str(item.get("z0", "0")),
                z1=str(item.get("z1", "0")),
            )
        )
    return found


def primitives(project_id: uuid.UUID, seq: int | None = None) -> list[ElementPrimitivesRow]:
    """C17: the confirmed Elements at `seq` (the latest when none), through
    `live_model.services.primitives` when it is there, else built from the snapshot; then the frame
    steps' open Proposals with candidate geometry, as `proposal` (or `held`, a Question open on it)."""
    building_id = building_of(project_id)
    live = _live()
    made = getattr(live, "primitives", None)
    if made is not None:
        rows = [_row_of(found) for found in made(building_id, seq)]
    else:
        rows = _confirmed_from_snapshot(building_id, seq)
    open_ones = list(
        _of_project(project_id)
        .filter(step__in=STEPS, candidate_geometry__isnull=False)
        .exclude(family_key=PLACEMENT)
        .filter(status__in=(ProposalStatus.OPEN, ProposalStatus.HELD, ProposalStatus.BLOCKED))
    )
    held = _questions_by_proposal(project_id, [p.id for p in open_ones])
    for proposal in open_ones:
        shapes = _candidate_primitives(proposal.candidate_geometry)
        if not shapes:
            continue
        storey = (proposal.values or {}).get("storey")
        rows.append(
            ElementPrimitivesRow(
                element_id=proposal.id,
                family=proposal.family_key,
                storey=None if storey is None else str(storey),
                part="structural",
                state="held" if _state(proposal, held[proposal.id]) == "held" else "proposal",
                primitives=shapes,
            )
        )
    return rows
