"""manifest.json: what the corpus is, who minted it, and what it promises.

It pins every generator module (and the F-RCC6-BNBC model the structure is read from) by sha256,
names every output with its sha256, carries the sheet roster with the views each sheet opens with,
the selfcheck and validate reports, the size budget, and what tranche 1 does NOT carry — so no
check is left armed for a file the corpus does not promise (the roof plan, the DWG and the PDF are
tranche 2 and are promised nowhere).
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from .. import model as M
from .sheets import IDENTITY, PAPER_MM, Sheet

MB = 1024 * 1024
#: The corpus's own budget (the F-ARCH spec's 25 MB cap is for the whole set with its DWG, PDF and
#: tile patterns; tranche 1 is one DXF and its JSON).
CAPS_MB = {"corpus_total": 8, "single_file": 4}


def _sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def modules(package: Path) -> dict[str, str]:
    return {
        p.relative_to(package).as_posix(): _sha(p.read_bytes())
        for p in sorted(package.rglob("*"))
        if p.is_file() and p.suffix in (".py", ".json") and "__pycache__" not in p.parts
    }


def compose(*, package: Path, root: Path, sheets: list[Sheet], written: dict[str, bytes], selfcheck: dict[str, Any],
            validate: dict[str, Any]) -> dict[str, Any]:
    outputs = {name: _sha(data) for name, data in sorted(written.items())}
    total = sum(len(b) for b in written.values())
    largest = max(written.items(), key=lambda kv: len(kv[1]))
    structure = root / "fixtures" / "gen" / "rcc6_bnbc" / "model.py"
    return {
        "fixture": "F-ARCH",
        "schema": 2,
        "discipline": "ARCHITECTURAL",
        "tranche": 1,
        "building": "F-RCC6-BNBC's Bashundhara G+6: the architect's set of the same building (DECISIONS.md A-01)",
        "generator": {"path": "fixtures/gen/arch/", "modules": modules(package)},
        "structure": {
            "path": "fixtures/gen/rcc6_bnbc/model.py",
            "sha256": _sha(structure.read_bytes()),
            "read": "module constants (grid, levels, chamfer, balcony, sunken panels, ducts, column stacks) and, "
                    "read-only, build()'s shear walls, beams, slab panels and S-25 lintels",
        },
        "identity": IDENTITY,
        "units": {"insunits": 4, "unit": "mm", "sizes_written": "feet-inches"},
        "conventions": M.CONVENTIONS,
        "sheets": [
            {
                "number": s.number,
                "title": s.title,
                "size": s.size,
                "page_mm": list(PAPER_MM[s.size]),
                "layout_name": s.layout_name,
                "views": [{"caption": v.caption, "scale": v.scale, "expect": v.expect} for v in s.views],
                "traps": s.traps,
            }
            for s in sheets
        ],
        "outputs": outputs,
        "selfcheck": selfcheck,
        "validate": validate,
        "regenerable": {
            "model.json": "a plain-data dump of model.build() for readers without Python; `python -m "
                          "fixtures.gen.arch` rewrites it byte for byte (not a source)",
        },
        "size_budget": {
            "caps_mb": CAPS_MB,
            "corpus_mb": round(total / MB, 3),
            "largest_file": {"name": largest[0], "mb": round(len(largest[1]) / MB, 3)},
            "files": len(written) + 1,
            "test": "cad/tests/arch/test_arch_size.py",
        },
        "not_in_tranche_1": {
            "roof plan, elevations, stair detail, toilet details, site plan, door & window and floor-finish "
            "theme rows": "tranche 2 (F-ARCH spec §8)",
            "DWG": "tranche 2; this manifest promises none, so no check is armed for one",
            "vector PDF": "tranche 2; this manifest promises none",
            "model-space frame matrix and an inch-unit twin": "tranche 2: the real sets' frame matrix and "
            "inch units are conventions the product meets on real drawings; tranche 1 is one paper-layout DXF in mm",
        },
    }
