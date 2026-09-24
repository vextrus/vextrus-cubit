// The room-type question, as Jev is asked it (R-TO-036, viewer.md I-688, L-AI-01): one choice
// over the closed room-type roster, plus the no-match outcome, on the request
// `@/core/rooms/room-type-question` composes — asked only for a room whose labels the grammar reads
// no type in. The roster, its meanings and the no-match spelling are read from their one home
// (ARCH-02) and never spelled here.
//
// The request carries the room's name, its first label's entity key and the roster itself — no
// UUID, no project, no figure — so its hash is stable from run to run and a roster change forces a
// re-record. It is recognised by the exact key set of its canonical content, which no other arm uses.
import { ROOM_TYPE_MEANINGS, ROOM_TYPE_NONE, ROOM_TYPE_QUESTION_ID, isRoomType, type RoomType } from "../../rooms/room-types";
import { MODEL_QUESTIONS } from "../questions";
import type { JsonValue } from "../types";
import { TYPESAFE_MODEL, choiceOf, type TypeSafeArm, type TypeSafeQuestion } from "./arm";

/** The key set the room-type request builder spells, sorted — what this arm is recognised by. */
const ROOM_TYPE_KEYS = ["key", "label", "roster"] as const;

/** One room the grammar typed nothing in, as recognised on a request. */
export type RoomTypeTask = { kind: "room-type"; label: string; key: string; roster: readonly RoomType[] };

/** What the no-match outcome means. */
const NONE_CRITERION = "None of these: the words name a use the other options do not, such as a lift machine room, a gym or a shop, or no use at all.";

/** The choice's whole meaning, naming the state it reads by its own field path (the docs' rule). */
const INSTRUCTIONS = [
  "`label` is the name an architect wrote inside one room of a residential floor plan in Bangladesh — abbreviations such as M. (master), C. (common or child), S. (servant), F. (family) and ATT. (attached) are usual, and two names joined by a slash name one open space used for both.",
  "Which type of room is it, as a room finish schedule would key its floor and wall finishes?",
  `Where one space carries two names, choose the first. Choose ${ROOM_TYPE_NONE} where the words name none of the types.`,
].join(" ");

/** The room-type arm: one closed choice over the roster, and a no-match outcome. */
export const roomTypeArm: TypeSafeArm<RoomTypeTask> = {
  question: MODEL_QUESTIONS.roomType,
  keys: ROOM_TYPE_KEYS,

  recognise(record): RoomTypeTask | null {
    const { key, label, roster } = record;
    if (typeof key !== "string" || key === "" || typeof label !== "string" || label === "" || !Array.isArray(roster)) return null;
    const read = roster.filter(isRoomType);
    return read.length === roster.length ? { kind: "room-type", label, key, roster: read } : null;
  },

  guard(task): void {
    if (task.roster.length === 0) throw new Error(`the room ${JSON.stringify(task.label)} was asked over an empty roster, so Jev has nothing to choose from; no question was posted`);
  },

  compose(task): TypeSafeQuestion {
    const criteria: Record<string, string> = {};
    for (const type of task.roster) criteria[type] = ROOM_TYPE_MEANINGS[type];
    criteria[ROOM_TYPE_NONE] = NONE_CRITERION;
    const body: JsonValue = {
      model: TYPESAFE_MODEL,
      // The key is not state: it is what the answer RESTS on (the caption precedent).
      state: { label: task.label },
      questions: { [ROOM_TYPE_QUESTION_ID]: { type: "choice", instructions: INSTRUCTIONS, criteria } },
    };
    return {
      body,
      read(answers) {
        return { payload: { type: choiceOf(answers[ROOM_TYPE_QUESTION_ID]) ?? null }, sources: [task.key] };
      },
    };
  },
};
