// The silent-sheet reading, as Jev is asked it (R-AI-001, L-AI-01): which candidate text is the
// title, which the number, which discipline — three choices over one state, asked together (the
// fan-out pattern: independent questions over the same state run in one request).
//
// The request this arm recognises is the one `@/modules/ai/sheet-understanding` composes; it is
// recognised by the exact key set of its canonical content, never by its question name, because the
// name is not hashed into the request's identity.
import { DISCIPLINES } from "../../sheets";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** How many of a sheet's texts are put to Jev as candidates, in the artifact's own order. */
export const CANDIDATE_CAP = 40;

/** How long a candidate text may be in the question; the whole text is what a chosen one answers with. */
const CRITERION_LENGTH = 100;

/** The answer a number question may give when the sheet states none. */
const NO_NUMBER = "NONE";

/** The key set the sheet-understanding request builder spells, sorted — what this arm is recognised by. */
const SHEET_KEYS = ["blockAttributes", "census", "derived", "entities", "layout"] as const;

/** One text a sheet reading may cite: the key it is cited by, and what it says. */
type Candidate = { key: string; text: string };

/** One silent sheet, as recognised on a request: its layout name and the texts a reading may cite. */
export type SheetTask = { kind: "sheet"; candidates: readonly Candidate[]; layout: string };

/** What each discipline is, for the question; the list itself is the closed one R-TO-004 spells. */
const DISCIPLINE_CRITERIA: Readonly<Record<string, string>> = Object.freeze({
  STRUCTURAL: "Structural plans, framing, reinforcement, foundations, columns, beams, slabs",
  ARCHITECTURAL: "Architectural plans, elevations, finishes, partitions, openings",
  MEP: "Mechanical, electrical, plumbing, fire or HVAC services",
  CIVIL: "Civil, site, drainage or infrastructure works",
  OTHER: "General, cover, index or a discipline not listed",
});

/**
 * The silent sheet's arm.
 *
 * Each instruction names the state it reads by its field path, as the docs ask, and says what a
 * candidate is; the number question offers the no-match outcome because a sheet may state none, and
 * the title question does not, because a reading with no title is no reading (the seam refuses it
 * as MALFORMED rather than this adapter guessing one).
 */
export const sheetReadingArm: TypeSafeArm<SheetTask> = {
  question: MODEL_QUESTIONS.sheetReading,
  keys: SHEET_KEYS,

  recognise(record): SheetTask {
    const layout = record["layout"];
    const name = layout !== null && typeof layout === "object" ? (layout as { name?: unknown }).name : undefined;
    return { kind: "sheet", layout: typeof name === "string" ? name : "", candidates: candidatesOf(record) };
  },

  guard(task): void {
    if (task.candidates.length === 0) {
      throw new Error(`the sheet ${JSON.stringify(task.layout)} carries no text a reading could cite, so Jev has nothing to choose from; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const candidates = task.candidates.slice(0, CANDIDATE_CAP);
    const byId = new Map<string, Candidate>();
    const criteria: Record<string, string> = {};
    candidates.forEach((candidate, index) => {
      const id = `cand_${index + 1}`;
      byId.set(id, candidate);
      criteria[id] = candidate.text.slice(0, CRITERION_LENGTH);
    });
    const disciplineCriteria: Record<string, string> = {};
    for (const discipline of DISCIPLINES) disciplineCriteria[discipline] = DISCIPLINE_CRITERIA[discipline] ?? discipline;
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      state: { layout: task.layout, candidates: criteria },
      questions: {
        discipline: {
          type: "choice",
          instructions:
            "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id, and `layout` is the sheet's layout name. Which engineering discipline is this drawing sheet?",
          criteria: disciplineCriteria,
        },
        title_candidate: {
          type: "choice",
          instructions: "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id. Which candidate is the sheet's title — the name of what the sheet shows, as its title block states it?",
          criteria,
        },
        number_candidate: {
          type: "choice",
          instructions:
            "`candidates` holds the texts found on one construction drawing sheet, keyed by candidate id. Which candidate is the sheet's number or identifier — the short code its title block files it under, such as S-02 or C-402? Choose NONE if no candidate states one.",
          criteria: { ...criteria, [NO_NUMBER]: "The sheet states no number" },
        },
      },
    };
    return {
      body,
      read(answers) {
        const title = byId.get(choiceOf(answers["title_candidate"]) ?? "");
        const numberChoice = choiceOf(answers["number_candidate"]);
        const number = numberChoice === NO_NUMBER ? undefined : byId.get(numberChoice ?? "");
        const discipline = choiceOf(answers["discipline"]);
        const sources = [...new Set([title?.key, number?.key].filter((key): key is string => key !== undefined))];
        return {
          payload: { number: number?.text ?? null, title: title?.text ?? null, discipline: discipline ?? null, captions: [] },
          sources,
        };
      },
    };
  },
};

/**
 * The texts a sheet reading may cite, in the request's own order: block attributes by the key of
 * the block they belong to, then entities and derived paint by their own keys. Nothing is deduped
 * here — a title block's attributes share one block key and are each a candidate — the citation
 * list is where a key is said once.
 */
function candidatesOf(evidence: Record<string, unknown>): Candidate[] {
  const out: Candidate[] = [];
  const said = (key: unknown, text: unknown): void => {
    if (typeof key === "string" && typeof text === "string" && text.trim() !== "") out.push({ key, text: text.trim() });
  };
  for (const attribute of listOf(evidence["blockAttributes"])) said(attribute["src"], attribute["text"]);
  for (const entity of listOf(evidence["entities"])) said(entity["key"], entity["text"]);
  for (const derived of listOf(evidence["derived"])) said(derived["key"], derived["text"]);
  return out;
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === "object") : [];
}
