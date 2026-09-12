# The bill taxonomy — why Masonry sits under Superstructure, and where every class bills

**Status:** decided, 2026-09-12, recorded as **AM-16** in `docs/specs/cubit.bible.xml`.
**Supersedes:** AM-14 §1's section list and §2's section ordinals. Everything else of AM-14 stands.

## The contradiction

`L-BD-08` (the Bible, line 244) names the presentation taxonomy:

> Six bills — Substructure · Superstructure · Finishes · Electrical · Plumbing · External

AM-14 wrote "Masonry, Finishes, External works and Provisional sums … L-BD-08's remaining sections"
and numbered `1 Substructure / 2 Superstructure / 3 Masonry / 4 Finishes / 5 External / 6 Provisional`.
Masonry and Provisional sums are not L-BD-08's sections; **Electrical and Plumbing were dropped.**
`L-MEA-08`'s network algebra publishes MEP runs by diameter, so after AM-14 those runs billed
nowhere — while AM-14 itself ruled that "a class or kind with no mapping is a defect in this
amendment, not a judgement call for the builder". So it is repaired here, not in a builder's head.

## The decision

**The six sections are L-BD-08's six, in L-BD-08's order.** AM-14's plinth boundary and its S.G.I
numbering are unchanged; only the section list and the section ordinals move.

### Masonry → Superstructure (above plinth), Substructure below it

Decided as a QS would decide it, and the reasoning is the point:

1. **L-BD-08 cuts by location, then by service trade, then by site.** Substructure/Superstructure is
   a *location* cut at the plinth. Electrical/Plumbing is a *service-trade* cut. External is a *site*
   cut. Finishes is the one *surface-trade* bill. Masonry is none of those things — it is building
   fabric, and its location is what distinguishes it, so the location cut is the one that takes it.
2. **Finishes is a bill of square metres; brickwork is cubic metres.** PWD SoR prices brickwork in
   cum at nominal declared thickness (250/375 mm) and plaster in sqm by thickness, mix, face and
   floor (`L-BD-04`). Filing brickwork under Finishes puts the largest cum item in the bill into a
   bill of surface areas, and a section subtotal then means nothing.
3. **`L-MEA-04` maps trade first and `L-BD-01` makes the item description the method.** Brickwork's
   item description is a wall-building description, not a finishing one. A taxonomy that separates
   an item from the method that produced it breaks the chain the product exists to keep.
4. **A tenderer reads brick walls beside the frame they infill.** Superstructure is where a reader
   looks for the enclosure of the floors they just priced.

**Lintels follow their masonry, not the finish over them.** An RCC lintel over a scheduled opening
bills to the section its wall bills to — above plinth, Superstructure. (AM-14 filed lintels under
Masonry; with Masonry gone, "follow the wall" is the rule that needs no further judgement.)

**The plinth still splits.** A wall, column or shear wall that straddles the plinth is split at the
plinth level named in the level stack, each part billing to its own section, the split shown in the
line's bases and never hidden (AM-14 §1, unchanged). Brickwork below plinth bills to Substructure.

### Provisional sums → a line within each bill, never a seventh bill

A provisional sum provides for work in a *scope*, so it is carried at the end of the bill whose
scope it provides for, labelled `Provisional sum`. It is excluded from bid comparison (`L-BD-06`:
"provisional sums and daywork excluded from comparison") and from the coverage denominator.

It is **never** a place to put a class the mapping failed to place. An unmapped class goes to
`UNCLASSIFIED` under L-BD-08's own resolver — kept, labelled, reason stated, never dropped — which
is a *visible* defect. A provisional sum would make it an invisible one, and `L-QTY-04` governs: a
figure that hides what it does not cover is the failure this product is built against.

## The mapping — every class, every kind

Resolution is L-BD-08's, unchanged: element-type override → division/group → division →
`UNCLASSIFIED`. The resolver records which row decided; the taxonomy version stamps the document.

| class / source | kinds it bears | bill | note |
| --- | --- | --- | --- |
| excavation | excavation (banded by depth and lead) | Substructure | needs SITE facts (`L-MEA-06`) |
| earthwork, backfill | earthwork | Substructure | |
| blinding | concrete | Substructure | |
| `pile` | pile (count × length), concrete, rebar | Substructure | no schedule ⇒ `PILE_LENGTH_UNSTATED` (AM-06(2)); count + diameter publish, no length, no volume |
| `pile_cap` | concrete, formwork, rebar | Substructure | |
| `footing` | concrete, formwork, rebar | Substructure | |
| `tie_beam` (grade/tie/plinth beam) | concrete, formwork, rebar | Substructure | |
| plinth protection | concrete, brickwork | Substructure | |
| underground reservoir, septic structure | concrete, formwork, rebar, brickwork | Substructure | |
| `column`, `shear_wall` — below plinth | concrete, formwork, rebar | Substructure | the split part only |
| `column`, `shear_wall` — above plinth | concrete, formwork, rebar | Superstructure | band-aware per `L-MEA-09` |
| `beam` | concrete, formwork, rebar | Superstructure | |
| `slab` | concrete, formwork, rebar | Superstructure | |
| `stair` | concrete, formwork, rebar | Superstructure | complex geometry defers (AM-06(3)) |
| parapet | concrete, brickwork | Superstructure | |
| overhead tank | concrete, formwork, rebar | Superstructure | |
| brick wall 250 / 125 (masonry) | brickwork by nominal thickness | Superstructure | **this decision**; below plinth ⇒ Substructure |
| `lintel` | concrete, formwork, rebar | follows its wall | absent opening schedule ⇒ `LINTEL_SOURCE_ABSENT` (AM-06(5)) |
| plaster face | plaster (sqm by thickness, mix, face, floor) | Finishes | |
| paint face | paint | Finishes | |
| floor / wall / ceiling finish | finish area | Finishes | |
| MEP run — electrical (conduit, cable, earthing) | network run by diameter/size | **Electrical** | the rail publishes runs; fittings derive, never count (`L-MEA-08`) |
| MEP run — water supply, sanitary, drainage | network run by diameter | **Plumbing** | as above |
| MEP run — discipline unresolved | network run | `UNCLASSIFIED` | with the reason; never a trade bill by guess |
| boundary wall, gate, ramp, paving, hardstanding, landscaping, external civil drain | brickwork, concrete, excavation | External | |
| provisional sum | — | a line in the bill it provides for | never its own bill |

**A services run bills to its trade bill wherever it runs**, including outside the building line.
External is civil work only. This is written down so that "which bill does the external water main
go in" is never a builder's judgement call — which is exactly what AM-14 ruled and then made
impossible by deleting the two trade bills.

## What is not decided here

The taxonomy is data (`L-BD-08`: "as swappable data"), and no `src/` taxonomy exists yet — `grep
Substructure src/` finds nothing. This document and AM-16 are the *specification* the M3 node that
builds the BOQ presentation implements; the mapping table above is what its fixture must prove, row
by row, against `F-RCC6-BNBC`.
