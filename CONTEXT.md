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

**BOQ Section**:
One building part the Priced BOQ is grouped by, in this order: Sub-structure, Super-structure,
Masonry, Finishes, Doors & Windows, Services, External works.
_Avoid_: bill, chapter, trade (a trade is a kind of work)

**Trade**:
A kind of work (concrete, formwork, rebar work, brickwork, plaster, flooring…) as PWD's chapters and
Labour Contracts divide it; the Priced BOQ can be viewed by Trade.
_Avoid_: discipline (a family of drawings), section, package

**BOQ Item**:
One line of the Priced BOQ: a description with its mix, grade and element class, a Billing Unit, a
BOQ Section and a Trade; its quantity is the sum of its Measurement Lines and its rate comes from its
Rate Analysis.
_Avoid_: line item, row, entry

**Measurement Line**:
One line of the measurement sheet behind a BOQ Item: the element, Nos × L × B × H, the quantity in the
Billing Unit, and the Measurement Rules that produced it.
_Avoid_: calculation, dimension line

**Lump Sum**:
A BOQ Item priced as one typed amount (unit "LS") with no Rate Analysis, such as a lift or the
plumbing; it counts toward the Estimate but not the measured subtotal.
_Avoid_: allowance (that is a Cost Basis), provisional sum

**Provisional Sum**:
An amount set aside for work whose scope is not yet known, shown at the end of the BOQ Section it
provides for and kept outside the measured subtotal.
_Avoid_: contingency (a contingency is an Estimate layer), lump sum

**Material Schedule**:
The quantities of basic materials (cement, sand, stone chips, rebar by diameter, bricks and the like)
the building needs, broken down by floor and by Construction Stage, derived from the same takeoff
as the Priced BOQ.
_Avoid_: material list, BOM

**Construction Stage**:
One step in the fixed order a Dhaka building is built and paid for (piling; substructure; each floor's
slab casting; masonry; finishes; services; external works); the Material Schedule and the ৳ by stage
are broken down by it. It is a sequence, not a date.
_Avoid_: phase, milestone (a milestone is ours), activity, schedule

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

**Sheet**:
One drawing sheet of a Drawing Set, known by its Discipline and its number (a sheet may have no
number), with its title, and a revision mark, issue date and source file for each issue.
_Avoid_: page (a page is the PDF's), drawing (alone), layout

**View**:
One part of a sheet: a plan, section, elevation, schedule, detail, notes, legend, title block, key
plan or 3D/perspective view. A plan view's storeys are an explicit list that means either the storeys
floor to floor or the members at those floor levels.
_Avoid_: viewport, drawing, region

**Drawing List**:
The consultant's list of a Drawing Set's sheets, read from a sheet of the set or pasted or typed by
the QS, with its source shown; it gives the number of sheets expected, and the sheets found are
checked against it both ways.
_Avoid_: register (on screen), index, transmittal (the transmittal is one source of it)

**Plot**:
The consultant's own PDF page of a sheet, registered beneath Vextrus's drawing of it, so what was
read can be compared with what was plotted.
_Avoid_: underlay, PDF view

**As read**:
The on-screen name of Vextrus's own drawing of a sheet, beside Plot and Compare: the sheet exactly as
Vextrus read it.
_Avoid_: engine, render (on screen)

**Sample Project**:
A typical Dhaka RCC-framed Developer project that Vextrus owns outright, made with an agent's help as a
clean set with planted contradictions; a Development Set for regression, and the sample project
clients see first. Never evidence that Vextrus reads real drafting mess.
_Avoid_: demo project, fixture, golden, "hand-drafted"

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
A material (cement, rebar, sand, stone chips, bricks), a labour contract item or a piece of plant that
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

**Mix**:
The proportion of cement, sand and aggregate in a concrete or mortar (1:1.5:3, 1:4), with its
dry-volume factor; a Rate Analysis's material quantities follow from it.
_Avoid_: ratio (alone), grade (grade is strength)

**Wastage**:
The allowance added to a Resource's quantity in a Rate Analysis for cutting, breakage and spillage;
it enters the Material Schedule (what to buy), never a BOQ quantity (measured net).
_Avoid_: loss, extra

**Labour Contract**:
The Developer's agreement with a labour-only contractor, priced per unit of its own scope (per cft of
RCC, per sft of plaster, or per sft of casting area covering rebar binding, shuttering and casting
together); it is its own line in the Priced BOQ, and each item it covers takes no other labour.
_Avoid_: subcontract (that implies material and labour together)

**Material-and-Labour Contract**:
The exception: a trade given out with its materials, priced as one rate per unit; its materials do
not enter the Developer's Material Schedule.
_Avoid_: turnkey, subcontract (alone)

**Cost Basis**:
Whether a Takeoff Step's money in the Priced BOQ is "measured" (from its confirmed elements) or an
"allowance" (৳ per sft of Gross Floor Area for everything the step will bring, clearly marked, until
the step is confirmed); the measured share rises step by step.
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

**Element**:
One confirmed thing in the Building Model with a stable identity across Revisions: a column over a
Storey Band, a beam, a slab panel, a wall run, an opening, a storey, a grid line.
_Avoid_: object, entity, member (a member is structural only)

**Element Family**:
The kind of Element one Takeoff Step proposes and confirms (columns, beams, slabs, walls…), with its
own identity rule across Revisions.
_Avoid_: category, class, type (alone)

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
A test of what was read, confirmed or priced against something independent of it: the source
drawings (a schedule against its plan, a room against its walls), a conservation (owned volumes sum to
the whole; each item's labour paid once), or a sanity range (rebar kg per sft); when it fires, it raises
a Question, or for a sanity range a flag.
_Avoid_: validation, gate, test, rule (a rule is a Measurement Rule)

**Coverage**:
The account of every view on every sheet of a Drawing Set: assigned to the Takeoff Steps that will
read it, used by them, or excluded with a reason; nothing is silently unread.
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
BOQ rather than relabelling it. Money is always ৳; money and quantities group in lakh and crore,
coordinates and dimensions never.
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

**Rebar**:
The steel reinforcement bars of RCC, bought by the ton and scheduled by diameter; the product's one
word for them on every screen and document (the owner's ruling, 26 Sep 2026: "Rebar it is").
_Avoid_: rod, MS rod, steel (alone), reinforcement (except in PWD's own item text)

**Rebar Ratio**:
The kg of rebar per unit volume of concrete for an element type, by Storey Band where the QS sets it,
from Vextrus's defaults or the Developer's QS; it gives an element rebar (with an assumed diameter
split) before its reinforcement is read from the drawings.
_Avoid_: rod ratio, steel factor, thumb rule

**Rebar Basis**:
How an element's rebar was found, shown on every rebar figure: "by ratio" (from a Rebar Ratio), "from the
drawing" (every bar, lap and hook stated on the drawing) or "from the drawing + rules" (bars read,
with laps, hooks, anchorage, cutting and wastage supplied by Measurement Rules where the drawing is
silent).
_Avoid_: rod basis, rebar mode, estimate type

**Revision**:
A re-issue of all or part of a Drawing Set by its consultant (revision B after A); in Dhaka practice
the latest Revision is the instruction.
_Avoid_: version, update, change order

**Sheet Revision**:
One issue of one sheet (S-201 rev B); a Revision reissues some sheets, and the rest keep their
current Sheet Revision.
_Avoid_: sheet version

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
A Vextrus team member who sits with a client's QS through their first Takeoff ("done with you"),
inside the Developer's data only by its time-bound invitation.
_Avoid_: support agent, consultant, admin

**Project Summary**:
The MD's page for one project: total cost and cost per sft, cost by trade and by floor, what is
confirmed and what is open, the rebar from the drawing, the latest Revision Comparison, the Building
Model in 3D, and the Target Cost warning.
_Avoid_: dashboard, home, overview

**Gross Floor Area**:
The area of every floor of a building, basement and parking included, measured to the outside of the
walls from the confirmed Building Model; what Vextrus's price and the consumption checks are per sft of.
_Avoid_: GFA (in screens), built-up area, plinth area

**Saleable Area**:
The area the Developer sells, apartments plus their loaded share of common areas as the Developer
counts it; entered or confirmed by the QS.
_Avoid_: carpet area, net area, sellable area

**Target Cost**:
A figure the MD sets for a project; the Project Summary warns when the Priced BOQ crosses it, even
while the Takeoff is still in progress.
_Avoid_: budget (budget belongs to cost control), cap

**Hand Takeoff**:
A team engineer's manual measurement of five zones of a Drawing Set (foundations and substructure;
the ground / podium floor; one typical floor; one non-typical upper floor where there is one; the roof
with the stair and lift tower), under the same Rule Set as the product, kept private and used only by
the owner to check Vextrus's figures; made for the Edison set and every Held-out Set, not the Sample Project.
_Avoid_: golden, ground truth

**Answer Key**:
Anything that states what the right figures for a Drawing Set are (a Hand Takeoff, a Held-out Set's
scoring, the team's own model of the Sample Project); kept where no build session can read it and
compared with Vextrus's figures only through a blind scorer that returns aggregates.
_Avoid_: golden, oracle, ground truth, expected output
