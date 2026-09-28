"""The decoder cross-check: agree only on equal handles and counts; anything else holds the file.

The rule and its one exception (MINSERT) run everywhere, on artefacts and dumps made here; a stubbed
second decoder that disagrees is the planted disagreement, run directly and through the harness. The
real pair (LibreDWG and the dumper built from the tree) on the synthetic fixtures needs the toolchain:
    uv run --no-sync pytest -m "needs_toolchain or needs_bwrap" engine/check
"""

import textwrap
import time
from collections import Counter
from collections.abc import Callable, Iterable
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest

from engine import export, harness
from engine.check import decoders_agree
from engine.check.decoders_agree import CODE, MILESTONE, VERSION, compare, run
from engine.harness import STAGES
from engine.read import ReadError, acadsharp
from engine.read import read as read_dwg
from engine.read.acadsharp import Dump, DumperNotInstalled
from engine.read.acadsharp.tests.conftest import dumper_prefix, dwg_fixture  # noqa: F401
from engine.read.artefact import Entity, Format, ReadArtefact
from engine.recognise.types import CheckOutcome

Fixture = Callable[..., Path]
Item = tuple[str, str, str]  # handle, type, layer

DRAWING: list[Item] = [
    ("8D", "LINE", "0"),
    ("8E", "LINE", "WALLS"),
    ("8F", "LWPOLYLINE", "WALLS"),
    ("90", "INSERT", "TITLE"),
    ("91", "ATTRIB", "0"),
]


def artefact(items: Iterable[Item]) -> ReadArtefact:
    return ReadArtefact.build(
        source_sha256="0" * 64,
        source_name="KR-STR-R0.dwg",
        format=Format("dwg", "AC1032"),
        reader="libredwg",
        reader_version="0.14",
        layouts=("Model",),
        insunits=4,
        notes=(),
        blocks=(),
        entities=[Entity(h, kind, layer, "1F") for h, kind, layer in items],
    )


def dump(items: Iterable[Item]) -> Dump:
    listed = list(items)
    return Dump(
        acadsharp="3.8.0",
        dwg_version="AC1032",
        handles=frozenset(int(h, 16) for h, _, _ in listed),
        types=dict(Counter(kind for _, kind, _ in listed)),
        layers=dict(Counter(layer for _, _, layer in listed)),
    )


def second(items: Iterable[Item]) -> Callable[[Path], Dump]:
    reading = dump(items)
    return lambda path: reading


def test_the_check_declares_its_code_version_and_milestone() -> None:
    assert (CODE, VERSION, MILESTONE) == ("decoders_agree", 1, "M0")


def test_two_readers_that_read_the_same_agree() -> None:
    result = run(Path("KR-STR-R0.dwg"), artefact(DRAWING), second=second(DRAWING))

    assert (result.code, result.outcome, result.finding) == ("decoders_agree", CheckOutcome.PASSED, None)


def test_a_planted_disagreement_holds_the_file_with_counts_of_what_differed() -> None:
    lost_one = [item for item in DRAWING if item[0] != "8F"]

    result = run(Path("KR-STR-R0.dwg"), artefact(DRAWING), second=second(lost_one))

    assert result.outcome == CheckOutcome.FIRED
    assert result.finding == {
        "code": "engine.decoders_agree.disagree",
        "params": {"only_first": 1, "only_second": 0, "kinds": 1, "layers": 1},
    }


def test_the_finding_carries_no_drawing_text() -> None:
    other = [("8D", "LINE", "SECRET-LAYER-NAME"), ("A0", "MTEXT", "0")]

    result = run(Path("KR-STR-R0.dwg"), artefact(DRAWING), second=second(other))

    assert result.finding is not None
    assert all(isinstance(value, int) for value in result.finding["params"].values())
    assert "SECRET" not in repr(result.finding)


@pytest.mark.parametrize(
    ("theirs", "expected"),
    [
        pytest.param([*DRAWING, ("A0", "LINE", "0")], (0, 1, 1, 1), id="a-handle-only-the-second-found"),
        pytest.param(
            [*DRAWING[:-1], ("A0", "ATTRIB", "0")], (1, 1, 0, 0), id="same-counts-other-handles"
        ),
        pytest.param(
            [("8D", "LINE", "WALLS"), ("8E", "LINE", "0"), *DRAWING[2:]],
            (0, 0, 0, 0),
            id="swapped-layers-keep-the-counts-so-agree",
        ),
        pytest.param(
            [("8D", "LINE", "WALLS"), *DRAWING[1:]], (0, 0, 0, 2), id="an-entity-on-another-layer"
        ),
        pytest.param([("8D", "ARC", "0"), *DRAWING[1:]], (0, 0, 2, 0), id="an-entity-of-another-type"),
        pytest.param([], (5, 0, 4, 3), id="the-second-found-nothing"),
    ],
)
def test_the_rule_is_equal_handle_sets_and_equal_counts_per_type_and_per_layer(
    theirs: list[Item], expected: tuple[int, int, int, int]
) -> None:
    difference = compare(artefact(DRAWING), dump(theirs))

    found = (difference.only_first, difference.only_second, difference.kinds, difference.layers)
    assert found == expected
    assert difference.agree == (expected == (0, 0, 0, 0))


def test_a_multiple_insert_is_an_insert_to_the_second_reader() -> None:
    # Rule 1 of the module: LibreDWG types it MINSERT, ACadSharp INSERT (the entity_kinds fixture).
    ours = [*DRAWING, ("A0", "MINSERT", "OTHER")]
    theirs = [*DRAWING, ("A0", "INSERT", "OTHER")]

    assert compare(artefact(ours), dump(theirs)).agree


def test_a_lost_multiple_insert_still_disagrees() -> None:
    ours = [*DRAWING, ("A0", "MINSERT", "OTHER")]

    difference = compare(artefact(ours), dump(DRAWING))

    assert (difference.only_first, difference.kinds, difference.layers) == (1, 1, 1)


def test_the_mapping_is_only_what_the_module_evidences() -> None:
    assert decoders_agree.SAME_TYPE == {"MINSERT": "INSERT"}


@pytest.mark.parametrize(
    "error",
    [
        DumperNotInstalled(),
        acadsharp.DumperNotPinned(),
        acadsharp.DumpTooLarge(10),
        ReadError(
            {
                "code": "engine.read.reader_failed",
                "params": {"program": "acadsharp-dump", "exit_code": 1},
            }
        ),
    ],
    ids=["not-installed", "not-pinned", "too-large", "crashed"],
)
def test_a_second_reader_that_cannot_read_is_a_failure_never_a_result(error: ReadError) -> None:
    def failing(path: Path) -> Dump:
        raise error

    with pytest.raises(type(error)):
        run(Path("KR-STR-R0.dwg"), artefact(DRAWING), second=failing)


def test_handles_built_to_collide_do_not_make_the_comparison_quadratic() -> None:
    size = 300_000
    plain = [(f"{n:X}", "LINE", "0") for n in range(1, size + 1)]
    colliding = [(f"{n << 40:X}", "LINE", "0") for n in range(1, size + 1)]

    started = time.perf_counter()
    compare(artefact(plain), dump(plain))
    baseline = time.perf_counter() - started
    started = time.perf_counter()
    difference = compare(artefact(colliding), dump(colliding))
    seconds = time.perf_counter() - started

    assert difference.agree
    assert seconds < 5 * baseline + 1


# -- through the harness: the export says agree, disagree or nothing ---------------------------------

READ = """
    from engine.read.artefact import Entity, Format, ReadArtefact

    def read(path):
        items = [line.split() for line in path.read_text().splitlines()]
        return ReadArtefact.build(
            source_sha256="0" * 64, source_name=path.name, format=Format("dwg", "AC1032"),
            reader="libredwg", reader_version="0.14", layouts=("Model",), insunits=4, notes=(),
            blocks=(), entities=[Entity(h, t, layer, "1F") for h, t, layer in items],
        )
"""

SECOND = """
    from collections import Counter
    from engine.check import decoders_agree
    from engine.read.acadsharp import Dump, DumperNotInstalled

    def run(path, artefact):
        items = [line.split() for line in path.read_text().splitlines()]
        if not items:
            raise DumperNotInstalled()
        planted = [i for i in items if i[0] != "8F"] if "planted" in path.name else items
        reading = Dump(
            "3.8.0", "AC1032", frozenset(int(h, 16) for h, _, _ in planted),
            dict(Counter(t for _, t, _ in planted)), dict(Counter(layer for _, _, layer in planted)),
        )
        return decoders_agree.run(path, artefact, second=lambda p: reading)
"""


def harness_run(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, files: dict[str, str], **targets: str
) -> dict[str, dict[str, Any]]:
    code = tmp_path / "code"
    code.mkdir()
    for name, source in targets.items():
        (code / f"stage_{name}.py").write_text(textwrap.dedent(source))
    monkeypatch.syspath_prepend(str(code))
    stages = tuple(
        replace(s, target=f"stage_{s.name}:{s.target.split(':')[1]}") if s.name in targets else s
        for s in STAGES
    )
    drawings = tmp_path / "set"
    drawings.mkdir()
    for name, text in files.items():
        (drawings / name).write_text(text)
    document: Any = harness.run(drawings, tmp_path / "out" / "export.json", stages=stages)
    assert export.validate(document, export.load_schema()) == []
    return {f["path"]: f for f in document["files"]}


def test_through_the_harness_a_planted_disagreement_reads_as_disagree_and_agreement_as_agree(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    text = "\n".join(" ".join(item) for item in DRAWING) + "\n"

    files = harness_run(
        tmp_path,
        monkeypatch,
        {"agrees.dwg": text, "planted.dwg": text},
        read=READ,
        decoders_agree=SECOND,
    )

    assert files["agrees.dwg"]["decoders_agree"] is True
    assert files["planted.dwg"]["decoders_agree"] is False
    assert files["planted.dwg"]["stages"]["decoders_agree"]["state"] == "ok"


def test_through_the_harness_a_second_reader_that_cannot_run_fails_the_stage_and_says_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    files = harness_run(tmp_path, monkeypatch, {"empty.dwg": ""}, read=READ, decoders_agree=SECOND)

    stage = files["empty.dwg"]["stages"]["decoders_agree"]
    assert files["empty.dwg"]["decoders_agree"] is None
    assert stage["state"] == "failed"
    assert stage["error"].startswith("DumperNotInstalled")


# -- the real pair: LibreDWG and the dumper built from the tree --------------------------------------


@pytest.fixture
def real_dumper(dumper_prefix: Path, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(dumper_prefix))
    monkeypatch.delenv("VEXTRUS_SANDBOX", raising=False)


@pytest.mark.needs_toolchain
@pytest.mark.usefixtures("real_dumper")
@pytest.mark.parametrize(
    ("name", "version"),
    [
        ("entity_kinds", "AC1032"),
        ("entity_kinds", "AC1027"),
        ("entity_kinds", "AC1024"),
        ("title_block", "AC1032"),
        ("text_kinds", "AC1032"),
        ("sheet_layout", "AC1032"),
    ],
)
def test_the_two_readers_agree_on_every_fixture(
    dwg_fixture: Fixture,  # noqa: F811
    name: str,
    version: str,
) -> None:
    path = dwg_fixture(name, version=version)

    result = run(path, read_dwg(path))

    assert result.outcome == CheckOutcome.PASSED, result.finding


@pytest.mark.needs_toolchain
@pytest.mark.usefixtures("real_dumper")
def test_the_multiple_insert_rule_is_what_the_two_readers_do(dwg_fixture: Fixture) -> None:  # noqa: F811
    # The evidence for rule 1: one handle, typed MINSERT by LibreDWG and INSERT by ACadSharp.
    path = dwg_fixture("entity_kinds")
    first = read_dwg(path)
    minserts = [h for h, entity in first.entities.items() if entity.type == "MINSERT"]
    reading = acadsharp.dump(path)

    assert len(minserts) == 1
    assert int(minserts[0], 16) in reading.handles
    assert "MINSERT" not in reading.types
    assert reading.types["INSERT"] == first.summary.entity_counts["INSERT"] + 1
    assert not compare(first, reading).kinds


@pytest.mark.needs_toolchain
@pytest.mark.usefixtures("real_dumper")
def test_neither_reader_lists_a_polylines_vertices(dwg_fixture: Fixture) -> None:  # noqa: F811
    # The evidence for rule 2: four old-style polylines (2D, 3D, polyface and polygon mesh).
    path = dwg_fixture("entity_kinds")

    assert read_dwg(path).summary.entity_counts["POLYLINE"] == 4
    reading = acadsharp.dump(path)
    assert reading.types["POLYLINE"] == 4
    assert not {"VERTEX", "SEQEND", "BLOCK", "ENDBLK"} & set(reading.types)


@pytest.mark.needs_toolchain
@pytest.mark.usefixtures("real_dumper")
def test_a_file_only_the_first_reader_reads_is_a_failure_never_agreement(
    dwg_fixture: Fixture,  # noqa: F811
) -> None:
    path = dwg_fixture("second_reader_fails")
    first = read_dwg(path)

    assert first.summary.entity_counts == {"LINE": 1, "MULTILEADER": 1}
    with pytest.raises(ReadError) as raised:
        run(path, first)
    assert raised.value.message["code"] == "engine.read.reader_failed"


@pytest.mark.needs_toolchain
@pytest.mark.usefixtures("real_dumper")
def test_the_harness_runs_the_real_stage_and_its_export_is_valid(
    dwg_fixture: Fixture,  # noqa: F811
    tmp_path: Path,
) -> None:
    drawings = tmp_path / "set"
    drawings.mkdir()
    for name in ("entity_kinds", "title_block", "second_reader_fails"):
        (drawings / f"{name}.dwg").write_bytes(dwg_fixture(name).read_bytes())
    garbage = drawings / "garbage.dwg"
    garbage.write_bytes(b"AC1032" + bytes(range(256)) * 64)

    document: Any = harness.run(drawings, tmp_path / "out" / "export.json")

    assert export.validate(document, export.load_schema()) == []
    files = {f["path"]: f for f in document["files"]}
    assert files["entity_kinds.dwg"]["decoders_agree"] is True
    assert files["title_block.dwg"]["decoders_agree"] is True
    only_first = files["second_reader_fails.dwg"]
    assert only_first["decoders_agree"] is None
    assert only_first["stages"]["decoders_agree"]["state"] == "failed"
    both_fail = files["garbage.dwg"]
    assert both_fail["decoders_agree"] is None
    assert both_fail["stages"]["read"]["state"] == "failed"
    assert both_fail["stages"]["decoders_agree"]["state"] == "skipped"


@pytest.mark.needs_toolchain
def test_the_harness_without_the_dumper_installed_fails_the_stage_visibly(
    dwg_fixture: Fixture,  # noqa: F811
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("VEXTRUS_ACADSHARP_DUMP", str(tmp_path / "not-installed"))
    drawings = tmp_path / "set"
    drawings.mkdir()
    (drawings / "title_block.dwg").write_bytes(dwg_fixture("title_block").read_bytes())

    document: Any = harness.run(drawings, tmp_path / "out" / "export.json")

    reading = document["files"][0]
    assert reading["decoders_agree"] is None
    assert reading["stages"]["decoders_agree"]["state"] == "failed"
    assert reading["stages"]["decoders_agree"]["error"].startswith("DumperNotInstalled")
