"""A session's instrument for reading a drawing it did not author (the harness, never the product).

`inventory` says what a DWG or DXF holds — header, layers, entity census per space, blocks and
their inserts, layouts and their viewports, dimension styles and overrides, and the texts that
recur — so a session can learn a professional drawing set's conventions (the owner's Edison set in
.private/, L-CAD-09: read, never committed) and compare them with the fixtures this tree authors.
`render` paints one layout, or one window of it, to SVG for a session to look at closely; the MCP
server (scripts/harness/mcp.mjs) rasterises that to PNG. The product's own reading of a drawing is
`vextrus-cad ingest`, and this file never stands in for it.

    uv run --project cad python scripts/harness/drawing.py inventory <file> --work <dir>
    uv run --project cad python scripts/harness/drawing.py render <file> --work <dir> --out <svg>
        [--layout NAME] [--box x0,y0,x1,y1] [--layers A,B] [--light]

A DWG is converted once per content digest into --work (never beside its input) by the product's
own audited lane, and opened as the product's extractor opens it (L-CAD-04, ARCH-02).
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path

from ezdxf import bbox, recover
from ezdxf.addons.drawing import Frontend, RenderContext, config, layout, svg
from ezdxf.math import BoundingBox2d, Vec2
from vextrus_cad import report
from vextrus_cad.dwg import convert_dwg
from vextrus_cad.ingest import IngestError, read_document

TEXT_TYPES = ("TEXT", "MTEXT", "ATTRIB")
TOP = 60


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _dxf_for(source: Path, work: Path) -> Path:
    """The DXF a drawing is read from: itself, or a DWG converted once per content digest.

    The conversion is the product's own audited two-pass lane (`vextrus_cad.dwg.convert_dwg`,
    L-CAD-04), never a second spelling of it (ARCH-02).
    """
    if source.suffix.lower() != ".dwg":
        return source
    work.mkdir(parents=True, exist_ok=True)
    target = work / f"{source.stem}.{_digest(source)[:12]}.dxf"
    if not target.exists():
        conversion = convert_dwg(source, work / ".convert")
        conversion.dxf_path.replace(target)
    return target


def _open(dxf: Path):
    """Opened the way the product's extractor opens a drawing: recover mode, one resync at most.

    A drawing the product REFUSES is still a drawing a session must be able to read — that refusal
    is often the very thing under study (a real set refused HANDLES_NOT_UNIQUE). So a refusal is
    reported, never hidden, and the drawing is then opened analysis-only by ezdxf's recover mode.
    Returns (document, refusal or None). Nothing here is the product's reading (ARCH-02).
    """
    try:
        return read_document(dxf, report.Report()), None
    except IngestError as error:
        refusal = str(error) or error.__class__.__name__
        document, _auditor = recover.readfile(str(dxf))
        return document, f"the product refuses this drawing ({refusal}); opened analysis-only by ezdxf recover"


def _text_of(entity) -> str:
    kind = entity.dxftype()
    if kind == "MTEXT":
        return entity.plain_text().replace("\n", " / ").strip()
    return str(entity.dxf.get("text", "")).strip()


def inventory(source: Path, work: Path) -> dict:
    dxf = _dxf_for(source, work)
    doc, refusal = _open(dxf)
    header = doc.header
    report: dict = {
        "file": source.name,
        "product_refusal": refusal,
        "sha256": _digest(source),
        "dxfversion": doc.dxfversion,
        "insunits": header.get("$INSUNITS"),
        "measurement": header.get("$MEASUREMENT"),
        "extmin": list(header.get("$EXTMIN", (0, 0, 0)))[:2],
        "extmax": list(header.get("$EXTMAX", (0, 0, 0)))[:2],
    }

    layer_census: dict[str, Counter] = defaultdict(Counter)
    texts: Counter = Counter()
    text_layer: dict[str, str] = {}
    heights: Counter = Counter()
    inserts: Counter = Counter()
    dims = {"count": 0, "overridden": 0, "styles": Counter()}
    spaces: dict[str, Counter] = {}

    for space in doc.layouts:
        census: Counter = Counter()
        for entity in space:
            kind = entity.dxftype()
            census[kind] += 1
            layer_census[entity.dxf.get("layer", "0")][kind] += 1
            if kind in TEXT_TYPES:
                value = _text_of(entity)
                if value:
                    texts[value[:90]] += 1
                    text_layer.setdefault(value[:90], entity.dxf.get("layer", "0"))
                height = entity.dxf.get("char_height" if kind == "MTEXT" else "height", None)
                if height:
                    heights[round(float(height), 3)] += 1
            elif kind == "INSERT":
                inserts[entity.dxf.name] += 1
            elif kind == "DIMENSION":
                dims["count"] += 1
                dims["styles"][entity.dxf.get("dimstyle", "?")] += 1
                if entity.dxf.get("text", "") not in ("", "<>"):
                    dims["overridden"] += 1
        spaces[space.name] = census

    report["spaces"] = {name: dict(census.most_common()) for name, census in spaces.items() if census}
    report["layers"] = [
        {"name": name, "entities": sum(census.values()), "types": dict(census.most_common(6))}
        for name, census in sorted(layer_census.items(), key=lambda item: -sum(item[1].values()))
    ]
    report["blocks"] = [
        {
            "name": name,
            "inserts": count,
            "entities": len(doc.blocks[name]) if name in doc.blocks else None,
            "attribs": sorted({a.dxf.tag for a in doc.blocks[name].query("ATTDEF")})
            if name in doc.blocks
            else [],
        }
        for name, count in inserts.most_common(TOP)
    ]
    report["layouts"] = []
    for name in doc.layouts.names_in_taborder():
        space = doc.layouts.get(name)
        viewports = []
        if name != "Model":
            for viewport in space.query("VIEWPORT"):
                if viewport.dxf.get("status", 1) == 1:
                    continue  # the paper-space viewport itself
                height = viewport.dxf.get("height", 0) or 0
                view_height = viewport.dxf.get("view_height", 0) or 0
                viewports.append(
                    {
                        "center": [round(v, 1) for v in viewport.dxf.center[:2]],
                        "size": [round(viewport.dxf.get("width", 0), 1), round(height, 1)],
                        "view_center": [round(v, 1) for v in viewport.dxf.view_center_point[:2]],
                        "scale_paper_per_model": round(height / view_height, 6) if view_height else None,
                    }
                )
        report["layouts"].append({"name": name, "entities": len(space), "viewports": viewports})
    report["dimensions"] = {
        "count": dims["count"],
        "overridden": dims["overridden"],
        "styles": dict(dims["styles"]),
    }
    report["dimstyles"] = sorted(style.dxf.name for style in doc.dimstyles)
    report["textstyles"] = sorted({f"{s.dxf.name}:{s.dxf.get('font', '')}" for s in doc.styles})
    report["text_heights"] = dict(heights.most_common(20))
    report["texts"] = [
        {"text": text, "count": count, "layer": text_layer[text]}
        for text, count in texts.most_common(TOP * 2)
    ]
    report["distinct_texts"] = len(texts)
    return report


def render(
    source: Path, work: Path, out: Path, layout_name: str, box: str | None, layers: str | None, light: bool
) -> dict:
    dxf = _dxf_for(source, work)
    doc, refusal = _open(dxf)
    space = doc.modelspace() if layout_name == "Model" else doc.layouts.get(layout_name)
    wanted = {name.strip().upper() for name in layers.split(",")} if layers else None
    window = None
    if box:
        x0, y0, x1, y1 = (float(v) for v in box.split(","))
        window = BoundingBox2d([Vec2(x0, y0), Vec2(x1, y1)])

    def filter_func(entity) -> bool:
        # Only what the window shows is painted: a crop of the whole model is the whole model's SVG.
        if wanted is not None and entity.dxf.get("layer", "0").upper() not in wanted:
            return False
        if window is None:
            return True
        extents = bbox.extents([entity], fast=True)
        if not extents.has_data:
            return False
        return window.has_intersection(BoundingBox2d([Vec2(extents.extmin), Vec2(extents.extmax)]))

    background = config.BackgroundPolicy.WHITE if light else config.BackgroundPolicy.BLACK
    colour = config.ColorPolicy.BLACK if light else config.ColorPolicy.COLOR
    context = RenderContext(doc)
    backend = svg.SVGBackend()
    frontend = Frontend(
        context, backend, config=config.Configuration(background_policy=background, color_policy=colour)
    )
    frontend.draw_layout(space, finalize=True, filter_func=filter_func)
    render_box = window
    if render_box is None:
        extents = bbox.extents(space, fast=True)
        if extents.has_data:
            render_box = BoundingBox2d([Vec2(extents.extmin), Vec2(extents.extmax)])
    page = layout.Page(0, 0, layout.Units.mm, max_width=1200, max_height=1200)
    text = backend.get_string(page, render_box=render_box)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf8")
    return {
        "svg": str(out),
        "layout": layout_name,
        "box": [round(v, 3) for v in (*render_box.extmin, *render_box.extmax)] if render_box else None,
        "product_refusal": refusal,
    }


def main() -> int:
    # ezdxf narrates every style it cannot resolve; a session wants the result, not the narration.
    logging.disable(logging.WARNING)
    parser = argparse.ArgumentParser(prog="drawing")
    commands = parser.add_subparsers(dest="command", required=True)
    inv = commands.add_parser("inventory")
    inv.add_argument("input")
    inv.add_argument("--work", required=True)
    ren = commands.add_parser("render")
    ren.add_argument("input")
    ren.add_argument("--work", required=True)
    ren.add_argument("--out", required=True)
    ren.add_argument("--layout", default="Model")
    ren.add_argument("--box")
    ren.add_argument("--layers")
    ren.add_argument("--light", action="store_true")
    args = parser.parse_args()
    source = Path(args.input)
    work = Path(args.work)
    # stdout carries exactly one JSON document: ezdxf's frontend prints its own narration ("skipping
    # MTEXT ... not enough space") to stdout, which broke the MCP's parse on two real drawings.
    with contextlib.redirect_stdout(sys.stderr):
        if args.command == "inventory":
            result = inventory(source, work)
        else:
            result = render(source, work, Path(args.out), args.layout, args.box, args.layers, args.light)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
