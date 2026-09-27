# Session 02: the final grill — the owner's rulings, one question at a time

Session 02 (27 Sep 2026) grills what Vextrus is, proves it on the Sample Project with prototypes, and
finalises the plan (brief: docs/handoff/session-02-prompt.md). Each entry gives the question, the
recommendation, the owner's ruling in their words, and where the ruling is written. The ADRs,
`CONTEXT.md` and the specs carry the decisions; this file is the trail.

## Q1. What "live" means in the live model (27 Sep 2026)
**Asked.** Our research says Dhaka Developers hand flats over and "do not run the buildings, so O&M is
not their business" (docs/research/glodon-bim-2.md §7). Options: A, live = as designed only; B, one
identity for each Element across three phases (as designed from the drawings, Revisions and prices,
filled by the MVP; as built, filled by cost control; as maintained, filled at handover or for
buildings the Developer keeps), the data carrying the phase from M0 and the construction facts known
at design time (Construction Stage, casting stage, mix, grade, Rebar Basis) filled from M1; C, B plus a
starter O&M set from Vextrus defaults in M2.
**Recommended.** B: a real meaning for "digital twin" on the Developer's own chain, almost no cost now,
and no invented O&M numbers in front of the MD.
**The owner's ruling.** "Agree with B. And yes, now a days lots of Dhaka Developers we know run
after-sales or facility management for their buildings, though all developers are not doing that but
if we offer "as maintained" we will find buyers."
**Consequences.** The owner's first-hand knowledge overrides glodon-bim-2.md §7 on O&M (to be noted
there). The data spine carries the phase from M0 (Q2 onwards settles how); the MVP fills "as designed";
"as maintained" has buyers, so it is a module to sequence after cost control, not a maybe.
Written into: this file; `CONTEXT.md` and a new ADR once the name is settled (Q2).

## Q2. What we call it (27 Sep 2026)
**Asked.** A, keep "Building Model" ("live" in marketing only); B, rename it the "Live Model"
everywhere (glossary, ADRs by amendment, screens, the code module); C, a coined name. The three phases
named **Life Phase** (As designed, As built, As maintained), since "phase" and "stage" alone are taken.
"Digital twin" kept off screens and documents until As built data flows.
**Recommended.** B with Life Phase and the digital-twin rule.
**The owner's ruling.** "Agree with B, Live Model and Life Phase"
**Written into.** `CONTEXT.md` (Live Model replaces Building Model; Life Phase added); ADR 0035 (Q1
and Q2). The sweep of "Building Model" through the other documents is done when they are levelled
(finish line 3).

## Q3. Who reads the Live Model in the MVP (27 Sep 2026)
**Asked.** Today's readers are the QS, the MD and procurement. Candidates: marketing (presentation
mode on the existing share link), a buyer-facing flat view (needs an Apartment family), site engineers
(As built, cost control), after-sales / facility management (As maintained).
**Recommended.** The MVP serves the QS, the MD, procurement and marketing through presentation on
the share link (no new role, no money); the rest come later with their modules; the Apartment family
is sketched in the data but not read in the MVP.
**The owner's ruling.** "Agree with your recommendation on Q3"
**Written into.** ADR 0035 (its readers); ADR 0016 (what leaves Vextrus: the share link's
presentation) and the M2 spec when they are levelled.

## Q4. One building or several per Project (27 Sep 2026)
**Asked.** A, one building per Project as planned (data-model §7); B, cut the seam now: a Project holds
a Site and one or more Buildings, each with its own storeys, grid, Live Model, Gross Floor Area and
price, M0 creating one Building automatically; C, B plus multi-building reading in M1–M2.
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q4, on reply of your question: the Developers we'd onboard
first have a multi-building project on their books are low but they are the most premium client whom
we priorities most."
**Consequences.** Multi-building reading needs an early milestone slot, set in the MVP line (tree
item 6), because the clients who need it are the ones prioritised.
**Written into.** ADR 0036; `CONTEXT.md` (Project, Building, Site; Drawing Set per Project).

## Q5. What one Element is (27 Sep 2026)
**Asked.** A column is one Element per Storey Band today (`col|B/2|GF..3F`), but each floor is cast
separately, and a Revision that moves a band boundary reads as removed plus new. A, keep the band
Element with (Element × storey) sub-rows; B, one Element per physical piece (a column per storey), the
Storey Band a fact and the QS's group; C, per casting pour.
**Recommended.** B: what is cast, inspected and maintained; Revisions report the true change; the
QS's screen is unchanged; pours are site facts recorded under B later if needed.
**The owner's ruling.** "Agree with B on Q5"
**Written into.** `CONTEXT.md` (Element, Storey Band); ADR 0015 (identity per family). The data model
and M1 spec's identity rules follow when levelled.

## Q6. When the site differs from the drawings (27 Sep 2026)
**Asked.** C2 at B/2, 5th floor, drawn 12″×20″, cast 14″×20″. A, As built overwrites; B, values
layered by Life Phase, nothing overwrites (As designed only from Confirmation; As built and As
maintained by recorded acts naming who, when and on what evidence; the Priced BOQ measures As
designed; a difference beyond tolerance is a Deviation); C, a separate model per phase.
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q6, agree on Deviation joins the glossary: "an As built or As
maintained value that differs from its As designed value beyond a tolerance; shown, never absorbed"."
**Written into.** ADR 0035; `CONTEXT.md` (Deviation). docs/architecture.md's "only the confirm
service writes" becomes "only the confirm service writes As designed" when levelled.

## Q7. What cost an Element carries (27 Sep 2026)
**Asked.** An Issued Estimate froze only per BOQ Item and per storey, so an Element's issued cost was
lost. A, as now; B, issuing also freezes the Measurement Lines (Element, BOQ Item, quantity, frozen
rate), so each Element has a working cost (on read) and an issued cost per Issued Estimate; C, cost
stored live on the Element (breaks ADR 0031).
**Recommended.** B: the per-Element budget cost control needs, and every issued figure reproducible.
**The owner's ruling.** "Agree with B on Q7"
**Written into.** ADR 0028; `CONTEXT.md` (Issued Estimate). data-model §3.5 gains the frozen lines
when levelled.

## Q8. The default allowances' reference building (27 Sep 2026)
**Asked.** The drafts (tax-and-allowances.md §B, all Low) are arithmetic on one assumed G+9 building;
eight assumptions to mark ✓ or correct (floor plate, columns and core, beams, piles, walls and bricks
≈ 10 per sft, ceiling plaster, windows/doors/tanks, two researcher's Rebar Ratios).
**Recommended.** Accept as Vextrus's starting defaults, Low, replaced by the Developer's past projects;
the Sample Project's measured consumption to be set beside them.
**The owner's ruling.** "Agree with your recommendation on Q8, all ✓"
**Written into.** docs/specs/bd-defaults.md (Allowances per Takeoff Step); ADR 0002 history.

## Q9. The tax layer's facts of practice (27 Sep 2026)
**Asked.** Six facts (tax-and-allowances.md, "For the owner to verify"): Labour Contracts quoted net;
S004.00 at 10 %, not S072.00; no input credit; AIT on the bill net of VAT; Market Prices entered gross;
utility connections inside the Estimate, RAJUK/design fees, land, registration and sales VAT outside.
**Recommended.** ✓ all six; drop "AIT to be confirmed from NBR" (FY 2025-26 primary; FY 2026-27
Medium), each rate as dated data.
**The owner's ruling.** "Agree with your recommendation on Q9, all ✓"
**Written into.** ADR 0006 history; the M2 spec's "pending NBR" lines go when levelled.

## Prototype judged: the whole building, read and live (port 5301, 27 Sep 2026)
**The owner's words.** "yes it's good as the first prototype, went through most of it as I could now,
liked most of it but the 3D functionality and features are lacking here than the first session 3D
prototype we created, hopefully this is not the final prototype."
**Taken as.** The read (all fourteen steps, 3,450 Elements, 45 Questions) is accepted as a first
prototype; its viewer is an inspector, not the destination. The viewer-tools prototype keeps every
session-01 3D capability and adds the tools, on the full read.

## Q10. The MEP template, the Estimate's layers, the consumption ranges (27 Sep 2026)
**Asked.** The MEP and site-works ৳/sft defaults and ranges; preliminaries 6 %, contingency 5 %; the MD's
consumption ranges for cement, concrete and bricks at ±15 % around the reference points (rebar 4.5–6
already set). All Low.
**Recommended.** ✓ as drafted; the priced prototype sets the Sample Project against each.
**The owner's ruling.** "Agree with your recommendation on Q10, all ✓"
**Written into.** docs/specs/bd-defaults.md.

## Q11. How consultants, contractors and site engineers get in (27 Sep 2026)
**Asked.** A, Membership per Developer only; B, Membership per Developer with an optional list of
Projects from M0, outsiders only as named, scoped, time-bound invitations into the Developer's tenant;
C, cross-organisation sharing.
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q11."
**Written into.** ADR 0034. The owner then asked whether GCP (already subscribed) or a cheaper
reliable provider, or self-managed DevOps, should replace AWS: researched before it is put as a
question.

## Q12. Does the MVP export IFC (27 Sep 2026)
**Asked.** No milestone owned IFC export though ADRs 0022 and 0031 assumed it. A, no export in the MVP,
IFC-ready data from M1 (IFC class per Element Family, property mapping per attribute definition); B,
IFC 4.3 export in M2 behind the validation gate; C, B plus IFC import.
**Recommended.** A: the mapping is what is expensive to retrofit; the exporter has no user yet.
**The owner's ruling.** "Agree with A on Q12"
**Written into.** ADR 0022 (the share link is GLB only), ADR 0035 (IFC-ready). ADR 0031's validation
gate applies when an exporter arrives.

## Q13. The rebar diameter splits (27 Sep 2026)
**Asked.** No draft existed; an agent drafted splits per family by arithmetic on typical Dhaka
sections (all Low; the mills' sizes and BNBC's minimum tie sizes sourced); the purchase mix over the
G+9 reference building as the fastest test (10 mm 41 %, 16 mm 22 %, 20 mm 18 %, 12 mm 11 %, 25 mm 7 %).
**Recommended.** Accept as Low defaults, share of kg, marked "assumed" on every figure.
**The owner's ruling.** "Agree with your recommendation on Q13."
**Written into.** docs/specs/bd-defaults.md; ADR 0010 history.

## Q14. How the Live Model holds its attributes (27 Sep 2026)
**Asked.** Five parts from the component-store prototype and the standards research: permanent identity
(= IFC GlobalId); Attribute Definitions as data per family and market with permanent keys; As designed
as a typed core plus checked JSONB (option C); As built and As maintained as append-only Records; empty
tables in M0, content with each module. Measured: C2 query C 1.6 ms, all-JSONB 1.9 ms, EAV 5.2 ms (66
cold); storage 1.9 / 2.5 / 8.0 GB.
**Recommended.** All five with option C; the terms Attribute and Record.
**The owner's ruling.** "Agree with your recommendation on Q14. Judgement on the prototype itself: yes,
the inspector, the query and the three-phase history read as I'd want, looks good."
**Written into.** ADR 0037; `CONTEXT.md` (Attribute, Record); docs/design/screens.md (the prototype).

## Q15. What "global from the first line" puts into M0 (27 Sep 2026)
**Asked.** Eight habits from the global prototype and research (a Market row with its Library;
catalogues and machine sentences as codes; formatters per Market with drawing notation isolated LTR;
logical CSS; money with its currency and minor units, 3-decimal columns; Billing Units per unit system;
UTC and the work week; UUIDv7, tenant-prefixed keys, a home region); what waits.
**Recommended.** All eight in M0.
**The owner's ruling.** "Agree with your recommendation on Q15"
**Written into.** ADR 0038; amendments to 0008, 0016, 0022, 0033, 0034; `CONTEXT.md` (Market; Display
Units). Two rulings wait until a Bangla screen ships: ৳ before or after the figure in Bangla; the Bangla
word for Rebar (রড?).

## Q16. How Vextrus learns a consultant's way of drawing (27 Sep 2026)
**Asked.** On Edison, 27 of 31 fittings were one office's conventions. A, generic readers, a Question
every time; B, a Drafting Profile per consultant office, proposed by code and Jev, confirmed by the QS,
reused on that office's next set; C, B pooled across Developers and pre-built for leading Dhaka offices,
with clients' permission.
**Recommended.** B from M1; C after the beta with written permission.
**The owner's ruling.** "I think we can go for C for Q16 which I know going extra mile and as you told
that needs client's permission which we'll manage hopefully and with cooperation our product quality will
be at top quality and can be real moat."
**Consequences written with it.** Publishing a profile needs the client's permission and a Vextrus
review (layer names and label patterns can carry names); a Held-out Set is scored first as an unknown
office's first read, then with a profile if one exists; no build session builds a profile from a
Held-out Set.
**Written into.** ADR 0039; `CONTEXT.md` (Drafting Profile).

## Q17. Is the Level 2 assistant the Live Model's query (27 Sep 2026)
**Asked.** The M2 spec trims the assistant to eight fixed templates; the component-store prototype
parsed the owner's sentence into a structured query by code alone. A, eight templates; B, one query over
the Live Model for the assistant, the viewer's filters, marketing and later modules (code parses, Jev
picks only among ambiguous meanings, chips shown back, every number the BOQ's with its Trace); C, B plus
an LLM (Level 3).
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q17"
**Written into.** ADR 0011; the M2 spec's assistant section changes when levelled (routing ≥ 90 % on
English and Bangla-script asks still applies).
