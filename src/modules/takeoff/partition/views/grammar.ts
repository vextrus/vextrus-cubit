// L-CAD-06's caption grammar: what one view caption says the view is, read deterministically and
// never guessed. "Classification is a deterministic grammar first" — so the rules below are the whole
// of it, in a fixed precedence, and a caption no rule reads is answered UNTYPED with the registered
// reason it was not read. A grammar that guessed would put a class in front of a person as though it
// had been read off the drawing.
//
// Pure and total: the same caption is classified the same way forever, which is what lets a partition
// be rebuilt from an artifact and land on the same rows (L-REG-04).
import { REFUSALS } from "@/core/errors";
import { VIEW_TYPE, type ViewType } from "./law";

/** The reason a caption earns when no rule reads it, taken from the register rather than re-spelled. */
const CAPTION_UNCLASSIFIABLE = REFUSALS.CAPTION_UNCLASSIFIABLE.code;

/** What the grammar answers: the class it read, or UNTYPED with the reason it read nothing. */
export type Classification = { readonly type: ViewType; readonly reason: null } | { readonly type: ViewType; readonly reason: typeof CAPTION_UNCLASSIFIABLE };

/**
 * The DXF text escapes a caption carries. They toggle underline and overline or stand in for a
 * symbol, and none of them says anything about what the view is — so they are removed before a rule
 * looks at a word, and a caption written with them classifies as the same caption written without.
 */
const ESCAPES = ["%%U", "%%O", "%%C", "%%D", "%%P"];

/**
 * The words that make a plan a member's own rather than a floor's: L-CAD-06 says "member-scoped plans
 * are details", so "FOOTING F1 PLAN" is a detail while "GROUND FLOOR PLAN" is a layout plan.
 */
const MEMBER_WORDS = ["FOOTING", "BEAM", "COLUMN", "SLAB", "PILE", "PILECAP", "RAFT", "WALL", "LINTEL", "PEDESTAL", "PLINTH"];

/** One rule of the grammar: what it reads a caption as, and what has to be said for it to read. */
type Rule = { readonly reads: (said: Said) => boolean; readonly type: ViewType };

/** A caption as the rules see it: the words it is made of, normalised. */
type Said = { readonly words: ReadonlySet<string> };

/**
 * The grammar, first hit wins. The order is the law's own reading of what a caption most specifically
 * says: a stair's own plan and section are named before the general ones, the words that name a kind
 * of drawing outright (schedule, legend, title, detail) before the words that name a projection, and
 * a member-scoped plan before a layout plan — which is the rule L-CAD-06 states outright.
 */
const GRAMMAR: readonly Rule[] = [
  { reads: (said) => said.words.has("STAIR") && said.words.has("PLAN"), type: VIEW_TYPE.STAIR_PLAN },
  { reads: (said) => said.words.has("STAIR") && said.words.has("SECTION"), type: VIEW_TYPE.STAIR_SECTION },
  { reads: (said) => said.words.has(VIEW_TYPE.SCHEDULE), type: VIEW_TYPE.SCHEDULE },
  { reads: (said) => said.words.has("LEGEND") || said.words.has("NOTES") || said.words.has("NOTE"), type: VIEW_TYPE.LEGEND_NOTES },
  { reads: (said) => said.words.has(VIEW_TYPE.TITLE), type: VIEW_TYPE.TITLE },
  { reads: (said) => said.words.has(VIEW_TYPE.DETAIL), type: VIEW_TYPE.DETAIL },
  { reads: (said) => (said.words.has("LONGITUDINAL") || said.words.has("LONG")) && said.words.has("SECTION"), type: VIEW_TYPE.LONG_SECTION_STRIP },
  { reads: (said) => said.words.has("PLAN") && MEMBER_WORDS.some((word) => said.words.has(word)), type: VIEW_TYPE.DETAIL },
  { reads: (said) => said.words.has("PLAN"), type: VIEW_TYPE.LAYOUT_PLAN },
  { reads: (said) => said.words.has("SECTION"), type: VIEW_TYPE.MEMBER_SECTION },
];

/**
 * What this caption says the view is (L-CAD-06). A caption no rule reads — a mark, a number, a blank
 * — is answered UNTYPED carrying the registered reason, which is the honest answer and the one a
 * person or a model can then act on.
 */
export function classifyCaption(caption: string): Classification {
  const said = read(caption);
  const rule = GRAMMAR.find((candidate) => candidate.reads(said));
  return rule === undefined ? { type: VIEW_TYPE.UNTYPED, reason: CAPTION_UNCLASSIFIABLE } : { type: rule.type, reason: null };
}

/**
 * A caption as the rules read it. The escapes come out, the case is levelled and every run of
 * anything that is not a letter or a digit separates words — so "SECTION A-A" is read as the three
 * words it is, and a caption cannot be classified by a fragment of a longer word.
 */
function read(caption: string): Said {
  let text = caption.toUpperCase();
  for (const escape of ESCAPES) text = text.split(escape).join("");
  return { words: new Set(text.split(/[^A-Z0-9]+/u).filter((word) => word !== "")) };
}
