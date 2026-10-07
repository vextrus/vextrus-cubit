"""A grid line is measured by nothing: it places the Elements that are (docs/plans/M1.md C4)."""

from engine.families.types import ElementFacts, LineDraft, OwnedSolid, RuleSetData


def measure(facts: ElementFacts, owned: OwnedSolid, rules: RuleSetData) -> tuple[LineDraft, ...]:
    return ()
