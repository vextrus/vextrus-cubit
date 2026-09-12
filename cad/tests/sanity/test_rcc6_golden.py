"""AC-7 — the hand takeoff golden recomputes from the authored inputs alone (L-FRM-02/03, L-QTY-06).

F-RCC6 v1.1: BEAM and SLAB are billed under AM-02 (L-MEA-09) — one owner per junction — from the
measured geometry `inputs.json` carries beside each member. COLUMN, FOOTING, PILE_CAP and TIE_BEAM
are unchanged, and the column rows are frozen by AM-01 (proved, not asserted, in
tests/golden/rcc6-column-rows-frozen.test.ts).

Every RCC_CONCRETE and FORMWORK row's quantity is re-derived here from `inputs.json` by the
contract's formulas, in exact decimal arithmetic so a half-way case rounds half-even on the true
value rather than on a binary float's neighbour, and compared as the three-decimal string the
golden spells. The drawing is never consulted: an input may not be derived from the figure it is
compared against.

Twice, by two paths that share nothing. The first bills the golden from the measured geometry
`inputs.json` states beside each member. The second — `Plan` below, the shape F-RCC6-BNBC's
selfcheck has (cad/tests/rcc6_bnbc/test_rcc6_bnbc_selfcheck.py) — never reads that digest: it
rebuilds the drawn structure from the grid, the column families, the beam marks, the wells and the
slab panels, and bills every BEAM and SLAB row from the geometry alone. A clear span edited into
`measured` and carried into the golden by the same formula passes the first path and reds the
second. The COLUMN rows AM-01 freezes are not rebilled by either (that would move what the M2
proof pins); for them the second path measures the AM-02 delta the manifest declares as R-7.

The recomputation is scoped to the two kinds this increment's formulas define. The golden is a
ledger keyed (class, kind, level); a kind a later increment adds (rebar, per R-TO-035) extends it
without redding these tests — such a row still owes a unique key, a contract class, a level from
the stack and a three-decimal quantity, and nothing more here.

The inputs themselves are F-RCC6's: its level stack and its mark families are the fixture's
definition, so the lean-inputs shortcut (two levels, one column) is closed by name.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path
from typing import Any

import pytest

GOLDEN_REL = "takeoff.golden.json"
INPUTS_REL = "inputs.json"

CLASSES = frozenset({"FOOTING", "PILE_CAP", "TIE_BEAM", "COLUMN", "BEAM", "SLAB"})
FOUNDATION_CLASSES = frozenset({"FOOTING", "PILE_CAP", "TIE_BEAM"})
FOUNDATION_LEVEL = "FDN"
CONCRETE = "RCC_CONCRETE"
FORMWORK = "FORMWORK"
#: The kinds whose formulas this increment fixes (L-FRM-02 concrete, L-FRM-03 formwork).
UNITS = {CONCRETE: "m3", FORMWORK: "m2"}

#: F-RCC6's level stack, in order, and the marks each family draws (the fixture's definition).
CONTRACT_LEVELS = ("FDN", "GF", "1F", "2F", "3F", "4F", "5F", "ROOF")
CONTRACT_MARKS: dict[str, frozenset[str]] = {
    "columns": frozenset({"C1", "C2", "C3", "C4"}),
    "beams": frozenset({"B1", "B2", "B3", "B4", "B5", "B6"}),
    "footings": frozenset({"F1", "F2", "F3", "F4"}),
    "pile_caps": frozenset({"PC1", "PC2"}),
}

THREE_DECIMALS = re.compile(r"^-?\d+\.\d{3}$")
QUANTUM = Decimal("0.001")
#: Areas are carried to six places before they are spelled, as the plan measures them in mm².
QUANTUM6 = Decimal("0.000001")
MM = Decimal(1000)

#: cad/tests/sanity/<this file> -> the checkout.
_CORPUS_DIR = Path(__file__).resolve().parents[3] / "fixtures" / "rcc6"

Key = tuple[str, str, str]


def _golden_keys() -> list[Key]:
    """The (class, kind, level) keys of the committed golden's RCC_CONCRETE / FORMWORK rows."""
    path = _CORPUS_DIR / GOLDEN_REL
    if not path.is_file():
        return []
    document = json.loads(path.read_text(encoding="utf-8"))
    rows = document.get("rows") if isinstance(document, dict) else None
    if not isinstance(rows, list):
        return []
    return [
        (str(row.get("class")), str(row.get("kind")), str(row.get("level")))
        for row in rows
        if isinstance(row, dict) and row.get("kind") in UNITS
    ]


GOLDEN_KEYS = _golden_keys()


def expected_quantities(inputs: dict[str, Any]) -> dict[Key, Decimal]:
    """Every (class, kind, level) the inputs give rise to, with its exact quantity in m³ / m²."""
    heights = {level["name"]: Decimal(level["storey_height_m"]) for level in inputs["levels"]}
    totals: dict[Key, Decimal] = {}

    def add(cls: str, kind: str, level: str, amount: Decimal) -> None:
        assert level in heights, f"inputs.json names level {level!r} outside its level stack"
        totals[cls, kind, level] = totals.get((cls, kind, level), Decimal(0)) + amount

    for column in inputs["columns"]:
        b, d, count = column["b_mm"] / MM, column["d_mm"] / MM, Decimal(column["count"])
        for level in column["levels"]:
            add("COLUMN", CONCRETE, level, count * b * d * heights[level])
            add("COLUMN", FORMWORK, level, count * 2 * (b + d) * heights[level])
    # F-RCC6 v1.1 bills beams and slabs under AM-02 (L-MEA-09, one owner per junction), not at the
    # schedule span and the nominal plate of v1.0: a beam is clear between its support faces and
    # below the slab soffit, so it owns b x (D - t) x clear and the contact faces
    # (D - t_left) + (D - t_right) + b; the slab runs through, out to the edge beams' outer faces,
    # less the column plan areas and the openings. `inputs.json` states the measured geometry as
    # exact decimals under each member's "measured"; the formulas here are this path's own.
    for beam in inputs["beams"]:
        b, d = beam["b_mm"] / MM, beam["d_mm"] / MM
        for level, groups in beam["measured"]["faces"].items():
            for group in groups:
                clear = Decimal(group["clear_m"])
                left, right = (Decimal(face) / MM for face in group["slab_t_mm"])
                add("BEAM", CONCRETE, level, b * (d - max(left, right)) * clear)
                add("BEAM", FORMWORK, level, ((d - left) + (d - right) + b) * clear)
    for slab in inputs["slab"]:
        measured = slab["measured"]
        thickness = slab["thickness_mm"] / MM
        plate = (
            Decimal(measured["plate_m2"])
            - Decimal(measured["columns_m2"])
            - Decimal(measured["openings_m2"])
        )
        add("SLAB", CONCRETE, slab["level"], plate * thickness)
        add(
            "SLAB",
            FORMWORK,
            slab["level"],
            (plate - Decimal(measured["beam_soffit_m2"]))
            + Decimal(measured["free_edge_m"]) * thickness,
        )
    for cls, key in (("FOOTING", "footings"), ("PILE_CAP", "pile_caps")):
        for item in inputs[key]:
            length, b, depth = item["l_mm"] / MM, item["b_mm"] / MM, item["depth_mm"] / MM
            count = Decimal(item["count"])
            add(cls, CONCRETE, FOUNDATION_LEVEL, count * length * b * depth)
            add(cls, FORMWORK, FOUNDATION_LEVEL, count * 2 * (length + b) * depth)
    for tie in inputs["tie_beams"]:
        b, d, span, count = tie["b_mm"] / MM, tie["d_mm"] / MM, Decimal(tie["span_m"]), Decimal(tie["count"])
        add("TIE_BEAM", CONCRETE, FOUNDATION_LEVEL, count * b * d * span)
        add("TIE_BEAM", FORMWORK, FOUNDATION_LEVEL, count * (2 * d + b) * span)
    return totals


def spelled(amount: Decimal) -> str:
    return format(amount.quantize(QUANTUM, rounding=ROUND_HALF_EVEN), "f")


def metres(millimetres: Decimal) -> Decimal:
    return (Decimal(millimetres) / MM).quantize(QUANTUM, rounding=ROUND_HALF_EVEN)


def square_metres(square_millimetres: Decimal) -> Decimal:
    return (Decimal(square_millimetres) / (MM * MM)).quantize(QUANTUM6, rounding=ROUND_HALF_EVEN)


def _inputs(corpus) -> dict[str, Any]:
    return corpus.read_json(INPUTS_REL, parse_float=Decimal, parse_int=Decimal)


def _golden(corpus) -> dict[str, Any]:
    return corpus.read_json(GOLDEN_REL)


def _rows_by_key(corpus) -> dict[Key, dict[str, Any]]:
    return {(row["class"], row["kind"], row["level"]): row for row in _golden(corpus)["rows"]}


def _formula_rows_by_key(corpus) -> dict[Key, dict[str, Any]]:
    """The rows of the kinds whose formulas this increment fixes."""
    return {key: row for key, row in _rows_by_key(corpus).items() if key[1] in UNITS}


def _expected(corpus) -> dict[Key, Decimal]:
    return corpus.once("golden-expected", lambda: expected_quantities(_inputs(corpus)))


def test_ac7_inputs_carry_f_rcc6s_level_stack_and_mark_families(corpus) -> None:
    inputs = _inputs(corpus)
    assert [level["name"] for level in inputs["levels"]] == list(CONTRACT_LEVELS), (
        "inputs.json's level stack is not F-RCC6's FDN, GF, 1F … 5F, ROOF in order"
    )
    offences: list[str] = []
    for family, marks in sorted(CONTRACT_MARKS.items()):
        members = inputs.get(family)
        if not isinstance(members, list):
            offences.append(f"{family}: not a list")
            continue
        drawn = {str(item.get("mark")) for item in members}
        lacking = sorted(marks - drawn)
        if lacking:
            offences.append(f"{family}: F-RCC6's marks {lacking} are not authored")
        countless = sorted(str(item.get("mark")) for item in members if Decimal(item.get("count", 0)) < 1)
        if countless:
            offences.append(f"{family}: marks with count < 1: {countless}")
    assert offences == [], "\n".join(offences)


def test_ac7_rows_are_unique_on_class_kind_level(corpus) -> None:
    golden = _golden(corpus)
    assert golden.get("fixture") == "F-RCC6"
    assert golden.get("provenance") == "HAND_FROM_AUTHORED_SOURCE"
    rows = golden.get("rows")
    assert isinstance(rows, list) and rows, "the golden holds no rows"
    keys = Counter((row["class"], row["kind"], row["level"]) for row in rows)
    duplicated = sorted(key for key, seen in keys.items() if seen > 1)
    assert duplicated == [], f"rows repeated on (class, kind, level): {duplicated}"


def test_ac7_every_row_speaks_the_contract_vocabulary(corpus) -> None:
    level_names = {level["name"] for level in _inputs(corpus)["levels"]}
    offences: list[str] = []
    for row in _golden(corpus)["rows"]:
        key = (row.get("class"), row.get("kind"), row.get("level"))
        if row.get("class") not in CLASSES:
            offences.append(f"{key}: class")
        if not isinstance(row.get("kind"), str) or not row["kind"]:
            offences.append(f"{key}: kind is not a name")
        if row.get("level") not in level_names:
            offences.append(f"{key}: level not in inputs.levels")
        if row.get("class") in FOUNDATION_CLASSES and row.get("level") != FOUNDATION_LEVEL:
            offences.append(f"{key}: a foundation class off {FOUNDATION_LEVEL}")
        if row.get("kind") in UNITS and row.get("unit") != UNITS[row["kind"]]:
            offences.append(f"{key}: unit {row.get('unit')!r}, the contract's is {UNITS[row['kind']]}")
        if not isinstance(row.get("quantity"), str) or not THREE_DECIMALS.match(row["quantity"]):
            offences.append(f"{key}: quantity {row.get('quantity')!r} is not a three-decimal string")
    assert offences == [], "\n".join(offences)


def test_ac7_the_concrete_and_formwork_rows_are_exactly_what_the_inputs_give_rise_to(corpus) -> None:
    expected, rows = _expected(corpus), _formula_rows_by_key(corpus)
    assert expected, "inputs.json gives rise to no quantity at all"
    assert rows, f"the golden holds no {CONCRETE} or {FORMWORK} row"
    lacking = sorted(set(expected) - set(rows))
    assert lacking == [], f"rows the inputs call for that the golden lacks: {lacking}"
    surplus = sorted(set(rows) - set(expected))
    assert surplus == [], f"{CONCRETE}/{FORMWORK} rows the inputs give no rise to: {surplus}"


@pytest.mark.parametrize("key", GOLDEN_KEYS, ids=[":".join(key) for key in GOLDEN_KEYS])
def test_ac7_each_quantity_recomputes_from_the_inputs(corpus, key: Key) -> None:
    expected, rows = _expected(corpus), _formula_rows_by_key(corpus)
    assert key in expected, f"{key}: the inputs give rise to no such row"
    want = spelled(expected[key])
    assert rows[key]["quantity"] == want, (
        f"{key}: the golden says {rows[key]['quantity']}, the formulas over inputs.json give {want}"
    )


# ---------------------------------------------------------------------------------------------
# The second path: the quantities re-derived from the DRAWN geometry.
#
# Everything above bills the golden from `measured` — the digest `fixtures/gen/rcc6.py` writes into
# `inputs.json` and then bills from in the same run. That proves the golden against the generator's
# own digest and no further: a wrong clear span, written into `measured` and carried into the
# golden by the same law, passes. So BEAM and SLAB get the second independent path
# F-RCC6-BNBC has had since Wave A (cad/tests/rcc6_bnbc/test_rcc6_bnbc_selfcheck.py) — a model of
# the drawn structure, built here from the plan alone:
#
#   * `grid.x_mm` / `grid.y_mm`      the axes the plan is set out on,
#   * `columns[]`                    the four section families and how many of each the plan draws,
#   * `beams[].{b_mm,d_mm,levels}`   the sections, and the levels each mark is drawn at,
#   * `openings`                     the stair, lift and roof wells, as drawn rectangles,
#   * `slab[].thickness_mm`          the panel each floor is drawn with.
#
# `measured` is never read here (MEASURED_FIELDS is what this path refuses to look at, and one test
# asserts the refusal holds by comparing this path's own numbers against it). The path derives
# clear spans between support faces, the slab plate out to the edge beams' outer faces, the column
# plugs through it, the openings, the beam soffits and the free edges, and bills every BEAM and
# SLAB row of the golden from them.
#
# The COLUMN rows are NOT billed here: AM-01 freezes them byte for byte across v1.1 and
# tests/golden/rcc6-column-rows-frozen.test.ts proves it. For them this path measures the AM-02
# delta the manifest declares as R-7 instead (test_ac7_r7_* below).
# ---------------------------------------------------------------------------------------------

#: What the second path may not read: the generator's pre-digested measurement of its own drawing.
MEASURED_FIELDS = ("measured",)

#: The fixture's arrangement, as the plan draws it — the two facts the section families alone do
#: not carry. Both are checked against the authored counts before anything is billed from them.
CORNER_FAMILY_RANK, CORE_FAMILY_RANK = 0, -1

#: The threshold L-MEA-01 seeds and AM-02 spends: a member-end contact bigger than this is deducted
#: from the vertical member's formwork (docs/specs/cubit.bible.xml, memberEndNoDeductMaxCm2).
MEMBER_END_NO_DEDUCT_MAX_CM2 = Decimal(500)
CM2_PER_M2 = Decimal(10000)

#: The published COLUMN FORMWORK the R-7 overage is a share of, and where it is declared.
MANIFEST_REL = "manifest.json"
R7_ID = "R-7-column-formwork-junction"


@dataclass(frozen=True)
class Drawn:
    """One beam the plan draws: its axis, where it sits, and the columns (if any) it lands on."""

    mark: str
    axis: str
    at: Decimal
    a: Decimal
    b: Decimal
    supports: tuple[dict[str, Any], ...] = ()


class Plan:
    """The drawn structure, read off `inputs.json`'s geometry and billed under AM-02 (L-MEA-09)."""

    def __init__(self, inputs: dict[str, Any]) -> None:
        self.inputs = inputs
        self.levels = [str(level["name"]) for level in inputs["levels"]]
        self.xs = [Decimal(x) for x in inputs["grid"]["x_mm"]]
        self.ys = [Decimal(y) for y in inputs["grid"]["y_mm"]]
        self.columns = {str(column["mark"]): column for column in inputs["columns"]}
        self.beams = {str(beam["mark"]): beam for beam in inputs["beams"]}
        self.slabs = {str(slab["level"]): slab for slab in inputs["slab"]}
        self.openings = {name: [Decimal(v) for v in box] for name, box in inputs["openings"].items()}
        self.placement = self._placement()

    # -- the plan's arrangement ----------------------------------------------------------------

    def _placement(self) -> dict[tuple[int, int], dict[str, Any]]:
        """Which column family sits on which grid intersection, derived from the grid itself.

        The plan sets out four families on 36 intersections, and the grid says which is which: the
        four corners take the smallest section, the twenty-two other perimeter intersections the
        next, the four around the plan's centre — the lift and stair core — the largest, and the
        rest the third. Nothing here is taken on trust: the arrangement is only used once the
        family counts it produces are the counts `columns[].count` authors (the test below).
        """
        corners: list[tuple[int, int]] = []
        perimeter: list[tuple[int, int]] = []
        inner: list[tuple[int, int]] = []
        for j in range(len(self.ys)):
            for i in range(len(self.xs)):
                on_x_edge = i in (0, len(self.xs) - 1)
                on_y_edge = j in (0, len(self.ys) - 1)
                if on_x_edge and on_y_edge:
                    corners.append((i, j))
                elif on_x_edge or on_y_edge:
                    perimeter.append((i, j))
                else:
                    inner.append((i, j))
        centre_x = (self.xs[0] + self.xs[-1]) / 2
        centre_y = (self.ys[0] + self.ys[-1]) / 2
        by_section = sorted(
            self.columns.values(),
            key=lambda column: (column["b_mm"] * column["d_mm"], str(column["mark"])),
        )
        core_family = by_section[CORE_FAMILY_RANK]
        nearest = sorted(
            inner,
            key=lambda point: (
                (self.xs[point[0]] - centre_x) ** 2 + (self.ys[point[1]] - centre_y) ** 2,
                point,
            ),
        )
        core = set(nearest[: int(core_family["count"])])
        interior = [point for point in inner if point not in core]
        placed: dict[tuple[int, int], dict[str, Any]] = {}
        for points, family in (
            (corners, by_section[CORNER_FAMILY_RANK]),
            (perimeter, by_section[1]),
            (interior, by_section[2]),
            (sorted(core), core_family),
        ):
            for point in points:
                placed[point] = family
        return placed

    def column_at(self, i: int, j: int) -> dict[str, Any]:
        return self.placement[i, j]

    def drawn_at(self, mark: str, level: str) -> bool:
        return level in [str(name) for name in self.beams[mark]["levels"]]

    def openings_at(self, level: str) -> list[tuple[Decimal, Decimal, Decimal, Decimal]]:
        """The wells the plan draws at `level`: the roof well on top, the stair and lift below."""
        names = ("roof",) if level == self.levels[-1] else ("stair", "lift")
        return [tuple(self.openings[name]) for name in names]  # type: ignore[misc]

    def plate(self) -> tuple[Decimal, Decimal, Decimal, Decimal]:
        """The slab outline as (x, y, w, h) in mm — out to the edge beams' outer faces (AM-02)."""
        edge_x = self.beams[self.edge_mark("y")]["b_mm"] / 2
        edge_y = self.beams[self.edge_mark("x")]["b_mm"] / 2
        return (
            self.xs[0] - edge_x,
            self.ys[0] - edge_y,
            self.xs[-1] - self.xs[0] + 2 * edge_x,
            self.ys[-1] - self.ys[0] + 2 * edge_y,
        )

    def edge_mark(self, axis: str) -> str:
        """The mark the plan draws along the outermost axis of `axis` (x: rows 1/6, y: grids A/F)."""
        return "B1" if axis == "x" else "B3"

    # -- the runs the plan draws ---------------------------------------------------------------

    def runs(self, level: str) -> list[Drawn]:
        """Every beam drawn at `level`, clear between the faces of whatever supports it."""
        drawn: list[Drawn] = []
        for j, y in enumerate(self.ys):
            mark = self.edge_mark("x") if j in (0, len(self.ys) - 1) else "B2"
            if not self.drawn_at(mark, level):
                continue
            for i in range(len(self.xs) - 1):
                left, right = self.column_at(i, j), self.column_at(i + 1, j)
                drawn.append(
                    Drawn(
                        mark,
                        "x",
                        y,
                        self.xs[i] + left["b_mm"] / 2,
                        self.xs[i + 1] - right["b_mm"] / 2,
                        (left, right),
                    )
                )
        for i, x in enumerate(self.xs):
            mark = self.edge_mark("y") if i in (0, len(self.xs) - 1) else "B4"
            if not self.drawn_at(mark, level):
                continue
            for j in range(len(self.ys) - 1):
                near, far = self.column_at(i, j), self.column_at(i, j + 1)
                drawn.append(
                    Drawn(
                        mark,
                        "y",
                        x,
                        self.ys[j] + near["d_mm"] / 2,
                        self.ys[j + 1] - far["d_mm"] / 2,
                        (near, far),
                    )
                )
        if self.drawn_at("B5", level):
            # The well trimmers: one across each end of the stair and of the lift well, drawn at
            # the length of the well and not at the 4.5 m the beam schedule prints (manifest R-1).
            for name in ("stair", "lift"):
                ox, oy, ow, oh = self.openings[name]
                drawn.append(Drawn("B5", "x", oy, ox, ox + ow))
                drawn.append(Drawn("B5", "x", oy + oh, ox, ox + ow))
        if self.drawn_at("B6", level):
            # The secondary beams: one down the middle of each bay of the central band, clear
            # between the faces of the two B2 it frames into.
            half = self.beams["B2"]["b_mm"] / 2
            for i in range(len(self.xs) - 1):
                drawn.append(
                    Drawn("B6", "y", (self.xs[i] + self.xs[i + 1]) / 2, self.ys[2] + half, self.ys[3] - half)
                )
        return drawn

    def segments(self, run: Drawn, level: str) -> list[tuple[Decimal, Decimal]]:
        """The run, less every stretch of it that lies inside a well it is drawn across."""
        spans = [(run.a, run.b)]
        for ox, oy, ow, oh in self.openings_at(level):
            across = oy < run.at < oy + oh if run.axis == "x" else ox < run.at < ox + ow
            if not across:
                continue
            low, high = (ox, ox + ow) if run.axis == "x" else (oy, oy + oh)
            kept: list[tuple[Decimal, Decimal]] = []
            for a, b in spans:
                if b <= low or a >= high:
                    kept.append((a, b))
                    continue
                if a < low:
                    kept.append((a, low))
                if b > high:
                    kept.append((high, b))
            spans = kept
        return spans

    def slab_beside(self, x: Decimal, y: Decimal, level: str) -> Decimal:
        """The panel adjoining a point: nothing off the plate, nothing over a well."""
        px, py, pw, ph = self.plate()
        if not (px < x < px + pw and py < y < py + ph):
            return Decimal(0)
        for ox, oy, ow, oh in self.openings_at(level):
            if ox < x < ox + ow and oy < y < oy + oh:
                return Decimal(0)
        return Decimal(self.slabs[level]["thickness_mm"])

    def faces_of(self, run: Drawn, level: str) -> tuple[Decimal, Decimal]:
        """The panel adjoining each side of a run, the thicker one governing (AM-02's t_slab)."""
        off = self.beams[run.mark]["b_mm"] / 2 + 10
        sides = [Decimal(0), Decimal(0)]
        for a, b in self.segments(run, level):
            middle = (a + b) / 2
            for k, sign in enumerate((-1, 1)):
                point = (
                    (middle, run.at + sign * off) if run.axis == "x" else (run.at + sign * off, middle)
                )
                sides[k] = max(sides[k], self.slab_beside(point[0], point[1], level))
        return (min(sides), max(sides))

    def beam_groups(self, level: str) -> dict[str, dict[tuple[Decimal, Decimal], Decimal]]:
        """Per mark at `level`: clear millimetres, grouped by the pair of panels it sits between."""
        groups: dict[str, dict[tuple[Decimal, Decimal], Decimal]] = {}
        for run in self.runs(level):
            clear = sum((b - a for a, b in self.segments(run, level)), Decimal(0))
            if clear <= 0:
                continue
            faces = self.faces_of(run, level)
            per_mark = groups.setdefault(run.mark, {})
            per_mark[faces] = per_mark.get(faces, Decimal(0)) + clear
        return groups

    # -- the bill ------------------------------------------------------------------------------

    def quantities(self) -> dict[Key, Decimal]:
        """Every BEAM and SLAB quantity the drawing gives rise to, in m³ / m²."""
        totals: dict[Key, Decimal] = {}

        def add(cls: str, kind: str, level: str, amount: Decimal) -> None:
            totals[cls, kind, level] = totals.get((cls, kind, level), Decimal(0)) + amount

        for level in self.slabs:
            groups = self.beam_groups(level)
            for mark, per_faces in groups.items():
                b, d = self.beams[mark]["b_mm"] / MM, self.beams[mark]["d_mm"] / MM
                for faces, length in per_faces.items():
                    clear = metres(length)
                    left, right = (face / MM for face in faces)
                    add("BEAM", CONCRETE, level, b * (d - max(left, right)) * clear)
                    add("BEAM", FORMWORK, level, ((d - left) + (d - right) + b) * clear)
            plate = self.plate_m2()
            plugs = self.column_plugs_m2()
            wells = self.openings_m2(level)
            soffit = self.beam_soffit_m2(groups)
            free_edge = self.free_edge_m(level, groups)
            thickness = Decimal(self.slabs[level]["thickness_mm"]) / MM
            net = plate - plugs - wells
            add("SLAB", CONCRETE, level, net * thickness)
            add("SLAB", FORMWORK, level, (net - soffit) + free_edge * thickness)
        return totals

    def plate_m2(self) -> Decimal:
        _, _, width, height = self.plate()
        return square_metres(width * height)

    def column_plugs_m2(self) -> Decimal:
        """The plan area every column drives through the slab above it (AM-01: floor-to-floor)."""
        return square_metres(
            sum(
                (self.column_at(i, j)["b_mm"] * self.column_at(i, j)["d_mm"] for i, j in self.placement),
                Decimal(0),
            )
        )

    def openings_m2(self, level: str) -> Decimal:
        return square_metres(sum((w * h for _, _, w, h in self.openings_at(level)), Decimal(0)))

    def beam_soffit_m2(self, groups: dict[str, dict[tuple[Decimal, Decimal], Decimal]]) -> Decimal:
        return square_metres(
            sum(
                (
                    self.beams[mark]["b_mm"] * sum(per_faces.values(), Decimal(0))
                    for mark, per_faces in groups.items()
                ),
                Decimal(0),
            )
        )

    def free_edge_m(self, level: str, groups: dict[str, dict[tuple[Decimal, Decimal], Decimal]]) -> Decimal:
        """The wells' edges, less the stretches a trimmer beam owns (AM-02: one owner)."""
        perimeter = sum((2 * (w + h) for _, _, w, h in self.openings_at(level)), Decimal(0))
        trimmed = sum(
            (sum(per_faces.values(), Decimal(0)) for mark, per_faces in groups.items() if mark == "B5"),
            Decimal(0),
        )
        return metres(perimeter - trimmed)

    # -- what R-7 declares ---------------------------------------------------------------------

    def r7_overage(self, column_formwork_m2: Decimal) -> dict[str, Any]:
        """The COLUMN FORMWORK the golden knowingly over-bills: AM-02's two terms, from the plan.

        AM-02 takes a vertical member's formwork as perimeter x (storey - t_slab), less each
        member-end contact above `memberEndNoDeductMaxCm2`. The golden keeps v1.0's
        2(b + d) x storey (AM-01 freezes those rows), so it is over by exactly those two terms:

        * the band each slab drives through the column it sits on - perimeter x t_slab, for every
          column with a slab above it; and
        * the end of every beam that frames into a column top - b x (D - t) each, counted only
          where it is bigger than the threshold.
        """
        band = Decimal(0)
        ends = Decimal(0)
        contacts = 0
        per_level: dict[str, dict[str, str]] = {}
        for index, level in enumerate(self.levels):
            above = self.levels[index + 1] if index + 1 < len(self.levels) else None
            thickness = (
                Decimal(self.slabs[above]["thickness_mm"]) / MM if above in self.slabs else Decimal(0)
            )
            level_band = Decimal(0)
            for column in self.inputs["columns"]:
                if level in [str(name) for name in column["levels"]]:
                    perimeter = 2 * (column["b_mm"] / MM + column["d_mm"] / MM)
                    level_band += Decimal(column["count"]) * perimeter * thickness
            level_ends = Decimal(0)
            level_contacts = 0
            if above in self.slabs:
                for run in self.runs(above):
                    if not run.supports:
                        continue
                    b = self.beams[run.mark]["b_mm"] / MM
                    d = self.beams[run.mark]["d_mm"] / MM
                    contact = b * (d - thickness)
                    for _ in run.supports:
                        if contact * CM2_PER_M2 > MEMBER_END_NO_DEDUCT_MAX_CM2:
                            level_ends += contact
                            level_contacts += 1
            if level_band or level_ends:
                per_level[level] = {
                    "slab_band_m2": spelled(level_band),
                    "beam_end_contacts_m2": spelled(level_ends),
                    "beam_ends": str(level_contacts),
                }
            band += level_band
            ends += level_ends
            contacts += level_contacts
        total = band + ends
        return {
            "slab_band_m2": spelled(band),
            "beam_end_contacts_m2": spelled(ends),
            "beam_end_contacts": contacts,
            "member_end_no_deduct_max_cm2": str(MEMBER_END_NO_DEDUCT_MAX_CM2),
            "total_m2": spelled(total),
            "column_formwork_m2": spelled(column_formwork_m2),
            "share_pct": format(
                (total / column_formwork_m2 * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_EVEN), "f"
            ),
            "per_level": per_level,
        }


DRAWN_CLASSES = frozenset({"BEAM", "SLAB"})
DRAWN_KEYS = [key for key in GOLDEN_KEYS if key[0] in DRAWN_CLASSES]


def _plan(corpus) -> Plan:
    return corpus.once("drawn-plan", lambda: Plan(_inputs(corpus)))


def _drawn(corpus) -> dict[Key, Decimal]:
    return corpus.once("drawn-quantities", lambda: _plan(corpus).quantities())


def _manifest(corpus) -> dict[str, Any]:
    return corpus.read_json(MANIFEST_REL)


def test_ac7_the_second_path_reads_the_drawing_and_not_the_generators_digest() -> None:
    """The path that proves the quantities may not consult the digest it is meant to check."""
    source = Path(__file__).read_text(encoding="utf-8")
    body = source.split("class Plan:", 1)[1].split("# -- what R-7 declares", 1)[0]
    for field in MEASURED_FIELDS:
        assert f'"{field}"' not in body and f"'{field}'" not in body, (
            f"the drawn path reads inputs.json's {field!r} — it would then prove the golden "
            f"against the same pre-digested numbers the golden was billed from"
        )


def test_ac7_the_drawn_column_arrangement_is_the_one_the_inputs_count(corpus) -> None:
    """The arrangement the plan is read with stands or falls by the counts the schedule authors."""
    plan = _plan(corpus)
    intersections = len(plan.xs) * len(plan.ys)
    assert len(plan.placement) == intersections, (
        f"the grid has {intersections} intersections and the plan places {len(plan.placement)} columns"
    )
    drawn = Counter(str(column["mark"]) for column in plan.placement.values())
    authored = {str(column["mark"]): int(column["count"]) for column in _inputs(corpus)["columns"]}
    assert dict(drawn) == authored, (
        f"the arrangement read off the grid places {dict(drawn)}, the column schedule authors {authored}"
    )


def test_ac7_the_drawn_beam_runs_are_the_ones_the_beam_schedule_counts(corpus) -> None:
    """Every mark is drawn as many times as it is scheduled, at the span it is scheduled at.

    B5 is the exception the manifest declares as R-1: the schedule prints SPAN 4.5 m and the plan
    draws the four trimmers at the lengths of the wells they close.
    """
    plan, offences = _plan(corpus), []
    for mark, beam in sorted(plan.beams.items()):
        count, span = int(beam["count"]), Decimal(beam["span_m"])
        for level in plan.levels:
            drawn = [run for run in plan.runs(level) if run.mark == mark] if level in plan.slabs else []
            if not plan.drawn_at(mark, level):
                if drawn:
                    offences.append(f"{mark} at {level}: drawn where the schedule does not carry it")
                continue
            if level not in plan.slabs:
                continue
            if len(drawn) != count:
                offences.append(
                    f"{mark} at {level}: {len(drawn)} runs drawn, the schedule counts {count}"
                )
            if mark == "B5":
                continue
            for run in drawn:
                if run.supports:
                    along = "b_mm" if run.axis == "x" else "d_mm"
                    centres = run.b - run.a + sum(support[along] / 2 for support in run.supports)
                else:
                    # A secondary beam frames into the two B2 it hangs between, not into a column.
                    centres = run.b - run.a + plan.beams["B2"]["b_mm"]
                if metres(centres) != span:
                    offences.append(
                        f"{mark} at {level}: drawn {metres(centres)} m centre to centre,"
                        f" scheduled {span} m"
                    )
    assert offences == [], "\n".join(sorted(set(offences)))


def test_ac7_the_drawn_geometry_bills_exactly_the_beam_and_slab_rows_the_golden_carries(corpus) -> None:
    drawn, rows = _drawn(corpus), _formula_rows_by_key(corpus)
    golden = {key for key in rows if key[0] in DRAWN_CLASSES}
    assert drawn, "the drawn geometry gives rise to no BEAM or SLAB quantity at all"
    assert sorted(set(drawn) - golden) == [], (
        f"rows the drawing calls for that the golden lacks: {sorted(set(drawn) - golden)}"
    )
    assert sorted(golden - set(drawn)) == [], (
        f"BEAM/SLAB rows the drawing gives no rise to: {sorted(golden - set(drawn))}"
    )


@pytest.mark.parametrize("key", DRAWN_KEYS, ids=[":".join(key) for key in DRAWN_KEYS])
def test_ac7_each_beam_and_slab_quantity_recomputes_from_the_drawn_geometry(corpus, key: Key) -> None:
    """The golden's BEAM and SLAB rows, billed from the plan — never from `measured`."""
    drawn, rows = _drawn(corpus), _formula_rows_by_key(corpus)
    assert key in drawn, f"{key}: the drawing gives rise to no such row"
    want = spelled(drawn[key])
    assert rows[key]["quantity"] == want, (
        f"{key}: the golden says {rows[key]['quantity']}, the drawn geometry gives {want}"
    )


def test_ac7_the_measured_digest_states_what_the_drawing_measures(corpus) -> None:
    """`inputs.json`'s `measured` is the drawing's own measurement, in every field and both copies.

    The first path above bills from `measured`; this ties that digest to the plan, so a figure
    edited into `measured` (or into either of the two copies of a beam's clear length) is red here
    rather than silently billed twice over.
    """
    inputs, plan, offences = _inputs(corpus), _plan(corpus), []
    for beam in inputs["beams"]:
        mark = str(beam["mark"])
        measured = beam["measured"]
        for level in plan.slabs:
            groups = plan.beam_groups(level).get(mark, {})
            # The two are compared as numbers: `measured` spells a face "0.0" where the plan
            # measures it 0, and a digest that agrees to the millimetre is not a drift.
            drawn = [
                ([Decimal(face) for face in faces], metres(length))
                for faces, length in sorted(groups.items())
            ]
            stated = [
                ([Decimal(face) for face in group["slab_t_mm"]], Decimal(group["clear_m"]))
                for group in measured["faces"].get(level, [])
            ]
            if stated != drawn:
                offences.append(f"{mark} at {level}: measured.faces {stated} — the plan draws {drawn}")
            total = measured["clear_m"].get(level)
            if drawn:
                summed = sum((clear for _, clear in stated), Decimal(0))
                if total is None or Decimal(total) != summed:
                    offences.append(
                        f"{mark} at {level}: measured.clear_m says {total}, its own faces sum to {summed}"
                    )
            elif total is not None:
                offences.append(
                    f"{mark} at {level}: measured.clear_m states {total} where the plan draws nothing"
                )
    for slab in inputs["slab"]:
        level = str(slab["level"])
        groups = plan.beam_groups(level)
        stated = slab["measured"]
        for field, drawn_value in (
            ("plate_m2", plan.plate_m2()),
            ("columns_m2", plan.column_plugs_m2()),
            ("openings_m2", plan.openings_m2(level)),
            ("beam_soffit_m2", plan.beam_soffit_m2(groups)),
            ("free_edge_m", plan.free_edge_m(level, groups)),
        ):
            if Decimal(stated[field]) != drawn_value:
                offences.append(
                    f"SLAB {level}: measured.{field} says {stated[field]}, the plan draws {drawn_value}"
                )
    assert offences == [], "\n".join(offences)


def _column_formwork_m2(corpus) -> Decimal:
    return sum(
        (
            Decimal(row["quantity"])
            for row in _golden(corpus)["rows"]
            if row["class"] == "COLUMN" and row["kind"] == FORMWORK
        ),
        Decimal(0),
    )


def test_ac7_r7_is_declared_at_the_overage_the_drawing_computes(corpus) -> None:
    """R-7 is the one figure v1.1 leaves OVER, and the manifest must state how much, not guess.

    AM-01 freezes the COLUMN rows, so this path does not recompute them (v1.2 is ruled in
    fixtures/gen/rcc6_bnbc/DECISIONS.md W-01 and stays a desk item). What it does is measure the
    two terms AM-02 would take off them, from the drawing, and hold the manifest to the figures.
    """
    plan = _plan(corpus)
    overage = plan.r7_overage(_column_formwork_m2(corpus))
    print(
        f"\nR-7 (COLUMN FORMWORK, declared OVER): slab band {overage['slab_band_m2']} m2"
        f" + beam-end contacts {overage['beam_end_contacts_m2']} m2"
        f" ({overage['beam_end_contacts']} ends above {overage['member_end_no_deduct_max_cm2']} cm2)"
        f" = {overage['total_m2']} m2 of {overage['column_formwork_m2']} m2 COLUMN FORMWORK"
        f" ({overage['share_pct']} %)"
    )
    for level, terms in overage["per_level"].items():
        print(
            f"  {level}: band {terms['slab_band_m2']} m2"
            f" + ends {terms['beam_end_contacts_m2']} m2 ({terms['beam_ends']} ends)"
        )
    repairs = {str(repair["id"]): repair for repair in _manifest(corpus)["repairs"]}
    assert R7_ID in repairs, f"the manifest declares no {R7_ID}"
    declared = repairs[R7_ID].get("overage")
    assert declared == overage, (
        f"{R7_ID} declares {declared}\nthe drawing computes {overage}\n"
        "— the manifest must state the figure the geometry gives, not a prose estimate"
    )
