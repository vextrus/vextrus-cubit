"""Ticket T-LEAK-PDF (#302): the leak scan reads PDF text drawn glyph by glyph.

A PDF draws text with show operators (`Tj`, `TJ`, `'`, `"`) over literal strings `( ... )` (escapes,
octal) and hex strings `< ... >`, often one glyph at a time or as a kerned array. The scan must
reassemble that text and find a corpus string in it, refuse (exit 2, `cannot scan
(source-unreadable)`) a stream it cannot read whole rather than pass it, and never crash or print
what it assembled. Every PDF is built here from invented text; no binary fixture, no real drawing.
Two doors: `range` (the PDF committed as `art.pdf`) and `file`.
"""

import subprocess
import zlib
from pathlib import Path

import pytest

from ._leak import (
    MARIGOLD,
    WORDS,
    ZEBRA,
    Leak,
    assert_no_text,
    git,
    hits,
    summary,
    temp_repo,
)

DOORS = ["range", "file"]
REFUSAL = "leakscan: cannot scan (source-unreadable)"
CRASH = "internal error"


@pytest.fixture
def leak(tmp_path: Path) -> Leak:
    built = Leak(tmp_path)
    built.build()
    return built


# ---------------------------------------------------------------- building PDFs


def _pdfs(contents: list[bytes], *, deflate: bool = True) -> bytes:
    """A PDF holding one stream object per content, inflatable by zlib or raw."""
    out = [b"%PDF-1.4\n"]
    for number, content in enumerate(contents, start=1):
        body = zlib.compress(content) if deflate else content
        flate = b" /Filter /FlateDecode" if deflate else b""
        out.append(b"%d 0 obj\n<< /Length %d%s >>\nstream\n" % (number, len(body), flate))
        out.append(body)
        out.append(b"\nendstream\nendobj\n")
    out.append(b"trailer\n<< /Size %d >>\n%%%%EOF\n" % (len(contents) + 1))
    return b"".join(out)


def _pdf(content: bytes, *, deflate: bool = True) -> bytes:
    return _pdfs([content], deflate=deflate)


def _lit(text: str) -> bytes:
    """A PDF literal string showing `text` (escaping the three characters that need it)."""
    raw = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return b"(" + raw.encode("latin-1") + b")"


def _hex(text: str) -> bytes:
    return b"<" + text.encode("latin-1").hex().upper().encode() + b">"


def _octal(char: str) -> bytes:
    return b"\\%03o" % ord(char)


def _per_glyph(text: str) -> bytes:
    return b"BT /F1 10 Tf " + b" ".join(_lit(c) + b" Tj" for c in text) + b" ET"


def _shapes(text: str) -> dict[str, bytes]:
    """Six ways a producer draws `text` (at least 12 characters, at least two spaces)."""
    first, second = text[:5], text[5:]
    words = text.split(" ")
    half = len(words) // 2
    top, bottom = " ".join(words[:half]), " ".join(words[half:])
    cut = text.index(" ", 6) + 3  # inside the third word: a backslash-newline continues the string
    escaped = (
        b"BT /F1 10 Tf (\\(see\\) a \\\\ b) Tj ("
        + _octal(text[0])
        + text[1:cut].encode()
        + b"\\\n"
        + text[cut:].encode()
        + b") Tj ET"
    )
    return {
        "per-glyph": _per_glyph(text),
        "kerned-array": b"BT /F1 10 Tf ["
        + _lit(text[:8])
        + b"-20"
        + _lit(text[8:17])
        + b" -5 "
        + _lit(text[17:])
        + b"] TJ ET",
        "hex": b"BT /F1 10 Tf " + _hex(text) + b" Tj ET",
        "two-lines": b"BT /F1 10 Tf " + _lit(top) + b" Tj 0 -12 Td " + _lit(bottom) + b" Tj ET",
        "octal-escapes": escaped,
        "glyph-per-block": b"\n".join(
            b"BT /F1 10 Tf %d 0 Td " % (i * 6) + _lit(c) + b" Tj ET" for i, c in enumerate(first)
        )
        + b"\nBT "
        + _lit(second)
        + b" Tj ET",
    }


SHAPES = list(_shapes(ZEBRA))


# ---------------------------------------------------------------- the two doors


def _commit_bytes(repo: Path, name: str, data: bytes) -> None:
    (repo / name).write_bytes(data)
    git(repo, "add", "--", name)
    git(repo, "commit", "-q", "-m", "art: one drawing")


def _scan(leak: Leak, door: str, data: bytes, tag: str = "x") -> subprocess.CompletedProcess[str]:
    """Scans `data` through a door: committed as `art.pdf` in a fresh repository, or as a file."""
    if door == "range":
        repo, base = temp_repo(leak.tmp / f"work-{tag}")
        _commit_bytes(repo, "art.pdf", data)
        done = leak.run("range", f"{base}..HEAD", "--no-stamp", cwd=repo)
    else:
        path = leak.tmp / f"art-{tag}.pdf"
        path.write_bytes(data)
        done = leak.run("file", str(path))
    assert_no_text(done)
    return done


def _where(door: str) -> str:
    return "art.pdf" if door == "range" else "file:"


def _assert_found(done: subprocess.CompletedProcess[str], door: str) -> None:
    assert done.returncode == 1, f"exit {done.returncode}, not 1 (the literal passed unscanned)"
    found = hits(done)
    assert any(where.startswith(_where(door)) for where, _ in found), [w for w, _ in found]
    assert CRASH not in done.stderr


def _assert_refused(leak: Leak, done: subprocess.CompletedProcess[str]) -> None:
    assert done.returncode == 2, f"exit {done.returncode}, not 2 (the PDF was not refused)"
    assert REFUSAL in done.stderr
    assert CRASH not in done.stderr
    assert leak.stamps() == []


# ---------------------------------------------------------------- 1: a literal drawn in pieces


@pytest.mark.parametrize("door", DOORS)
@pytest.mark.parametrize("deflate", [True, False], ids=["inflated", "raw"])
@pytest.mark.parametrize("shape", SHAPES)
def test_a_literal_drawn_in_pieces_is_found(leak: Leak, shape: str, deflate: bool, door: str) -> None:
    done = _scan(leak, door, _pdf(_shapes(ZEBRA)[shape], deflate=deflate))
    _assert_found(done, door)


# ---------------------------------------------------------------- 2: no false hit


def _clean_texts() -> list[str]:
    near = "Zebra Quarry Holdings Pvt 7781"  # one glyph changed
    halves = "Zebra Quarry Hol Lantern dings Pvt 7731"  # half on each side of a different word
    return ["Lantern Weavers Guild 2290 East", near, halves]


@pytest.mark.parametrize("door", DOORS)
@pytest.mark.parametrize("deflate", [True, False], ids=["inflated", "raw"])
def test_the_same_pdf_without_a_corpus_literal_is_clean(leak: Leak, deflate: bool, door: str) -> None:
    for i, text in enumerate(_clean_texts()):
        for shape, content in _shapes(text).items():
            done = _scan(leak, door, _pdf(content, deflate=deflate), tag=f"{i}-{shape}")
            assert done.returncode == 0, f"text {i}, {shape}: exit {done.returncode}"
            assert summary(done)[1] == "0", f"text {i}, {shape}: a false hit"


# ---------------------------------------------------------------- 3: two literals, both counted


@pytest.mark.parametrize("door", DOORS)
def test_two_literals_in_one_pdf_are_both_counted(leak: Leak, door: str) -> None:
    content = _shapes(ZEBRA)["kerned-array"] + b"\n" + _shapes(MARIGOLD)["hex"]
    done = _scan(leak, door, _pdf(content))
    _assert_found(done, door)
    assert int(summary(done)[1]) >= 2


# ---------------------------------------------------------------- 4: a PDF without a NUL byte


@pytest.mark.parametrize("door", ["file", "stdin"])
def test_a_pdf_without_a_nul_byte_is_still_read_as_a_pdf(leak: Leak, door: str) -> None:
    data = _pdf(_per_glyph(ZEBRA), deflate=False)
    assert b"\0" not in data
    assert data.isascii()
    if door == "file":
        path = leak.tmp / "plain.pdf"
        path.write_bytes(data)
        done = leak.run("file", str(path))
    else:
        done = leak.run("text", "--stdin", stdin=data.decode("ascii"))
    assert_no_text(done)
    assert done.returncode == 1, f"exit {done.returncode}, not 1"
    assert hits(done)
    assert CRASH not in done.stderr


# ---------------------------------------------------------------- 5: a huge TJ array


@pytest.mark.parametrize("door", DOORS)
def test_a_huge_tj_array_is_scanned_not_skipped(leak: Leak, door: str) -> None:
    filler = b"(x)-1" * (200_000 - len(ZEBRA))
    glyphs = b"".join(_lit(c) + b"-1" for c in ZEBRA)
    content = b"BT /F1 10 Tf [" + filler + glyphs + b"] TJ ET"
    done = _scan(leak, door, _pdf(content))
    _assert_found(done, door)


# ---------------------------------------------------------------- 6: deep and unbalanced parentheses


@pytest.mark.parametrize("door", DOORS)
@pytest.mark.parametrize("closed", [True, False], ids=["balanced", "unclosed"])
def test_deep_and_unbalanced_parentheses_do_not_crash(leak: Leak, closed: bool, door: str) -> None:
    depth = 100_000
    tail = b")" * depth + b") Tj ET" if closed else b""
    content = b"BT /F1 10 Tf (" + b"(" * depth + ZEBRA.encode() + tail
    done = _scan(leak, door, _pdf(content))
    _assert_found(done, door)


# ---------------------------------------------------------------- 7: bad hex


@pytest.mark.parametrize("door", DOORS)
def test_bad_hex_never_crashes_and_never_hides_a_literal(leak: Leak, door: str) -> None:
    pairs = b" ".join(b"%02X" % byte for byte in ZEBRA.encode())
    noisy = b"BT /F1 10 Tf <ZZ " + pairs + b" G> Tj ET"
    _assert_found(_scan(leak, door, _pdf(noisy), tag="noisy"), door)
    for tag, content in (
        ("odd", b"BT /F1 10 Tf <5A6> Tj ET"),
        ("unterminated", b"BT /F1 10 Tf <5A65"),
    ):
        done = _scan(leak, door, _pdf(content), tag=tag)
        assert done.returncode in (0, 1), f"{tag}: exit {done.returncode}"
        assert CRASH not in done.stderr, f"{tag}: the scan crashed"


# ---------------------------------------------------------------- 8: an inflate bomb


@pytest.mark.parametrize("door", DOORS)
def test_an_inflate_bomb_is_refused_not_passed(leak: Leak, door: str) -> None:
    bomb = _pdf(bytes(65 * 1024 * 1024))
    assert len(bomb) < 256 * 1024
    _assert_refused(leak, _scan(leak, door, bomb))


# ---------------------------------------------------------------- 9: more streams than the scan reads


@pytest.mark.parametrize("door", DOORS)
@pytest.mark.parametrize("streams", [20_001, 20_000])
def test_a_pdf_with_more_streams_than_the_scan_reads_is_refused(
    leak: Leak, streams: int, door: str
) -> None:
    contents = [b"BT ET"] * (streams - 1) + [_per_glyph(ZEBRA)]
    done = _scan(leak, door, _pdfs(contents))
    if streams > 20_000:
        _assert_refused(leak, done)
    else:
        _assert_found(done, door)


# ---------------------------------------------------------------- 10: nothing assembled is printed


def _spellings(word: str) -> list[str]:
    """A corpus word as hex (both cases) and as PDF octal escapes."""
    raw = word.encode()
    octal = "".join(f"\\{byte:03o}" for byte in raw)
    return [raw.hex().upper(), raw.hex(), octal, octal.replace("\\", "")]


@pytest.mark.parametrize("door", DOORS)
def test_a_pdf_scan_never_prints_what_it_assembled(leak: Leak, door: str) -> None:
    shapes = _shapes(ZEBRA)
    content = shapes["hex"] + b"\n" + shapes["octal-escapes"] + b"\n" + shapes["per-glyph"]
    done = _scan(leak, door, _pdf(content))
    _assert_found(done, door)
    for stream in (done.stdout, done.stderr):
        for word in WORDS:
            for spelling in _spellings(word) + _spellings(word.title()):
                assert spelling not in stream, f"the output spells a corpus word ({word[0]}...)"
