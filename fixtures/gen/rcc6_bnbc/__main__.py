"""Write fixtures/rcc6-bnbc/{takeoff.golden.json, bbs.golden.json, cells.json, traps.json, site.json,
model.json, manifest.json} after the self-checks pass (E-fixture §3.10: failure writes nothing).

    uv run --project cad --group fixtures python -m fixtures.gen.rcc6_bnbc [--out DIR]
"""

from __future__ import annotations

import argparse
import hashlib
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import golden, selfcheck
from . import model as M

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
GENERATOR_MODULES = [
    "model.py",
    "golden.py",
    "golden_check.py",
    "selfcheck.py",
    "__main__.py",
    "cells.json",
    "traps.json",
]


def plain(v: Any) -> Any:
    if isinstance(v, Decimal):
        return format(v, "f")
    if isinstance(v, dict):
        return {str(k): plain(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [plain(x) for x in v]
    if isinstance(v, set):
        return sorted(plain(x) for x in v)
    return v


def dump(path: Path, data: Any) -> str:
    text = json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False) + "\n"
    path.write_text(text, encoding="utf-8")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def main(out: Path) -> dict[str, Any]:
    world = M.build()
    report = selfcheck.run(world)
    rows, bbs = golden.compute(world)
    out.mkdir(parents=True, exist_ok=True)
    traps = json.loads((HERE / "traps.json").read_text())
    cells = json.loads((HERE / "cells.json").read_text())
    outputs: dict[str, str] = {}
    outputs["takeoff.golden.json"] = dump(
        out / "takeoff.golden.json",
        {
            "fixture": "F-RCC6-BNBC",
            "schema": 2,
            "provenance": "HAND_FROM_AUTHORED_SOURCE",
            "edition": "BNBC2020_BD @ 2026.07",
            "drawing_overrides": {
                "lap_tension": "50d",
                "lap_compression": "40d",
                "ld": "50d (top 65d) — S-02 table for fy 500 / f'c 3500",
                "stirrup_hook": "135 deg, 10d, min 75 mm",
                "cover_mm": plain(M.COVER),
            },
            "conventions": M.CONVENTIONS,
            "site": M.SITE,
            "rows": rows,
        },
    )
    outputs["bbs.golden.json"] = dump(out / "bbs.golden.json", bbs)
    outputs["cells.json"] = dump(out / "cells.json", cells)
    outputs["traps.json"] = dump(out / "traps.json", traps)
    outputs["site.json"] = dump(
        out / "site.json",
        {
            "fixture": "F-RCC6-BNBC",
            "facts": M.SITE,
            "source": "S-01 general notes + S-04 pile layout (EGL, cut-off); the working allowance, depth extra and blinding are the IS1200_IN seed values the notes restate",
        },
    )
    outputs["model.json"] = dump(
        out / "model.json", plain({k: v for k, v in world.items() if k != "regions"})
    )
    generator = {
        name: hashlib.sha256((HERE / name).read_bytes()).hexdigest()
        for name in GENERATOR_MODULES
    }
    dump(
        out / "manifest.json",
        {
            "fixture": "F-RCC6-BNBC",
            "schema": 2,
            "generator": {"path": "fixtures/gen/rcc6_bnbc/", "modules": generator},
            "conventions": M.CONVENTIONS,
            "outputs": outputs,
            "selfcheck": report,
            "wave": "A (N0/N1): model + golden + validators + traps; sheets/DXF/DWG/PDF/raster are Wave B",
        },
    )
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "fixtures" / "rcc6-bnbc"))
    r = main(Path(ap.parse_args().out))
    print(json.dumps(r, indent=2))
