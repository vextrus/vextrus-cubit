// How much of this machine one gate may take (V-VERIFY, v22 Wave A).
//
// The gate's lanes run at once, and the unit and database lanes fork workers of their own, so a
// single `pnpm verify` peaked at load 18 on the 24-core box the engine builds on: six vitest workers
// plus six other lanes. The engine runs at most two product suites at a time, and two such gates
// would be about 36 — every lane slower than it would have been in series, and the knees these lanes
// were measured at meaningless.
//
// A process cannot see the gates beside it, so it is TOLD: `CUBIT_VERIFY_SLOTS` is the number of
// gates sharing this box, the engine sets it, and one is the answer when nobody says otherwise.
// Everything else here is derived from it, in one home, so the two vitest lanes and the wave runner
// cannot disagree about whose box it is (ARCH-02).
import { availableParallelism } from "node:os";

/**
 * How many gates are sharing this machine. Never zero, never a fraction, never what an unreadable
 * value would make of it: a gate that cannot read its slot count assumes it is alone, which is the
 * behaviour every caller had before the variable existed.
 * @returns {number}
 */
export function verifySlots() {
  const named = Number(process.env["CUBIT_VERIFY_SLOTS"]);
  return Number.isFinite(named) && named >= 1 ? Math.floor(named) : 1;
}

/**
 * The workers one gate may have in total: its share of the box, less two — one for the gate's own
 * parent process, one so the machine is still answerable while it runs. Never less than one.
 * @param {number} [cores]
 * @param {number} [slots]
 * @returns {number}
 */
export function gateBudget(cores = availableParallelism(), slots = verifySlots()) {
  return Math.max(1, Math.floor(cores / slots) - 2);
}

/**
 * The workers one forking lane may have: its own measured knee, divided by the number of gates on
 * the box, and clamped to what is left of this gate's budget once its sibling lanes are counted.
 *
 * The knee is divided rather than merely clamped because it IS a measurement of a share: the
 * database lane's eight was measured as the best of 4/8/12 on a box where that lane had the machine
 * to itself. Half a box is not the box, and eight workers on it is the oversubscription this is here
 * to stop.
 * @param {number} knee the lane's measured best on a box it has to itself
 * @param {{siblings?: number, cores?: number, slots?: number}} [box]
 * @returns {number}
 */
export function laneWorkers(knee, box = {}) {
  const slots = box.slots ?? verifySlots();
  const share = Math.max(1, Math.floor(knee / slots));
  return Math.max(1, Math.min(share, gateBudget(box.cores ?? availableParallelism(), slots) - (box.siblings ?? 0)));
}

/**
 * How many lanes of a wave may run at once. Each non-forking lane is one process working, so the
 * wave itself is bounded by the same budget — on a box too small for the roster, lanes wait for a
 * slot instead of all thrashing at once.
 * @param {number} lanes how many the wave holds
 * @param {{cores?: number, slots?: number}} [box]
 * @returns {number}
 */
export function waveParallelism(lanes, box = {}) {
  return Math.max(1, Math.min(lanes, gateBudget(box.cores ?? availableParallelism(), box.slots ?? verifySlots())));
}

/**
 * The unit lane's measured cap on a box it shares with the gate's other lanes (scripts/verify.mjs),
 * and the database lane's measured knee (db/__tests__/vitest.config.ts: 162 s in series → 87 s at
 * four workers, 71 s at eight, 113 s at twelve). Both are the value for ONE gate on the box.
 *
 * THE UNIT KNEE MOVED (v22 speed, 2026-09-13). Six was measured when two files in the lane each ran
 * the whole cad suite in a subprocess for about 110 s: the lane's wall was ONE file's wall, and no
 * number of workers could touch it — 106 s at six, 112 s at eight, 114 s at twelve. Those two
 * duplicated runs are gone (tests/cad/licence.test.ts, tests/cad/dwg/dwg-lane.test.ts), and with the
 * tail cut the lane is worker-bound again: on this 24-thread box, 350 files and ~200 s of work
 * measured 57 s at six, 39 s at ten, 35 s at twelve, 33 s at fourteen, 33 s at sixteen, 33 s at
 * twenty. Twelve is the knee — past it the curve is flat, because the lane's floor is now its own
 * slowest FILE (tests/takeoff/ingest/extractor-process.test.ts, 30 s), and the six lanes gating
 * beside it want cores too.
 */
export const UNIT_LANE_KNEE = 12;
export const DB_LANE_KNEE = 8;

/**
 * How many lanes gate BESIDE the unit lane in verify's middle wave — types, lint, the three drift
 * lanes and cad. One process each, and they are the reason the unit lane never had the box.
 */
export const VERIFY_WAVE_SIBLINGS = 6;

/**
 * THE JOURNEY LANE'S CAP (v22 speed, 2026-09-12).
 *
 * A journey worker is not a vitest worker: it is a browser, a browser context and a share of ONE
 * served product, so the knee is lower than the unit lane's and it is bounded at both ends. Six is
 * the ceiling — past it the workers queue on the single `next start` rather than on the box — and
 * the floor is one, because a two-core machine still has to be able to run the lane.
 */
export const JOURNEY_LANE_CAP = 6;

/**
 * The journey lane's knee ON THIS BOX. Six cores buy one journey worker: a worker drives a browser
 * (several processes of its own) and the server has to answer all of them out of one process, so
 * the share is deliberately coarse. On the 24-core box the engine builds on this is FOUR, which is
 * the lane's stated default — a number derived from the machine rather than pinned to it (B-17).
 * @param {number} [cores]
 * @returns {number}
 */
export function journeyKnee(cores = availableParallelism()) {
  return Math.max(1, Math.min(JOURNEY_LANE_CAP, Math.floor(cores / 6)));
}

/**
 * How many journeys this lane walks at once when nobody has said: the knee above, divided by the
 * gates on the box and clamped to what is left of this gate's budget, exactly as every other forking
 * lane is (`laneWorkers`). `CUBIT_E2E_WORKERS` and `--workers` both override it, and whichever
 * number wins is printed in the runner's summary and in every JOURNEY verdict (P4b §6).
 * @param {{siblings?: number, cores?: number, slots?: number}} [box]
 * @returns {number}
 */
export function journeyWorkers(box = {}) {
  return laneWorkers(journeyKnee(box.cores ?? availableParallelism()), box);
}
