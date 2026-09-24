// @vitest-environment node
/**
 * The room-type question (viewer.md I-688, R-TO-036): the grammar that reads a type off a room's
 * labels, the question Jev is asked where it reads none, its recorder, and the recorded answers the
 * rooms panel replays.
 *
 * Three grounds:
 *   · the grammar, against the names F-ARCH and Dhaka residential plans write;
 *   · the committed corpus (`tests/ai/room-type/labels.json`), every room of which is asked, recorded,
 *     and REPLAYED here through the fixture transport and the question's own decoder — a room without
 *     its recording fails here as FIXTURE_MISSING would fail in the product — and graded against the
 *     type a quantity surveyor keys its finish by (AM-01: what was authored, never what Jev said);
 *   · F-ARCH read by the shipped `cad/` CLI through the partition's own stages: every room of its plans
 *     that the grammar leaves untyped is in the corpus under the name and the label key the partition
 *     reads, so the panel asks nothing on the demo's drawing that was not recorded.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it, test } from "vitest";
import { readRoomType } from "../../src/core/acts/confirm-rooms";
import { MODEL_QUESTIONS, createModelSeam, requestHash, sourceKeyResolver } from "../../src/core/model";
import { proposeRoomType, readRoomTypeProposal, roomTypeReadingOf, roomTypeRequest } from "../../src/core/rooms/room-type-question";
import { ROOM_TYPES, ROOM_TYPE_NONE, plainRoomName, roomTypeOfLabel, roomTypeOfLabels } from "../../src/core/rooms/room-types";
import { SEED_EDITION_CONTENT } from "../../src/core/rulesets/seed";
import { convert } from "../../src/core/units/canon";
import { detectRooms, type OutlineBand } from "../../src/modules/takeoff/partition/rooms/detect";
import "../../src/modules/takeoff/partition/notation";
import { ROOM_LABELS, roomLabelsAt, subjectsOf } from "../../scripts/model-corpus/room-type";
import type { RecorderContext } from "../../scripts/model-corpus/recorder";
import { archStages } from "../takeoff/partition/support/arch-stages";
import { contextFor, memoryLedger, rowsOf, silentFetch } from "./support/understanding-stage";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const CORPUS_ROOT = join(REPO_ROOT, "fixtures", "model");
const ROSTER = join(CORPUS_ROOT, "corpus.json");

/** How long F-ARCH's reading may take: a cold `uv run`, the mirror's validation, the stages. */
const BUDGET_MS = 240_000;

/**
 * Where Jev and the corpus's author part, named: a pantry is a food store off the kitchen, and whether
 * its finish follows the kitchen's or the store's is the architect's schedule's call. The person
 * confirming sees the proposal and may type it otherwise (I-687); no other room may disagree.
 */
const DISAGREES: ReadonlyMap<string, string> = new Map([["PANTRY", "STORE"]]);


function recorder(options: Readonly<Record<string, string>> = {}): RecorderContext & { said: string[] } {
  const said: string[] = [];
  return {
    said,
    option: (name) => options[name],
    fail: (message) => {
      throw new Error(message);
    },
    say: (line) => said.push(line),
    corpusRoot: CORPUS_ROOT,
  };
}

describe("the grammar reads a type off a room's own labels, and guesses at nothing", () => {
  it("reads every name F-ARCH writes, its serial and a trailing ROOM set aside", () => {
    const read = Object.fromEntries(["BED-01", "BED-02", "TOILET-03", "F.LIVING", "KITCHEN", "STUDY", "LIFT LOBBY", "GUARD ROOM", "METER ROOM", "DRIVER", "TOILET", "VERANDAH"].map((name) => [name, roomTypeOfLabel(name)]));
    expect(read).toEqual({
      "BED-01": "BED",
      "BED-02": "BED",
      "TOILET-03": "TOILET",
      "F.LIVING": "FAMILY_LIVING",
      KITCHEN: "KITCHEN",
      STUDY: "STUDY",
      "LIFT LOBBY": "LOBBY",
      "GUARD ROOM": "GUARD",
      "METER ROOM": "METER",
      DRIVER: "DRIVER",
      TOILET: "TOILET",
      VERANDAH: "VERANDAH",
    });
    expect(plainRoomName("  m.bed-02 ")).toBe("M BED");
  });

  it("reads no type where the words are an abbreviation, or two labels name two uses", () => {
    expect(roomTypeOfLabel("M.BED"), "an abbreviation is the model's question").toBeNull();
    expect(roomTypeOfLabels(["LIVING", "DINING"]), "one space named for two uses is a judgment").toBeNull();
    expect(roomTypeOfLabels(["TOILET-01", "TOILET"]), "two labels naming one use read to it").toBe("TOILET");
    expect(roomTypeOfLabels([]), "a room with no label names no type").toBeNull();
  });

  it("reads a room as the store holds it: by the grammar, as a question citing its first label, or not at all", () => {
    const labels = [
      { key: "DXF_HANDLE:A", name: "LIVING", astray: false },
      { key: "DXF_HANDLE:B", name: "DINING", astray: false },
    ];
    expect(roomTypeReadingOf({ name: "BED-01", labels: [{ key: "DXF_HANDLE:C", name: "BED-01", astray: false }] })).toEqual({ kind: "LABEL", type: "BED" });
    expect(roomTypeReadingOf({ name: "LIVING / DINING", labels })).toEqual({ kind: "ASK", ask: { label: "LIVING / DINING", key: "DXF_HANDLE:A" } });
    expect(roomTypeReadingOf({ name: "DINING / LIVING", labels }), "the key cited is the first name's label").toEqual({ kind: "ASK", ask: { label: "DINING / LIVING", key: "DXF_HANDLE:B" } });
    expect(roomTypeReadingOf({ name: null, labels: [] })).toEqual({ kind: "UNNAMED" });
  });
});

describe("CONFIRM_ROOMS reads a stored room's type as the panel shows it (I-687)", () => {
  const living = { name: "LIVING / DINING", labels: [{ key: "DXF_HANDLE:66C", name: "LIVING", size: null, agrees: null, astray: false }] } as unknown as Parameters<typeof readRoomType>[0];
  const bed = { name: "BED-01", labels: [{ key: "DXF_HANDLE:B1", name: "BED-01", size: null, agrees: null, astray: false }] } as unknown as Parameters<typeof readRoomType>[0];
  const hash = requestHash(roomTypeRequest({ label: "LIVING / DINING", key: "DXF_HANDLE:66C" }));

  it("takes the grammar's type without asking, and the model's recorded answer only where the grammar reads none", () => {
    expect(readRoomType(bed, new Map())).toEqual({ read: true, type: "BED", basis: "LABEL", callId: null });
    expect(readRoomType(living, new Map()), "a room nobody has asked about is not typed by a guess").toEqual({ read: false, why: "UNASKED", callId: null });
    expect(readRoomType(living, new Map([[hash, { callId: "call-1", type: "LIVING", confidence: 1 }]]))).toEqual({ read: true, type: "LIVING", basis: "MODEL", callId: "call-1" });
    expect(readRoomType(living, new Map([[hash, { callId: "call-2", type: null, confidence: 1 }]])), "none of these leaves it for a person").toEqual({ read: false, why: "NONE_OF_THESE", callId: "call-2" });
  });
});

describe("the question's answer is read back out of the roster", () => {
  it("takes a type of the roster, reads the no-match as a proposal of no type, and refuses anything else by a detail", () => {
    expect(readRoomTypeProposal({ type: "BED" })).toEqual({ ok: true, value: { type: "BED" } });
    expect(readRoomTypeProposal({ type: ROOM_TYPE_NONE })).toEqual({ ok: true, value: { type: null } });
    expect(readRoomTypeProposal({ type: "GARAGE" }).ok).toBe(false);
    expect(readRoomTypeProposal({ type: "BED", finish: "TILE" }).ok, "an answer naming more than the type").toBe(false);
    expect(readRoomTypeProposal(["BED"]).ok).toBe(false);
  });

  it("is asked on exactly the request the product composes, with the roster in it", () => {
    const request = roomTypeRequest({ label: "M.BED", key: "DXF_HANDLE:R01" });
    expect(request.question).toBe(MODEL_QUESTIONS.roomType);
    expect(JSON.parse(String(request.messages[0]?.content))).toEqual({ key: "DXF_HANDLE:R01", label: "M.BED", roster: [...ROOM_TYPES] });
  });
});

describe("the committed corpus, its recorder and its recordings", () => {
  const corpus = roomLabelsAt();

  it("holds rooms the grammar leaves untyped only, and the recorder asks each once as the product composes it", () => {
    for (const room of corpus.rooms) expect(roomTypeOfLabels(room.labels), `${room.name} is the grammar's, not the model's`).toBeNull();
    const asked = subjectsOf(recorder());
    expect(asked.length).toBe(corpus.rooms.length);
    for (const [index, one] of asked.entries()) {
      const room = corpus.rooms[index];
      expect(requestHash(one.request)).toBe(requestHash(roomTypeRequest({ label: room?.name ?? "", key: room?.key ?? "" })));
      expect(one.artifact).toBe(ROOM_LABELS);
    }
    expect(new Set(asked.map((one) => requestHash(one.request))).size, "no room is asked twice").toBe(asked.length);
    expect(subjectsOf(recorder({ "--limit": "3" })).length).toBe(3);
  });

  it("replays every room through the seam over the committed corpus — never FIXTURE_MISSING — and Jev types each as a QS would, bar the one named", async () => {
    const { ledger, record } = memoryLedger();
    const seam = createModelSeam({ env: { CUBIT_MODEL_FIXTURE_ROOT: CORPUS_ROOT, NODE_ENV: "test" }, fetch: silentFetch(), ledger });
    expect(seam.transport, "the lanes replay; nothing is posted").toBe("fixture");
    const agreed: string[] = [];
    for (const room of corpus.rooms) {
      const ask = { label: room.name, key: room.key };
      // The product's own proposal path — the arm reads the kept provider body, the decoder the payload.
      const proposal = await proposeRoomType(contextFor("tenant", "project", "user:qs"), ask, sourceKeyResolver("artifact", [room.key]), { propose: seam.propose });
      expect(proposal.sources, `${room.name}'s answer cites the label it was asked about`).toEqual([room.key]);
      const expected = DISAGREES.get(room.name) ?? room.expected;
      expect(proposal.payload.type, `${room.name}`).toBe(expected);
      if (!DISAGREES.has(room.name)) agreed.push(room.name);
    }
    expect(rowsOf(record).map((row) => row.outcome), "every answer is ledgered as a proposal").toEqual(corpus.rooms.map(() => "proposed"));
    expect(agreed.length, "every room but the named disagreement agrees").toBe(corpus.rooms.length - DISAGREES.size);
  });

  it("files every room-type recording under a room the corpus still asks (the ratchet)", () => {
    const lines = (JSON.parse(readFileSync(ROSTER, "utf8")) as { fixtures: { requestHash: string; question: string; subject: string }[] }).fixtures.filter((line) => line.question === MODEL_QUESTIONS.roomType);
    const bySubject = new Map(subjectsOf(recorder()).map((one) => [requestHash(one.request), one.subject]));
    expect(lines.length, "one recording per room of the corpus").toBe(bySubject.size);
    for (const line of lines) expect(bySubject.get(line.requestHash), `${line.subject} is still asked`).toBe(line.subject);
  });
});

/** The edition's finish outline band, carried into square metres by the canon (L-MEA-01). */
function seedBand(): OutlineBand {
  const end = (name: string): string => {
    const stated = SEED_EDITION_CONTENT.parameters[name];
    if (stated === undefined) throw new Error(`the platform edition states no ${name}`);
    const carried = convert(stated.value, stated.unit, "m2");
    if (!carried.ok) throw new Error(`${name} is stated in no unit of area`);
    return carried.value;
  };
  return { min: end("finishMinOutlineArea"), max: end("finishMaxOutlineArea") };
}

describe("F-ARCH: every room the grammar leaves untyped is in the corpus as the partition reads it", () => {
  test(
    "by name and by the label key its question cites",
    async () => {
      const read = await archStages();
      const rooms = detectRooms({ ...read.evidence, walls: read.placed.walls ?? [], band: seedBand() }).rooms;
      const asks = rooms.filter((room) => room.status === "CLOSED").flatMap((room) => {
        const reading = roomTypeReadingOf(room);
        return reading.kind === "ASK" ? [reading.ask] : [];
      });
      const transcribed = roomLabelsAt()
        .rooms.filter((room) => room.source.startsWith("F-ARCH"))
        .map((room) => ({ label: room.name, key: room.key }));
      expect(asks.length, "F-ARCH's typical plan names two living-and-dining spaces the grammar cannot type").toBeGreaterThan(0);
      const byKey = (a: { key: string }, b: { key: string }): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      expect([...asks].sort(byKey), "the corpus transcribes exactly what the partition reads").toEqual([...transcribed].sort(byKey));
    },
    BUDGET_MS,
  );
});
