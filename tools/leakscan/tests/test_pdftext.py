"""T-LEAK-PDF's assembler (`tools/leakscan/pdftext.py`) and the PDF reading in `scan.py`: the text a
content stream shows, the bounded inflate and the stream cap. Invented text only."""

import time
import zlib

import pytest

from tools.leakscan import scan
from tools.leakscan.core import CannotScan, normalise
from tools.leakscan.pdftext import assemble, decode

TEXT = "Lantern Weavers Guild 2290"


def _shown(stream: bytes, text: str = TEXT) -> bool:
    """`text` is in one of the assembled texts, as the corpus matcher folds them."""
    return any(normalise(text) in normalise(assembled) for assembled in assemble(stream))


def _pdf(*contents: bytes, deflate: bool = True) -> bytes:
    out = [b"%PDF-1.4\n"]
    for content in contents:
        body = zlib.compress(content) if deflate else content
        out.append(b"1 0 obj\n<< /Length %d >>\nstream\n%s\nendstream\nendobj\n" % (len(body), body))
    return b"".join(out)


def _found(data: bytes, text: str = TEXT) -> bool:
    return any(normalise(text) in normalise(t) for t in scan.blob_texts(data))


# ---------------------------------------------------------------- strings


def test_the_escapes_octal_and_continuation_are_read() -> None:
    assert assemble(rb"(a\(b\)c\\d\n\t\101\60\0609) Tj") == ["a(b)c\\d\n\tA009"] * 3
    assert assemble(b"(Lan\\\ntern\\\r\nWea\\\rvers) Tj")[0] == "LanternWeavers"
    assert assemble(rb"(\q\777) Tj")[0] == "q\xff"  # an unknown escape is the character; octal & 0xFF


def test_a_string_split_at_an_escape_is_whole() -> None:
    assert _shown(rb"BT (Lantern\040Weavers Gu\151ld 2290) Tj ET")
    assert _shown(b"BT (Lantern Weav\\\ners Guild 2290) Tj ET")


def test_nesting_is_counted_and_an_unclosed_string_runs_to_the_end() -> None:
    assert assemble(b"((a(b)c)) Tj")[0] == "(a(b)c)"
    assert assemble(b"BT (" + b"(" * 50_000 + TEXT.encode())[0].endswith(TEXT)
    assert assemble(b"BT (\\")[0] == ""


def test_hex_skips_non_digits_pads_an_odd_digit_and_ends_at_the_stream() -> None:
    assert assemble(b"<4C 61zz6E> Tj")[0] == "Lan"
    assert assemble(b"<4C6> Tj")[0] == "L`"
    assert assemble(b"<4C61")[0] == "La"
    assert assemble(b"<<>> <> Tj")[0] == ""


def test_utf16be_hex_and_literals_decode_as_text() -> None:
    assert decode(b"\x00L\x00a") == "La"
    assert decode(b"\xfe\xff\x00L\x00a") == "La"
    assert decode(b"\x00\x00") == "\x00"  # one UTF-16 code unit
    assert decode(b"\xffA") == "\xffA"
    assert _shown(b"BT " + b" ".join(b"<00%02X> Tj" % ord(c) for c in TEXT) + b" ET")


# ---------------------------------------------------------------- operators


def test_every_show_operator_shows_its_string() -> None:
    assert _shown(b"BT (Lantern ) Tj (Weavers ) ' 1 2 (Guild 2290) \" ET")
    assert assemble(b"(a) Tj (b) ' 0 0 (c) \"")[0] == "abc"


def test_a_kerning_number_between_two_halves_of_a_word_is_ignored() -> None:
    for number in (b"-20", b"-199", b"0", b"250", b"-250", b"-1e3"):
        stream = b"[(Lantern Wea)" + number + b"(vers Guild 2290)] TJ"
        assert _shown(stream), number
    tight, spaced, _ = assemble(b"[(Lantern)-250(Weavers)] TJ")
    assert (tight, spaced) == ("LanternWeavers", "Lantern Weavers")


def test_text_moved_by_td_is_read_with_a_space_and_each_block_joined() -> None:
    tight, spaced, measured = assemble(b"BT (Lantern) Tj 0 -12 Td (Weavers) Tj ET")
    assert (tight, spaced, measured) == ("LanternWeavers", " Lantern Weavers ", "Lantern Weavers")
    per_block = b"\n".join(b"BT %d 0 Td (%s) Tj ET" % (i, c.encode()) for i, c in enumerate(TEXT))
    assert _shown(per_block)


def test_malformed_streams_still_show_their_strings() -> None:
    assert _shown(b"(Lantern Weavers ) Tj ET ET (Guild 2290) Tj BT")  # ET without BT, BT without ET
    assert _shown(b"BT [(Lantern Weavers )(Guild 2290) Tj")  # an operator inside an array
    assert _shown(b"BT [[(Lantern Weavers ) [(Guild 2290)]]] TJ ET")  # nested arrays
    assert _shown(b"BT (Lantern Weavers Guild 2290) Tx ET")  # a string no show operator draws
    assert _shown(b"/Span << /ActualText (Lantern Weavers Guild 2290) >> BDC EMC")
    assert _shown(b"BT (Lantern Weavers Guild 2290)")  # no operator before the stream ends
    assert assemble(b"] ) > } { 1 2 3 Tj true null /Name % (x) Tj\n")[0] == ""


def test_an_inline_image_is_skipped_to_its_end() -> None:
    stream = b"BI /W 1 ID \x00(\x01\x02 EI BT (Lantern Weavers Guild 2290) Tj ET"
    assert _shown(stream)
    assert _shown(b"q % a comment (not text)\n BT (Lantern Weavers Guild 2290) Tj ET")


@pytest.mark.parametrize("filler", [b"(", b"[", b"<", b"\\", b"(\\", b"1 ", b"/a", b"<<", b"%"])
def test_large_hostile_streams_are_linear(filler: bytes) -> None:
    stream = filler * (4_000_000 // len(filler))
    started = time.monotonic()
    assemble(stream)
    assert time.monotonic() - started < 30  # a quadratic pass would take hours on this input


# ---------------------------------------------------------------- the PDF in scan.py


def test_raw_and_inflated_streams_are_assembled() -> None:
    glyphs = b"BT " + b" ".join(b"(%s) Tj" % c.encode() for c in TEXT) + b" ET"
    assert _found(_pdf(glyphs))
    assert _found(_pdf(glyphs, deflate=False))
    assert not _found(_pdf(b"BT (Lantern Weavers Guild 2291) Tj ET"))


def test_an_unterminated_last_stream_is_read_to_the_end() -> None:
    assert _found(b"%PDF-1.4\n1 0 obj\n<< >>\nstream\nBT [(Lantern Weavers )-5(Guild 2290)] TJ")


def test_deflated_data_holding_endstream_is_read_on_past_it() -> None:
    content = b"BT " + b" ".join(b"(%s) Tj" % c.encode() for c in TEXT) + b" ET"
    stored = zlib.compressobj(0)  # stored blocks: `endstream` appears as it is in the compressed data
    data = stored.compress(b"x endstream y " + content) + stored.flush()
    assert b"endstream" in data
    assert _found(b"%PDF-1.4\n1 0 obj\n<< >>\nstream\n" + data + b"\nendstream\nendobj\n")


GLYPHS = b"BT " + b" ".join(b"(%s) Tj" % c.encode() for c in TEXT) + b" ET"


def _object(dictionary: bytes, body: bytes) -> bytes:
    return b"1 0 obj\n<< " + dictionary + b" >>\nstream\n" + body + b"\nendstream\nendobj\n"


def test_a_raw_stream_holding_endstream_is_read_to_its_length() -> None:
    body = b"BT (endstream) Tj ET " + GLYPHS
    assert _found(b"%PDF-1.4\n" + _object(b"/Length %d" % len(body), body))
    # a following deflated stream is still found where it starts, and inflated
    after = _object(b"/Filter /FlateDecode", zlib.compress(GLYPHS))
    raw = _object(b"/Length %d" % len(body), b"BT (endstream\n) Tj ET")
    assert _found(b"%PDF-1.4\n" + _object(b"/Length 21", b"BT (endstream\n) Tj ET") + after)
    assert _found(b"%PDF-1.4\n" + raw + after)


def test_a_length_that_does_not_end_at_endstream_is_not_trusted() -> None:
    body = b"BT (endstream) Tj ET " + GLYPHS
    for length in (b"%d 0 R" % len(body), b"%d" % (len(body) + 3), b"999999999"):
        data = b"%PDF-1.4\n" + _object(b"/Length " + length, body)
        # the first `endstream` ends it, as a reader repairing a wrong `/Length` reads it
        assert _found(b"%PDF-1.4\n" + _object(b"/Length 1", GLYPHS))
        assert scan.blob_texts(data)


def test_the_length_pattern_reads_a_whole_number_direct_or_indirect() -> None:
    def length(text: bytes) -> tuple[bytes, bytes | None] | None:
        match = scan._LENGTH.search(text)
        return (match[1], match[2]) if match else None

    assert length(b"/Length 12 0 R") == (b"12", b"0")  # indirect: object 12, generation 0
    assert length(b"/Length 120 >>") == (b"120", None)
    assert length(b"/Length 12 /Foo 3 0 R") == (b"12", None)
    assert length(b"/Length 7>>") == (b"7", None)


def test_deflated_data_holding_endstream_does_not_shift_the_next_stream() -> None:
    stored = zlib.compressobj(0)
    first = stored.compress(b"x endstream\n y") + stored.flush()
    data = b"%PDF-1.4\n" + _object(b"", first) + _object(b"", zlib.compress(GLYPHS))
    assert _found(data)


def test_an_inflate_over_the_limit_refuses(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scan, "MAX_BLOB", 1000)
    with pytest.raises(CannotScan) as refused:
        scan.blob_texts(_pdf(bytes(1001)))
    assert refused.value.reason == "source-unreadable"
    assert scan.blob_texts(_pdf(bytes(1000)))  # exactly the limit is read


def test_the_inflate_budget_is_for_the_whole_pdf(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scan, "MAX_BLOB", 1000)
    scan.blob_texts(_pdf(bytes(600)))
    with pytest.raises(CannotScan):
        scan.blob_texts(_pdf(bytes(600), bytes(600)))


def test_more_streams_than_the_cap_refuses(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(scan, "MAX_STREAMS", 3)
    scan.blob_texts(_pdf(b"BT ET", b"BT ET", b"BT ET"))
    with pytest.raises(CannotScan):
        scan.blob_texts(_pdf(b"BT ET", b"BT ET", b"BT ET", b"BT ET"))


# ---------------------------------------------------------------- the refuter's breaks (round 1)


def test_a_long_run_of_digits_is_linear() -> None:
    started = time.monotonic()
    assemble(b"BT " + b"1" * 400_000 + b"x ET")
    assert time.monotonic() - started < 10  # the old number pattern backtracked quadratically


def _placed(text: str, *, per_block: bool) -> bytes:
    """`text` one glyph at a time at a fixed advance, its spaces drawn as positions, never as glyphs."""
    out = [b"BT "] if not per_block else []
    for i, char in enumerate(text):
        if char == " ":
            continue
        if per_block:
            out.append(b"BT 1 0 0 1 %d 700 Tm (%s) Tj ET\n" % (100 + 6 * i, char.encode()))
        else:
            out.append(b"1 0 0 1 %d 700 Tm (%s) Tj " % (100 + 6 * i, char.encode()))
    return b"".join(out) + (b"" if per_block else b"ET")


def test_glyphs_whose_spaces_are_positions_are_found() -> None:
    assert _shown(_placed(TEXT, per_block=False))
    assert _shown(_placed(TEXT, per_block=True))
    relative = b"BT 100 700 Td " + b" ".join(
        b"(%s) Tj %d 0 Td" % (c.encode(), 12 if after == " " else 6)
        for c, after in zip(TEXT, TEXT[1:] + "x", strict=True)
        if c != " "
    )
    assert _shown(relative + b" ET")
    assert not _shown(_placed("Lantern Weavers Guild 2291", per_block=False))


def test_a_narrow_tj_word_gap_is_found() -> None:
    words = TEXT.split(" ")
    assert _shown(b"BT [" + b" -150 ".join(b"(%s)" % w.encode() for w in words) + b"] TJ ET")


def test_deep_brackets_and_operand_floods_stay_bounded_and_keep_their_strings() -> None:
    assert _shown(b"BT " + b"[" * 1000 + b"(Lantern Weavers Guild 2290)" + b"]" * 1000 + b" TJ ET")
    assert _shown(b"BT " + b"() " * 20_000 + b"(Lantern Weavers Guild 2290)")
    assert _shown(b"BT " + b"[] " * 20_000 + b"(Lantern Weavers ) (Guild 2290) Tj ET")
    started = time.monotonic()
    assemble(b"[" * 3_000_000)
    assert time.monotonic() - started < 30


def test_utf16be_with_a_character_outside_ascii_is_read() -> None:
    wide = (TEXT + " " + chr(0x2013) + " " + chr(0xE9)).encode("utf-16-be")
    assert _shown(b"BT <" + wide.hex().encode() + b"> Tj ET")
    assert _shown(b"BT <feff" + wide.hex().encode() + b"> Tj ET")


def test_an_inline_image_ending_in_hex_or_never_ending_hides_nothing() -> None:
    assert _shown(b"BI /W 1 /F /AHx ID 00FF>EI BT (Lantern Weavers Guild 2290) Tj ET")
    assert _shown(b"BI /W 1 ID BT (Lantern Weavers Guild 2290) Tj ET")


def test_a_stream_keyword_ending_in_cr_or_a_space_is_framed() -> None:
    for keyword in (b"stream\r", b"stream \n", b"stream\r\n"):
        data = b"%PDF-1.4\n1 0 obj\n<< >>\n" + keyword + zlib.compress(GLYPHS) + b"\nendstream\n"
        assert _found(data), keyword


def test_an_indirect_length_reads_a_raw_stream_holding_endstream() -> None:
    body = b"BT (endstream) Tj ET " + GLYPHS
    length = b"9 0 obj\n%d\nendobj\n" % len(body)
    assert _found(b"%PDF-1.4\n" + length + _object(b"/Length 9 0 R", body))


def test_a_long_dictionary_still_gives_its_length() -> None:
    body = b"BT (endstream) Tj ET " + GLYPHS
    dictionary = b"/Pad (" + b"x" * 5000 + b") /Length %d" % len(body)
    assert _found(b"%PDF-1.4\n" + _object(dictionary, body))


def test_a_wrong_length_never_swallows_the_next_stream() -> None:
    raw = b"BT (endstream\n) Tj ET"
    after = _object(b"/Filter /FlateDecode", zlib.compress(GLYPHS))
    # the length lands on the next stream's `endstream`: a stream opens between, so it is not trusted
    head = b"%PDF-1.4\n1 0 obj\n<< /Length "
    tail = b" >>\nstream\n" + raw + b"\nendstream\nendobj\n" + after
    length = len(tail) - len(b"\nendstream\nendobj\n") - len(b" >>\nstream\n")
    assert _found(head + b"%d" % length + tail)


def test_an_encrypted_pdf_is_refused() -> None:
    data = _pdf(GLYPHS) + b"trailer\n<< /Encrypt 5 0 R >>\n"
    with pytest.raises(CannotScan) as refused:
        scan.blob_texts(data)
    assert refused.value.reason == "source-unreadable"
