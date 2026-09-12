"""E-fixture §3.10 checks over the composed sheets and the written bytes — run before any byte
lands under fixtures/rcc6-bnbc/ (failure writes nothing). Wave A's selfcheck.run() covers checks
1, 3, 4, 6-golden, 7; this package adds the drawing side:

  2. every drawn string parses in its declared family or names a registered trap (notation);
  5. every printed fact equals its authored value unless a registered trap (facts), and every
     view's content fits its window on the paper (fit), and no drawn string is a golden
     quantity while S-26's total is its sample's row sum × 1.017 (wall);
  6. the sanity tally re-read with ezdxf before writing equals the tally taken while placing,
     per (space, type), and the DWG expected census = tally − named losses (tally);
  8. two in-process builds are byte-identical except the DWG; every trap resolves to a live
     handle (determinism, traps).

`run(sheets, dxf_paths, ...)` is called by __main__ with everything in a scratch directory.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import facts, fit, notation, tally, traps, wall

__all__ = ["facts", "fit", "notation", "run", "tally", "traps", "wall"]


def run(
    world: dict[str, Any],
    sheets: list[Any],
    scratch: Path,
    written: dict[str, bytes],
    traps_doc: dict[str, Any],
) -> dict[str, Any]:
    """Every check, in order; the first failure raises with the check's name."""
    report: dict[str, Any] = {}
    report["notation"] = notation.check(sheets, traps_doc)
    report["facts"] = facts.check(world, sheets, traps_doc)
    report["fit"] = fit.check(sheets)
    report["wall"] = wall.check(sheets, written, traps_doc)
    report["tally"] = tally.check(scratch, written)
    report["traps"] = traps.check(scratch, traps_doc, written)
    return report


def load_traps(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
