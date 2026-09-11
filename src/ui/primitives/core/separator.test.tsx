// @vitest-environment jsdom
/**
 * Separator — the hairline that groups a toolbar (Design Direction 00 §1: "grouped by hairline
 * separators"). A grouping a sighted reader sees is a grouping every reader meets, so it carries
 * the role rather than being a styled div (Q-11).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Separator } from "./separator";

afterEach(cleanup);

describe("Separator", () => {
  test("it is a separator, horizontal by default", () => {
    render(<Separator data-testid="sep" />);
    const rule = screen.getByTestId("sep");
    expect(rule.getAttribute("role")).toBe("separator");
    expect(rule.getAttribute("aria-orientation")).toBe("horizontal");
    expect(rule.getAttribute("data-orientation")).toBe("horizontal");
  });

  test("the vertical one says so — a toolbar's groups are divided across, not down", () => {
    render(<Separator orientation="vertical" data-testid="sep" />);
    expect(screen.getByTestId("sep").getAttribute("aria-orientation")).toBe("vertical");
  });

  test("a consumer's class joins the primitive's rather than replacing it", () => {
    render(<Separator className="cx-toolbar-rule" data-testid="sep" />);
    expect(screen.getByTestId("sep").className.split(" ")).toEqual(["cx-separator", "cx-toolbar-rule"]);
  });
});
