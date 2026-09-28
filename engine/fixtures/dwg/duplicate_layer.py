"""Two layers with one name: ACadSharp raises an Error notification that is not an unread entity.

Invented; no office's convention. The second reader's stricter rule (the owner's ruling of 28 Sep 2026,
"Hold it"; tools/acadsharp-dump/Program.cs): only "Could not read <entity> with handle: …" is an
unread entity, which holds a file; **any other Error notification fails it**. ACadSharp 3.8.0 raises
Error notifications of other shapes whatever its `Failsafe` setting (among them its table template's
"already exists", its dictionary, group and MLINE-style templates, its LwPolyline and
AEC_CLEANUP_GROUP readers and its header reader's sentinel; the orchestrator's review of #79). This
file raises the table template's: two layer records with one name. LibreDWG 0.14 reads it (2 LINEs,
both on `WALLS-KEEP`); the dumper built before the ruling (Failsafe off, no notification handler)
exited 0 and the two agreed; the dumper at its pin exits 1, and the stage fails (`DumperStopped`).

Neither writer stores two layers with one name, so the drawing is written with the layers
`WALLS-KEEP` and `WALLS-TWIN` (one LINE on each) as AutoCAD 2000 (AC1015), whose objects are stored
uncompressed, and `patch` renames the second to the first in the file's bit stream (a DWG's strings
need not start on a byte, so the search is by bit). The object's CRC is left as it was: neither reader
checks it. `patch` refuses a file that holds the name to replace other than exactly once.
"""

from ezdxf.document import Drawing

from engine.fixtures.dwg import new_drawing

VERSION = "AC1015"
KEPT = "WALLS-KEEP"
TWIN = "WALLS-TWIN"  # the same length as KEPT, so the patch moves nothing


def draw() -> Drawing:
    doc = new_drawing()
    doc.layers.add(KEPT)
    doc.layers.add(TWIN)
    model = doc.modelspace()
    model.add_line((0, 0), (10, 0), dxfattribs={"layer": KEPT})
    model.add_line((0, 5), (10, 5), dxfattribs={"layer": TWIN})
    return doc


def patch(data: bytes) -> bytes:
    """The DWG with the layer `TWIN` renamed `KEPT`, in the bit stream."""
    bits = "".join(f"{byte:08b}" for byte in data)
    twin, kept = _bits(TWIN), _bits(KEPT)
    found = [i for i in range(len(bits) - len(twin) + 1) if bits.startswith(twin, i)]
    if len(found) != 1:
        raise ValueError(f"{TWIN} is stored {len(found)} times, not once")
    at = found[0]
    patched = bits[:at] + kept + bits[at + len(kept) :]
    return bytes(int(patched[i : i + 8], 2) for i in range(0, len(patched), 8))


def _bits(text: str) -> str:
    return "".join(f"{byte:08b}" for byte in text.encode("ascii"))
