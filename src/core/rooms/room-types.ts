// What a room IS, as a finish schedule keys it (viewer.md Part 7, I-687): the closed roster of
// room types, the words a label names each by, and the grammar that reads a type off a room's own
// labels. A ROOM FINISH SCHEDULE lists its rooms by these words — `LIVING, DINING, F.LIVING, BED,
// STUDY` over one row, `KITCHEN` over another — so the type a person confirms is the key that row is
// found by; which floor, dado, skirting and plaster a room bears is the finishes reader's (ARCH-78),
// never this file's.
//
// Core, beside `./law`, because three homes read it and ARCH-01 lets none of them name another: the
// CONFIRM_ROOMS act (core), the room-type question put to Jev where the grammar reads no type (core's
// model seam), and the rooms panel that offers the confirmation (a module). One roster, one grammar
// (B-17, ARCH-02).
//
// Pure: no store, no clock, no model.

/**
 * The room types, in the order a Dhaka residential finish schedule lists its rows: the dry rooms,
 * the wet rooms, the circulation, the service rooms and the open spaces. Closed — a label naming a
 * use outside it is no type the grammar reads, and the model's no-match outcome answers it.
 */
export const ROOM_TYPES = [
  "BED",
  "LIVING",
  "DINING",
  "FAMILY_LIVING",
  "DRAWING",
  "STUDY",
  "PRAYER",
  "KITCHEN",
  "TOILET",
  "LAUNDRY",
  "LOBBY",
  "CORRIDOR",
  "STORE",
  "SERVANT",
  "GUARD",
  "DRIVER",
  "METER",
  "VERANDAH",
] as const;

/** One of the roster. */
export type RoomType = (typeof ROOM_TYPES)[number];

/** Is this string one of the roster? The one predicate, for a value read off a wire, a store or a model. */
export function isRoomType(value: unknown): value is RoomType {
  return typeof value === "string" && (ROOM_TYPES as readonly string[]).includes(value);
}

/**
 * The words each type is named by, as the grammar reads a label once its serial and a trailing
 * `ROOM` are set aside: exactly the words a finish schedule keys its rows with, and the plain
 * spellings of them. An abbreviation beyond these — `M.BED`, `C.TOILET`, `MAID`, `ATT. BATH` — is
 * not guessed at here: it is the question the model is asked (I-688).
 */
export const ROOM_TYPE_WORDS: Readonly<Record<RoomType, readonly string[]>> = Object.freeze({
  BED: Object.freeze(["BED", "BEDROOM"]),
  LIVING: Object.freeze(["LIVING"]),
  DINING: Object.freeze(["DINING"]),
  FAMILY_LIVING: Object.freeze(["F LIVING", "FAMILY LIVING"]),
  DRAWING: Object.freeze(["DRAWING"]),
  STUDY: Object.freeze(["STUDY"]),
  PRAYER: Object.freeze(["PRAYER"]),
  KITCHEN: Object.freeze(["KITCHEN"]),
  TOILET: Object.freeze(["TOILET", "BATH", "BATHROOM", "WC"]),
  LAUNDRY: Object.freeze(["LAUNDRY"]),
  LOBBY: Object.freeze(["LOBBY", "LIFT LOBBY"]),
  CORRIDOR: Object.freeze(["CORRIDOR", "PASSAGE"]),
  STORE: Object.freeze(["STORE"]),
  SERVANT: Object.freeze(["SERVANT"]),
  GUARD: Object.freeze(["GUARD"]),
  DRIVER: Object.freeze(["DRIVER"]),
  METER: Object.freeze(["METER"]),
  VERANDAH: Object.freeze(["VERANDAH", "VERANDA", "BALCONY"]),
});

/** What a room type means, in a quantity surveyor's words — the model's criteria and the panel's gloss. */
export const ROOM_TYPE_MEANINGS: Readonly<Record<RoomType, string>> = Object.freeze({
  BED: "A bedroom of any kind: master, child's, guest's.",
  LIVING: "The living room of a flat.",
  DINING: "The dining room or dining space.",
  FAMILY_LIVING: "The family living room, apart from the formal living or drawing room.",
  DRAWING: "The formal drawing room where guests are received.",
  STUDY: "A study, office or reading room.",
  PRAYER: "A prayer room.",
  KITCHEN: "A kitchen, including a kitchen that opens onto the dining space.",
  TOILET: "A toilet, bathroom, washroom or water closet, attached or common.",
  LAUNDRY: "A laundry or wash area inside the building.",
  LOBBY: "A lobby, foyer or entrance hall, including a lift lobby.",
  CORRIDOR: "A corridor or passage.",
  STORE: "A store room.",
  SERVANT: "A servant's or maid's room.",
  GUARD: "A guard room.",
  DRIVER: "A driver's room.",
  METER: "A meter room or electrical room.",
  VERANDAH: "A verandah, balcony or sit-out open to the weather.",
});

/**
 * The room-type question's own "none of these": the words name no use the roster holds (a lift
 * machine room, a gym). Spelled here, with the roster, because the question's arm in the model seam
 * and the question's reader both need it and the seam may not import the reader (it would be a cycle).
 */
export const ROOM_TYPE_NONE = "NONE_OF_THESE";

/** The id the one choice is asked under — the key the answer and its judgment are filed by. */
export const ROOM_TYPE_QUESTION_ID = "room_type";

/** A room's serial, the way a plan numbers two rooms of one use: `BED-01`, `TOILET 2`. */
const SERIAL = /[\s-]*\d+[A-Z]?$/;

/** The word a plan writes after a use and that says nothing about it: `GUARD ROOM`, `BED ROOM`. */
const ROOM_WORD = /\s+ROOM$/;

/** A name as the grammar compares it: capitals, the architect's full stops as spaces, its serial and a trailing ROOM set aside. */
export function plainRoomName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.'’]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(SERIAL, "")
    .replace(ROOM_WORD, "")
    .trim();
}

/** The type one label names, or null where its words are none the roster is named by. */
export function roomTypeOfLabel(name: string): RoomType | null {
  const plain = plainRoomName(name);
  if (plain === "") return null;
  return ROOM_TYPES.find((type) => ROOM_TYPE_WORDS[type].includes(plain)) ?? null;
}

/**
 * The type a room's labels name (I-688): the one type every one of its labels reads to, or null
 * where any label reads to none or two of them read to different types — `LIVING / DINING` is one
 * space the architect named for two uses, and which one its finish follows is a judgment, never a
 * guess this grammar makes. A room with no label names no type.
 */
export function roomTypeOfLabels(names: readonly string[]): RoomType | null {
  if (names.length === 0) return null;
  const read = names.map(roomTypeOfLabel);
  const first = read[0] ?? null;
  return first !== null && read.every((type) => type === first) ? first : null;
}
