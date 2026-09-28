"""A small PDF writer for the synthetic fixtures: objects written as bytes, a classic xref table.

It writes exactly what a generator asks for, hostile structures included (a page tree that loops, a
stream whose length is a lie about its contents), which no PDF library would write on purpose. Every
fixture is invented; nothing in one comes from a real drawing.
"""

import math
import zlib
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field

type Ref = int

A3 = (1190.55, 841.89)
"""An A3 sheet laid landscape, in points."""


def ref(number: Ref) -> bytes:
    return b"%d 0 R" % number


def refs(numbers: Iterable[Ref]) -> bytes:
    return b"[" + b" ".join(ref(n) for n in numbers) + b"]"


def num(value: float) -> bytes:
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return (text if text not in ("", "-0") else "0").encode()


def nums(values: Iterable[float]) -> bytes:
    return b"[" + b" ".join(num(v) for v in values) + b"]"


def string(text: str) -> bytes:
    """A PDF text string: a literal in PDFDocEncoding's Latin range, else UTF-16BE with its mark."""
    try:
        raw = text.encode("latin-1")
    except UnicodeEncodeError:
        return b"<FEFF" + text.encode("utf-16-be").hex().upper().encode() + b">"
    escaped = raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")
    return b"(" + escaped + b")"


def dictionary(entries: Mapping[str, bytes]) -> bytes:
    return b"<<" + b"".join(b"/%s %s" % (key.encode(), value) for key, value in entries.items()) + b">>"


class Pdf:
    """Objects numbered from 1, each written once; `write` lays them out with their xref."""

    def __init__(self, version: str = "1.7") -> None:
        self.version = version
        self._bodies: list[bytes | None] = []

    def reserve(self) -> Ref:
        self._bodies.append(None)
        return len(self._bodies)

    def put(self, number: Ref, body: bytes) -> Ref:
        self._bodies[number - 1] = body
        return number

    def add(self, body: bytes) -> Ref:
        return self.put(self.reserve(), body)

    def stream(
        self, data: bytes, entries: Mapping[str, bytes] | None = None, *, deflate: bool = False
    ) -> Ref:
        """A stream object; `deflate` compresses it with FlateDecode."""
        fields = dict(entries or {})
        if deflate:
            data = zlib.compress(data)
            fields["Filter"] = b"/FlateDecode"
        return self.encoded_stream(data, fields)

    def encoded_stream(self, data: bytes, entries: Mapping[str, bytes]) -> Ref:
        """A stream whose data is already encoded as `entries` say (`Filter` among them)."""
        fields = {**entries, "Length": b"%d" % len(data)}
        return self.add(dictionary(fields) + b"\nstream\n" + data + b"\nendstream")

    def write(
        self,
        root: Ref,
        info: Ref | None = None,
        trailer: Mapping[str, bytes] | None = None,
        *,
        xref: bool = True,
    ) -> bytes:
        """The file. Without `xref`, its cross-reference table is missing, so a reader must find the
        objects by scanning the file (and expand every object stream it finds to do so)."""
        out = bytearray(b"%%PDF-%s\n%%\xe2\xe3\xcf\xd3\n" % self.version.encode())
        offsets: list[int] = []
        for number, body in enumerate(self._bodies, start=1):
            if body is None:
                raise ValueError(f"object {number} was reserved and never written")
            offsets.append(len(out))
            out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
        fields: dict[str, bytes] = {"Size": b"%d" % (len(offsets) + 1), "Root": ref(root)}
        if info is not None:
            fields["Info"] = ref(info)
        fields.update(trailer or {})
        if not xref:
            return bytes(out + b"trailer\n" + dictionary(fields) + b"\nstartxref\n0\n%%EOF\n")
        start = len(out)
        out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(offsets) + 1)
        for offset in offsets:
            out += b"%010d 00000 n \n" % offset
        out += b"trailer\n" + dictionary(fields) + b"\nstartxref\n%d\n%%%%EOF\n" % start
        return bytes(out)


# Pages ------------------------------------------------------------------------------------------------


@dataclass
class Page:
    """One page: its content stream, the resources it names, and what hangs from it."""

    content: bytes = b""
    size: tuple[float, float] = A3
    rotate: int | None = None
    fonts: dict[str, Ref] = field(default_factory=dict)
    xobjects: dict[str, Ref] = field(default_factory=dict)
    layers: dict[str, Ref] = field(default_factory=dict)
    """Optional-content groups by their resource name (`/Properties`), as AutoCAD lists its layers."""
    annots: list[Ref] = field(default_factory=list)
    entries: dict[str, bytes] = field(default_factory=dict)
    """Further entries of the page's dictionary (`/AA`, a `/CropBox`)."""
    deflate: bool = True


def resources(page: Page) -> bytes:
    entries: dict[str, bytes] = {}
    for key, table in (("Font", page.fonts), ("XObject", page.xobjects), ("Properties", page.layers)):
        if table:
            entries[key] = dictionary({name: ref(number) for name, number in table.items()})
    return dictionary(entries)


def document(
    pdf: Pdf,
    pages: Sequence[Page],
    *,
    info: Mapping[str, str] | None = None,
    catalog: Mapping[str, bytes] | None = None,
    trailer: Mapping[str, bytes] | None = None,
    xref: bool = True,
) -> bytes:
    """The whole file: a catalog over one flat page tree, and an Info dictionary when given."""
    tree = pdf.reserve()
    kids: list[Ref] = []
    for page in pages:
        content = pdf.stream(page.content, deflate=page.deflate)
        entries = {
            "Type": b"/Page",
            "Parent": ref(tree),
            "MediaBox": nums((0, 0, *page.size)),
            "Resources": resources(page),
            "Contents": ref(content),
        }
        if page.rotate is not None:
            entries["Rotate"] = b"%d" % page.rotate
        if page.annots:
            entries["Annots"] = refs(page.annots)
        entries.update(page.entries)
        kids.append(pdf.add(dictionary(entries)))
    pdf.put(tree, dictionary({"Type": b"/Pages", "Kids": refs(kids), "Count": b"%d" % len(kids)}))
    root = pdf.add(dictionary({"Type": b"/Catalog", "Pages": ref(tree), **(catalog or {})}))
    info_ref = None
    if info is not None:
        info_ref = pdf.add(dictionary({key: string(value) for key, value in info.items()}))
    return pdf.write(root, info_ref, trailer, xref=xref)


# Fonts and drawing -------------------------------------------------------------------------------------

GLYPH_WIDTH = 600
"""Every glyph of the fixtures' fonts advances 0.6 of its size, so a test can place the next one."""


def truetype_font(pdf: Pdf, name: str = "ABCDEF+ArialNarrow", *, embedded: bool = True) -> Ref:
    """A simple TrueType font with WinAnsi codes, each glyph `GLYPH_WIDTH` wide. Its font program is
    a stand-in (no reader here parses a simple font's program); only its presence says "embedded"."""
    descriptor = {
        "Type": b"/FontDescriptor",
        "FontName": b"/" + name.encode(),
        "Flags": b"32",
        "FontBBox": b"[0 -200 1000 800]",
        "ItalicAngle": b"0",
        "Ascent": b"800",
        "Descent": b"-200",
        "CapHeight": b"700",
        "StemV": b"80",
    }
    if embedded:
        descriptor["FontFile2"] = ref(pdf.stream(b"\x00\x01\x00\x00 stand-in font program"))
    return pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/TrueType",
                "BaseFont": b"/" + name.encode(),
                "FirstChar": b"32",
                "LastChar": b"126",
                "Widths": b"[" + b" ".join([b"%d" % GLYPH_WIDTH] * 95) + b"]",
                "Encoding": b"/WinAnsiEncoding",
                "FontDescriptor": ref(pdf.add(dictionary(descriptor))),
            }
        )
    )


def type3_font(pdf: Pdf) -> Ref:
    """A Type 3 font whose one glyph (`A`) is a drawn square."""
    square = pdf.stream(b"600 0 0 0 600 600 d1 0 0 600 600 re f")
    return pdf.add(
        dictionary(
            {
                "Type": b"/Font",
                "Subtype": b"/Type3",
                "FontBBox": b"[0 0 600 600]",
                "FontMatrix": b"[0.001 0 0 0.001 0 0]",
                "CharProcs": dictionary({"A": ref(square)}),
                "Encoding": b"<</Type/Encoding/Differences[65/A]>>",
                "FirstChar": b"65",
                "LastChar": b"65",
                "Widths": b"[600]",
            }
        )
    )


def pdf_text(value: str) -> bytes:
    """A string for `Tj`, in WinAnsi (the fixtures' fonts' encoding)."""
    raw = value.encode("cp1252")
    return b"(" + raw.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)") + b")"


def text(
    x: float,
    y: float,
    value: str,
    *,
    size: float = 10,
    angle: float = 0,
    mirrored: bool = False,
    font: str = "F1",
    render: int = 0,
) -> bytes:
    """One string in its own text object at (x, y), turned by `angle` degrees; `mirrored` flips it
    about its own vertical axis (a negative determinant), as a mirrored AutoCAD text plots."""
    cos, sin = math.cos(math.radians(angle)), math.sin(math.radians(angle))
    a, b, c, d = (cos, sin, -sin, cos)
    if mirrored:
        a, b = -a, -b
    matrix = b" ".join(num(v) for v in (a, b, c, d, x, y))
    mode = b"%d Tr " % render if render else b""
    return b"BT /%s %s Tf %s%s Tm %s Tj ET\n" % (font.encode(), num(size), mode, matrix, pdf_text(value))


def letters(
    x: float, y: float, value: str, *, size: float = 10, angle: float = 0, font: str = "F1"
) -> bytes:
    """A string drawn one glyph per text object, each placed where the last one's advance ends: how a
    plot driver may write it, and what fragments a word-by-position reader."""
    step = GLYPH_WIDTH / 1000 * size
    dx, dy = math.cos(math.radians(angle)) * step, math.sin(math.radians(angle)) * step
    return b"".join(
        text(x + i * dx, y + i * dy, glyph, size=size, angle=angle, font=font)
        for i, glyph in enumerate(value)
    )


def strokes(count: int, *, x: float = 100, y: float = 100, length: float = 50) -> bytes:
    """`count` stroked line segments, each its own path."""
    return b"".join(
        b"%s %s m %s %s l S\n" % (num(x), num(y + i), num(x + length), num(y + i)) for i in range(count)
    )


def image(pdf: Pdf, width: int = 4, height: int = 4, *, claimed: tuple[int, int] | None = None) -> Ref:
    """A grey image XObject; `claimed` states other pixel dimensions than its data holds."""
    w, h = claimed or (width, height)
    return pdf.stream(
        bytes(width * height),
        {
            "Type": b"/XObject",
            "Subtype": b"/Image",
            "Width": b"%d" % w,
            "Height": b"%d" % h,
            "ColorSpace": b"/DeviceGray",
            "BitsPerComponent": b"8",
        },
        deflate=True,
    )


def place(name: str, x: float, y: float, width: float, height: float) -> bytes:
    """Draw XObject `name` over the box (x, y, width, height)."""
    return b"q %s 0 0 %s %s %s cm /%s Do Q\n" % (num(width), num(height), num(x), num(y), name.encode())


def layer(pdf: Pdf, name: str) -> Ref:
    """An optional-content group named for a drawing's layer."""
    return pdf.add(dictionary({"Type": b"/OCG", "Name": string(name)}))


def on_layer(resource: str, content: bytes) -> bytes:
    return b"/OC /%s BDC\n%s EMC\n" % (resource.encode(), content)


SHX_TEXT = "AutoCAD SHX Text"
"""The name AutoCAD's PDF plot gives the comments that carry its SHX text (Autodesk's knowledge
article "Drawing text appears as comments in a PDF created by AutoCAD"; see engine/read/pdf)."""


def shx_comment(
    pdf: Pdf, value: str, box: tuple[float, float, float, float], *, by: str = "both"
) -> Ref:
    """A comment carrying an SHX string, as AutoCAD's plot writes it with PDFSHX at 1: a hidden
    square annotation with the string and its box. `by` names where it says what it is: `subject`,
    `title` or `both`."""
    entries = {
        "Type": b"/Annot",
        "Subtype": b"/Square",
        "Rect": nums(box),
        "Contents": string(value),
        "F": b"2",
        "C": b"[]",
    }
    if by in ("subject", "both"):
        entries["Subj"] = string(SHX_TEXT)
    if by in ("title", "both"):
        entries["T"] = string(SHX_TEXT)
    return pdf.add(dictionary(entries))
