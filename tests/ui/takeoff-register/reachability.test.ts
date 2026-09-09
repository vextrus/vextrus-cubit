// @vitest-environment jsdom
/**
 * AC-1's declarable half — the two addresses this increment lands, and the seven states each of them
 * declares (R-UI-050, B-19, docs/design/s-takeoff.md §2).
 *
 * The matrix is checkable, not aspirational: the suite reflects over the ONE enumerable place a
 * screen declares its cells in and asks what is missing, so a cell nobody wrote is a failing test
 * rather than a review note. The addresses themselves are asked of the route builders that own them,
 * never spelled twice (B-17) — a tab becomes live by gaining an address and nothing else changes.
 *
 * AC-1's browser half — following the tab and landing on the register beneath `takeoff-nav` — is
 * walked by `tests/e2e/register.spec.ts`, because a real navigation is the only honest proof that
 * the project home is the visible door into this screen.
 */
import { describe, expect, test } from "vitest";
import { productModule } from "../../server/support/wire";

/** The two routes this increment introduces, as the R-UI-050 matrix keys them (test contract). */
const TAKEOFF_ROUTE = "/t/[tenant]/p/[project]/takeoff";
const REGISTER_ROUTE = "/t/[tenant]/p/[project]/takeoff/register";

/** The homes the increment's interfaces name. */
const SCREEN_STATES_MODULE = "src/ui/screen-states/index.ts";
const AREAS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/home/areas.ts";
const REGISTER_ADDRESS_MODULE = "src/app/(app)/t/[tenant]/p/[project]/takeoff/register/route-address.ts";

/** One workspace and one project, so an address is asked of the builder rather than transcribed. */
const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

interface AreaEntry {
  key: string;
  route: ((tenantId: string, projectId: string) => string) | null;
}

describe("AC-1 — the two addresses, and the states they declare", () => {
  test("AC-1: both routes declare every state R-UI-050 names", async () => {
    const { missingStates } = await productModule<{ missingStates: (routes: readonly string[]) => string[] }>(SCREEN_STATES_MODULE);
    expect(typeof missingStates, `${SCREEN_STATES_MODULE} publishes \`missingStates\``).toBe("function");
    expect(
      missingStates([TAKEOFF_ROUTE, REGISTER_ROUTE]),
      "every cell of both routes is declared and mountable — the redirect's seven delegated to the register route, the register's seven rendered (Decision §2)",
    ).toEqual([]);
  });

  test("AC-1: the project home's Takeoff area is a live address, spelled by its own route builder", async () => {
    const areas = await productModule<{ PROJECT_AREAS: readonly AreaEntry[]; takeoffRoute?: (t: string, p: string) => string }>(AREAS_MODULE);
    const takeoff = areas.PROJECT_AREAS.find((area) => area.key === "takeoff");
    expect(takeoff, "S-Project's seven areas still hold `takeoff`").toBeTruthy();
    expect(typeof areas.takeoffRoute, `${AREAS_MODULE} publishes \`takeoffRoute\` — the address the tab becomes live by gaining`).toBe("function");
    expect((takeoff as AreaEntry).route, "the tab's availability is read off its route, never written beside it (I-126)").toBe(areas.takeoffRoute);
    expect((areas.takeoffRoute as (t: string, p: string) => string)(TENANT, PROJECT), "and that address is the one the test contract names").toBe(`/t/${TENANT}/p/${PROJECT}/takeoff`);
  });

  test("AC-1: the register workspace's own address is spelled once, by `registerRoute`", async () => {
    const address = await productModule<{ registerRoute?: (t: string, p: string) => string }>(REGISTER_ADDRESS_MODULE);
    expect(typeof address.registerRoute, `${REGISTER_ADDRESS_MODULE} publishes \`registerRoute\` (test contract)`).toBe("function");
    expect((address.registerRoute as (t: string, p: string) => string)(TENANT, PROJECT), "the register stands one segment below the takeoff address").toBe(`/t/${TENANT}/p/${PROJECT}/takeoff/register`);
  });
});
