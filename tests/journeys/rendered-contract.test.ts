/**
 * ONE READ WHEN THE SCREEN SAYS IT IS RENDERED (v22 speed, the founder's third decision).
 *
 * `steadyCount`, `steadyText`, `steadyAttribute` and `heldAttribute` each took `AGREEING_READS`
 * round trips to the browser for every answer, because agreement was the only proxy they had for a
 * screen having finished arriving. It is a proxy for a STATEMENT the product can make and, on a
 * virtualised table, already makes: `data-rows-rendered="<n>"` is the count, and a settled
 * `data-state` on a region or its screen root is the screen saying it has stopped. Where that
 * statement is published, ONE reading after it is the answer and the loop is three trips of nothing.
 *
 * Where it is NOT published the loop stays — it is still the honest reading — and the reader prints
 * `read: no rendered contract on <selector> — 3 readings` so the missing contract gets added rather
 * than assumed (B-19: the cause is printed to be a cause).
 *
 * Two halves are proved here. `contractIn` is the page side, run over a real jsdom tree, because it
 * is shipped to the browser as source and cannot close over anything. The readers are proved over a
 * fake page: a locator that PUBLISHES counts its own readings, so "one read" is a measured number
 * rather than a claim.
 *
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi } from "vitest";
import { SETTLE_CONTRACT, contractFault, contractIn, type ContractReading } from "../e2e/support/settled";
import { heldAttribute, steadyCount, steadyText } from "../e2e/support/retrying-read";

/** Build a tree from HTML and answer the elements a selector matches, as `evaluateAll` would. */
function tree(html: string, selector: string): Element[] {
  document.body.innerHTML = html;
  return [...document.body.querySelectorAll(selector)];
}

/**
 * A locator that publishes a rendered contract — and counts every reading taken of it, so the
 * saving is measured. `evaluateAll` is handed the real `contractIn`, exactly as Playwright hands it
 * to the page, and the readings it governs are answered from `values`.
 */
function publishing(reading: ContractReading | (() => ContractReading), answers: { count?: number[]; text?: string[]; attribute?: (string | null)[] }): {
  locator: never;
  reads: () => number;
} {
  let reads = 0;
  const next = <T>(values: T[] | undefined, fallback: T): T => {
    const value = values?.[Math.min(reads, (values.length ?? 1) - 1)] ?? fallback;
    reads += 1;
    return value;
  };
  const locator = {
    evaluateAll: async () => (typeof reading === "function" ? reading() : reading),
    count: async () => next(answers.count, 0),
    textContent: async () => next(answers.text, ""),
    getAttribute: async () => next(answers.attribute, null),
  } as never;
  return { locator, reads: () => reads };
}

const RENDERED: ContractReading = { published: true, by: SETTLE_CONTRACT.rowsRendered, value: "7" };
const SETTLED: ContractReading = { published: true, by: SETTLE_CONTRACT.screenState, value: "settled" };

describe("the page side: which publisher governs a region (contractIn)", () => {
  test("the nearest publisher wins — a table's own row count over the screen root above it", () => {
    const elements = tree(
      `<div data-screen-root data-state="settled"><div data-virtualised data-rows-rendered="42"><span class="row">a</span></div></div>`,
      ".row",
    );
    expect(contractIn(elements, SETTLE_CONTRACT)).toEqual({ published: true, by: "data-rows-rendered", value: "42" });
  });

  test("a region that says its data-state IS the contract is read; a Radix popover's is not", () => {
    const region = tree(`<ul data-rendered-region data-state="settled"><li class="row">a</li></ul>`, ".row");
    expect(contractIn(region, SETTLE_CONTRACT).value).toBe("settled");
    // The whole reason the marker exists: `data-state="open"` is a menu being open, not a list
    // having rendered, and a search that climbed to the nearest bare `data-state` would take one
    // for the other.
    const popover = tree(`<div data-state="open"><button class="row">a</button></div>`, ".row");
    expect(contractIn(popover, SETTLE_CONTRACT), "an unmarked data-state publishes nothing").toEqual({ published: false, by: null, value: null });
  });

  test("a region that has not arrived is governed by the screen root that will hold it", () => {
    const none = tree(`<main data-screen-root data-state="loading"></main>`, ".row");
    expect(none).toHaveLength(0);
    expect(contractIn(none, SETTLE_CONTRACT)).toEqual({ published: true, by: "data-state", value: "loading" });
    // …and where the screen publishes nothing either, nothing is published and the caller loops.
    expect(contractIn(tree(`<main></main>`, ".row"), SETTLE_CONTRACT).published).toBe(false);
  });

  test("the least settled screen root is the one answered for, never the first that happens to be settled", () => {
    const none = tree(`<main data-screen-root data-state="settled"></main><aside data-screen-root data-state=""></aside>`, ".row");
    expect(contractIn(none, SETTLE_CONTRACT).value).toBe("");
  });
});

describe("contractFault: what a published contract has to say before a reading is taken", () => {
  test("a row count is a decimal count, and a state is one that is not still arriving", () => {
    expect(contractFault(RENDERED)).toBeNull();
    expect(contractFault(SETTLED)).toBeNull();
    expect(contractFault({ published: true, by: "data-rows-rendered", value: null })).toMatch(/not a row count/);
    for (const state of ["", "loading", "pending", null]) {
      expect(contractFault({ published: true, by: "data-state", value: state })).toMatch(/still arriving/);
    }
  });

  test("publishing NOTHING is not a fault — it is the cue to fall back, so it never polls", () => {
    expect(contractFault({ published: false, by: null, value: null })).toBeNull();
  });
});

describe("the readers: one reading on a rendered contract, three where there is none", () => {
  test("steadyCount takes ONE reading of a region that published its row count", async () => {
    const probe = publishing(RENDERED, { count: [7, 0, 0] });
    expect(await steadyCount(probe.locator, "the register's lines")).toBe(7);
    expect(probe.reads(), "the contract is the statement the loop was estimating — one reading is the answer").toBe(1);
  });

  test("steadyText and heldAttribute do the same, absence included", async () => {
    const text = publishing(SETTLED, { text: ["5,412 lines", "", ""] });
    expect(await steadyText(text.locator, "the count line")).toBe("5,412 lines");
    expect(text.reads()).toBe(1);
    // Absence IS an answer for heldAttribute: a disabled tab is href-less, and the contract holding
    // is the whole of what the read was waiting for.
    const missing = publishing(SETTLED, { attribute: [null] });
    expect(await heldAttribute(missing.locator, "href", "the disabled tab")).toBeNull();
    expect(missing.reads()).toBe(1);
  });

  test("a contract that holds but answers below the caller's floor falls back rather than lying", async () => {
    const probe = publishing(RENDERED, { count: [0, 3, 3, 3] });
    expect(await steadyCount(probe.locator, "the rows", { min: 1 })).toBe(3);
    expect(probe.reads(), "one reading, then the agreeing loop the floor asks for").toBeGreaterThan(1);
  });

  test("no contract anywhere: the three-agreeing loop stands, and the region is NAMED once", async () => {
    const said: string[] = [];
    const wrote = vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      said.push(String(chunk));
      return true;
    });
    try {
      const probe = publishing({ published: false, by: null, value: null }, { count: [0, 0, 3, 7, 7, 7] });
      expect(await steadyCount(probe.locator, "the drawings cards")).toBe(7);
      expect(probe.reads(), "nothing published, so agreement is still the only honest proxy").toBeGreaterThan(3);
    } finally {
      wrote.mockRestore();
    }
    expect(said.join(""), "the missing contract is named so it gets added, not assumed").toMatch(/read: no rendered contract on .* — 3 readings/);
  });
});
