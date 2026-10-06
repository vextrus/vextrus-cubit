"""S14-K1 (e): the factory's caps are named once, in one place. The orchestrator's brief for the ticket:
"the numbers are named once, in one place (a test reads them and fails on any duplicate literal in
governor.py or review.py)".

A cap here is a module-level name under `scripts/factory/` with a `CAP` or `SLOTS` part, or with both
`MAX` and `AGENTS` (today `CAP_HIGH`, `CAP_MAX`, `WIP_CAP`, `AREA_CAP`, `MAX_LOCAL_AGENTS`,
`MAX_SLOTS`). Every one bound to a number written in the source lives in one module, never in
review.py (its slot count is read from that module), no number is written for two caps, and that
module holds the owner's numbers: 16 cloud sessions, 6 local agents and 8 review slots (the area cap,
3 or more, is pinned in test_hot_areas.py). A cap bound to another name (`MAX_SLOTS = REVIEW_SLOTS`)
writes no number."""

from __future__ import annotations

import ast
from pathlib import Path

from scripts.factory import review
from scripts.tests.acceptance.ts14k1._world import CLOUD_CAP, LOCAL_AGENTS, REVIEW_SLOTS
from scripts.tests.acceptance.ts14w1._world import REPO

FACTORY = REPO / "scripts" / "factory"


def is_cap(name: str) -> bool:
    parts = set(name.split("_"))
    return bool(parts & {"CAP", "SLOTS"}) or {"MAX", "AGENTS"} <= parts


def _bound(target: ast.expr, value: ast.expr | None) -> list[tuple[str, ast.expr | None]]:
    if isinstance(target, ast.Name):
        return [(target.id, value)]
    if isinstance(target, ast.Tuple | ast.List):
        values = value.elts if isinstance(value, ast.Tuple | ast.List) else [None] * len(target.elts)
        pairs: list[tuple[str, ast.expr | None]] = []
        for one, v in zip(target.elts, values, strict=False):
            pairs += _bound(one, v)
        return pairs
    return []


def written_caps(path: Path) -> list[tuple[str, int]]:
    """The caps a module binds, at module level, to a number written in its source."""
    found: list[tuple[str, int]] = []
    for node in ast.parse(path.read_text()).body:
        pairs: list[tuple[str, ast.expr | None]] = []
        if isinstance(node, ast.Assign):
            for target in node.targets:
                pairs += _bound(target, node.value)
        elif isinstance(node, ast.AnnAssign):
            pairs += _bound(node.target, node.value)
        for name, value in pairs:
            if (
                is_cap(name)
                and isinstance(value, ast.Constant)
                and isinstance(value.value, int)
                and not isinstance(value.value, bool)
            ):
                found.append((name, value.value))
    return found


def caps_by_module() -> dict[str, list[tuple[str, int]]]:
    found = {path.name: written_caps(path) for path in sorted(FACTORY.glob("*.py"))}
    return {name: caps for name, caps in found.items() if caps}


def test_review_py_writes_no_cap_number() -> None:
    assert written_caps(FACTORY / "review.py") == [], "review.py reads its slot count from the one place"


def test_the_caps_are_written_in_one_module() -> None:
    places = caps_by_module()
    assert len(places) == 1, f"the caps are written in more than one module: {places}"


def test_no_number_is_written_for_two_caps() -> None:
    for module, caps in caps_by_module().items():
        numbers = [number for _, number in caps]
        twice = {n: [name for name, m in caps if m == n] for n in numbers if numbers.count(n) > 1}
        assert not twice, f"{module} writes one number for two caps: {twice}"


def test_the_one_place_holds_the_owners_numbers() -> None:
    numbers = sorted(number for caps in caps_by_module().values() for _, number in caps)
    for wanted in (CLOUD_CAP, LOCAL_AGENTS, REVIEW_SLOTS):
        assert wanted in numbers, f"no cap is {wanted}: {caps_by_module()}"
    assert review.MAX_SLOTS == REVIEW_SLOTS
