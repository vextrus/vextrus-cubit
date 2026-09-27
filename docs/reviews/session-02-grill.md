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
