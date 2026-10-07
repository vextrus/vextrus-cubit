"""The Live Model's spine (M1.md C7; session 16's S16-L): `apply`, the one writer of Model Versions,
Element States and Element Traces; `snapshot`, the states valid at a Model Version; `figures_hash`,
`boq`'s cache key.

Every call runs as the acting tenant (row-level security holds the wall): a Building of another
Developer has no Model Version this tenant can read, so `snapshot` of it is empty and `apply` to it
writes rows only this tenant reads. Values are SI decimal strings (ADR 0008), never floats.
"""

import hashlib
import json
import uuid
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from django.core.exceptions import PermissionDenied
from django.db import connection, transaction
from django.db.models import Q

from vextrus.live_model.models import (
    MODEL_VERSION_CAUSES,
    AttributeDefinition,
    Element,
    ElementFamily,
    ElementState,
    ElementTrace,
    ModelVersion,
)
from vextrus.platform.services import tenancy

STOREY = "storey"
"""The Element Family whose states are the Building's storeys (C8's `vx.storey.*`)."""
STOREY_INDEX = "vx.storey.index"
STOREY_HEIGHT = "vx.storey.height"
STOREY_LEVEL = "vx.storey.slab_level"


@dataclass(frozen=True)
class StateChange:
    """One Element's confirmed facts, as `apply` takes them (C7).

    `identity_key` is C7's `<family>|<grid ref>|<storey>`, written once at first confirm; `attrs`
    maps C8 keys to SI decimal strings; `trace` lists `{fact, kind, anchor}` (anchor carries
    `sheet_id` and `view_id`; an optional `question_id`). `retire` ends the Element at this version.
    """

    family: str
    identity_key: str
    mark: str = ""
    grid_ref: str = ""
    attrs: Mapping[str, str] = field(default_factory=dict)
    trace: Sequence[Mapping[str, Any]] = ()
    storey_id: uuid.UUID | None = None
    mix: str = ""
    grade: str = ""
    rebar_basis: str = ""
    held_by_question_id: uuid.UUID | None = None
    retire: bool = False


@dataclass(frozen=True)
class ModelVersionRef:
    building_id: uuid.UUID
    seq: int
    figures_changed: bool
    figures_hash: str


@dataclass(frozen=True)
class StoreyRow:
    id: uuid.UUID
    name: str
    order: int | None
    height_m: Decimal | None
    level_m: Decimal | None


@dataclass(frozen=True)
class ElementRow:
    element_id: uuid.UUID
    family: str
    identity_key: str
    mark: str
    storey_id: uuid.UUID | None
    grid_ref: str
    attrs: Mapping[str, str]
    mix: str
    grade: str
    rebar_basis: str
    held_by_question_id: uuid.UUID | None
    trace: tuple[Mapping[str, Any], ...] = ()
    """Each fact's `{fact, kind, anchor}` valid at the snapshot's seq (anchor carries sheet_id,
    view_id), in fact order."""


@dataclass(frozen=True)
class Snapshot:
    """A Building's Live Model at `seq` (0: nothing confirmed yet): its storeys, in order, and every
    other Element's state, by family then identity key."""

    building_id: uuid.UUID
    seq: int
    storeys: tuple[StoreyRow, ...]
    elements: tuple[ElementRow, ...]

    @property
    def states(self) -> tuple[ElementRow, ...]:
        return self.elements


class UnknownFamily(ValueError):
    """A change names an Element Family neither the tenant's nor its Library's."""


class RepeatedElement(ValueError):
    """Two changes in one `apply` name one Element (its family and identity key): one version holds
    one state per Element, so the caller must fold them first."""


# Writing ----------------------------------------------------------------------------------------


def apply(
    building_id: uuid.UUID,
    confirmation_id: uuid.UUID | None,
    changes: Sequence[StateChange],
    *,
    cause: str,
    drawing_set_state_id: uuid.UUID | None = None,
) -> ModelVersionRef:
    """Write the Building's next Model Version and the states and traces `changes` make.

    A change whose facts equal its Element's open state leaves the state open; one that differs
    closes it at the new `seq` (never updating it otherwise) and opens the next. One Building's
    versions are written one at a time (a transaction lock on the Building)."""
    if cause not in MODEL_VERSION_CAUSES:
        raise ValueError(f"cause {cause!r} is not one of {MODEL_VERSION_CAUSES}")
    _refuse_repeats(changes)
    tenant_id = _tenant()
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute(
                "select pg_advisory_xact_lock(hashtextextended(%s, 0))",
                [f"live_model.building:{building_id}"],
            )
        last = (
            ModelVersion.objects.filter(building_id=building_id)
            .order_by("-seq")
            .only("seq", "figures_hash")
            .first()
        )
        seq = (last.seq if last else 0) + 1
        families = _families(tenant_id, {change.family for change in changes})
        feeds = _feeding_keys(tenant_id)
        for change in changes:
            _apply_one(tenant_id, building_id, seq, confirmation_id, families, feeds, change)
        figures = figures_hash(building_id, seq)
        changed = last is None or last.figures_hash != figures
        ModelVersion.objects.create(
            tenant_id=tenant_id,
            building_id=building_id,
            seq=seq,
            cause=cause,
            figures_changed=changed,
            figures_hash=figures,
            confirmation_id=confirmation_id,
            drawing_set_state_id=drawing_set_state_id,
        )
    return ModelVersionRef(building_id, seq, changed, figures)


def _apply_one(
    tenant_id: uuid.UUID,
    building_id: uuid.UUID,
    seq: int,
    confirmation_id: uuid.UUID | None,
    families: Mapping[str, ElementFamily],
    feeds: frozenset[str],
    change: StateChange,
) -> None:
    family = families.get(change.family)
    if family is None:
        raise UnknownFamily(change.family)
    attrs = _si(change.attrs)
    element = Element.objects.filter(
        building_id=building_id, family_id=family.pk, identity_key=change.identity_key
    ).first()
    if element is None:
        element = Element.objects.create(
            tenant_id=tenant_id,
            building_id=building_id,
            family_id=family.pk,
            identity_key=change.identity_key,
            mark_hint=change.mark,
            created_seq=seq,
        )
    elif element.retired_seq is not None and not change.retire:
        Element.objects.filter(pk=element.pk).update(retired_seq=None)
    open_state = ElementState.objects.filter(element_id=element.pk, valid_to_seq=None).first()
    open_traces = list(ElementTrace.objects.filter(element_id=element.pk, valid_to_seq=None))
    if change.retire:
        _close(open_state, open_traces, seq)
        if element.retired_seq is None and seq > element.created_seq:
            Element.objects.filter(pk=element.pk).update(retired_seq=seq)
        return
    facts = {
        "family": change.family,
        "identity_key": change.identity_key,
        "mark": change.mark,
        "grid_ref": change.grid_ref,
        "storey_id": _text(change.storey_id),
        "mix": change.mix,
        "grade": change.grade,
        "rebar_basis": change.rebar_basis,
        "held_by_question_id": _text(change.held_by_question_id),
        "attrs": attrs,
    }
    facts_hash = _hash(facts)
    if open_state is None or open_state.facts_hash != facts_hash:
        _close(open_state, [], seq)
        ElementState.objects.create(
            tenant_id=tenant_id,
            element_id=element.pk,
            valid_from_seq=seq,
            mark=change.mark,
            storey_id=change.storey_id,
            grid_ref=change.grid_ref,
            mix=change.mix,
            grade=change.grade,
            rebar_basis=change.rebar_basis,
            attrs=attrs,
            held_by_question_id=change.held_by_question_id,
            facts_hash=facts_hash,
            figures_hash=_hash(_figures(facts, feeds)),
            confirmation_id=confirmation_id,
        )
    traces = [_trace(item) for item in change.trace]
    held = sorted(_hash(_trace_facts(t)) for t in open_traces)
    if held != sorted(_hash(t) for t in traces):
        _close(None, open_traces, seq)
        ElementTrace.objects.bulk_create(
            ElementTrace(
                tenant_id=tenant_id,
                element_id=element.pk,
                fact=t["fact"],
                kind=t["kind"],
                anchor=t["anchor"],
                question_id=t["question_id"],
                valid_from_seq=seq,
            )
            for t in traces
        )


def _refuse_repeats(changes: Sequence[StateChange]) -> None:
    seen: set[tuple[str, str]] = set()
    for change in changes:
        identity = (change.family, change.identity_key)
        if identity in seen:
            raise RepeatedElement(f"{change.family} {change.identity_key} is named twice in one apply")
        seen.add(identity)


def _close(state: ElementState | None, traces: Sequence[ElementTrace], seq: int) -> None:
    """Set `valid_to_seq` alone (vextrus_app may update no other column of these tables)."""
    if state is not None:
        ElementState.objects.filter(pk=state.pk).update(valid_to_seq=seq)
    if traces:
        ElementTrace.objects.filter(pk__in=[t.pk for t in traces]).update(valid_to_seq=seq)


# Reading ----------------------------------------------------------------------------------------


def latest_seq(building_id: uuid.UUID) -> int:
    """The Building's latest Model Version's seq; 0 when it has none."""
    found = (
        ModelVersion.objects.filter(building_id=building_id)
        .order_by("-seq")
        .values_list("seq", flat=True)
        .first()
    )
    return int(found or 0)


def snapshot(building_id: uuid.UUID, seq: int | None = None) -> Snapshot:
    """The Building's storeys and Element states valid at `seq` (the latest when None)."""
    at = latest_seq(building_id) if seq is None else seq
    storeys: list[StoreyRow] = []
    elements: list[ElementRow] = []
    valid = _valid_states(building_id, at)
    traces = _valid_traces([state.element_id for state, family, _key in valid if family != STOREY], at)
    for state, family, identity_key in valid:
        if family == STOREY:
            storeys.append(
                StoreyRow(
                    id=state.element_id,
                    name=state.mark,
                    order=_int(state.attrs.get(STOREY_INDEX)),
                    height_m=_decimal(state.attrs.get(STOREY_HEIGHT)),
                    level_m=_decimal(state.attrs.get(STOREY_LEVEL)),
                )
            )
            continue
        elements.append(
            ElementRow(
                element_id=state.element_id,
                family=family,
                identity_key=identity_key,
                mark=state.mark,
                storey_id=state.storey_id,
                grid_ref=state.grid_ref,
                attrs=dict(state.attrs),
                mix=state.mix,
                grade=state.grade,
                rebar_basis=state.rebar_basis,
                held_by_question_id=state.held_by_question_id,
                trace=traces.get(state.element_id, ()),
            )
        )
    storeys.sort(key=lambda s: (s.order is None, s.order or 0, s.name))
    return Snapshot(building_id, at, tuple(storeys), tuple(elements))


def figures_hash(building_id: uuid.UUID, seq: int) -> str:
    """`sha256:` over every state valid at `seq`'s figures hash, in identity order: the same
    figures give the same hash whatever the version, and any changed figure changes it."""
    digest = hashlib.sha256()
    for state, family, identity_key in _valid_states(building_id, seq):
        digest.update(f"{family}|{identity_key}|{state.figures_hash}\n".encode())
    return f"sha256:{digest.hexdigest()}"


def _valid_states(building_id: uuid.UUID, seq: int) -> list[tuple[ElementState, str, str]]:
    if seq < 1:
        return []
    elements = {
        pk: (family_key, identity_key)
        for pk, family_key, identity_key in Element.objects.filter(building_id=building_id).values_list(
            "pk", "family_id", "identity_key"
        )
    }
    if not elements:
        return []
    family_keys = dict(
        ElementFamily.objects.filter(pk__in={f for f, _i in elements.values()}).values_list("pk", "key")
    )
    states = ElementState.objects.filter(element_id__in=list(elements), valid_from_seq__lte=seq).filter(
        Q(valid_to_seq__isnull=True) | Q(valid_to_seq__gt=seq)
    )
    found = [
        (state, family_keys.get(elements[state.element_id][0], ""), elements[state.element_id][1])
        for state in states
    ]
    found.sort(key=lambda row: (row[1], row[2]))
    return found


def _valid_traces(
    element_ids: Sequence[uuid.UUID], seq: int
) -> dict[uuid.UUID, tuple[Mapping[str, Any], ...]]:
    if not element_ids:
        return {}
    found: dict[uuid.UUID, list[Mapping[str, Any]]] = {}
    rows = (
        ElementTrace.objects.filter(element_id__in=list(element_ids), valid_from_seq__lte=seq)
        .filter(Q(valid_to_seq__isnull=True) | Q(valid_to_seq__gt=seq))
        .order_by("fact", "id")
    )
    for row in rows:
        found.setdefault(row.element_id, []).append(
            {"fact": row.fact, "kind": row.kind, "anchor": dict(row.anchor or {})}
        )
    return {element_id: tuple(items) for element_id, items in found.items()}


# Helpers ----------------------------------------------------------------------------------------


def _tenant() -> uuid.UUID:
    tenant_id = tenancy.current_tenant_id()
    if tenant_id is None:
        raise PermissionDenied("live_model.apply needs an acting tenant")
    return tenant_id


def _families(tenant_id: uuid.UUID, keys: set[str]) -> dict[str, ElementFamily]:
    """The tenant's own family of each key, else its Library's (row-level security admits both)."""
    found: dict[str, ElementFamily] = {}
    for family in ElementFamily.objects.filter(key__in=keys):
        if family.key not in found or family.tenant_id == tenant_id:
            found[family.key] = family
    return found


def _feeding_keys(tenant_id: uuid.UUID) -> frozenset[str]:
    """The Attribute Definition keys that do not feed figures (a key with no definition does)."""
    rows: dict[str, tuple[uuid.UUID, bool]] = {}
    for key, owner, feeds in AttributeDefinition.objects.values_list(
        "key", "tenant_id", "feeds_figures"
    ):
        if key not in rows or owner == tenant_id:
            rows[key] = (owner, feeds)
    return frozenset(key for key, (_owner, feeds) in rows.items() if not feeds)


def _figures(facts: Mapping[str, Any], not_feeding: frozenset[str]) -> dict[str, Any]:
    """The facts a measured figure reads: never a mark, a grid reference or a held Question."""
    return {
        "family": facts["family"],
        "identity_key": facts["identity_key"],
        "storey_id": facts["storey_id"],
        "mix": facts["mix"],
        "grade": facts["grade"],
        "rebar_basis": facts["rebar_basis"],
        "attrs": {k: v for k, v in facts["attrs"].items() if k not in not_feeding},
    }


def _si(attrs: Mapping[str, Any]) -> dict[str, str]:
    """`attrs` as written: each value a string (ADR 0008: a float is refused, never stored)."""
    out: dict[str, str] = {}
    for key, value in attrs.items():
        if isinstance(value, float):
            raise TypeError(f"{key} is a float; the Live Model holds decimal strings")
        out[str(key)] = str(value)
    return out


def _trace(item: Mapping[str, Any]) -> dict[str, Any]:
    question = item.get("question_id")
    return {
        "fact": str(item["fact"]),
        "kind": str(item["kind"]),
        "anchor": dict(item.get("anchor") or {}),
        "question_id": str(question) if question else None,
    }


def _trace_facts(trace: ElementTrace) -> dict[str, Any]:
    return {
        "fact": trace.fact,
        "kind": trace.kind,
        "anchor": trace.anchor,
        "question_id": _text(trace.question_id) or None,
    }


def _hash(value: Any) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def _text(value: uuid.UUID | None) -> str:
    return "" if value is None else str(value)


def _decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except InvalidOperation:
        return None


def _int(value: Any) -> int | None:
    number = _decimal(value)
    return None if number is None else int(number)
