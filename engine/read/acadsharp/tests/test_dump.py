"""The dump is read strictly and within bounds: it is data from a hostile file (dump.py)."""

import io
import json
import time
from collections.abc import Sequence

import pytest

from engine.read.acadsharp.dump import DumpTooLarge, parse

HEADER = {"dumper": "acadsharp-dump", "format": 1, "acadsharp": "3.8.0", "dwg_version": "AC1032"}


def lines(*values: object) -> bytes:
    return b"".join(json.dumps(value).encode() + b"\n" for value in values)


def dump_of(*entities: Sequence[object], header: object = HEADER, end: object = None) -> bytes:
    return lines(header, *entities, {"end": len(entities)} if end is None else end)


def test_it_keeps_the_handles_and_counts_per_type_and_per_layer() -> None:
    read = parse(
        io.BytesIO(dump_of(["8D", "LINE", "0"], ["8E", "LINE", "WALLS"], ["1A2B", "INSERT", "WALLS"]))
    )

    assert (read.acadsharp, read.dwg_version) == ("3.8.0", "AC1032")
    assert read.handles == frozenset({0x8D, 0x8E, 0x1A2B})
    assert read.types == {"LINE": 2, "INSERT": 1}
    assert read.layers == {"0": 1, "WALLS": 2}


def test_an_empty_drawing_is_a_dump_of_nothing() -> None:
    read = parse(io.BytesIO(dump_of()))

    assert (read.handles, read.types, read.layers) == (frozenset(), {}, {})


def test_a_layer_name_is_kept_as_text_whatever_it_holds() -> None:
    read = parse(io.BytesIO(dump_of(["1", "LINE", 'ভবন "A"\t/../etc'])))

    assert read.layers == {'ভবন "A"\t/../etc': 1}


@pytest.mark.parametrize(
    "text",
    [
        pytest.param(b"", id="empty"),
        pytest.param(lines(HEADER), id="no-end-line"),
        pytest.param(lines(HEADER, ["1", "LINE", "0"]), id="cut-off"),
        pytest.param(dump_of(["1", "LINE", "0"])[:-1], id="no-final-line-break"),
        pytest.param(dump_of(end={"end": 2}), id="end-counts-wrong"),
        pytest.param(dump_of(end={"end": True}), id="end-not-a-number"),
        pytest.param(dump_of(end={"end": 0, "more": 1}), id="end-extra-field"),
        pytest.param(dump_of() + b"\n", id="after-the-end"),
        pytest.param(dump_of(header={**HEADER, "format": 2}), id="another-format"),
        pytest.param(dump_of(header={**HEADER, "format": True}), id="format-a-boolean"),
        pytest.param(dump_of(header={**HEADER, "dumper": "other"}), id="another-dumper"),
        pytest.param(dump_of(header={**HEADER, "extra": 1}), id="header-extra-field"),
        pytest.param(dump_of(header={"dumper": "acadsharp-dump"}), id="header-missing-fields"),
        pytest.param(dump_of(header={**HEADER, "acadsharp": "../x"}), id="version-not-a-version"),
        pytest.param(dump_of(header={**HEADER, "dwg_version": "AC1032/.."}), id="dwg-version-odd"),
        pytest.param(dump_of(header=[1, 2]), id="header-not-an-object"),
        pytest.param(
            b'{"dumper": "acadsharp-dump", "dumper": "acadsharp-dump", "format": 1, '
            b'"acadsharp": "3.8.0", "dwg_version": "AC1032"}\n{"end": 0}\n',
            id="a-field-named-twice",
        ),
        pytest.param(dump_of(["1", "LINE"]), id="two-strings"),
        pytest.param(dump_of(["1", "LINE", "0", "x"]), id="four-strings"),
        pytest.param(dump_of(["1", "LINE", 0]), id="a-number-for-a-layer"),
        pytest.param(dump_of(["8d", "LINE", "0"]), id="lower-case-handle"),
        pytest.param(dump_of(["0", "LINE", "0"]), id="handle-zero"),
        pytest.param(dump_of(["-1", "LINE", "0"]), id="negative-handle"),
        pytest.param(dump_of(["1" * 17, "LINE", "0"]), id="handle-over-8-bytes"),
        pytest.param(dump_of([" 1", "LINE", "0"]), id="handle-with-a-space"),
        pytest.param(dump_of(["1", "", "0"]), id="empty-type"),
        pytest.param(dump_of(["1", "T" * 257, "0"]), id="type-too-long"),
        pytest.param(dump_of(["1", "LINE", "L" * 1025]), id="layer-too-long"),
        pytest.param(dump_of(["1", "LINE", "0"], ["1", "ARC", "0"]), id="one-handle-twice"),
        pytest.param(lines(HEADER) + b"[NaN, 1, 2]\n" + lines({"end": 1}), id="nan"),
        pytest.param(lines(HEADER) + b'["1", "LINE", "\xff"]\n' + lines({"end": 1}), id="not-utf8"),
        pytest.param(lines(HEADER) + b"[" * 100_000 + b"\n" + lines({"end": 1}), id="deep-nesting"),
        pytest.param(lines(HEADER) + b"__import__('os')\n" + lines({"end": 1}), id="python-code"),
    ],
)
def test_anything_but_the_exact_format_is_refused(text: bytes) -> None:
    with pytest.raises(ValueError, match=r"."):
        parse(io.BytesIO(text), max_line=200_000)


def test_a_line_longer_than_its_bound_is_refused_without_reading_it_whole() -> None:
    stream = io.BytesIO(lines(HEADER) + b'["1", "LINE", "' + b"x" * 10_000_000 + b'"]\n')

    with pytest.raises(ValueError, match="longer"):
        parse(stream, max_line=1024)

    assert stream.tell() <= len(lines(HEADER)) + 1025


def test_more_entities_than_the_check_reads_is_too_large() -> None:
    entities = [[f"{n:X}", "LINE", "0"] for n in range(1, 12)]

    with pytest.raises(DumpTooLarge) as raised:
        parse(io.BytesIO(dump_of(*entities)), max_entities=10)

    assert raised.value.message == {"code": "engine.decoders_agree.too_many", "params": {"limit": 10}}


def test_more_bytes_than_the_check_reads_is_too_large() -> None:
    entities = [[f"{n:X}", "LINE", "0"] for n in range(1, 100)]

    with pytest.raises(DumpTooLarge):
        parse(io.BytesIO(dump_of(*entities)), max_bytes=1000)


def test_a_dump_at_its_bounds_is_read() -> None:
    entities = [[f"{n:X}", "LINE", "0"] for n in range(1, 11)]
    text = dump_of(*entities)

    assert len(parse(io.BytesIO(text), max_entities=10, max_bytes=len(text)).handles) == 10


def test_handles_built_to_collide_do_not_make_reading_quadratic() -> None:
    # Handles that share their low 40 bits land on one slot of a hash table first; read as integers,
    # their hashes are their values, so they part after a few probes. 200,000 of them read in a
    # time linear in their number (a quadratic reading would take minutes).
    colliding = [[f"{n << 40:X}", "LINE", "0"] for n in range(1, 200_001)]
    plain = [[f"{n:X}", "LINE", "0"] for n in range(1, 200_001)]

    started = time.perf_counter()
    parse(io.BytesIO(dump_of(*plain)))
    baseline = time.perf_counter() - started
    started = time.perf_counter()
    read = parse(io.BytesIO(dump_of(*colliding)))
    colliding_seconds = time.perf_counter() - started

    assert len(read.handles) == 200_000
    assert colliding_seconds < 5 * baseline + 1
