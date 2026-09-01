"""The geometry pass: the converted DXF read back through ezdxf and tallied the same way."""

from __future__ import annotations

from pathlib import Path

import ezdxf
from ezdxf.layouts import Modelspace

from .errors import DwgError
from .vocabulary import MODEL_SPACE, NOT_TALLIED


def geometry_tally(dxf_path: Path) -> dict[str, dict[str, int]]:
    """Tally a converted DXF, space → entity class → count, as `census_of` tallies the census."""
    path = Path(dxf_path)
    tally: dict[str, dict[str, int]] = {}
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
        raise DwgError(f"the converted DXF {path.name} cannot be read: {error}") from error
    except (ezdxf.DXFError, ValueError) as error:
        # A conversion this reader cannot walk is an unparseable DXF whichever half of it failed:
        # ezdxf refuses the file, or the drawing inside it holds a value nothing can be read from.
        raise DwgError(f"unparseable converted DXF {path.name}: {error}") from error

    return {space: dict(sorted(types.items())) for space, types in sorted(tally.items())}
