"""The geometry pass: the converted DXF read back through ezdxf and tallied the same way."""

from __future__ import annotations

from pathlib import Path

import ezdxf
from ezdxf.layouts import Modelspace

from .errors import DwgError
from .quiet import held_library_words, said
from .vocabulary import MODEL_SPACE, NOT_TALLIED


def geometry_tally(dxf_path: Path) -> dict[str, dict[str, int]]:
    """Tally a converted DXF, space → entity class → count, as `census_of` tallies the census."""
    path = Path(dxf_path)
    tally: dict[str, dict[str, int]] = {}
    # The reader's own complaints are held rather than written to the caller's stderr; a refusal
    # quotes them back, a clean read discards them.
    with held_library_words() as words:
        try:
            document = ezdxf.readfile(str(path))
            for layout_name in document.layouts.names_in_taborder():
                layout = document.layouts.get(layout_name)
                space = MODEL_SPACE if isinstance(layout, Modelspace) else layout_name
                for entity in layout:
                    dxftype = entity.dxftype()
                    if dxftype in NOT_TALLIED:
                        continue
                    types = tally.setdefault(space, {})
                    types[dxftype] = types.get(dxftype, 0) + 1
        except OSError as error:
            raise DwgError(f"the converted DXF {path.name} cannot be read: {error}{said(words)}") from error
        except Exception as error:
            # Every other way this read can end is the same fact about the file — it is not a DXF this
            # lane can walk — and L-CAD-04 answers that with a refusal naming the drawing rather
            # than with whatever the reader raised on the way past. A file of bytes no DXF grammar
            # admits reaches for a member that is not there, an index past the end of a group or a
            # value nothing can be read from, so the class of the reader's complaint carries no
            # information the refusal needs; the words it said do, and they are quoted back.
            raise DwgError(f"unparseable converted DXF {path.name}: {error}{said(words)}") from error

    return {space: dict(sorted(types.items())) for space, types in sorted(tally.items())}
