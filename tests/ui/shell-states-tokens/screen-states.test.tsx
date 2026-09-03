// @vitest-environment jsdom
/**
 * AC-4 — screen-states pays its rows (debt-src-ui-xotftv, z04uw7, 1opn2sf, 1d692k3).
 *
 * The roster question is graded on a tree this file stages, so the rule (`a route key is answered
 * once, whatever route groups spell it`) is judged on an input the suite controls rather than on
 * whatever `src/app` happens to hold today (B-19). The heading question is graded by comparing the
 * fault card with its own siblings' level rather than against a level typed in here.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import { sourceFilesUnder } from "./support/files";

const ROUTE_SCAN_MODULE = "src/ui/screen-states/route-scan.ts";
const STATE_SHELLS_MODULE = "src/ui/screen-states/state-shells.tsx";
const STATES_BARREL = "src/ui/screen-states/index.ts";
const MATRIX_MODULE = "src/ui/screen-states/matrix.tsx";
/** The name the sweep removes; held as a literal so this file's own code never spells it. */
const REMOVED_SHELL = "PartialAnswer";

const HEADINGS = "h1, h2, h3, h4, h5, h6";

let stagedApp = "";

beforeAll(() => {
  stagedApp = mkdtempSync(join(tmpdir(), "cubit-route-dedupe-"));
  for (const segments of [["(a)", "x"], ["(b)", "x"]]) {
    const dir = join(stagedApp, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "page.tsx"), "export default function Page() { return null; }\n");
  }
});

afterAll(() => {
  rmSync(stagedApp, { recursive: true, force: true });
});

afterEach(() => {
  cleanup();
});

describe("AC-4: the route roster answers each key once", () => {
  test("AC-4(a): two route-group siblings over the same segment are one route", async () => {
    const { routesOnDisk } = await productModule<{ routesOnDisk: (dir: string) => string[] }>(ROUTE_SCAN_MODULE);
    expect(routesOnDisk(stagedApp)).toEqual(["/x"]);
  });
});

describe("AC-4: the fault card heads like its siblings", () => {
  test("AC-4(b): FaultCard's title is the level EmptyTeaching uses, and names its own alert region", async () => {
    const shells = await productModule<Record<string, unknown>>(STATE_SHELLS_MODULE);
    const EmptyTeaching = shells.EmptyTeaching as (p: Record<string, unknown>) => unknown;
    const FaultCard = shells.FaultCard as (p: Record<string, unknown>) => unknown;

    const teaching = render(createElement(EmptyTeaching as never, { heading: "Nothing here", body: "Add the first one.", action: "Add" }));
    const siblingLevel = teaching.container.querySelector(HEADINGS)?.tagName;
    expect(siblingLevel, "EmptyTeaching heads its state").toBeTruthy();
    cleanup();

    const { container } = render(createElement(FaultCard as never, { body: "Something went wrong." }));
    const heading = container.querySelector(HEADINGS);
    expect(heading, "the fault card heads its state").not.toBeNull();
    expect(heading?.tagName, "the fault card heads at its siblings' level").toBe(siblingLevel);
    expect(heading?.tagName, "which R-UI-060's in-screen states hold at h2").toBe("H2");

    const id = heading?.getAttribute("id");
    expect(id, "the heading can be pointed at").toBeTruthy();
    expect(container.querySelector(`section[role="alert"][aria-labelledby="${id ?? ""}"]`), "the alert region is named by its heading").not.toBeNull();
  });
});

describe("AC-4: the removed shell and the docblock that overclaimed", () => {
  test("AC-4(c): the partial shell is exported by neither module and named nowhere under src/", async () => {
    const shells = await productModule<Record<string, unknown>>(STATE_SHELLS_MODULE);
    const barrel = await productModule<Record<string, unknown>>(STATES_BARREL);
    expect(Object.keys(shells)).not.toContain(REMOVED_SHELL);
    expect(Object.keys(barrel)).not.toContain(REMOVED_SHELL);

    // The product's own modules, recursively — a suite beside the code may lawfully name what it
    // asserts the absence of, so the removal is graded where the name would still be *used*.
    const files = sourceFilesUnder(join(REPO_ROOT, "src"), [".ts", ".tsx"]).filter((file) => !/\.test\.tsx?$/.test(file));
    expect(files.length, "there is source to scan").toBeGreaterThan(0);
    const naming = files.filter((file) => readFileSync(file, "utf8").includes(REMOVED_SHELL));
    expect(naming.map((file) => file.slice(REPO_ROOT.length + 1)), "nothing under src/ still names it").toEqual([]);
  });

  test("AC-4(d): the bones docblock states the rule the code enforces, not a count read off a route", () => {
    const source = readFileSync(join(REPO_ROOT, MATRIX_MODULE), "utf8");
    const declaration = source.indexOf("const bones");
    expect(declaration, `${MATRIX_MODULE} declares bones`).toBeGreaterThan(-1);
    const before = source.slice(0, declaration);
    const closes = before.lastIndexOf("*/");
    const opens = before.lastIndexOf("/**", closes);
    expect(opens, "bones carries a docblock").toBeGreaterThan(-1);
    const docblock = before.slice(opens, closes + 2);

    expect(docblock.length, "the docblock says something").toBeGreaterThan(2);
    expect(docblock, "the docblock no longer sources the count from a route's loading.tsx").not.toMatch(/loading\.tsx/);
    expect(docblock, "and no longer claims the count is counted from anything").not.toMatch(/counted from/i);
  });
});
