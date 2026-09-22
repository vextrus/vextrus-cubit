"""Reconciling the two passes: a refusal per class per sheet, returned as data (L-CAD-04).

A shortfall does not refuse the sheet and never raises. It names the class it lost and the space it
lost it on, and the caller carries the list.
"""

from __future__ import annotations

from collections.abc import Iterable
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

    def detail(self) -> str:
        """What was refused and what the two passes said, naming both the sheet and the class.

        The sentence without the reason on the front: beside a note code that already names the
        class of loss (`note_code`), saying the reason twice in one line says it neither time.
        """
        return (
            f"{self.dxftype} is refused on {self.space} — "
            f"the census counted {self.census}, the conversion carried {self.converted}"
        )

    def message(self) -> str:
        """The refusal in words, opening with the rule that made it."""
        return f"{self.reason}: {self.detail()}"

    @property
    def lost(self) -> int:
        """How many of this class the conversion did not carry across.

        A shortfall loses the difference. An unnamed class loses all of it: nothing on the other
        side can be matched to a class nothing can name, so what the census counted is what no
        geometry in the artifact stands for.
        """
        if self.reason == UNKNOWN_ENT:
            return self.census
        return max(self.census - self.converted, 0)

    def note_code(self) -> str:
        """The code this refusal is noted under beside the artifact (`report.py`'s closed table).

        One spelling per side: the reason names the rule here, `report.py` names the class of loss,
        and `cad/tests/dwg/test_dwg_reconcile.py` holds the two together.
        """
        return f"CONVERSION_{self.reason}"


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


def losses_by_space(refused: Iterable[RefusedClass]) -> dict[str, dict[str, int]]:
    """Every refused class as a count of what was lost, per space and per class.

    The shape the artifact's counters keep a loss in (R-TO-001): space → DXF class → how many. Pure,
    sorted both ways, and empty where nothing was lost — a conversion that reconciled cleanly adds
    no key to any artifact.
    """
    losses: dict[str, dict[str, int]] = {}
    for entry in refused:
        if entry.lost <= 0:
            continue
        losses.setdefault(entry.space, {})[entry.dxftype] = entry.lost
    return {space: dict(sorted(types.items())) for space, types in sorted(losses.items())}
