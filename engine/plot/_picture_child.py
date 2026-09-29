"""The sandboxed child: draws one PDF page in grey with pdfium (engine/plot/picture.py).

    python -I -B -c <engine.plot.picture.CHILD> <checkout> <pdf> <output> <page> <px per pt> <most px>
        <width> <height> <slack> [<text>...]

It writes the header (`VXPP`, u32 width, u32 height) and the pixels, rows from the top, or `NO::` and
a reason's key for a page it will not draw: `unreadable` (the file or page cannot be opened),
`no_page` (the PDF has fewer pages), `not_the_page` (its size as displayed is not <width> by <height>
points within <slack>, or no more than half the <text>s are among its letters and digits: 12 read
another page under this number), `too_large` (the picture would pass the most pixels, checked before
a pixel is drawn) or `memory`. It exits 0 whatever the file holds; any other exit is the
sandbox's to explain (a limit reached) or a fault of Vextrus's own.
"""

import math
import os
import struct
import sys
import traceback

HEADER = struct.Struct("<4sII")


def main(argv: list[str]) -> int:
    source, target, page, px_per_pt, most = argv[0], argv[1], int(argv[2]), float(argv[3]), int(argv[4])
    expected = (float(argv[5]), float(argv[6])), float(argv[7]), argv[8:]
    try:
        data = _draw(source, page, px_per_pt, most, expected)
    except MemoryError:
        data = b"NO::memory"
    except Exception:
        traceback.print_exc(limit=5)
        data = b"NO::unreadable"
    descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        view = memoryview(data)
        while view:
            view = view[os.write(descriptor, view) :]
    finally:
        os.close(descriptor)
    return 0


def _draw(
    source: str,
    number: int,
    px_per_pt: float,
    most: int,
    expected: tuple[tuple[float, float], float, list[str]],
) -> bytes:
    import pypdfium2 as pdfium  # type: ignore[import-untyped]  # loaded in the sandbox only

    document = pdfium.PdfDocument(source)
    try:
        if number > len(document):
            return b"NO::no_page"
        page = document[number - 1]
        (want_w, want_h), slack, texts = expected
        width, height = page.get_size()  # as displayed: its CropBox, turned by its /Rotate
        if not all(abs(a - b) <= max(1.0, slack * b) for a, b in ((width, want_w), (height, want_h))):
            return b"NO::not_the_page"
        if texts:
            text = page.get_textpage().get_text_range()
            found = "".join(c for c in text if c.isalnum()).casefold()
            if sum(t in found for t in texts) * 2 <= len(texts):
                return b"NO::not_the_page"
        columns, rows = math.ceil(width * px_per_pt), math.ceil(height * px_per_pt)
        if not (columns > 0 and rows > 0 and columns * rows <= most):
            return b"NO::too_large"
        bitmap = page.render(
            scale=px_per_pt,
            grayscale=True,
            draw_annots=False,
            may_draw_forms=False,
            force_bitmap_format=pdfium.raw.FPDFBitmap_Gray,
        )
        pixels = bitmap.to_numpy()
        if pixels.ndim == 3:
            pixels = pixels.min(axis=2)
        rows, columns = pixels.shape
        if columns * rows > most:
            return b"NO::too_large"
        data: bytes = pixels.astype("uint8").tobytes()
        return HEADER.pack(b"VXPP", columns, rows) + data
    finally:
        document.close()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
