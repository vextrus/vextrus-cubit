"""The pinned parameter set a source key is scoped to (L-CAD-02).

"A key is scoped to (file bytes, extractor identity: version + parameter-set hash per
scheme)." The set below is the whole of the DXF extractor's tuning: change a number here
and every key minted before the change belongs to a different extractor, which is why the
hash rides in the ingest record rather than being implied by the version.
"""

from __future__ import annotations

import hashlib
import json
from types import MappingProxyType
from typing import Final

#: Explode recursion stops at this depth; a nested INSERT below it is a counted loss.
EXPLODE_DEPTH_CAP: Final = 8

#: Derived paint entities one layout may hold before explosion is truncated.
DERIVED_ENTITY_BUDGET: Final = 200_000

#: Maximum sagitta, in drawing units, between a curve and the polyline that stands for it.
FLATTEN_TOLERANCE: Final = 0.01

#: Points one flattened curve may carry; a curve that wants more is a counted cap trip.
FLATTEN_POINT_CAP: Final = 4096

#: The parameter set, exactly as it is hashed.
PARAMETER_SET: Final = MappingProxyType(
    {
        "derived_entity_budget": DERIVED_ENTITY_BUDGET,
        "explode_depth_cap": EXPLODE_DEPTH_CAP,
        "flatten_point_cap": FLATTEN_POINT_CAP,
        "flatten_tolerance": FLATTEN_TOLERANCE,
    }
)


def canonical_parameter_json() -> str:
    """The parameter set as one canonical JSON string: keys sorted, no incidental space."""
    return json.dumps(dict(PARAMETER_SET), sort_keys=True, separators=(",", ":"))


def parameter_set_hash() -> str:
    """sha256 of the canonical parameter JSON — the second half of extractor identity."""
    return hashlib.sha256(canonical_parameter_json().encode("utf-8")).hexdigest()
