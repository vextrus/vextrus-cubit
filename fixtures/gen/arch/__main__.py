"""Mint the F-ARCH corpus — the golden, the trap registry with live handles, the drawing and its
sanity tally — under `fixtures/arch/`.

    uv run --project cad --group fixtures python -m fixtures.gen.arch [--out DIR] [--stage S]

    --stage all     (default) everything
    --stage golden  takeoff.golden.json, cells.json and model.json alone (no drawing)

A failure writes nothing: every byte is built in a temporary directory, the selfcheck and every
validate check run against it there, the drawing is written a SECOND time and compared byte for
byte, and only then is anything written under `--out`, each file announced as
`wrote <relative> sha256=<hex>`.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import tempfile
import time
from decimal import Decimal
from pathlib import Path
from typing import Any

from . import golden, selfcheck
from . import model as M

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]

GOLDEN_FILES = ("takeoff.golden.json", "cells.json", "model.json")
EDITION = "IS1200_IN @ 2027.04 (openingDeductionMinM2 = finishOpeningDeductionMinM2 = 0.1 m², strictly greater)"


def plain(v: Any) -> Any:
    if isinstance(v, Decimal):
        return format(v.normalize(), "f") if v == v.to_integral_value() else format(v, "f")
    if isinstance(v, dict):
        return {str(k): plain(x) for k, x in v.items()}
    if isinstance(v, list | tuple):
        return [plain(x) for x in v]
    return v


def encode(data: Any) -> bytes:
    return (json.dumps(data, indent=1, ensure_ascii=False) + "\n").encode("utf-8")


def golden_documents(world: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, bytes]:
    return {
        "takeoff.golden.json": encode(
            {
                "fixture": "F-ARCH",
                "schema": 2,
                "provenance": "HAND_FROM_AUTHORED_SOURCE",
                "edition": EDITION,
                "building": "the Bashundhara G+6 of F-RCC6-BNBC: its architectural set, tranche 1 (GF and 1F-6F)",
                "conventions": M.CONVENTIONS,
                "rows": rows,
            }
        ),
        "cells.json": (HERE / "cells.json").read_bytes(),
        "model.json": encode(plain(world)),
    }


def draw(world: dict[str, Any], scratch: Path) -> dict[str, Any]:
    from .emit import blocks as _blocks
    from .emit import dxf as _dxf
    from .emit import sheets as _sheets

    sheets = _sheets.compose(world)
    written = _dxf.write(sheets, _blocks.library(_sheets.door_widths(world)), scratch)
    doc = json.loads((HERE / "traps.json").read_text(encoding="utf-8"))
    for t in doc["traps"]:
        t["handle"] = written["trap_handles"].get(t["id"])
    return {"sheets": sheets, "dxf": written, "traps": doc}


def build(world: dict[str, Any], rows: list[dict[str, Any]], report: dict[str, Any]) -> dict[str, bytes]:
    from . import validate as _validate
    from .emit import manifest as _manifest

    with tempfile.TemporaryDirectory(prefix="arch-") as tmp:
        scratch = Path(tmp)
        drawn = draw(world, scratch)
        path = drawn["dxf"]["path"]
        written = golden_documents(world, rows)
        written["arch.dxf"] = path.read_bytes()
        written["traps.json"] = encode(drawn["traps"])
        written["sanity.json"] = encode(
            {
                "fixture": "F-ARCH",
                "generator": "fixtures/gen/arch/",
                "counted_as": "every entity of every layout but ATTRIB/ATTDEF/SEQEND/VERTEX/VIEWPORT, as placed",
                "drawn": {"arch.dxf": drawn["dxf"]["tally"]},
            }
        )
        families = sorted({r["family"] for r in drawn["dxf"]["strings"]})
        written["notation.corpus.json"] = encode(
            {"fixture": "F-ARCH", "families": families, "strings": drawn["dxf"]["strings"]}
        )
        sheets = drawn["sheets"]
        layout_of = {s.number: s.layout_name for s in sheets}
        report_v = {
            "tally": _validate.tally(path, drawn["dxf"]["tally"]),
            "traps": _validate.traps(path, drawn["traps"], layout_of),
            "strings": _validate.strings(drawn["dxf"]["strings"], set(world["marks"])),
            "captions": _validate.captions(
                drawn["dxf"]["strings"], {s.number: s.title for s in sheets},
                {s.number: [v.caption for v in s.views] for s in sheets},
            ),
        }
        second = scratch / "_second"
        second.mkdir()
        again = draw(M.build(), second)
        assert again["dxf"]["path"].read_bytes() == written["arch.dxf"], "determinism: arch.dxf differs on rebuild"
        assert again["traps"] == drawn["traps"], "determinism: the trap handles moved between two writings"
        report_v["determinism"] = {"rebuilt": ["arch.dxf", "traps.json"]}
        written["manifest.json"] = encode(
            _manifest.compose(package=HERE, root=ROOT, sheets=sheets, written=written, selfcheck=report,
                              validate=report_v)
        )
    return written


def main(out: Path, stage: str = "all") -> dict[str, Any]:
    """Mint the corpus into `out`. Nothing is written until every check has passed."""
    out = Path(out)
    world = M.build()
    rows = golden.compute(world)
    report = selfcheck.run(world)
    if stage == "golden":
        written = golden_documents(world, rows)
    elif stage == "all":
        written = build(world, rows, report)
    else:
        raise ValueError(f"--stage is 'all' or 'golden', not {stage!r}")
    out.mkdir(parents=True, exist_ok=True)
    for name in sorted(written):
        target = out / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(written[name])
        print(f"wrote {name} sha256={hashlib.sha256(written[name]).hexdigest()}")
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", default=str(ROOT / "fixtures" / "arch"))
    ap.add_argument("--stage", default="all", choices=("all", "golden"))
    ap.add_argument("--timing", action="store_true", help="print the wall time to stderr")
    args = ap.parse_args()
    started = time.monotonic()
    try:
        main(Path(args.out), args.stage)
    except Exception as error:  # a failure writes nothing
        print(f"fixtures.gen.arch: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    if args.timing:
        print(f"built in {time.monotonic() - started:.1f}s", file=sys.stderr)
