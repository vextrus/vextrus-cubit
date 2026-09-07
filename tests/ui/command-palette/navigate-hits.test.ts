// @vitest-environment jsdom
/**
 * AC-2 (the frame's half) — what the palette does with an answer: one row per hit under the
 * navigate group, each naming its kind, and Enter on a row landing on the address that kind builds
 * (R-SPINE-050, R-UI-032).
 *
 * The expected address is never spelled here: it is built by the route-address home that owns it
 * (B-17), from the same fixture the search answered with (B-19).
 */
import { afterEach, describe, expect, test } from "vitest";
import {
  GROUP,
  HITS,
  HIT_KINDS,
  QUERY,
  TESTID,
  itemsOf,
  maybe,
  mountFrame,
  openPalette,
  arrowTo,
  routeOf,
  settle,
  text,
  typeQuery,
  unmountAll,
} from "./support/palette-stage";

afterEach(() => {
  unmountAll();
});

describe("AC-2: navigation hits, and where each kind leads", () => {
  test("AC-2: one row per hit under the navigate group, each naming its kind and standing available", async () => {
    const frame = await mountFrame();
    await openPalette(frame);
    await typeQuery(frame, QUERY);

    const rows = itemsOf(GROUP.navigate);
    expect(rows.length, `\`${TESTID.group}[data-group="navigate"]\` holds one \`${TESTID.item}\` per hit (AC-2)`).toBe(HITS.length);

    const kinds = rows.map((row) => row.getAttribute("data-kind"));
    expect([...kinds].sort(), "each row carries `data-kind` equal to its hit's kind (AC-2)").toEqual([...HIT_KINDS].sort());

    for (const hit of HITS) {
      const row = rows.find((candidate) => candidate.getAttribute("data-kind") === hit.kind);
      expect(row, `the list holds the ${hit.kind} hit`).toBeDefined();
      expect((row as HTMLElement).getAttribute("data-available"), `a hit the tenant can reach stands available (AC-2)`).toBe("true");
      expect(text(row as HTMLElement), `the ${hit.kind} row reads the name the search answered with`).toContain(hit.label);
    }

    const list = maybe(TESTID.list);
    expect(list, `the rows stand inside \`${TESTID.list}\``).not.toBeNull();
    for (const row of rows) {
      expect((list as HTMLElement).contains(row), "every row stands inside the list (§ 1)").toBe(true);
    }
  });

  for (const hit of HITS) {
    test(`AC-2: Enter on the ${hit.kind} hit navigates to the address its kind builds, once, and closes the dialog`, async () => {
      const frame = await mountFrame();
      await openPalette(frame);
      await typeQuery(frame, QUERY);

      await arrowTo(frame, (option) => option.getAttribute("data-kind") === hit.kind, `the ${hit.kind} hit`);
      await frame.user.keyboard("{Enter}");
      await settle();

      expect(frame.navigated, `choosing the ${hit.kind} hit navigates exactly once, to the address ${hit.kind} builds (AC-2)`).toEqual([
        await routeOf(hit),
      ]);
      expect(maybe(TESTID.palette), "choosing a hit closes the palette (AC-2)").toBeNull();
    });
  }
});
