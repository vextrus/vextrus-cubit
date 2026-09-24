"""The pinned extraction parameter set (L-CAD-02, L-CAD-03, L-CAD-05).

A source key is scoped to (file bytes, extractor identity), and extractor identity is the tool,
its version and the hash of *these* values. Changing any of them is a declared re-ingest minting a
new key multiset, so they live in one place and are hashed from that same place.
"""

from __future__ import annotations

import hashlib
import json
from typing import Final

from .keys import QUANTUM

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
    return _hash(PARAMETER_SET)


# ---- the vector-PDF lane's own parameter set (R-TO-002) -------------------------------------------
#
# L-CAD-02 pins "version + parameter-set hash PER SCHEME", so a PDF_OBJECT key is scoped to these
# values and never to the DXF set above: the two lanes read different files at different
# resolutions, and moving one lane's parameter must re-key that lane's corpora and nobody else's.
# The DXF hash above is unmoved by this set's existence — the committed DXF artifacts spell it.

#: How finely a PDF Bézier is flattened, as a length ON THE PAGE: 0.01 pt (about 0.0035 mm of
#: paper), ten times the grid a key is digested on. Page space is paper, never the world (the
#: insunits Interpretation in `units.py`), so the tolerance is stated in the page's own unit.
PDF_FLATTEN_TOLERANCE_PT: Final = 0.01

#: The grid a PDF object's page-space geometry is quantised to before it is digested (L-CAD-02) —
#: read from the grid `keys.quantum` really rounds on, never re-spelled, so the identity this set
#: hashes and the rounding the keys are minted at cannot drift apart (B-17).
PDF_KEY_QUANTUM_PT: Final = float(QUANTUM)

#: The canonical string's own version: how a page object is spelled for its digest. Changing the
#: spelling — a field added, the multi-subpath mapping moved — re-keys every PDF, so it is part of
#: the identity like any other parameter.
PDF_CANONICAL: Final = "pdf-object/1"

PDF_PARAMETER_SET: Final[dict[str, float | int | str]] = {
    "canonical": PDF_CANONICAL,
    "coordinate_precision": COORDINATE_PRECISION,
    "derived_entity_budget": DERIVED_ENTITY_BUDGET,
    "explode_depth_cap": EXPLODE_DEPTH_CAP,
    "flatten_point_cap": FLATTEN_POINT_CAP,
    "flatten_tolerance_pt": PDF_FLATTEN_TOLERANCE_PT,
    "key_quantum_pt": PDF_KEY_QUANTUM_PT,
    "stray_lower_percentile": STRAY_LOWER_PERCENTILE,
    "stray_upper_percentile": STRAY_UPPER_PERCENTILE,
    "stray_window_margin": STRAY_WINDOW_MARGIN,
}


def pdf_parameter_set_hash() -> str:
    """The 64-hex identity of the PDF lane's pinned parameter set — half of what scopes every
    PDF_OBJECT key; pypdfium2's version is the other half."""
    return _hash(PDF_PARAMETER_SET)


# ---- the raster lane's own parameter set (R-TO-003) -----------------------------------------------
#
# A RASTER_TRACE key is scoped to the vectoriser's identity — OpenCV's version and the hash of THESE
# values (L-CAD-02, per scheme) — and never to the DXF or PDF sets above, which it leaves unmoved. The
# set names every knob the trace turns: how the skew is found and undone, how the page is cleaned,
# the line detector's own parameters, the shortest line kept, how a page's DPI is decided, and the
# run's determinism pins. The numpy the rotations are computed with is part of the identity too; it
# is read at hash time (`raster_parameter_set`), never imported here, so the DXF lane pays nothing
# for the raster lane's existence.

#: The canonical string's own version for a traced line: `page index|line|x,y x,y`, the two ends in
#: ascending order so a line keys the same whichever end the detector started from.
RASTER_CANONICAL: Final = "raster-trace/1"

#: The line detector: OpenCV's LSD with standard refinement, at its documented defaults, stated so a
#: library default that moved could not move the keys unseen.
RASTER_LSD_REFINE: Final = "LSD_REFINE_STD"
RASTER_LSD_SCALE: Final = 0.8
RASTER_LSD_SIGMA_SCALE: Final = 0.6
RASTER_LSD_QUANT: Final = 2.0
RASTER_LSD_ANG_TH: Final = 22.5
RASTER_LSD_LOG_EPS: Final = 0.0
RASTER_LSD_DENSITY_TH: Final = 0.7
RASTER_LSD_N_BINS: Final = 1024

#: The shortest traced line kept, as a length on paper: a millimetre. What is shorter is speckle,
#: hatching grain and the crumbs of letter strokes; it is counted per raster (`dropped_short`).
RASTER_MIN_LINE_MM: Final = 1.0

#: The shortest line a page with no stated DPI keeps, in pixels: a millimetre at 300 DPI, the common
#: resolution of a drawing scan.
RASTER_MIN_LINE_PX_UNSTATED: Final = 12.0

#: Denoise: a 3-by-3 median (salt, pepper, JPEG speckle), then a 2-by-2 grey opening — minimum then
#: maximum — which closes the pinholes and one-pixel breaks inside an inked line and never thins it.
RASTER_MEDIAN_KSIZE: Final = 3
RASTER_OPEN_KSIZE: Final = 2

#: Deskew: the page's dominant near-axis direction, read by the same detector on a copy whose long
#: side is at most this many pixels, from lines at least this long there, within this many degrees of
#: an axis, histogrammed at this bin width, smoothed over this many bins and refined by the
#: length-weighted mean within this window of the peak. The angle is rounded to this step before any
#: pixel moves, and a page skewed less than the threshold is left unturned (a resample would soften
#: it for nothing).
RASTER_SKEW_SAMPLE_PX: Final = 2000
RASTER_SKEW_MIN_LINE_PX: Final = 40.0
RASTER_SKEW_RANGE_DEG: Final = 5.0
RASTER_SKEW_BIN_DEG: Final = 0.02
RASTER_SKEW_SMOOTH_BINS: Final = 5
RASTER_SKEW_REFINE_DEG: Final = 0.25
RASTER_SKEW_STEP_DEG: Final = 0.01
RASTER_SKEW_THRESHOLD_DEG: Final = 0.05

#: Which embedded PDF images are scans to trace (I-585): at least this many pixels on each side,
#: and either covering at least this fraction of the page or grey (a pasted scan of a drawing). A
#: smaller colour image — a logo, a photograph — is listed and left unread.
RASTER_EMBEDDED_MIN_PX: Final = 64
RASTER_EMBEDDED_PAGE_FRACTION: Final = 0.5

#: The page raster written beside the artifact: a grey PNG at this zlib level.
RASTER_PNG_COMPRESSION: Final = 6

#: Determinism pins, part of the identity: one thread, and OpenCV's runtime CPU dispatch off, so the
#: same bytes trace to the same lines whatever the machine's SIMD (the critic's condition, M4P-3).
RASTER_THREADS: Final = 1
RASTER_USE_OPTIMIZED: Final = False


def raster_parameter_set() -> dict[str, float | int | str | bool]:
    """The raster lane's pinned parameter set, with the numpy its geometry is computed by."""
    from importlib.metadata import version

    return {
        "canonical": RASTER_CANONICAL,
        "coordinate_precision": COORDINATE_PRECISION,
        "embedded_min_px": RASTER_EMBEDDED_MIN_PX,
        "embedded_page_fraction": RASTER_EMBEDDED_PAGE_FRACTION,
        "key_quantum_pt": PDF_KEY_QUANTUM_PT,
        "lsd_ang_th": RASTER_LSD_ANG_TH,
        "lsd_density_th": RASTER_LSD_DENSITY_TH,
        "lsd_log_eps": RASTER_LSD_LOG_EPS,
        "lsd_n_bins": RASTER_LSD_N_BINS,
        "lsd_quant": RASTER_LSD_QUANT,
        "lsd_refine": RASTER_LSD_REFINE,
        "lsd_scale": RASTER_LSD_SCALE,
        "lsd_sigma_scale": RASTER_LSD_SIGMA_SCALE,
        "median_ksize": RASTER_MEDIAN_KSIZE,
        "min_line_mm": RASTER_MIN_LINE_MM,
        "min_line_px_unstated": RASTER_MIN_LINE_PX_UNSTATED,
        "numpy": version("numpy"),
        "open_ksize": RASTER_OPEN_KSIZE,
        "png_compression": RASTER_PNG_COMPRESSION,
        "skew_bin_deg": RASTER_SKEW_BIN_DEG,
        "skew_min_line_px": RASTER_SKEW_MIN_LINE_PX,
        "skew_range_deg": RASTER_SKEW_RANGE_DEG,
        "skew_refine_deg": RASTER_SKEW_REFINE_DEG,
        "skew_sample_px": RASTER_SKEW_SAMPLE_PX,
        "skew_smooth_bins": RASTER_SKEW_SMOOTH_BINS,
        "skew_step_deg": RASTER_SKEW_STEP_DEG,
        "skew_threshold_deg": RASTER_SKEW_THRESHOLD_DEG,
        "threads": RASTER_THREADS,
        "use_optimized": RASTER_USE_OPTIMIZED,
    }


def raster_parameter_set_hash() -> str:
    """The 64-hex identity of the raster lane's pinned parameter set — half of what scopes every
    RASTER_TRACE key; OpenCV's version is the other half."""
    return _hash(raster_parameter_set())


def _hash(parameters: dict[str, float | int | str | bool]) -> str:
    canonical = json.dumps(parameters, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
