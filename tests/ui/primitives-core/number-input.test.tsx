// @vitest-environment jsdom
/**
 * NumberInput's reading at rest (R-UI-010: "lakh/crore display on blur").
 *
 * The figure itself is never touched — B-07 keeps a person's own decimal off floats end to end, so
 * what the caller holds is always the string that was typed. What the `format` reading changes is
 * the FACE the field wears while nobody is typing into it, so a field standing beside a grouped
 * column does not read as a different figure from the one next to it.
 *
 * A field given no reading is shown exactly as it is held, which is what every consumer that
 * predates the prop asks for.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { formatUserFigure } from "@/core/format";
import { NumberInput } from "@/ui/primitives/core";

afterEach(cleanup);

/** The document's own reading, as a screen hands one in — the figure seam itself (SEAM-FORMAT). */
const grouped = formatUserFigure;

/** What that reading makes of the figure under test, asked of the seam rather than spelled here. */
const GROUPED_20000 = grouped("20000");

function field(): HTMLInputElement {
  return screen.getByTestId("figure") as HTMLInputElement;
}

describe("the field's face at rest is the reading it was handed (R-UI-010)", () => {
  test("a figure at rest is grouped, and focusing it gives the reader their own keystrokes back", () => {
    render(<NumberInput data-testid="figure" aria-label="Figure" value="20000" format={grouped} onChange={() => undefined} />);
    expect(field().value, "at rest the field reads as the column beside it").toBe(GROUPED_20000);

    fireEvent.focus(field());
    expect(field().value, "typing is done against the figure itself, never against its grouping").toBe("20000");

    fireEvent.blur(field());
    expect(field().value).toBe(GROUPED_20000);
  });

  test("what the caller is told is the figure, never the reading", () => {
    const stated: string[] = [];
    render(<NumberInput data-testid="figure" aria-label="Figure" value="20000" format={grouped} onChange={(next) => stated.push(next)} />);
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: "20500" } });
    expect(stated, "the keystrokes are handed up as they were typed (B-07)").toEqual(["20500"]);
  });

  test("text that is no figure is shown as written, and a field with no reading is unchanged", () => {
    render(<NumberInput data-testid="figure" aria-label="Figure" value="not a figure" format={grouped} onChange={() => undefined} />);
    expect(field().value, "a reading is offered a figure or nothing at all").toBe("not a figure");

    cleanup();
    render(<NumberInput data-testid="figure" aria-label="Figure" value="20000" onChange={() => undefined} />);
    expect(field().value, "a consumer that hands in no reading sees exactly what it holds").toBe("20000");
  });
});
