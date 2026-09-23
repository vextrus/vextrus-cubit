"""R0's revision register for F-RCC6-BNBC (W-19, W-19a): Rev C keeps every handle Rev B issued.

The set was issued as Rev B and the product keys on its handles (traps, the notation corpus, the model
recordings, the journeys). Rev C is drawn by the writers' append pass and by in-place corrections
registered in `emit/sheets/revc.CORRECTED`; `validate/revision.py` (check 9) holds a set to that
register against the Rev B files, read by git blob id. This suite proves, in order:

- the Rev B references are in the object store and are what the check says they are;
- the check has teeth: every way a regeneration can break a Rev B handle is refused by name;
- the generator as it stands writes a set that meets the register exactly (a fresh write, 3 s);
- the committed corpus meets it (at most the register, until the step that re-mints it);
- the append pass itself: Rev C content of every kind — an item on a Rev B view and on a Rev B
  sheet's paper, a dimension, a new layer, a new block defined mid-library, a new view, a new sheet —
  lands above Rev B's seed and moves no Rev B record in either set;
- the pins: every Rev B view has one, a view without one is refused, and the fence hides a member
  Rev C draws first from every Rev B composer.

The writers need Pillow (the `fixtures` dependency group), so the writes run in a subprocess under
that group; everything else reads bytes in-process.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[3]
CORPUS = ROOT / "fixtures" / "rcc6-bnbc"
sys.path.insert(0, str(ROOT))

from fixtures.gen.rcc6_bnbc import model as M  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import blocks as B  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import dxf as X  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import plan  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit import sheets as S  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit.scene import APPENDED, Scene  # noqa: E402
from fixtures.gen.rcc6_bnbc.emit.sheets import common, revc  # noqa: E402
from fixtures.gen.rcc6_bnbc.validate import revision as R  # noqa: E402

GENERATOR_TIMEOUT_S = 300


def _in_fixtures_group(*argv: str) -> subprocess.CompletedProcess[str]:
    """`uv run --project cad --group fixtures python <argv>` from the checkout (the writers need
    Pillow, which only that group carries)."""
    return subprocess.run(
        ["uv", "run", "--project", "cad", "--group", "fixtures", "python", *argv],
        cwd=ROOT, capture_output=True, text=True, timeout=GENERATOR_TIMEOUT_S, check=False,
    )


def _last_json(run: subprocess.CompletedProcess[str]) -> Any:
    assert run.returncode == 0, (
        f"exit {run.returncode}\n--- stderr ---\n{run.stderr[-4000:]}\n--- stdout ---\n{run.stdout[-2000:]}"
    )
    start = run.stdout.index("{")
    return json.loads(run.stdout[start:])


@pytest.fixture(scope="module")
def issued_paper() -> bytes:
    return R.git_blob(R.REV_B["paper"].blob, "rcc6-bnbc.dxf")


# ---------------------------------------------------------------------------------------------
# The references
# ---------------------------------------------------------------------------------------------


@pytest.mark.parametrize("role", sorted(R.REV_B))
def test_each_rev_b_file_is_read_from_the_object_store_and_is_the_issue_it_names(role: str) -> None:
    rev_b = R.REV_B[role]
    run = subprocess.run(["git", "cat-file", "-t", rev_b.blob], cwd=ROOT, capture_output=True, text=True,
                         check=False)
    assert run.stdout.strip() == "blob", f"{rev_b.name}'s Rev B blob {rev_b.blob} is not in the object store"
    drawing = R.issued(role)
    assert drawing.seed == rev_b.seed, (role, drawing.seed, rev_b.seed)
    seed = int(rev_b.seed, 16)
    assert all(int(h, 16) < seed for h in drawing.records), f"{role}: a Rev B handle at or above its seed"
    assert len(drawing.records) > 8000, (role, len(drawing.records))


def test_the_rev_b_trap_registry_is_the_one_the_corpus_issued() -> None:
    traps = R.issued_traps()
    assert len(traps) == 52, len(traps)
    assert sum(1 for handle in traps.values() if handle) == 48
    assert traps["T-FRAMES-MODELSPACE"] == "21EE"


def test_a_missing_rev_b_blob_is_a_failure_never_a_skip() -> None:
    with pytest.raises(R.RevisionError, match="not in this clone's object store"):
        R.git_blob("0" * 40, "rcc6-bnbc.dxf")


# ---------------------------------------------------------------------------------------------
# The check's teeth: mutations of the issued paper set
# ---------------------------------------------------------------------------------------------


def _lines(data: bytes) -> list[str]:
    return data.decode("utf-8", errors="surrogateescape").split("\n")


def _bytes(lines: list[str]) -> bytes:
    return "\n".join(lines).encode("utf-8", errors="surrogateescape")


def _span(lines: list[str], handle: str) -> tuple[int, int]:
    """[start, end) of the record carrying `handle` (code 5), in lines."""
    for i in range(0, len(lines) - 1, 2):
        if lines[i].strip() == "5" and lines[i + 1].strip() == handle:
            start = i
            while lines[start].strip() != "0":
                start -= 2
            end = i + 2
            while lines[end].strip() != "0":
                end += 2
            return start, end
    raise AssertionError(f"no record carries {handle}")


def _set(lines: list[str], handle: str, code: str, value: str) -> list[str]:
    start, end = _span(lines, handle)
    out = list(lines)
    for i in range(start, end, 2):
        if out[i].strip() == code:
            out[i + 1] = value
            return out
    raise AssertionError(f"{handle} has no code {code}")


def _first(drawing: R.Drawing, kind: str) -> str:
    return min((h for h, r in drawing.records.items() if r.kind == kind), key=lambda h: int(h, 16))


def _compare(issued: bytes, now: bytes, register: dict[str, str] | None = None, *,
             exact: bool = True) -> dict:
    return R.compare("paper", R.read(issued), R.read(now), register or {}, exact=exact)


def test_the_issue_against_itself_is_clean(issued_paper: bytes) -> None:
    report = _compare(issued_paper, issued_paper)
    assert report["corrected"] == report["added"] == report["grown"] == 0
    assert report["issued"] == report["records"]


def test_a_lost_record_is_refused_by_handle(issued_paper: bytes) -> None:
    lines = _lines(issued_paper)
    line = _first(R.read(issued_paper), "LINE")
    start, end = _span(lines, line)
    with pytest.raises(R.RevisionError, match=rf"records lost: 1 — \['{line}'\]"):
        _compare(issued_paper, _bytes(lines[:start] + lines[end:]))


def test_a_record_that_changed_layer_is_refused(issued_paper: bytes) -> None:
    line = _first(R.read(issued_paper), "LINE")
    moved = _set(_lines(issued_paper), line, "8", "Revision")
    with pytest.raises(R.RevisionError, match=rf"type or layer moved: 1 — \['{line} LINE/"):
        _compare(issued_paper, _bytes(moved))


def test_an_unregistered_rewrite_is_refused_and_a_registered_one_is_counted(issued_paper: bytes) -> None:
    line = _first(R.read(issued_paper), "LINE")
    lines = _lines(issued_paper)
    start, _ = _span(lines, line)
    x = next(i for i in range(start, len(lines), 2) if lines[i].strip() == "10")
    rewritten = _bytes(_set(lines, line, "10", str(float(lines[x + 1]) + 1.0)))
    with pytest.raises(R.RevisionError, match=rf"rewritten but not registered: 1 — \['{line} LINE/"):
        _compare(issued_paper, rewritten)
    assert _compare(issued_paper, rewritten, {line: "K0"})["corrected"] == 1


def test_a_registered_record_that_did_not_change_is_refused_both_ways(issued_paper: bytes) -> None:
    line = _first(R.read(issued_paper), "LINE")
    with pytest.raises(R.RevisionError, match=rf"registered records that did not change: 1 — \['{line}'\]"):
        _compare(issued_paper, issued_paper, {line: "K0"})
    # over a committed corpus a later step has not re-minted, the register is a ceiling, not a set
    assert _compare(issued_paper, issued_paper, {line: "K0"}, exact=False)["corrected"] == 0


@pytest.mark.parametrize("kind", ["VIEWPORT", "TABLE", "DICTIONARY"])
def test_the_register_never_names_a_viewport_or_a_container(issued_paper: bytes, kind: str) -> None:
    handle = _first(R.read(issued_paper), kind)
    with pytest.raises(R.RevisionError, match=rf"{handle}: a {kind} is never corrected"):
        _compare(issued_paper, issued_paper, {handle: "D-TANK"}, exact=False)


def test_the_register_names_issued_records_and_their_corrections(issued_paper: bytes) -> None:
    line = _first(R.read(issued_paper), "LINE")
    with pytest.raises(R.RevisionError, match="FFFFF: Rev B issued no record under it"):
        _compare(issued_paper, issued_paper, {"FFFFF": "K1"}, exact=False)
    with pytest.raises(R.RevisionError, match="does not name a correction"):
        _compare(issued_paper, issued_paper, {line: "moved it"}, exact=False)


def test_an_added_record_must_sit_above_the_seed(issued_paper: bytes) -> None:
    drawing = R.read(issued_paper)
    lines = _lines(issued_paper)
    line = _first(drawing, "LINE")
    start, end = _span(lines, line)
    seed = int(R.REV_B["paper"].seed, 16)
    low = next(f"{n:X}" for n in range(0x100, seed) if f"{n:X}" not in drawing.records)

    def with_copy(handle: str) -> bytes:
        copy = list(lines[start:end])
        at = next(i for i in range(0, len(copy), 2) if copy[i].strip() == "5")
        copy[at + 1] = handle
        return _bytes([*lines[:end], *copy, *lines[end:]])

    with pytest.raises(R.RevisionError, match=rf"below Rev B's seed 22A8: \['{low}'\]"):
        _compare(issued_paper, with_copy(low))
    assert _compare(issued_paper, with_copy(f"{seed + 5:X}"))["added"] == 1


def test_a_header_variable_other_than_the_seed_may_not_move(issued_paper: bytes) -> None:
    lines = _lines(issued_paper)
    at = next(i for i in range(0, len(lines) - 1, 2)
              if lines[i].strip() == "9" and lines[i + 1] == "$INSUNITS")
    moved = list(lines)
    moved[at + 3] = "4"
    with pytest.raises(R.RevisionError,
                       match=r"header variables other than \$HANDSEED moved: \['\$INSUNITS'\]"):
        _compare(issued_paper, _bytes(moved))


def test_a_container_may_grow_and_may_not_shrink(issued_paper: bytes) -> None:
    drawing = R.read(issued_paper)
    handle = next(h for h, r in sorted(drawing.records.items(), key=lambda kv: int(kv[0], 16))
                  if r.kind == "DICTIONARY" and sum(1 for c, _ in r.body if c == "3") >= 2)
    lines = _lines(issued_paper)
    start, end = _span(lines, handle)
    entry = next(i for i in range(start, end, 2) if lines[i].strip() == "3")
    grown = [*lines[:entry], "  3", "R0_PROBE", "350", "FFFF0", *lines[entry:]]
    assert _compare(issued_paper, _bytes(grown))["grown"] == 1
    shrunk = lines[:entry] + lines[entry + 4:]
    with pytest.raises(R.RevisionError, match=rf"rewritten but not registered: 1 — \['{handle} DICTIONARY"):
        _compare(issued_paper, _bytes(shrunk))


def test_every_trap_keeps_its_handle() -> None:
    issued = R.issued_traps()
    doc = json.loads((CORPUS / "traps.json").read_text(encoding="utf-8"))
    assert R.compare_traps(issued, doc) == "52/52"
    moved = json.loads(json.dumps(doc))
    next(t for t in moved["traps"] if t["id"] == "T-FRAMES-MODELSPACE")["handle"] = "21EF"
    with pytest.raises(R.RevisionError, match=r"\('T-FRAMES-MODELSPACE', '21EE', '21EF'\)"):
        R.compare_traps(issued, moved)
    dropped = {**doc, "traps": [t for t in doc["traps"] if t["id"] != "T-BENGALI"]}
    with pytest.raises(R.RevisionError, match=r"no longer registered \['T-BENGALI'\]"):
        R.compare_traps(issued, dropped)


# ---------------------------------------------------------------------------------------------
# The generator as it stands, and the committed corpus
# ---------------------------------------------------------------------------------------------


@pytest.fixture(scope="module")
def fresh(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    out = tmp_path_factory.mktemp("rcc6-bnbc-revision")
    run = _in_fixtures_group("-m", "fixtures.gen.rcc6_bnbc.validate.revision", "--out", str(out))
    return {"out": out, "report": _last_json(run)}


def test_the_generator_as_it_stands_meets_the_register_exactly(fresh: dict[str, Any]) -> None:
    report = fresh["report"]
    for role, rev_b in R.REV_B.items():
        assert report[role]["corrected"] == len(revc.CORRECTED[rev_b.register]), (role, report[role])
        assert report[role]["issued"] <= report[role]["records"]
    assert report["traps"] == "52/52"
    assert report["windows"]["pinned"] == len(common.REVB_WINDOWS) == 53
    # every authored item was written in both sets, and a corrected item is corrected in both
    assert report["items"]["items"] > 5000
    assert report["items"]["corrected"] <= len(revc.CORRECTED["paper"])


def test_the_committed_corpus_keeps_every_rev_b_handle() -> None:
    traps = json.loads((CORPUS / "traps.json").read_text(encoding="utf-8"))
    report = R.check_files(CORPUS, traps, exact=False)
    for role in R.REV_B:
        assert report[role]["corrected"] <= len(revc.CORRECTED[R.REV_B[role].register]), (role, report[role])
    assert report["traps"] == "52/52"


# ---------------------------------------------------------------------------------------------
# The append pass: Rev C content of every kind moves no Rev B record
# ---------------------------------------------------------------------------------------------

PROBE_LAYER = ("S-R0PROBE", "R0 Probe", 3)
PROBE_BLOCK = "R0_PROBE"
PROBE_VIEW = "R0 PROBE VIEW"
PROBE_SHEET = ("S-27", "R0 PROBE SHEET")


def probe(out: Path) -> dict[str, Any]:
    """Run under the fixtures group (`__main__` below): the generator's own sheets, plus Rev C
    content of every kind the append pass takes, written as both sets. Returns the handle each
    probe item got in each set, and what the written files hold."""
    import ezdxf
    from fixtures.gen.rcc6_bnbc.emit import images
    from fixtures.gen.rcc6_bnbc.emit.scene import Block, Sheet

    key, name, colour = PROBE_LAYER
    plan.LAYERS[key] = (name, colour)
    X.LAYER[key] = name
    sheets = S.compose(M.build())
    blocks = S.blocks()
    mark = Scene()
    mark.circle((0.0, 0.0), 100.0, key)
    blocks.insert(3, Block(PROBE_BLOCK, mark))  # mid-library: still defined in the append pass

    by = {sheet.number: sheet for sheet in sheets}
    s20 = by["S-20"]
    items: list[dict[str, Any]] = []
    plan_view = s20.views[0].scene
    with plan_view.revision(APPENDED):
        items.append(plan_view.line((0.0, 0.0), (1000.0, 0.0), key))
        items.append(plan_view.text("R0 PROBE", (0.0, 200.0), 150.0))
        items.append(plan_view.dim((0.0, -500.0), (1000.0, -500.0), (0.0, -800.0), 0.0, 100.0))
        items.append(plan_view.insert(PROBE_BLOCK, (500.0, 500.0), key))
    with s20.paper.revision(APPENDED):
        items.append(s20.paper.text("R0 PROBE NOTE", (30.0, 30.0), 3.0, "S-SHEET"))
    own = Scene()
    items.append(own.rect(0.0, 0.0, 2000.0, 1000.0, key))
    items.append(own.insert("GRID_BUBBLE", (0.0, 0.0), "S-GRIDC", attribs={"GRID": "Z"}))
    items.append(own.mtext("R0 PROBE\\PVIEW", (100.0, 900.0), 80.0, 1500.0))
    revc.add_view(s20, PROBE_VIEW, own, 50, (560.0, 380.0), (60.0, 40.0))
    number, title = PROBE_SHEET
    new = Sheet(number, title, "A3", [], Scene(), "1:50", "B", new_in=APPENDED)
    items.append(new.paper.rect(10.0, 10.0, 400.0, 277.0, "S-SHEET"))
    inside = Scene()
    items.append(inside.line((0.0, 0.0), (3000.0, 2000.0), key))
    revc.add_view(new, "R0 PROBE SHEET VIEW", inside, 50, (40.0, 60.0), (100.0, 80.0))
    sheets.append(new)

    pictures = images.author()
    paper, _ = X.write_paper(sheets, blocks, pictures, out)
    paper_of = {id(item): X.LAST_HANDLES[id(item)] for item in items}
    X.write_model_frames(sheets, blocks, pictures, out)
    frames_of = {id(item): X.MODEL_HANDLES[id(item)] for item in items}

    doc = ezdxf.readfile(str(paper))
    viewports = {layout.name: len(layout.query("VIEWPORT")) for layout in doc.layouts
                 if layout.name != "Model"}
    return {
        "paper": [paper_of[id(item)] for item in items],
        "frames": [frames_of[id(item)] for item in items],
        "viewports": viewports,
        "layer": name in doc.layers,
        "block": PROBE_BLOCK in doc.blocks,
        "s20": s20.layout_name,
        "new": new.layout_name,
    }


@pytest.fixture(scope="module")
def probed(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Any]:
    out = tmp_path_factory.mktemp("rcc6-bnbc-probe")
    run = _in_fixtures_group(str(Path(__file__).resolve()), "--probe", str(out))
    return {"out": out, "report": _last_json(run)}


@pytest.mark.parametrize("role", ["paper", "frames"])
def test_the_append_pass_moves_no_rev_b_record(probed: dict[str, Any], role: str) -> None:
    rev_b = R.REV_B[role]
    now = R.read((probed["out"] / rev_b.name).read_bytes())
    issued = R.issued(role)
    report = R.compare(role, issued, now, {}, exact=True)
    assert report["corrected"] == 0
    assert report["added"] >= len(probed["report"][role]), report
    # the new layer grows the layer table, the new block and the dimension's own block the block
    # records, and in the paper set the new layout the layout dictionary — those three, and nothing
    # else Rev B issued, changed at all
    grown = {(issued.records[h].kind, issued.records[h].label) for h in issued.records
             if h in now.records and issued.records[h].body != now.records[h].body}
    expected = {("TABLE", "LAYER"), ("TABLE", "BLOCK_RECORD")}
    if role == "paper":
        expected.add(("DICTIONARY", None))
    assert grown == expected, grown
    assert report["grown"] == len(expected)
    seed = int(rev_b.seed, 16)
    for handle in probed["report"][role]:
        assert int(handle, 16) >= seed, f"{role}: a Rev C item took {handle}, below Rev B's seed"
        assert handle in now.records, f"{role}: {handle} is not in the written file"


def test_the_append_pass_draws_every_kind_of_rev_c_content(probed: dict[str, Any]) -> None:
    report = probed["report"]
    assert report["layer"] and report["block"]
    issued = _issued_viewports()
    s20, new = report["s20"], report["new"]
    # the new view has its own window on its Rev B sheet; the new sheet its own layout
    assert report["viewports"][s20] == issued[s20] + 1
    assert report["viewports"][new] == 2  # the layout's own viewport and the view's
    others = {name: n for name, n in report["viewports"].items() if name not in (s20, new)}
    assert others == {name: n for name, n in issued.items() if name != s20}


def _issued_viewports() -> dict[str, int]:
    import io

    import ezdxf

    text = R.git_blob(R.REV_B["paper"].blob, "rcc6-bnbc.dxf").decode("utf-8", errors="surrogateescape")
    doc = ezdxf.read(io.StringIO(text))
    return {layout.name: len(layout.query("VIEWPORT")) for layout in doc.layouts
            if layout.name != "Model"}


# ---------------------------------------------------------------------------------------------
# The pins, the fence and the tags
# ---------------------------------------------------------------------------------------------


def test_every_rev_b_view_has_its_pinned_window_and_every_pin_its_view() -> None:
    sheets = S.compose(M.build())
    keys = set()
    for sheet in sheets:
        for index, view in enumerate(v for v in sheet.views if v.rev is None):
            key = f"{sheet.number}#{index}"
            title, origin = common.REVB_WINDOWS[key]
            assert (view.title, tuple(view.world_origin)) == (title, origin), key
            keys.add(key)
    assert keys == set(common.REVB_WINDOWS)
    assert len(keys) == 53


def test_a_view_without_a_pin_is_refused() -> None:
    ctx = common.Ctx(M.build())
    paper = common.new_paper(ctx, "S-03")
    pinned = [title for key, (title, _) in sorted(common.REVB_WINDOWS.items()) if key.startswith("S-03#")]
    with pytest.raises(AssertionError, match=r"S-03#0: the pinned window is"):
        paper.view("NOT THE ISSUED VIEW", Scene(), 10, (20.0, 20.0), (50.0, 50.0))
    for title in pinned:
        scene = Scene()
        scene.line((0.0, 0.0), (10.0, 10.0))
        paper.view(title, scene, 10, (20.0, 20.0), (50.0, 50.0))
    refusal = r"S-03#3 'A FOURTH VIEW': no Rev B window is pinned .*emit/sheets/revc\.py"
    with pytest.raises(AssertionError, match=refusal):
        paper.view("A FOURTH VIEW", Scene(), 10, (20.0, 20.0), (50.0, 50.0))


def test_the_fence_hides_a_member_rev_c_draws_first_from_every_rev_b_index() -> None:
    world = M.build()
    with_bars = {bar["member"] for bar in world["bars"]}
    member = next(m for m in world["members"] if m["class"] == "BEAM" and m["id"] in with_bars)
    fenced = common.Ctx(world, fence=frozenset({member["id"]}))
    whole = common.Ctx(world)
    assert member["id"] in whole.by_id and member["id"] not in fenced.by_id
    assert member not in fenced.at(member["class"], member["level"])
    assert member not in fenced.by_class[member["class"]]
    assert member not in fenced.by_mark.get(member["mark"], [])
    # its bars are member-derived too: a loop over every bar sees none of them, and nothing else goes
    own = [bar for bar in whole.bars if bar["member"] == member["id"]]
    assert own and not [bar for bar in fenced.bars if bar["member"] == member["id"]]
    assert len(fenced.bars) == len(whole.bars) - len(own) and whole.bars == world["bars"]
    with pytest.raises(AssertionError, match="the Rev C fence names members the model does not build"):
        common.Ctx(world, fence=frozenset({"NO-SUCH@MEMBER"}))
    common.Ctx(world, fence=revc.DRAWN_IN_C)  # the register's own fence names real members


def test_the_revision_tags_are_carried_by_every_way_an_item_is_added() -> None:
    scene, other = Scene(), Scene()
    other.line((0.0, 0.0), (1.0, 1.0))
    scene.line((0.0, 0.0), (1.0, 0.0))
    with scene.revision(APPENDED):
        tagged = scene.text("C", (0.0, 0.0), 1.0)
        scene.extend(other, (5.0, 5.0))
    after = scene.circle((0.0, 0.0), 1.0)
    assert [item.get("rev") for item in scene.items] == [None, APPENDED, APPENDED, None]
    assert tagged["rev"] == APPENDED and "rev" not in after and "rev" not in other.items[0]
    assert scene.rev is None


def test_the_rev_b_layer_and_block_rosters_never_retire() -> None:
    assert set(plan.LAYERS) >= X.REV_B_LAYERS
    assert {block.name for block in B.library()} >= X.REV_B_BLOCKS
    assert set(revc.CORRECTED) == {"paper", "frames"}
    assert X.APPENDED == APPENDED == "C"


if __name__ == "__main__":
    # `python <this file> --probe <out>`, under the fixtures group: the append-pass probe above.
    assert sys.argv[1] == "--probe", sys.argv
    target = Path(sys.argv[2])
    target.mkdir(parents=True, exist_ok=True)
    print(json.dumps(probe(target), indent=2))
