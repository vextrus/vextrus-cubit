/**
 * AC-2 — the tRPC root is composed of one router file per module lane, context is minted per
 * request, and the shipped route handler answers `spine.health`.
 *
 * The lane set is the closed one the increment declares (ARCH-01's module lanes); everything else
 * about the router is derived by reflection so a lane that grows procedures later still passes.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  REPO_ROOT,
  ROOT_MODULE,
  ROUTERS_DIR,
  UUID_PATTERN,
  callWire,
  isRouterLike,
  loadContext,
  loadRoot,
  resultData,
  shippedHandler,
  topLevelKeys,
  type AppContext,
} from "./support/wire";

/** The module lanes of the layered tree (ARCH-01), in the increment's own order. */
const LANES = ["spine", "takeoff", "bid", "assure", "ai"] as const;

const request = (headers: Record<string, string> = {}) => new Request("http://cubit.test/api/trpc/spine.health", { headers: new Headers(headers) });

describe("AC-2: the tRPC root, its lanes and its context", () => {
  test("AC-2: appRouter composes exactly the five module lanes and no other top-level key", async () => {
    const { appRouter } = await loadRoot();
    expect(isRouterLike(appRouter), `${ROOT_MODULE} must export \`appRouter\` — a tRPC router`).toBe(true);

    expect(topLevelKeys(appRouter)).toEqual([...LANES].sort());
  });

  test("AC-2: each lane is defined in its own file under src/server/routers/ and mounted from there", async () => {
    const { appRouter, lanes } = await loadRoot();
    // The lanes' identity is read from its public home (`lanes`) and proved through the procedures
    // the root dispatches — tRPC's private `_def.record` is the factory's own copy and is nobody
    // else's to read or write (ARCH-02).
    const proceduresOf = (value: unknown): Record<string, unknown> => (value as { _def?: { procedures?: Record<string, unknown> } })._def?.procedures ?? {};
    const table = (lanes ?? {}) as Record<string, unknown>;

    for (const lane of LANES) {
      const relative = `${ROUTERS_DIR}/${lane}.ts`;
      expect(existsSync(join(REPO_ROOT, relative)), `${relative} is missing — every lane owns its own router file`).toBe(true);

      const specifier: string = join(REPO_ROOT, relative);
      const laneModule = (await import(specifier)) as Record<string, unknown>;
      const laneRouters = Object.values(laneModule).filter((value) => isRouterLike(value));
      expect(laneRouters.length, `${relative} exports no tRPC router`).toBeGreaterThan(0);

      const held = table[lane];
      expect(isRouterLike(held), `lanes.${lane} is not a router`).toBe(true);
      expect(
        laneRouters.some((candidate) => Object.is(candidate, held)),
        `lanes.${lane} is something other than the router exported by ${relative} — the lane must be composed from its own file, not re-declared at the root`,
      ).toBe(true);
      for (const path of Object.keys(proceduresOf(held))) {
        expect(
          Object.is(proceduresOf(appRouter)[`${lane}.${path}`], proceduresOf(held)[path]),
          `appRouter dispatches something other than ${relative}'s own procedure for ${lane}.${path}`,
        ).toBe(true);
      }
    }
  });

  test("AC-2: the composed procedure roster carries spine.health", async () => {
    const { appRouter } = await loadRoot();
    // Derived from the router itself: which paths exist, not how many.
    const paths = Object.keys(appRouter._def?.procedures ?? {});
    expect(paths, "appRouter exposes no procedures at all").not.toHaveLength(0);
    expect(paths).toContain("spine.health");
  });

  test("AC-2: createContext echoes an x-request-id header and mints the anonymous actor", async () => {
    const { createContext } = await loadContext();
    const ctx: AppContext = await createContext({ req: request({ "x-request-id": "req-from-the-edge" }) });

    expect(ctx.requestId).toBe("req-from-the-edge");
    expect(ctx.actor).toBe("anonymous");
  });

  test("AC-2: createContext mints a fresh UUID request id when no header is supplied", async () => {
    const { createContext } = await loadContext();
    const first: AppContext = await createContext({ req: request() });
    const second: AppContext = await createContext({ req: request() });

    expect(first.requestId).toMatch(UUID_PATTERN);
    expect(second.requestId).toMatch(UUID_PATTERN);
    expect(second.requestId, "each request gets its own id").not.toBe(first.requestId);
  });

  test("AC-2: GET /api/trpc/spine.health answers { ok: true, requestId } echoing the supplied x-request-id", async () => {
    const handler = await shippedHandler();
    const answer = await callWire(handler, "spine.health", { requestId: "req-health-echo" });

    expect(answer.status, `the health query answered ${answer.status}: ${answer.raw.slice(0, 400)}`).toBe(200);
    expect(resultData(answer)).toMatchObject({ ok: true, requestId: "req-health-echo" });
  });
});
