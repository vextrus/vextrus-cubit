// The room-type question's recorder (R-TO-036, viewer.md I-688): one subject per committed room
// whose labels the grammar reads no type in, put as the product itself composes it —
// `roomTypeOfLabels` says whether the model is asked at all, `roomTypeRequest` composes what it is
// asked — so every recording is a request the rooms panel really makes.
//
// Why a committed list and not a drawing. The request carries the room's name and its first label's
// entity key, and nothing the drawing does not print; this script opens no database and runs no
// extractor, so F-ARCH's rooms are TRANSCRIBED beside the conventions in `tests/ai/room-type/
// labels.json`, and `tests/ai/room-type.test.ts` holds the transcription to the partition's own
// reading of the fixture.
//
// Its own flags: `--labels <file>` (defaulting to the committed one) and `--limit N`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { roomTypeRequest } from "../../src/core/rooms/room-type-question";
import { roomTypeOfLabels, type RoomType } from "../../src/core/rooms/room-types";
import type { Asked, RecorderContext } from "./recorder";

/** The committed room list when the command line names no other. */
export const ROOM_LABELS = resolve(import.meta.dirname, "..", "..", "tests", "ai", "room-type", "labels.json");

/** How many subjects are asked when the command line names no limit. */
const DEFAULT_LIMIT = "200";

/** One room of the list: where it comes from, its name, each label's words, the key it cites, and the type it is. */
export type LabelledRoom = {
  readonly source: string;
  readonly name: string;
  readonly labels: readonly string[];
  readonly key: string;
  readonly expected: RoomType | null;
};

/** The committed list. */
export type RoomLabelCorpus = { readonly about: string; readonly rooms: readonly LabelledRoom[] };

/** The list at a path. */
export function roomLabelsAt(path: string = ROOM_LABELS): RoomLabelCorpus {
  return JSON.parse(readFileSync(path, "utf8")) as RoomLabelCorpus;
}

/** Every committed room the grammar leaves untyped, once each, as the panel would ask it. */
export function subjectsOf(ctx: RecorderContext): Asked[] {
  const path = resolve(ctx.option("--labels") ?? ROOM_LABELS);
  const limit = Number(ctx.option("--limit") ?? DEFAULT_LIMIT);
  const corpus = roomLabelsAt(path);
  const asked: Asked[] = [];
  for (const room of corpus.rooms) {
    // The product's OWN reading of whether the model is asked: a room the grammar types is a corpus
    // defect, named rather than recorded (B-17).
    if (roomTypeOfLabels(room.labels) !== null) ctx.fail(`${JSON.stringify(room.name)} is typed by the grammar itself, so the model is never asked it — it does not belong in ${path}`);
    asked.push({ request: roomTypeRequest({ label: room.name, key: room.key }), subject: `labels.json · ${room.source} · ${room.name}`, artifact: path });
  }
  ctx.say(`${asked.length} room(s) read from ${path}`);
  return asked.slice(0, limit);
}
