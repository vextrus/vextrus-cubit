# The Live Model is the product: one identity for each Element across its Life Phases

Vextrus's product is the **Live Model**: the building as one dataset of confirmed Elements, each with
a stable identity, its geometry, its Trace, and its cost, construction and O&M attributes. The Priced
BOQ, the Material Schedule, the 3D and every later module are readings of it. "Live" means one
identity per Element through three **Life Phases**: *As designed* (from the drawings, Revisions and
prices; the MVP fills it), *As built* (what was actually cast and spent; cost control fills it) and *As
maintained* (warranty, expected life, upkeep; filled at handover, for owners' associations or the
buildings a Developer keeps). The data carries the Life Phase from M0; construction facts known at
design time (Construction Stage, casting stage, mix, grade, Rebar Basis) are filled from M1.

**Values are layered by Life Phase; nothing overwrites.** Each fact of an Element holds its As
designed value, written only by a Confirmation in the Takeoff, and, where recorded, an As built or As
maintained value written by its own recorded act (a site record, a maintenance record) that names who,
when and on what evidence, as a Trace does for the drawings. The Priced BOQ always measures As
designed; cost control compares As built with it; the 3D may show "as built where recorded, else as
designed". A value that differs from its As designed value beyond a tolerance is a **Deviation**:
shown, never absorbed.

**Its readers.** In the MVP: the QS (the Takeoff, the Priced BOQ, the Rate Analyses), the MD (the
Project Summary, the Revision Comparison, the 3D share link), procurement (the Material Schedule by
Construction Stage) and the Developer's marketing (a presentation mode on the share link: finished
materials, a turntable, the build-up in Construction Stage order, stills for brochures and fairs; no
money, no new role). Later, each with its module: site engineers (As built, with cost control), after-sales
and facility management (As maintained), and a buyer's view of their own flat (it needs an Apartment
family nothing reads yet).

**IFC-ready, not IFC-exporting.** Each Element Family carries its IFC class and each attribute its IFC
property mapping, as data, from M1; the MVP ships no IFC export (added when the first client or market
asks) and no IFC import.

It is not called BIM, and "Building Model" is retired. "Digital twin" stays off the screens and out
of the documents; marketing may use it once As built data flows, and not before.

Why: our market does not use BIM, so turning its 2D drawings into a working model is the core and the
moat (docs/intent.md), and many Dhaka Developers now run after-sales or facility management, so As
maintained has buyers. Glodon's "one model through the entire lifecycle" is the idea
(docs/research/glodon-bim-2.md §2, Ch.3); unlike Glodon's, ours is born from 2D drawings through a
QS-confirmed Takeoff, not from 3D design. Rejected: As built overwriting As designed (it loses the
basis the MD issued figures on); a separate model per phase (Glodon's "model silos", glodon-bim-2.md
Ch.2); live as designed only (construction and O&M as
separate products later would copy the model instead of reading it); a starter O&M set from Vextrus
defaults in the MVP (invented numbers in front of the MD, rigour ahead of users; docs/postmortem.md
cause 3); keeping "Building Model" (what every BIM tool calls its model; it says nothing new); a
coined brand name (explained every time).

## History
- 27 Sep 2026 (owner's decision, session 02 Q1): one identity across three Life Phases; the data
  carries the phase from M0; the MVP fills As designed. Evidence: docs/research/glodon-bim-2.md §2 and
  §7 (whose "O&M is not their business" the owner corrected). The owner's ruling: "Agree with B. And
  yes, now a days lots of Dhaka Developers we know run after-sales or facility management for their
  buildings, though all developers are not doing that but if we offer "as maintained" we will find
  buyers."
- 27 Sep 2026 (owner's decision, session 02 Q2): the names Live Model and Life Phase; the rule on
  "digital twin". The owner's ruling: "Agree with B, Live Model and Life Phase".
- 27 Sep 2026 (owner's decision, session 02 Q3): the MVP's readers are the QS, the MD, procurement and
  marketing through presentation on the share link; site, facility management and the buyer's flat
  view come later with their modules. The owner's ruling: "Agree with your recommendation on Q3".
- 27 Sep 2026 (owner's decision, session 02 Q6): values layered by Life Phase, As designed only from
  Confirmation, other phases by recorded acts with evidence; Deviations shown, never absorbed. The
  owner's ruling: "Agree with B on Q6, agree on Deviation joins the glossary".
- 27 Sep 2026 (owner's decision, session 02 Q12): IFC-ready data from M1, no IFC export or import in the
  MVP. The owner's ruling: "Agree with A on Q12".
