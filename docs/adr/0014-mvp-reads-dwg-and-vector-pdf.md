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
