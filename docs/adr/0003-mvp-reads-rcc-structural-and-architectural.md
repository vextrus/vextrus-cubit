# The MVP reads RCC-framed buildings from structural and architectural drawings

**MEP as lump sums is superseded by ADR 0040** (28 Sep 2026): MEP is read into the Live Model as Discipline
Parts, depth and milestone per session 02 Q29. RCC-framed buildings remain the MVP's scope.

The MVP handles RCC-framed residential and commercial buildings (the typical Dhaka Developer project,
often G+6 to G+14 on pile or mat foundations) and reads two Disciplines: structural (foundations,
columns, beams, slabs, stairs, schedules) and architectural (walls, openings, floors, finishes).
MEP enters the Priced BOQ as lump-sum items the QS types from a template (ADR 0007, step 14), not as
read or modelled elements.

Rejected: structural-only (the Live Model would not look like the Developer's building, and the
Priced BOQ would miss masonry, finishes, doors and windows); reading MEP now (MEP drawings are
schematic, and turning them into 3D is a separate hard problem). Steel-framed and industrial
buildings also wait.

## History
- 25 Sep 2026: decided. Unchanged by session 01, except that MEP lump sums now come from a template
  (ADR 0007).
- 28 Sep 2026 (owner's decision, session 02 Q29 opened, Q31): "we'll not left nothing in a Building:
  Everything Structural, Architectural and MEP … will be in live model as Elements with identity and with
  priced BOQ." MEP as lump sums superseded by ADR 0040.
