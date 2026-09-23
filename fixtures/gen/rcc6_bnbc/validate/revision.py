"""Check 9 — R0's revision register (W-19, W-19a): the regenerated set keeps every record Rev B
issued under the handle it was issued with, and rewrites exactly the records the register names.

The set was issued as Rev B, and the product keys on Rev B's handles: the trap registry, the
notation corpus, the model recordings, the journeys. Rev C is drawn by the writers' append pass and
by in-place value corrections (`emit/sheets/revc.py`). So, for each of the paper set, the frames set
and the paper set's R2000 twin, against the file as issued:

1. every Rev B record is present, under the same handle, with the same type and layer;
2. the records whose content changed are exactly `revc.CORRECTED` (the twin answers to the paper
   set's register) — both ways when the set was regenerated from this generator, and at most the
   register over a committed corpus a later step has not re-minted yet. A container (a table head or
   a dictionary) may only grow, which is what appending a record does to it;
3. every record Rev C adds takes a handle at or above Rev B's `$HANDSEED`, and the header is Rev
   B's but for `$HANDSEED`; the CLASSES Rev B registered come first, in order;
4. every trap keeps its handle (52 of 52 at Rev B).

Over a generation (`check`) three more, which need the composed sheets: a correction is registered
in the paper set and the frames set together, never in one (the frames record of an uncorrected
entity cannot be corrected); no VIEWPORT, table or dictionary is ever registered; and every Rev B
view keeps its pinned window, while each one no correction touched still centres on it exactly —
the proof the pins are the windows the unmodified composers drew, kept for as long as it can hold.

The issued files are read by git blob id from the object store, never from the corpus on disk (the
corpus is what this judges, B-23), and from the raw tag stream: ezdxf's loader mints records as it
reads (SEQENDs), so an entity-database walk is not evidence of what a file holds. A missing blob is
a failure, never a skip.

    uv run --project cad --group fixtures python -m fixtures.gen.rcc6_bnbc.validate.revision [--out DIR]

writes the paper set, the frames set and the twin (about 3 s, against a minute for the whole
corpus), runs this check over them and prints its report.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: validate/revision.py -> the checkout.
ROOT = Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class Issued:
    """One file as Rev B issued it."""

    name: str  # its name in the corpus
    blob: str  # its git blob id at the issue
    seed: str  # its $HANDSEED at the issue: every later record's handle is at or above it
    register: str  # the `revc.CORRECTED` key it answers to


REV_B: dict[str, Issued] = {
    "paper": Issued("rcc6-bnbc.dxf", "b7e37fa739ad3d0d534ab66ffe030a6c178868f1", "22A8", "paper"),
    "frames": Issued("rcc6-bnbc.model.dxf", "828bf6e73d1c6f2673ce33b183a9a863b0365bce", "21F3", "frames"),
    "twin": Issued("rcc6-bnbc.libredwg-r2000.dxf", "0abc7958f0aab151f06ace73551ea95ace224d81", "246A",
                   "paper"),
}

#: `fixtures/rcc6-bnbc/traps.json` as Rev B issued it.
REV_B_TRAPS = "d5505eae6ad7e20ea977e75ed938c918dfde1bc6"

#: Tags that link a record rather than say what it is: its own handle (5, or 105 on a DIMSTYLE),
#: its owner (330) and its extension dictionary (360). An appended record may add to them.
LINK_CODES = frozenset({"5", "105", "330", "360"})

#: Records that hold other records. Appending a layer, a block, a layout or an object grows one.
CONTAINERS = frozenset({"TABLE", "DICTIONARY", "ACDBDICTIONARYWDFLT"})

#: A table head's entry counts, which may only rise.
TABLE_COUNTS = frozenset({"70", "71"})

#: What names a correction in the register (K1, D-EGL, GC-2 ...).
CORRECTION_ID = re.compile(r"^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*$")

#: Never corrected: a window is pinned (W-19a); a container only grows.
NEVER_CORRECTED = frozenset({"VIEWPORT"}) | CONTAINERS

Tags = tuple[tuple[str, str], ...]


class RevisionError(AssertionError):
    """The regenerated set broke R0's register; the message names every handle it broke it on."""


# ---------------------------------------------------------------------------------------------
# The raw tag stream
# ---------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Record:
    kind: str  # the record's type (its `0` tag): LINE, TABLE, LAYER, VIEWPORT, DICTIONARY ...
    label: str | None  # the layer an entity is on (8), else the name a table or entry carries (2)
    body: Tags  # every tag but the links


@dataclass(frozen=True)
class Drawing:
    header: dict[str, Tags]
    classes: tuple[Tags, ...]
    records: dict[str, Record]

    @property
    def seed(self) -> str:
        return self.header["$HANDSEED"][0][1].strip()


def read(data: bytes) -> Drawing:
    """One DXF's header variables, CLASSES and handled records, from its raw tag stream."""
    lines = data.decode("utf-8", errors="surrogateescape").splitlines()
    if len(lines) % 2:
        raise RevisionError(f"the tag stream has an odd number of lines ({len(lines)}): it is not in rhythm")
    header: dict[str, Tags] = {}
    classes: list[Tags] = []
    records: dict[str, Record] = {}
    section: str | None = None
    kind: str | None = None
    tags: list[tuple[str, str]] = []

    def close() -> None:
        nonlocal section
        if kind is None:
            return
        if kind == "SECTION":
            section = tags[0][1].strip() if tags and tags[0][0] == "2" else None
            if section == "HEADER":
                name = None
                values: dict[str, list[tuple[str, str]]] = {}
                for code, value in tags[1:]:
                    if code == "9":
                        name = value.strip()
                        values[name] = []
                    elif name is not None:
                        values[name].append((code, value))
                header.update({name: tuple(v) for name, v in values.items()})
            return
        if kind == "ENDSEC":
            section = None
            return
        if kind == "CLASS" and section == "CLASSES":
            classes.append(tuple(tags))
            return
        handle = next((value.strip() for code, value in tags if code in ("5", "105")), None)
        if handle is None:
            return
        if handle in records:
            raise RevisionError(f"two records carry handle {handle} ({records[handle].kind}, {kind})")
        label = next((v for c, v in tags if c == "8"), None)
        if label is None:
            label = next((v for c, v in tags if c == "2"), None)
        records[handle] = Record(kind, label, tuple((c, v) for c, v in tags if c not in LINK_CODES))

    for index in range(0, len(lines), 2):
        code, value = lines[index].strip(), lines[index + 1]
        if code == "0":
            close()
            kind, tags = value.strip(), []
        else:
            tags.append((code, value))
    close()
    if "$HANDSEED" not in header:
        raise RevisionError("the file has no $HANDSEED: it is not a handled DXF")
    return Drawing(header, tuple(classes), records)


def read_twin(data: bytes) -> Drawing:
    """The R2000 twin's tag stream is slipped on purpose (W-07); it is read as the resync repairs
    it — the stream the product reads — which drops exactly the injected lines."""
    from vextrus_cad.resync import resync_tag_stream

    resync = resync_tag_stream(data)
    if resync.repaired is None:
        raise RevisionError("the twin's tag stream never came back into rhythm")
    return read(resync.repaired)


def _reader(role: str) -> Any:
    return read_twin if role == "twin" else read


def git_blob(blob: str, what: str) -> bytes:
    """A file as issued, from the object store by its blob id."""
    run = subprocess.run(["git", "cat-file", "blob", blob], cwd=ROOT, capture_output=True, check=False)
    if run.returncode != 0:
        raise RevisionError(
            f"{what} as Rev B issued it (blob {blob}) is not in this clone's object store — R0's "
            f"register cannot be checked without it: {run.stderr.decode(errors='replace').strip()}"
        )
    return run.stdout


def issued(role: str) -> Drawing:
    rev_b = REV_B[role]
    return _reader(role)(git_blob(rev_b.blob, rev_b.name))


def issued_traps() -> dict[str, str | None]:
    traps = json.loads(git_blob(REV_B_TRAPS, "traps.json"))["traps"]
    return {trap["id"]: trap["handle"] for trap in traps}


# ---------------------------------------------------------------------------------------------
# One file against its issue
# ---------------------------------------------------------------------------------------------


def _hex(handle: str) -> int:
    return int(handle, 16)


def _subsequence(short: list[tuple[str, str]], long: list[tuple[str, str]]) -> bool:
    it = iter(long)
    return all(tag in it for tag in short)


def _grew(before: Record, after: Record) -> bool:
    """A container that only gained entries: every tag Rev B wrote is still there, in order, and a
    table head's entry counts only rose."""
    if before.kind != after.kind:
        return False
    if before.kind == "TABLE":
        counts_b = [(c, int(v)) for c, v in before.body if c in TABLE_COUNTS]
        counts_a = [(c, int(v)) for c, v in after.body if c in TABLE_COUNTS]
        if [c for c, _ in counts_b] != [c for c, _ in counts_a]:
            return False
        if any(a < b for (_, b), (_, a) in zip(counts_b, counts_a, strict=True)):
            return False
        rest_b = [t for t in before.body if t[0] not in TABLE_COUNTS]
        rest_a = [t for t in after.body if t[0] not in TABLE_COUNTS]
        return _subsequence(rest_b, rest_a)
    return _subsequence(list(before.body), list(after.body))


def register_law(role: str, rev_b: Drawing, register: dict[str, str]) -> None:
    """The register names Rev B records of this file, each with the correction that moves it, and
    never a VIEWPORT (the windows are pinned) or a container (it only grows)."""
    bad = []
    for handle, correction in sorted(register.items(), key=lambda kv: _hex(kv[0])):
        record = rev_b.records.get(handle)
        if record is None:
            bad.append(f"{handle}: Rev B issued no record under it")
        elif record.kind in NEVER_CORRECTED:
            bad.append(f"{handle}: a {record.kind} is never corrected (W-19a)")
        if not isinstance(correction, str) or not CORRECTION_ID.match(correction):
            bad.append(f"{handle}: {correction!r} does not name a correction")
    if bad:
        raise RevisionError(f"check 9 (revision): {role}'s register is unlawful: {bad[:12]}")


def compare(
    role: str, rev_b: Drawing, now: Drawing, register: dict[str, str], *, exact: bool = True
) -> dict[str, Any]:
    """One file against its issue (1-3 above). `exact`: the changed set IS the register; otherwise
    it lies within it (a committed corpus a later step has not re-minted yet)."""
    register_law(role, rev_b, register)
    problems: list[str] = []
    moved = sorted(
        name for name in rev_b.header.keys() | now.header.keys()
        if name != "$HANDSEED" and rev_b.header.get(name) != now.header.get(name)
    )
    if moved:
        problems.append(f"header variables other than $HANDSEED moved: {moved[:8]}")
    seed = _hex(rev_b.seed)
    if _hex(now.seed) < seed:
        problems.append(f"$HANDSEED fell from {rev_b.seed} to {now.seed}")
    if now.classes[: len(rev_b.classes)] != rev_b.classes:
        problems.append("the CLASSES Rev B registered are no longer the first, in order")

    lost = sorted((h for h in rev_b.records if h not in now.records), key=_hex)
    retyped, changed, grown = [], [], []
    for handle in sorted(rev_b.records.keys() & now.records.keys(), key=_hex):
        before, after = rev_b.records[handle], now.records[handle]
        if (before.kind, before.label) != (after.kind, after.label):
            retyped.append(f"{handle} {before.kind}/{before.label} -> {after.kind}/{after.label}")
        elif before.body == after.body:
            continue
        elif before.kind in CONTAINERS and _grew(before, after):
            grown.append(handle)
        else:
            changed.append(handle)
    added = sorted((h for h in now.records if h not in rev_b.records), key=_hex)
    below = [h for h in added if _hex(h) < seed]
    unregistered = [f"{h} {rev_b.records[h].kind}/{rev_b.records[h].label}"
                    for h in changed if h not in register]
    unmoved = sorted((h for h in register if h not in changed), key=_hex) if exact else []

    if lost:
        problems.append(f"Rev B records lost: {len(lost)} — {lost[:12]}")
    if retyped:
        problems.append(f"Rev B records whose type or layer moved: {len(retyped)} — {retyped[:12]}")
    if unregistered:
        problems.append(
            f"Rev B records rewritten but not registered: {len(unregistered)} — {unregistered[:12]}"
        )
    if unmoved:
        problems.append(f"registered records that did not change: {len(unmoved)} — {unmoved[:12]}")
    if below:
        problems.append(f"records added under handles below Rev B's seed {rev_b.seed}: {below[:12]}")
    if problems:
        raise RevisionError(f"check 9 (revision): {REV_B[role].name}: " + "; ".join(problems))
    return {
        "issued": len(rev_b.records),
        "records": len(now.records),
        "corrected": len(changed),
        "grown": len(grown),
        "added": len(added),
        "seed": [rev_b.seed, now.seed],
    }


def compare_traps(rev_b: dict[str, str | None], traps_doc: dict[str, Any]) -> str:
    """Every trap Rev B registered is still registered, under the handle Rev B gave it."""
    now = {trap["id"]: trap.get("handle") for trap in traps_doc["traps"]}
    missing = sorted(set(rev_b) - set(now))
    moved = sorted(tid for tid in rev_b.keys() & now.keys() if rev_b[tid] != now[tid])
    if missing or moved:
        raise RevisionError(
            f"check 9 (revision): traps no longer registered {missing}; traps whose handle moved "
            f"{[(tid, rev_b[tid], now[tid]) for tid in moved]}"
        )
    return f"{len(rev_b)}/{len(rev_b)}"


def check_files(folder: Path, traps_doc: dict[str, Any], *, exact: bool = True) -> dict[str, Any]:
    """1-4 over three written files and a trap registry: a corpus or a scratch generation."""
    from ..emit.sheets import revc

    report: dict[str, Any] = {}
    for role, rev_b in REV_B.items():
        now = _reader(role)((Path(folder) / rev_b.name).read_bytes())
        report[role] = compare(role, issued(role), now, revc.CORRECTED[rev_b.register], exact=exact)
    report["traps"] = compare_traps(issued_traps(), traps_doc)
    return report


# ---------------------------------------------------------------------------------------------
# Over a generation: the composed sheets and the handles the writers gave them
# ---------------------------------------------------------------------------------------------


def _corresponding(sheets: list[Any], paper_of: dict[int, str], frames_of: dict[int, str],
                   register: dict[str, dict[str, str]]) -> dict[str, int]:
    """An authored item is corrected in both sets or in neither: its paper record and its frames
    record move together, and nothing else's frames record moves."""
    split, items, corrected = [], 0, 0
    for sheet in sheets:
        for scene in [sheet.paper, *[view.scene for view in sheet.views]]:
            for item in scene.items:
                paper, frames = paper_of.get(id(item)), frames_of.get(id(item))
                if paper is None or frames is None:
                    split.append(f"{sheet.number} {item['kind']}: never written "
                                 f"(paper {paper}, frames {frames})")
                    continue
                items += 1
                in_paper, in_frames = paper in register["paper"], frames in register["frames"]
                corrected += in_paper
                if in_paper != in_frames:
                    where = ("in" if in_paper else "not in", "in" if in_frames else "not in")
                    split.append(f"{sheet.number} {item['kind']}: paper {paper} {where[0]} the register, "
                                 f"frames {frames} {where[1]}")
    if split:
        raise RevisionError(f"check 9 (revision): corrections registered in one set only: {split[:12]}")
    return {"items": items, "corrected": corrected}


def _pins(sheets: list[Any], paper_of: dict[int, str], register: dict[str, str]) -> dict[str, int]:
    """Every Rev B view on its pinned window, every pin used; each view no correction touched —
    nothing appended to its scene, none of its records registered — centred on its pin exactly."""
    from ..emit.sheets.common import REVB_WINDOWS, centred_origin

    bad, seen, untouched = [], set(), 0
    for sheet in sheets:
        if sheet.new_in is not None:
            continue
        issued_views = [view for view in sheet.views if view.rev is None]
        for index, view in enumerate(issued_views):
            key = f"{sheet.number}#{index}"
            seen.add(key)
            pin = REVB_WINDOWS.get(key)
            if pin is None or pin[0] != view.title or tuple(view.world_origin) != pin[1]:
                bad.append(f"{key} {view.title!r} is not framed on its pin {pin}")
                continue
            touched = any(item.get("rev") is not None or paper_of.get(id(item)) in register
                          for item in view.scene.items)
            if touched:
                continue
            untouched += 1
            if centred_origin(view.scene, view.scale, view.paper_size) != pin[1]:
                bad.append(f"{key} {view.title!r}: untouched, yet no longer centred on its pin")
    unused = sorted(set(REVB_WINDOWS) - seen)
    if unused:
        bad.append(f"pins no Rev B view uses: {unused}")
    if bad:
        raise RevisionError(f"check 9 (revision): the Rev B windows: {bad[:12]}")
    return {"pinned": len(seen), "untouched": untouched}


def check(sheets: list[Any], written: dict[str, bytes], traps_doc: dict[str, Any]) -> dict[str, Any]:
    """Check 9 over a generation: `written` holds the three files' bytes, `traps_doc` the registry
    the generation filled, and the writers' handle maps are the last full writing of `sheets`."""
    from ..emit import dxf as _dxf
    from ..emit.sheets import revc

    report: dict[str, Any] = {}
    for role, rev_b in REV_B.items():
        now = _reader(role)(written[rev_b.name])
        report[role] = compare(role, issued(role), now, revc.CORRECTED[rev_b.register], exact=True)
    report["traps"] = compare_traps(issued_traps(), traps_doc)
    report["items"] = _corresponding(sheets, _dxf.LAST_HANDLES, _dxf.MODEL_HANDLES, revc.CORRECTED)
    report["windows"] = _pins(sheets, _dxf.LAST_HANDLES, revc.CORRECTED["paper"])
    return report


def generate(out: Path) -> tuple[list[Any], dict[str, bytes], dict[str, Any]]:
    """The paper set, the frames set and the twin, written into `out` exactly as the generator
    writes them, with the trap registry resolved (and not written back)."""
    import copy

    from .. import model as M
    from ..emit import dxf as _dxf
    from ..emit import images as _images
    from ..emit import sheets as _sheets

    out = Path(out)
    sheets = _sheets.compose(M.build())
    blocks = _sheets.blocks()
    images = _images.author()
    paper, _ = _dxf.write_paper(sheets, blocks, images, out)
    frames, _ = _dxf.write_model_frames(sheets, blocks, images, out)
    twin, _ = _dxf.write_malformed(paper, out)
    traps_path = Path(__file__).resolve().parents[1] / "traps.json"
    registry = copy.deepcopy(json.loads(traps_path.read_text(encoding="utf-8")))
    traps_doc = _dxf.resolve_trap_handles(registry, sheets)
    written = {path.name: path.read_bytes() for path in (paper, frames, twin)}
    return sheets, written, traps_doc


if __name__ == "__main__":
    import argparse
    import sys
    import tempfile

    ap = argparse.ArgumentParser(
        description="R0's register check over a fresh paper set, frames set and twin"
    )
    ap.add_argument("--out", help="where to write the three files (default: a temporary directory)")
    args = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix="rcc6-bnbc-revision-") as tmp:
        target = Path(args.out) if args.out else Path(tmp)
        target.mkdir(parents=True, exist_ok=True)
        try:
            composed, files, registry = generate(target)
            result = check(composed, files, registry)
        except RevisionError as error:
            print(str(error), file=sys.stderr)
            raise SystemExit(1) from error
    print(json.dumps(result, indent=2))
