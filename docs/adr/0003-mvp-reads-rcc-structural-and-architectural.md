# The MVP reads RCC-framed buildings from structural and architectural drawings

The MVP handles RCC-framed residential and commercial buildings (the typical Dhaka Developer project,
often G+6 to G+14 on pile or mat foundations) and reads two Disciplines: structural (foundations,
columns, beams, slabs, stairs, schedules) and architectural (walls, openings, floors, finishes).
MEP enters the Priced BOQ as lump-sum items the QS types, not as read or modelled elements.

We rejected structural-only because the Building Model would not look like the Developer's building
and the Priced BOQ would miss the masonry, finishes, doors and windows. We rejected reading MEP now
because MEP drawings are schematic, and turning them into 3D is a separate hard problem that can wait.
Steel-framed and industrial buildings also wait.
