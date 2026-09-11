// @vitest-environment jsdom
/**
 * The figure primitives (Design Direction 00 §5 item 5): `Stat`, `QuantityText`, `MoneyText`.
 *
 * `src/ui` may import no value from `src/core` (ARCH-01), so what is graded here is the SEAM, not
 * arithmetic: the components render exactly what the document's conventions answered, add no
 * grouping of their own, and carry the exact value on the element. The sample conventions below
 * stand in for SEAM-FORMAT the way `SAMPLE_JOBS_FORMAT` stands in for the jobs register in the
 * gallery — the readings are the ones `src/core/format.ts` produces for these inputs, quoted, and
 * the wiring itself is proved where the app installs it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FigureProvider, type FigureFormat } from "./figures";
import { MoneyText } from "./money-text";
import { QuantityText } from "./quantity-text";
import { Stat } from "./stat";

/** A crore, as the document writes it — the reading §5 item 5 spells out. */
const CRORE_IN = "10000000.00";
const CRORE_OUT = "1,00,00,000.00";

const FORMAT: FigureFormat = {
  figure: (value) => (value === "10000000" ? "1,00,00,000" : value === "1620.505" ? "1,620.505" : value),
  money: (amount) => (amount === CRORE_IN ? CRORE_OUT : amount === "-2500.00" ? "-2,500.00" : amount),
  date: (at) => at.toISOString(),
};

const within = (node: React.ReactNode) => render(<FigureProvider format={FORMAT}>{node}</FigureProvider>);

afterEach(cleanup);

describe("QuantityText", () => {
  test("the figure is the document's, the unit is a badge, and the exact value stays on the element", () => {
    within(<QuantityText value="1620.505" unit="m³" />);
    const figure = screen.getByTestId("quantity-text");
    expect(figure.getAttribute("data-value"), "the exact decimal is what a suite and a copy both get").toBe("1620.505");
    expect(figure.textContent).toContain("1,620.505");
    expect(screen.getByTestId("unit-badge").textContent, "the unit is carried verbatim, never translated").toBe("m³");
  });

  test("the lakh/crore reading is the seam's answer, rendered — never a grouping written here", () => {
    const money = vi.fn(() => "");
    const figure = vi.fn(() => "1,00,00,000");
    within(<QuantityText value="10000000" format={{ figure, money, date: () => "" }} />);
    expect(figure).toHaveBeenCalledWith("10000000");
    expect(screen.getByTestId("quantity-text").textContent).toBe("1,00,00,000");
  });

  test("a caller's own conventions outrank the tree's", () => {
    within(<QuantityText value="10000000" format={{ ...FORMAT, figure: () => "own" }} />);
    expect(screen.getByTestId("quantity-text").textContent).toBe("own");
  });

  test("a tree with no conventions installed does not print an ungrouped figure — it raises", () => {
    expect(() => render(<QuantityText value="10000000" />)).toThrow(/figure conventions/);
  });
});

describe("MoneyText", () => {
  test("the figure is the seam's, and the taka sign is drawn rather than typed", () => {
    const { container } = within(<MoneyText amount={CRORE_IN} />);
    const money = screen.getByTestId("money-text");
    expect(money.getAttribute("data-amount")).toBe(CRORE_IN);
    expect(money.textContent, "grouped lakh/crore, to the paisa").toBe(CRORE_OUT);

    const sign = container.querySelector('svg[data-icon="taka"]');
    expect(sign, "৳ is drawn from the icon set: no Bengali subset could be vendored offline").not.toBeNull();
    expect(sign?.getAttribute("aria-label"), "…and announced as the character itself").toBe("৳");
  });

  test("a negative amount keeps its direction in front of the currency, as a document writes it", () => {
    const { container } = within(<MoneyText amount="-2500.00" />);
    expect(screen.getByTestId("money-text").textContent).toBe("-2,500.00");
    const first = container.querySelector(".cx-money")?.firstElementChild;
    expect(first?.className, "the minus stands before the sign, never after it").toContain("cx-money-sign");
  });
});

describe("Stat", () => {
  test("a tile is a figure over a word, and the figure is already formatted when it arrives", () => {
    within(<Stat value={<MoneyText amount={CRORE_IN} />} label="Estimated" data-testid="tile" />);
    const tile = screen.getByTestId("tile");
    expect(tile.querySelector(".cx-stat-value")).not.toBeNull();
    expect(tile.querySelector(".cx-stat-label")?.textContent).toBe("Estimated");
    expect(screen.getByTestId("money-text"), "a tile formats nothing itself — it lays a figure out").toBeTruthy();
  });
});
