/**
 * The roster arms by input existence (B-19): a `page.tsx` added to a tree joins the routes that tree
 * holds, and a screen that joins the roster without declarations owes its seven states.
 *
 * The tree scanned here is staged in a temporary directory rather than in `src/app`, so the rule is
 * graded on an input this suite controls and no product route has to be invented to grade it.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { STATE_NAMES, missingStates, screenStates } from "../../src/ui/screen-states";
import { routesOnDisk } from "../../src/ui/screen-states/route-scan";

/** A staged app directory: `(group)/page.tsx`, a nested screen, and a file that routes nothing. */
let stagedApp = "";

beforeAll(() => {
  stagedApp = mkdtempSync(join(tmpdir(), "cubit-app-scan-"));
  const page = (...segments: string[]): void => {
    const dir = join(stagedApp, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "page.tsx"), "export default function Page() { return null; }\n");
  };
  page("(marketing)");
  page("(marketing)", "pricing");
  page("t", "[tenant]", "reports");
  mkdirSync(join(stagedApp, "components"), { recursive: true });
  writeFileSync(join(stagedApp, "components", "layout.tsx"), "export default function Layout() { return null; }\n");
});

afterAll(() => {
  rmSync(stagedApp, { recursive: true, force: true });
});

describe("routesOnDisk derives a roster from whatever tree it is given", () => {
  test("route groups drop out, the root page is '/', nested screens keep their segments", () => {
    expect(routesOnDisk(stagedApp)).toEqual(["/", "/pricing", "/t/[tenant]/reports"]);
  });

  test("a directory holding no page.tsx, and a directory that does not exist, hold no screens", () => {
    expect(routesOnDisk(join(stagedApp, "components"))).toEqual([]);
    expect(routesOnDisk(join(stagedApp, "no-such-directory"))).toEqual([]);
  });

  test("a route the matrix has never heard of owes all seven of its states, and a declared one owes none", () => {
    const undeclared = ["/pricing", "/t/[tenant]/reports"];
    const owed = undeclared
      .flatMap((route) => [...STATE_NAMES].map((state) => `${route}/${state}`))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    // "/" is staged too, and it is a screen the matrix declares — so it owes nothing here.
    expect(missingStates(routesOnDisk(stagedApp), screenStates)).toEqual(owed);
  });
});
