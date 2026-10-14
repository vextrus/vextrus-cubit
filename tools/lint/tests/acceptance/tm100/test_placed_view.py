"""M1-00, the contract freeze: the placed-view lint (docs/plans/M1.md C4: "M1-00's lint
(`tools/lint/placed_view.py`) refuses `ViewArtefact(view=None)` in a family's acceptance tests"; the
ticket's test: "the lint fails on `ViewArtefact(view=None)` in a family acceptance test"). In the slice a
fixture's `view=None` hid a reader that read nothing.

The lint is run as the repository's lints are, `python -m tools.lint.placed_view FILE...`, from a
checkout-shaped folder holding a family's acceptance test (a fixture file written here): a file with a
`ViewArtefact(view=None)` fails it (exit 1, naming the file); one whose views are placed passes (exit 0).
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
FAMILY_TEST = "engine/families/column/tests/acceptance/t36/test_columns.py"

UNPLACED = """\
from engine.families.types import ViewArtefact


def test_reads_the_columns(artefact):
    view = ViewArtefact(
        view_id="view-1",
        sheet_id="sheet-1",
        artefact=artefact,
        view=None,
        placement=None,
        storeys=("floor_1",),
        steps=("columns",),
    )
    assert view.view_id == "view-1"
"""

PLACED = """\
from decimal import Decimal

from engine.families.types import PlacedView, ViewArtefact


def test_reads_the_columns(artefact, candidate):
    placement = PlacedView(
        model_box=((Decimal("0"), Decimal("0")), (Decimal("1000"), Decimal("1000"))),
        paper_to_model=tuple(Decimal(term) for term in ("1", "0", "0", "1", "0", "0")),
        scale=Decimal("100"),
        drawing_unit="mm",
    )
    view = ViewArtefact(
        view_id="view-1",
        sheet_id="sheet-1",
        artefact=artefact,
        view=candidate,
        placement=placement,
        storeys=("floor_1",),
        steps=("columns",),
    )
    assert view.view_id == "view-1"
"""


def lint(folder: Path, source: str) -> subprocess.CompletedProcess[str]:
    path = folder / FAMILY_TEST
    path.parent.mkdir(parents=True)
    path.write_text(source, encoding="utf-8")
    environment = {**os.environ, "PYTHONPATH": str(ROOT)}
    return subprocess.run(
        [sys.executable, "-m", "tools.lint.placed_view", FAMILY_TEST],
        cwd=folder,
        env=environment,
        capture_output=True,
        text=True,
        check=False,
    )


def test_a_family_acceptance_test_with_view_none_fails_the_lint(tmp_path: Path) -> None:
    done = lint(tmp_path, UNPLACED)

    assert done.returncode == 1, (done.returncode, done.stdout, done.stderr)
    assert FAMILY_TEST in done.stdout + done.stderr, (done.stdout, done.stderr)


def test_a_family_acceptance_test_whose_views_are_placed_passes_the_lint(tmp_path: Path) -> None:
    done = lint(tmp_path, PLACED)

    assert done.returncode == 0, (done.returncode, done.stdout, done.stderr)
