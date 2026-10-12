"""A grid line is a setting-out line, not a solid: it draws no primitive (docs/plans/M1.md C4)."""

from engine.families.types import ElementFacts, OwnedSolid, Primitive


def geometry(facts: ElementFacts, owned: OwnedSolid) -> tuple[Primitive, ...]:
    return ()
