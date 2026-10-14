"""The placed-view lint's units (M1-00; docs/plans/M1.md C4, A6): which `ViewArtefact` calls it
refuses."""

import subprocess
from pathlib import Path

import pytest

from tools.lint import placed_view

POSITIONAL = "ViewArtefact('v', 's', artefact, {view}, {placement}, ('floor_1',), ('columns',))\n"


@pytest.mark.parametrize(
    "source",
    [
        "ViewArtefact(view_id='v', view=None, placement=placed)\n",
        "ViewArtefact(view_id='v', view=candidate, placement=None)\n",
        "types.ViewArtefact(view=None, placement=placed)\n",
        POSITIONAL.format(view="None", placement="placed"),
        POSITIONAL.format(view="candidate", placement="None"),
    ],
)
def test_a_view_artefact_without_its_view_or_placement_is_refused(source: str) -> None:
    [line] = placed_view.unplaced(source, "t.py")

    assert line.startswith("t.py:1: ViewArtefact(")


@pytest.mark.parametrize(
    "source",
    [
        "ViewArtefact(view_id='v', view=candidate, placement=placed)\n",
        POSITIONAL.format(view="candidate", placement="placed"),
        "OtherArtefact(view=None)\n",
        "ViewArtefact(**fields)\n",
    ],
)
def test_a_placed_view_artefact_passes(source: str) -> None:
    assert placed_view.unplaced(source, "t.py") == []


def test_both_fields_none_are_two_findings() -> None:
    assert len(placed_view.unplaced("ViewArtefact(view=None, placement=None)\n", "t.py")) == 2


def test_with_no_file_it_reads_the_family_acceptance_tests_git_tracks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    family = tmp_path / "engine/families/pile/tests/acceptance/t37/test_piles.py"
    elsewhere = tmp_path / "engine/families/pile/tests/test_units.py"
    for path in (family, elsewhere):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("ViewArtefact(view=None, placement=placed)\n", encoding="utf-8")
    subprocess.run(["git", "init", "-q", str(tmp_path)], check=True)
    subprocess.run(["git", "-C", str(tmp_path), "add", "."], check=True)
    monkeypatch.chdir(tmp_path)

    assert placed_view.main([]) == 1
    assert capsys.readouterr().out.splitlines() == [
        (
            "engine/families/pile/tests/acceptance/t37/test_piles.py:1: ViewArtefact(view=None): a "
            "family's acceptance test gives every view and its PlacedView (docs/plans/M1.md C4)"
        )
    ]
