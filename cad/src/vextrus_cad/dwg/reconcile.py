"""Reconciling the two passes: a refusal per class per sheet, returned as data (L-CAD-04).

A shortfall does not refuse the sheet and never raises. It names the class it lost and the space it
lost it on, and the caller carries the list.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

#: The conversion carried fewer of this class on this sheet than the census counted.
SHORTFALL: Final = "SHORTFALL"

#: The census itself could not name the class: LibreDWG read an entity it has no name for, so
#: nothing downstream can say what the conversion did or did not carry across.
UNKNOWN_ENT: Final = "UNKNOWN_ENT"


@dataclass(frozen=True)
class RefusedClass:
    """One entity class refused on one sheet, by name."""

    space: str
    dxftype: str
    reason: str
    census: int
    converted: int

    def message(self) -> str:
        """The refusal in words, naming both the sheet and the class it is about."""
        return (
            f"{self.reason}: {self.dxftype} is refused on {self.space} — "
            f"the census counted {self.census}, the conversion carried {self.converted}"
        )


def reconcile(
    census: dict[str, dict[str, int]],
    geometry: dict[str, dict[str, int]],
) -> list[RefusedClass]:
    """Every class the conversion lost or could not name, sorted by (space, dxftype).

    Pure: nothing is read from disk and neither tally is touched. A class the conversion matched or
    over-produced is no loss, and a space the census never named can be short of nothing.
    """
    refused: list[RefusedClass] = []
    for space, types in census.items():
        carried = geometry.get(space, {})
        for dxftype, counted in types.items():
            converted = carried.get(dxftype, 0)
            if dxftype == UNKNOWN_ENT:
                # An unnamed class is refused for what it is, not for how many of it survived: the
                # shortfall arithmetic below cannot speak about a class nothing can name.
                refused.append(RefusedClass(space, dxftype, UNKNOWN_ENT, counted, converted))
            elif converted < counted:
                refused.append(RefusedClass(space, dxftype, SHORTFALL, counted, converted))
    return sorted(refused, key=lambda entry: (entry.space, entry.dxftype))
