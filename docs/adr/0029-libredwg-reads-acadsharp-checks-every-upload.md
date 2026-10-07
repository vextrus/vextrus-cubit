# LibreDWG 0.14 reads every DWG; ACadSharp checks every upload

The DWG reader is LibreDWG ≥ 0.14, pinned to its newest build and run as a sandboxed subprocess:
geometry through DXF → ezdxf, text from `dwgread` JSON. ACadSharp (MIT, .NET) decodes every upload
independently, and the two are compared by handle set and by per-type and per-layer counts; a
disagreement quarantines the file and raises a Question ("this file may be misread"). The reader sits
behind an interface in `engine/read`, and every Trace records the reader and its version. APS Design
Automation and the ODA SDK are not used; the ODA SDK is bought only if the free pair fails on a
Held-out Set or a client's file.

Evidence (docs/research/dwg-reader-evidence.md, seven real files): LibreDWG 0.13.3 silently lost a
2007-format file (1 handle in common with ACadSharp out of ~96,000, and a count check against
`dwgread` passed it); 0.14 agreed with ACadSharp on all 282,467 shared entities, with 6 wrong
geometry values in 319,454; `dwg2dxf` corrupts text with raw line breaks (201 values), which the JSON
path avoids; ACadSharp costs about one second per file. Options (docs/research/dwg-reader-options.md):
APS runs in the US, bars products Autodesk judges competitive, forbids personal data (title blocks
name people); the ODA SDK costs $7,500 then $4,500 a year and ends when payment stops; ODA File
Converter is not permitted for a commercial service.

Considered: ACadSharp only in the local gate and on each new writer (the architecture critic's
preference, keeping .NET out of the image). Rejected: a known writer can still bring a new failure,
and a second second per upload is cheap. Both readers run sandboxed (ADR 0031). A dedicated
deployment's LibreDWG licence duty is in ADR 0018.

## History
- 26 Sep 2026: decided; answers plan review C5 (docs/reviews/plan-review-ledger.md). Evidence:
  docs/research/dwg-reader-evidence.md, docs/research/dwg-reader-options.md. The owner's ruling
  (26 Sep 2026): "Agree".
- 5 Oct 2026: the second reader's build changes, its role does not (ticket W317, #317). The owner's
  ruling (5 Oct 2026, session 13): "Build ACadSharp with #1205 ourselves". The dumper is built from
  ACadSharp 3.8.0's source plus the DWG half of DomCR/ACadSharp#1205 (a stored 0 INSERT scale read as
  1, as AutoCAD's AUDIT repairs it), pinned by commit, file manifest and patch hash in
  `toolchain/acadsharp-source.lock`, and by the dumper's own sha256; so the file held for a 0 scale
  agrees with no special rule. This reverses the "Hold it" ruling of 28 Sep 2026 for that one case;
  an entity the second reader cannot read still holds the file. Move to the upstream release when it
  ships.
