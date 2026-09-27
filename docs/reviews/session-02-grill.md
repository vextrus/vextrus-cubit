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

## Q18. Python 3.14 and PostgreSQL 18 (27 Sep 2026)
**Asked.** A measured check (docs/research/stack-versions.md): nothing blocks; PG 18 supported to 2030 with
native UUIDv7; Python 3.13's last bugfix 6 Oct 2026; costs: ezdxf without a cp314 wheel (build from
source), PG 18 on every environment, all environments switching together; RDS 18.6 in the chosen region
unconfirmed. Plus a tenant-policy bug on either version (`nullif`).
**Recommended.** Yes, 3.14 and 18.6 everywhere before wave 0; `ids.new_id()`; ezdxf from source.
**The owner's ruling.** "Agree with your recommendation on Q18"
**Written into.** ADR 0034; docs/architecture.md. Owner's step: install PostgreSQL 18 locally (the
command is in the research file); CLAUDE.md's machine line changes when it is installed.

## Q19. Which classification systems the Live Model carries (27 Sep 2026)
**Asked.** Uniclass 2015 shippable (CC BY-ND, Ashghal names it); OmniClass's licence forbids what a
hosted product does; MasterFormat's numbers unprotected in one US ruling (appeal window open); no
Bangladeshi, Indian or Saudi mandate found.
**Recommended.** Uniclass 2015 references for M1's families, attributed and unmodified; PWD SoR codes as
Bangladesh's reference; OmniClass and MasterFormat out until a North American customer and a lawyer.
**The owner's ruling.** "Agree with your recommendation on Q19"
**Written into.** ADR 0037.

## Q20. The starter Developer's Specification (27 Sep 2026)
**Asked.** The drafted starter (seven brochures; Low); four choices: sanitary ware in the Specification
or the plumbing Lump Sum (not both); ceiling paint; floor tile size; verandah door and railing, kitchen
door.
**Recommended.** Accept the draft as the starter; sanitary ware in the Specification with a pipework-only
Lump Sum default from the owner, or, without a figure, keep ৳170 as "plumbing and sanitary" and omit
fixtures from the Specification.
**The owner's ruling.** "Agree with your recommendation on Q20" (no pipework-only figure given, so the
fallback holds: fixtures stay in the Lump Sum; the draft's other choices stand).
**Written into.** docs/specs/bd-defaults.md. Every owed business input of the brief is now verified.

## Prototype: the whole Takeoff priced end to end (port 5340, 27 Sep 2026)
The chain runs: 3,583 Elements → 11,218 Measurement Lines → 72 BOQ Items + 9 Lump Sums → Material Schedule
→ Project Summary in ~8 s; Estimate ৳8.71 crore, ৳3,082/sft of measured GFA (28,266 sft); every Check
passes (owned concrete = union exactly, 33,869.19 cft); allowances vs measured across steps 5–13 within
0.16 % (piles +34 %, the core 4.5×, stair and lift room 6×, the frame within ~10 %). Broken: prices (no PWD
input prices transcribed; earthwork, painting, roof treatment, pile-head breaking at ৳0); sunshades not
read; rebar from the drawing columns only; P3 would drop grade beams that sit on caps.

## Q21. Where the starter Market Prices come from (27 Sep 2026)
**Asked.** The ruled starter set (PWD SoR 2022 input prices) was never transcribed; prices are now the
weakest link.
**Recommended.** An agent transcribes PWD's material input prices from the owner's copy of the SoR PDF
into a Library price set, each cited to its page, a refuter spot-checking 20; the owner then confirms
the labour rates Developers pay that PWD does not state, in one checklist.
**The owner's ruling.** "Agree with your recommendation on Q21, yes read the PDF"
**Written into.** This file; the transcription lands in docs/research/pwd-sor-2022-input-prices.md.

## Q22. When one Question holds a step (27 Sep 2026)
**Asked.** A, whole allowance until the step is confirmed; B, the QS may close a step with Questions open,
held Elements priced at their best candidate and flagged "awaiting answer", failed Elements typed or
excluded first; C, pro-rata allowance (rejected before).
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q22"
**Written into.** ADR 0002.

## Q23. Three Rule Set rules the real read did not fit (27 Sep 2026)
**Asked.** P3 drops grade beams that sit on caps; FW6/E4 shutter grade-beam soffits where no soling or
blinding is drawn; E3 has no sand-filling depth when none is stated.
**Recommended.** P3 between column faces where the beam bears on the cap; E4 extended to grade beams so
FW6 measures no soffit; E3 depth from ground level to the GF slab soffit, derived with a Question; no
retuning of allowance defaults from one agent-made building.
**The owner's ruling.** "Agree with your recommendation on Q23"
**Written into.** docs/specs/bd-defaults.md (Rule Set).

## Prototypes judged: global (5330) and priced (5340) (27 Sep 2026)
The owner's words: "Both read well, global and priced look right". Written into docs/design/screens.md.

## Q24. M0's weight (28 Sep 2026)
**Asked.** 40 tickets: 20 visible, 5 foundation, 15 machinery (8 scoring, keys and harness). The blind
scorer and keys exist to score Held-out Sets and Hand Takeoffs, which arrive in M1; session 02 added M0
work.
**Recommended.** Drop P1; merge 01c+01d, 06d1+06d2, 24+25; fold 27 into 22; move 05, 06c, 06d1/2, 06e
to M1's first wave (M0 keeps 06a and 06b: regression by element diff, no keys); keep the one Jev node (15
+ 23); put the new work into 01a, 01b, 03, 08 plus one small ticket for the Live Model's empty tables:
about 30 tickets, 8 machinery, the same finish line.
**The owner's ruling.** "Agree with your recommendation on Q24"
**Written into.** ADR 0030; docs/plans/M0.md when it is revised.

## Q25. Which viewer tools go into the MVP, and when (28 Sep 2026)
**Asked.** A, the QS's subset only; B, all of it: M1 the checking tools (measure, area, dimensions,
sections with cut dimensions, properties and filters), M2 derived plans and elevations, placed dimensions
and notes anchored to Element identity, presentation with its look set by the owner's bench; C, all in M1.
**Recommended.** B.
**The owner's ruling.** "Agree with B on Q25"
**Written into.** ADR 0022; docs/design/screens.md. Open for the owner: the ?bench run on the reference
setup; a judgement on the prototype itself.

## Q26. Where the beta runs (28 Sep 2026)
**Asked.** GCP Mumbai (the owner's account; ~$164–209; 7-day PITR, 14 days ≈ +$190; Gulf regions open) vs
AWS Mumbai (~$158–174; 35 days; UAE damaged) vs DigitalOcean Bangalore (~$112–163; fewer controls) vs
self-run Postgres (saves $15–60, costs 6–10 engineer-hours a month).
**Recommended.** GCP Mumbai: one VM, Cloud SQL Enterprise, 7 days PITR + 30 days daily backups in Delhi;
confirm latency, the N2D price and billing type before provisioning; never self-run Postgres.
**The owner's ruling.** "Agree with your recommendation on Q26"
**Written into.** ADR 0034 (and its index line).

## Q27. The milestones, redrawn (28 Sep 2026)
**Asked.** Every ruling Q1–Q26 placed: M0 the global habits, versions, seams and empty Live Model tables,
no keys (~30 tickets); M1 reading beyond the Sample Project (generic bugs, no hard-coded counts, graphical
schedules, notes tables, levels from architecture), Drafting Profiles, the scorer and keys, per-storey
Elements, As designed Attributes with IFC mapping and Uniclass, steps closing with Questions open, PWD
starter prices, the viewer's M1 tools, and a Held-out Set scored first as an unknown office's first read;
M2 the Live Model query, derived drawings, placed dimensions and notes, presentation within budget; M3 +
multi-building reading before the founding clients; M4 + publishing Drafting Profiles once permitted; M5
on GCP Mumbai.
**Recommended.** Agree.
**The owner's ruling.** "Agree with your recommendation on Q27"
**Written into.** docs/milestones.md (rewritten). The specs M0–M2 and the M0 plan are revised to it next.

## Q28. Where "As maintained" goes after the MVP (28 Sep 2026)
**Asked.** A, third (Level 3 → cost control → As maintained → project memory → watcher → 4D/5D); B,
second; C, last.
**Recommended.** A: cost control's As built Records feed a good handover package; moved forward if a beta
Developer asks for FM on existing buildings.
**The owner's ruling.** "Agree with your recommendation on Q28."
**Written into.** docs/milestones.md (after the MVP).

## Q29 (opened by the owner). MEP read into the Live Model, not lump sums (28 Sep 2026)
**The owner's words.** "I'm also another critical decision of "MEP"; today they're only lump sums but in
reality without proper MEP implementation our total product value would not fulfill our premium clients
as they are really serious regarding MEP. At what point we can include MEP equipment (study 2 MEP related
DWG files from Edison which you can say pretty standard) as Elements with identity?? Please revise the
plan and milestones including MEP; so basically we'll not left nothing in a Building: Everything
Structural, Architectural and MEP have will be extracted from DWGs, PDFs and will be in live model as
Elements with identity and with priced BOQ."
**Taken as.** The direction is ruled: every Discipline (structural, architectural, MEP) is read into the
Live Model as Elements with identity and a Priced BOQ; this reverses ADR 0003's "MEP as lump sums". Open:
at which milestone and to what depth. Evidence being gathered before the recommendation: Edison's
ELECTRICAL and PLUMBING DWGs studied by a drawing analyst; Dhaka's MEP measurement and pricing practice
researched.
