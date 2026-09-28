"""The Trace's anchors: where on a drawing a figure was read (docs/architecture.md, Trace).

Named here by the skeleton (01a) so the harness's types (06b) import them before the reader (04)
fills them, each to and from JSON, under the M0 plan's contract ("The ReadArtefact and the anchors"):

- `DwgAnchor`: the source file's sha256, the reader and its version, the sheet, the chain of insert
  handles, and the entity's handle;
- `PdfAnchor`: the page, the path's index and its box.

An artefact an anchor names is never deleted.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DwgAnchor:
    """A place in a DWG file. Its fields are 04's."""


@dataclass(frozen=True)
class PdfAnchor:
    """A place in a PDF page. Its fields are 04's."""


Anchor = DwgAnchor | PdfAnchor
"""Either anchor; a union, so `isinstance(x, Anchor)` works."""
