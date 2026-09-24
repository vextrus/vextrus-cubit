/**
 * The trace a staged scan's reading names, for every stage that offers the gate an INTERPRETED figure.
 *
 * L-QTY-03 has a line carry "the vectoriser id + version + render DPI where INTERPRETED", and the gate
 * refuses an offer read off a scan that names none (RASTER_IDENTITY_MISSING, s-takeoff I-685). A
 * stage that wants the deferral — or the AGREED exit after it — offers what a RASTER placement would:
 * the RASTER engine and this trace. The tool is the cad lane's own vectoriser (`cad/src/vextrus_cad/raster.py`
 * TOOL); the hashes are surrogates, because no stage here traces a real page.
 */

/** The engine a scan's reading is read under (L-QTY-03's `ENGINES`). */
export const RASTER = "RASTER";

/** One trace, shaped as the offer contract's `RasterIdentity`: stated at 300 DPI, as the file said. */
export const SCAN_TRACE = Object.freeze({
  tool: "opencv-lsd",
  toolVersion: "4.10.0",
  parameterSetHash: "5c".repeat(32),
  pageSha256: "a7".repeat(32),
  dpi: "300",
  dpiSource: "file",
});

/** What an offer read off a scan carries beside its INTERPRETED basis: the engine and the trace. */
export const READ_OFF_SCAN = Object.freeze({ engine: RASTER, raster: SCAN_TRACE });
