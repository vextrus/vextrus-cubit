"""The DWG reader's codes (ticket 04): what `engine.read` says about a file it read or could not read.

Worded in web/src/messages/engine/read/en.po. `program` is the reader's own program (`dwgread`,
`dwg2dxf`), never a path.
"""

from engine.messages import MessageCode

# A file the reader could not read (it is held, with this, as the file's finding).
UNSUPPORTED_FORMAT = MessageCode("engine.read.unsupported_format", params=("format",))
READER_FAILED = MessageCode("engine.read.reader_failed", params=("program", "exit_code"))
LIMIT_REACHED = MessageCode("engine.read.limit_reached", params=("program", "limit"))
OUTPUT_UNREADABLE = MessageCode("engine.read.output_unreadable", params=("program",))
# dwgread reported success but lost objects the file's own block records list (a damaged file).
OBJECTS_MISSING = MessageCode("engine.read.objects_missing", params=("count",))

# The sandbox itself (docs/architecture.md; engine/read/sandbox.py).
SANDBOX_UNAVAILABLE = MessageCode("engine.read.sandbox_unavailable")
SANDBOX_REFUSED = MessageCode("engine.read.sandbox_refused")

# Notes on a file that was read: each repair the reader made, with how many entities it touched.
ATTRIB_STYLE_FROM_ATTDEF = MessageCode("engine.read.attrib_style_from_attdef", params=("count",))
ALIGNED_TEXT_FROM_START = MessageCode("engine.read.aligned_text_from_start", params=("count",))
GEOMETRY_MISSING = MessageCode("engine.read.geometry_missing", params=("count",))
LAYER_UNRESOLVED = MessageCode("engine.read.layer_unresolved", params=("count",))
DXF_RECOVERED = MessageCode("engine.read.dxf_recovered", params=("errors",))
