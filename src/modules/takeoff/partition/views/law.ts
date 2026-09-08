// L-CAD-06's view law, in one module: the closed branded vocabulary, the sole membership predicate,
// and the yield rule. "View types are a closed branded vocabulary … exported from one module beside
// the sole predicate, literals lint-banned elsewhere" — so this is the one file in `src/**` that may
// spell a member, and the scan beside it (`./__tests__/view-type-literals.test.ts`) is what refuses a
// second home.
//
// The spellings themselves are written down once, in `@/core/errors/transport-vocabulary`: six of the
// eleven bear an underscore and Q-07's register would otherwise read them as refusal codes nobody
// registered, and core — which may not import a module (ARCH-01) — needs them to name the classes a
// model may answer with. This file is where they become the LAW: branded, closed, and answerable.
//
// The brand is what makes the vocabulary closed at compile time: a `ViewType` cannot be written down,
// only obtained — through `VIEW_TYPE`, which names each member, or through `isViewType`, which judges
// a string the product read off a drawing, a wire or a row.
import { VIEW_TYPE_SPELLINGS } from "@/core/errors/transport-vocabulary";

/** One spelling of the declared vocabulary, before it is branded. */
type Spelling = (typeof VIEW_TYPE_SPELLINGS)[number];

/** The brand: nothing outside this module can produce one, so no string is a view type by accident. */
declare const VIEW_TYPE_BRAND: unique symbol;

/**
 * One member of L-CAD-06's closed vocabulary — layout plan · schedule · long-section strip · member
 * section · detail · stair plan · stair section · legend/notes · title · untyped · unassigned.
 */
export type ViewType = Spelling & { readonly [VIEW_TYPE_BRAND]: "view-type" };

/**
 * Each spelling, as the member it names. This is how a caller obtains a view type: reading one off
 * this record is the same act as declaring it, and the record is frozen so the vocabulary cannot grow
 * a twelfth member at runtime.
 */
export const VIEW_TYPE: Readonly<{ [S in Spelling]: ViewType }> = Object.freeze(
  Object.fromEntries(VIEW_TYPE_SPELLINGS.map((spelling) => [spelling, spelling])) as { [S in Spelling]: ViewType },
);

/** The closed roster, in the Bible's own order. Frozen: a list a caller can push onto is not closed. */
export const VIEW_TYPES: readonly ViewType[] = Object.freeze(VIEW_TYPE_SPELLINGS.map((spelling) => VIEW_TYPE[spelling]));

/**
 * Is this value a member of the vocabulary? The sole membership predicate (L-CAD-06): every reading
 * of a view type — from a row, a wire, a model's answer — passes through here, so "is it one of the
 * eleven" has exactly one answer. Exact, and deliberately so: a kebab spelling, a title-cased one,
 * a blank and a number are all things that look like a class without being one.
 */
export function isViewType(value: unknown): value is ViewType {
  return typeof value === "string" && (VIEW_TYPE_SPELLINGS as readonly string[]).includes(value);
}

/**
 * May a view of this type yield instances? L-CAD-06: "Only layout-plan-class views may yield
 * instances; schedules, sections and details yield types and dimensions only". The rule lives here
 * beside the predicate because it is a statement about the vocabulary itself — a second module
 * answering it would be a second home for the same law (B-17, ARCH-02).
 */
export function yieldsInstances(type: ViewType): boolean {
  return type === VIEW_TYPE.LAYOUT_PLAN;
}
