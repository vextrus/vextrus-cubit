"""A column's Measurement Lines (docs/plans/M1.md C11; session 16's contract, column).

- **F1 concrete:** b x d x h in m3, h the owned solid's height (the junction stops a column at the slab
  soffit: C11's worked example, a 3.048 m storey under a 127 mm slab, h = 2.921 m).
- **FW2 formwork:** the four faces, 2 (b + d) x h in m2.
- **R2 rebar by ratio:** the concrete line's m3 x the Rule Set's column Rebar Ratio (kg/m3), with
  `rebar_basis: "by_ratio"`; no ratio in the Rule Set, no rebar line.

b and d are the column's confirmed section (its size label, in metres); a section not confirmed falls
back to the owned solid's extent. Every quantity is a Decimal rounded once, to six places, here.
"""

from collections.abc import Mapping
from decimal import ROUND_HALF_UP, Decimal

from engine.families.types import ElementFacts, LineDraft, OwnedSolid, RuleSetData

PLACES = Decimal("0.000001")
"""C11: a Measurement Line's quantity to six places."""


def _round(value: Decimal) -> Decimal:
    return value.quantize(PLACES, rounding=ROUND_HALF_UP)


def _decimal(held: object) -> Decimal | None:
    """A fact's value as a Decimal: bare, or carried as `value` (never a float)."""
    inner = held.get("value") if isinstance(held, Mapping) else getattr(held, "value", held)
    if isinstance(inner, Decimal):
        return inner
    if isinstance(inner, int) and not isinstance(inner, bool):
        return Decimal(inner)
    if isinstance(inner, str):
        try:
            return Decimal(inner)
        except ArithmeticError:
            return None
    return None


def _section(facts: ElementFacts, owned: OwnedSolid) -> tuple[Decimal, Decimal]:
    b = _decimal(facts.values.get("section_b"))
    d = _decimal(facts.values.get("section_d"))
    if b is not None and d is not None and b > 0 and d > 0:
        return b, d
    xs = [Decimal(x) for x, _ in owned.polygon]
    ys = [Decimal(y) for _, y in owned.polygon]
    return max(xs) - min(xs), max(ys) - min(ys)


def measure(facts: ElementFacts, owned: OwnedSolid, rules: RuleSetData) -> tuple[LineDraft, ...]:
    """The column's concrete, formwork and (with a ratio) rebar lines."""
    b, d = _section(facts, owned)
    h = Decimal(owned.z1) - Decimal(owned.z0)
    concrete = _round(b * d * h)
    lines = [
        LineDraft(
            qty_si=concrete,
            unit_si="m3",
            rule_codes=("F1",),
            rebar_basis=None,
            element_id=facts.element_id,
            storey=facts.storey,
            nos=1,
            l_m=b,
            b_m=d,
            h_m=h,
        ),
        LineDraft(
            qty_si=_round(2 * (b + d) * h),
            unit_si="m2",
            rule_codes=("FW2",),
            rebar_basis=None,
            element_id=facts.element_id,
            storey=facts.storey,
            nos=1,
            l_m=2 * (b + d),
            h_m=h,
        ),
    ]
    ratio = rules.rebar_ratios.get(facts.family)
    if ratio is not None:
        lines.append(
            LineDraft(
                qty_si=_round(concrete * Decimal(ratio)),
                unit_si="kg",
                rule_codes=("R2",),
                rebar_basis="by_ratio",
                element_id=facts.element_id,
                storey=facts.storey,
                nos=1,
            )
        )
    return tuple(lines)
