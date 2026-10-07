"""A BOQ Item's description, the machine's sentence `{code, params}` (S16-B; M1.md C13), worded on
the web by S16-W3 under `web/src/messages/boq/`:

- `boq.item.rcc` {strength_mpa, mix, class}; `boq.item.formwork` {class}; `boq.item.rebar` {grade,
  class}, `class` the Item's group (its Takeoff Step, "columns");
- `boq.item.allowance` {step}, for an allowance line.

The kind is read from the item code's family prefix (RCC-, FW-, REBAR-) until measurement's BOQ Items
carry their `description_template` (C11); an Item of another kind has no description yet (None). The
strength is the lines' `strength_mpa` where measurement gives it, else empty: Step 2's choice is not
in this slice.
"""

from collections.abc import Sequence
from typing import Any

RCC = "boq.item.rcc"
FORMWORK = "boq.item.formwork"
REBAR = "boq.item.rebar"
ALLOWANCE = "boq.item.allowance"

Description = dict[str, Any]


def of_item(item_code: str, group: str, lines: Sequence[Any]) -> Description | None:
    family, _, rest = item_code.partition("-")
    if family == "RCC":
        mix = rest.partition("-")[2]
        strength = _first(lines, "strength_mpa")
        return _said(RCC, strength_mpa=strength, mix=mix, **{"class": group})
    if family == "FW":
        return _said(FORMWORK, **{"class": group})
    if family == "REBAR":
        return _said(REBAR, grade=_first(lines, "grade") or rest, **{"class": group})
    return None


def of_allowance(step: str) -> Description:
    return _said(ALLOWANCE, step=step)


def _said(code: str, **params: str) -> Description:
    return {"code": code, "params": params}


def _first(lines: Sequence[Any], name: str) -> str:
    for line in lines:
        value = getattr(line, name, None)
        if value not in (None, ""):
            return str(value)
    return ""
