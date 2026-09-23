"""The DXF writer: the composed sheets as one drawing — the views in model space, one paper layout
per sheet, one VIEWPORT per view at its own scale — tallied exactly the way the product counts
(L-CAD-09): every entity in every layout except ATTRIB / ATTDEF / SEQEND / VERTEX / VIEWPORT, an
INSERT and a DIMENSION once each, a block definition's content never.

Deterministic: no clock (ezdxf's fixed test meta data), handles in creation order, the CLASSES
section registered sorted, every iteration ordered — two writings of the same sheets are the same
bytes (the generator proves it on itself).
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.enums import MTextEntityAlignment, TextEntityAlignment

from .blocks import Block, Scene
from .sheets import LAYERS, PAPER_MM, Sheet

RELEASE = "R2004"
MODEL_PITCH = 100_000.0
MODEL_COLUMNS = 4
NOT_CONTENT = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})


def new_document() -> Any:
    ezdxf.options.write_fixed_meta_data_for_testing = True
    doc = ezdxf.new(RELEASE, setup=True)
    # A millimetre drawing (A-02): $INSUNITS 4, decimal units; every size the architect writes is
    # feet-inches text on it (T-FTIN-LABEL).
    doc.header["$INSUNITS"] = 4
    doc.header["$LUNITS"] = 2
    doc.header["$MEASUREMENT"] = 1
    for name in sorted(LAYERS):
        if name not in doc.layers:
            doc.layers.add(name, color=LAYERS[name])
    return doc


def _moved(item: dict[str, Any], dx: float, dy: float) -> dict[str, Any]:
    out = dict(item)
    for key in ("a", "b", "c", "at", "p1", "p2", "base"):
        if key in out:
            out[key] = (out[key][0] + dx, out[key][1] + dy)
    if "points" in out:
        out["points"] = [(x + dx, y + dy) for x, y in out["points"]]
    if "paths" in out:
        out["paths"] = [[(x + dx, y + dy) for x, y in p] for p in out["paths"]]
    return out


class Writer:
    def __init__(self, doc: Any) -> None:
        self.doc = doc
        self.tally: dict[str, Counter[str]] = {}
        self.trap_handles: dict[str, str] = {}
        self.strings: list[dict[str, Any]] = []

    def entity(self, layout: Any, it: dict[str, Any]) -> Any:
        k = it["kind"]
        attribs: dict[str, Any] = {"layer": it["layer"]}
        if it.get("linetype"):
            attribs["linetype"] = it["linetype"]
        if k == "LINE":
            return layout.add_line(it["a"], it["b"], dxfattribs=attribs)
        if k == "LWPOLYLINE":
            return layout.add_lwpolyline(it["points"], format="xy", close=it["closed"], dxfattribs=attribs)
        if k == "CIRCLE":
            return layout.add_circle(it["c"], it["r"], dxfattribs=attribs)
        if k == "ARC":
            return layout.add_arc(it["c"], it["r"], it["start"], it["end"], dxfattribs=attribs)
        if k == "TEXT":
            t = layout.add_text(it["s"], height=it["h"], dxfattribs={**attribs, "rotation": it["rotation"]})
            t.set_placement(it["at"], align=TextEntityAlignment[it["align"]])
            return t
        if k == "MTEXT":
            extra = {"char_height": it["h"]}
            if it["width"]:
                extra["width"] = it["width"]
            m = layout.add_mtext(it["raw"], dxfattribs={**attribs, **extra})
            m.set_location(it["at"], attachment_point=MTextEntityAlignment[it["attach"]])
            return m
        if k == "INSERT":
            return layout.add_blockref(it["block"], it["at"], dxfattribs={
                **attribs, "xscale": it["xscale"], "yscale": it["yscale"], "rotation": it["rotation"]})
        if k == "HATCH":
            h = layout.add_hatch(dxfattribs=attribs)
            if it["solid"]:
                h.set_solid_fill(color=7)
            else:
                h.set_pattern_fill(it["pattern"], scale=it["scale"])
            for path in it["paths"]:
                h.paths.add_polyline_path(path, is_closed=True)
            return h
        if k == "DIMENSION":
            hh = it["h"]
            override = {"dimtxt": hh, "dimasz": hh * 0.6, "dimexe": hh * 0.5, "dimexo": hh * 0.3,
                        "dimgap": hh * 0.2, "dimdec": 0, "dimtad": 1, "dimtih": 1, "dimtoh": 1}
            d = layout.add_linear_dim(base=it["base"], p1=it["p1"], p2=it["p2"], angle=it["angle"], text=it["text"],
                                      dimstyle="EZDXF", override=override, dxfattribs=attribs)
            d.render()
            return d.dimension
        if k == "LEADER":
            return layout.add_leader(it["points"], dxfattribs=attribs)
        raise ValueError(f"unknown primitive {k}")

    def place(self, layout: Any, scene: Scene, space: str | None, sheet: str | None,
              offset: tuple[float, float] = (0.0, 0.0)) -> None:
        counter = self.tally.setdefault(space, Counter()) if space else None
        for it in scene.items:
            placed = _moved(it, *offset) if offset != (0.0, 0.0) else it
            e = self.entity(layout, placed)
            handle = e.dxf.handle
            if it.get("trap") and it["trap"] not in self.trap_handles:
                self.trap_handles[it["trap"]] = handle
            if counter is not None and e.dxftype() not in NOT_CONTENT:
                counter[e.dxftype()] += 1
            if sheet is not None and it["kind"] in ("TEXT", "MTEXT"):
                self.strings.append({
                    "sheet": sheet,
                    "handle": handle,
                    "type": it["kind"],
                    "text": it.get("s", it.get("raw")),
                    "family": it.get("family", "plain"),
                    **({"trap": it["trap"]} if it.get("trap") else {}),
                    **({"fact": it["fact"]} if it.get("fact") else {}),
                })

    def block(self, b: Block) -> None:
        definition = self.doc.blocks.new(b.name)
        self.place(definition, b.scene, None, None)

    def counts(self) -> dict[str, dict[str, int]]:
        return {space: dict(sorted(c.items())) for space, c in sorted(self.tally.items()) if c}


def assign_offsets(sheets: list[Sheet]) -> None:
    i = 0
    for sheet in sheets:
        for v in sheet.views:
            v.model_offset = ((i % MODEL_COLUMNS) * MODEL_PITCH, -(i // MODEL_COLUMNS) * MODEL_PITCH)
            i += 1


def write(sheets: list[Sheet], blocks: list[Block], scratch: Path, name: str = "arch.dxf") -> dict[str, Any]:
    doc = new_document()
    w = Writer(doc)
    for b in blocks:
        w.block(b)
    assign_offsets(sheets)
    msp = doc.modelspace()
    for sheet in sheets:
        for v in sheet.views:
            w.place(msp, v.scene, "model", sheet.number, v.model_offset)
    for sheet in sheets:
        layout = doc.layouts.new(sheet.layout_name)
        layout.page_setup(size=PAPER_MM[sheet.size], margins=(0, 0, 0, 0), units="mm")
        w.place(layout, sheet.paper, sheet.layout_name, sheet.number)
        for v in sheet.views:
            cx, cy = v.at[0] + v.size[0] / 2, v.at[1] + v.size[1] / 2
            ox, oy = v.model_offset
            target = (ox + v.origin[0] + v.size[0] * v.scale / 2, oy + v.origin[1] + v.size[1] * v.scale / 2)
            layout.add_viewport(center=(cx, cy), size=v.size, view_center_point=target,
                                view_height=v.size[1] * v.scale)
    doc.layouts.delete("Layout1")
    for dxftype in sorted(doc.entitydb.dxf_types_in_use()):
        doc.classes.add_class(dxftype)
    path = Path(scratch) / name
    doc.saveas(path)
    return {"path": path, "tally": w.counts(), "trap_handles": dict(sorted(w.trap_handles.items())),
            "strings": w.strings}
