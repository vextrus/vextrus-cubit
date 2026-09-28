"""The decoder cross-check (ticket 10; ADR 0029): does a second, independent decoder read the same file?

`run(path, artefact)` is the stage the harness calls (the M0 plan, the contracts): LibreDWG's reading
is the artefact (engine.read), ACadSharp's is `engine.read.acadsharp.dump(path)`, and the result is a
Check result: `passed` when the two agree, `fired` with the file's finding when they do not. A fired
result **holds** the file (m0-screens 4.5's "Held" row, with its Question). When the second reader
cannot run or does not finish (not installed, not the pinned build, stopped by an error or a limit,
no readable output, too large) the stage raises its `ReadError`: the file was read once, which is
never agreement, and it **fails** (4.5's "Failed" row, the owner's ruling of 28 Sep 2026), never held.
engine/messages/decoders_agree.py lists which finding is which.

**The rule** (the plan's): the two agree when they hold **the same set of handles**, **the same
number of entities of each type** and **the same number of entities on each layer**. The finding
counts what differed (`engine/messages/decoders_agree.py`): the handles only the first reader found,
those only the second found, the types counted differently and the layers counted differently.
Never drawing text. The rule compares counts, not each entity: two entities whose layers (or types)
are swapped leave every count as it was, and agree (a test says so). A per-entity rule is stricter;
it is not the plan's, and no evidence yet asks for it. The check catches a decoder's mistakes, not a
file built to fool it: a file that takes over the dumper can write any dump, an agreeing one too; the
sandbox keeps it from doing more than that.

**Where the two differ by design**, each with its evidence from a synthetic fixture
(engine/fixtures/dwg/), and each a test (engine/check/tests/test_decoders_agree.py):

1. **A multiple insert (MINSERT) is an INSERT to ACadSharp.** LibreDWG, and so the artefact, types
   it `MINSERT`; ACadSharp reads it into its `Insert` class, whose type is `INSERT` whatever its rows
   and columns. Evidence: the `entity_kinds` fixture's 2-by-3 insert, typed `MINSERT` in the artefact
   and `INSERT` in the dump, with the same handle and layer (28 Sep 2026, LibreDWG 0.14, ACadSharp
   3.8.0). So both sides' types are compared through `SAME_TYPE`, which counts a MINSERT as an
   INSERT; the handle is still compared, so a lost multiple insert is still a disagreement.
2. **A polyline's vertices and its SEQEND, and a block's BLOCK and ENDBLK, are in neither.** The
   artefact holds none of them (engine/read/libredwg/dwgread.py folds them into their polyline and
   block), and the dumper does not write them (ACadSharp holds vertices inside their polyline and the
   markers inside their block record). Evidence: `entity_kinds`' 2D and 3D polylines, polyface mesh
   and polygon mesh: 4 POLYLINEs in both, no VERTEX in either. Nothing is mapped for this; the dumper
   simply writes what the artefact holds.

Nothing else is mapped. The fixtures agree with no other rule on every kind they draw (lines, circles,
arcs, ellipses, splines, rays, construction lines, points, lightweight and old-style polylines, polyface
and polygon meshes, the eight dimension kinds, LEADER, MULTILEADER, 3DFACE, SOLID, WIPEOUT, MLINE,
TOLERANCE, IMAGE, PDFUNDERLAY, MESH, TEXT, MTEXT, ATTDEF, ATTRIB, INSERT and a paper-space VIEWPORT):
`entity_kinds` saved as AC1024, AC1027 and AC1032, the others as AC1032. Saved as AC1015 (and, in one
run on 28 Sep 2026, AC1018), ACadSharp cannot read back what its own writer put in for kinds the version
predates: the `second_reader_fails` fixture, a failure and never agreement.

**Not evidenced, so not mapped:** tables, proxy entities and classes neither decoder knows (ACadSharp
keeps them under their class name; what LibreDWG names them is unmeasured), 3D solids and regions (the
fixture writer drops them), and any AC1021 file (the writer cannot write that version). A real file
holding one of them may disagree on its type; the owner's real-drawing check shows it, and a rule is
added only with a fixture that proves it.

**A disagreement already known on real files:** ACadSharp 3.8.0 "drops one INSERT with a Z scale of 0"
on one of the seven real files measured in session 01 (docs/research/dwg-reader-evidence.md, conclusion
4). Under this rule that file is held (an INSERT only the first reader found): a flaw in the second
reader, not in this check. It is not mapped: an INSERT with a Z scale of 0 drawn by a synthetic fixture
did not reproduce it at AC1018, AC1027 or AC1032 (the review of #79, 28 Sep 2026), and no rule is
written without a fixture that shows it.

Handles are compared as integers: the artefact's (hexadecimal strings, from the reader's own output)
are converted here, the dump's were converted as it was read (engine/read/acadsharp/dump.py). Every
step is a set or a counter, so the comparison is linear in the entities.
"""

from collections import Counter
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path

from engine.messages import decoders_agree as codes
from engine.read import acadsharp
from engine.read.acadsharp import Dump
from engine.read.artefact import ReadArtefact
from engine.recognise.types import CheckOutcome, CheckResult

CODE = "decoders_agree"
VERSION = 1
MILESTONE = "M0"

SAME_TYPE: Mapping[str, str] = {"MINSERT": "INSERT"}
"""A type one decoder names differently, to the name both are compared under (rule 1 above)."""


@dataclass(frozen=True)
class Difference:
    """What the two readings differ by, in counts."""

    only_first: int  # handles in the artefact (LibreDWG) and not in the dump (ACadSharp)
    only_second: int  # handles in the dump and not in the artefact
    kinds: int  # types whose counts differ
    layers: int  # layers whose counts differ

    @property
    def agree(self) -> bool:
        return not (self.only_first or self.only_second or self.kinds or self.layers)


def run(
    path: Path, artefact: ReadArtefact, *, second: Callable[[Path], Dump] = acadsharp.dump
) -> CheckResult:
    """Read `path` with the second decoder and compare it with `artefact`, the first's reading.
    Raises the second decoder's `ReadError` when it could not read the file."""
    difference = compare(artefact, second(Path(path)))
    if difference.agree:
        return CheckResult(code=CODE, outcome=CheckOutcome.PASSED)
    finding = codes.DISAGREE(
        items=difference.only_first + difference.only_second,
        only_first=difference.only_first,
        only_second=difference.only_second,
        kinds=difference.kinds,
        layers=difference.layers,
    )
    return CheckResult(code=CODE, outcome=CheckOutcome.FIRED, finding=finding)


def compare(artefact: ReadArtefact, second: Dump) -> Difference:
    """The rule: equal handle sets, equal counts per type (through `SAME_TYPE`) and per layer."""
    first = frozenset(int(handle, 16) for handle in artefact.entities)
    return Difference(
        only_first=len(first - second.handles),
        only_second=len(second.handles - first),
        kinds=_differing(_same_types(artefact.summary.entity_counts), _same_types(second.types)),
        layers=_differing(artefact.summary.layer_counts, second.layers),
    )


def _same_types(counts: Mapping[str, int]) -> Counter[str]:
    merged: Counter[str] = Counter()
    for kind, count in counts.items():
        merged[SAME_TYPE.get(kind, kind)] += count
    return merged


def _differing(a: Mapping[str, int], b: Mapping[str, int]) -> int:
    return sum(1 for key in a.keys() | b.keys() if a.get(key, 0) != b.get(key, 0))
