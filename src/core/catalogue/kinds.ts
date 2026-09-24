// L-MEA-04's quantity kind: `kind = chapter × dimension, named for the trade`. The enum is
// code-owned and closed — a kind exists because this roster names it, never because a row or a
// person spelled one — and every member is named for a trade and its material and for nothing else.
//
// What "and for nothing else" means is decided in one place beside this one: `kind-law.ts` reads a
// name against the dimension set, the units, the element classes, the pricing roles and the book
// codes, and a member added here must answer that law with no objection (B-17).
// The masonry area's three name a trade and its material and nothing else: `masonry.brickwork`
// rather than anything spelling `brick` or `wall`, because both become element words the moment the
// class `brick_wall` stands in the roster beside them, and `finish.plaster` / `finish.paint` because
// a finish is applied to a SURFACE and the surface is the class that bears it (L-MEA-03).
export const KINDS = [
  "rcc.concrete",
  "rcc.formwork",
  "piling.bored",
  "piling.boring",
  "earthwork.excavation",
  "pcc.blinding",
  "masonry.brickwork",
  "finish.plaster",
  "finish.paint",
  // The rebar area's one kind. It names a trade and its material — reinforcement steel — and nothing
  // else: `rebar` is neither a dimension, a unit, an element class, a pricing role nor a book code,
  // which is why the bars a member holds are `rcc.rebar` and never anything spelling MASS or `kg`.
  "rcc.rebar",
  // The architect's finishes beyond plaster and paint (AM-16(4): "floor and wall finishes"), each a
  // trade a Dhaka bill prices by itself (I-541). `finish.flooring` is the floor finish, whatever it
  // is laid in; `finish.tiling` is tile fixed to a wall's face, the dado a kitchen and a toilet carry;
  // `finish.skirting` is the band at a wall's foot, run along the room. None spells `floor` or `wall`
  // as a word of its own, for the reason the masonry kinds give above. APPENDED after the rebar,
  // never inserted beside the paint: a bill numbers its groups in this roster's order (AM-14 §2).
  "finish.flooring",
  "finish.tiling",
  "finish.skirting",
] as const;

/** One quantity kind, drawn from the closed roster above. */
export type Kind = (typeof KINDS)[number];

/** Is this value one of the kinds? Asked wherever a kind arrives as text — a row, a wire, a book. */
export function isKind(value: unknown): value is Kind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}
