"""Render one sheet of a DWG to its buffers and an engine raster, for a person to look at.

    uv run --no-sync python -m engine.render <file.dwg> --out <folder>
        [--layout <name> | --box <x0,y0,x1,y1>] [--px-per-mm 4]

Reads the file with the sandboxed reader (`engine.read.read`), builds the buffers of one sheet (a
layout by its name; a box in model space, in drawing units; or, with neither, model space's whole
extents) and writes `<file stem>.bin` and `<file stem>@<px_per_mm>.png` into `--out`. It prints counts
only, never drawing text: what it writes holds the drawing, so write it only where drawings may be
(`.private/work/` on the owner's machine). Until 13 finds sheets, this is how a local session looks at
real sheets: pass a frame's box, or a layout's name.
"""

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from engine.read import read
from engine.recognise.types import Box, SheetCandidate, SheetLocation
from engine.render import buffers, raster
from engine.render.buffers import _bounds_of


def _box(text: str) -> Box:
    try:
        x0, y0, x1, y1 = (float(v) for v in text.split(","))
    except ValueError as error:
        raise argparse.ArgumentTypeError("a box is four numbers: x0,y0,x1,y1") from error
    return Box(x0, y0, x1, y1)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m engine.render", description=__doc__.split("\n")[0])
    parser.add_argument("dwg", type=Path)
    parser.add_argument("--out", type=Path, required=True, help="the folder to write into")
    where = parser.add_mutually_exclusive_group()
    where.add_argument("--layout", help="a layout's name")
    where.add_argument("--box", type=_box, help="a box in model space: x0,y0,x1,y1 in drawing units")
    parser.add_argument("--px-per-mm", type=float, default=4.0)
    options = parser.parse_args(argv)

    artefact = read(options.dwg)
    if options.layout is not None:
        location = SheetLocation(layout=options.layout)
    elif options.box is not None:
        location = SheetLocation(box=options.box)
    else:
        model = next(h for h, b in artefact.blocks.items() if b.layout == "Model")
        extents = _bounds_of(artefact).block(model)
        if extents is None:
            print("model space draws nothing", file=sys.stderr)
            return 1
        location = SheetLocation(box=Box(*extents))
    built = buffers.build(artefact, SheetCandidate(location))
    image = raster.rasterise(built, options.px_per_mm)
    options.out.mkdir(parents=True, exist_ok=True)
    stem = options.dwg.stem
    (options.out / f"{stem}.bin").write_bytes(built.to_bytes())
    (options.out / f"{stem}@{options.px_per_mm:g}.png").write_bytes(image.to_png())
    paper = built.paper
    print(f"paper {paper.width_mm:.0f} x {paper.height_mm:.0f} mm (source {paper.source})")
    print(f"{len(built.lines)} lines, {len(built.triangles)} triangles, {len(built.glyphs)} glyphs")
    print(f"cut at a budget: {built.truncated}")
    for name, count in built.stats.items():
        print(f"  {name}: {count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
