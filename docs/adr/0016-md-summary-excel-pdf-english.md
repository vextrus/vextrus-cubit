# The MVP gives the MD a Project Summary, exports to Excel and PDF, and is in English

The MVP has three roles:
- **the QS** edits the Takeoff;
- **the MD** reads the Project Summary and sets a Target Cost;
- **a Vextrus Engineer** works beside the client's QS during onboarding.

What leaves Vextrus:
- the Priced BOQ as Excel;
- the Priced BOQ and the Material Schedule as PDF;
- a read-only 3D link to the Building Model.

The MVP is in English only: no Bangla screens or documents.

The Excel export is non-negotiable in this market. Dhaka Developers rework BOQs in Excel, and
without an export the QS copies figures by hand and the Trace is lost. The Target Cost warning is
cheap to build, and it makes the MD's page matter while the Takeoff is still in progress. The idea
comes from docs/research/glodon-bim-2.md.

## Amended: what the Excel file carries (owner's decision, 26 Sep 2026)
A Dhaka QS checks and reworks in a measurement sheet and an abstract with live formulas; values alone
kill the rework and lose the Trace outside Vextrus (QS critic #4, docs/reviews/). The Excel file has
five sheets, cross-referenced by item number:
1. **Summary:** the Estimate's layers by trade.
2. **Abstract:** each item's quantity, Billing Unit, rate and amount as a live formula, the Benchmark
   Rate as printed and net, and the Cost Basis.
3. **Measurement:** one line per element, Nos × L × B × H (or area) = Qty in the Billing Unit, naming
   the element, its Measurement Rules and its sheet, with a link back to its Trace in Vextrus.
4. **Rate Analysis:** each item's Resources × Market Prices, with formulas.
5. **Material Schedule:** materials by floor and by stage.

The file carries the Issued Estimate's number and date. A test opens it and checks that every formula
reproduces the screen's figures to the paisa. The PDF carries the summary, the abstract and the
Material Schedule, with the measurement sheet optional. The owner's ruling: "Agree".

## Amended: which sft, and the MD's consumption checks (owner's decision, 26 Sep 2026)
"Cost per sft" named no area (QS critic #14). The Project Summary shows cost per sft on two defined
areas: the Gross Floor Area (every floor, basement and parking included, to the outside of the walls,
measured from the confirmed Building Model; Vextrus's price in ADR 0012 uses it) and the Saleable Area
(entered or confirmed by the QS, since the common-area loading varies by Developer). It adds the MD's
consumption checks per sft of Gross Floor Area (rod kg, cement bags, bricks, concrete cft), each
against a sanity range (Vextrus's default, then the Developer's past projects); a figure outside its
range is flagged, never blocked. The owner's ruling: "Agree".
