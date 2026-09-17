// AM-14 §2's item number, as the takeoff module reaches it: `S.G.I` — the section's ordinal among
// L-BD-08's six, the group's ordinal in the catalogue's order, the line's ordinal inside its group.
//
// ONE DERIVATION, TWO READERS (I-269, B-17). The screen and the rendered PDF both number a draft,
// and a number a reader saw that the document then printed differently would be two answers to one
// question. So the derivation stands where BOTH can reach it — `src/core/documents/kinds/boq-draft-law.ts`,
// the pure law beside the presenter that prints it, because ARCH-01 forbids the document seam to
// import this module — and this file publishes it to the takeoff module under the interfaces' name.
// The law rather than the kind: a kind names its template, which resolves through `node:fs`, and a
// screen that numbers a draft in the browser may not carry a process boundary (AS-01).
//
// IT IS STORED NOWHERE. The catalogue order and the level stack already decide it; a stored number
// would be a second home for that fact, and a draft renumbered by one inserted line would then
// contradict the number somebody had already quoted.
export { numberItems } from "@/core/documents/kinds/boq-draft-law";
export type { NumberableGroup, NumberableLine, NumberableSection } from "@/core/documents/kinds/boq-draft-law";
