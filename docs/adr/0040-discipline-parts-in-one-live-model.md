# One Live Model per Building, made of Discipline Parts joined by Element Relations

A Building's Live Model (ADR 0035) is one store in one coordinate frame and one identity space, made of
**Discipline Parts**: Structural, Architectural, Electrical, Plumbing and sanitary, Fire, and further
MEP Parts as drawings bring them. Each Part has its own drawings and Revisions, its own Drafting Profile
(ADR 0039), Takeoff Steps, "template" (its Element Families and Attribute Definitions, as data) and
Confirmations, and may be locked to a responsible person. Every Part shares the Building's storeys and
grid, confirmed once and owned by the Building, not by a discipline (a storey holds both its structural
slab level and its finished floor level). Parts are joined by typed **Element Relations**, each
versioned, mapped to IFC's relations, and checked: *hosted in* (a socket in a wall, a light on a
ceiling), *passes through* (a pipe through a beam or slab, which raises its groove, sleeve or hole item),
*in room* (points counted and priced per room), *spans storeys* (a riser through each slab's void),
*same thing as* (the architect's WC and the plumber's WC: two Elements related, a Check raising a
Question when they disagree, priced once), and the structural ones junction ownership already uses. If
one end of a Relation changes or disappears in a Revision, a Question is raised; nothing is silently
orphaned. The Takeoff runs the shared storeys and grid first, then structure, then architecture, then
each MEP Part; a Part may start later than the others, carrying its allowance until it is read. One
query (ADR 0011), one viewer scene with a Discipline filter and saved views (ADR 0022) and one Priced
BOQ read across all Parts; per-discipline IFC files, if ever wanted, are derived from it with its ids.

Why: BIM practice splits models to separate who authors and answers for each discipline, not to give
things separate identities (Autodesk: linking "is primarily intended for linking separate buildings";
one workshared model with a workset per discipline for one team at one office); Bentley iTwin keeps one
coordinate system and one identity space with a Model per discipline, one responsible party and its own
locks, and relations across; Glodon's separate GTJ and GQI products re-import the civil model as a
read-only snapshot (docs/research/one-model-or-linked-models.md, refuter-checked). Vextrus authors
nothing, and in Dhaka one QS measures every discipline, so the file-era reasons to split do not apply,
while a Part per discipline keeps each consultant's drawings, revisions and responsibility separate, as
the owner's Revit instinct asks. Rejected: one merged model (forced merges; blurs whose drawing an
Element came from); separate linked discipline models (copied grids and storeys, snapshots, joins across
stores for every quantity); structure and architecture as one model with MEP linked (Glodon's snapshot).

Supersedes ADR 0003's "MEP as lump sums": MEP Parts are read into the Live Model as Elements with
identity and priced, in their own milestone after M2 (M3): equipment (lifts, generator, substation,
boards, pumps) and terminals (electrical points, which PWD prices with their wiring back to the board;
sanitary fixtures through the architectural reader; fire devices where drawn) as Elements; risers by
diameter and storey; pipes and sub-mains priced by QS-confirmed rules per point and per fixture until
true run lengths are read after the MVP (Dhaka MEP drawings draw runs schematically: lengths from them
would be invented); the legend proposes the office's Drafting Profile; board schedules and single-line
diagrams check N; a missing discipline is a Question, never zero. Until a Part is read, the MEP
template's ৳/sft lines are its allowance. Evidence: docs/research/edison-mep-read.md,
docs/research/mep-measurement-and-model.md. In one viewer scene merged per storey with the Discipline as
per-Element state, every discipline stayed within the draw-call budget (42–73), while merging per
discipline (what linked models would do) nearly doubled draw calls (up to 131); MEP runs should be drawn
as lines or instanced (80 % of triangles as boxes).

## History
- 28 Sep 2026 (owner's decision, session 02 Q31, on the owner's own question). The owner asked: "will it be
  too much to include Structural, Architectural and MEP in a single model or it'll be better if we create
  a model based on Structural or Architectural … and later MEP model on top of it … In our case exactly
  what solution we're gonna provide that will be most accurate". The owner's ruling: "Agree with D on
  Q31." The owner's facts: "Dhaka Developers usually don't have a separate MEP QS or engineer measuring
  MEP, in almost all cases the same QS measure everything. The MEP drawings usually arrive later than the
  structural and architectural sets, or sometimes with them - mostly arrive later."
- 28 Sep 2026 (owner's decision, session 02 Q29): MEP as its own milestone right after M2, read to the
  depth above; one Held-out Set with MEP drawings before it closes. The owner's ruling: "Agree with your
  recommendation B on Q29."
