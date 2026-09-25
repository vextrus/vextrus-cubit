# DWG reader accuracy on our real files: LibreDWG 0.14 against ACadSharp

Session 01, 26 Sep 2026. A `drawing-analyst` agent decoded seven real DWGs (the Sample Project's two
and five Edison files; two AC1021, five AC1032) with LibreDWG 0.13.3, LibreDWG 0.14 and ACadSharp
3.8.0 (MIT, .NET 8), and compared them entity by entity. The raw numbers and scripts are private
(`.private/work/session-01/reader/`: compare.json, compare13.json, the C# dumper, the comparers). This
file carries counts and conventions only. Licences, cost and terms: `dwg-reader-options.md`.

## Conclusions
1. **The plan review's failure case is real, and it is LibreDWG 0.13.3 on the 2007 format (AC1021),
   not an unusual writer.** On Edison's architectural file, 0.13.3 exits 0 with the right record
   count (106,571) but only 53,500 distinct handles, and 1 handle in common with ACadSharp's 95,977;
   its DXF keeps 8,578 of 29,116 LINEs and does not load in ezdxf. The other AC1021 file matched 2 of
   4,214 handles. **A count check against `dwgread` passes on this broken output**, so our prototype's
   verification method would not have caught it. AutoCAD 2021 wrote the file.
2. **LibreDWG 0.14 agrees with an independent decoder almost everywhere.** Across 282,467 shared
   entities: 0 handles missing, 0 disagreements of type, layer or inserted block. Geometry (lines,
   arcs, circles, text and insert points, polyline vertices, points, ellipses, solids, dimension
   points, hatch paths) disagrees on 6 of 319,454 values, and those 6 are real 0.14 errors. Counts per
   layer, per block definition and per inserted block name all agree.
3. **0.14's defects are narrow and known:**
   - `dwg2dxf` corrupts text containing a raw line break (201 values across 4 files); one DXF then
     opens only with `ezdxf.recover`. The `dwgread` JSON path does not have this defect.
   - 6 hatch boundaries cut short in one file (its own log warns).
   - 14 hatch pattern names lose a suffix in `dwg2dxf`.
4. **ACadSharp has its own:** it drops one INSERT with a Z scale of 0, leaves 220 polyface vertices
   unattached, returns `\U+` escapes for 8 texts, and discards the stored dimension measurement. An
   open bug (#1172) reports R2018 block inserts lost; not seen here.
5. **Dimension measurements:** every dimension in both Sample Project files (1,852) has a stored
   measurement of −1 in LibreDWG, and ACadSharp does not expose it, so it is unconfirmed. Both decoders
   agree on the definition points: the engine computes measurements from the points.
6. **Writers:** the Sample Project was saved by the newest AutoCAD writer (registry 26.0, probably
   2027); it writes an AppInfo record LibreDWG misreads, yet its entities decode perfectly. The Edison
   files come from registry 23.1–24.3.
7. **fixdxf.py repaired nothing on 0.14 output;** ezdxf's audit gives 0 errors on all seven.
8. **Cost per file:** `dwg2dxf` 0.02–0.84 s and ≤233 MB; ACadSharp 0.3–2.8 s and ≤543 MB; ezdxf
   0.4–5.8 s and ≤338 MB.

## What this means for the reader decision
LibreDWG ≥ 0.14 is accurate on every file we have, but only an independent decoder can show that for
the next file: its own `dwgread` cannot. ACadSharp, at about one second per file, is that independent
check (both decoders derive from the ODA's published specification, so a shared mistake remains
possible). Text should be read from `dwgread` JSON, or cross-read with ACadSharp, not from `dwg2dxf`.

## Not measured
The stored dimension value; MLEADER and TABLE content; spline and hatch-edge coordinates; layer
on/off/frozen/colour; xrefs; files from non-Autodesk writers; DWG versions other than AC1021 and
AC1032.
