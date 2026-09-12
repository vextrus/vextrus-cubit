"""A stray line that IS an integer must not be taken as a group code (L-CAD-04, L-CAD-09).

The resync only ever fired when a NON-code line stood where a code belongs. A stray line that is an
integer inside the code range — a converter's stray flag, a `0`, a `62`, an `8` — stood exactly where
a code stands, was taken AS one, ate the next real code as its value, and the drop that followed
deleted an innocent VALUE line instead. The count came out right and the repair was wrong: a bogus
layer tag minted, a section marker deleted, and a report naming the wrong line and the wrong cause.

The pairing is what settles it now: a code is a code when the pair it heads is a pair the code admits
and a pair follows it. Pure: no file is opened here, no clock is read.
"""
from vextrus_cad.resync import resync_tag_stream

GOOD = b"".join(
    line + b"\n" for line in [
        b"0", b"SECTION", b"2", b"ENTITIES",
        b"0", b"LINE", b"5", b"2F", b"8", b"WALLS",
        b"10", b"0.0", b"20", b"0.0", b"11", b"1000.0", b"21", b"0.0",
        b"0", b"ENDSEC", b"0", b"EOF",
    ]
)

def test_stray_integer_line_is_named_not_swallowed():
    lines = GOOD.splitlines(keepends=True)
    # one stray line where a VALUE stands — an integer, as a converter's stray flag is
    twin = b"".join([*lines[:2], b"8\n", *lines[2:]])
    out = resync_tag_stream(twin)
    # the truthful repair is: drop the stray line, get GOOD back, report 1
    assert out.repaired == GOOD, (out.dropped, out.line, out.repaired.decode())


def test_a_whole_shifted_run_is_not_silent():
    # a stray integer before a run whose values are themselves integers: the rhythm "resumes"
    # one group code off and the resync reports nothing at all
    stray = b"".join(one + b"\n" for one in [
        b"0", b"SECTION", b"2", b"ENTITIES", b"5",
        b"70", b"62", b"7", b"0", b"1", b"0", b"0", b"EOF",
    ])
    out = resync_tag_stream(stray)
    assert out.dropped > 0, "a one-line-off stream came back repaired_in_place with nothing said"


def test_the_report_names_the_line_it_dropped_and_why():
    """The count was never the whole answer: the LINE and its text are what a person acts on."""
    lines = GOOD.splitlines(keepends=True)
    twin = b"".join([*lines[:2], b"8\n", *lines[2:]])
    out = resync_tag_stream(twin)
    assert out.dropped == 1
    assert out.line == 3, "the stray stands on line 3; the innocent value line it used to blame is line 5"
    assert out.text == "8", "the refusal carries the thing it choked on, not a position"
    assert out.repaired == GOOD


def test_a_stream_already_in_rhythm_is_left_alone():
    """The strictness must not repair a file that has nothing wrong with it."""
    out = resync_tag_stream(GOOD)
    assert out.repaired_in_place
    assert out.dropped == 0
    assert out.line == 0


def test_a_code_whose_value_its_own_shape_forbids_is_no_code():
    """A float code followed by a word is not a pairing any DXF makes (the `admits` table)."""
    stream = b"".join(
        line + b"\n" for line in [
            b"0", b"SECTION", b"2", b"ENTITIES",
            b"0", b"LINE", b"10", b"WALLS", b"20", b"0.0",
            b"0", b"ENDSEC", b"0", b"EOF",
        ]
    )
    out = resync_tag_stream(stream)
    assert out.dropped > 0, "code 10 takes a number; `WALLS` is not one, so the rhythm had slipped"
