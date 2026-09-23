// Whether verify's cad lane stands beside this suite, and the one check that proves it is the lane
// a suite would otherwise run by hand.
//
// Inside `pnpm verify` the unit lane runs in the same wave as the cad lane (scripts/verify.mjs
// planWaves), and verify says so through the unit lane's environment (`LANE_ENV.unit`). Two suites
// assert that verify's cad lane is green — tests/cad/dwg/dwg-lane (AC-6) and tests/cad/licence
// (AC-7) — and each used to RUN it, ruff and the whole pytest collection, so one verify ran the cad
// lane three times over one tree. Beside the lane, a suite proves the lane's COMMAND is what it
// would have run — `ruff check cad`, then pytest over the whole `cad` tree with nothing set aside
// but the fixture regenerations the lane owns — and leaves the verdict to the lane, whose red fails
// the chain. Run on its own (`pnpm test`), the suite still runs the lane itself.
import { expect } from "vitest";
import { LANE_COMMANDS } from "../../../scripts/verify.mjs";

/** Verify's unit lane is told the cad lane runs beside it in the same chain. */
export const CAD_LANE_BESIDE = process.env["CUBIT_CAD_LANE_BESIDE"] === "1";

/** The only argument verify's cad lane may add to `pytest cad`: setting aside a fixture regeneration. */
const REGENERATION_SET_ASIDE = /^--ignore=cad\/tests\/sanity\/test_[a-z0-9_]+_regenerate\.py$/;

/** The sibling lane is `ruff check cad`, then pytest over the whole `cad` tree the suite would run. */
export function expectCadLaneBeside(criterion: string): void {
  const lane = LANE_COMMANDS["cad"];
  expect(lane?.[0], `${criterion}: verify's cad lane lints the cad package first`).toEqual(["ruff", "check", "cad"]);
  const pytest = lane?.[1] ?? [];
  expect(pytest.slice(0, 2), `${criterion}: and then runs pytest over the whole cad tree`).toEqual(["pytest", "cad"]);
  const setAside = pytest.slice(2).filter((argument) => !REGENERATION_SET_ASIDE.test(argument));
  expect(setAside, `${criterion}: setting aside nothing but the fixture regenerations the lane owns`).toEqual([]);
}
