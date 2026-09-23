/**
 * J-000 SEGMENTS: ingest and corroborate a PDF sheet
 *
 * MISSING DOOR: three doors, all M4's (R-TO-003, L-CAD-06, J-040) — the cad lane has no raster extractor, so a scan (an image file, or a PDF none of whose pages draws a path or a text) is stored and then refused SHEET_NOT_INGESTABLE, and a scan pasted onto a vector page is listed and named on its card, never read (I-521); a PDF page (ingested since M4P-1, its objects PDF_OBJECT keys) is partitioned into no view, so no scale can be affirmed on it; and the gate has no AGREED exit, so an INTERPRETED sighting, corroborated or not, never reaches a line.
 *
 * M4P-1 (session 8) opened the first of the doors measured below: a vector PDF is ingested, each page a
 * sheet whose number and title the grammar proposes (items 1 and 2 as far as a PDF goes; J-040 step 1
 * walks it). The measurements below are 689b5d76's, kept as the record of what stood.
 *
 * The first of AM-17's four M4 segments — AM-09 §3's "a PDF sheet ingested and corroborated" —
 * declared before the milestone lands. Until session 7 one anonymous stub claimed all four segments;
 * the leg is now one file per segment, so the door that lands first turns its own file into a walk
 * and splits no other. The owner ruled "M3 breadth first" for session 7: nothing of M4 is built, and
 * this stub says what would have to be, measured at 689b5d76.
 *
 * THE MEASURED WORK BEHIND EACH DOOR.
 * 1. A PDF is admitted and never read. Upload accepts pdf, png, jpg and tiff
 *    (src/core/db/schema-drawings.ts:23); ingest narrows to dxf|dwg (src/modules/takeoff/ingest/
 *    request.ts:26,29) and refuses SHEET_NOT_INGESTABLE at the door (request.ts:88) and in the job
 *    (src/modules/takeoff/ingest/pipeline.ts:43). The cad CLI ingests "a DXF or DWG file"
 *    (cad/src/vextrus_cad/cli.py:32,38); cad ships ezdxf alone (cad/pyproject.toml:9), and pypdfium2
 *    5.13.0 stands only in the fixtures group (:19), which cad/tests/sanity/test_fixtures_group.py
 *    forbids src to import. Moving it into the shipped dependencies is a `toolchain` increment.
 * 2. A non-DXF key is refused in five places. The closed scheme set is spelled once
 *    (src/core/sources.ts:10) and DXF_HANDLE alone in: the EntityGraph schema
 *    (src/core/entitygraph/schema.ts:26,34,102), the Python extractor (cad/src/vextrus_cad/
 *    ingest.py:30), the ingests CHECK (src/core/db/schema-takeoff-ingest.ts:23,59 — a migration), and
 *    the inspector (src/modules/takeoff/viewer-inspector/selection.ts:22, inspector-panel.tsx:24).
 *    The EntityGraph's unit map names no PostScript point and no pixel (schema.ts:43), and the
 *    painter samples no image but its glyph atlas (src/modules/takeoff/viewer/painter.ts:354-385) and
 *    its own settled frame (I-345), so a scanned page cannot even be shown to be traced.
 * 3. Corroboration unlocks nothing. The gate queues every INTERPRETED offer as
 *    INTERPRETED_UNCORROBORATED and reads no corroboration first (src/core/gate/evaluate.ts:288-303;
 *    the one queue cause, src/core/gate/law.ts:16). A register row cannot stand INTERPRETED at all:
 *    SIGHTING_STANDINGS is MEASURED|DERIVED (src/core/identity/law.ts:12), CHECK-closed
 *    (src/core/db/schema-register.ts:87). CORROBORATE is one object, one attribute, one ENTERED
 *    observation (src/core/acts/corroborate.ts:1-8), with no bulk by offered group as J-040 asks.
 * 4. No golden to walk against. The F-SCAN seeds are committed — rcc6-bnbc.pdf (27 pages; 5,458
 *    path, 4,336 text and 2 image objects), rcc6-bnbc.shx.pdf (71,112 paths, no text object),
 *    rcc6-bnbc.r2.pdf (27 image objects, the whole set as a DCT raster) and raster/r1..r4 — counted
 *    with pypdfium2 in cad/.venv. manifest.json and sanity.json hold only what each variant LOSES
 *    (fixtures/rcc6-bnbc/traps.json:414, "F-SCAN seeds"); F-SCAN's "expected INTERPRETED sightings
 *    and corroboration flow" (docs/specs/cubit.bible.xml:727) exist nowhere.
 *
 * THE LAW THAT FORCES IT. L-CAD-02 (cubit.bible.xml:230): a key's scheme is minted by its extractor,
 * PDF_OBJECT by pdfium and RASTER_TRACE by the vectoriser, each a content digest. L-CAD-04 (:232): PDF
 * via pypdfium2, raster via a pinned deterministic classical-CV vectoriser. L-QTY-01 (:195): "a QS
 * hand-tracing a scan also produces INTERPRETED". L-QTY-04 (:198): interpreted geometry uncorroborated
 * is "never a line (an interpreted line reaches a bill only as AGREED)" — so "corroborate" is honest
 * only once the gate has an AGREED exit, and never by loosening that clause. Two readings are ruled
 * before the first line: L-QTY-03 (:197) wants "the vectoriser id + version + render DPI where
 * INTERPRETED", which a hand trace has none of; and a vector PDF yields MEASURED geometry (R-TO-040,
 * :475), so the segment is honest only on a raster page — r2.pdf, or S-03's pasted scan
 * (traps.json:297).
 *
 * HONEST SIZE. L for the reachable form: a pypdfium2 page extractor (a toolchain move), the five
 * spellings and the ingests CHECK widened (a migration), an INTERPRETED standing (a migration), the
 * gate's AGREED exit, a raster quad in the painter, and a hand trace on one raster page corroborated —
 * built after the manual condition's door (m4-sheet-and-manual-measure.spec.ts), whose act a hand trace
 * is. XL for J-040 as written: a pinned OpenCV vectoriser, its determinism torture corpus, PB-5 as a
 * PERF spec and the F-SCAN sightings golden; the SHX set's OCR lane needs an engine this box lacks.
 *
 * The increment that lands these doors deletes this fixme and its line in
 * tests/journeys/fixme-roster.test.ts and writes the walk here; it never deletes the file (AM-09 §3,
 * AM-17).
 */
import { test } from "@playwright/test";

test.describe("J-000 — Golden Path: M4's PDF sheet (AM-09 §3, AM-17), owed", () => {
  test.fixme("MISSING DOOR: J-000 m4-pdf-sheet: cad has no raster extractor (a scan — an image file, or a PDF whose every page is one — is stored, then refused SHEET_NOT_INGESTABLE), a PDF page carries no view so no scale can be affirmed on it, and the gate has no AGREED exit, so a corroborated INTERPRETED sighting can never reach a line", () => {
    // AM-09 §3, AM-17: the walk lands with its doors; until then the leg is declared, collected and impossible to forget.
  });
});
