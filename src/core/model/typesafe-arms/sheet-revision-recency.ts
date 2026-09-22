// The sheet's revision recency, as Jev is asked it (R-TO-004, L-AI-01): a `choice` over the revision
// marks and printed revision rows CODE found on one sheet, and a `score` placing that sheet on the
// spectrum the caller spelled — asked together over one state, which is the fan-out the docs
// prescribe (independent questions, one state, one request; docs.typesafe.ai/concepts/state).
//
// The two questions are one question set for a reason L-AI-02 fixes: a score is a number and cites
// nothing, so a recency reading alone could never carry the non-empty `sources` a Proposal must
// have. The choice is what makes the reading citable — its chosen candidate's own keys are the
// proposal's sources, exactly as the sheet reading's title and number candidates are — and an answer
// that chooses NONE cites nothing on purpose, which the seam refuses as UNSOURCED. That refusal is
// the honest abstention: what a sheet nobody could date becomes is the caller's (L-AI-02).
//
// The request this arm recognises is the one `@/modules/ai/sheet-revision` composes. It carries the
// spectrum's own sentences (`levels`) with it, so this file spells no recency vocabulary of its own:
// what a sheet's issue state may be read AS is that module's law, core may not name it (ARCH-01),
// and a second spelling here could silently disagree with the roster the caller decodes an answer
// back out of (B-17). What this arm DOES own is the wire's own no-match outcome, `NONE`, because it
// is not a reading — it is the absence of one.
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the sheet-revision request builder spells, sorted — what this arm is recognised by. */
const REVISION_KEYS = ["layout", "levels", "revisionMarks", "revisionRows", "setRows"] as const;

/**
 * How many of a sheet's revision candidates are put to Jev, in the artifact's own order. Its own
 * bound, at the sheet reading's figure and for the sheet reading's reason: a question is a bounded
 * thing, and a sheet whose table runs to forty lines is a sheet whose latest row is not in the
 * forty-first.
 */
const CANDIDATE_CAP = 40;

/** How long a candidate may be in the question; the whole line is what a chosen one answers with. */
const CRITERION_LENGTH = 100;

/** The answer a sheet that states no revision at all earns — the choice's no-match outcome. */
const NONE = "NONE";

/** What `NONE` covers, spelled once: a sheet whose strip and table say nothing about its issue. */
const NONE_MEANS = "The sheet states no revision mark and prints no revision row";

/** The ids the two answers come back under. */
const EVIDENCE = "revision_evidence";
const RECENCY = "revision_recency";

/** One line of a sheet's revision evidence: what it says, and the keys it is printed as. */
type Candidate = { readonly keys: readonly string[]; readonly text: string };

/** One sheet's issue state, as recognised on a request: its own evidence, its set's, and the spectrum. */
export type RevisionTask = {
  kind: "revision";
  readonly layout: string;
  readonly levels: readonly string[];
  readonly marks: readonly Candidate[];
  readonly rows: readonly Candidate[];
  /** The other sheets' lines, passed to Jev as the state they already are — never renamed, never reordered. */
  readonly setRows: JsonValue;
};

/** What the sheet's own evidence is, in the words the choice is put in. */
const EVIDENCE_INSTRUCTIONS = [
  "`revisionMarks` holds the revision marks this sheet's title block states, keyed by candidate id, and `revisionRows` holds the rows of its revision table, keyed by candidate id, each row as the sheet prints it (mark, date, description).",
  "`layout` is the sheet's layout name.",
  "Which candidate states the LATEST revision this sheet was issued at — the last row of its revision table, or the mark its title block files it under?",
  `Choose ${NONE} if no candidate states a revision.`,
].join(" ");

/** What the spectrum is read over, in the words the score is put in. */
const RECENCY_INSTRUCTIONS = [
  "`revisionMarks` holds the revision marks this sheet's title block states and `revisionRows` holds the rows of its revision table, each as the sheet prints it.",
  "`setRows` holds, for every OTHER sheet of the same drawing set, the same two things, so the set is the benchmark this sheet is read against; it is empty where the drawing carries no other sheet.",
  "`layout` is the sheet's layout name.",
  "How current is this sheet's issue state, read from what the sheet itself prints and from what its set prints beside it?",
  "Read what is printed and never the calendar: do not compute a date and do not order the set.",
].join(" ");

/**
 * The sheet's revision arm.
 *
 * Each instruction names the state it reads by its backticked field path, as the docs ask, and
 * carries the whole of its own meaning — the question ids are never sent. The choice offers the
 * no-match outcome because a sheet may print nothing about its issue; the score offers none, because
 * a spectrum's levels are the whole of what it may answer (docs.typesafe.ai/primitives/score, read
 * 2026-09-22: "The order of the array is the numbering").
 */
export const sheetRevisionRecencyArm: TypeSafeArm<RevisionTask> = {
  question: MODEL_QUESTIONS.sheetRevisionRecency,
  keys: REVISION_KEYS,

  recognise(record): RevisionTask | null {
    const layout = record["layout"];
    const levels = stringsOf(record["levels"]);
    const marks = markCandidatesOf(record["revisionMarks"]);
    const rows = rowCandidatesOf(record["revisionRows"]);
    const setRows = record["setRows"];
    if (typeof layout !== "string" || levels === null || marks === null || rows === null || !Array.isArray(setRows)) return null;
    // The record is the request's own content, read back off JSON, so what stands in `setRows` is
    // JSON by construction; it is passed to Jev as the state it already is — nothing renamed,
    // reordered or dropped on the way (docs.typesafe.ai/concepts/state), so what was hashed is what
    // was asked.
    return { kind: "revision", layout, levels, marks, rows, setRows: setRows as JsonValue };
  },

  guard(task): void {
    if (task.marks.length === 0 && task.rows.length === 0) {
      throw new Error(`the sheet ${JSON.stringify(task.layout)} prints no revision mark and no revision row, so Jev has nothing to choose from; no question was posted`);
    }
    // A spectrum of one level is no spectrum, and the contract admits between two and ten
    // (docs.typesafe.ai/primitives/score). A caller spelling anything else has composed a question
    // the provider would refuse, which is infrastructure's fault and never a product decision (B-14).
    if (task.levels.length < 2 || task.levels.length > 10) {
      throw new Error(`a score is read over between two and ten levels, and this request spells ${task.levels.length}; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    // The marks first, then the rows, in the artifact's own order: the cap is a bound on the
    // question and never a silent truncation of an answer.
    const marks = task.marks.slice(0, CANDIDATE_CAP);
    const rows = task.rows.slice(0, Math.max(0, CANDIDATE_CAP - marks.length));
    const byId = new Map<string, Candidate>();
    const markState: Record<string, string> = {};
    const rowState: Record<string, string> = {};
    const criteria: Record<string, string> = {};
    [...marks, ...rows].forEach((candidate, index) => {
      const id = `cand_${index + 1}`;
      const said = candidate.text.slice(0, CRITERION_LENGTH);
      byId.set(id, candidate);
      criteria[id] = said;
      if (index < marks.length) markState[id] = said;
      else rowState[id] = said;
    });
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      state: { layout: task.layout, revisionMarks: markState, revisionRows: rowState, setRows: task.setRows },
      questions: {
        [EVIDENCE]: { type: "choice", instructions: EVIDENCE_INSTRUCTIONS, criteria: { ...criteria, [NONE]: NONE_MEANS } },
        [RECENCY]: { type: "score", instructions: RECENCY_INSTRUCTIONS, criteria: [...task.levels] },
      },
    };
    return {
      body,
      read(answers) {
        // Nothing is supplied where Jev supplied nothing (L-AI-02): a candidate it did not choose is
        // no evidence, a score it did not state is null, and the caller's decoder refuses the
        // reading as MALFORMED. A choice of NONE — or of a candidate this question never offered —
        // cites nothing, and the seam refuses the reading as UNSOURCED.
        const chosen = byId.get(choiceOf(answers[EVIDENCE]) ?? "");
        const score = scoreOf(answers[RECENCY]);
        return {
          payload: { evidence: chosen?.text ?? null, level: levelOf(answers[RECENCY], score), score },
          sources: chosen === undefined ? [] : [...chosen.keys],
        };
      },
    };
  },
};

/** The `score` of one answer, as Jev spelled it, or null where it gave no figure. */
function scoreOf(answer: unknown): number | null {
  if (answer === null || typeof answer !== "object") return null;
  const score = (answer as { score?: unknown }).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

/**
 * Which level Jev put this sheet at: the one its own distribution concentrated on, ties going to the
 * lower level. That is the level Jev CHOSE, as a choice's `choice` is the option it put most
 * probability on (docs.typesafe.ai/primitives/score: the score itself is "a weighted mean of level
 * numbers", which is a position between levels and not one of them).
 *
 * Where it stated no distribution at all, the nearest level to the score it did state is the best
 * reading left; where it stated neither, there is no level and the caller's decoder refuses the
 * reading rather than this arm inventing one.
 */
function levelOf(answer: unknown, score: number | null): number | null {
  const stated = distributionOf(answer);
  if (stated !== null) return stated;
  return score === null ? null : Math.round(score);
}

/** The level carrying the greatest stated probability, ties to the lower, or null where none is stated. */
function distributionOf(answer: unknown): number | null {
  if (answer === null || typeof answer !== "object") return null;
  const probabilities = (answer as { probabilities?: unknown }).probabilities;
  if (probabilities === null || typeof probabilities !== "object" || Array.isArray(probabilities)) return null;
  let level: number | null = null;
  let held = -Infinity;
  for (const [name, figure] of Object.entries(probabilities as Record<string, unknown>).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const at = Number(name);
    if (!Number.isInteger(at) || typeof figure !== "number" || !Number.isFinite(figure)) return null;
    if (figure > held) {
      held = figure;
      level = at;
    }
  }
  return level;
}

/** The revision marks of the request as candidates, `TAG TEXT` each, or null where they are not marks. */
function markCandidatesOf(value: unknown): Candidate[] | null {
  return candidatesOf(value, (record) => {
    const { src, tag, text } = record;
    if (typeof src !== "string" || typeof tag !== "string" || typeof text !== "string") return null;
    return { keys: [src], text: `${tag} ${text}`.trim() };
  });
}

/** The revision rows of the request as candidates, each keyed by the texts it is printed as. */
function rowCandidatesOf(value: unknown): Candidate[] | null {
  return candidatesOf(value, (record) => {
    const keys = stringsOf(record["keys"]);
    const text = record["text"];
    if (keys === null || keys.length === 0 || typeof text !== "string" || text.trim() === "") return null;
    return { keys, text: text.trim() };
  });
}

/** One list of the request read as candidates: every member, or null where any member is not one. */
function candidatesOf(value: unknown, read: (record: Record<string, unknown>) => Candidate | null): Candidate[] | null {
  if (!Array.isArray(value)) return null;
  const candidates: Candidate[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = read(item as Record<string, unknown>);
    if (candidate === null || candidate.text === "") return null;
    candidates.push(candidate);
  }
  return candidates;
}

/** The strings of a list, or null where the value is not a list of strings that say something. */
function stringsOf(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") return null;
    strings.push(item);
  }
  return strings;
}

/** The key set and the two question ids, published for the test that puts a recorded request through this arm. */
export { REVISION_KEYS, EVIDENCE as REVISION_EVIDENCE_ID, NONE as REVISION_EVIDENCE_NONE, RECENCY as REVISION_RECENCY_ID };
