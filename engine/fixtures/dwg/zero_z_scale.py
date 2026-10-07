"""An INSERT whose Z scale is stored as 0, which LibreDWG reads, stock ACadSharp 3.8.0 cannot, and the
dumper's build of ACadSharp reads as 1.

Invented; no office's convention. The pattern of one real file of the Development Sets (the owner's
diagnosis on #79, 28 Sep 2026; docs/research/dwg-reader-evidence.md, conclusion 4): stock ACadSharp's
`Insert.ZScale` setter refuses 0 ("value must be none zero"), so reading that INSERT throws
ArgumentOutOfRangeException; with `Failsafe` on it is left out and reported, and the rest is read. The
dumper is built with DomCR/ACadSharp#1205's DWG scale repair (ticket W317;
tools/acadsharp-dump/patches/), which reads the 0 as 1 as AutoCAD's AUDIT does, so it reads the INSERT
and the two readers agree.

Neither writer at hand stores a 0 scale: ACadSharp's own writer refuses it, and LibreDWG's `dxf2dwg`
(tried at R2000 and R2004 from ezdxf's DXF, 28 Sep 2026) wrote the scale as 1 and a file ACadSharp could
not read at all. So the drawing is written with a Z scale of `MARK`, a value stored nowhere else, as
AutoCAD 2000 (AC1015), whose objects are stored uncompressed and whole-byte aligned here, and `patch`
then overwrites that one stored double with 0.0. The object's CRC is left as it was: neither reader
checks it (ACadSharp's CrcCheck is off by default; LibreDWG 0.14 reads the file, the INSERT's scale
(1, 1, 0)). `patch` refuses a file that holds the mark other than exactly once.

Model space holds a LINE and the INSERT (on layer `SITE`) of block `TREE`, a CIRCLE.
"""

import struct

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1015"
MARK = 1234.5678


def draw() -> Drawing:
    doc = new_drawing()
    doc.layers.add("SITE")
    tree = doc.blocks.new("TREE", base_point=(0, 0))
    tree.add_circle((0, 0), 1)
    model = doc.modelspace()
    model.add_line((0, 0), (10, 0))
    model.add_blockref("TREE", (5, 5), dxfattribs={"layer": "SITE", "zscale": MARK})
    return doc


def patch(data: bytes) -> bytes:
    """The DWG with the INSERT's stored Z scale set to 0."""
    stored = struct.pack("<d", MARK)
    if data.count(stored) != 1:
        raise ValueError(f"the Z scale's mark is stored {data.count(stored)} times, not once")
    return data.replace(stored, struct.pack("<d", 0.0))
