// R-TO-031's contested-cell reading, as the product asks it and reads it back (L-AI-01, L-AI-02).
//
// The ONE path to a model is `propose` from the seam's barrel (`@/core/model`); nothing here holds a
// provider, a key or a transport, and a caller that wants its own seam hands in a port carrying a
// `propose` rather than a second way out (B-23, cubit/no-model-outside-seam).
//
// What comes back is a Proposal and STAYS one (L-AI-02): a reading presented for disposition. It
// moves no member-type row, no section and no bar — `registerMemberTypes` still reads the drawing
// and only the drawing (L-AI-03) — and a person's judgment of it is recorded as an outcome beside
// the ledger's call, never as a write to the register (`./dispositions`).
//
// The seam's refusal is never caught here. FIXTURE_MISSING, UNSOURCED, SOURCE_UNRESOLVED and
// MALFORMED reach the caller intact, and the caller decides what a cell nobody could read becomes,
// because abstention is not the model's decision.
import { propose, type DecodeResult, type ModelCallContext, type Proposal, type SourceKeyResolver } from "@/core/model";
import { scheduleCellRequest } from "./request";
import type { CellReadingState } from "./candidates";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** The fields a cell reading answers with, and the only ones. */
const PROPOSAL_FIELDS = ["header", "cells"] as const;

/** One cell the model read, as it comes back: the column, what it states, and the words it read. */
export type CellReadingEntry<T extends string = string> = {
  readonly column: number;
  readonly attribute: T;
  readonly text: string;
  readonly sourceKeys: readonly string[];
};

/**
 * What a model proposed about one row: the probability it gave the row-heads-the-table judgment
 * (null where it gave none), and one entry per contested cell it named a candidate for.
 *
 * A cell the model answered with the no-match outcome carries NO entry — nothing is supplied where
 * the model supplied nothing (L-AI-02) — so an empty `cells` is a row it read no attribute in, which
 * is a reading and not a failure.
 */
export type CellReading<T extends string = string> = {
  readonly header: number | null;
  readonly cells: readonly CellReadingEntry<T>[];
};

/**
 * A model's payload as a cell reading, or the detail that says why it is not one (L-AI-02: a decoder
 * answers a result and never throws).
 *
 * The attribute set is the CALLER's, and an answer is read back OUT of it rather than merely tested
 * against it: what a schedule cell may be read as is this module's law (`./law`), core may not name
 * it (ARCH-01), and a caller holding this proposal then has a member of its own roster rather than a
 * string to re-judge. An attribute outside the set is MALFORMED.
 */
export function readCellReadingProposal<T extends string>(attributes: readonly T[]): (payload: JsonValue) => DecodeResult<CellReading<T>> {
  return (payload) => {
    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      return { ok: false, detail: `a cell reading is an object naming ${PROPOSAL_FIELDS.join(" and ")}` };
    }
    const named = Object.keys(payload).sort();
    if (named.length !== PROPOSAL_FIELDS.length || !PROPOSAL_FIELDS.every((field) => named.includes(field))) {
      return { ok: false, detail: `a cell reading names exactly ${PROPOSAL_FIELDS.join(", ")}, and this one names ${named.join(", ") || "nothing"}` };
    }
    const header = payload["header"];
    if (header !== null && !(typeof header === "number" && Number.isFinite(header))) {
      return { ok: false, detail: `${JSON.stringify(header)} is no probability — the row's heading judgment is a number or null` };
    }
    const cells = payload["cells"];
    if (!Array.isArray(cells)) return { ok: false, detail: "a cell reading's `cells` is an array, empty where the model read no attribute" };

    const read: CellReadingEntry<T>[] = [];
    for (const entry of cells) {
      const one = entryOf(entry, attributes);
      if (!one.ok) return one;
      read.push(one.value);
    }
    return { ok: true, value: Object.freeze({ header, cells: Object.freeze(read) }) };
  };
}

/** One entry of the answer, read out of the caller's roster. */
function entryOf<T extends string>(entry: JsonValue, attributes: readonly T[]): DecodeResult<CellReadingEntry<T>> {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return { ok: false, detail: "each cell of a reading is an object" };
  const { column, attribute, text, sourceKeys } = entry;
  if (typeof column !== "number" || !Number.isInteger(column) || column < 0) {
    return { ok: false, detail: `${JSON.stringify(column)} is no column index — a cell of a reading names the column it stands in` };
  }
  const answered = typeof attribute === "string" ? attributes.find((candidate) => candidate === attribute) : undefined;
  if (answered === undefined) {
    return { ok: false, detail: `${JSON.stringify(attribute)} is no attribute a schedule cell can state — the roster is ${attributes.join(", ")}` };
  }
  if (typeof text !== "string" || text === "") return { ok: false, detail: `column ${column} was read as ${answered} out of no words at all` };
  if (!Array.isArray(sourceKeys) || sourceKeys.length === 0 || sourceKeys.some((key) => typeof key !== "string")) {
    return { ok: false, detail: `column ${column} cites no source key, and a reading of words nobody wrote is not one (L-CAD-03)` };
  }
  return { ok: true, value: Object.freeze({ column, attribute: answered, text, sourceKeys: Object.freeze([...(sourceKeys as string[])]) }) };
}

/**
 * The way to a model, as a seam a caller may hand in (B-23). The default is the shipped `propose` —
 * live in production, replayed from the recorded corpus inside every lane (L-AI-01) — and a caller
 * that hands its own hands a `propose`, never a second path to a provider.
 */
export type CellReadingPort = { propose: typeof propose };

/** The port every call uses unless the caller names another: the model seam's own production entry. */
const PRODUCTION: CellReadingPort = { propose };

/** The shape a caller of this question takes, so the asker never names the seam itself (B-23). */
export type CellReadingSeam = { proposeCellReading: typeof proposeCellReading };

/** One contested row, with the attributes it may be read as and the artifact a citation resolves against. */
export type CellReadingQuestion<T extends string = string> = {
  readonly state: CellReadingState;
  readonly attributes: readonly T[];
  readonly artifact: SourceKeyResolver;
};

/**
 * What a model proposes one contested row states (R-TO-031, L-AI-02). A refusal — a missing recorded
 * answer, an uncited or unreadable answer — reaches the caller intact and is that caller's to step
 * over, never a crash and never a network call in a lane.
 */
export async function proposeCellReading<T extends string>(
  ctx: ModelCallContext,
  question: CellReadingQuestion<T>,
  port: CellReadingPort = PRODUCTION,
): Promise<Proposal<CellReading<T>>> {
  return port.propose(ctx, scheduleCellRequest(question.state), {
    artifact: question.artifact,
    decode: readCellReadingProposal(question.attributes),
  });
}

export { scheduleCellRequest, CELL_READING_MODEL } from "./request";
export { cellReadingCandidates, columnsOfTable, contestedRowsOf } from "./candidates";
export type { CellCandidate, CellReadingState, ContestedCell, ScheduleColumn } from "./candidates";
export { CANDIDATE_CAP, CELL_ATTRIBUTES, CELL_ATTRIBUTE_MEANS, CONTESTED_CELL_CAP, HEADER_SHOWN_AT } from "./law";
export type { CellAttribute } from "./law";
