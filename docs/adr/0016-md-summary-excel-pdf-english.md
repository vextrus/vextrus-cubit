# The MD gets a Project Summary that works on a phone; exports are Excel and PDF; the MVP is in English

**Roles:** the QS edits the Takeoff; the MD reads the Project Summary and sets a Target Cost; a
Vextrus Engineer works beside the client's QS during onboarding (ADR 0034 sets how they enter).

**The Project Summary** shows cost per sft on two defined areas: the Gross Floor Area (every floor,
basement and parking included, to the outside of the walls, from the confirmed Building Model; the
area Vextrus's price uses, ADR 0033) and the Saleable Area (entered or confirmed by the QS). It carries
the MD's consumption checks per sft of Gross Floor Area (rod kg, cement bags, bricks, concrete cft),
each a sanity-range Check (ADR 0027) against Vextrus's default range, then the Developer's past
projects; a figure outside its range is flagged, never blocked. The Target Cost warning works while
the Takeoff is still in progress (ADR 0002).

**On a phone:** the Project Summary and the read-only 3D share link work at 390 px and up. Everything
the QS does (the Takeoff, the sheet, the BOQ grid, Rate Analyses) is desktop-only at 1280 px and up,
and says so plainly on a phone. The design gate adds a 390×844 walk for those two screens.

**What leaves Vextrus:** the Priced BOQ as Excel; the Priced BOQ and the Material Schedule as PDF; a
read-only 3D link. The Excel file has five sheets, cross-referenced by item number: (1) Summary, the
Estimate's layers by Trade; (2) Abstract, each item's quantity, Billing Unit, rate and amount as a live
formula, the Benchmark Rate printed and net, and the Cost Basis; (3) Measurement, one Measurement Line
per element, Nos × L × B × H = Qty, naming its rules and sheet, linked to its Trace; (4) Rate Analysis,
Resources × Market Prices with formulas; (5) Material Schedule, by floor and by Construction Stage. It
carries the Issued Estimate's number and date (ADR 0028). A test opens it and checks every formula
reproduces the screen's figures to the paisa. The PDF carries the summary, the abstract and the
Material Schedule, the measurement sheet optional.

**English only:** no Bangla screens or documents in the MVP.

Why: Dhaka Developers rework BOQs in Excel; values alone kill the rework and lose the Trace. The
Target Cost warning is cheap and makes the MD's page matter early (docs/research/glodon-bim-2.md).

## History
- 25 Sep 2026: decided.
- 26 Sep 2026 (owner's decision): what the Excel file carries. Evidence: QS critic #4
  (docs/reviews/). The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): which sft, and the MD's consumption checks. Evidence: QS critic #14.
  The owner's ruling: "Agree".
- 26 Sep 2026 (owner's decision): the MD's pages work on a phone. The owner's ruling: "Agree".
