"""S16-T1's fixtures (its tests import them by name): an invented structural set whose Step 1 is
confirmed in part, and fake families given through the registry, so the frame read is tested alone.

The contract (session 16, takeoff T1): `vextrus.takeoff.services.frame_read.run(building_id) ->
FrameReadResult(proposals, questions)` runs the registered families (`engine.families.registry.
families()`, called when the job runs, so a test's monkeypatch of it is what the job sees) on the
Step-1-confirmed views, writing Proposals and ProposalTraces; a family that raises writes a Question
`takeoff.frame.family_failed {family}`. Task: `vextrus.takeoff.tasks.frame_read.read_frame`.

Names chosen by the acceptance writer where the contract leaves them open (K0 owns the types):
- A fake family is a module with `MANIFEST` (`key`, `step`, as C4) and `recognise(views, confirmed,
  setup, profile)` returning an object with `candidates`, `judgements`, `conventions`, `questions`.
- A candidate carries C4's fields by name: `family`, `candidate_key`, `storey`, `band`, `mark`, `at`,
  `values` (fact -> `{"value", "unit", "text"}`, drawing units), `anchors` (fact -> `DwgAnchor`),
  `source`, `confidence`, `geometry`.
- A ViewArtefact names its drawings View by `view_id` (or `id`); the fake reads either.
- `read_frame` is a `jobs.Job` taking `building_id`, as `read_file` takes `file_id`.
"""

import importlib
import types
import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

import pytest

from engine.read.anchor import DwgAnchor
from engine.recognise.types import Box, ViewCandidate, ViewKind
from vextrus.drawings import services as drawings
from vextrus.projects.models import Building
from vextrus.takeoff.services import step1
from vextrus.testing.drawings import QsProject, add, drawing, frame, read_dwg
from vextrus.testing.tenancy import Member

GRID_TEXT = "6000"
"""The verbatim dimension text of the invented grid line's offset (drawing units: mm)."""
SIZE_TEXT = '10"X20"'
"""The verbatim size label of the invented column, as an office might draw it."""
SECTION_B = Decimal("254")
SECTION_D = Decimal("508")
FAMILY_FAILED = "takeoff.frame.family_failed"
SHA = "a" * 64


@dataclass(frozen=True)
class Frame:
    """A structural set of three sheets, each a title block and a plan view; S-01 and S-02
    confirmed at Step 1, S-03 not."""

    member: Member
    project_id: uuid.UUID
    building_id: uuid.UUID
    confirmed_views: frozenset[str]
    """The plan views' ids on the confirmed sheets."""
    unconfirmed_views: frozenset[str]
    """Every view id on the sheet left unconfirmed."""


def _views(i: int) -> list[ViewCandidate]:
    box = frame(i)
    return [
        ViewCandidate(box=Box(box.x0 + 150, 0, box.x1, 30), kind=ViewKind.TITLE_BLOCK),
        ViewCandidate(
            box=Box(box.x0 + 10, 40, box.x0 + 140, 140),
            kind=ViewKind.PLAN,
            title="FOUNDATION PLAN",
            steps=("grid", "columns"),
        ),
    ]


def make_frame(member: Member, project_id: uuid.UUID, *, confirm: bool = True) -> Frame:
    structural = add(member, project_id, "KR-STR-R0.dwg", drawing()).file
    printed = read_dwg(member, structural.id, ["S-01", "S-02", "S-03"], mark_read=False)
    with member.acting():
        views: dict[uuid.UUID, list[str]] = {}
        plans: dict[uuid.UUID, list[str]] = {}
        for i, sheet in enumerate(printed):
            made = drawings.record_views(sheet.id, _views(i))
            views[sheet.id] = [str(v.id) for v in made]
            plans[sheet.id] = [str(v.id) for v in made if str(v.kind) == ViewKind.PLAN]
        drawings.mark_read(structural.id)
        proposals = [step1.propose_sheet(sheet.id) for sheet in printed]
        for sheet in printed:
            step1.record_coverage(sheet.id)
        if confirm:
            step1.confirm(project_id, [proposals[0]], actor_name="A mock QS")
            step1.confirm(project_id, [proposals[1]], actor_name="A mock QS")
        building = Building.objects.get(project_id=project_id)
    first, second, third = (s.id for s in printed)
    return Frame(
        member,
        project_id,
        building.id,
        frozenset(plans[first] + plans[second]),
        frozenset(views[third]),
    )


@pytest.fixture
def structural_frame(qs_project: QsProject) -> Frame:
    return make_frame(qs_project.member, qs_project.project_id)


# Fake families ------------------------------------------------------------------------------------


def view_id(view: Any) -> str:
    for name in ("view_id", "id"):
        found = getattr(view, name, None)
        if found is not None:
            return str(found)
    raise AssertionError(f"a ViewArtefact names its View: {view!r}")


def _anchor(handle: str) -> DwgAnchor:
    return DwgAnchor(
        source_sha256=SHA,
        reader="synthetic",
        reader_version="1",
        sheet="S-01",
        inserts=(),
        handle=handle,
    )


@dataclass
class Fake:
    """A fake family: its module, and the view ids each of its runs was given."""

    module: types.ModuleType
    seen: list[list[str]] = field(default_factory=list)

    def given(self) -> set[str]:
        return {v for run in self.seen for v in run}


def _candidate(key: str, vid: str, mark: str, values: dict[str, Any], facts: Sequence[str]) -> Any:
    return types.SimpleNamespace(
        family=key,
        candidate_key=f"{key}:{vid}:{mark}",
        storey="",
        band="",
        mark=mark,
        at={"grid": ["B", "2"], "offset": ["0", "0"]},
        values=values,
        anchors={fact: _anchor(f"{n + 1:X}A") for n, fact in enumerate(facts)},
        source="reader",
        confidence=Decimal("0.9"),
        geometry=None,
    )


def _recognised(candidates: Sequence[Any]) -> Any:
    return types.SimpleNamespace(
        candidates=tuple(candidates), judgements=(), conventions=(), questions=()
    )


def fake_family(key: str, step: str, *, raises: bool = False) -> Fake:
    """A family proposing, per view given: a grid line `A` (grid_line) or a column `C1` (others),
    its values in drawing units with their verbatim text; or raising when told."""
    module = types.ModuleType(f"engine.families.{key}")
    fake = Fake(module)

    def recognise(views: Sequence[Any], confirmed: Any, setup: Any, profile: Any) -> Any:
        ids = [view_id(v) for v in views]
        fake.seen.append(ids)
        if raises:
            raise RuntimeError(f"invented failure of {key}")
        made = []
        for vid in ids:
            if key == "grid_line":
                values = {
                    "axis": "x",
                    "offset": {"value": Decimal(GRID_TEXT), "unit": "mm", "text": GRID_TEXT},
                }
                made.append(_candidate(key, vid, "A", values, ["offset"]))
            else:
                values = {
                    "section_b": {"value": SECTION_B, "unit": "mm", "text": SIZE_TEXT},
                    "section_d": {"value": SECTION_D, "unit": "mm", "text": SIZE_TEXT},
                }
                made.append(_candidate(key, vid, "C1", values, ["section_b", "section_d"]))
        return _recognised(made)

    module.MANIFEST = types.SimpleNamespace(  # type: ignore[attr-defined]
        key=key,
        part="structural",
        step=step,
        identity_rule="label" if key == "grid_line" else "grid_point",
        milestone="M1",
    )
    module.recognise = recognise  # type: ignore[attr-defined]
    return fake


def use_families(monkeypatch: pytest.MonkeyPatch, *fakes: Fake) -> None:
    """The registry returns exactly these families, in this order."""
    registry = importlib.import_module("engine.families.registry")
    modules = tuple(f.module for f in fakes)
    monkeypatch.setattr(registry, "families", lambda: modules)


FamilyMaker = Callable[..., Fake]
