"""The Scene vocabulary — the one contract between the sheet composers, the DXF writer and the PDF
painter (E-fixture §4.1: "one authored Scene painted twice"). Extends fixtures/gen/rcc6.py's Scene.

Every primitive is a dict with a `kind` (its DXF type, spelled as ezdxf spells it) so the DXF writer
tallies by `kind` and the PDF painter dispatches on it. Coordinates are local millimetres at the
view's own drawing scale (1:1 real size for plans and details; the composer decides what a view
is). Text strings are the RAW DXF strings — `%%C`, `\\P`, `\\S1/2;`, `{\\f…;}` included — because the
DXF must carry them verbatim; the painter calls `plain_text()` to decode them for paper.

Nothing in this module imports ezdxf or reportlab: it is data, so validate/ can read a Scene
without either library.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Any

Point = tuple[float, float]

#: The notation families a drawn string may declare (E-fixture §3.5, §3.10-2). `plain` is prose
#: and is never parsed; everything else must satisfy `validate.notation.parses(family, text)` or be
#: a registered trap.
FAMILIES = (
    "diameter",  # 8-20%%C, 16mm Ø, T16, #5, 2L-10Ø @ 100 c/c, 10Ø @ 4" c/c
    "bar_call",  # 2-20%%C st. + 1-20%%C ext., 3-16Ø T&B
    "spiral",  # 10%%C spiral @ 75 c/c (top 3.0 m) then @ 150
    "section",  # 250x450, 12"X24", 300 X 600 mm
    "thickness",  # 5" THK, 125 THK
    "length",  # 15'-0", 3'-6\S1/2;", 4572, L/3, Ln/4, 0.25L
    "level",  # ±0.000, +3.353, EL +11'-0", FFL, P.L= +0'-0"
    "range",  # 2ND TO 6TH FLOOR, GF-2ND FLR., 5TH TO ROOF
    "mark",  # C-1, C1, 1B3, RB2, TG1, SW1, PC-3, GB 2, S3
    "grade",  # f'c = 3500 psi, fy = 500 MPa, B500DWR
    "cover",  # 2" clear cover, 25mm clear cover
    "grid",  # A, B, 1, 2', 1a
    "count",  # 18 R @ 169.33, 89 NOS (never a NOS column — only prose)
    "number",  # a bare figure: a dimension text, a BBS cell, a table total
    "plain",  # prose, titles, abbreviations (TYP., U.N.O., N.T.S.)
)


@dataclass
class Scene:
    """Authored primitives in local millimetres."""

    items: list[dict[str, Any]] = field(default_factory=list)

    # -- geometry -----------------------------------------------------------------------------

    def line(self, a: Point, b: Point, layer: str = "S-LINE", linetype: str | None = None) -> dict:
        return self._add("LINE", a=a, b=b, layer=layer, linetype=linetype)

    def poly(
        self,
        points: list[Point],
        layer: str = "S-LINE",
        closed: bool = True,
        bulges: list[float] | None = None,
        linetype: str | None = None,
        elevation: float = 0.0,
        width: float = 0.0,
    ) -> dict:
        """LWPOLYLINE; `bulges[i]` is the bulge of the segment leaving vertex i (tan(θ/4)), so an arc
        is authored the way AutoCAD stores it — a curved balcony edge is a bulged polyline, and a
        revision cloud is a closed polyline whose every segment bulges. `elevation` is the stray
        Z (T-GAP-OUTLINE's 0.001)."""
        if bulges is not None and len(bulges) != len(points):
            raise ValueError("one bulge per vertex")
        return self._add(
            "LWPOLYLINE",
            points=list(points),
            closed=closed,
            bulges=list(bulges) if bulges else None,
            layer=layer,
            linetype=linetype,
            elevation=elevation,
            width=width,
        )

    def polyline(self, points: list[Point], layer: str = "S-LINE", closed: bool = True) -> dict:
        """POLYLINE (the heavy 2D polyline with VERTEX/SEQEND) — the "exploded rectangles vs
        LWPOLYLINE vs POLYLINE" trap. Tallied as POLYLINE; its vertices are not content."""
        return self._add("POLYLINE", points=list(points), closed=closed, layer=layer)

    def rect(self, x: float, y: float, w: float, h: float, layer: str = "S-LINE", **kw: Any) -> dict:
        return self.poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], layer, **kw)

    def rect_lines(self, x: float, y: float, w: float, h: float, layer: str = "S-LINE") -> list[dict]:
        """An "exploded" rectangle: four LINEs."""
        c = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        return [self.line(c[i], c[(i + 1) % 4], layer) for i in range(4)]

    def circle(self, c: Point, r: float, layer: str = "S-LINE") -> dict:
        return self._add("CIRCLE", c=c, r=r, layer=layer)

    def arc(self, c: Point, r: float, start: float, end: float, layer: str = "S-LINE") -> dict:
        """Counter-clockwise from `start` to `end` degrees."""
        return self._add("ARC", c=c, r=r, start=start, end=end, layer=layer)

    def point(self, at: Point, layer: str = "Defpoints") -> dict:
        return self._add("POINT", at=at, layer=layer)

    def solid(self, points: list[Point], layer: str = "S-LINE") -> dict:
        """SOLID (3 or 4 points; a filled triangle/quad — arrow heads, section-cut fills)."""
        return self._add("SOLID", points=list(points), layer=layer)

    def hatch(
        self,
        paths: list[list[Point]],
        layer: str = "S-HATCH",
        pattern: str = "ANSI31",
        scale: float = 25.0,
        angle: float = 0.0,
        solid: bool = False,
    ) -> dict:
        """HATCH over one or more closed polyline paths (the second path is an island, so a
        multi-path hatch is the "complex hatch" DWG canary). `solid=True` is a SOLID fill."""
        return self._add(
            "HATCH",
            paths=[list(p) for p in paths],
            layer=layer,
            pattern=pattern,
            scale=scale,
            angle=angle,
            solid=solid,
        )

    # -- text ---------------------------------------------------------------------------------

    def text(
        self,
        s: str,
        at: Point,
        h: float,
        layer: str = "S-TEXT",
        align: str = "LEFT",
        rotation: float = 0.0,
        style: str = "STANDARD",
        width_factor: float = 1.0,
        family: str = "plain",
        fact: dict[str, Any] | None = None,
        trap: str | None = None,
    ) -> dict:
        """TEXT. `align` ∈ LEFT | CENTER | RIGHT | MIDDLE_CENTER | MIDDLE_LEFT | MIDDLE_RIGHT |
        TOP_LEFT (ezdxf TextEntityAlignment names). `s` is the raw DXF string (`%%C` allowed).

        `family` names the notation family for notation.corpus.json and validate check 2;
        `fact` is the authored value this string prints — {"member": id, "field": name,
        "value": str} or {"authored": str} — for validate check 5 (printed == authored unless
        `trap` names the registered trap that makes it disagree)."""
        return self._add(
            "TEXT",
            s=s,
            at=at,
            h=h,
            layer=layer,
            align=align,
            rotation=rotation,
            style=style,
            width_factor=width_factor,
            family=family,
            fact=fact,
            trap=trap,
        )

    def mtext(
        self,
        raw: str,
        at: Point,
        h: float,
        width: float,
        layer: str = "S-TEXT",
        attachment: str = "TOP_LEFT",
        rotation: float = 0.0,
        style: str = "STANDARD",
        family: str = "plain",
        fact: dict[str, Any] | None = None,
        trap: str | None = None,
    ) -> dict:
        """MTEXT with inline codes verbatim: `\\P` paragraph, `\\S1/2;` stack, `{\\fSwis721 Cn
        BT|b1|i0|c0|p34;…}` font block, `\\L…\\l` underline, `\\A1;` alignment, `\\H0.8x;` height,
        `\\~` non-breaking space, `%%C`. `plain_text(raw)` decodes for the painter and the corpus.
        A string in `family` other than plain must decode to ONE line that parses."""
        return self._add(
            "MTEXT",
            raw=raw,
            at=at,
            h=h,
            width=width,
            layer=layer,
            attachment=attachment,
            rotation=rotation,
            style=style,
            family=family,
            fact=fact,
            trap=trap,
        )

    # -- annotation ---------------------------------------------------------------------------

    def dim(
        self,
        p1: Point,
        p2: Point,
        base: Point,
        angle: float,
        h: float,
        layer: str = "S-DIMS",
        text: str | None = None,
        dimlfac: float = 1.0,
        fact: dict[str, Any] | None = None,
        trap: str | None = None,
        family: str = "length",
    ) -> dict:
        """Aligned/rotated linear DIMENSION. `text` None → the measured value × dimlfac, printed
        by the composer's unit habit through `dim_text()`; `"<>\\""` keeps the measurement and adds a
        suffix (T-DIM-SUFFIX); any other string is a full override (T-DIM-OVERRIDE). Dimension text
        stays horizontal (dimtih/dimtoh = 1): LibreDWG refuses rotated MTEXT inside dimension
        blocks (E-fixture §4.3)."""
        return self._add(
            "DIMENSION",
            p1=p1,
            p2=p2,
            base=base,
            angle=angle,
            h=h,
            layer=layer,
            text=text,
            dimlfac=dimlfac,
            fact=fact,
            trap=trap,
            family=family,
        )

    def leader(self, points: list[Point], layer: str = "S-DIMS", arrow: bool = True) -> dict:
        """LEADER (the classic entity, not MLEADER): a polyline with an arrowhead at points[0].
        The annotation is a separate TEXT/MTEXT the composer places at points[-1]."""
        return self._add("LEADER", points=list(points), layer=layer, arrow=arrow)

    def mleader(self, points: list[Point], s: str, h: float, layer: str = "S-DIMS") -> dict:
        """MLEADER with its own MTEXT content — a DWG canary (E-fixture §4.3); the DWG profile
        drops it if LibreDWG loses it, recorded as a named loss."""
        return self._add("MLEADER", points=list(points), s=s, h=h, layer=layer)

    def insert(
        self,
        block: str,
        at: Point,
        layer: str = "S-TITLE",
        scale: tuple[float, float] = (1.0, 1.0),
        rotation: float = 0.0,
        attribs: dict[str, str] | None = None,
    ) -> dict:
        """INSERT of a named block; `scale=(-1, 1)` mirrors, `(2, 1)` is non-uniform (T-BLOCK-
        NESTED). `attribs` fills the block's ATTDEFs by tag (ATTRIB values are not tallied)."""
        return self._add(
            "INSERT",
            block=block,
            at=at,
            layer=layer,
            scale=scale,
            rotation=rotation,
            attribs=dict(attribs) if attribs else None,
        )

    def image(self, name: str, at: Point, size: tuple[float, float], layer: str = "S-IMAGE") -> dict:
        """IMAGE (+IMAGEDEF) of a raster the generator itself authors under `images/<name>.png`;
        `at` is the lower-left corner, `size` (w, h) in local mm."""
        return self._add("IMAGE", name=name, at=at, size=size, layer=layer)

    # -- helpers ------------------------------------------------------------------------------

    def _add(self, kind: str, **fields: Any) -> dict:
        item = {"kind": kind, **fields}
        self.items.append(item)
        return item

    def extend(self, other: Scene, offset: Point = (0.0, 0.0)) -> None:
        """Copy another scene's items in, translated (used to nest a detail inside a frame)."""
        for item in other.items:
            self.items.append(translate(item, offset))

    def strings(self) -> list[dict[str, Any]]:
        """Every text-bearing item: TEXT, MTEXT, DIMENSION overrides, MLEADER, INSERT attribs."""
        out = []
        for item in self.items:
            if item["kind"] in ("TEXT", "MTEXT", "MLEADER") or (
                item["kind"] == "DIMENSION" and item.get("text")
            ) or item["kind"] == "INSERT" and item.get("attribs"):
                out.append(item)
        return out

    def bbox(self) -> tuple[float, float, float, float]:
        xs: list[float] = []
        ys: list[float] = []
        for item in self.items:
            for x, y in item_points(item):
                xs.append(x)
                ys.append(y)
        if not xs:
            return (0.0, 0.0, 0.0, 0.0)
        return (min(xs), min(ys), max(xs), max(ys))


def item_points(item: dict[str, Any]) -> list[Point]:
    """The points an item's extent is judged by (text anchors count as one point)."""
    k = item["kind"]
    if k == "LINE":
        return [item["a"], item["b"]]
    if k in ("LWPOLYLINE", "POLYLINE", "SOLID", "LEADER", "MLEADER"):
        return list(item["points"])
    if k == "HATCH":
        return [p for path in item["paths"] for p in path]
    if k in ("CIRCLE", "ARC"):
        (cx, cy), r = item["c"], item["r"]
        return [(cx - r, cy - r), (cx + r, cy + r)]
    if k in ("TEXT", "MTEXT", "INSERT", "POINT", "IMAGE"):
        p = item["at"]
        if k == "IMAGE":
            return [p, (p[0] + item["size"][0], p[1] + item["size"][1])]
        return [p]
    if k == "DIMENSION":
        return [item["p1"], item["p2"], item["base"]]
    raise ValueError(k)


def translate(item: dict[str, Any], offset: Point) -> dict[str, Any]:
    ox, oy = offset

    def at(p: Point) -> Point:
        return (p[0] + ox, p[1] + oy)

    out = dict(item)
    for key in ("a", "b", "c", "at", "p1", "p2", "base"):
        if key in out and out[key] is not None:
            out[key] = at(out[key])
    if "points" in out:
        out["points"] = [at(p) for p in out["points"]]
    if "paths" in out:
        out["paths"] = [[at(p) for p in path] for path in out["paths"]]
    return out


def scale_item(item: dict[str, Any], k: float) -> dict[str, Any]:
    """Uniformly scale an item about the origin (a ×5 detail inside a model-space frame, or a
    ×100 title block). Text heights, dimension heights and hatch scales scale with it."""

    def at(p: Point) -> Point:
        return (p[0] * k, p[1] * k)

    out = dict(item)
    for key in ("a", "b", "c", "at", "p1", "p2", "base"):
        if key in out and out[key] is not None:
            out[key] = at(out[key])
    if "points" in out:
        out["points"] = [at(p) for p in out["points"]]
    if "paths" in out:
        out["paths"] = [[at(p) for p in path] for path in out["paths"]]
    for key in ("r", "h", "width"):
        if key in out and out[key] is not None:
            out[key] = out[key] * k
    if "size" in out:
        out["size"] = (out["size"][0] * k, out["size"][1] * k)
    if "scale" in out and item["kind"] == "HATCH":
        out["scale"] = out["scale"] * k
    if "scale" in out and item["kind"] == "INSERT":
        out["scale"] = (out["scale"][0] * k, out["scale"][1] * k)
    return out


# ---------------------------------------------------------------------------------------------
# MTEXT / TEXT inline codes → plain text (the painter, the corpus and validate all use this one)
# ---------------------------------------------------------------------------------------------

_FONT_BLOCK = re.compile(r"\\f[^;]*;")
_HEIGHT = re.compile(r"\\H[\d.]+x?;")
_WIDTH = re.compile(r"\\W[\d.]+;")
_COLOUR = re.compile(r"\\C\d+;")
_TRACK = re.compile(r"\\T[\d.]+;")
_ALIGN = re.compile(r"\\A[012];")
_STACK = re.compile(r"\\S([^;]*?)([#^/])([^;]*?);")
_CONTROL = re.compile(r"\\[LlOoKkQ][^;]*;?")

_STACK_GLYPH = {"1/2": "½", "1/4": "¼", "3/4": "¾", "1/8": "⅛", "3/8": "⅜", "5/8": "⅝", "7/8": "⅞"}


def _stack(m: re.Match[str]) -> str:
    num, sep, den = m.group(1), m.group(2), m.group(3)
    key = f"{num}/{den}"
    if sep in "/#" and key in _STACK_GLYPH:
        return _STACK_GLYPH[key]
    return f"{num}/{den}" if sep in "/#" else f"{num}^{den}"


def plain_text(raw: str) -> list[str]:
    """Decode DXF inline codes to the lines a reader sees. `\\P` → new line; `\\S` → the fraction
    glyph (½) or `a/b`; `%%C`/`%%c` → Ø, `%%D` → °, `%%P` → ±, `%%U`/`%%O` toggles dropped; font,
    height, width, colour, tracking, alignment, underline codes dropped; braces dropped; `\\~` →
    space; `\\\\` → backslash; `\\{`/`\\}` → literal braces."""
    s = raw.replace("\\\\", "\x00")
    s = s.replace("\\{", "\x01").replace("\\}", "\x02")
    s = _STACK.sub(_stack, s)
    for rx in (_FONT_BLOCK, _HEIGHT, _WIDTH, _COLOUR, _TRACK, _ALIGN):
        s = rx.sub("", s)
    s = s.replace("\\L", "").replace("\\l", "").replace("\\O", "").replace("\\o", "")
    s = s.replace("\\K", "").replace("\\k", "")
    s = s.replace("{", "").replace("}", "")
    s = s.replace("\\~", " ")
    s = s.replace("%%C", "Ø").replace("%%c", "Ø").replace("%%D", "°").replace("%%d", "°")
    s = s.replace("%%P", "±").replace("%%p", "±").replace("%%U", "").replace("%%u", "")
    s = s.replace("%%O", "").replace("%%o", "").replace("%%%", "%")
    s = s.replace("\x00", "\\").replace("\x01", "{").replace("\x02", "}")
    return s.split("\\P")


def dim_text(measure_mm: float, dimlfac: float, unit: str) -> str:
    """The text a DIMENSION prints when it is not overridden: `unit` ∈ {"mm", "ftin"}."""
    v = abs(measure_mm) * dimlfac
    if unit == "mm":
        return f"{v:.0f}"
    return ft_in(v)


def ft_in(mm: float) -> str:
    """Exact-ish feet-inches: 4572 → 15'-0"; 1079.5 → 3'-6\\S1/2;" (a stacked half)."""
    inches_total = mm / 25.4
    feet = int(inches_total // 12)
    rem = inches_total - feet * 12
    whole = int(round(rem * 8) // 8)
    eighths = int(round(rem * 8)) - whole * 8
    if eighths == 8:
        whole, eighths = whole + 1, 0
    if whole == 12:
        feet, whole = feet + 1, 0
    frac = ""
    if eighths:
        n, d = eighths, 8
        while n % 2 == 0:
            n, d = n // 2, d // 2
        frac = f"\\S{n}/{d};"
    return f"{feet}'-{whole}{frac}\""


def bulge_for_arc(sweep_deg: float) -> float:
    return math.tan(math.radians(sweep_deg) / 4)


# ---------------------------------------------------------------------------------------------
# Blocks, views, sheets — the composition data the DXF writer and the PDF painter both read
# ---------------------------------------------------------------------------------------------


@dataclass
class Block:
    """A named block: a scene plus optional ATTDEFs (tag, prompt, at, h, default)."""

    name: str
    scene: Scene
    attdefs: list[tuple[str, str, Point, float, str]] = field(default_factory=list)
    xref: str | None = None  # path of an XREF block ("arch-plan.dwg"); its scene is empty


@dataclass
class View:
    """One view on a sheet. `scene` is at 1:1 real millimetres; `scale` is the denominator
    (100 → 1:100); `paper_at` is the lower-left of the view window on the paper (mm) and
    `paper_size` its size (mm); `model_offset` is where dxf.py plants the scene in model space.
    `world_origin` is the scene point that lands at the window's lower-left (view centring)."""

    title: str
    scene: Scene
    scale: int
    paper_at: Point
    paper_size: tuple[float, float]
    world_origin: Point = (0.0, 0.0)
    model_offset: Point = (0.0, 0.0)
    unit: str = "ftin"  # the dimension habit of this view


@dataclass
class Sheet:
    """`number` is "S-13"; `size` ∈ A1 | A2 | A3 (landscape); `paper` is the paper-space scene
    (title block INSERT, revision table, key plan, north arrow, view captions) in paper mm."""

    number: str
    title: str
    size: str
    views: list[View]
    paper: Scene
    scales: str = ""  # the title block's SCALE cell, e.g. "1:100, 1:20"
    revision: str = "B"

    @property
    def slug(self) -> str:
        return self.number.lower()

    @property
    def layout_name(self) -> str:
        """The paper layout's own name. A DXF table name may not carry `" * / : ; < = > ? \\ ``,
        and three sheet titles do (S-02's LAP/DEVELOPMENT, S-24's UGWR / SEPTIC, S-26's SAMPLE:),
        so those characters become a hyphen — the name a reader sees is otherwise the title."""
        return f"{self.number} {self.title}"[:60].translate(_LAYOUT_NAME)


PAPER_MM: dict[str, tuple[float, float]] = {"A1": (841.0, 594.0), "A2": (594.0, 420.0), "A3": (420.0, 297.0)}

#: The characters a DXF table name (a layout is one) may not carry.
_LAYOUT_NAME = str.maketrans({c: "-" for c in '"*/:;<=>?\\`'})


# ---------------------------------------------------------------------------------------------
# One scene per feature: the DWG canaries (dwg.py mints each alone) and the painter's own tests
# ---------------------------------------------------------------------------------------------


def feature_scenes() -> dict[str, Scene]:
    """Each key is a feature LibreDWG may lose (E-fixture §4.3). Keep every scene tiny."""
    out: dict[str, Scene] = {}
    s = Scene()
    s.line((0, 0), (1000, 0))
    s.poly([(0, 0), (500, 0), (500, 500)], closed=True)
    out["basic"] = s
    s = Scene()
    s.poly([(0, 0), (2000, 0), (2000, 1000)], closed=True, bulges=[0.0, bulge_for_arc(90), 0.0])
    out["bulge"] = s
    s = Scene()
    s.hatch([[(0, 0), (1000, 0), (1000, 1000), (0, 1000)]])
    out["hatch_simple"] = s
    s = Scene()
    s.hatch([[(0, 0), (1000, 0), (1000, 1000), (0, 1000)], [(300, 300), (700, 300), (700, 700), (300, 700)]])
    out["hatch_complex"] = s
    s = Scene()
    s.hatch([[(0, 0), (1000, 0), (1000, 1000), (0, 1000)]], solid=True)
    out["hatch_solid"] = s
    s = Scene()
    s.line((0, 0), (1000, 0), linetype="HIDDEN")
    s.line((0, 100), (1000, 100), linetype="CENTER")
    out["linetype"] = s
    s = Scene()
    s.text("8-20%%C", (0, 0), 60, rotation=90.0)
    s.text("EL +11'-0\"", (500, 0), 60, rotation=180.0)
    out["text_rotated"] = s
    s = Scene()
    s.mtext("{\\fSwis721 Cn BT|b1|i0|c0|p34;\\LGENERAL NOTES}\\P1. 10%%C @ 4\" c/c\\P3'-6\\S1/2;\"", (0, 0), 60, 3000)
    out["mtext_codes"] = s
    s = Scene()
    s.dim((0, 0), (4267.2, 0), (0, 600), 0.0, 60)
    s.dim((0, 0), (0, 3000), (-600, 0), 90.0, 60, text="<>\"")
    s.dim((0, 4000), (4267.2, 4000), (0, 4600), 0.0, 60, text="14'-2\"")
    out["dimension"] = s
    s = Scene()
    s.dim((0, 0), (1000, 0), (0, 300), 0.0, 60, dimlfac=0.2)
    out["dimlfac"] = s
    s = Scene()
    s.leader([(0, 0), (500, 500), (900, 500)])
    s.text("B7", (920, 500), 60, align="MIDDLE_LEFT", family="mark")
    out["leader"] = s
    s = Scene()
    s.mleader([(0, 0), (500, 500)], "2-16%%C ext.", 60)
    out["mleader"] = s
    s = Scene()
    s.polyline([(0, 0), (500, 0), (500, 500), (0, 500)])
    out["polyline2d"] = s
    s = Scene()
    s.poly([(0, 0), (500, 0), (500, 500), (0, 500)], elevation=0.001)
    out["elevation_z"] = s
    s = Scene()
    s.insert("CANARY_TAG", (0, 0), attribs={"MARK": "C-4"})
    out["attrib_block"] = s
    s = Scene()
    s.insert("CANARY_NEST3", (0, 0), scale=(-1.0, 1.0))
    s.insert("CANARY_NEST3", (3000, 0), scale=(2.0, 1.0))
    out["nested_block"] = s
    s = Scene()
    s.image("canary-logo", (0, 0), (600, 300))
    out["image"] = s
    s = Scene()
    s.insert("ARCH-PLAN", (0, 0), layer="0")
    out["xref"] = s
    s = Scene()
    s.point((10, 10))
    s.solid([(0, 0), (200, 0), (100, 300)])
    out["point_solid"] = s
    s = Scene()
    s.text("প্রস্তাবিত ৬ তলা আবাসিক ভবন", (0, 0), 80)
    out["bengali"] = s
    n = 12
    pts = [(1000 * math.cos(2 * math.pi * i / n), 1000 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    s = Scene()
    s.poly(pts, closed=True, bulges=[bulge_for_arc(150)] * n, layer="S-REV")
    out["revcloud"] = s
    # "viewport" is a layout feature, not a scene item: dwg.py mints a layout with one VIEWPORT.
    return out


def canary_blocks() -> list[Block]:
    """The blocks feature_scenes() references."""
    tag = Scene()
    tag.circle((0, 0), 250)
    inner = Scene()
    inner.rect(0, 0, 400, 400)
    inner.text("PC3", (200, 450), 60, align="CENTER", family="mark")
    mid = Scene()
    mid.insert("CANARY_NEST1", (0, 0), scale=(-1.0, 1.0))
    mid.line((0, -100), (800, -100))
    outer = Scene()
    outer.insert("CANARY_NEST2", (0, 0), scale=(2.0, 1.0))
    return [
        Block("CANARY_TAG", tag, attdefs=[("MARK", "MARK", (0.0, 0.0), 120.0, "C-0")]),
        Block("CANARY_NEST1", inner),
        Block("CANARY_NEST2", mid),
        Block("CANARY_NEST3", outer),
        Block("ARCH-PLAN", Scene(), xref="arch-plan.dwg"),
    ]
