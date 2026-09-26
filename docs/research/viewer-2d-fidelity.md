# The 2D sheet renderer: fidelity to the plot and smoothness, measured on real sets

Session 01, 26 Sep 2026. A `drawing-analyst` agent rendered three real sheets (from the Sample
Project and the Edison set) with dxf-viewer, a prototype renderer of the engine's own buffers, and
pdf.js, and scored each against the plotted PDF page. Conventions and numbers only; the code, images
and results stay in `.private/work/session-01/viewer-2d/`. The orchestrator wrote this file from the
agent's report (the harness refused the agent's write).

## Conclusions
1. **Stop using dxf-viewer as the DWG backdrop.** It drops content a QS needs: it hides every
   title-block attribute in the Sample Project (2,568 of 2,568; a group-70 flag in an embedded
   xrecord is read as "invisible"), draws no LEADER (3,233 across the Edison files) or MULTILEADER
   (406), no linetypes or lineweights, and ignores MTEXT inline fonts and bold. Its sheet scores are
   the lowest: F1 0.928 / 0.915 / 0.775.
2. **Render the engine's own buffers, per sheet (2–7 MB each), never a whole file.** Every primitive
   carries [top-level handle, nested source handle, type, layer]; hovering highlighted exactly the
   leader that was read. F1 0.951–0.972 / 0.834.
3. **Thin lines as GL_LINES, not quads:** one quad per segment cost 242 ms a frame on an Edison
   sheet; GL_LINES took 19 ms. With GL_LINES and SDF text the engine beats dxf-viewer at fit (37 vs
   51 ms and 67 vs 83 ms; 56 ms with SDF text). Quads only for lines whose plotted width is visible;
   instanced glyphs or SDF for text (glyph triangles are 90–95 % of whole-file buffers).
4. **The plot itself is the exact reference.** pdf.js, or a server-side pypdfium2 raster (34–87 ms
   per page at 3000 px), scores F1 1.000, but a full-page re-render takes 134–1,337 ms, and the page
   needs a per-sheet scale and offset to register (one Edison sheet needed scale 0.982). It fits as
   an optional underlay, not the working canvas.
5. **Picking:** a GPU id pass found a primitive for 1,800 / 1,800 samples but the sampled line itself
   only 48–92 % of the time; use a CPU R-tree over the buffers.

## Reader findings the renderer exposed
- **LibreDWG 0.14 drops the style of every ATTRIB** in the Sample Project (1,488 of 1,488 in
  structural); `dwgread` JSON shows a null style handle while the ATTDEFs keep theirs. Fix in the
  read step: inherit the style from the ATTDEF with the same tag.
- **SHX text** is 76 % of the structural and 53 % of the architectural text in the Sample Project; the
  Edison set uses almost none. The PDF plots it as strokes; every DXF renderer substitutes an outline
  font, 13–19 % narrower (range −35 % to +2 %).
- Engine prototype defects: overlapping glyph contours (the diameter sign) fill as blobs (needs
  nonzero-winding tessellation); inline bold lost under substitutes; some MTEXT wraps where AutoCAD
  did not; 198 caret-encoded line breaks (`^J`) in Edison dimension text show raw in both DXF
  renderers.

## Method
Three sheets from two real sets: an A1 1:24 structural detail, an A1 1:96 plan and an A3 beam-detail
sheet. A sheet is its title-block extents in model space, matched to its PDF page by word overlap and
sheet number. Reference: pypdfium2 at 3000 px. Screenshots at 3000 px; ink = any non-white pixel;
registration by scale-and-translation search; recall, precision and F1 within 2 px. Bench: 1500×1060
px, three 120-frame paths, render plus forced GPU finish per frame; RSS summed over Chrome's
processes (an empty page is 813 MB). Engine: one ezdxf 1.4.4 drawing pass with a custom backend
(dashes baked in, lineweight in mm, text as triangulated glyph outlines, an id per primitive).
**No GPU was available:** every WebGL figure is SwiftShader; treat frame times as relative.

## Per sheet (the three sheets in order)
| Measure | dxf-viewer 1.0.49 (MPL-2.0) | Engine: quads + glyphs | Engine: GL_LINES + SDF text | pdf.js 6.3.289 (Apache-2.0) |
|---|---|---|---|---|
| Load, ms | 730 / 582 / 1146 | 340 / 342 / 409 | 363 / – / 556 | 334 / 258 / 1818 |
| RSS, MB | 1018 / 963 / 1059 | 957 / 942 / 992 | 971 / – / 993 | 978 / 904 / 1093 |
| Pan at fit, p50 ms | 51 / 22 / 83 | 85 / 61 / 302 | 42 / – / 56 | full re-render 375 / 134 / 1337 |
| Pan at 8×, p50 ms | 31 / 16 / 51 | 48 / 34 / 161 | 27 / – / 34 | re-render at 4× 30 / 17 / 277 |
| F1, whole sheet | 0.928 / 0.915 / 0.775 | 0.951 / 0.965 / 0.834 | 0.958 / 0.972 / 0.836 | 1.000 / 1.000 / 1.000 |

Whole files (four): dxf-viewer loads 1.5–11.0 s from 3.8–39 MB of DXF and pans at 0.2–3.7 s a frame;
the engine's whole-file buffers are 58–293 MB, load in 1.9–42 s and pan at 0.9–37 s a frame, after
5–58 s of server extraction at 0.4–2.5 GB peak. Hence: per sheet only.

## Fidelity by feature
| Feature | dxf-viewer | Engine buffers | pdf.js |
|---|---|---|---|
| Title-block attributes | none drawn (parser bug) | drawn; the converter lost their style | exact |
| TTF text | one font for everything | substitute fonts | exact |
| SHX text | outline font | outline substitute | exact (plotted strokes) |
| MTEXT formatting | ignored | mostly kept; bold lost under substitutes | exact |
| Hatches | yes | yes | exact |
| Linetypes | no | yes | exact |
| Lineweights | no | yes (DWG lineweights, not the plot style) | exact |
| Leaders and multileaders | no | yes | exact |
| Nested blocks | yes | yes, with the nested handle | – |

Region F1 on a formatted notes box: 0.55 (dxf-viewer) vs 0.66 (engine); on a section with leaders:
0.87 vs 0.96.

## Font policy (proposal)
- One substitution table resolves every style font and inline font; each text run records its
  substitute, and the upload's font report lists them (plan review M9).
- Redistributable fonts only: Liberation Sans and Serif (OFL) for Arial and Times (advance width
  −0.1 % and 0.0 %) and for Swiss 721 (+2.3 %); Liberation Sans Narrow for Arial Narrow and Swiss 721
  Condensed (−4.0 %; GPL-2 with the font exception, not OFL); DejaVu Sans for Verdana (−1.2 %) and
  Tahoma (+13.6 %); a single-stroke font for SHX drawn as lines (e.g. from Hershey data), to be
  measured. Never Autodesk, Bitstream or Monotype files. A bare server's DejaVu alone is 10–29 % off.
- Fonts the sets use: the Sample Project, SHX romans, simplex, romant, isocp and TTF swissc, arial,
  arialbd; Edison, TTF arialn, swissc, swisscb, swisscl, swiss, swissl, times, arial, with inline
  Century Gothic, Tahoma, Verdana and Symbol.

## Not measured
Any GPU number; mirrored text; MSDF quality at extreme zoom; the engine's PDF reading drawn through
the same renderer; per-sheet PDF registration inside the engine; an Edison architectural sheet;
whether AutoCAD's own DXF writer embeds the same xrecord in ATTRIBs; the purpose of the PDF's Square
annotations (282 on one page; see vector-pdf-evidence.md: the SHX text comments).
