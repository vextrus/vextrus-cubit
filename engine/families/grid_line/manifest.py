"""The grid_line family's manifest (docs/plans/M1.md C4): a grid line is identified by its label."""

from engine.families.types import FactSpec, Manifest

MANIFEST = Manifest(
    key="grid_line",
    part="structural",
    step="grid",
    identity_rule="label",
    ifc_class="IfcGridAxis",
    ifc_predefined_type="",
    classification=(),
    facts=(FactSpec(key="vx.grid_line.axis", kind="line", core=True),),
    rule_codes=(),
    jev_nodes=(),
    conventions=("grid.layers", "grid.bubble_blocks"),
    n_rule="labels_plus_code",
    stage="setting_out",
)
