"""Mint the whole F-RCC6-BNBC corpus — the golden JSON, both DXFs, the xref target, the malformed
twin, both DWGs, both vector PDFs and the raster set — under `fixtures/rcc6-bnbc/`.

    uv run --project cad --group fixtures python -m fixtures.gen.rcc6_bnbc [--out DIR] [--stage S]

    --stage all     (default) everything
    --stage golden  the Wave A JSON alone: the fast path the golden tests take

E-fixture §3.10: a failure writes nothing. Every byte is built in a temporary directory, every
check in `validate/` runs against it there, the whole thing is built a SECOND time and compared
byte for byte (§3.9 determinism, the two DWGs exempt — LibreDWG is not byte-stable — and the
rasters exempt because a second raster pass costs more than a minute), and only then is anything
written under `--out`, each file announced as `wrote <relative> sha256=<hex>`.
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

#: What Wave A's six JSON files are, in the order they are written.
GOLDEN_FILES = (
    "takeoff.golden.json",
    "bbs.golden.json",
    "cells.json",
    "traps.json",
    "site.json",
    "model.json",
)

WAVE = (
    "B (N2/N3): the 26 sheets composed once and painted three ways — ezdxf (paper layouts and "
    "model-space frames, plus the xref target and the malformed twin), LibreDWG (both DWGs, judged "
    "by census), reportlab (the TrueType PDF and its stroked twin) — and rasterised four ways"
)

#: A second raster pass costs more than a minute, so determinism is proved on the sheets, the DXFs
#: and the PDFs (which is where every authored byte comes from) and the rasters ride on the PDF.
DETERMINISM_EXEMPT = ("rcc6-bnbc.dwg", "rcc6-bnbc.model.dwg")


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


def encode(data: Any) -> bytes:
    return (json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False) + "\n").encode("utf-8")


def dump(path: Path, data: Any) -> str:
    payload = encode(data)
    path.write_bytes(payload)
    return hashlib.sha256(payload).hexdigest()


def reseed_bbs_trap(bbs: dict[str, Any]) -> None:
    """T-BBS-TOTAL is registered as true row sum vs a printed total 1.7 % high; keep it current."""
    path = HERE / "traps.json"
    traps = json.loads(path.read_text(encoding="utf-8"))
    true = Decimal(bbs["grand_total_kg"])
    for t in traps["traps"]:
        if t["id"] == "T-BBS-TOTAL":
            t["true"], t["printed"] = (
                str(true),
                str((true * Decimal("1.017")).quantize(Decimal("0.001"))),
            )
    path.write_text(
        json.dumps(traps, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


# ---------------------------------------------------------------------------------------------
# Wave A: the golden JSON
# ---------------------------------------------------------------------------------------------


def golden_documents(world: dict[str, Any], rows: list[Any], bbs: dict[str, Any]) -> dict[str, bytes]:
    """The six files Wave A authored, byte for byte as it authored them."""
    cells = json.loads((HERE / "cells.json").read_text(encoding="utf-8"))
    return {
        "takeoff.golden.json": encode(
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
            }
        ),
        "bbs.golden.json": encode(bbs),
        "cells.json": encode(cells),
        "traps.json": (HERE / "traps.json").read_bytes(),
        "site.json": encode(
            {
                "fixture": "F-RCC6-BNBC",
                "facts": M.SITE,
                "source": "S-01 general notes + S-04 pile layout (EGL, cut-off); the working "
                "allowance, depth extra and blinding are the IS1200_IN seed values the notes restate",
            }
        ),
        "model.json": encode(plain({k: v for k, v in world.items() if k != "regions"})),
    }


# ---------------------------------------------------------------------------------------------
# Wave B: the drawings
# ---------------------------------------------------------------------------------------------


def paint(sheets: list[Any], blocks: list[Any], images: dict[str, bytes]) -> dict[str, Any]:
    """Both vector PDFs, with what each pen could not draw."""
    from .emit import pdf as _pdf

    ttf, ttf_report = _pdf.write_report(sheets, blocks, images, "ttf")
    shx, shx_report = _pdf.write_report(sheets, blocks, images, "shx")
    return {
        "rcc6-bnbc.pdf": ttf,
        "rcc6-bnbc.shx.pdf": shx,
        "reports": {"rcc6-bnbc.pdf": ttf_report, "rcc6-bnbc.shx.pdf": shx_report},
    }


def draw(world: dict[str, Any], scratch: Path) -> dict[str, Any]:
    """Compose the sheets and write every drawing file into `scratch`; nothing is checked yet."""
    from .emit import dxf as _dxf
    from .emit import images as _images
    from .emit import sheets as _sheets

    sheets = _sheets.compose(world)
    blocks = _sheets.blocks()
    images = _images.author()
    paper_dxf, tally_paper = _dxf.write_paper(sheets, blocks, images, scratch)
    model_dxf, tally_model = _dxf.write_model_frames(sheets, blocks, images, scratch)
    _dxf.write_arch_xref(scratch)
    malformed, dropped = _dxf.write_malformed(paper_dxf, scratch)
    tally = {paper_dxf.name: tally_paper, model_dxf.name: tally_model}
    # The handles belong to THIS writing, so they are taken before anything else writes a DXF:
    # `emit.dwg` mints its source by writing the same sheets again, with the features LibreDWG
    # loses left out, which would leave a skipped trap with no handle at all (W-06).
    traps_doc = json.loads((HERE / "traps.json").read_text(encoding="utf-8"))
    traps_doc = _dxf.fill_trap_handles(traps_doc, paper_dxf, sheets, tally)
    notation = _dxf.notation_rows(sheets)
    painted = paint(sheets, blocks, images)
    return {
        "sheets": sheets,
        "blocks": blocks,
        "images": images,
        "paper_dxf": paper_dxf,
        "model_dxf": model_dxf,
        "malformed": malformed,
        "dropped_lines": dropped,
        "tally": tally,
        "traps_doc": traps_doc,
        "traps_json": (HERE / "traps.json").read_bytes(),
        "notation": notation,
        "pdf": painted,
    }


def mint_dwg(drawn: dict[str, Any], scratch: Path) -> dict[str, Any]:
    """Both DWGs through LibreDWG, with the census and the named losses the DWG lane reads (W-04).

    The DWG is the one thing this generator cannot author itself; when `emit.dwg` is not on the
    tree yet the corpus is minted without it and the manifest says so, rather than inventing one.
    """
    try:
        from .emit import dwg as _dwg
    except ImportError:
        return {"files": {}, "spec": {}, "named_losses": {}, "canaries": {},
                "note": "emit/dwg.py is not on the tree; no DWG was minted"}
    canaries = _dwg.canary(scratch)
    minted = _dwg.mint(drawn["sheets"], drawn["blocks"], drawn["images"], canaries, scratch)
    return {
        "files": {name: payload for name, payload in minted.items() if isinstance(payload, bytes)},
        "spec": minted["spec"],
        "named_losses": {
            name: spec.get("named_losses", []) for name, spec in sorted(minted["spec"].items())
        },
        "canaries": {feature: bool(result["ok"]) for feature, result in sorted(canaries.items())},
        "note": "",
    }


def check(
    world: dict[str, Any], drawn: dict[str, Any], scratch: Path, written: dict[str, bytes]
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Every validate check, over the composed sheets and the bytes about to be written."""
    from . import validate as _validate

    written["traps.json"] = drawn["traps_json"]
    report = _validate.run(world, drawn["sheets"], scratch, written, drawn["traps_doc"])
    return report, drawn["traps_doc"]


def determinism(world: dict[str, Any], scratch: Path, first: dict[str, bytes]) -> dict[str, Any]:
    """Build the sheets, both DXFs and both PDFs a second time and demand the same bytes."""
    second_scratch = scratch / "_second"
    second_scratch.mkdir(parents=True, exist_ok=True)
    again = draw(world, second_scratch)
    compared: list[str] = []
    for name in (again["paper_dxf"].name, again["model_dxf"].name, "arch-plan.dxf", again["malformed"].name):
        source = second_scratch / name
        assert source.read_bytes() == first[name], f"check 8 (determinism): {name} differs on rebuild"
        compared.append(name)
    for name in ("rcc6-bnbc.pdf", "rcc6-bnbc.shx.pdf"):
        assert again["pdf"][name] == first[name], f"check 8 (determinism): {name} differs on rebuild"
        compared.append(name)
    assert again["traps_json"] == first["traps.json"], (
        "check 8 (determinism): the trap handles moved between two writings of the same sheets"
    )
    compared.append("traps.json")
    return {
        "rebuilt": sorted(compared),
        "exempt": {
            "dwg": "LibreDWG is not byte-stable; the DWG is judged by its census (W-04)",
            "raster": "a second raster pass costs over a minute; the rasters are a pure function "
            "of the vector PDF, which is rebuilt and compared",
        },
    }


def build(out: Path, world: dict[str, Any], rows: list[Any], bbs: dict[str, Any], report: dict[str, Any]) -> dict[str, bytes]:
    """Everything the corpus carries, built and checked in a scratch tree, returned as bytes."""
    from .emit import manifest as _manifest
    from .emit import plan as _plan
    from .emit import raster as _raster
    from .emit import scene as _scene

    del out
    with tempfile.TemporaryDirectory(prefix="rcc6-bnbc-") as tmp:
        scratch = Path(tmp)
        drawn = draw(world, scratch)
        minted = mint_dwg(drawn, scratch)
        rasters, raster_report = _raster.variants(drawn["pdf"]["rcc6-bnbc.pdf"], drawn["sheets"])

        written: dict[str, bytes] = dict(golden_documents(world, rows, bbs))
        for name in (drawn["paper_dxf"], drawn["model_dxf"], drawn["malformed"]):
            written[name.name] = name.read_bytes()
        written["arch-plan.dxf"] = (scratch / "arch-plan.dxf").read_bytes()
        for name, payload in sorted(drawn["images"].items()):
            written[f"images/{name}.png"] = payload
        for name, payload in minted["files"].items():
            written[name] = payload
        written["rcc6-bnbc.pdf"] = drawn["pdf"]["rcc6-bnbc.pdf"]
        written["rcc6-bnbc.shx.pdf"] = drawn["pdf"]["rcc6-bnbc.shx.pdf"]
        written.update(rasters)

        pdf_reports = drawn["pdf"]["reports"]
        sanity = {
            "fixture": _plan.FIXTURE,
            "generator": "fixtures/gen/rcc6_bnbc/",
            "drawn": drawn["tally"],
            "malformed": {"file": drawn["malformed"].name, "dropped_lines": drawn["dropped_lines"]},
            "dwg": minted["spec"],
            "pdf": {
                "rcc6-bnbc.pdf": pdf_reports["rcc6-bnbc.pdf"],
                "rcc6-bnbc.shx.pdf": pdf_reports["rcc6-bnbc.shx.pdf"],
            },
            "raster": {key: raster_report[key] for key in ("r1", "r2", "r2pdf", "r3", "r4")},
        }
        written["sanity.json"] = encode(sanity)

        validate_report, _traps_doc = check(world, drawn, scratch, written)
        written["notation.corpus.json"] = encode(
            {
                "fixture": _plan.FIXTURE,
                "families": list(_scene.FAMILIES),
                "strings": drawn["notation"],
            }
        )
        validate_report["determinism"] = determinism(world, scratch, written)

        written["manifest.json"] = encode(
            _manifest.compose(
                package_root=HERE,
                conventions=M.CONVENTIONS,
                sheets=drawn["sheets"],
                written=written,
                selfcheck_report=report,
                validate_report=validate_report,
                pdf_reports=pdf_reports,
                dwg_report={
                    "spec": minted["spec"],
                    "named_losses": minted["named_losses"],
                    "canaries": minted["canaries"],
                    "note": minted["note"],
                },
                raster_report=raster_report,
                wave=WAVE,
            )
        )
    return written


# ---------------------------------------------------------------------------------------------
# The CLI
# ---------------------------------------------------------------------------------------------


def main(out: Path, stage: str = "all") -> dict[str, Any]:
    """Mint the corpus into `out`. Nothing is written until every check has passed."""
    out = Path(out)
    world = M.build()
    rows, bbs = golden.compute(world)
    reseed_bbs_trap(bbs)
    report = selfcheck.run(world)
    if stage == "golden":
        written = golden_documents(world, rows, bbs)
    elif stage == "all":
        written = build(out, world, rows, bbs, report)
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
    ap.add_argument("--out", default=str(ROOT / "fixtures" / "rcc6-bnbc"))
    ap.add_argument("--stage", default="all", choices=("all", "golden"))
    ap.add_argument("--timing", action="store_true", help="print the wall time to stderr")
    args = ap.parse_args()
    started = time.monotonic()
    try:
        main(Path(args.out), args.stage)
    except Exception as error:  # a failure writes nothing (E-fixture §3.10)
        print(f"fixtures.gen.rcc6_bnbc: {error}", file=sys.stderr)
        raise SystemExit(1) from error
    if args.timing:
        print(f"built in {time.monotonic() - started:.1f}s", file=sys.stderr)
