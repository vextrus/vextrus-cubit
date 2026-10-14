"""The Live Model's write and read types (docs/plans/M1.md C7, frozen by M1-00): what `apply` takes
(`StateChange`, with its `TraceEntry`s) and what `snapshot` gives (`Snapshot`). The services
themselves are M1-08's.

The typed core travels in its own fields, never in `attrs`; `attrs` holds SI decimal strings by
Attribute key. A Trace's kind is one enum, `TraceKind`, and its anchor is C7's anchor JSON
(`TraceAnchor`).
"""

import uuid
from collections.abc import Mapping
from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum


class TraceKind(StrEnum):
    """Where a fact came from (C7): read on a sheet, an answered Question, typed by the QS, derived
    from other facts, or the best candidate while a Question holds it."""

    SHEET_ENTITY = "sheet_entity"
    QUESTION = "question"
    QS_TYPED = "qs_typed"
    DERIVED = "derived"
    BEST_CANDIDATE = "best_candidate"


@dataclass(frozen=True)
class TraceAnchor:
    """A `sheet_entity` anchor (C7, A8): the sheet, the view and the file it was read in, the entity's
    handle (DWG) or the page (PDF), and its box on the sheet in mm, `(x0, y0, x1, y1)`."""

    sheet_id: uuid.UUID
    view_id: uuid.UUID
    file_id: uuid.UUID
    handle: str | None
    page: int | None
    bbox_sheet_mm: tuple[Decimal, Decimal, Decimal, Decimal]


@dataclass(frozen=True)
class TraceEntry:
    """One fact's Trace (C7): `{fact, kind, anchor | null, question_id | null}`."""

    fact: str
    kind: TraceKind
    anchor: TraceAnchor | None
    question_id: uuid.UUID | None


@dataclass(frozen=True)
class StateChange:
    """One Element's new state, or its retirement, as `live_model.services.apply` takes it (C7).

    `storey_id` is required for every family bound to a storey (C19); `grade` and `rebar_basis` are
    None for a family that is not reinforced concrete, and `mix` only for one with neither a concrete's
    nor a mortar's Mix."""

    element_key: str
    family: str
    mark: str
    grid_ref: str | None
    x_m: Decimal
    y_m: Decimal
    rotation: Decimal
    storey_id: uuid.UUID | None
    band_from_id: uuid.UUID | None
    band_to_id: uuid.UUID | None
    mix: str | None
    grade: str | None
    rebar_basis: str | None
    construction_stage: str
    attrs: Mapping[str, str]
    trace: tuple[TraceEntry, ...]
    retire: bool


@dataclass(frozen=True)
class SnapshotElement:
    """One Element in a Snapshot: its identity key, typed core, `attrs` and valid Traces (A8)."""

    element_id: uuid.UUID
    element_key: str
    family: str
    mark: str
    grid_ref: str | None
    x_m: Decimal
    y_m: Decimal
    rotation: Decimal
    storey_id: uuid.UUID | None
    band_from_id: uuid.UUID | None
    band_to_id: uuid.UUID | None
    mix: str | None
    grade: str | None
    rebar_basis: str | None
    construction_stage: str
    attrs: Mapping[str, str]
    trace: tuple[TraceEntry, ...]


@dataclass(frozen=True)
class Snapshot:
    """A Building's Live Model at one ModelVersion (C7): `Snapshot(building_id, seq, figures_hash,
    elements)`."""

    building_id: uuid.UUID
    seq: int
    figures_hash: str
    elements: tuple[SnapshotElement, ...]
