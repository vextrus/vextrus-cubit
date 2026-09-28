"""A stream that inflates to gigabytes from a few megabytes (hostile: engine/read/pdf, "The trust
boundary").

`where` puts it in the page's content stream (`content`), or in an object stream that a reader must
expand to find the file's objects, the file having no cross-reference table (`object_stream`). The
stream inflates to `gib` GiB of spaces; it is built without holding them: deflate blocks, each flushed
so it stands alone, repeated, then the zlib checksum of the whole.
"""

import zlib

from engine.fixtures.pdf._writer import Page, Pdf, document, strokes

_BLOCK = 1 << 20


def bomb(gib: int) -> bytes:
    """A zlib stream of `gib` GiB of spaces."""
    return spaces(gib * 1024)


def spaces(mib: int) -> bytes:
    """A zlib stream of `mib` MiB of spaces, `mib` at least 1."""
    compressor = zlib.compressobj(9)
    chunk = b" " * _BLOCK
    first = compressor.compress(chunk) + compressor.flush(zlib.Z_FULL_FLUSH)
    repeated = compressor.compress(chunk) + compressor.flush(zlib.Z_FULL_FLUSH)
    blocks = mib
    checksum = 1
    for _ in range(blocks):
        checksum = zlib.adler32(chunk, checksum)
    final = b"\x03\x00"  # a last, empty block of fixed codes
    return first + repeated * (blocks - 1) + final + checksum.to_bytes(4, "big")


def write(where: str = "content", gib: int = 4) -> bytes:
    pdf = Pdf()
    if where == "content":
        content = pdf.encoded_stream(bomb(gib), {"Filter": b"/FlateDecode"})
        page = Page(content=b"", entries={"Contents": b"%d 0 R" % content})
        return document(pdf, [page])
    if where == "object_stream":
        pdf.encoded_stream(
            bomb(gib), {"Type": b"/ObjStm", "N": b"1", "First": b"0", "Filter": b"/FlateDecode"}
        )
        return document(pdf, [Page(content=strokes(3))], xref=False)
    raise ValueError(f"inflate: no such place {where!r}")
