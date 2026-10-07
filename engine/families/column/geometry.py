"""A column's 3D geometry (docs/plans/M1.md C4, C17): one prism, its owned solid's section from z0 to z1.

The volume of the prism is the measure's F1 concrete (b x d x h), so the viewer and the BOQ agree.
"""

from engine.families.types import ElementFacts, OwnedSolid, Primitive


def geometry(facts: ElementFacts, owned: OwnedSolid) -> tuple[Primitive, ...]:
    """The column's prism: its owned polygon, metres, from the junction's z0 to z1."""
    return (Primitive(kind="prism", polygon=tuple(owned.polygon), z0=owned.z0, z1=owned.z1),)
