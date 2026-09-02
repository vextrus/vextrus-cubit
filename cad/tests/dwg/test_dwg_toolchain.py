"""The `Toolchain` seam: an exit code that is not a signal, a budget that ends, silence (L-CAD-04).

The two laws graded here cannot be provoked with the machine's own LibreDWG — no lawful drawing
makes `dwg2dxf` hang, and none makes it exit 0 having written nothing — so both are driven against
programs written for the purpose and named through `Toolchain`, which exists for exactly that.

The programs here are deliberately worse-behaved than the real ones: they chatter on both streams,
write where they were not asked, start helpers that outlive them, and exit with codes that have
nothing to do with what they did. `cad/` answers its caller in the artifact it writes, so the last
assertion of each arm is the one that is easy to forget — that the invocation said nothing at all
on the streams that belong to whoever spawned this process (L-CAD-01).
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import pytest

from vextrus_cad.dwg import DEFAULT_TOOLCHAIN, DwgError, Toolchain, convert_dwg

FIXTURE_DIR = Path(__file__).resolve().parent / "fixtures"
SOURCE = FIXTURE_DIR / "basic.dwg"

#: A budget small enough that a hung pass is graded in seconds, large enough that a busy machine
#: starting a program is not mistaken for one.
SMALL_BUDGET = 3.0

_ANNOUNCES = "this is a program, and it is talking"

#: Replays a prepared payload where a program of its kind may write — at the name it was given,
#: beside the drawing it read, or on its own stdout — chatters on both streams, and exits with a
#: code that says nothing about any of it. LibreDWG's own programs use all three conventions, so a
#: pass is judged by what it wrote and not by whether it agreed about where (L-CAD-04).
_REPLAYS = '''#!{python}
import sys
from pathlib import Path

PAYLOAD = {payload!r}
SUFFIX = {suffix!r}
CODE = {code!r}
WHERE = {where!r}

argv = sys.argv[1:]
if "--version" in argv:
    sys.stdout.write(Path(sys.argv[0]).name + " 41.42.43\\n")
    sys.exit(0)

targets = []
for index, argument in enumerate(argv):
    if argument == "-o" and index + 1 < len(argv) and WHERE in ("anywhere", "asked"):
        targets.append(Path(argv[index + 1]))
    if argument.lower().endswith(".dwg") and WHERE in ("anywhere", "beside"):
        targets.append(Path(argument).with_suffix(SUFFIX))
        targets.append(Path.cwd() / (Path(argument).stem + SUFFIX))

body = Path(PAYLOAD).read_bytes() if PAYLOAD else b""
for target in targets:
    if body:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(body)
if WHERE == "announced":
    sys.stdout.buffer.write({announces!r} + b"\\n" + body)
elif WHERE == "stdout":
    sys.stdout.buffer.write(body)
else:
    sys.stdout.buffer.write(body + {announces!r})
sys.stderr.buffer.write({announces!r})
sys.exit(CODE)
'''

#: Outlives its budget, and leaves a helper behind that outlives it in turn — the helper holds the
#: streams it was given open and would go on writing into the invocation's scratch.
_OUTLIVES = """#!/bin/sh
echo "starting"
sleep 600 &
sleep 600
echo "woke up, and the caller is long gone"
"""


def _program(path: Path, text: str) -> str:
    path.write_text(text, encoding="utf-8")
    path.chmod(0o755)
    return str(path)


def _replaying(
    path: Path,
    *,
    payload: Path | None,
    suffix: str,
    code: int,
    where: str = "anywhere",
) -> str:
    return _program(
        path,
        _REPLAYS.format(
            python=sys.executable,
            payload=str(payload) if payload else "",
            suffix=suffix,
            code=code,
            where=where,
            announces=_ANNOUNCES.encode(),
        ),
    )


@pytest.fixture(scope="module")
def replayable(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path, Path]:
    """A drawing, a real census of it and a real conversion of it, to be replayed by a stub.

    Replaying real work is what makes a stubbed success a real one: the tallies the lane reconciles
    are the ones the machine's own LibreDWG produced, not an agreement between the lane and a test.
    """
    room = tmp_path_factory.mktemp("replayable")
    source = room / SOURCE.name
    shutil.copyfile(SOURCE, source)
    census = room / "census.json"
    subprocess.run(
        [DEFAULT_TOOLCHAIN.dwgread, "-O", "JSON", "-o", str(census), str(source)],
        capture_output=True,
        check=False,
        timeout=300,
    )
    converted = convert_dwg(source, room / "golden")
    return source, census, converted.dxf_path


def _empty(directory: Path) -> bool:
    return not any(directory.iterdir())


def _budgeted(programs: tuple[str, str], seconds: float = SMALL_BUDGET) -> Toolchain:
    return Toolchain(programs[0], programs[1], seconds)


def test_a_pass_that_exits_nonzero_but_did_the_work_converted_the_drawing(
    replayable: tuple[Path, Path, Path],
    tmp_path: Path,
) -> None:
    source, census, dxf = replayable
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(
        source,
        out_dir,
        toolchain=Toolchain(
            _replaying(bin_dir / "dwgread", payload=census, suffix=".json", code=3),
            _replaying(bin_dir / "dwg2dxf", payload=dxf, suffix=".dxf", code=9),
            DEFAULT_TOOLCHAIN.timeout_seconds,
        ),
    )

    assert result.dxf_path.is_file()
    assert result.census and result.geometry
    assert tuple(result.refused) == (), f"complete work, replayed, reconciles: {result.refused}"
    assert result.tool_version == "dwgread 41.42.43"


@pytest.mark.parametrize(
    ("census_where", "dxf_where"),
    [("beside", "beside"), ("stdout", "beside"), ("announced", "beside"), ("asked", "stdout")],
)
def test_work_written_where_the_pass_chose_is_still_the_passs_work(
    replayable: tuple[Path, Path, Path],
    tmp_path: Path,
    census_where: str,
    dxf_where: str,
) -> None:
    """A program that wrote its answer somewhere else still wrote it (L-CAD-04).

    Neither pass is asked what it did, only what it left, so the conventions LibreDWG's own
    programs have are the ones both passes are read under: a reader prints its answer when it is
    given no name for one — after a greeting, if it has one — and either program may write beside
    the drawing it read. The stubs here do one of those and nothing at the name they were given.
    """
    source, census, dxf = replayable
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    result = convert_dwg(
        source,
        out_dir,
        toolchain=Toolchain(
            _replaying(bin_dir / "dwgread", payload=census, suffix=".json", code=0, where=census_where),
            _replaying(bin_dir / "dwg2dxf", payload=dxf, suffix=".dxf", code=0, where=dxf_where),
            DEFAULT_TOOLCHAIN.timeout_seconds,
        ),
    )

    where = f"census {census_where}, DXF {dxf_where}"
    assert result.dxf_path.is_file(), f"work written where the pass chose ({where}) is still its work"
    assert result.census and result.geometry
    assert tuple(result.refused) == (), f"complete work, replayed, reconciles: {result.refused}"


def test_every_refusal_names_the_drawing_the_pass_and_the_program(
    replayable: tuple[Path, Path, Path],
    tmp_path: Path,
) -> None:
    """Four facts in every refusal: which drawing, said in full, which half, which program.

    A `Toolchain` may name one program for both passes, and the program named for a pass may be
    called anything at all, so neither of them alone tells a caller which half of the conversion
    ended the drawing (L-CAD-04's loud failures).
    """
    source, census, _dxf = replayable
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    budget = DEFAULT_TOOLCHAIN.timeout_seconds
    silent_read = _replaying(bin_dir / "quiet-read", payload=None, suffix=".json", code=0)
    silent_convert = _replaying(bin_dir / "quiet-convert", payload=None, suffix=".dxf", code=0)
    reads = _replaying(bin_dir / "reads", payload=census, suffix=".json", code=0)
    absent = str(bin_dir / "not-a-program-at-all")
    arms = [
        ("census", silent_read, Toolchain(silent_read, silent_convert, budget)),
        ("census", absent, Toolchain(absent, silent_convert, budget)),
        ("geometry", silent_convert, Toolchain(reads, silent_convert, budget)),
        ("geometry", absent, Toolchain(reads, absent, budget)),
    ]

    for index, (half, program, toolchain) in enumerate(arms):
        out_dir = tmp_path / f"out-{index}"
        out_dir.mkdir()

        with pytest.raises(DwgError) as raised:
            convert_dwg(source, out_dir, toolchain=toolchain)

        message = str(raised.value)
        assert source.name in message, f"the refusal does not name the drawing: {message}"
        assert str(source) in message, f"the refusal does not say which drawing: {message}"
        assert half in message, f"the refusal does not say which half of the conversion: {message}"
        assert program in message, f"the refusal does not name the program that ran: {message}"
        assert _empty(out_dir), "a refused conversion left something behind"


@pytest.mark.parametrize(
    ("census_payload", "dxf_payload", "why"),
    [
        (None, "dxf", "a census pass that wrote nothing"),
        ("garbage", "dxf", "a census no parser admits"),
        ("census", None, "a conversion that wrote no DXF"),
        ("census", "garbage", "a DXF no reader admits"),
    ],
)
def test_a_pass_that_exits_zero_having_done_nothing_refuses_the_drawing(
    replayable: tuple[Path, Path, Path],
    tmp_path: Path,
    census_payload: str | None,
    dxf_payload: str | None,
    why: str,
) -> None:
    source, census, dxf = replayable
    garbage = tmp_path / "garbage"
    # A real conversion, cut short. A reader meets this far more often than it meets noise, and it
    # is the shape that ends a read by raising something no reader documents — which is a fact
    # about the file, not a fault of this process's own (L-CAD-04's loud, named refusals).
    # A real conversion cut short mid-pair: a DXF is a group code and then its value, so a file
    # ending on a code is one a reader runs off the end of. It is the likeliest shape a half-written
    # conversion has, and the one whose reader ends the read by raising something no reader
    # documents — a fact about the file, which L-CAD-04 answers by refusing the sheet by name.
    garbage.write_bytes(b"\n".join(dxf.read_bytes().split(b"\n")[:41]) + b"\n")
    bodies = {"census": census, "dxf": dxf, "garbage": garbage, None: None}
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    with pytest.raises(DwgError) as raised:
        convert_dwg(
            source,
            out_dir,
            toolchain=Toolchain(
                _replaying(bin_dir / "dwgread", payload=bodies[census_payload], suffix=".json", code=0),
                _replaying(bin_dir / "dwg2dxf", payload=bodies[dxf_payload], suffix=".dxf", code=0),
                DEFAULT_TOOLCHAIN.timeout_seconds,
            ),
        )

    assert source.name in str(raised.value), f"{why}: the refusal does not name the drawing"
    assert _empty(out_dir), f"{why}: a refused conversion left something behind"


@pytest.mark.parametrize("hung", ["dwgread", "dwg2dxf"])
def test_a_pass_that_outruns_its_budget_ends_the_invocation_within_it(tmp_path: Path, hung: str) -> None:
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()
    scratch_root = tmp_path / "tmproot"
    scratch_root.mkdir()
    programs = {
        "dwgread": DEFAULT_TOOLCHAIN.dwgread,
        "dwg2dxf": DEFAULT_TOOLCHAIN.dwg2dxf,
        hung: _program(bin_dir / hung, _OUTLIVES),
    }
    named = {"dwgread": "census", "dwg2dxf": "geometry"}[hung]

    started = time.monotonic()
    with pytest.raises(DwgError) as raised:
        convert_dwg(
            SOURCE,
            out_dir,
            toolchain=Toolchain(programs["dwgread"], programs["dwg2dxf"], SMALL_BUDGET),
        )
    spent = time.monotonic() - started

    message = str(raised.value)
    assert SOURCE.name in message, f"the refusal does not name the drawing: {message}"
    assert named in message, f"the refusal does not name the pass that ran out: {message}"
    assert str(SMALL_BUDGET) in message, f"the refusal does not spell the budget as given: {message}"
    # Within the budget, not just after it: the signal, the reap and the sweep are the invocation's.
    assert spent < SMALL_BUDGET, f"the invocation outran its own budget: {spent:.3f}s"
    assert _empty(out_dir), "a refused conversion left something behind"


def test_the_invocation_says_nothing_on_the_streams_that_are_not_its_own(
    replayable: tuple[Path, Path, Path],
    tmp_path: Path,
) -> None:
    """Every arm above, run again in a process of its own, judged on what it printed.

    A caller reads `cad/`'s answer off its streams, so a byte the lane did not mean to write is a
    fault whichever program wrote it: a stub's chatter, a reader's log record, a helper waking up
    after the refusal (L-CAD-01, L-CAD-04).
    """
    source, census, dxf = replayable
    program = tmp_path / "drive.py"
    program.write_text(
        "\n".join(
            [
                "import json, sys, tempfile",
                "from pathlib import Path",
                "from vextrus_cad.dwg import DEFAULT_TOOLCHAIN, DwgError, Toolchain, convert_dwg",
                f"source = Path({str(source)!r})",
                f"hung = Path({_program(tmp_path / 'hung', _OUTLIVES)!r})",
                f"replays = Path({_replaying(tmp_path / 'replays', payload=dxf, suffix='.dxf', code=9)!r})",
                f"reads = Path({_replaying(tmp_path / 'reads', payload=census, suffix='.json', code=9)!r})",
                "report = {}",
                "room = Path(tempfile.mkdtemp())",
                "scratch_root = room / 'tmp'",
                "scratch_root.mkdir()",
                "tempfile.tempdir = str(scratch_root)",
                "out = room / 'out'",
                "out.mkdir()",
                "result = convert_dwg(source, out, toolchain=Toolchain(str(reads), str(replays),"
                " DEFAULT_TOOLCHAIN.timeout_seconds))",
                "report['converted'] = result.dxf_path.name",
                "report['refused'] = [entry.message() for entry in result.refused]",
                "for name, chain in (",
                "    ('hung', Toolchain(str(hung), str(hung), 3.0)),",
                "    ('silent', Toolchain(str(hung.parent / 'nothing-here'), str(replays), 3.0)),",
                "):",
                "    refusal = room / name",
                "    refusal.mkdir()",
                "    try:",
                "        convert_dwg(source, refusal, toolchain=chain)",
                "    except DwgError as error:",
                "        report[name] = str(error)",
                "    report[name + '-left-behind'] = sorted(path.name for path in refusal.iterdir())",
                "    report[name + '-scratch'] = sorted(path.name for path in scratch_root.iterdir())",
                "sys.stdout.write('REPORT ' + json.dumps(report) + chr(10))",
            ]
        ),
        encoding="utf-8",
    )

    run = subprocess.run(
        [sys.executable, str(program)],
        capture_output=True,
        text=True,
        check=False,
        timeout=600,
    )

    assert run.stderr == "", f"the lane wrote to a stream that is not its own: {run.stderr!r}"
    marker, _, report = run.stdout.partition("REPORT ")
    assert marker == "", f"the lane wrote to a stream that is not its own: {marker!r}"
    assert report.endswith("\n"), f"something spoke after the answer: {report!r}"
    answered = json.loads(report)
    assert answered["converted"] == f"{source.stem}.dxf"
    assert answered["refused"] == []
    assert "census" in answered["hung"] and source.name in answered["hung"]
    assert "nothing-here" in answered["silent"] and source.name in answered["silent"]
    for name in ("hung", "silent"):
        assert answered[f"{name}-left-behind"] == [], f"{name}: a refused conversion left an artifact"
        assert answered[f"{name}-scratch"] == [], f"{name}: the invocation's scratch outlived the call"
