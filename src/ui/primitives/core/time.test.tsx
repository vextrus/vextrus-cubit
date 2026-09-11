// @vitest-environment jsdom
/**
 * DateText and RelativeTime — deterministic by construction (Design Direction 00 §9.1 item 7: the
 * evidence suite renders against a frozen clock). Neither calls `Date.now()` in a render: the
 * present is handed in, or read from the clock the app injected, or there is none and the reading
 * is the document date. The date itself is the document's, through the injected conventions
 * (ARCH-01 — `src/ui` holds no value import of SEAM-FORMAT).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ClockProvider } from "./clock";
import { DateText } from "./date-text";
import { FigureProvider, type FigureFormat } from "./figures";
import { RelativeTime, relativeReading } from "./relative-time";
import { fill, strings } from "../../strings";

/** A fixed instant and a fixed present — the frozen pair the picture tenant renders against. */
const AT = new Date("2026-09-10T04:05:00.000Z");
const NOW = new Date("2026-09-10T06:05:00.000Z");
/** What SEAM-FORMAT answers for that instant in the document's zone: `DD MMM YYYY`. */
const DAY = "10 Sep 2026";

const FORMAT: FigureFormat = {
  figure: (value) => value,
  money: (amount) => amount,
  date: (at) => (at.getTime() === AT.getTime() ? DAY : at.toISOString()),
};

const mount = (node: React.ReactNode) => render(<FigureProvider format={FORMAT}>{node}</FigureProvider>);

afterEach(cleanup);

describe("DateText", () => {
  test("the day is the document's, and the instant is on the element for a machine to read", () => {
    mount(<DateText at={AT} />);
    const time = screen.getByTestId("date-text");
    expect(time.tagName, "what is shown is prose; what is parsed is the dateTime attribute").toBe("TIME");
    expect(time.getAttribute("datetime")).toBe(AT.toISOString());
    expect(time.textContent).toBe(DAY);
  });

  test("two renders of the same instant are the same text — there is nothing to drift", () => {
    const { container: first } = mount(<DateText at={AT} />);
    const { container: second } = mount(<DateText at={AT} />);
    expect(first.textContent).toBe(second.textContent);
  });
});

describe("RelativeTime", () => {
  test("with the present handed in, the reading is relative", () => {
    mount(<RelativeTime at={AT} now={NOW} />);
    expect(screen.getByTestId("relative-time").textContent).toBe(fill(strings.primitive_relative_hours, { count: "2" }));
  });

  test("with no present anywhere, it says the date rather than inventing a now", () => {
    mount(<RelativeTime at={AT} />);
    expect(screen.getByTestId("relative-time").textContent, "a component with no clock has no 'ago' to state").toBe(DAY);
  });

  test("the app's injected clock is what a tree without an explicit `now` reads", () => {
    mount(
      <ClockProvider now={NOW}>
        <RelativeTime at={AT} />
      </ClockProvider>,
    );
    expect(screen.getByTestId("relative-time").textContent).toBe(fill(strings.primitive_relative_hours, { count: "2" }));
  });

  test("a clock may be a function, so a frozen tenant and a live app install the same way", () => {
    mount(
      <ClockProvider now={() => NOW}>
        <RelativeTime at={AT} />
      </ClockProvider>,
    );
    expect(screen.getByTestId("relative-time").textContent).toBe(fill(strings.primitive_relative_hours, { count: "2" }));
  });

  test("an explicit `now` outranks the injected clock — a caller that knows is never overruled", () => {
    mount(
      <ClockProvider now={new Date("2027-01-01T00:00:00.000Z")}>
        <RelativeTime at={AT} now={NOW} />
      </ClockProvider>,
    );
    expect(screen.getByTestId("relative-time").textContent).toBe(fill(strings.primitive_relative_hours, { count: "2" }));
  });

  test("the whole day is always in reach: the exact date is the title, whatever the reading says", () => {
    mount(<RelativeTime at={AT} now={NOW} />);
    expect(screen.getByTestId("relative-time").getAttribute("title")).toBe(DAY);
  });

  test("the reading itself is a rule, graded on the rule", () => {
    const minute = 60_000;
    const day = (at: Date): string => at.toISOString();
    const conventions: FigureFormat = { figure: (value) => value, money: (amount) => amount, date: day };
    expect(relativeReading(new Date(NOW.getTime() - 30_000), NOW, conventions)).toBe(strings.primitive_relative_just_now);
    expect(relativeReading(new Date(NOW.getTime() - 5 * minute), NOW, conventions)).toBe(fill(strings.primitive_relative_minutes, { count: "5" }));
    expect(relativeReading(new Date(NOW.getTime() - 3 * 60 * minute), NOW, conventions)).toBe(fill(strings.primitive_relative_hours, { count: "3" }));
    expect(relativeReading(new Date(NOW.getTime() - 30 * 60 * minute), NOW, conventions)).toBe(strings.primitive_relative_yesterday);
    const old = new Date(NOW.getTime() - 90 * 24 * 60 * minute);
    expect(relativeReading(old, NOW, conventions), "past two days a reading is a date, not a bigger number of hours").toBe(day(old));
    const ahead = new Date(NOW.getTime() + minute);
    expect(relativeReading(ahead, NOW, conventions), "an instant in the future is not 'ago' — it is a date").toBe(day(ahead));
  });
});
