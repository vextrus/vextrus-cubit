# What a vector PDF of a real Dhaka Drawing Set carries, compared with its DWG

Session 01, 26 Sep 2026. Question: ADR 0014 accepts vector PDFs and says a PDF "still carries lines,
text and exact positions" and is "in some ways easier" than a DWG. An outside review disputes this.
We tested each of the review's claims on the two real sets we hold as both PDF and DWG. The drawings
and all derived work stay under `.private/`. This file holds conventions and counts only.

## Conclusions (worst first)

1. **Most text in these PDFs is not text: it is drawn as strokes.** Every string set in an SHX font
   (5,703 on the Sample Project sheets) plotted as strokes. None of it can be extracted as text.
   The same happened to TrueType text whose font was missing on the plotting PC (Edison set). Share
   of the DWG's strings recoverable as real PDF text: **61 % and 38 %** (Sample Project architecture
   and structure), **40 % and 27 %** (Edison architecture and structure).
2. **What rescues it is an AutoCAD side channel.** AutoCAD's PDF driver can write each SHX string as
   an invisible "AutoCAD SHX Text" comment (a Square annotation holding the string and a box). All
   four PDFs have them: 1,333, 4,364, 5,133 and 4,868 comments. With them, text recall at the right
   position is **98.8 % and 99.8 %** on the Sample Project. The comments exist only if the plotting
   PC had the SHX-as-comments option on. A PDF plotted without it, or flattened or re-saved by a tool
   that drops annotations, loses most of its text. **This is the first thing to check at upload.**
3. **Edison shows how a PDF degrades.** Two Office TrueType fonts used in the DWG (one set by text
   style, one only by inline MTEXT codes) are absent from the PDF. AutoCAD drew their text in a
   substitute SHX font: it overflows its title-block cells and reaches the reader only through
   comments. In the comment channel the diameter sign is dropped (564 strings on Edison structure).
   Stacked fractions lose their slash and their order (for example, whole inches then the numerator
   and denominator glued after the inch mark). In real text the numerator and denominator arrive as
   separate runs. Of the dimension strings with a stacked fraction, **2 of 942** (architecture) and
   **3 of 635** (structure) came through intact. Intact recall on Edison is 67.5 % and 72.7 %. About
   8–15 points more are recoverable by decoding fractions and symbols. The rest is not explained
   (see "Still unmeasured").
4. **Layers survive; ADR 0014 is wrong to say they are usually lost.** Every page object carries an
   optional-content mark. Each page lists its layers (OCGs) in its resources, and every OCG name
   equals a DWG layer name: 51/51, 35/35, 136/136, 115/115. But no document declares them in its
   catalog, so a viewer shows no layer panel. A reader must take them from the page resources.
5. **Pages carry a rotation attribute, and a naive reader breaks on it.** `/Rotate 270` is set on
   11 of 29, 0 of 38, 63 of 84 and 29 of 57 pages; the page box is then portrait with rotated
   content. pdfplumber's default word extraction fragmented 484 of 3,505 strings (13.8 %) on the
   Sample Project architecture set, all of them on rotated pages. Grouping characters by the
   direction in their text matrix fixed all but one.
6. **Block identity, dimension entities, hatches, true arcs and handles are gone, as the review
   says.** Every page is a flat list of paths and text: no form XObjects or other nesting. A circle
   is a closed path of four Béziers (391 such paths for 391 DWG circles on one set; 7,757 for 7,731
   on another), so its exact centre and radius can be fitted back. A pattern hatch is loose stroke
   segments. A solid hatch is a filled path with no identity. A dimension is text plus lines plus
   filled arrowheads. Its text does survive: 97.6 % and 99.9 % intact on the Sample Project.
7. **A gradient hatch becomes a raster image.** The Edison architecture DWG has 14 gradient hatches;
   its PDF has 14 embedded JPEG images of 183 × 183 px on 7 pages, rendered in the hatch's place. No
   other PDF has any image.
8. **One sheet per page mostly holds, and the title block is readable.** Sample Project pages
   versus DWG title blocks: 29 v 27 and 38 v 39. Every page aligned to one model-space window at a
   single scale (4 plot scales per set). Title-block attributes extracted intact on 99.3 % and 99.9 %
   of strings. Page-to-sheet is still not one-to-one: 2 title blocks were covered by two pages and
   2 by none. So the sheet list stays a Confirmation.
9. **Mirrored text extracts reversed, but it is rare.** One string (23 characters) in 208 pages.
   pdfplumber returns it letter-reversed; the content-stream order is correct.
10. **Speed is not a problem.** pypdfium2 opens and renders a page at 150 dpi in 0.06 s median
    (0.15 s max). pdfplumber parses a page in 0.09–0.75 s median (3.4 s max, on the densest Edison
    page with about 18,000 path objects).

**Verdict on ADR 0014.** "Lines, text and exact positions" holds only when the plot carried SHX
comments and every TrueType font was present on the plotting PC. Then text is as good as the DWG's
(99 %) and each page is one sheet, as the ADR hopes. When either fails, a third to three quarters of
the text is strokes a parser cannot read. "Usually loses layers" is wrong for AutoCAD-plotted PDFs.
Blocks, dimensions, hatches and arcs are lost as the review says. Arcs are recoverable by fitting;
blocks, hatches and dimension semantics must be re-derived.

## What the product must detect at upload and tell the QS

1. **Producer and creator** (plotter driver and AutoCAD version, or a merge or re-save tool). A
   merged or re-saved PDF may have lost annotations or layers. Say which.
2. **SHX comments present, per page.** Their count against the page's stroke-drawn text. If a page
   has vector geometry but few characters and no SHX comments, tell the QS its text is drawn as
   strokes, and ask for the DWG or a re-plot with SHX text kept as comments. Do not guess the text.
3. **Font set.** List the embedded fonts, and flag Type3 or non-embedded fonts (none here). A missing
   TrueType font cannot be seen from the PDF alone. Its signature is SHX-comment text in places
   where the rest of the set uses real text, plus overflowing title-block text. Mark text from the
   comment channel as lower confidence.
4. **Page rotation and text direction.** Apply `/Rotate`, and group characters by their matrix
   direction. Detect mirrored characters (negative determinant) and read them in stream order.
5. **Layers.** Read OCG names from each page's resources, even when the catalog has none. Say
   whether layers are present: they drive the layer mapping the QS confirms.
6. **Raster content.** Count images and their area. Small images inside the drawing are gradient
   fills and can be ignored. A page mostly covered by one image is a scan and is refused (ADR 0014).
7. **Symbols and fractions.** Decode `%%C`, `%%D` and `%%P` in comments; the comments carry these raw
   codes: 922 of them on one set. Repair stacked fractions in feet-inch text. Raise a Question when a
   size string cannot be parsed.
8. **Page ↔ sheet.** Treat each page as a sheet candidate, read its title block, and have the QS
   confirm the sheet list. The same sheet can be plotted twice, or a sheet not at all.

## Method

- Sets: the Sample Project (architecture and structure; PDFs plotted from the DWGs we hold on
  26 Sep 2026 by AutoCAD 2027's "DWG To PDF" driver, `pdfplot18.hdi`) and the Edison set
  (architecture and structure PDFs whose producer is `pypdf`: pages merged, with no creation date
  or creator, so their plotter and DWG revision are unknown).
- DWGs converted with LibreDWG 0.14 `dwg2dxf`, repaired by the prototype's `fixdxf.py`, read with
  ezdxf. Texts were collected from TEXT, MTEXT, visible ATTRIBs, and the text inside inserts,
  dimensions and leaders, exploded to world positions (3,905 / 7,614 / 14,221 / 7,492 strings).
- PDFs read with permissive libraries only: pdfminer.six and pdfplumber 0.11.10 (MIT) and pypdfium2
  5.x (Apache/BSD). PyMuPDF was not used.
- Text recall: each page was registered onto the DWG by RANSAC over strings present in both (a
  similarity transform, rotation in 90° steps). DWG strings inside the page were then classed:
  intact (same normalised string within a text-size radius, from real text or an SHX comment),
  split, merged, elsewhere on the page, or missing. Normalising removes whitespace, folds case and
  maps `%%C`/Ø, `%%D`/° and `%%P`/±.
- Scripts and outputs: `.private/work/session-01/pdf/`, with the full detail in its `REPORT.md`.

## Per-document tables

| | SP architecture | SP structure | Edison architecture | Edison structure |
|---|---|---|---|---|
| Producer | AutoCAD 2027 DWG To PDF | same | pypdf (merged) | pypdf (merged) |
| Pages; sheets in DWG | 29; 27 title blocks (model space) | 38; 39 title blocks | 84; frames in model space plus one layout with 19 viewports | 57; frames in model space |
| Page size | 29 × A1 | 38 × A1 | 84 × A3 | 57 × A3 |
| Pages with `/Rotate 270` | 11 | 0 | 63 | 29 |
| Characters (pdfplumber) | 28,887 | 41,443 | 55,347 | 27,098 |
| SHX comments | 1,333 | 4,364 | 5,133 | 4,868 |
| Fonts (all Type0, embedded; Type3: 0) | 3 | 3 | 7 | 9 |
| Layers (OCG names = DWG layers) | 51 = 51 | 35 = 35 | 136 = 136 | 115 = 115 |
| Catalog `/OCProperties` | absent | absent | absent | absent |
| Raster images | 0 | 0 | 14 (gradient hatches) | 0 |
| Path objects | 57,954 | 132,074 | 1,593,457 | 770,316 |
| Bézier curves / line segments | 2,226 / 155,758 | 2,786 / 472,730 | 11,339 / 2,635,776 | 33,155 / 2,530,988 |
| Closed 4-Bézier paths / DWG circles | 391 / 391 | 649 / 776 | 1,205 / 1,823 | 7,757 / 7,731 |
| Form XObjects (blocks) | 0 | 0 | 0 (28 image XObjects) | 0 |
| Pages registered onto the DWG | 29/29 | 38/38 | 84/84 (27 only by title block) | 52/57 |
| DWG strings on registered pages | 3,512 | 7,076 | 11,508 (model-space pages) | 7,082 |
| Intact, real text only | 61 % | 38 % | 40 % | 27 % |
| Intact, real text + SHX comments | **98.8 %** | **99.8 %** | **67.5 %** | **72.7 %** |
| … + fraction and symbol decoding (upper bound) | 99.1 % | 99.8 % | 75.1 % | 87.3 % |
| pdfplumber parse per page, median / max | 0.09 / 0.43 s | 0.23 / 0.56 s | 0.75 / 3.35 s | 0.59 / 2.86 s |
| pypdfium2 load + render at 150 dpi, median / max | 0.06 / 0.11 s | 0.07 / 0.12 s | 0.06 / 0.15 s | 0.06 / 0.13 s |

Which channel carries a DWG string, by the DWG font kind (registered model-space pages):

| | SHX-font strings: real text / SHX comment | TrueType strings: real text / SHX comment |
|---|---|---|
| SP architecture | 0 / 1,315 of 1,339 | 2,156 of 2,173 / 0 |
| SP structure | 0 / 4,362 of 4,364 | 2,701 of 2,712 / 0 |
| Edison architecture | (no SHX styles) | 4,632 / 3,140 of 11,508; the narrow-font style and the style whose MTEXT overrides fonts inline: 114 / 2,973 of 5,177 |
| Edison structure | (no SHX styles) | 1,891 / 3,256 of 7,082; the missing narrow font: 188 / 1,891 of 3,216 |

(One Sample Project style named after a built-in SHX font plotted as real TrueType text, 677 of
682 strings. AutoCAD evidently substituted it; the table counts it by the text channel observed.)

## The review's claims, one by one

| Claim | Verdict here | The number |
|---|---|---|
| SHX text plots as strokes | **Confirmed** | 0 of 5,703 SHX-font strings extractable as text; 5,677 recovered only from SHX comments |
| A TrueType font missing on the plotting PC plots as outlines | **Confirmed in substance** (drawn in a substitute SHX font as strokes, not as glyph outlines) | Two Office fonts have 0 characters in the PDF. Of the strings styled in them, 2,973 of 5,177 and 1,891 of 3,216 arrive only as comments |
| Mirrored text extracts letter-reversed | **Confirmed, rare** | 1 string, 23 characters, in 208 pages |
| Stacked fractions and dimension text split | **Confirmed for stacked fractions** | Edison: 2/942 and 3/635 intact. SP (fractions inline, not stacked): 108/110, 318/319. Other dimension text: SP 97.6 % / 99.9 % intact |
| Gradient hatches become raster images | **Confirmed** | 14 gradient hatches → 14 images, 183 × 183 px |
| Pages carry a rotation attribute | **Confirmed** | 103 of 208 pages at 270°; default word extraction broke 13.8 % of one set's strings |
| A window plot may be cropped | **Not observed** | 0 DWG strings just outside a page edge on 67 SP pages. Edison strings past the edge are substituted-font overflow; the frame is not cut (checked by eye) |
| Loses block identity | **Confirmed** | 0 nested objects; DWGs have 72–1,546 top-level inserts |
| Loses dimension entities | **Confirmed** (the dimension text survives) | 0 dimension objects; SP dimension strings 97.6 % / 99.9 % intact |
| Arcs and circles become Béziers | **Confirmed** (the geometry is recoverable) | 391 closed 4-Bézier paths for 391 DWG circles |
| Loses hatches | **Confirmed** | pattern hatches are loose strokes; solid hatches are anonymous filled paths |
| Loses handles | **Confirmed** | no object identity in the PDF |
| (ADR 0014) Usually loses layers | **Refuted** for AutoCAD-plotted PDFs | 337 of 337 OCG names equal DWG layers; 100 % of page objects marked |

## Still unmeasured

- PDFs from other producers: a PC-3 other than DWG To PDF, print-to-PDF drivers, Bluebeam, or PDFs
  plotted with SHX comments off. These are what many Developers will actually hold. None tested.
- Edison: which DWG revision its PDFs came from, and the cause of 3.8–15.4 % of strings found only
  elsewhere on the page and 8.6–9.3 % missing. It may be revision drift, dimension blocks out of
  date in the DWG, or error in our position estimate for multi-line MTEXT. Not separated.
- Geometry recall: walls, columns and beams as paths against the DWG entities. Only text and circles
  were measured.
- Whether OCG names stay useful after a PDF passes through merge or print tools.
- There is no Vextrus PDF reader yet. Every number here comes from throwaway scripts, not the
  product.
