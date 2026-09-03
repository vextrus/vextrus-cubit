/**
 * R-UI-005's two row heights are declared twice by necessity — as CSS custom properties the
 * stylesheet draws the row from, and as numbers the virtualiser estimates in — so this is the guard
 * that keeps them one fact (B-17): the numbers are read back out of src/ui/tokens.ts, the home the
 * stylesheet is generated from. It lives beside the primitive rather than inside it because the
 * token table is a computed value over every token group, and the browser bundle owes it nothing.
 */
import { describe, expect, test } from "vitest";
import { lightTokens } from "../../tokens";
import { ROW_HEIGHT_PX } from "./data-table";

describe("DataTable row heights", () => {
  test("each density's px number is the density token's pixel length", () => {
    const tokenOf = { comfortable: "--row-comfortable", compact: "--row-compact" } as const;
    for (const [density, token] of Object.entries(tokenOf)) {
      const declared = lightTokens[token];
      expect(declared).toMatch(/^\d+px$/);
      expect(ROW_HEIGHT_PX[density as keyof typeof tokenOf]).toBe(Number.parseInt(declared ?? "", 10));
    }
  });
});
