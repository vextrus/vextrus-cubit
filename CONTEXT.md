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

### Money

**Resource**:
A material (cement, rod, sand, stone chips, bricks), a labour contract item or a piece of plant that
a BOQ item consumes, with a unit and a Market Price.
_Avoid_: input, component, cost element

**Market Price**:
The Developer's current price for one unit of a Resource; the one place a price is changed so every
rate and amount follows.
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

**Benchmark Rate**:
The PWD Schedule of Rates rate for an item, shown beside the working rate for comparison; never the
rate the Priced BOQ is totalled on.
_Avoid_: SoR rate (as if it were the working rate), standard rate

### Takeoff

**Takeoff**:
The QS's work of turning a Drawing Set into the confirmed Building Model, one Takeoff Step at a time,
with the machine proposing and the QS confirming.
_Avoid_: extraction, reading, campaign, measurement run

**Takeoff Step**:
One element type in the building-first order (storeys and heights, grid, foundations, columns, beams,
slabs, stairs, walls and openings, finishes); it draws on every sheet that carries that element type.
_Avoid_: stage, phase, lane, class

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

**Trace**:
The link from any figure back to where on which sheet it was read, or to the Question that supplied
it.
_Avoid_: provenance, source, lineage

**Storey Band**:
The range of storeys over which an element keeps one size or specification, as a column schedule
gives it; a column's size is known per Storey Band, not once.
_Avoid_: level range, floor group

**Display Units**:
The units a project shows its quantities and rates in, chosen per project by the Developer: the
market's imperial (cft, sft, rft, bags, ton) by default, metric one switch away. Money is always ৳
grouped in lakh and crore.
_Avoid_: unit system, locale

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
The kg of rod per unit volume of concrete for an element type, set from Vextrus's defaults or by the
Developer's QS, used to give an element rod before its reinforcement is read from the drawings.
_Avoid_: steel factor, thumb rule

**Rod Basis**:
Whether an element's rod is "by ratio" (from a Rod Ratio) or "from the drawing" (read from its
reinforcement detailing into a bar-bending schedule); every rod figure shows its basis.
_Avoid_: rebar mode, estimate type

**Revision**:
A re-issue of all or part of a Drawing Set by its consultant (revision B after A); in Dhaka practice
the latest Revision is the instruction.
_Avoid_: version, update, change order

**Revision Comparison**:
The element-by-element difference between the Building Model of one Revision and the next (new,
removed, changed), with its effect on the Priced BOQ in quantities and ৳.
_Avoid_: diff, delta report, change log
