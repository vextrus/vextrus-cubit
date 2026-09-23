"""The geometry pass: the converted DXF read back through ezdxf and tallied the same way."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import ezdxf
from ezdxf.layouts import Modelspace

from .dimensions import DIMENSION, carries_picture
from .errors import DwgError
from .quiet import held_library_words, said
from .vocabulary import MODEL_SPACE, NOT_TALLIED


def geometry_tally(dxf_path: Path) -> dict[str, dict[str, int]]:
    """Tally a converted DXF, space → entity class → count, as `census_of` tallies the census."""
    return tally_of(read_converted(dxf_path), dxf_path)


def read_converted(dxf_path: Path) -> Any:
    """The converted DXF opened as the tally reads it, or the conversion refused by name."""
    path = Path(dxf_path)
    # The reader's own complaints are held rather than written to the caller's stderr; a refusal
    # quotes them back, a clean read discards them.
    with held_library_words() as words:
        try:
            return ezdxf.readfile(str(path))
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


def tally_of(document: Any, dxf_path: Path) -> dict[str, dict[str, int]]:
    """What an opened conversion CARRIES to the extractor, space → entity class → count.

    Carried means kept by the recover-mode open the extractor reads it through: a DIMENSION whose
    picture the document does not hold is removed by that open's audit (`dimensions.py`), so it is
    not counted here — the census still counts it, and the reconciliation names the difference as a
    shortfall rather than the extractor losing it in silence (L-CAD-04). Before this rule the lane
    counted every such dimension as carried, and F-RCC6-BNBC's DWG reconciled clean while its 125
    dimensions never reached the artifact.
    """
    path = Path(dxf_path)
    tally: dict[str, dict[str, int]] = {}
    with held_library_words() as words:
        try:
            for layout_name in document.layouts.names_in_taborder():
                layout = document.layouts.get(layout_name)
                space = MODEL_SPACE if isinstance(layout, Modelspace) else layout_name
                for entity in layout:
                    dxftype = entity.dxftype()
                    if dxftype in NOT_TALLIED:
                        continue
                    if dxftype == DIMENSION and not carries_picture(entity, document):
                        continue
                    types = tally.setdefault(space, {})
                    types[dxftype] = types.get(dxftype, 0) + 1
        except Exception as error:
            # The walk reads what the open admitted, and a layout it cannot walk is the same fact the
            # open would have been refused for: not a DXF this lane can read through.
            raise DwgError(f"unparseable converted DXF {path.name}: {error}{said(words)}") from error

    return {space: dict(sorted(types.items())) for space, types in sorted(tally.items())}
