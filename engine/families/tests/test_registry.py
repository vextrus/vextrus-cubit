"""The registry finds each family package by its `manifest.py` and orders them by Takeoff Step."""

import sys
import textwrap
from collections.abc import Iterator
from pathlib import Path

import pytest

from engine.families import registry

MANIFEST = """
from engine.families.types import Manifest

MANIFEST = Manifest(
    key={key!r}, part="structural", step={step!r}, identity_rule="label", ifc_class="IfcColumn",
    ifc_predefined_type="COLUMN", classification=(), facts=(), rule_codes=(), jev_nodes=(),
    conventions=(), n_rule="none", stage="",
)
"""


def write_family(root: Path, key: str, step: str) -> None:
    package = root / key
    package.mkdir()
    (package / "__init__.py").write_text("")
    (package / "manifest.py").write_text(textwrap.dedent(MANIFEST.format(key=key, step=step)))


@pytest.fixture
def families_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    import engine.families

    monkeypatch.setattr(registry, "_ROOT", tmp_path)
    monkeypatch.setattr(engine.families, "__path__", [str(tmp_path)])
    yield tmp_path
    for name in [n for n in sys.modules if n.startswith("engine.families.") and "fam_" in n]:
        del sys.modules[name]


def test_families_come_in_takeoff_step_order_and_a_folder_without_manifest_is_skipped(
    families_root: Path,
) -> None:
    write_family(families_root, "fam_column", "columns")
    write_family(families_root, "fam_storey", "storeys")
    write_family(families_root, "fam_grid", "grid")
    (families_root / "fam_helpers").mkdir()
    (families_root / "fam_helpers" / "__init__.py").write_text("")

    found = registry._discover()

    assert [registry.manifest_of(f).key for f in found] == ["fam_storey", "fam_grid", "fam_column"]


def test_get_names_a_family_by_its_key_and_refuses_an_unknown_one(
    families_root: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    write_family(families_root, "fam_column", "columns")
    monkeypatch.setattr(registry, "_FAMILIES", registry._discover())

    assert registry.get("fam_column").__name__ == "engine.families.fam_column"
    with pytest.raises(KeyError):
        registry.get("fam_beam")
