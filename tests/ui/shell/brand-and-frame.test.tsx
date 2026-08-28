// @vitest-environment jsdom
/**
 * Public acceptance for AC-1 — the parts of the R-UI-030 frame a unit lane can honestly judge:
 * the components the increment declares, the vendored mark the rail carries, and the R-UI-070
 * usage table a test is required to reflect over.
 *
 * What is NOT here, deliberately: the painted frame. "shell-root contains shell-rail…", the 3 px
 * inset beam bar and the beam-100 row fill are claims about layout and paint, and jsdom lays
 * nothing out and resolves no `var()`. Those are graded in a browser — by the journey this
 * increment delivers (tests/e2e/shell.spec.ts, checkpoints j004-shell-light / j004-shell-dark,
 * baselines + axe) and by the held-out set's in-page token probe. Asserting them here against a
 * hand-built mount would be a second, weaker idea of the same guarantee (ARCH-02).
 *
 * The two source scans below are marked where they happen: AC-1's "never redrawn" is a statement
 * about the tree, and no runtime observation can see it (docs/design/shell.md §7).
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";

const SHELL_BARREL = "src/ui/shell/index.ts";
const BRAND_USAGE_BARREL = "src/ui/brand-usage/index.ts";
const VENDORED_MARK = "src/ui/brand/vextrus-mark-nospark.svg";
const BRAND_DIR = "src/ui/brand";

/** The frame's parts, as the increment's interfaces name them. */
const SHELL_EXPORTS = ["AppShell", "ShellRail", "ShellTopBar", "ShellInspector", "ShellEmptyState"] as const;

/** R-UI-070: the rail carries the quiet mark at 26 px — the beam spark is omitted below 32 px. */
const RAIL_MARK_PX = 26;
const SPARK_FLOOR_PX = 32;

/** The surfaces R-UI-070 lets the full spark mark appear on, and nowhere else. */
const SPARK_SURFACES = ["sign-in", "certificates"];

interface UsageRow {
  variant: string;
  minSizePx: number;
  sparkRule: string;
  surface: string;
}

async function brandUsage(): Promise<UsageRow[]> {
  const module = await productModule<Record<string, unknown>>(BRAND_USAGE_BARREL);
  const table = module["BRAND_USAGE"];
  expect(Array.isArray(table), `${BRAND_USAGE_BARREL} must export BRAND_USAGE — the enumerable R-UI-070 usage table (interfaces, AC-1)`).toBe(true);
  const rows = table as UsageRow[];
  expect(rows.length, "BRAND_USAGE must have rows — a table nothing can be reflected over is not a table").toBeGreaterThan(0);
  return rows;
}

/** Every authored file of the tree that could hold a redrawn geometry, outside the vendored set. */
function authoredFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(join(REPO_ROOT, directory))) {
    const here = `${directory}/${entry}`;
    if (statSync(join(REPO_ROOT, here)).isDirectory()) {
      if (here !== BRAND_DIR) authoredFiles(here, found);
      continue;
    }
    if (/\.(ts|tsx|css|svg|json)$/.test(entry)) found.push(here);
  }
  return found;
}

describe("AC-1: the shell's declared parts exist", () => {
  test("AC-1: src/ui/shell exports the frame's components", async () => {
    const shell = await productModule<Record<string, unknown>>(SHELL_BARREL);
    for (const name of SHELL_EXPORTS) {
      expect(typeof shell[name], `${SHELL_BARREL} must export ${name} (increment interfaces)`).toBe("function");
    }
  });

  test("AC-1: src/ui/brand-usage exports QuietMark and BRAND_USAGE", async () => {
    const brand = await productModule<Record<string, unknown>>(BRAND_USAGE_BARREL);
    expect(typeof brand["QuietMark"], `${BRAND_USAGE_BARREL} must export QuietMark — the rail's 26 px no-spark mark (interfaces)`).toBe("function");
    expect(Array.isArray(brand["BRAND_USAGE"]), `${BRAND_USAGE_BARREL} must export BRAND_USAGE`).toBe(true);
  });
});

describe("AC-1: the rail's mark is the vendored geometry at 26 px", () => {
  test("AC-1: QuietMark renders at exactly 26 px", async () => {
    const brand = await productModule<Record<string, unknown>>(BRAND_USAGE_BARREL);
    const QuietMark = brand["QuietMark"] as never;
    const view = render(createElement(QuietMark));
    try {
      const candidates = [...view.container.querySelectorAll("img, svg, span, div")];
      const sized = candidates.filter((element) => {
        const style = (element as HTMLElement).style;
        const declared = [element.getAttribute("width"), element.getAttribute("height"), style.width, style.height].filter((value): value is string => typeof value === "string" && value.trim() !== "");
        return declared.length >= 2 && declared.every((value) => value.trim().replace("px", "") === String(RAIL_MARK_PX));
      });
      expect(sized.length, `QuietMark must render the mark at exactly ${RAIL_MARK_PX} px square (R-UI-070; docs/design/shell.md §1) — it rendered: ${view.container.innerHTML.slice(0, 400)}`).toBeGreaterThan(0);
    } finally {
      view.unmount();
    }
  });

  test("AC-1: the mark is the vendored asset, referenced or inlined verbatim — never redrawn", () => {
    // Source scan (AC-1, docs/design/shell.md §7): "the geometry is never redrawn" is a fact about
    // the tree, and nothing rendered can witness it.
    const vendored = readFileSync(join(REPO_ROOT, VENDORED_MARK), "utf8");
    const geometry = [...vendored.matchAll(/\sd="([^"]+)"/g)].map((match) => match[1] ?? "").filter((path) => path.length > 12);
    expect(geometry.length, `${VENDORED_MARK} must hold path geometry to compare against`).toBeGreaterThan(0);

    expect(existsSync(join(REPO_ROOT, BRAND_USAGE_BARREL)), `${BRAND_USAGE_BARREL} is missing from the checkout — the product does not provide it yet`).toBe(true);
    const brandUsageSource = readFileSync(join(REPO_ROOT, BRAND_USAGE_BARREL), "utf8");
    const referencesTheAsset = brandUsageSource.includes("vextrus-mark-nospark.svg");
    const inlinesTheGeometry = geometry.every((path) => brandUsageSource.includes(path));
    expect(referencesTheAsset || inlinesTheGeometry, `${BRAND_USAGE_BARREL} must reference the vendored ${VENDORED_MARK} (or inline its geometry verbatim) — the brand assets are the vendored SVGs (R-UI-070, B-24)`).toBe(true);

    // …and nowhere else in the tree is that geometry spelled a second time.
    const elsewhere = authoredFiles("src")
      .filter((file) => file !== BRAND_USAGE_BARREL)
      .filter((file) => {
        const source = readFileSync(join(REPO_ROOT, file), "utf8");
        return geometry.some((path) => source.includes(path));
      })
      .map((file) => relative(".", file));
    expect(elsewhere, `the mark's geometry is redrawn outside ${BRAND_DIR}: a second spelling of a vendored path is exactly what R-UI-070 forbids`).toStrictEqual([]);
  });
});

describe("AC-1: BRAND_USAGE is the R-UI-070 usage table, and a test reflects over it", () => {
  test("AC-1: every row declares a variant, a minimum size, a spark rule and a surface", async () => {
    for (const row of await brandUsage()) {
      expect(typeof row.variant, `every BRAND_USAGE row names its variant: ${JSON.stringify(row)}`).toBe("string");
      expect(typeof row.surface, `every BRAND_USAGE row names its surface: ${JSON.stringify(row)}`).toBe("string");
      expect(typeof row.sparkRule, `every BRAND_USAGE row names its spark rule: ${JSON.stringify(row)}`).toBe("string");
      expect(Number.isFinite(row.minSizePx) && row.minSizePx > 0, `every BRAND_USAGE row names a positive minimum size: ${JSON.stringify(row)}`).toBe(true);
    }
  });

  test("AC-1: no row lets a spark be painted below 32 px", async () => {
    for (const row of await brandUsage()) {
      const sparkless = row.sparkRule === "never";
      expect(sparkless || row.minSizePx >= SPARK_FLOOR_PX, `R-UI-070: the beam spark is omitted below ${SPARK_FLOOR_PX} px, so a spark-bearing row cannot be usable smaller than that: ${JSON.stringify(row)}`).toBe(true);
    }
  });

  test("AC-1: the rail's rows are the quiet no-spark mark, usable at 26 px", async () => {
    const rail = (await brandUsage()).filter((row) => row.surface === "rail");
    expect(rail.length, "R-UI-070 gives the rail a usage row: the quiet no-spark mark").toBeGreaterThan(0);
    for (const row of rail) {
      expect(row.sparkRule, `the rail carries the quiet mark — the spark is never painted there: ${JSON.stringify(row)}`).toBe("never");
      expect(row.variant.includes("nospark"), `the rail's variant is the no-spark mark: ${JSON.stringify(row)}`).toBe(true);
      expect(row.minSizePx, `the rail renders the mark at ${RAIL_MARK_PX} px, so its row must permit that size: ${JSON.stringify(row)}`).toBeLessThanOrEqual(RAIL_MARK_PX);
    }
  });

  test("AC-1: the full spark mark appears only on sign-in and on certificates — copper's one scarcity", async () => {
    const rows = await brandUsage();
    const sparkBearingMarks = rows.filter((row) => row.variant === "mark" && row.sparkRule !== "never");
    expect(sparkBearingMarks.length, "R-UI-070 names the surfaces the full spark mark appears on; the table must carry them").toBeGreaterThan(0);
    for (const row of sparkBearingMarks) {
      expect(SPARK_SURFACES, `R-UI-070: the full spark mark appears only on sign-in and on certificates — ${JSON.stringify(row)} widens that`).toContain(row.surface);
    }
    for (const surface of SPARK_SURFACES) {
      expect(
        rows.some((row) => row.surface === surface && row.sparkRule !== "never"),
        `R-UI-070 gives ${surface} the full spark mark, so BRAND_USAGE must carry that row`,
      ).toBe(true);
    }
  });
});
