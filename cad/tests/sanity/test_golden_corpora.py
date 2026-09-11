"""The golden self-consistency every fixture owes, run over both corpora (AM-01, L-QTY-06).

AM-01 puts two fixtures in the tree — F-RCC6, frozen at v1.1 as the J-000 corpus and the fast
regression, and F-RCC6-BNBC, the M3/M4 yardstick — and says neither replaces the other. So the
checks that need a drawing (DXF census, vector PDF, regeneration) stay on the `corpus` fixture,
which is F-RCC6's, and everything that is true of *a golden* runs here over both through
`golden_corpus`.

F-RCC6-BNBC has no DXF yet. Its sanity is what its own evidence can prove: rows that are
non-negative decimals on a unique key, the 36 M3 gate cells of `cells.json` all filled by rows,
`bbs.golden.json` beside the schema-2 golden, and the generator's two independent paths still
agreeing — re-run here, since `python -m fixtures.gen.rcc6_bnbc` offers no `--check` flag, by
importing its `selfcheck` and running it.
"""

from __future__ import annotations

import re
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

import pytest

GOLDEN_REL = "takeoff.golden.json"
DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")

REPO_ROOT = Path(__file__).resolve().parents[3]


def _golden(corpus) -> dict[str, Any]:
    return corpus.once(f"golden:{corpus.root.name}", lambda: corpus.read_json(GOLDEN_REL))


def _key(row: dict[str, Any]) -> tuple[Any, ...]:
    """A row's identity: the ledger key, plus what schema 2 adds to tell two rows of a kind apart."""
    return tuple(
        row.get(field)
        for field in ("class", "kind", "level", "grade", "component", "diameter_mm", "mark")
    )


def test_the_golden_names_its_fixture_and_how_it_was_authored(golden_corpus) -> None:
    golden = _golden(golden_corpus)
    assert str(golden.get("fixture", "")).startswith("F-RCC6"), "the golden does not name its fixture"
    assert golden.get("provenance") == "HAND_FROM_AUTHORED_SOURCE", (
        "a golden the product's own methods could have derived is not evidence (L-QTY-06)"
    )
    assert isinstance(golden.get("rows"), list) and golden["rows"], "the golden holds no rows"


def test_every_quantity_is_a_non_negative_decimal_with_a_unit(golden_corpus) -> None:
    offences: list[str] = []
    for row in _golden(golden_corpus)["rows"]:
        where = f"{row.get('class')}/{row.get('kind')}/{row.get('level')}"
        quantity = row.get("quantity")
        if not isinstance(quantity, str) or not DECIMAL.match(quantity):
            offences.append(f"{where}: quantity {quantity!r} is not a decimal string")
            continue
        if Decimal(quantity) < 0:
            offences.append(f"{where}: quantity {quantity} is negative")
        if not isinstance(row.get("unit"), str) or not row["unit"]:
            offences.append(f"{where}: no unit")
        if not isinstance(row.get("kind"), str) or not row["kind"]:
            offences.append(f"{where}: no kind")
    assert offences == [], "\n".join(offences)


def test_no_row_is_recorded_twice(golden_corpus) -> None:
    keys = Counter(_key(row) for row in _golden(golden_corpus)["rows"])
    repeated = sorted(str(key) for key, seen in keys.items() if seen > 1)
    assert repeated == [], f"rows repeated on their key: {repeated}"


def test_a_schema_2_golden_carries_the_evidence_schema_2_promises(golden_corpus) -> None:
    golden = _golden(golden_corpus)
    if golden.get("schema") != 2:
        pytest.skip(f"{golden_corpus.root.name} is a schema 1 golden")
    kinds = {row["kind"] for row in golden["rows"]}
    assert {"RCC_CONCRETE", "FORMWORK", "REBAR", "PILE_LENGTH", "PILE_COUNT"} <= kinds, (
        f"schema 2 promises the kinds R-TO-035 grades; this golden carries {sorted(kinds)}"
    )
    components = {row.get("component") for row in golden["rows"] if row["kind"] == "REBAR"}
    assert components <= {"NET", "LAP"} and components, (
        f"REBAR rows must be billed as NET and LAP components (AM-03 a); got {sorted(map(str, components))}"
    )
    assert golden_corpus.path("bbs.golden.json").is_file(), (
        "a schema-2 golden owes bbs.golden.json beside it (AM-01)"
    )


def test_the_m3_gate_cells_are_all_filled_by_rows(golden_corpus) -> None:
    cells_path = golden_corpus.path("cells.json")
    if not cells_path.is_file():
        pytest.skip(f"{golden_corpus.root.name} publishes no cell matrix")
    cells = golden_corpus.read_json("cells.json")["cells"]
    rows = _golden(golden_corpus)["rows"]
    empty = [
        entry["cell"]
        for entry in cells
        if not any(all(row.get(k) == v for k, v in entry["cell"].items()) for row in rows)
    ]
    assert empty == [], f"cells the golden leaves empty: {empty}"
    assert len(cells) == 36, f"the M3 matrix is 36 cells; cells.json carries {len(cells)}"


def test_the_generators_two_paths_still_agree(golden_corpus) -> None:
    """The fixture's own selfcheck, re-run: the golden is only evidence while both paths agree."""
    module = REPO_ROOT / "fixtures" / "gen" / golden_corpus.root.name.replace("-", "_")
    if not (module / "selfcheck.py").is_file():
        pytest.skip(f"{golden_corpus.root.name} has no selfcheck of its own")
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))
    from fixtures.gen.rcc6_bnbc import selfcheck  # noqa: PLC0415

    report = selfcheck.run()
    assert report["cells"] == "36/36", f"the selfcheck fills {report['cells']} of the M3 cells"
    assert report["rows_per_kind"]["REBAR"] > 0, "the selfcheck sees no REBAR rows"
