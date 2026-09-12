"""The sheet plan — what the 26 sheets are, on what paper, at what scales, with which traps
(E-fixture §3.4, §3.7). sheets.py composes exactly this roster; validate/ checks it against
traps.json. Identity, layer profile and the size budget live here so no composer restates them.

Everything named here is fictional. Nothing — no name, title block, geometry or text — comes from
the reference set the founder lent for notation habits (FOUNDER'S LAW 1).
"""

from __future__ import annotations

FIXTURE = "F-RCC6-BNBC"

#: The Dhaka title block (fictional consultant, client, project, RAJUK reference).
IDENTITY = {
    "consultant": "MEGHNA STRUCTURAL CONSULTANTS LTD.",
    "consultant_address": "FLAT 4B, HOUSE 27, ROAD 9, SECTOR 6, UTTARA MODEL TOWN, DHAKA-1230",
    "consultant_phone": "+880 1XXX 000 000 / +880 2 4890 0000",
    "client": "M/S. PADMA HOMES LTD.",
    "project": "PROPOSED G+6 STORIED RESIDENTIAL BUILDING",
    "project_bn": "প্রস্তাবিত ৬ তলা আবাসিক ভবন",  # T-BENGALI (DXF only; PDFs carry the English line)
    "site": "PLOT 23, ROAD 7, BLOCK C, BASHUNDHARA R/A, DHAKA",
    "rajuk_ref": "RAJUK/BAP/2026/0417",
    "job_no": "MSC-2026-041",
    "designed": "S.R.",
    "drawn": "M.H.",
    "checked": "A.K.",
    "approved": "T.I.",
    "date": "12-08-2026",  # a fixed authored date, never the clock (§3.9)
}

#: The revision table every sheet carries (the C4 3F–4F cloud is REV B; T-REV-CLOUD on S-11).
REVISIONS = [
    ("A", "05-07-2026", "ISSUED FOR RAJUK APPROVAL"),
    ("B", "12-08-2026", "C4 3RD-4TH BARS REVISED; ISSUED FOR CONSTRUCTION"),
]

#: Office layer profile (a Dhaka habit: mixed case, draftsman-flavoured, a frozen obsolete layer and
#: bound-xref layers). The key is the composer's name; the value is (DXF layer name, colour index).
LAYERS = {
    "S-GRID": ("Grid", 8),
    "S-GRIDC": ("Grid Circle", 8),
    "S-GRIDT": ("Grid text", 7),
    "S-COLS": ("Column", 1),
    "S-COLR": ("Column Rod", 6),
    "S-BEAM": ("Beam Line", 4),
    "S-BEAMH": ("Beam Hidden", 4),  # HIDDEN linetype (T-LINETYPE-HIDDEN)
    "S-SLAB": ("Slab", 5),
    "S-ROD": ("Rod-1", 6),
    "S-ROD2": ("Rod-2", 2),
    "S-STIR": ("Rod-Stirrup", 3),
    "S-FDN": ("Foundation", 3),
    "S-WALL": ("Wall", 1),
    "S-HATCH": ("Hatch", 9),
    "S-TEXT": ("Text-1", 7),
    "S-TEXT2": ("Text-2", 7),
    "S-DIMS": ("Dimension", 6),
    "S-DIMI": ("Inches Dimension", 6),
    "S-LINE": ("0", 7),
    "S-TITLE": ("TITLE", 7),
    "S-SHEET": ("Sheet", 7),
    "S-REV": ("Revision", 1),
    "S-IMAGE": ("Image", 7),
    "S-ARROW": ("Arrow", 7),
    "Defpoints": ("Defpoints", 7),
    "S-OLD": ("OLD-SCHEME-REV0", 8),  # frozen (T-LAYER-FROZEN)
    "X-WALL": ("ARCH-PLAN$0$WALL", 8),  # bound xref (T-XREF-BOUND)
    "X-DOOR": ("ARCH-PLAN$0$DOOR", 8),
    "X-WIN": ("ARCH-PLAN$0$WINDOW", 8),
}
FROZEN_LAYERS = ("OLD-SCHEME-REV0",)

#: (number, title, paper, scales, kind, traps). `kind` ∈ plan | detail | schedule | notes | cover |
#: section | bbs — plans carry a north arrow and a key plan; everything carries the title block
#: and the revision table.
SHEETS: list[tuple[str, str, str, str, str, list[str]]] = [
    ("S-00", "COVER, DRAWING INDEX & KEY PLAN", "A2", "N.T.S.", "cover", ["T-BENGALI", "T-IMAGE-LOGO"]),
    ("S-01", "GENERAL NOTES (1 OF 2)", "A2", "N.T.S.", "notes", ["T-NOT-FC-PSI", "T-NOT-FY", "T-NOT-COVER", "T-MTEXT-CODES"]),
    ("S-02", "GENERAL NOTES (2 OF 2) & LAP/DEVELOPMENT TABLE", "A2", "N.T.S.", "notes", ["T-NOTE-OVERRIDE"]),
    ("S-03", "TYPICAL REINFORCEMENT DETAILS", "A2", "N.T.S.", "detail", []),
    ("S-04", "PILE LAYOUT PLAN", "A1", "1:100", "plan", []),
    ("S-05", "PILE DETAILS & PILE SCHEDULE", "A2", "1:20, 1:50", "detail", ["T-NOT-MSWIRE"]),
    ("S-06", "PILE CAP LAYOUT & SCHEDULE", "A1", "1:100", "plan", ["T-SCHED-NORULES"]),
    ("S-07", "PILE CAP DETAILS", "A2", "1:25", "detail", ["T-NOT-HASH", "T-BLOCK-NESTED"]),
    ("S-08", "GRADE BEAM LAYOUT & GF SLAB-ON-GRADE", "A1", "1:100", "plan", []),
    ("S-09", "GRADE BEAM DETAILS (LONG SECTIONS)", "A1", "1:50", "detail", ["T-DIM-SUFFIX"]),
    ("S-10", "COLUMN LAYOUT PLAN", "A1", "1:100", "plan", ["T-NOT-FTIN", "T-TEXT-OVERLAP", "T-BLOCK-ATTRIB", "T-DUP-COLUMN", "T-DIM-OVERRIDE"]),
    ("S-11", "COLUMN SCHEDULE", "A1", "N.T.S.", "schedule", ["T-NOT-PCTC", "T-NOT-SIZE-IN", "T-NOT-RANGE-GF3", "T-SCHED-MERGED", "T-SCHED-TWO-TEXTS", "T-REV-CLOUD"]),
    ("S-12", "COLUMN DETAILS", "A2", "1:20", "detail", ["T-DIMLFAC"]),
    ("S-13", "1ST FLOOR BEAM LAYOUT", "A1", "1:100", "plan", ["T-TEXT-ROTATED", "T-XREF-BOUND", "T-LINETYPE-HIDDEN", "T-KEYPLAN"]),
    ("S-14", "TYPICAL FLOOR BEAM LAYOUT (2ND TO 6TH FLOOR)", "A1", "1:100", "plan", ["T-NOT-RANGE", "T-LAYER-FROZEN"]),
    ("S-15", "ROOF & STAIR ROOF BEAM LAYOUT", "A1", "1:100", "plan", []),
    ("S-16", "BEAM DETAILS (1 OF 3) - 1ST FLOOR", "A1", "1:50", "detail", ["T-NOT-ST-EXT", "T-LEADER-FAR"]),
    ("S-17", "BEAM DETAILS (2 OF 3) - TYPICAL", "A1", "1:50", "detail", ["T-NOT-PCTC-LOWER", "T-SCHED-CONTD"]),
    ("S-18", "BEAM DETAILS (3 OF 3) - ROOF & SCHEDULE", "A1", "1:50", "schedule", ["T-NOT-TY", "T-NOTE-VS-SCHED"]),
    ("S-19", "1ST FLOOR SLAB REINFORCEMENT PLAN", "A1", "1:100", "plan", ["T-NOT-UNICODE", "T-XREF-UNRESOLVED", "T-SLEEVE-BELOW"]),
    ("S-20", "TYPICAL SLAB REINFORCEMENT PLAN", "A1", "1:100", "plan", ["T-NOT-MOJIBAKE", "T-NOT-RANGE-UNSTATED", "T-GAP-OUTLINE"]),
    ("S-21", "ROOF, STAIR ROOF & PARAPET", "A1", "1:100, 1:20", "plan", []),
    ("S-22", "STAIR DETAILS", "A1", "1:50, 1:20", "detail", ["T-NOT-FTIN-STACK", "T-RISER-ROUNDED"]),
    ("S-23", "LIFT CORE & SHEAR WALL DETAILS", "A1", "1:50", "detail", []),
    ("S-24", "OVERHEAD WATER TANK & UGWR / SEPTIC TANK", "A1", "1:50", "detail", []),
    ("S-25", "LINTEL & SUNSHADE SCHEDULE, BUILDING SECTION", "A1", "1:100", "section", ["T-NOT-LEVEL", "T-SCHED-ATTRIB"]),
    ("S-26", "BAR BENDING SCHEDULE (SAMPLE: PC3, 2B7, SLAB S3)", "A3", "N.T.S.", "bbs", ["T-BBS-TOTAL"]),
]

#: Document-level traps ("sheet": "*"): the file that is the evidence and the anchor that IS the
#: trap (F2-7). A trap whose evidence is an entity carries that entity's live handle; one whose
#: evidence is a header variable, a file or a line carries `handle: null` and the anchor names it
#: (validate/traps.py verifies each anchor against the written bytes).
DOCUMENT_TRAPS = {
    "T-INSUNITS-0": {"file": "rcc6-bnbc.dxf", "anchor": {"header": "$INSUNITS", "value": 0}},
    "T-FRAMES-MODELSPACE": {
        "file": "rcc6-bnbc.model.dxf",
        "anchor": {"layout": "SHEET", "entity": "the frames set's caption TEXT (the one TEXT the twin has over the paper set)"},
    },
    "T-PDF-SHX": {"file": "rcc6-bnbc.shx.pdf", "anchor": {"file": "rcc6-bnbc.shx.pdf", "evidence": "0 text objects on every page"}},
    "T-RASTER": {"file": "raster/", "anchor": {"file": "raster/", "evidence": "r1..r4 subsets and rcc6-bnbc.r2.pdf"}},
    "T-DXF-MALFORMED": {
        "file": "rcc6-bnbc.libredwg-r2000.dxf",
        "anchor": {"file": "rcc6-bnbc.libredwg-r2000.dxf", "line": "MALFORMED_LINE", "dropped_lines": "MALFORMED_DROPPED"},
    },
}

#: Output roster (relative to fixtures/rcc6-bnbc/). Wave A's six JSON files stay as they are.
OUTPUTS = {
    "rcc6-bnbc.dxf": "paper-layout set: 26 layouts, VIEWPORTs at 1:100/1:50/1:20/1:25, R2004, $INSUNITS 0",
    "rcc6-bnbc.model.dxf": "model-space-frames set: 26 ×100 frames in model space, ×5/×2 details with DIMLFAC, one layout with a single VIEWPORT",
    "arch-plan.dxf": "the xref target (walls/doors/windows on layers WALL/DOOR/WINDOW); bound into S-13 as ARCH-PLAN$0$…, referenced unresolved from S-19",
    "rcc6-bnbc.libredwg-r2000.dxf": "T-DXF-MALFORMED: an R2000 DXF in LibreDWG's spelling with one mis-paired tag line inside a DIMENSION and an 'Embedded Object' MTEXT column block",
    "rcc6-bnbc.dwg": "minted from rcc6-bnbc.dxf by dxf2dwg under the DWG profile (named losses in sanity.json)",
    "rcc6-bnbc.model.dwg": "minted from rcc6-bnbc.model.dxf",
    "rcc6-bnbc.pdf": "vector PDF, TrueType text (Vera from the pinned reportlab wheel), mixed A1/A2/A3 pages",
    "rcc6-bnbc.shx.pdf": "vector PDF, Hershey-simplex stroked text, no text layer",
    "raster/": "R1–R4 (see RASTER)",
    "notation.corpus.json": "every drawn string with its parser family, sheet, handle and authored fact",
    "sanity.json": "per (space, type) tally for both DXFs, DWG expected census + named losses, PDF/raster expected losses",
    "manifest.json": "sheets, sizes, outputs with sha256, generator modules with sha256 (sorted), raster params",
}

#: Raster policy (FOUNDER'S LAW 4: ≤ +50 MB; PNG only for a 6-sheet subset; JPEG for scans/photos).
RASTER = {
    "subset": ["S-01", "S-10", "S-11", "S-17", "S-20", "S-26"],  # mixed A2/A1/A1/A1/A1/A3
    "R1": {"dpi": 300, "format": "PNG", "sheets": "subset", "what": "clean render, greyscale"},
    "R2": {
        "dpi": 200,
        "format": "JPEG q70",
        "sheets": "subset as JPEG + full set as one DCT raster PDF",
        "what": "scan: skew 1.2–1.8°, illumination gradient, blur σ 0.6, salt-pepper, consultant stamp over a schedule cell, signature, fold crease, punch holes",
    },
    "R3": {"dpi": 150, "format": "JPEG q60", "sheets": "subset", "what": "photocopy: binarised, dilated/eroded strokes, halftone noise, cropped title-block edge"},
    "R4": {"dpi": 150, "format": "JPEG q60", "sheets": "subset", "what": "phone photo: perspective keystone, vignetting, colour cast, JPEG"},
    "seed": 20260912,
    "budget_mb": {"corpus_total": 45, "rasters_total": 25, "single_file": 8},
}

#: Model-space-frames set: a sheet frame is the paper scene × FRAME_SCALE; a 1:100 view sits at
#: 1:1 inside it; a 1:S detail sits at ×(100/S) with DIMLFAC S/100 (T-DIMLFAC on S-12: ×5, 0.2).
FRAME_SCALE = 100


def sheet_numbers() -> list[str]:
    return [s[0] for s in SHEETS]


def traps_on(number: str) -> list[str]:
    return next(s[5] for s in SHEETS if s[0] == number)
