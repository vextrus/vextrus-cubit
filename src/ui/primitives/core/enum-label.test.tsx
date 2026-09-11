// @vitest-environment jsdom
/**
 * EnumLabel (Design Direction 00 §3.7: `role as EnumLabel — "Member", not MEMBER`). The words are
 * what a person reads; the raw value stays in the DOM, inside the technical disclosure, so nothing
 * is hidden from an engineer or from a suite — it is simply not what the screen says out loud.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { EnumLabel, humaniseEnum } from "./enum-label";

afterEach(cleanup);

describe("EnumLabel", () => {
  test("SCREAMING_SNAKE becomes one sentence-cased phrase, by rule and not by roster", () => {
    expect(humaniseEnum("MEMBER")).toBe("Member");
    expect(humaniseEnum("ASSIGN_PARTICIPANT_ROLE")).toBe("Assign participant role");
    expect(humaniseEnum("CONFIRM_DISCIPLINES")).toBe("Confirm disciplines");
    expect(humaniseEnum(""), "a value with no words is its own label").toBe("");
  });

  test("the screen shows the words and carries the value", () => {
    render(<EnumLabel value="ASSIGN_PARTICIPANT_ROLE" data-testid="enum" />);
    const label = screen.getByTestId("enum");
    expect(label.getAttribute("data-value")).toBe("ASSIGN_PARTICIPANT_ROLE");
    expect(label.textContent).toContain("Assign participant role");
  });

  test("the raw value is in the DOM, inside the technical disclosure and nowhere else", () => {
    const { container } = render(<EnumLabel value="MEMBER" />);
    const raw = container.querySelector(".cx-enum-raw");
    expect(raw?.getAttribute("data-technical"), "it is marked as technical, which is what hides it").toBe("");
    expect(raw?.textContent).toBe("MEMBER");
  });

  test("a screen that has authored its own words for a value keeps them", () => {
    render(<EnumLabel value="MEMBER" label="Estimator" data-testid="enum" />);
    expect(screen.getByTestId("enum").textContent).toContain("Estimator");
  });
});
