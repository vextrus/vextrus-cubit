// The note-clause class, as Jev is asked it (R-TO-034, L-AI-01): one closed choice over R-TO-034's
// five detailing figures with a no-match outcome, and one Noul over the same state — whether the
// lap this clause states governs over the development-length table printed on the same sheet
// (AM-03(e), T-NOTE-OVERRIDE). Two independent questions over one state, asked together: the
// fan-out the docs ask for.
//
// The request this arm recognises is the one `@/core/notes/model` composes. The criteria are drawn
// from the law's one roster (`@/core/notes/law`, ARCH-02) and never spelled here, so a kind the law
// gains is offered by this question without a word being edited (B-19).
//
// THE FIGURE IS NEVER ASKED FOR. What comes back is a class and a probability; the digits of a
// clause a model classified are read by the grammar's own reader afterwards (L-AI-03).
import { NOTE_KINDS } from "../../notes/law";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the note-clause request builder spells, sorted — what this arm is recognised by. */
const CLAUSE_KEYS = ["clause", "figures", "key", "lapTable", "layout"] as const;

/** The answer the choice gives when the clause states none of the five figures. */
const NONE_OF_THESE = "NONE_OF_THESE";

/** What each kind IS, for the question: the figure it names, as a drawing states it. */
const KIND_CRITERIA: Readonly<Record<string, string>> = Object.freeze({
  FY: "The reinforcement grade fy — the yield strength of the deformed bars, e.g. 'fy = 500 MPa'",
  FC: "The concrete cylinder strength f'c, e.g. \"f'c = 3500 psi\"",
  LAP: "The lap length for bars in TENSION, as a multiple of the bar diameter, e.g. 'LAP 50d TENSION'",
  HOOK: "The extension of the 135 degree stirrup or tie hook, as a multiple of the bar diameter, e.g. 'stirrup/tie 135 = 10d'",
  HOOK_MIN: "The minimum length of that hook in millimetres, e.g. 'min 75 mm'",
});

/** One general-note clause, as recognised on a request: what it says, and the state it is read in. */
export type ClauseTask = {
  kind: "clause";
  clause: string;
  key: string;
  layout: string;
  figures: readonly string[];
  lapTable: readonly string[];
};

/** Every member of this value is a string, or it is not the list the state names. */
function stringsOf(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item): item is string => typeof item === "string") ? (value as readonly string[]) : null;
}

/**
 * The note clause's arm.
 *
 * Each instruction names the state it reads by its backticked field path, as the docs ask, and
 * carries its whole meaning in itself — the question's id is never sent. The choice offers the
 * no-match outcome because a clause of a sheet's general notes states one of these five figures far
 * less often than it states none, and the docs ask for that member wherever the list might not
 * cover an input. The Noul states its boundary in `criteria.true` and `criteria.false`, because the
 * boundary between "states the lap that governs" and "states a lap that defers to the table" is the
 * subtle one AM-03(e) is about.
 */
export const noteClauseArm: TypeSafeArm<ClauseTask> = {
  question: MODEL_QUESTIONS.noteClause,
  keys: CLAUSE_KEYS,

  recognise(record): ClauseTask | null {
    const { clause, key, layout } = record;
    const figures = stringsOf(record["figures"]);
    const lapTable = stringsOf(record["lapTable"]);
    if (typeof clause !== "string" || typeof key !== "string" || typeof layout !== "string") return null;
    if (figures === null || lapTable === null) return null;
    return { kind: "clause", clause, key, layout, figures, lapTable };
  },

  guard(task): void {
    if (task.clause.trim() === "") {
      throw new Error(`the clause cited by ${JSON.stringify(task.key)} on ${JSON.stringify(task.layout)} says nothing, so Jev has nothing to classify; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const kind of NOTE_KINDS) criteria[kind] = KIND_CRITERIA[kind] ?? kind;
    criteria[NONE_OF_THESE] = "The clause states none of the figures above";
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      // The entity key is NOT posted: it is in the request's canonical content, so it is part of
      // what the answer is filed under, but an id says nothing a reader of the clause could use.
      state: { clause: task.clause, layout: task.layout, figures: [...task.figures], lap_table: [...task.lapTable] },
      questions: {
        clause_class: {
          type: "choice",
          instructions:
            "`clause` is one clause of the general notes printed on a structural construction drawing sheet; `layout` is the sheet it stands on; `figures` lists the numbers a deterministic parser found inside the clause, exactly as the drawing writes them. Which detailing figure does this clause STATE for the reinforcement of this building? Choose a class only where the clause states that figure itself. A clause that mentions laps, hooks or concrete without stating their figure states none of them; a clause stating a cover, a load, a wind speed, a bar diameter, a stirrup spacing, a curtailment fraction, a code reference or a drawing convention states none of them.",
          criteria,
        },
        lap_governs: {
          type: "noul",
          instructions:
            "`clause` is one clause of the general notes on a structural construction drawing sheet, and `lap_table` lists the headings of a development-length or lap table printed on the same sheet, empty where the sheet prints none. This clause states the tension lap that governs, over that table.",
          criteria: {
            true: "The clause states a tension lap and says, or plainly means, that it prevails over any tabulated development or lap length on the sheet — 'U.N.O.', 'THIS NOTE GOVERNS', 'unless noted otherwise' beside a stated lap",
            false: "The clause states no tension lap at all, or states one that defers to the table, or the sheet prints no such table",
          },
        },
      },
    };
    return {
      body,
      read(answers) {
        const chosen = choiceOf(answers["clause_class"]);
        return {
          payload: { kind: chosen === null || chosen === NONE_OF_THESE ? null : chosen, governs: noulOf(answers["lap_governs"]) },
          sources: [task.key],
        };
      },
    };
  },
};

/**
 * The probability one Noul answered, as the API spells it — `{"type":"noul","noul":0.93}` — or null
 * where Jev stated none. Nothing is supplied where nothing was said (L-AI-02): a proposition the
 * model did not judge is carried as unjudged, never as a zero.
 */
function noulOf(answer: unknown): number | null {
  if (answer === null || typeof answer !== "object") return null;
  const noul = (answer as { noul?: unknown }).noul;
  return typeof noul === "number" && Number.isFinite(noul) ? noul : null;
}
