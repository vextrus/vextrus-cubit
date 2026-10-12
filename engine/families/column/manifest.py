"""The column family's manifest (docs/plans/M1.md C4; session 16's contract, column)."""

from engine.families.types import FactSpec, Manifest

MANIFEST = Manifest(
    key="column",
    part="structural",
    step="columns",
    identity_rule="grid_point",
    ifc_class="IfcColumn",
    ifc_predefined_type="COLUMN",
    classification=(("uniclass2015", "EF_20_10"),),
    facts=(
        FactSpec(key="vx.column.section_b", kind="dimension", core=True),
        FactSpec(key="vx.column.section_d", kind="dimension", core=True),
    ),
    rule_codes=("F1", "FW2", "R2"),
    jev_nodes=(),
    conventions=("families.column.layers", "families.column.label_patterns"),
    n_rule="marks_x_view_storeys",
    stage="slab_casting",
)
