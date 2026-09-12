"""The DWG profile and the minting (Wave B D4, W-04).

Public API (Implementer B calls exactly these):

    canary(scratch)  -> {feature: {"ok": bool, "lost": {...}, "reason": str, "census": {...}}}
    profile(canaries) -> set[str]                      the features to leave out of the DWG source
    mint(sheets, blocks, images, canaries, scratch)
        -> {"rcc6-bnbc.dwg": bytes, "rcc6-bnbc.model.dwg": bytes, "spec": {...}}

The DWG is judged by its census, never by its bytes (E-fixture 3.9). Every feature
`scene.feature_scenes()` names is minted ALONE first — written as a tiny R2004 DXF, converted with
`dxf2dwg`, read back with `dwg2dxf` and counted both ways — and whatever LibreDWG loses or corrupts
is left out of the DWG source and named in `sanity.json["dwg"][*]["losses"]` with its reason. The
DXF keeps every one of them: the loss is the DWG lane's, not the fixture's.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import ezdxf

from . import dxf as _dxf
from .scene import Block, Scene, Sheet, canary_blocks, feature_scenes

#: LibreDWG's budget for one conversion.
TIMEOUT_SECONDS = 600.0

#: The layout feature no Scene can hold: a paper layout with a single VIEWPORT.
VIEWPORT_FEATURE = "viewport"

#: The names of the two minted drawings, by the DXF each is minted from.
MINTED = {"rcc6-bnbc.dxf": "rcc6-bnbc.dwg", "rcc6-bnbc.model.dxf": "rcc6-bnbc.model.dwg"}


def _tool(name: str) -> str:
    program = shutil.which(name)
    if program is None:
        raise RuntimeError(f"{name} (LibreDWG) is not on PATH; the DWG cannot be minted")
    return program


def _run(argv: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(argv, capture_output=True, text=True, check=False,
                          timeout=TIMEOUT_SECONDS)


def dxf_to_dwg(dxf_path: Path, dwg_path: Path) -> subprocess.CompletedProcess[str]:
    """`dxf2dwg`, judged by the drawing it wrote and never by its exit code (L-CAD-04)."""
    run = _run([_tool("dxf2dwg"), "-y", "-o", str(dwg_path), str(dxf_path)])
    if not dwg_path.is_file() or dwg_path.stat().st_size == 0:
        raise RuntimeError(f"dxf2dwg wrote no drawing (exit {run.returncode}): "
                           f"{run.stderr.strip()[-2000:]}")
    return run


def dwg_to_dxf(dwg_path: Path, dxf_path: Path) -> None:
    run = _run([_tool("dwg2dxf"), "-m", "-y", "-o", str(dxf_path), str(dwg_path)])
    if not dxf_path.is_file() or dxf_path.stat().st_size == 0:
        raise RuntimeError(f"dwg2dxf wrote no drawing (exit {run.returncode}): "
                           f"{run.stderr.strip()[-2000:]}")


def dwg_census(dwg_path: Path) -> dict[str, dict[str, int]]:
    """`dwgread -O JSON`, tallied the way `vextrus_cad.dwg.census_of` tallies it."""
    from vextrus_cad.dwg.census import census_of

    with tempfile.TemporaryDirectory(prefix="bnbc-census-") as room:
        out = Path(room) / "census.json"
        _run([_tool("dwgread"), "-O", "JSON", "-o", str(out), str(dwg_path)])
        if not out.is_file():
            return {}
        return census_of(json.loads(out.read_text(encoding="utf-8", errors="replace")))


# ---------------------------------------------------------------------------------------------
# The canaries
# ---------------------------------------------------------------------------------------------


def _tiny(scene: Scene, blocks: list[Block], images: dict[str, bytes], room: Path,
          with_viewport: bool = False) -> tuple[Path, dict[str, int], str | None]:
    """One feature alone in an R2004 DXF; returns the file, its model-space tally and its text."""
    doc = _dxf.new_document()
    placer = _dxf.Placer(doc, images)
    for block in blocks:
        placer.block(block)
    placer.place(doc.modelspace(), scene, "model")
    if with_viewport:
        layout = doc.layouts.new("CANARY")
        layout.page_setup(size=(420, 297), margins=(0, 0, 0, 0), units="mm")
        _dxf._delete_main_viewport(layout)
        note = Scene()
        note.text("CANARY", (20.0, 10.0), 4.0, "S-SHEET")
        placer.place(layout, note, "CANARY")
        layout.add_viewport(center=(210, 148), size=(380, 260), view_center_point=(0, 0),
                            view_height=2000)
    if with_viewport:
        doc.layouts.delete("Layout1")
    _dxf._finish(doc)
    path = room / "canary.dxf"
    doc.saveas(path)
    counts = placer.counts()
    text = next((i.get("s") or i.get("raw") for i in scene.items
                 if i["kind"] in ("TEXT", "MTEXT")), None)
    return path, counts.get("model", {}), text


def _roundtrip_counts(path: Path) -> tuple[dict[str, int], list[str]]:
    doc = ezdxf.readfile(str(path))
    counter: Counter[str] = Counter()
    strings = []
    for name in doc.layouts.names_in_taborder():
        if name != "Model":
            continue
        for entity in doc.layouts.get(name):
            if entity.dxftype() in _dxf.NOT_CONTENT:
                continue
            counter[entity.dxftype()] += 1
            if entity.dxftype() == "TEXT":
                strings.append(entity.dxf.text)
            elif entity.dxftype() == "MTEXT":
                strings.append(entity.text)
    return dict(counter), strings


def canary(scratch: Path) -> dict[str, dict[str, Any]]:
    """Mint every feature alone and record what LibreDWG did with it — never what it should do."""
    from . import images as _images

    scratch = Path(scratch)
    room = scratch / "canary"
    room.mkdir(parents=True, exist_ok=True)
    logo = _images.author()[_images.LOGO]
    images = {"canary-logo": logo, _images.LOGO: logo, _images.SCAN: logo}
    blocks = canary_blocks()
    out: dict[str, dict[str, Any]] = {}
    scenes = dict(feature_scenes())
    for feature in [*sorted(scenes), VIEWPORT_FEATURE]:
        scene = scenes.get(feature, Scene())
        stage = room / feature
        stage.mkdir(parents=True, exist_ok=True)
        (stage / "images").mkdir(exist_ok=True)
        for name, data in sorted(images.items()):
            (stage / "images" / f"{name}.png").write_bytes(data)
        try:
            path, drawn, text = _tiny(scene, blocks, images, stage,
                                      with_viewport=feature == VIEWPORT_FEATURE)
            dwg = stage / "canary.dwg"
            dxf_to_dwg(path, dwg)
            back = stage / "back.dxf"
            dwg_to_dxf(dwg, back)
            got, strings = _roundtrip_counts(back)
            census = dwg_census(dwg)
        except Exception as error:  # noqa: BLE001 - a toolchain refusal is a recorded loss
            out[feature] = {"ok": False, "lost": {}, "reason": f"{type(error).__name__}: {error}",
                            "census": {}}
            continue
        lost = {t: n - got.get(t, 0) for t, n in sorted(drawn.items()) if n - got.get(t, 0) != 0}
        reason = ""
        if lost:
            reason = "; ".join(f"{t}: drew {drawn[t]}, read back {got.get(t, 0)}" for t in lost)
        if text is not None and text not in strings:
            lost = dict(lost)
            reason = (reason + "; " if reason else "") + "the string did not survive the round trip"
        # a VIEWPORT is never content on the geometry side, so the viewport canary asks only
        # whether the layout it frames and that layout's own paint came back
        out[feature] = {"ok": not lost and "string" not in reason, "lost": lost,
                        "reason": reason or "round trip exact", "census": census}
    return out


def profile(canaries: dict[str, dict[str, Any]]) -> set[str]:
    """The features to leave OUT of the DWG source — the DXF keeps every one of them."""
    return {feature for feature, result in sorted(canaries.items()) if not result["ok"]}


# ---------------------------------------------------------------------------------------------
# Which feature an authored item belongs to
# ---------------------------------------------------------------------------------------------


#: Bengali's own block (U+0980..U+09FF). The canary that fails is the Bengali one, so only a string
#: in that script is excluded — the office's %C, the unicode Ø and the CP1252 mojibake are Latin
#: text that LibreDWG carries, and a string it mangles costs the census nothing anyway.
BENGALI = range(0x0980, 0x0A00)


def is_bengali(text: str) -> bool:
    return any(ord(c) in BENGALI for c in text)


def feature_of(item: dict[str, Any], nested: frozenset[str] = frozenset(),
               xrefs: frozenset[str] = frozenset()) -> str:
    kind = item["kind"]
    if kind == "MLEADER":
        return "mleader"
    if kind == "IMAGE":
        return "image"
    if kind == "LEADER":
        return "leader"
    if kind == "HATCH":
        if item.get("solid"):
            return "hatch_solid"
        return "hatch_complex" if len(item.get("paths", [])) > 1 else "hatch_simple"
    if kind == "POLYLINE":
        return "polyline2d"
    if kind in ("POINT", "SOLID"):
        return "point_solid"
    if kind == "DIMENSION":
        if item.get("dimlfac", 1.0) != 1.0:
            return "dimlfac"
        return "dimension"
    if kind == "INSERT":
        if item["block"] in xrefs:
            return "xref"
        if item["block"] in nested:
            return "nested_block"
        if item.get("attribs"):
            return "attrib_block"
        return "basic"
    if kind == "TEXT":
        if is_bengali(item["s"]):
            return "bengali"
        if item.get("rotation"):
            return "text_rotated"
        return "basic"
    if kind == "MTEXT":
        if is_bengali(item["raw"]):
            return "bengali"
        if "\\" in item["raw"] or "%%" in item["raw"]:
            return "mtext_codes"
        return "basic"
    if kind == "LWPOLYLINE":
        if item.get("elevation"):
            return "elevation_z"
        if item.get("bulges"):
            return "bulge"
    if item.get("linetype"):
        return "linetype"
    return "basic"


def _nested_and_xrefs(blocks: list[Block]) -> tuple[frozenset[str], frozenset[str]]:
    nested = {b.name for b in blocks if any(i["kind"] == "INSERT" for i in b.scene.items)}
    xrefs = {b.name for b in blocks if b.xref}
    return frozenset(nested), frozenset(xrefs)


def skipper(excluded: set[str], blocks: list[Block]) -> Any:
    """A predicate the DXF writer uses to leave an excluded feature out of the DWG source."""
    nested, xrefs = _nested_and_xrefs(blocks)

    def skip(item: dict[str, Any]) -> bool:
        if item["kind"] == "VIEWPORT":
            return VIEWPORT_FEATURE in excluded
        return feature_of(item, nested, xrefs) in excluded

    return skip


# ---------------------------------------------------------------------------------------------
# The minting
# ---------------------------------------------------------------------------------------------


def mint(
    sheets: list[Sheet],
    blocks: list[Block],
    images: dict[str, bytes],
    canaries: dict[str, dict[str, Any]],
    scratch: Path,
) -> dict[str, Any]:
    """Mint both DWGs under the profile, then read each back through the product's own lane and
    assert its census is exactly what was drawn minus the named losses."""
    from vextrus_cad.dwg import convert_dwg

    scratch = Path(scratch)
    room = scratch / "dwg"
    room.mkdir(parents=True, exist_ok=True)
    excluded = profile(canaries)
    skip = skipper(excluded, blocks)

    whole = room / "whole"
    _paper, drawn_paper = _dxf.write_paper(sheets, blocks, images, whole)
    _frames, drawn_frames = _dxf.write_model_frames(sheets, blocks, images, whole)
    drawn = {"rcc6-bnbc.dxf": drawn_paper, "rcc6-bnbc.model.dxf": drawn_frames}

    source = room / "source"
    paper_src, _ = _dxf.write_paper(sheets, blocks, images, source, skip=skip)
    frames_src, _ = _dxf.write_model_frames(sheets, blocks, images, source, skip=skip)

    out: dict[str, Any] = {"spec": {}}
    for src, dxf_name in ((paper_src, "rcc6-bnbc.dxf"), (frames_src, "rcc6-bnbc.model.dxf")):
        name = MINTED[dxf_name]
        dwg = room / name
        dxf_to_dwg(src, dwg)
        read_room = room / f"read-{name}"
        read_room.mkdir(parents=True, exist_ok=True)
        conversion = convert_dwg(dwg, read_room)
        census = {space: dict(sorted(types.items())) for space, types in sorted(conversion.census.items())}
        losses: dict[str, dict[str, int]] = {}
        for space, types in drawn[dxf_name].items():
            for dxftype, n in types.items():
                lost = n - census.get(space, {}).get(dxftype, 0)
                if lost:
                    losses.setdefault(space, {})[dxftype] = lost
        named = _named_losses(canaries, excluded, sheets, blocks, dxf_name)
        _prove_census(name, drawn[dxf_name], census, losses)
        out[name] = dwg.read_bytes()
        out["spec"][name] = {
            "source": dxf_name,
            "expected": census,
            "losses": losses,
            "named_losses": named,
            "tool": f"{conversion.tool} {conversion.tool_version}",
            "refused": [r.dxftype for r in conversion.refused],
        }
    return out


#: The one class the DWG census counts that the geometry side never does: `vextrus_cad.dwg`'s
#: NOT_TALLIED leaves VIEWPORT in, while `ingest`'s _NOT_CONTENT takes it out. A viewport frames
#: paint rather than being paint, so it is never a loss and never a gain — it is simply not drawn.
CENSUS_ONLY = frozenset({"VIEWPORT"})


def _prove_census(name: str, drawn: dict[str, dict[str, int]], census: dict[str, dict[str, int]],
                  losses: dict[str, dict[str, int]]) -> None:
    """The census must be exactly what was drawn minus the named losses, pair for pair; anything
    the census holds that was never drawn may only be a VIEWPORT."""
    bad = []
    for space, types in sorted(drawn.items()):
        for dxftype, n in sorted(types.items()):
            kept = census.get(space, {}).get(dxftype, 0)
            lost = losses.get(space, {}).get(dxftype, 0)
            if lost < 0:
                bad.append((space, dxftype, "the DWG holds more than was drawn", n, kept))
            elif kept != n - lost:
                bad.append((space, dxftype, "census is not drawn - losses", n, kept, lost))
    for space, types in sorted(census.items()):
        for dxftype in sorted(types):
            if dxftype not in drawn.get(space, {}) and dxftype not in CENSUS_ONLY:
                bad.append((space, dxftype, "the DWG holds a class nothing drew"))
    assert not bad, f"{name}: {bad[:12]}"


#: The DXF type ezdxf gives an authored primitive back under, where the two names differ.
DXF_TYPE = {"MLEADER": "MULTILEADER"}


def _named_losses(canaries: dict[str, dict[str, Any]], excluded: set[str], sheets: list[Sheet],
                  blocks: list[Block], dxf_name: str) -> list[dict[str, Any]]:
    """What each excluded feature actually cost THIS drawing, counted over the items left out, in
    the shape validate/tally.py reads. The counts add up to the measured losses, type for type."""
    nested, xrefs = _nested_and_xrefs(blocks)
    counted: Counter[tuple[str, str]] = Counter()
    for sheet in sheets:
        for scene in [sheet.paper, *[v.scene for v in sheet.views]]:
            for item in scene.items:
                feature = feature_of(item, nested, xrefs)
                if feature in excluded:
                    counted[(feature, DXF_TYPE.get(item["kind"], item["kind"]))] += 1
    del dxf_name
    return [
        {"feature": feature, "type": dxftype, "count": count,
         "reason": canaries[feature]["reason"]}
        for (feature, dxftype), count in sorted(counted.items())
    ]
