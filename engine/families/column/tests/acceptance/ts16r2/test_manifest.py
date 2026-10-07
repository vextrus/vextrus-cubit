"""S16-R2: the column family's manifest (docs/plans/M1.md C4; session 16's contract, column)."""

from engine.families.column.manifest import MANIFEST


def test_the_column_family_is_keyed_column_and_read_in_the_columns_step() -> None:
    assert MANIFEST.key == "column"
    assert MANIFEST.step == "columns"


def test_a_column_is_identified_by_its_grid_point() -> None:
    assert MANIFEST.identity_rule == "grid_point"


def test_a_column_is_structural_and_an_ifc_column() -> None:
    assert MANIFEST.part == "structural"
    assert MANIFEST.ifc_class == "IfcColumn"


def test_a_column_is_classified_uniclass_ef_20_10() -> None:
    assert ("uniclass2015", "EF_20_10") in MANIFEST.classification
