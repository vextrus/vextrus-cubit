// The room-type question (R-TO-036: "the model proposing names from labels (cited)"; viewer.md Part 7,
// I-688): what a model may be asked about a room whose labels the grammar reads no type in, how
// its answer is read back, and where the answer it gave stands afterwards.
//
// It lives in core for the reason `../view-captions` does: the rooms panel (a module) ASKS it, and
// the CONFIRM_ROOMS act (core) reads what was answered to resolve its members — ARCH-01 lets neither
// of them name the other, so the question has one home both reach (B-17, ARCH-02).
//
// What comes back is a Proposal and stays one (L-AI-02): a type held until a person confirms it, or
// a proposal of NO type where the model chose the question's own "none of these". Nothing here
// writes a room, a type or a confirmation.
//
// The answer is stored exactly once, where every model answer is: the ledger row of the call that
// made it (L-AI-01). A room asked about once is never asked again for the same words on the same
// label — `recordedRoomTypes` reads the row back by the request's hash — so reading the panel twice
// spends nothing twice, and the act resolves its members off the very row the panel showed.
import { and, desc, eq, inArray, modelCalls, type TenantTx } from "../db";
import { MODEL_QUESTIONS, canonicalJson, propose, requestHash } from "../model";
import type { DecodeResult, ModelCallContext, ModelRequest, Proposal, SourceKeyResolver } from "../model";
import { JEV_MODEL, type ModelId } from "../model-ledger.types";
import { ROOM_TYPES, ROOM_TYPE_NONE, ROOM_TYPE_QUESTION_ID, isRoomType, roomTypeOfLabels, type RoomType } from "./room-types";

export { ROOM_TYPE_NONE, ROOM_TYPE_QUESTION_ID } from "./room-types";

/** Any JSON value — what a transport carried, before it is read as anything. */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/**
 * The model a room's type is proposed by: one type of a closed roster is a closed question only
 * TypeSafe Jev answers, so it is pinned to Jev's id (Deviation D-002).
 */
export const ROOM_TYPE_MODEL: ModelId = JEV_MODEL;

/** The field a proposal answers with, and the only one. */
const PROPOSAL_FIELD = "type";

/** What the model is told it is doing: a model that reads a system prompt reads this; Jev reads the arm's own instruction. */
const SYSTEM = [
  "You read the name an architect wrote in one room of a floor plan and say which type of room it is, from a closed roster.",
  "The deterministic grammar could not read a type off these words, so what the room is used for must be read from the words themselves.",
  'Answer with a JSON object of exactly {"payload": {"' + PROPOSAL_FIELD + '": "<TYPE>"}, "sources": ["<key>"]}.',
  `The types are: ${ROOM_TYPES.join(", ")}. Answer ${ROOM_TYPE_NONE} where the words name none of them.`,
  "`sources` names the entity key you were given — the label's own entity, the evidence the answer rests on.",
  "Propose a type. Do not measure, and do not name a finish.",
].join("\n");

/** One room whose labels the grammar read no type in: its name as the labels give it, and the label an answer cites. */
export type RoomTypeAsk = {
  /** The room's name, its labels joined in reading order (`LIVING / DINING`, `M.BED-01`). */
  readonly label: string;
  /** The source key of the room's first label: what the answer is asked about, and may cite. */
  readonly key: string;
};

/**
 * The question one room is asked, as a pure function of its name, its label's entity and the roster:
 * the same words on the same label make the same request forever, so the hash a recorded answer is
 * filed under is a fact about the drawing rather than about the run (L-AI-01). The roster rides in the
 * request, so a type added to it asks every room again rather than replaying an answer given over a
 * narrower list.
 */
export function roomTypeRequest(ask: RoomTypeAsk): ModelRequest {
  return {
    modelId: ROOM_TYPE_MODEL,
    system: SYSTEM,
    messages: [{ role: "user", content: canonicalJson({ key: ask.key, label: ask.label, roster: [...ROOM_TYPES] }) }],
    question: MODEL_QUESTIONS.roomType,
  };
}

/** What a model proposed a room to be: a type of the roster, or none (`type: null`, the question's own no-match). */
export type RoomTypeProposal = { readonly type: RoomType | null };

/**
 * A model's payload as a room type, or the detail that says why it is not one (a decoder answers and
 * never throws). The type is read back OUT of the roster, so what comes back is one the question
 * offered; the question's "none of these" is a plain answer — a proposal of no type — never a refusal
 * of the model (the view caption's reading, I-408).
 */
export function readRoomTypeProposal(payload: JsonValue): DecodeResult<RoomTypeProposal> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return { ok: false, detail: `a room type is an object naming ${PROPOSAL_FIELD}` };
  const named = Object.keys(payload);
  if (named.length !== 1 || named[0] !== PROPOSAL_FIELD) return { ok: false, detail: `a room type names exactly ${PROPOSAL_FIELD}, and this one names ${named.join(", ") || "nothing"}` };
  const type = payload[PROPOSAL_FIELD];
  if (isRoomType(type)) return { ok: true, value: Object.freeze({ type }) };
  if (type === ROOM_TYPE_NONE) return { ok: true, value: Object.freeze({ type: null }) };
  return { ok: false, detail: `${JSON.stringify(type)} is no room type — the roster is ${ROOM_TYPES.join(", ")}, and ${ROOM_TYPE_NONE} answers none of these` };
}

/** The way to a model, as a seam a caller may hand in (B-23): the shipped `propose` unless another is named. */
export type RoomTypePort = { propose: typeof propose };

const PRODUCTION: RoomTypePort = { propose };

/**
 * What a model proposes this room is (R-TO-036, L-AI-02). The seam's refusal is never caught here: a
 * missing recording, an uncited or unreadable answer reaches the caller intact, and the caller says
 * what a room nobody could type becomes — abstention is not the model's decision.
 */
export async function proposeRoomType(ctx: ModelCallContext, ask: RoomTypeAsk, artifact: SourceKeyResolver, port: RoomTypePort = PRODUCTION): Promise<Proposal<RoomTypeProposal>> {
  return port.propose(ctx, roomTypeRequest(ask), { artifact, decode: readRoomTypeProposal });
}

/** A proposal as the ledger holds it: the call that made it, the type (null for none), and the model's stated confidence. */
export type RecordedRoomType = { readonly callId: string; readonly type: RoomType | null; readonly confidence: number | null };

/**
 * The answers already given, by request hash: the latest PROPOSED call of the room-type question in
 * this project for each request asked (L-AI-01's ledger is where an answer stands). A call the seam
 * refused answers nothing and is not read; neither is a row whose judgment names no answer of the
 * roster — a hash with no row here is a room nobody has asked about yet.
 */
export async function recordedRoomTypes(tx: TenantTx, scope: { readonly tenantId: string; readonly projectId: string }, asks: readonly RoomTypeAsk[]): Promise<ReadonlyMap<string, RecordedRoomType>> {
  const hashes = [...new Set(asks.map((ask) => requestHash(roomTypeRequest(ask))))];
  const answered = new Map<string, RecordedRoomType>();
  if (hashes.length === 0) return answered;
  const rows = await tx
    .select({ callId: modelCalls.callId, requestHash: modelCalls.requestHash, judgment: modelCalls.judgment })
    .from(modelCalls)
    .where(
      and(
        eq(modelCalls.tenantId, scope.tenantId),
        eq(modelCalls.projectId, scope.projectId),
        eq(modelCalls.question, MODEL_QUESTIONS.roomType),
        eq(modelCalls.outcome, "proposed"),
        inArray(modelCalls.requestHash, hashes),
      ),
    )
    .orderBy(desc(modelCalls.calledAt), desc(modelCalls.callId));
  for (const row of rows) {
    if (answered.has(row.requestHash)) continue;
    const answer = row.judgment?.answers[ROOM_TYPE_QUESTION_ID];
    const value = answer?.value;
    if (value === undefined) continue;
    const type = isRoomType(value) ? value : value === ROOM_TYPE_NONE ? null : undefined;
    if (type === undefined) continue;
    answered.set(row.requestHash, { callId: row.callId, type, confidence: answer?.confidence ?? null });
  }
  return answered;
}

/** The hash one room's question is filed under — the key `recordedRoomTypes` answers by. */
export function roomTypeRequestHash(ask: RoomTypeAsk): string {
  return requestHash(roomTypeRequest(ask));
}

/** A room as the store and the rooms stage both hold one: its name, and every label standing in it. */
export type NamedRoom = {
  readonly name: string | null;
  readonly labels: readonly { readonly key: string; readonly name: string; readonly astray: boolean }[];
};

/**
 * How one room's type is read (I-688): off its labels by the grammar, or — where the grammar reads
 * none — by the question a model is asked about it; a room no label names is read no type at all. The
 * one home the panel, the act and the recorder's corpus test all read, so what the panel shows is
 * what the act resolves (B-17).
 *
 * The labels read are the ones its name is made of — `LIVING / DINING` is two — in the name's own
 * order, and the key the question cites is the first of them that stands in the room.
 */
export type RoomTypeReading =
  | { readonly kind: "UNNAMED" }
  | { readonly kind: "LABEL"; readonly type: RoomType }
  | { readonly kind: "ASK"; readonly ask: RoomTypeAsk };

/** The reading of one room. */
export function roomTypeReadingOf(room: NamedRoom): RoomTypeReading {
  if (room.name === null || room.name === "") return { kind: "UNNAMED" };
  const names = room.name.split(" / ");
  const type = roomTypeOfLabels(names);
  if (type !== null) return { kind: "LABEL", type };
  const first = names[0] ?? room.name;
  const label = room.labels.find((one) => !one.astray && one.name === first) ?? room.labels.find((one) => !one.astray);
  if (label === undefined) return { kind: "UNNAMED" };
  return { kind: "ASK", ask: { label: room.name, key: label.key } };
}
