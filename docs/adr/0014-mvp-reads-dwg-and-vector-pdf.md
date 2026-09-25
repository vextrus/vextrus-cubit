# The MVP reads DWG first and accepts vector PDFs, telling the QS what a PDF loses; scans are not accepted

DWG is the preferred input: we always ask the Developer for its consultant's DWG files (the reader is
ADR 0029). The MVP also accepts vector PDFs plotted from AutoCAD, because many Dhaka Developers hold
only those and would walk away without them. Raster images and scanned PDFs are not accepted.

**A PDF gives more Questions than its DWG, and the product says so.** Plotted SHX text becomes strokes
unless AutoCAD's "SHX text as comments" option was on; missing fonts become strokes; stacked fractions,
blocks, circles and hatches are lost or degraded; many pages are rotated. Layers survive. So:
1. **Each PDF gets an upload report:** producer; SHX comments present per page; missing or substituted
   fonts; rotated and mirrored text; images, telling a scan from a gradient fill. Without the SHX
   comments, Vextrus says the text cannot be read reliably and asks for the DWG, or a re-plot with the
   option on, giving the exact AutoCAD setting.
2. **M4's PDF finish line is a differential test:** the same set as DWG and as PDF through the same
   steps, with a loss table per step (recovered, and the extra Questions raised).
3. **The readers are pdfplumber / pdfminer.six and pypdfium2** (permissive; about 0.1 s a page).
   PyMuPDF is AGPL and not used.

Both inputs feed the same Takeoff (ADR 0007). Rejected: DWG only (a deal-breaker for PDF-only
clients, the owner's call); scanned drawings through a vision model (vision models count badly, and it
needs an LLM that ADR 0011 keeps out of the MVP).

## History
- 25 Sep 2026: decided; a PDF was thought "in some ways easier" than a DWG and to lose its layers.
- 26 Sep 2026 (owner's decision): "in some ways easier" withdrawn; upload report; differential test;
  readers chosen. Evidence: docs/research/vector-pdf-evidence.md on our four real PDFs (27–61 % of
  each DWG's strings recoverable without SHX comments, 98.8 % and 99.8 % with them; 103 of 208 pages
  rotated; all 337 layer names match the DWG); plan review C6. The owner's ruling: "Agree".
- 26 Sep 2026: milestone renumbered (PDFs are M4, with Revisions).
