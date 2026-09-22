// The coverage cause, as Jev is asked it (R-TO-052, L-QTY-05, L-AI-01): one choice over the two
// causes a PERSON may declare an unmeasured cell of the residue under, plus the no-match outcome for
// a cell whose evidence draws no boundary at all.
//
// The candidate set is never spelled here: it is `SCOPE_DECLARATION_CAUSES`, read from the one home
// that holds it beside the codes it is made of (ARCH-02, Q-07), so a roster that grows a third
// declarable cause grows this question with it. The machine's own causes — INGESTION_TRUNCATED,
// NO_BEARER_SIGHTED, KIND_NOT_YET_SEEDED — are deliberately not candidates: they are read off the
// campaign by arm order and win before a cell ever reads NOT_ESTABLISHED, so a cell that could be
// one of them is never asked about and Jev cannot answer one.
//
// The request this arm recognises is the one `@/modules/takeoff/coverage` composes; it is recognised
// by the exact key set of its canonical content, never by its question name, because the name is not
// hashed into the request's identity.
import { SCOPE_DECLARATION_CAUSES } from "../../errors/residue";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the coverage-cause request builder spells, sorted — what this arm is recognised by. */
const CAUSE_KEYS = ["cell", "key", "observations", "sightings"] as const;

/**
 * The answer for a cell that stands outside nothing: the evidence shows only that it has not been
 * measured yet. It is the escape hatch the docs ask every closed list to carry, and it is REFUSED by
 * the caller's decoder rather than stored — an honest abstention is not a boundary (L-AI-02).
 */
export const NOTHING_TO_DECLARE = "NOTHING_TO_DECLARE";

/** Where the cell stands: the kind, the class that bears it, and the storey it stands on. */
type CauseCell = { kind: string; class: string; level: string; ordinal: number | null };

/** Where the class was seen: which of L-QTY-05's three channels saw it, and on which sheet. */
type CauseSighting = { channel: string; layout: string };

/** What a rail reported when it read that sighting and offered no quantity. */
type CauseObservation = { rail: string; reason: string };

/** One unmeasured cell of the residue, as recognised on a request. */
export type CauseTask = {
  kind: "cause";
  cell: CauseCell;
  /** The one source key an answer cites: the caption anchor of the view the cell was sighted in. */
  key: string;
  sightings: readonly CauseSighting[];
  observations: readonly CauseObservation[];
};

/**
 * What each choice means, in the words a quantity surveyor draws the boundary in. The two declarable
 * causes are keyed by the registry's own codes — the roster below is what makes that a reading and
 * not a coincidence — and the no-match outcome is this question's own.
 */
const CAUSE_CRITERIA: Readonly<Record<string, string>> = Object.freeze({
  NOT_IN_PROJECT_SCOPE:
    "The work is outside this project altogether: the class was sighted, but what was sighted belongs to another contract, to existing structure, or to works this project does not measure — no quantity for it should ever stand in this project's measurement.",
  NOT_IN_THIS_BILL:
    "The work belongs to the project but not to THIS bill: it is real and will be built, and this bill is drawn to exclude it — a provisional sum, another package, or a later bill.",
  [NOTHING_TO_DECLARE]:
    "The evidence shows no boundary at all. The drawings carry this kind on this class and level and the rails simply could not read it yet — the cell should be measured, not declared outside anything.",
});

/** The question's whole meaning, naming the state it reads by its own field paths (the docs' rule). */
const INSTRUCTIONS = [
  "`cell` names one work item of a construction bill that this measurement campaign published no quantity for and that nothing so far explains — its `cell.kind` (the quantity kind), `cell.class` (the element class that bears it) and `cell.level` (the storey it stands on, `cell.ordinal` its place in the stack).",
  "`sightings` lists where that class was seen in the campaign's drawings: `sightings[].channel` is which reader saw it (REGISTER = a registered sighting, PARTITION = a placement on a sheet, LAYOUT = membership of a view) and `sightings[].layout` is the sheet it was seen on.",
  "`observations` is what the measuring rails reported when they read those sightings and offered no quantity: `observations[].rail` is the class and kind the rail measured for and `observations[].reason` is the registered reason it published.",
  `Which boundary does this evidence say a quantity surveyor would draw around this cell? Choose ${NOTHING_TO_DECLARE} where the evidence shows only that the cell has not been measured yet.`,
].join(" ");

/** The coverage cause's arm: one closed choice, and the no-match outcome for a cell outside nothing. */
export const coverageCauseArm: TypeSafeArm<CauseTask> = {
  question: MODEL_QUESTIONS.coverageCause,
  keys: CAUSE_KEYS,

  recognise(record): CauseTask | null {
    const cell = cellOf(record["cell"]);
    const key = record["key"];
    const sightings = listOf(record["sightings"], sightingOf);
    const observations = listOf(record["observations"], observationOf);
    if (cell === null || typeof key !== "string" || sightings === null || observations === null) return null;
    return { kind: "cause", cell, key, sightings, observations };
  },

  guard(task): void {
    // A cell no channel sighted is no cell of the residue at all: what would be put to Jev is an
    // address and no evidence, and an answer to that would be a guess about a drawing nobody read.
    if (task.sightings.length === 0) {
      throw new Error(`the cell ${JSON.stringify(`${task.cell.kind} on ${task.cell.class}, ${task.cell.level}`)} carries no sighting a boundary could be read from, so Jev has nothing to judge; no question was posted`);
    }
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const cause of SCOPE_DECLARATION_CAUSES) criteria[cause] = CAUSE_CRITERIA[cause] ?? cause;
    criteria[NOTHING_TO_DECLARE] = CAUSE_CRITERIA[NOTHING_TO_DECLARE] ?? NOTHING_TO_DECLARE;
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      // The citable key is not state: it is what an answer RESTS on, and a key in the state would be
      // one more thing for Jev to read rather than the evidence itself (the caption precedent).
      state: {
        cell: { ...task.cell },
        sightings: task.sightings.map((sighting) => ({ ...sighting })),
        observations: task.observations.map((observation) => ({ ...observation })),
      },
      questions: {
        cause: { type: "choice", instructions: INSTRUCTIONS, criteria },
      },
    };
    return {
      body,
      read(answers) {
        return { payload: { cause: choiceOf(answers["cause"]) ?? null }, sources: [task.key] };
      },
    };
  },
};

/** The cell as the request spells one, or null where the member is not that shape. */
function cellOf(value: unknown): CauseCell | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { kind, class: klass, level, ordinal } = value as Record<string, unknown>;
  if (typeof kind !== "string" || typeof klass !== "string" || typeof level !== "string") return null;
  if (!(ordinal === null || typeof ordinal === "number")) return null;
  return { kind, class: klass, level, ordinal };
}

function sightingOf(value: Record<string, unknown>): CauseSighting | null {
  const { channel, layout } = value;
  return typeof channel === "string" && typeof layout === "string" ? { channel, layout } : null;
}

function observationOf(value: Record<string, unknown>): CauseObservation | null {
  const { rail, reason } = value;
  return typeof rail === "string" && typeof reason === "string" ? { rail, reason } : null;
}

/**
 * A list read member by member, or null where the value is not a list of that shape. Null rather
 * than a filtered list: a request carrying one member this arm cannot read is a request it does not
 * recognise, and dropping the member would ask Jev about evidence that was quietly thinned.
 */
function listOf<T>(value: unknown, readOne: (record: Record<string, unknown>) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) return null;
  const read: T[] = [];
  for (const item of value) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const one = readOne(item as Record<string, unknown>);
    if (one === null) return null;
    read.push(one);
  }
  return read;
}
