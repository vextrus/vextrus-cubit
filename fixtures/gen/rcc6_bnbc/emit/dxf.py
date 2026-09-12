"""The DXF writer (Wave B D3): one authored Scene set, written twice — as a paper-layout drawing
and as a set of model-space frames — and tallied exactly the way the product counts (L-CAD-09).

Public API (Implementer B calls exactly these):

    write_paper(sheets, blocks, images, scratch)        -> (Path, tally)
    write_model_frames(sheets, blocks, images, scratch) -> (Path, tally)      (W-05)
    write_arch_xref(scratch)                            -> Path
    write_malformed(paper_dxf_path, scratch)            -> (Path, dropped)    (W-07)
    fill_trap_handles(traps_doc, paper_dxf_path, sheets, tally) -> traps_doc  (W-06)
    notation_rows(sheets, handles)                      -> list[dict]

`tally` is `{space: {DXF type: n}}` — the placing-time count, per space, of exactly the entities
`vextrus_cad.ingest` counts: every entity in every layout except ATTRIB/ATTDEF/SEQEND/VERTEX/
VIEWPORT. A block definition's content is never counted (it is derived paint on the reader's side),
an INSERT and a DIMENSION are counted once each, and the VIEWPORTs that frame the views are not
counted at all. `validate.tally.reread()` of the written file must equal it, pair for pair.

Determinism (FOUNDER'S LAW 4): no clock, every iteration sorted, ezdxf's fixed test meta data, the
CLASSES section registered in sorted order, and handles assigned by creation order — two builds of
the same sheets are byte-identical.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.enums import MTextEntityAlignment, TextEntityAlignment
from ezdxf.math import Vec2
from ezdxf.render.mleader import ConnectionSide

from ..validate import notation as _notation
from . import plan
from .scene import PAPER_MM, Block, Scene, Sheet, View, scale_item, translate

#: The DXF release both files are written in. R2004 round-trips LibreDWG's dimension blocks; R2000
#: does not (fixtures/gen/rcc6.py's finding, kept).
RELEASE = "R2004"

#: How far apart the view scenes are planted in model space (200 m, so no two views can touch).
MODEL_PITCH = 200_000.0
MODEL_COLUMNS = 8

#: The office layer names, by the composer's key.
LAYER = {key: name for key, (name, _c) in plan.LAYERS.items()}

#: ezdxf spells its own default text style "Standard"; the sheets ask for "STANDARD".
STYLE_ALIAS = {"STANDARD": "Standard"}
TITLE_FONT = "Swis721 Cn BT"

#: The handles the last `write_paper` / `write_model_frames` assigned, by `id(item)`, and the
#: handle of every item that named a trap. `fill_trap_handles` and `notation_rows` read these.
LAST_HANDLES: dict[int, str] = {}
LAST_TRAP_HANDLES: dict[str, str] = {}
MODEL_HANDLES: dict[int, str] = {}
FRAMES_CAPTION: dict[str, Any] | None = None
#: The 1-based line of the first injected (mis-paired) line in the malformed twin (F2-7).
MALFORMED_LINE: int | None = None
MODEL_TRAP_HANDLES: dict[str, str] = {}

NOT_CONTENT = frozenset({"ATTRIB", "ATTDEF", "SEQEND", "VERTEX", "VIEWPORT"})


# ---------------------------------------------------------------------------------------------
# The placer: one Scene item -> one ezdxf entity, counted under the type ezdxf gives it back
# ---------------------------------------------------------------------------------------------


class Placer:
    """Draws scenes into a document, tallying and recording a handle per item as it goes."""

    def __init__(self, doc: Any, images: dict[str, bytes] | None = None) -> None:
        self.doc = doc
        self.tally: dict[str, Counter[str]] = {}
        self.handles: dict[int, str] = {}
        self.traps: dict[str, str] = {}
        self.image_defs: dict[str, Any] = {}
        self.images = images or {}
        self.skip: Any = None

    # -- helpers -------------------------------------------------------------------------------

    def _attribs(self, item: dict[str, Any], extra: dict[str, Any] | None = None) -> dict[str, Any]:
        out: dict[str, Any] = {"layer": LAYER.get(item["layer"], item["layer"])}
        if item.get("linetype"):
            out["linetype"] = item["linetype"]
        if extra:
            out.update(extra)
        return out

    def image_def(self, name: str) -> Any:
        if name not in self.image_defs:
            from PIL import Image as _PILImage

            data = self.images.get(name)
            if data is None:
                size = (600, 300)
            else:
                import io

                with _PILImage.open(io.BytesIO(data)) as img:
                    size = img.size
            self.image_defs[name] = self.doc.add_image_def(
                filename=f"images/{name}.png", size_in_pixel=size
            )
        return self.image_defs[name]

    # -- the one dispatch ----------------------------------------------------------------------

    def entity(self, layout: Any, item: dict[str, Any]) -> Any:
        kind = item["kind"]
        at = _at(item)
        if kind == "LINE":
            return layout.add_line(at["a"], at["b"], dxfattribs=self._attribs(item))
        if kind == "LWPOLYLINE":
            bulges = item.get("bulges")
            width = item.get("width") or 0.0
            points = [
                (x, y, width, width, bulges[i] if bulges else 0.0)
                for i, (x, y) in enumerate(at["points"])
            ]
            extra: dict[str, Any] = {}
            if item.get("elevation"):
                extra["elevation"] = item["elevation"]
            if width:
                extra["const_width"] = width
            return layout.add_lwpolyline(points, format="xyseb", close=item["closed"],
                                         dxfattribs=self._attribs(item, extra))
        if kind == "POLYLINE":
            return layout.add_polyline2d(at["points"], close=item["closed"],
                                         dxfattribs=self._attribs(item))
        if kind == "CIRCLE":
            return layout.add_circle(at["c"], item["r"], dxfattribs=self._attribs(item))
        if kind == "ARC":
            return layout.add_arc(at["c"], item["r"], item["start"], item["end"],
                                  dxfattribs=self._attribs(item))
        if kind == "POINT":
            return layout.add_point(at["at"], dxfattribs=self._attribs(item))
        if kind == "SOLID":
            return layout.add_solid(at["points"], dxfattribs=self._attribs(item))
        if kind == "HATCH":
            return self._hatch(layout, item, at)
        if kind == "TEXT":
            return self._text(layout, item, at)
        if kind == "MTEXT":
            return self._mtext(layout, item, at)
        if kind == "DIMENSION":
            return self._dim(layout, item, at)
        if kind == "LEADER":
            return layout.add_leader(at["points"], dxfattribs=self._attribs(item))
        if kind == "MLEADER":
            return self._mleader(layout, item, at)
        if kind == "INSERT":
            return self._insert(layout, item, at)
        if kind == "IMAGE":
            return layout.add_image(self.image_def(item["name"]), at["at"], item["size"],
                                    dxfattribs=self._attribs(item))
        raise ValueError(f"unknown primitive {kind}")

    def _hatch(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        hatch = layout.add_hatch(dxfattribs=self._attribs(item))
        if item["solid"]:
            hatch.set_solid_fill(color=7)
        else:
            hatch.set_pattern_fill(item["pattern"], scale=item["scale"], angle=item["angle"])
        for path in at["paths"]:
            hatch.paths.add_polyline_path(path, is_closed=True)
        return hatch

    def _text(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        extra = {"style": STYLE_ALIAS.get(item["style"], item["style"]),
                 "rotation": item["rotation"], "width": item["width_factor"]}
        text = layout.add_text(item["s"], height=item["h"], dxfattribs=self._attribs(item, extra))
        text.set_placement(at["at"], align=TextEntityAlignment[item["align"]])
        return text

    def _mtext(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        extra = {"char_height": item["h"], "width": item["width"], "rotation": item["rotation"],
                 "style": STYLE_ALIAS.get(item["style"], item["style"])}
        mtext = layout.add_mtext(item["raw"], dxfattribs=self._attribs(item, extra))
        mtext.set_location(at["at"], attachment_point=MTextEntityAlignment[item["attachment"]])
        return mtext

    def _dim(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        h = item["h"]
        override = {
            "dimtxt": h, "dimasz": h * 0.6, "dimexe": h * 0.5, "dimexo": h * 0.3,
            "dimgap": h * 0.2, "dimdec": 0, "dimtad": 1,
            # LibreDWG refuses a rotated MTEXT inside a dimension block (E-fixture 4.3)
            "dimtih": 1, "dimtoh": 1, "dimlfac": item["dimlfac"],
        }
        dim = layout.add_linear_dim(
            base=at["base"], p1=at["p1"], p2=at["p2"], angle=item["angle"],
            text=item["text"] if item.get("text") else "<>", dimstyle="EZDXF",
            override=override, dxfattribs=self._attribs(item),
        )
        dim.render()
        return dim.dimension

    def _mleader(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        builder = layout.add_multileader_mtext("Standard",
                                               dxfattribs=self._attribs(item))
        builder.set_content(item["s"], char_height=item["h"])
        points = at["points"]
        builder.add_leader_line(ConnectionSide.left,
                                [Vec2(points[0]), Vec2(points[len(points) // 2])])
        builder.build(insert=Vec2(points[-1]))
        return builder.multileader

    def _insert(self, layout: Any, item: dict[str, Any], at: dict[str, Any]) -> Any:
        extra = {"xscale": item["scale"][0], "yscale": item["scale"][1],
                 "rotation": item["rotation"]}
        insert = layout.add_blockref(item["block"], at["at"], dxfattribs=self._attribs(item, extra))
        if item.get("attribs"):
            insert.add_auto_attribs({k: v for k, v in sorted(item["attribs"].items())})
        return insert

    # -- placing a whole scene -----------------------------------------------------------------

    def place(self, layout: Any, scene: Scene, space: str | None, offset: tuple[float, float] = (0.0, 0.0)) -> None:
        counter = self.tally.setdefault(space, Counter()) if space else None
        for item in scene.items:
            if self.skip is not None and self.skip(item):
                continue
            placed = translate(item, offset) if offset != (0.0, 0.0) else item
            entity = self.entity(layout, placed)
            handle = entity.dxf.handle
            self.handles[id(item)] = handle
            if item.get("trap") and item["trap"] not in self.traps:
                self.traps[item["trap"]] = handle
            if counter is not None:
                dxftype = entity.dxftype()
                if dxftype not in NOT_CONTENT:
                    counter[dxftype] += 1

    def block(self, block: Block) -> None:
        """A block definition: its content is never tallied (the reader derives it from the INSERT)."""
        if block.xref:
            self.doc.blocks.new(block.name, dxfattribs={
                "flags": 4 | 16,  # XREF | XREF_OVERLAY is not wanted; 4 = XREF, 16 = referenced
                "xref_path": block.xref,
            })
            return
        definition = self.doc.blocks.new(block.name)
        self.place(definition, block.scene, None)
        for tag, prompt, at, height, default in block.attdefs:
            definition.add_attdef(tag, text=default, dxfattribs={
                "prompt": prompt, "insert": at, "height": height,
                "layer": LAYER.get("S-TEXT", "Text-1"),
            })

    def counts(self) -> dict[str, dict[str, int]]:
        return {space: dict(sorted(c.items())) for space, c in sorted(self.tally.items()) if c}


def _at(item: dict[str, Any]) -> dict[str, Any]:
    """The already-translated coordinates, as plain tuples ezdxf accepts."""
    return item


# ---------------------------------------------------------------------------------------------
# The document: layers, linetypes, styles, and the one place they are set up
# ---------------------------------------------------------------------------------------------


def new_document() -> Any:
    ezdxf.options.write_fixed_meta_data_for_testing = True
    doc = ezdxf.new(RELEASE, setup=True)
    # $INSUNITS 0 (unitless) with $LUNITS 4 (architectural): the units are only inferable from the
    # dimension texts and the scale bar (T-INSUNITS-0).
    doc.header["$INSUNITS"] = 0
    doc.header["$LUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    for key in sorted(plan.LAYERS):
        name, colour = plan.LAYERS[key]
        if name not in doc.layers:
            doc.layers.add(name, color=colour)
    for name in plan.FROZEN_LAYERS:
        doc.layers.get(name).freeze()
    # ezdxf's setup ships CENTER and DASHED but not HIDDEN (the office's own beam-below linetype)
    if "HIDDEN" not in doc.linetypes:
        doc.linetypes.add("HIDDEN", pattern=[6.35, 3.175, -3.175],
                          description="Hidden __ __ __ __ __ __ __ __ __ __ __ __ __")
    for linetype in ("HIDDEN", "CENTER", "DASHED"):
        assert linetype in doc.linetypes, f"{linetype} is not loaded"
    if TITLE_FONT not in doc.styles:
        doc.styles.add(TITLE_FONT, font="swiss.ttf")
    return doc


def _finish(doc: Any) -> None:
    """The CLASSES section is filled from a set whose order follows the hash seed; registering the
    types sorted first keeps the bytes the same run to run (fixtures/gen/rcc6.py's finding)."""
    for dxftype in sorted(doc.entitydb.dxf_types_in_use()):
        doc.classes.add_class(dxftype)


def _write_images(images: dict[str, bytes], scratch: Path) -> None:
    folder = scratch / "images"
    folder.mkdir(parents=True, exist_ok=True)
    for name in sorted(images):
        (folder / f"{name}.png").write_bytes(images[name])


def _delete_main_viewport(layout: Any) -> None:
    """page_setup plants a main VIEWPORT; the artifact never records one, so the sheet carries
    none and both sanity numbers count the same set (fixtures/gen/rcc6.py)."""
    viewport = layout.main_viewport()
    if viewport is not None:
        layout.delete_entity(viewport)
        layout.dxf_layout.dxf.discard("viewport_handle")


def assign_model_offsets(sheets: list[Sheet]) -> None:
    """Every view gets its own 200 m square of model space, in sheet then view order."""
    index = 0
    for sheet in sheets:
        for view in sheet.views:
            view.model_offset = ((index % MODEL_COLUMNS) * MODEL_PITCH,
                                 -(index // MODEL_COLUMNS) * MODEL_PITCH)
            index += 1


# ---------------------------------------------------------------------------------------------
# The paper-layout set
# ---------------------------------------------------------------------------------------------


def write_paper(
    sheets: list[Sheet],
    blocks: list[Block],
    images: dict[str, bytes],
    scratch: Path,
    *,
    name: str = "rcc6-bnbc.dxf",
    skip: Any = None,
) -> tuple[Path, dict[str, dict[str, int]]]:
    """The drawing as the office issues it: the views in model space, one layout per sheet, one
    VIEWPORT per view at its own exact scale."""
    scratch = Path(scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    _write_images(images, scratch)
    doc = new_document()
    placer = Placer(doc, images)
    placer.skip = skip
    for block in blocks:
        placer.block(block)
    assign_model_offsets(sheets)

    msp = doc.modelspace()
    for sheet in sheets:
        for view in sheet.views:
            placer.place(msp, view.scene, "model", view.model_offset)

    for sheet in sheets:
        layout = doc.layouts.new(sheet.layout_name)
        layout.page_setup(size=PAPER_MM[sheet.size], margins=(0, 0, 0, 0), units="mm")
        _delete_main_viewport(layout)
        placer.place(layout, sheet.paper, sheet.layout_name)
        for view in sheet.views:
            _viewport(layout, view, skip=skip)
    doc.layouts.delete("Layout1")
    _finish(doc)
    path = scratch / name
    doc.saveas(path)
    if skip is None:
        # A reduced write (the DWG source) is not the drawing the traps and the corpus are taken
        # from, so it never replaces the handle record of the real one.
        global LAST_HANDLES, LAST_TRAP_HANDLES
        LAST_HANDLES = placer.handles
        LAST_TRAP_HANDLES = placer.traps
    return path, placer.counts()


def _viewport(layout: Any, view: View, *, skip: Any = None) -> None:
    """One window on the paper onto the view's own square of model space, at 1:`view.scale`."""
    if skip is not None and skip({"kind": "VIEWPORT", "layer": "S-SHEET"}):
        return
    w, h = view.paper_size
    centre = (view.paper_at[0] + w / 2, view.paper_at[1] + h / 2)
    ox, oy = view.model_offset
    wx, wy = view.world_origin
    target = (ox + wx + w * view.scale / 2, oy + wy + h * view.scale / 2)
    layout.add_viewport(center=centre, size=(w, h), view_center_point=target,
                        view_height=h * view.scale)


# ---------------------------------------------------------------------------------------------
# The model-space frames set (W-05)
# ---------------------------------------------------------------------------------------------


def write_model_frames(
    sheets: list[Sheet],
    blocks: list[Block],
    images: dict[str, bytes],
    scratch: Path,
    *,
    name: str = "rcc6-bnbc.model.dxf",
    skip: Any = None,
) -> tuple[Path, dict[str, dict[str, int]]]:
    """The same sheets as the other office draws them: each paper scene x100 planted in model
    space (an A1 frame is 84.1 x 59.4 m), a 1:100 view at 1:1 inside it, a 1:S detail at x(100/S)
    with DIMLFAC S/100, and one paper layout "SHEET" holding a single VIEWPORT over S-00."""
    scratch = Path(scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    _write_images(images, scratch)
    doc = new_document()
    placer = Placer(doc, images)
    placer.skip = skip
    for block in blocks:
        placer.block(block)
    msp = doc.modelspace()
    k = float(plan.FRAME_SCALE)
    frames: dict[str, tuple[float, float]] = {}
    for index, sheet in enumerate(sheets):
        w, h = PAPER_MM[sheet.size]
        fx = (index % MODEL_COLUMNS) * (w * k + 10_000.0)
        fy = -(index // MODEL_COLUMNS) * (h * k + 10_000.0)
        frames[sheet.number] = (fx, fy)
        frame = Scene()
        frame.items = [scale_item(item, k) for item in sheet.paper.items]
        placer.place(msp, frame, "model", (fx, fy))
        _carry_handles(placer, sheet.paper.items, frame.items)
        for view in sheet.views:
            inside = Scene()
            factor = k / view.scale
            inside.items = [_frame_item(item, factor, view.scale) for item in view.scene.items]
            wx, wy = view.world_origin
            offset = (fx + (view.paper_at[0] * k) - wx * factor,
                      fy + (view.paper_at[1] * k) - wy * factor)
            placer.place(msp, inside, "model", offset)
            _carry_handles(placer, view.scene.items, inside.items)
    layout = doc.layouts.new("SHEET")
    layout.page_setup(size=PAPER_MM[sheets[0].size], margins=(0, 0, 0, 0), units="mm")
    _delete_main_viewport(layout)
    note = Scene()
    note.text(f"{plan.FIXTURE}  MODEL-SPACE FRAMES  -  ONE VIEWPORT OVER {sheets[0].number}",
              (20.0, 8.0), 3.0, "S-SHEET")
    placer.place(layout, note, "SHEET")
    global FRAMES_CAPTION
    FRAMES_CAPTION = note.items[0]  # T-FRAMES-MODELSPACE's own entity (F2-7)
    w, h = PAPER_MM[sheets[0].size]
    fx, fy = frames[sheets[0].number]
    layout.add_viewport(center=(w / 2, h / 2), size=(w - 20.0, h - 20.0),
                        view_center_point=(fx + w * k / 2, fy + h * k / 2), view_height=h * k)
    doc.layouts.delete("Layout1")
    _finish(doc)
    path = scratch / name
    doc.saveas(path)
    if skip is None:
        global MODEL_HANDLES, MODEL_TRAP_HANDLES
        MODEL_HANDLES = placer.handles
        MODEL_TRAP_HANDLES = placer.traps
    return path, placer.counts()


def _carry_handles(placer: Placer, sources: list[dict[str, Any]], copies: list[dict[str, Any]]) -> None:
    """A frame is drawn from copies of the sheet's own items; the handle each copy got belongs to
    the item it was copied from, so a trap or a corpus row can still find it."""
    for source, copy in zip(sources, copies, strict=True):
        handle = placer.handles.get(id(copy))
        if handle is not None:
            placer.handles[id(source)] = handle


def _frame_item(item: dict[str, Any], factor: float, scale: int) -> dict[str, Any]:
    """A view item inside a x100 frame: scaled by 100/S, its dimensions carrying DIMLFAC S/100 so
    the printed text stays the true millimetre (T-DIMLFAC, W-05)."""
    out = scale_item(item, factor)
    if out["kind"] == "DIMENSION":
        out["dimlfac"] = item.get("dimlfac", 1.0) / factor
    return out


# ---------------------------------------------------------------------------------------------
# The xref target and the malformed twin
# ---------------------------------------------------------------------------------------------


def write_arch_xref(scratch: Path, *, name: str = "arch-plan.dxf") -> Path:
    """The drawing S-13 bound and S-19 still points at: the architect's walls, doors and windows."""
    from .. import model as M
    from . import blocks as _blocks

    scratch = Path(scratch)
    scratch.mkdir(parents=True, exist_ok=True)
    ezdxf.options.write_fixed_meta_data_for_testing = True
    doc = ezdxf.new(RELEASE, setup=True)
    doc.header["$INSUNITS"] = 0
    for layer, colour in (("WALL", 8), ("DOOR", 4), ("WINDOW", 5)):
        if layer not in doc.layers:
            doc.layers.add(layer, color=colour)
    scene = Scene()
    _blocks.bound_xref_content(scene, float(M.X["1"]), float(M.Y["A"]))
    for item in scene.items:
        item["layer"] = {"X-WALL": "WALL", "X-DOOR": "DOOR", "X-WIN": "WINDOW"}[item["layer"]]
    placer = Placer(doc)
    saved = dict(LAYER)
    try:
        LAYER.clear()
        placer.place(doc.modelspace(), scene, "model")
    finally:
        LAYER.update(saved)
    _finish(doc)
    path = scratch / name
    doc.saveas(path)
    return path


#: The one mis-paired line inside a DIMENSION: a subclass marker written without its `100` code,
#: which is what a converter leaves behind when its tag stream slips (W-07).
_DIMENSION_STRAY = ("AcDbAlignedDimension\n",)

#: The "Embedded Object" column block an R2018 MTEXT export writes where a group code belongs.
#: Twelve lines, none of them a group code, so the resync drops the block whole.
_MTEXT_STRAY = (
    "Embedded Object\n",
    "ACAD_MTEXT_COLUMN_INFO_BEGIN\n",
    "column type\n",
    "column count\n",
    "column width\n",
    "column gutter\n",
    "column autoheight\n",
    "column flow reversed\n",
    "ACAD_MTEXT_COLUMN_INFO_END\n",
    "ACAD_MTEXT_DEFINED_HEIGHT_BEGIN\n",
    "defined height\n",
    "ACAD_MTEXT_DEFINED_HEIGHT_END\n",
)

#: What the two injections cost a reader: the sanity number the refusal carries (T-DXF-MALFORMED).
MALFORMED_DROPPED = len(_DIMENSION_STRAY) + len(_MTEXT_STRAY)


def write_malformed(paper_dxf_path: Path, scratch: Path,
                    *, name: str = "rcc6-bnbc.libredwg-r2000.dxf") -> tuple[Path, int]:
    """The R2000 twin whose tag stream slipped: one mis-paired line inside a DIMENSION and an
    "Embedded Object" column block inside an MTEXT, so `vextrus_cad.resync` refuses it by name
    until its resync drops those 13 lines. Authored here, never taken from dwg2dxf (W-07).

    Both injections stand where a group code belongs (right after a `0`/name pair's value), and no
    injected line reads as a group code, so the resync drops exactly what was injected and the
    repaired stream is the clean file again."""
    scratch = Path(scratch)
    doc = ezdxf.readfile(str(paper_dxf_path))
    doc.dxfversion = "AC1015"  # R2000, LibreDWG's own export release
    r2000 = scratch / "_r2000-clean.dxf"
    doc.saveas(r2000)
    lines = r2000.read_text(encoding="utf-8", errors="surrogateescape").splitlines(keepends=True)
    out: list[str] = []
    hurt_dimension = False
    hurt_mtext = False
    for line in lines:
        out.append(line)
        value = line.strip()
        if not hurt_dimension and value == "DIMENSION":
            global MALFORMED_LINE
            MALFORMED_LINE = len(out) + 1
            out.extend(_DIMENSION_STRAY)
            hurt_dimension = True
        elif hurt_dimension and not hurt_mtext and value == "MTEXT":
            out.extend(_MTEXT_STRAY)
            hurt_mtext = True
    assert hurt_dimension and hurt_mtext, "the paper set carries no DIMENSION or no MTEXT"
    path = scratch / name
    path.write_bytes("".join(out).encode("utf-8", errors="surrogateescape"))
    r2000.unlink()
    dropped = _prove_malformed(path)
    assert dropped == MALFORMED_DROPPED, (dropped, MALFORMED_DROPPED)
    return path, dropped


def _prove_malformed(path: Path) -> int:
    """ezdxf must refuse it — in both its plain and its recover mode — and `vextrus_cad.resync`
    must repair it by dropping lines and say how many (the sanity number a refusal carries)."""
    import ezdxf.recover
    from vextrus_cad.resync import resync_tag_stream

    for reader in (lambda: ezdxf.readfile(str(path)), lambda: ezdxf.recover.readfile(str(path))):
        refused = False
        try:
            reader()
        except Exception:  # noqa: BLE001 - any refusal is a refusal; the reason is ezdxf's
            refused = True
        assert refused, f"{path.name} is still a readable DXF — the tag stream did not slip"
    resync = resync_tag_stream(path.read_bytes())
    assert resync.repaired is not None, "the tag stream never came back into rhythm"
    assert resync.dropped > 0, "nothing was dropped, so nothing was mis-paired"
    repaired = path.with_name("_resynced.dxf")
    repaired.write_bytes(resync.repaired)
    try:
        ezdxf.readfile(str(repaired))
    finally:
        repaired.unlink()
    return resync.dropped


# ---------------------------------------------------------------------------------------------
# The trap handles and the notation corpus rows
# ---------------------------------------------------------------------------------------------


def fill_trap_handles(
    traps_doc: dict[str, Any],
    paper_dxf_path: Path,
    sheets: list[Sheet],
    tally: dict[str, dict[str, int]] | None = None,
) -> dict[str, Any]:
    """Every sheet trap's `handle` becomes the live handle of its own entity. A document-level trap
    names its file and its anchor (`plan.DOCUMENT_TRAPS`): the handle of the entity that IS the
    evidence where there is one (the frames caption), else `null` beside a header variable, a
    file or a line number (F2-7). Written back to `fixtures/gen/rcc6_bnbc/traps.json` (W-06)."""
    del tally
    anchors: dict[str, dict[str, Any]] = {}
    for sheet in sheets:
        for item in sheet.paper.items:
            if item.get("role") == "sheet-title":
                anchors[sheet.number] = item
    del anchors
    unresolved = []
    for trap in traps_doc["traps"]:
        trap.pop("anchor", None)
        if trap["sheet"] != "*":
            handle = LAST_TRAP_HANDLES.get(trap["id"])
        else:
            document = plan.DOCUMENT_TRAPS[trap["id"]]
            trap["file"] = document["file"]
            anchor = dict(document["anchor"])
            if anchor.get("line") == "MALFORMED_LINE":
                anchor["line"] = MALFORMED_LINE
                anchor["dropped_lines"] = MALFORMED_DROPPED
            trap["anchor"] = anchor
            if "layout" in anchor and FRAMES_CAPTION is not None:
                handle = MODEL_HANDLES.get(id(FRAMES_CAPTION))
            else:
                handle = None  # the evidence is a header variable, a file or a line, not an entity
                if not ({"header", "file"} & set(anchor)):
                    unresolved.append(trap["id"])
        if handle is None and trap["sheet"] != "*":
            unresolved.append(trap["id"])
        trap["handle"] = handle
    assert not unresolved, f"traps with no live entity: {unresolved}"
    path = Path(__file__).resolve().parents[1] / "traps.json"
    path.write_text(json.dumps(traps_doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    del paper_dxf_path
    return traps_doc


def notation_rows(sheets: list[Sheet], handles: dict[int, str] | None = None) -> list[dict[str, Any]]:
    """`validate.notation.strings_of` rows, each carrying the handle its entity got."""
    handles = handles if handles is not None else LAST_HANDLES
    rows = _notation.strings_of(sheets)
    items = _string_items(sheets)
    assert len(rows) == len(items), (len(rows), len(items))
    for row, item in zip(rows, items, strict=True):
        row["handle"] = handles.get(id(item))
    return rows


def _string_items(sheets: list[Sheet]) -> list[dict[str, Any]]:
    """The items `strings_of` walks, in exactly its order (one row per ATTRIB tag)."""
    out = []
    for sheet in sheets:
        scenes = [sheet.paper] + [v.scene for v in sheet.views]
        for scene in scenes:
            for item in scene.strings():
                if item["kind"] == "INSERT":
                    out.extend([item] * len(item["attribs"]))
                else:
                    out.append(item)
    return out


# ---------------------------------------------------------------------------------------------
# The development CLI
# ---------------------------------------------------------------------------------------------


def main(out: Path) -> dict[str, Any]:
    """Write both DXFs, the xref target, the malformed twin, the images and a sanity draft."""
    from .. import model as M
    from . import images as _images
    from . import sheets as _sheets

    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    world = M.build()
    sheets = _sheets.compose(world)
    blocks = _sheets.blocks()
    images = _images.author()
    paper, drawn = write_paper(sheets, blocks, images, out)
    model_path, model_drawn = write_model_frames(sheets, blocks, images, out)
    write_arch_xref(out)
    _malformed, dropped = write_malformed(paper, out)
    sanity = {
        "fixture": plan.FIXTURE,
        "generator": "fixtures/gen/rcc6_bnbc/",
        "drawn": {paper.name: drawn, model_path.name: model_drawn},
        "malformed": {"file": _malformed.name, "dropped_lines": dropped},
    }
    (out / "sanity.json").write_text(json.dumps(sanity, indent=2) + "\n", encoding="utf-8")
    return sanity


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    report = main(Path(ap.parse_args().out))
    for name, spaces in report["drawn"].items():
        total = sum(sum(t.values()) for t in spaces.values())
        print(f"{name}: {len(spaces)} spaces, {total} entities")
    print(f"malformed: {report['malformed']}")
