/**
 * R-UI-070 has four usage sentences, and `BRAND_USAGE` claims to be them "verbatim, enumerated".
 * The public acceptance grades the two that were already there — the rail's quiet mark and the
 * spark's two surfaces. This file grades the other two, which a consumer reflecting over the table
 * could not learn from it before: an issued PDF carries the light lockup **and the quiet
 * watermark**, and **a DRAFT banner never shares a page with the spark**.
 *
 * It reads the clause's own words out of the Bible rather than restating them, so the table is
 * graded against the law and not against a second copy of it kept here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import type { BrandUsage } from "../../../src/ui/brand-usage";

const USAGE_MODULE = "src/ui/brand-usage/index.ts";
const BIBLE = "docs/specs/cubit.bible.xml";

async function usage(): Promise<readonly BrandUsage[]> {
  const module = await productModule<{ BRAND_USAGE?: readonly BrandUsage[] }>(USAGE_MODULE);
  const rows = module.BRAND_USAGE;
  expect(Array.isArray(rows), `${USAGE_MODULE} must export BRAND_USAGE`).toBe(true);
  return rows as readonly BrandUsage[];
}

/** R-UI-070 as the Bible spells it — the text the table is graded against. */
const clause: string = readFileSync(join(REPO_ROOT, BIBLE), "utf8");

describe("R-UI-070: BRAND_USAGE enumerates the whole clause, not the half a test already read", () => {
  test("R-UI-070 really says an issued PDF carries the lockup and the quiet watermark", () => {
    expect(clause.includes("issued PDFs carry the light lockup and the quiet watermark"), `${BIBLE} must still spell the PDF sentence this file grades`).toBe(true);
    expect(clause.includes("a DRAFT banner never shares a page with the spark"), `${BIBLE} must still spell the DRAFT sentence this file grades`).toBe(true);
  });

  test("R-UI-070: the issued PDF's surface carries both the light lockup and the quiet watermark", async () => {
    const pdf = (await usage()).filter((row) => row.surface === "issued-pdf");
    expect(pdf.some((row) => row.variant.includes("lockup")), `an issued PDF carries the light lockup: ${JSON.stringify(pdf)}`).toBe(true);
    expect(pdf.some((row) => row.variant.includes("watermark")), `an issued PDF carries the quiet watermark, which the table omitted: ${JSON.stringify(pdf)}`).toBe(true);
  });

  test("R-UI-070: nothing an issued PDF carries bears the spark — copper's one scarcity", async () => {
    for (const row of (await usage()).filter((row) => row.surface === "issued-pdf")) {
      expect(row.sparkRule, `the full spark mark appears only on sign-in and on certificates, so no PDF row may permit one: ${JSON.stringify(row)}`).toBe("never");
    }
  });

  test("R-UI-070: the DRAFT banner is in the table, and the bar is readable from both sides", async () => {
    const rows = await usage();
    const draft = rows.filter((row) => row.variant === "draft-banner");
    expect(draft.length, "the DRAFT banner is a thing R-UI-070 places on a surface, so the usage table must carry it").toBeGreaterThan(0);
    for (const row of draft) {
      expect(row.sparkRule, `a DRAFT banner never shares a page with the spark, so it can never carry one itself: ${JSON.stringify(row)}`).toBe("never");
      expect(row.neverWith.some((barred) => rows.some((other) => other.variant === barred && other.sparkRule !== "never")), `the DRAFT row must bar the spark-bearing variant by name: ${JSON.stringify(row)}`).toBe(true);
    }
    for (const row of rows.filter((row) => row.sparkRule !== "never")) {
      expect(row.neverWith, `a spark-bearing row must say the DRAFT banner may not share its page: ${JSON.stringify(row)}`).toContain("draft-banner");
    }
  });

  test("R-UI-070: every row declares its co-occurrence bar, even when nothing is barred", async () => {
    for (const row of await usage()) {
      expect(Array.isArray(row.neverWith), `every BRAND_USAGE row states what it may not share a surface with: ${JSON.stringify(row)}`).toBe(true);
    }
  });
});
