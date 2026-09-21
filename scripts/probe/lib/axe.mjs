import { readFileSync } from "node:fs";

const SOURCE = readFileSync(new URL("../../../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** Run axe the way checkpoint.ts does: source via evaluate (CSP-lawful), the four tags. */
export async function runAxe(page) {
  await page.evaluate(SOURCE);
  const violations = await page.evaluate(async (tags) => {
    const results = await globalThis.axe.run(globalThis.document, { runOnly: { type: "tag", values: tags } });
    return results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 160) })),
    }));
  }, TAGS);
  const by = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) by[v.impact ?? "minor"] = (by[v.impact ?? "minor"] ?? 0) + v.nodes.length;
  return { violations, by };
}

export function axeLine(result) {
  return `axe=${result.by.serious}/${result.by.critical}/${result.by.moderate}`;
}

export function blocking(result) {
  return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}
