/**
 * AC-4(a) and AC-4(b) — the lanes have one home, proved through procedures rather than through
 * tRPC's private record (ARCH-02).
 *
 * The root no longer writes into `_def.record` to make `appRouter.spine` the lane's own object;
 * `lanes` is the public home of that identity, and what the root MOUNTS is proved by the procedures
 * it dispatches: every procedure of a lane's own router is the very object the composed router
 * resolves under `<lane>.<path>`.
 */
import { describe, expect, test } from "vitest";
import { join } from "node:path";
import { REPO_ROOT, ROOT_MODULE, ROUTERS_DIR, assertOnlyOneTestRebaselined, isRouterLike, loadRoot, productSource, stripComments, type RouterLike } from "./support/wire";

const SPINE_ROUTER_SUITE = "tests/server/spine-router.test.ts";

/** The pre-fix assertion B-20 re-baselines: lane identity read through tRPC's private record. */
const REBASELINED_TEST = "AC-2: each lane is defined in its own file under src/server/routers/ and mounted from there";

/** The module lanes of the layered tree (ARCH-01), sorted — the closed set the root composes. */
const LANES = ["ai", "assure", "bid", "spine", "takeoff"] as const;

const proceduresOf = (router: RouterLike): Record<string, unknown> => router._def?.procedures ?? {};

describe("AC-4: the lanes' public home", () => {
  test("AC-4: the root exports a frozen lanes table and mutates nothing private", async () => {
    const code = stripComments(productSource(ROOT_MODULE));
    expect(code.includes("_def.record"), `${ROOT_MODULE} still writes tRPC's private record — the lanes' identity has a public home now`).toBe(false);
    expect(code.includes("Object.assign("), `${ROOT_MODULE} still binds the lanes on with Object.assign`).toBe(false);

    const { lanes } = await loadRoot();
    expect(lanes, `${ROOT_MODULE} must export \`lanes\``).toBeTypeOf("object");
    const table = lanes as Readonly<Record<string, RouterLike>>;
    expect(Object.isFrozen(table), "the lane table is frozen: a lane read at a seam is the composed one, never a mutated one").toBe(true);
    expect(Object.keys(table).sort()).toEqual([...LANES]);
  });

  test("AC-4: each lane in the table is its own file's router, and the root dispatches that router's procedures", async () => {
    const { appRouter, lanes } = await loadRoot();
    expect(lanes, `${ROOT_MODULE} must export \`lanes\` — the lanes' public home (ARCH-02)`).toBeTypeOf("object");
    const table = (lanes ?? {}) as Readonly<Record<string, RouterLike>>;
    const mounted = proceduresOf(appRouter);

    for (const lane of LANES) {
      const relative = `${ROUTERS_DIR}/${lane}.ts`;
      const specifier: string = join(REPO_ROOT, relative);
      const laneModule = (await import(specifier)) as Record<string, unknown>;
      const exported = Object.values(laneModule).filter((value) => isRouterLike(value));
      expect(exported.length, `${relative} exports no tRPC router`).toBeGreaterThan(0);

      const held = table[lane];
      expect(
        exported.some((candidate) => Object.is(candidate, held)),
        `lanes.${lane} is not the router ${relative} exports — a lane composed at the root is a second home for it (ARCH-02)`,
      ).toBe(true);

      for (const path of Object.keys(proceduresOf(held as RouterLike))) {
        expect(
          Object.is(mounted[`${lane}.${path}`], proceduresOf(held as RouterLike)[path]),
          `appRouter dispatches something other than ${relative}'s own procedure for ${lane}.${path}`,
        ).toBe(true);
      }
    }
  });

  test("AC-4: the B-20 re-baseline moves exactly the lane-identity assertion", () => {
    assertOnlyOneTestRebaselined(SPINE_ROUTER_SUITE, REBASELINED_TEST);
  });
});
