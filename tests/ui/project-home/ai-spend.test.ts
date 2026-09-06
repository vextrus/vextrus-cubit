// @vitest-environment jsdom
/**
 * AC-3 — "AI cost and disclosure: per-project model spend, calls, and outcomes on the project home"
 * (R-AI-005, L-FMT-02, docs/design/s-project.md §1, I-128).
 *
 * The ledger's money is an exact USD decimal, so it renders as a figure through the user-figure seam
 * beside a shipped unit badge — never through the money seam, which spells ৳ under BD document law,
 * and never converted, which is out of scope by name.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  PROJECT,
  TENANT,
  aSpend,
  all,
  copy,
  formatSeam,
  homeData,
  homeStrings,
  mountHome,
  one,
  productModule,
  projectHome,
  text,
} from "./support/project-home-stage";

/** The audit address the ledger link opens (test contract). */
const AUDIT_ROUTE = `/t/${TENANT}/p/${PROJECT}/audit`;

/** The one home of slot substitution (R-SPINE-060) — the outcomes line is filled, never re-spelled. */
async function filler(): Promise<(template: string, values: Record<string, string>) => string> {
  const strings = await productModule<{ fill: (template: string, values: Record<string, string>) => string }>("src/ui/strings/index.ts");
  return strings.fill;
}

afterEach(() => {
  cleanup();
});

describe("AC-3 — the AI cost so far", () => {
  test("AC-3: the ledger's spend renders as a figure with a USD badge, and no ৳ appears on the screen", async () => {
    const strings = await homeStrings();
    const format = await formatSeam();
    const spend = aSpend({ calls: 1234, proposed: 41, refused: 7, attributedCost: "18.4207" });
    const root = mountHome(await projectHome(), homeData({ spend }));

    expect(text(one(root, "project-home-ai-cost")), "the cost is the ledger's exact decimal through the user-figure seam").toContain(
      format.formatUserFigure(spend.attributedCost),
    );

    const unit = one(root, "project-home-ai-cost-unit");
    const badges = unit.matches('[data-testid="unit-badge"]') ? [unit] : all(unit, "unit-badge");
    expect(badges, "the unit is the shipped badge, worn once (B-17, I-134)").toHaveLength(1);
    expect(text(badges[0] as HTMLElement), "and it reads the string table's USD").toBe(copy(strings, "project_home_ai_cost_unit"));
    expect(copy(strings, "project_home_ai_cost_unit"), "which is the currency the ledger records in").toBe("USD");
    expect(text(root), "no taka is spelled anywhere on this screen: converting the ledger is out of scope (I-128)").not.toContain("৳");
  });

  test("AC-3: calls and outcomes are figures too, and the ledger link opens the audit address", async () => {
    const strings = await homeStrings();
    const format = await formatSeam();
    const fill = await filler();
    const spend = aSpend({ calls: 1234, proposed: 41, refused: 7, attributedCost: "18.4207" });
    const root = mountHome(await projectHome(), homeData({ spend }));

    expect(text(one(root, "project-home-ai-calls")), "how many calls were made, grouped by the seam").toContain(format.formatUserFigure(String(spend.calls)));
    expect(text(one(root, "project-home-ai-outcomes")), "what came of them, in the table's own sentence with both counts through the seam").toBe(
      fill(copy(strings, "project_home_ai_outcomes"), {
        proposed: format.formatUserFigure(String(spend.proposed)),
        refused: format.formatUserFigure(String(spend.refused)),
      }),
    );

    const ledger = one(root, "project-home-ai-ledger");
    expect(ledger.getAttribute("href"), "the evidence for every figure here is the model ledger on S-Audit").toBe(AUDIT_ROUTE);
    expect(text(ledger), "named in the table's words").toBe(copy(strings, "project_home_ai_ledger"));
  });

  test("AC-3: with no call made the figures still state their zeros, and the region says why", async () => {
    const strings = await homeStrings();
    const format = await formatSeam();
    const fill = await filler();
    const spend = aSpend();
    expect(spend.calls, "the fixture this branch is about is a project no model has been called for").toBe(0);
    const root = mountHome(await projectHome(), homeData({ spend }));

    expect(text(one(root, "project-home-ai-cost")), "nothing spent is a stated zero, not an absence").toContain(format.formatUserFigure(spend.attributedCost));
    expect(text(one(root, "project-home-ai-calls")), "and so is no call").toContain(format.formatUserFigure(String(spend.calls)));
    expect(text(one(root, "project-home-ai-outcomes")), "and so are no outcomes").toBe(
      fill(copy(strings, "project_home_ai_outcomes"), {
        proposed: format.formatUserFigure(String(spend.proposed)),
        refused: format.formatUserFigure(String(spend.refused)),
      }),
    );
    expect(text(one(root, "project-home-ai-none")), "silence never happens: the zeros are explained (R-UI-020)").toBe(copy(strings, "project_home_ai_none"));
  });

  test("AC-3: above zero the none line is absent — it explains zeros and nothing else", async () => {
    const root = mountHome(await projectHome(), homeData({ spend: aSpend({ calls: 1, proposed: 1, refused: 0, attributedCost: "0.0041" }) }));

    expect(all(root, "project-home-ai-none"), "a project with a call behind it is not a project with none").toHaveLength(0);
  });
});
