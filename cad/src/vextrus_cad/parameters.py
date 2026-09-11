"""The pinned extraction parameter set (L-CAD-02, L-CAD-03, L-CAD-05).

A source key is scoped to (file bytes, extractor identity), and extractor identity is the tool,
its version and the hash of *these* values. Changing any of them is a declared re-ingest minting a
new key multiset, so they live in one place and are hashed from that same place.
"""

from __future__ import annotations

import hashlib
import json
from typing import Final

#: How deep INSERT explosion recurses before it refuses and says so (L-CAD-03).
EXPLODE_DEPTH_CAP: Final = 8

#: How many synthesised entities one ingest may mint before explosion refuses (L-CAD-03).
DERIVED_ENTITY_BUDGET: Final = 200_000

#: Curve flattening tolerance, in the drawing's native units (L-CAD-05).
#: How finely a curve is described, AS A LENGTH ON THE DRAWING: a tenth of a hundredth of a
#: millimetre, whatever unit the file happens to be drawn in. It was a bare 0.01 of a drawing unit,
#: which is 0.01 mm on a millimetre drawing and 10 mm on a metre one — the same number meaning two
#: different accuracies, and the coarser of them visible in a wall (L-MEA-01: a number nobody gave a
#: unit to is not a length). The drawing-unit figure is derived per drawing from `$INSUNITS`.
FLATTEN_TOLERANCE_MM: Final = 0.01

#: The drawing-unit tolerance for a file that states no unit, and the value a millimetre drawing
#: derives — so an artifact of a millimetre drawing is byte-for-byte what it always was.
FLATTEN_TOLERANCE: Final = 0.01

#: How many points one entity's flattening may carry before it is truncated and counted.
FLATTEN_POINT_CAP: Final = 5000

#: The inter-percentile window robust extents keep, and the fraction of its span they widen it by
#: on each side; a bbox centre outside the result is a stray (L-CAD-05).
STRAY_LOWER_PERCENTILE: Final = 2.0
STRAY_UPPER_PERCENTILE: Final = 98.0
STRAY_WINDOW_MARGIN: Final = 0.25

#: How many decimal places emitted coordinates carry. Quantising before serialisation is what makes
#: a fresh ingest byte-identical to the committed one on another machine.
COORDINATE_PRECISION: Final = 9

PARAMETER_SET: Final[dict[str, float | int]] = {
    "coordinate_precision": COORDINATE_PRECISION,
    "derived_entity_budget": DERIVED_ENTITY_BUDGET,
    "explode_depth_cap": EXPLODE_DEPTH_CAP,
    "flatten_point_cap": FLATTEN_POINT_CAP,
    "flatten_tolerance": FLATTEN_TOLERANCE,
    "stray_lower_percentile": STRAY_LOWER_PERCENTILE,
    "stray_upper_percentile": STRAY_UPPER_PERCENTILE,
    "stray_window_margin": STRAY_WINDOW_MARGIN,
}


def parameter_set_hash() -> str:
    """The 64-hex identity of the pinned parameter set, half of what scopes every source key."""
    canonical = json.dumps(PARAMETER_SET, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
