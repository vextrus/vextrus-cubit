# Vextrus

Vextrus is an AI-native platform for the AEC business, starting in Bangladesh: one project dataset,
built first from a client's 2D drawings, that every department and professional on a project works
from.

## Language

### People and organisations

**Developer**:
A real-estate development firm that builds and sells residential or commercial buildings; Vextrus's
first paying customer.
_Avoid_: client (ambiguous), builder, owner (the Developer's MD is the buyer; "owner" alone is
ambiguous with the building's end owner)

**QS**:
The quantity surveyor or estimation engineer, at the Developer or working for it, who measures
quantities from drawings and prices them; the first daily user.
_Avoid_: estimator (use QS), surveyor

### What the Developer gets

**Priced BOQ**:
The bill of quantities for a building, item by item by trade, with a rate and an amount in ৳ on every
item; each quantity traces back to where it was read on the drawings.
_Avoid_: estimate (use it only for the total cost figure), register, bill

**Material Schedule**:
The quantities of basic materials (cement, sand, stone chips, rod by diameter, bricks and the like)
the building needs, broken down by floor and by construction stage, derived from the same takeoff
as the Priced BOQ.
_Avoid_: material list, BOM

**Building Model**:
The 3D model of the building assembled from the QS-confirmed takeoff; the project dataset that the
Priced BOQ, the Material Schedule and every later module are read from.
_Avoid_: BIM (as a noun for our object), 3D view, digital twin

### Drawings and projects

**Drawing Set**:
All the drawings issued for one building project, across its disciplines, as the files the
consultant or team produced (DWG, PDF, and where they exist RVT and IFC).
_Avoid_: drawings (loosely), package, fixture

**Discipline**:
One family of drawings in a Drawing Set: structural, architectural, or MEP (plumbing, sanitary,
electrical). The MVP reads structural and architectural; MEP enters the Priced BOQ as lump-sum
items the QS types.
_Avoid_: trade (a trade is a BOQ grouping, not a drawing family), lane

**Sample Project**:
The typical Dhaka RCC-framed Developer project that the Vextrus team, as practising civil engineers,
drafts in AutoCAD the way a Dhaka consultant does; Vextrus owns it outright, uses it as a test set,
and ships it as the sample project clients see first.
_Avoid_: demo project, fixture, golden, synthetic set (it is drafted by engineers, not generated)

**Independent Set**:
A real Drawing Set that the Vextrus team did not draw, such as the Edison set or a client Developer's
project; read locally, never committed, and never shown without its owner's permission.
_Avoid_: real set (the Sample Project is real too), external fixture

**Development Set**:
A Drawing Set that build sessions read and fit the readers to (the Sample Project and the Edison set);
it proves that nothing regressed, never that Vextrus reads an unseen consultant's drawings.
_Avoid_: test set, training set, golden

**Held-out Set**:
An Independent Set from another consultant that no build session ever opens, scored only by the
owner; the proof that Vextrus reads Dhaka drawings. One is required before M1 closes, two before M2.
_Avoid_: blind set, validation set, holdout (one word)

### Money

**Resource**:
A material (cement, rod, sand, stone chips, bricks), a labour contract item or a piece of plant that
a BOQ item consumes, with a unit and a Market Price.
_Avoid_: input, component, cost element

**Market Price**:
The Developer's price for one unit of a Resource on a date, kept in dated sets; the one place a price
is changed so every working rate and amount follows, while Issued Estimates keep the set they were
issued on.
_Avoid_: resource rate, unit cost (ambiguous with an item's rate)

**Rate Analysis**:
The breakdown of one BOQ item into the Resources it consumes per unit, which priced at Market Prices
gives the item's working rate and, summed over the building, the Material Schedule.
_Avoid_: recipe, build-up, analysis (alone)

**Labour Contract**:
The Developer's agreement with a labour-only contractor for a trade, priced per unit of work (per cft
of RCC, per sft of plaster); the usual way labour enters a Rate Analysis.
_Avoid_: subcontract (that implies material and labour together)

**Material-and-Labour Contract**:
The exception: a trade given out with its materials, priced as one rate per unit; its materials do
not enter the Developer's Material Schedule.
_Avoid_: turnkey, subcontract (alone)

**Cost Basis**:
Whether a trade's money in the Priced BOQ is "measured" (from confirmed elements) or an "allowance"
(৳ per sft of floor area, for a trade not yet measured, clearly marked); the measured share rises as
the Takeoff proceeds.
_Avoid_: provisional sum (a PWD term for a different thing), estimate, placeholder

**Benchmark Rate**:
The PWD Schedule of Rates rate for an item, shown beside the working rate as printed and net of PWD's
mark-ups (profit, overhead, VAT) so it compares like with like; never the rate the Priced BOQ is
totalled on.
_Avoid_: SoR rate (as if it were the working rate), standard rate

**Estimate**:
The total cost of a building: the Priced BOQ's direct cost plus preliminaries and site overheads,
contingency and taxes, each layer shown and editable by the Developer.
_Avoid_: budget, quotation, bid

### Takeoff

**Takeoff**:
The QS's work of turning a Drawing Set into the confirmed Building Model, one Takeoff Step at a time,
with the machine proposing and the QS confirming.
_Avoid_: extraction, reading, campaign, measurement run

**Takeoff Step**:
One element family in the building-first order (sheets; general notes and specification; storeys and
levels; grid; foundations and substructure; columns, shear walls and core; beams; slabs and slab-edge
members; stairs; tanks; walls and openings; rooms and finishes; roof; site works and MEP); it draws on
every sheet that carries that family.
_Avoid_: stage, phase, lane, class

**Developer's Specification**:
The Developer's standard choice of finishes, fittings, doors and windows by room type (bed, toilet,
kitchen, lobby, stair, parking), the same list its sales brochure promises; applied to confirmed
rooms, since consultant drawings rarely state it.
_Avoid_: spec sheet, features list, finish schedule

**Proposal**:
What the machine has read or inferred for an element or a fact, shown with its Trace, waiting for the
QS; it counts toward nothing until confirmed.
_Avoid_: suggestion, candidate, detection, draft

**Confirmation**:
The QS's acceptance of Proposals, made in bulk for the ones that agree and one by one for the
exceptions; only confirmed elements enter the Building Model and the Priced BOQ.
_Avoid_: approval, sign-off, commit, act

**Question**:
A fact the machine could not read or found in conflict, asked of the QS at the point of need and
answered once for every element it unblocks.
_Avoid_: refusal, blocker, gap, decision

**Check**:
A comparison of what was read or confirmed with the source drawings (a schedule against its plan, a
section against its span, a room against its walls); when it fires, it raises a Question.
_Avoid_: validation, gate, test, rule (a rule is a Measurement Rule)

**Coverage**:
The account of every view on every sheet of a Drawing Set: used by a Takeoff Step, or excluded with a
reason; nothing is silently unread.
_Avoid_: completeness, progress

**Trace**:
The link from any figure back to where on which sheet it was read, or to the Question that supplied
it.
_Avoid_: provenance, source, lineage

**Storey Band**:
The range of storeys over which an element keeps one size or specification, as a column schedule
gives it; a column's size is known per Storey Band, not once.
_Avoid_: level range, floor group

**Display Units**:
The unit system a project is billed and shown in, chosen per project by the Developer: the market's
imperial (cft, sft, rft, bags, ton) by default, metric one switch away; switching re-bills the Priced
BOQ rather than relabelling it. Money is always ৳ grouped in lakh and crore.
_Avoid_: unit system, locale

**Billing Unit**:
The unit one BOQ item is measured and priced in (cft for RCC and 10" brickwork, sft for 5" brickwork
and plaster, nos for bricks), set by the Rule Set; the item's quantity is rounded in it, and quantity ×
rate = amount exactly.
_Avoid_: UoM, display unit

**Measurement Rule**:
One rule, written in words a QS reads, for turning the Building Model into a BOQ quantity (for
example: deduct openings over 0.1 m² from brickwork); every figure's Trace names the rules that
produced it.
_Avoid_: quantity rule, formula, method

**Rule Set**:
The Measurement Rules a Developer measures by: a copy of the Bangladeshi default set, based on PWD
practice, which the Developer edits to match its own habits.
_Avoid_: standard (a Rule Set may depart from one), profile, law

**Rod Ratio**:
The kg of rod per unit volume of concrete for an element type, by Storey Band where the QS sets it,
from Vextrus's defaults or the Developer's QS; it gives an element rod (with an assumed diameter
split) before its reinforcement is read from the drawings.
_Avoid_: steel factor, thumb rule

**Rod Basis**:
How an element's rod was found, shown on every rod figure: "by ratio" (from a Rod Ratio), "from the
drawing" (every bar, lap and hook stated on the drawing) or "from the drawing + rules" (bars read,
with laps, hooks, anchorage, cutting and wastage supplied by Measurement Rules where the drawing is
silent).
_Avoid_: rebar mode, estimate type

**Revision**:
A re-issue of all or part of a Drawing Set by its consultant (revision B after A); in Dhaka practice
the latest Revision is the instruction.
_Avoid_: version, update, change order

**Revision Comparison**:
The element-by-element difference between the Building Model of one Revision and a baseline the MD
picks (the previous Revision or an Issued Estimate): new, removed and changed elements, with their
effect on the Priced BOQ split into quantity effect and price effect, in quantities and ৳.
_Avoid_: diff, delta report, change log

**Issued Estimate**:
A frozen snapshot of the Estimate (the Priced BOQ, the Material Schedule, the Market Price set, the
Rule Set version and the Building Model's state) with an issue number and date; the figure the MD
takes to the board, which later changes are compared against.
_Avoid_: version, baseline (alone), final estimate

**MD**:
The Developer's managing director or director who buys Vextrus and reads the Project Summary; views
and sets the Target Cost, does not edit the Takeoff.
_Avoid_: owner, admin, manager

**Vextrus Engineer**:
A Vextrus team member who sits with a client's QS through their first Takeoff ("done with you").
_Avoid_: support agent, consultant

**Project Summary**:
The MD's page for one project: total cost and cost per sft, cost by trade and by floor, what is
confirmed and what is open, the rod from the drawing, the latest Revision Comparison, the Building
Model in 3D, and the Target Cost warning.
_Avoid_: dashboard, home, overview

**Target Cost**:
A figure the MD sets for a project; the Project Summary warns when the Priced BOQ crosses it, even
while the Takeoff is still in progress.
_Avoid_: budget (budget belongs to cost control), cap

**Hand Takeoff**:
A team engineer's manual measurement of one typical floor of a Drawing Set, kept private and used
only by the owner to check Vextrus's figures.
_Avoid_: golden, ground truth

**Answer Key**:
Anything that states what the right figures for a Drawing Set are (a Hand Takeoff, a Held-out Set's
scoring, the team's own model of the Sample Project); kept where no build session can read it and
compared with Vextrus's figures only through a blind scorer that returns aggregates.
_Avoid_: golden, oracle, ground truth, expected output
