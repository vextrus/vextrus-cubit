/**
 * PERF-311 — a 5,000-line draft BOQ rendered through the real pinned renderer, and what it cost
 * (PB-6, AM-10 §3, R-TO-053).
 *
 * This is the ONE place a duration is asserted for this seam. It is collected by `pnpm test:perf`
 * (`--journey PERF-`) and by nothing else: the journey lane is asked for by journey name, so no
 * gate lane pays this render's wall time and no journey's budget is spent on it.
 *
 * The render runs IN PROCESS — no browser, no server, no database. What is being measured is the
 * document seam: the payload the product's own schema parses, the template it stages, and the
 * pinned Typst the toolchain holds. A budget is recorded as well as asserted, so the number is on
 * the record for the run that comes after this one.
 */
import { readFileSync, readdirSync, type Dirent } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { BOQ_DRAFT } from "../takeoff/boq/support/draft-shapes";
import { syntheticDraftPayload } from "../takeoff/boq/support/synthetic-draft";

/** PB-6: what a 5,000-line unpriced draft may take to render, end to end, once. */
const PB_6_MS = 20_000;

/** The size the budget is stated at (R-TO-053's own working draft, six sections). */
const LINES = 5_000;

/** tests/e2e/ → the checkout. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A render takes a cold subprocess, three subset faces and 5,000 rows of layout; give it room. */
test.setTimeout(600_000);

test.describe("PERF-311 — the unpriced draft renders 5,000 lines inside PB-6", () => {
  test("PERF-311: a 5,000-line draft renders through the pinned renderer inside PB-6, and the cost is recorded", async ({ browserName }, testInfo) => {
    // This budget wants no browser: the runner's fixture is named only because a Playwright test
    // signature must destructure one, and the render below runs in this process.
    void browserName;

    const documents = (await import(join(REPO_ROOT, "src/core/documents/index.ts"))) as {
      renderDocument: (kind: string, payload: unknown, ctx: { requestId: string; actor: string }, deps?: unknown) => Promise<{ pdf: Uint8Array; sha256: string }>;
    };
    expect(typeof documents.renderDocument, "the document seam publishes renderDocument — PERF-311 measures the shipped path and no stand-in").toBe("function");

    const payload = syntheticDraftPayload(LINES);
    const lines = payload.sections.flatMap((section) => section.groups.flatMap((group) => group.lines)).length;
    expect(lines, `the draft under the budget holds ${LINES} lines`).toBe(LINES);
    expect(payload.sections.length, "spread over all six sections of L-BD-08").toBe(6);

    const startedAt = Date.now();
    // The real pinned renderer: no injected `compile`, because a budget over a stub measures the stub.
    const rendered = await documents.renderDocument(BOQ_DRAFT, payload, { requestId: "perf-311", actor: "perf" });
    const ms = Date.now() - startedAt;

    expect(rendered.pdf.byteLength, "the render produced a document, so the number below is the cost of one").toBeGreaterThan(0);

    testInfo.annotations.push({ type: "PB-6", description: String(ms) });
    await testInfo.attach("pb-6.json", { body: Buffer.from(JSON.stringify({ lines: LINES, ms }), "utf8"), contentType: "application/json" });

    expect(ms, `PB-6: a ${LINES}-line unpriced draft renders inside ${PB_6_MS} ms, and this run took ${ms} ms`).toBeLessThanOrEqual(PB_6_MS);

    // white-box: AC-6 — the second half of this criterion is a property of the ACCEPTANCE'S OWN TEXT
    // ("no file under tests/takeoff/boq/**, tests/docs/** or tests/e2e/boq.spec.ts asserts a
    // duration"), which can only be read from those files. No product source is read here. It stands
    // in this case so that the one lawful duration and the rule about every other are proved together.
    const suites = [...filesUnder("tests/takeoff/boq"), ...filesUnder("tests/docs"), "tests/e2e/boq.spec.ts"];
    // Spelled in halves so that this spec — which holds the one lawful duration assertion — is not
    // caught by the rule it states about the others.
    const banned = [`toBe${"LessThan"}`, `toBe${"LessThanOrEqual"}`, `performance${"."}now`];

    for (const file of suites) {
      let text: string;
      try {
        // Comments are blanked: a suite that QUOTES the rule is not a suite that breaks it (Q-17).
        // white-box: AC-6 — the criterion is a property of the ACCEPTANCE'S OWN TEST TEXT ("no file under
        // tests/takeoff/boq/**, tests/docs/** or tests/e2e/boq.spec.ts asserts a duration"). Only these
        // test files are read; no file under src/, scripts/ or db/ is opened here.
        text = readFileSync(join(REPO_ROOT, file), "utf8").replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
      } catch {
        continue;
      }
      for (const forbidden of banned) {
        expect(text.includes(forbidden), `${file} asserts no duration: a performance assertion lives only in a PERF- spec (AM-10 §3)`).toBe(false);
      }
    }
  });
});

/** Every `.ts` file under one directory of the checkout, repo-relative. */
// white-box: AC-6 — the roster of TEST files the criterion names ("no file under tests/takeoff/boq/**,
// tests/docs/** ... asserts a duration"); it is called with test directories only, never with src/,
// scripts/ or db/.
function filesUnder(root: string): string[] {
  const found: string[] = [];
  const walk = (relative: string): void => {
    let entries: Dirent[];
    try {
      // white-box: AC-6 — enumerating the acceptance's own test directories, named by the criterion.
      entries = readdirSync(join(REPO_ROOT, relative), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith(".ts")) found.push(next);
    }
  };
  walk(root);
  return found;
}
