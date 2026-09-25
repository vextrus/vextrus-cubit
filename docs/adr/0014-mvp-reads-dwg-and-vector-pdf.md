# The MVP reads DWG first and accepts vector PDFs; scanned drawings are not accepted

DWG is the preferred input: we always ask the Developer for its consultant's DWG files. The MVP also
accepts vector PDFs (plotted from AutoCAD), because many Dhaka Developers hold only those and would
walk away without that option. Raster images and scanned PDFs are not accepted in the MVP.

A vector PDF still carries lines, text and exact positions, but usually loses layers and blocks. In
some ways it is easier than a DWG. Each page is one sheet with its title block, which removes the
hardest first step the prototype found: segmenting a model space where every sheet sits side by side.
A properly plotted set is also organised the way the QS reads it. What a PDF loses (layers, block
names) is what the machine proposes and the QS confirms anyway (ADR 0007), so both inputs feed the
same Takeoff.

Considered: DWG only (rejected by the owner as a deal-breaker for PDF-only clients), and scanned
drawings through a vision model (rejected for the MVP: vision models count badly, and it needs an
LLM that ADR 0011 keeps out of the MVP).

The PDF library's licence must be checked. PyMuPDF is AGPL, so permissive readers come first
(pdfminer.six, pdfplumber, pypdfium2). A vector-PDF prototype runs as soon as a real vector PDF set is
available.

## Amended: a PDF gives more Questions, and says so at upload (owner's decision, 26 Sep 2026)
Measured on our four real PDFs (docs/research/vector-pdf-evidence.md; plan review C6): SHX text plots
as strokes, so only 27–61 % of each DWG's strings are recoverable as real text; AutoCAD's "SHX text as
comments" option rescues it (98.8 % and 99.8 % recall on the Sample Project) but only if it was on
when plotted; missing fonts become strokes; stacked fractions survive 2 times in 942; 103 of 208 pages
are rotated; circles become Béziers; hatches become loose strokes or small images; blocks are lost.
Layers survive, contrary to this ADR: every object carries its layer, and all 337 layer names match
the DWG. So:
1. **"In some ways easier" is withdrawn.** A PDF gives more Questions than its DWG, and the product
   tells the QS so.
2. **Each PDF gets an upload report:** producer; SHX comments present per page; missing or
   substituted fonts; rotated and mirrored text; images, telling a scan from a gradient fill. Without
   the SHX comments, Vextrus says the text cannot be read reliably and asks for the DWG or a re-plot
   with the option on, giving the exact AutoCAD setting.
3. **M4's PDF finish line (Revisions and vector PDFs) is a differential test:** the same set as DWG and as PDF through the same
   steps, with a loss table per step (recovered, and the extra Questions raised).
4. **The readers are pdfplumber / pdfminer.six and pypdfium2** (permissive; about 0.1 s a page).

The owner's ruling: "Agree".
