"""A drawn page whose text is set in an embedded TrueType font with a malformed table (hostile:
engine/read/pdf, "The trust boundary").

The font is a Type 0 font over Identity with no `ToUnicode`, so a reader wanting its letters must read
the program's `cmap` table:
- `table`: the table directory puts `cmap` far past the program's end;
- `cmap_loop`: a format 4 `cmap` of 32,767 segments, each spanning every code (billions of steps for
  a reader that walks each range).
"""

import struct

from engine.fixtures.pdf._writer import (
    Page,
    Pdf,
    dictionary,
    document,
    ref,
    strokes,
    text,
    truetype_font,
)


def _program(kind: str) -> bytes:
    if kind == "table":
        return struct.pack(">IHHHH4sIII", 0x00010000, 1, 16, 0, 0, b"cmap", 0, 0xFFFFFF00, 64)
    if kind == "cmap_loop":
        segments = 32767
        subtable = struct.pack(">HHHHHHH", 4, 0, 0, segments * 2, 0, 0, 0)
        subtable += struct.pack(f">{segments}H", *[0xFFFF] * segments) + b"\x00\x00"
        subtable += struct.pack(f">{segments}H", *[0] * segments)
        subtable += struct.pack(f">{segments}h", *[1] * segments)
        subtable += struct.pack(f">{segments}H", *[0] * segments)
        cmap = struct.pack(">HHHHI", 0, 1, 3, 1, 12) + subtable
        return struct.pack(">IHHHH4sIII", 0x00010000, 1, 16, 0, 0, b"cmap", 0, 28, len(cmap)) + cmap
    raise ValueError(f"bad_font: no such kind {kind!r}")


def write(kind: str = "table") -> bytes:
    pdf = Pdf()
    program = pdf.stream(_program(kind), deflate=True)
    descriptor = pdf.add(
        dictionary(
            {
                "Type": b"/FontDescriptor",
                "FontName": b"/BADFNT+Broken",
                "Flags": b"32",
                "FontBBox": b"[0 -200 1000 800]",
                "ItalicAngle": b"0",
                "Ascent": b"800",
                "Descent": b"-200",
                "CapHeight": b"700",
                "StemV": b"80",
                "FontFile2": ref(program),
            }
        )
    )
    descendant = pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/CIDFontType2",
                "BaseFont": b"/BADFNT+Broken",
                "CIDSystemInfo": b"<</Registry (Adobe) /Ordering (Identity) /Supplement 0>>",
                "FontDescriptor": ref(descriptor),
                "DW": b"600",
            }
        )
    )
    broken = pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/Type0",
                "BaseFont": b"/BADFNT+Broken",
                "Encoding": b"/Identity-H",
                "DescendantFonts": b"[" + ref(descendant) + b"]",
            }
        )
    )
    plain = truetype_font(pdf)
    content = (
        strokes(30)
        + text(900, 60, "S-501", size=12)
        + text(900, 40, "STAIR DETAILS", size=8)
        + b"BT /F2 8 Tf 1 0 0 1 200 400 Tm <0021002200230024> Tj ET\n"
    )
    return document(pdf, [Page(content=content, fonts={"F1": plain, "F2": broken})])
