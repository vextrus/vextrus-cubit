// @vitest-environment jsdom
/**
 * AC-2 — what a reader WITHOUT the permission MEETS on S-BBS, rendered (R-UI-050, I-bbs-1, C-13).
 *
 * The precedence that resolves `denied` is graded next door in `states.test.ts`; a resolved name is
 * not a screen. What stands here is the cell itself: the route's own `permission-denied` declaration
 * is mounted and read, and what a person reads must name the permission that is missing (MEASURE)
 * and who can grant it — a blank cell, a bare "Not allowed", or a cell that names some other
 * permission all fail here.
 *
 * The sentences are the PRODUCT'S own, read from its one copy registry and never typed here; that
 * registry is bound to docs/design/s-bbs.md §3 both ways round by `states.test.ts` (AM-09 §2), so a
 * screen cannot satisfy this by improvising its own words. Nothing here opens a database and nothing
 * here measures time (AM-10 §3).
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { screenStates } from "../../../src/ui/screen-states";
import { strings } from "../../../src/ui/strings";
import { mountState, unmountAll, visibleText } from "../../screen-states/support/matrix-contract";

/** The matrix key of this screen (test contract: routes). */
const ROUTE = "/t/[tenant]/p/[project]/takeoff/bbs";

/** The permission reading a project's bar schedule needs (Decision §2, I-bbs-1). */
const PERMISSION = "MEASURE";

/** One declared cell of the matrix, as the matrix declares one. */
type Cell = { render(): ReactNode };

afterEach(() => {
  unmountAll();
});

/** Every sentence this screen's denial is made of, as the product's one registry publishes them. */
function denialCopy(): [string, string][] {
  const table = strings as unknown as Record<string, string | undefined>;
  return Object.entries(table)
    .filter(([key, value]) => key.startsWith("bbs_denied") && typeof value === "string" && value.length > 0)
    .map(([key, value]) => [key, (value as string).replace(/\s+/gu, " ").trim()]);
}

describe("AC-2: the bar schedule's permission-denied cell tells a reader what is missing", () => {
  it("AC-2: the cell renders, names the MEASURE permission, and says who grants it", () => {
    const matrix = screenStates as unknown as Record<string, Record<string, Cell> | undefined>;
    const declaration = matrix[ROUTE];
    expect(declaration, `${ROUTE} has not joined the state matrix — the screen declares no states for R-UI-050 to grade`).toBeDefined();

    const cell = (declaration as Record<string, Cell>)["permission-denied"];
    expect(cell, `${ROUTE} declares a permission-denied cell, because a reader without MEASURE is a reader this screen has`).toBeDefined();

    const { container } = mountState((cell as Cell).render());
    const said = visibleText(container).replace(/\s+/gu, " ");
    expect(said.length, "the cell renders something a person can actually read (R-UI-060)").toBeGreaterThan(0);
    expect(said, `a reader who may not read the schedule is told WHICH permission they are missing — ${PERMISSION} on this project (Decision §2)`).toContain(PERMISSION);

    const copy = denialCopy();
    expect(copy.length, "the screen publishes the sentences its denial is made of (AM-09 §2) — `bbs_denied…` in src/ui/strings").toBeGreaterThan(0);
    const unsaid = copy.filter(([, sentence]) => !said.includes(sentence)).map(([key, sentence]) => `${key} ("${sentence}")`);
    expect(unsaid, `and the cell says them verbatim, the holder among them — a denial that names no way out is a dead end (C-13). It reads: ${said}`).toEqual([]);
  });
});
