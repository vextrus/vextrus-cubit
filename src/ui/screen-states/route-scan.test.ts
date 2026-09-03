/**
 * A route key is answered once, whatever route groups spell it (R-UI-050, B-19): the roster a
 * screen's declarations are closed against is a set of addresses, not a count of files.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { routesOnDisk } from "./route-scan";

const PAGE = "export default function Page() { return null; }\n";

let appDir = "";

beforeAll(() => {
  appDir = mkdtempSync(join(tmpdir(), "cubit-route-scan-"));
  for (const segments of [["(a)", "x"], ["(b)", "x"], ["(a)", "(b)", "x"], ["(c)"], ["y", "x"]]) {
    const dir = join(appDir, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "page.tsx"), PAGE);
  }
});

afterAll(() => {
  rmSync(appDir, { recursive: true, force: true });
});

describe("routesOnDisk", () => {
  test("route-group siblings over one segment are one route, code-point sorted", () => {
    expect(routesOnDisk(appDir)).toEqual(["/", "/x", "/y/x"]);
  });

  test("a directory that holds no page is an empty roster, never a fault", () => {
    expect(routesOnDisk(join(appDir, "does-not-exist"))).toEqual([]);
  });
});
