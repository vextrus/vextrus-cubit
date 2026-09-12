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

Every check here is armed by the corpus's own `manifest.json`, never by the presence of the file it
grades (P4a §2): what a manifest promises must be on the tree, and a corpus that does not carry it
fails by name. Nothing here skips — `cad/tests/conftest.py` reds the session for a skip no
manifest explains, so the lane's skip count is a number the manifests account for.
"""

from __future__ import annotations

import hashlib
import importlib
import re
import sys
from collections import Counter
from decimal import Decimal
from pathlib import Path
from typing import Any

GOLDEN_REL = "takeoff.golden.json"
DECIMAL = re.compile(r"^-?\d+(\.\d+)?$")

REPO_ROOT = Path(__file__).resolve().parents[3]

CELLS_REL = "cells.json"
BBS_REL = "bbs.golden.json"
SELFCHECK_REL = "selfcheck.py"

#: The matrix M3's exit is read against (AM-01).
M3_CELLS = 36


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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
    """The manifest says which schema the corpus publishes; the golden must be that schema.

    Before, the evidence checks were armed by the golden's own `schema` field, so a golden that
    stopped calling itself schema 2 stopped being graded and the lane only said `1 skipped`.
    """
    golden, name = _golden(golden_corpus), golden_corpus.root.name
    declared = int(golden_corpus.manifest().get("schema", 1))
    carried = int(golden.get("schema", 1))
    assert carried == declared, (
        f"fixtures/{name}/manifest.json declares schema {declared}; {GOLDEN_REL} calls itself "
        f"schema {carried} — a golden may not leave the grade its manifest promises"
    )
    if declared != 2:
        assert not golden_corpus.declares(BBS_REL), (
            f"fixtures/{name}/manifest.json promises {BBS_REL} beside a schema-{declared} golden"
        )
        assert not golden_corpus.path(BBS_REL).is_file(), (
            f"fixtures/{name}/{BBS_REL} sits beside a schema-{declared} golden its manifest does "
            "not declare"
        )
        return
    kinds = {row["kind"] for row in golden["rows"]}
    assert {"RCC_CONCRETE", "FORMWORK", "REBAR", "PILE_LENGTH", "PILE_COUNT"} <= kinds, (
        f"schema 2 promises the kinds R-TO-035 grades; this golden carries {sorted(kinds)}"
    )
    components = {row.get("component") for row in golden["rows"] if row["kind"] == "REBAR"}
    assert components <= {"NET", "LAP"} and components, (
        f"REBAR rows must be billed as NET and LAP components (AM-03 a); got {sorted(map(str, components))}"
    )
    assert golden_corpus.declares(BBS_REL), (
        f"a schema-2 golden owes {BBS_REL} beside it (AM-01); fixtures/{name}/manifest.json "
        "promises no such file"
    )
    golden_corpus.require(BBS_REL)


def test_the_m3_gate_cells_are_all_filled_by_rows(golden_corpus) -> None:
    """A corpus that promises a cell matrix is graded on it — deleting the file is not an excuse.

    P4a deleted `fixtures/rcc6-bnbc/cells.json` and the lane went green with one more skip. The
    manifest still promised it, so that is now a failure naming the file.
    """
    name = golden_corpus.root.name
    if not golden_corpus.declares(CELLS_REL):
        assert not golden_corpus.path(CELLS_REL).is_file(), (
            f"fixtures/{name}/{CELLS_REL} is on the tree and its manifest does not declare it — "
            "the M3 gate is graded off the manifest, so an undeclared matrix is graded by nothing"
        )
        return
    golden_corpus.require(CELLS_REL)
    cells = golden_corpus.read_json(CELLS_REL)["cells"]
    rows = _golden(golden_corpus)["rows"]
    empty = [
        entry["cell"]
        for entry in cells
        if not any(all(row.get(k) == v for k, v in entry["cell"].items()) for row in rows)
    ]
    assert empty == [], f"cells the golden leaves empty: {empty}"
    assert len(cells) == M3_CELLS, (
        f"the M3 matrix is {M3_CELLS} cells; fixtures/{name}/{CELLS_REL} carries {len(cells)}"
    )


def test_the_generator_the_manifest_pins_is_on_the_tree_and_its_paths_agree(golden_corpus) -> None:
    """The golden is evidence only while the generator that minted it is the generator on the tree.

    The manifest says which generator that is, and in which of the two shapes the tree carries: a
    package (`modules`), whose two independent paths are re-run here through its `selfcheck` since
    `python -m fixtures.gen.<name>` offers no `--check` flag; or a single file (`path`) pinned by
    digest, whose second path is the drawn-geometry recomputation in test_rcc6_golden.py. Neither
    arm skips: a manifest that names a generator the tree does not carry fails by name.
    """
    name = golden_corpus.root.name
    generator = golden_corpus.manifest().get("generator")
    assert isinstance(generator, dict) and generator, (
        f"fixtures/{name}/manifest.json names no generator — the corpus claims no author"
    )
    modules = generator.get("modules")
    if not isinstance(modules, dict):
        relative = str(generator["path"])
        path = REPO_ROOT / relative
        assert path.is_file(), (
            f"{relative}, the generator fixtures/{name}/manifest.json pins, is not on the tree"
        )
        assert _sha256(path) == generator["sha256"], (
            f"{relative} is not the generator that minted fixtures/{name}/: it hashes to "
            f"{_sha256(path)}, the manifest pins {generator['sha256']}"
        )
        return
    package = REPO_ROOT / "fixtures" / "gen" / name.replace("-", "_")
    relative = f"fixtures/gen/{package.name}/{SELFCHECK_REL}"
    assert (package / SELFCHECK_REL).is_file(), (
        f"{relative} is not on the tree, and fixtures/{name}/manifest.json declares a generator "
        "package whose two paths this lane re-runs"
    )
    if str(REPO_ROOT) not in sys.path:
        sys.path.insert(0, str(REPO_ROOT))
    selfcheck = importlib.import_module(f"fixtures.gen.{package.name}.{SELFCHECK_REL.removesuffix('.py')}")

    report = selfcheck.run()
    assert report["cells"] == f"{M3_CELLS}/{M3_CELLS}", (
        f"the selfcheck fills {report['cells']} of the M3 cells"
    )
    assert report["rows_per_kind"]["REBAR"] > 0, "the selfcheck sees no REBAR rows"
