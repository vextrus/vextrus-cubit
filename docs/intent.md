# Vextrus — intent

What we build and why, in the owner's terms: the first of the playbook's documents (intent → spec →
plan). Rewritten as the final intent at the end of session 02 (28 Sep 2026), the last grill before the
build ("this is the last time we're going through to plan and actually build the product from resetting
to zero"). Decisions live in `docs/adr/`, terms in `CONTEXT.md`, the rulings' trail in
`docs/reviews/session-02-grill.md`.

## What Vextrus is
An AI-native platform for the AEC business, starting with Bangladeshi real-estate Developers. Its product
is the **Live Model** (ADR 0035): every Building of a Developer's Project as one dataset of confirmed
Elements, each a physical piece (a column in one storey, a beam, a slab panel, a wall run, a socket, a
pump) with a permanent identity, its geometry, its Trace to the drawing it was read from, and its cost,
construction and O&M Attributes. The Priced BOQ, the Material Schedule, the 3D, and every module that
follows are readings of it.

Our market does not use BIM: Dhaka's consultants hand over 2D AutoCAD drawings, and Revit is rare. Turning
those drawings into a working model, **structural, architectural and MEP alike**, is the core and the moat
("we'll not left nothing in a Building", the owner, session 02). For small and medium projects Vextrus can
become what Glodon's "BIM 2.0" meant, though not exactly that, and it is not called BIM.

**Live** means one identity for each Element through three **Life Phases**: *As designed* (from the
drawings, Revisions and prices; the MVP), *As built* (what was cast and spent on site; cost control) and
*As maintained* (warranty, expected life, upkeep; after-sales and facility management, which many Dhaka
Developers now run). Values are layered by Life Phase and nothing overwrites; a site value that differs
from the design is a **Deviation**, shown and never absorbed (ADR 0035). "Digital twin" is what marketing
may call it once As built data flows, and not before.

## How the Live Model is built
- **One Live Model per Building, made of Discipline Parts** (Structural, Architectural, Electrical,
  Plumbing, Fire…), each read from its own consultant's drawings with its own Revisions, and joined by
  typed **Element Relations** (a socket hosted in a wall, a pipe through a slab, a point in a room, the
  architect's WC and the plumber's WC as the same thing) (ADR 0040). A Project holds a Site and one or more
  Buildings (ADR 0036).
- **A Takeoff the QS drives and the machine assists:** building-first, Takeoff Step by Takeoff Step, bulk
  Confirmation, Questions at the point of need; Checks against the source raise those Questions; a step
  may close with Questions still open, their Elements flagged "awaiting answer" (ADRs 0002, 0007, 0027).
- **Reading real drawings, not our own:** each consultant office's conventions are a **Drafting Profile**
  the machine proposes and the QS confirms once, reused on that office's next set and, with clients'
  permission, pooled for every Developer (ADR 0039). The clean Sample Project reads through all fourteen
  steps in about three seconds; the same readers read **nothing** of the Edison set until 31 fittings,
  which is why proof comes only from Held-out Sets, scored first as an unknown office's first read
  (ADR 0005; docs/research/edison-check-session-02.md).
- **Attributes are data** per Element Family and per Market, with permanent keys; As built and As
  maintained values arrive as **Records** with their evidence; IFC-ready and classified (Uniclass, PWD
  codes), with no IFC export until a client asks (ADRs 0037, 0022).

## Whom it serves
- **The Developer first** (ADR 0033): its MD buys, its QS uses Vextrus daily and measures every discipline.
- **In the MVP:** the QS (the Takeoff, the Priced BOQ, Rate Analyses, the viewer's measuring tools); the MD
  (the Project Summary on a phone, the Target Cost warning, Revision Comparisons, the 3D share link);
  procurement (the Material Schedule by Construction Stage); and marketing (presentation on the share
  link: finished materials, a turntable, the building rising stage by stage, stills for brochures and REHAB
  fairs).
- **Later, each with its module:** site engineers (As built), after-sales and facility management (As
  maintained, the handover package, the buyer's view of their own flat), consultants and contractors as
  named, scoped guests in the Developer's data (ADR 0034), and later still as customers.

## What the Developer pays for
Per project, ৳4 per sft of Gross Floor Area (ADR 0033): the Live Model of each Building in 3D, the Priced
BOQ and the Material Schedule from one QS-confirmed Takeoff, with money from M1 (ADR 0002): a whole-building
figure from the first Confirmation, each unconfirmed step held as a marked allowance; working rates from the
Developer's Rate Analyses at its Market Prices (starter: PWD's SoR 2022, Dhaka), PWD as the Benchmark; an
Estimate built up in layers; Issued Estimates frozen down to each Element's Measurement Lines, and every
later change split into quantity and price effect (ADRs 0006, 0028). Measurement Rules are data (ADR 0009),
rebar comes from the drawing, never by ratio for ever (ADR 0010), and every figure opens its Trace.

## Quiet intelligence
AI never shouts. Code finds and counts; Jev, a closed-question model, picks among candidates code found; the
QS confirms (ADR 0011). Level 2 is the Live Model's query: "every C2 column on levels 3–6, its concrete,
rebar, cost, casting stage and maintenance notes", read into a structured query shown back as chips, every
number the Priced BOQ's own. Level 3 (a written explanation of each Revision Comparison) comes first after
the MVP.

## How we beat OpenConstructionERP
It is broad and free, but shallow where our clients live (docs/research/oce-*.md): it never turns 2D drawings
into a model; its numbers disagree with each other; its "one dataset" is loose ids; it has nothing for
Bangladesh and no measurement standard; its UX ranks lowest. We read every discipline into one Live Model,
trace and check every figure, carry local depth (PWD, IS 1200, BNBC, lakh and crore, ৳, imperial Billing
Units), design for the QS's real workflow, keep AI quiet, and sell a finished result per project.

## From Bangladesh to global
Bangladesh first, until ten Developers pay and five buy again (ADR 0033); then the Gulf (Google Cloud's
Middle East regions, since AWS's are damaged), India, and later the UK and Australia. "Going global is a
matter of time", so from the first line a Market is data (ADR 0038): currency and its minor units, number
format and digits, languages through message catalogues, unit systems, the Rule Set, rates, benchmark,
taxes and Construction Stages; the canvas never mirrors in right-to-left scripts; every Developer has a
home region, so a second region is a new cell, not a rewrite. The stack is chosen to last (ADR 0034): one
Django modular monolith on Python 3.14, one PostgreSQL 18 with row-level security from M0, a React SPA with
our own sheet and 3D renderers, the beta on Google Cloud Mumbai.

## The line
M0 drawings in → M1 the frame and piles, priced, reading an unknown office → M2 the whole building, the
showcase → M3 MEP read → M4 rebar from the drawing, and more than one Building → M5 Revisions and vector
PDFs → M6 the beta; the founding Developers are onboarded after M4 (docs/milestones.md). After the MVP:
Level 3 → cost control (As built) → As maintained → project memory → the watcher → 4D Schedule and 5D Cost,
each chosen and refined by what beta Developers ask for.

## The owner's broader ideas, still guiding the order after the MVP
- **Quiet intelligence, not an AI gimmick:** the product silently does and delivers, so clients are
  astonished by using it; code first where the logic is obvious (after TypeSafe's manifesto,
  https://typesafe.ai/manifesto).
- **Project memory:** each tenant's history kept securely and searched semantically; old documents dropped
  in, filed and serving at once.
- **A live project that wakes when needed:** events watched quietly, waking to flag an anomaly or suggest
  an action.
- **4D Schedule and 5D Cost** on the real dataset, built with the project's engineers.
- **Continuous development driven by client feedback.**
- Glodon's "Evolving into BIM 2.0" describes much of this vision (docs/research/glodon-bim-2.md).

## In the owner's words
- After session 01: "opened my mind of the actual full potential of our product … this could be the next
  BIG thing for our industry"; "It would be wise to not call Vextrus BIM or BIM 2.0"; Revit/CAD-grade tools
  in the viewer, the prototype the destination, production grade "at any cost"; "going global is a matter
  of time".
- Session 02: "now a days lots of Dhaka Developers we know run after-sales or facility management … if we
  offer 'as maintained' we will find buyers"; the multi-building clients "are the most premium client whom
  we priorities most"; pooled Drafting Profiles, "with cooperation our product quality will be at top
  quality and can be real moat"; MEP: "without proper MEP implementation our total product value would not
  fulfill our premium clients"; and at the end: "it was really a fantastic grilling session that shaped our
  product as I wanted finally."
