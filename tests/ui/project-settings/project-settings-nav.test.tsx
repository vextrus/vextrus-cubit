// @vitest-environment jsdom
/**
 * The project settings frame (sub-navigation § 1, § 2): one nav over one roster, rendered for each
 * segment it frames.
 *
 * Two things are asserted and both are about the ROSTER rather than about four spelled rows: the
 * order rendered is the order `PROJECT_SETTINGS_AREAS` declares, and availability is read off each
 * entry's `route` (I-259) — a builder makes a link, `null` makes a disabled row that is shown and
 * never hidden. `aria-current` singles ONE row out (I-260): a nav that marked every built row would
 * tell a screen reader nothing at all.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const TENANT = "5eed0000-0000-4000-8000-000000000001";
const PROJECT = "5eed0000-0000-4000-8000-0000000000a1";

/** The segment the frame is asked about — a layout's own reading of where the reader is. */
let segment: string | null = "ruleset";

vi.mock("next/navigation", () => ({ useSelectedLayoutSegment: () => segment }));

const { PROJECT_SETTINGS_AREAS } = await import("@/app/(app)/t/[tenant]/p/[project]/settings/areas");
const { ProjectSettingsNav } = await import("@/app/(app)/t/[tenant]/p/[project]/settings/layout");
const { PROJECT_SETTINGS_NAV_STATES } = await import("@/app/(app)/t/[tenant]/p/[project]/settings/states");

afterEach(cleanup);

/** Every nav row as the document holds it, in the order it holds them. */
function rows(): HTMLElement[] {
  return screen.getAllByTestId("settings-area");
}

function renderNav(at: string | null): void {
  segment = at;
  render(<ProjectSettingsNav tenantId={TENANT} projectId={PROJECT} segment={at} />);
}

describe("the project settings nav renders its roster (I-258, I-259)", () => {
  test("one row per entry, in the roster's declared order, on every screen it frames", () => {
    for (const at of ["ruleset", "participants", "ruleset-author"]) {
      cleanup();
      renderNav(at);
      expect(rows().map((row) => row.getAttribute("data-area"))).toEqual(PROJECT_SETTINGS_AREAS.map((entry) => entry.area));
    }
  });

  test("an entry with an address is a link to it; the one without is disabled, shown, and no anchor", () => {
    renderNav("ruleset");
    for (const [at, entry] of PROJECT_SETTINGS_AREAS.entries()) {
      const row = rows()[at] as HTMLElement;
      if (entry.route === null) {
        expect(row.tagName.toLowerCase(), `${entry.area} has no address, so it is no link`).not.toBe("a");
        expect(row.getAttribute("href")).toBeNull();
        expect(row.getAttribute("data-unbuilt")).toBe("true");
        expect(row.getAttribute("aria-disabled")).toBe("true");
        // Q-11: its reason is reachable by keyboard, so it keeps a tab stop.
        expect(row.getAttribute("tabindex")).toBe("0");
      } else {
        expect(row.tagName.toLowerCase()).toBe("a");
        expect(row.getAttribute("href")).toBe(entry.route(TENANT, PROJECT));
        expect(row.getAttribute("data-unbuilt")).toBeNull();
      }
    }
  });

  test("exactly one row says where the reader is, and it is the row whose address the page is at", () => {
    for (const entry of PROJECT_SETTINGS_AREAS) {
      if (entry.route === null) continue;
      cleanup();
      renderNav(entry.area);
      expect(rows().map((row) => row.getAttribute("aria-current") ?? "")).toEqual(
        PROJECT_SETTINGS_AREAS.map((held) => (held.area === entry.area ? "page" : "")),
      );
    }
  });

  test("a segment that names no area of the roster marks nothing — the nav never guesses (I-260)", () => {
    cleanup();
    renderNav(null);
    expect(rows().every((row) => row.getAttribute("aria-current") === null)).toBe(true);
  });

  test("every row is named by the roster's own words, never by a literal in the markup", () => {
    cleanup();
    renderNav("ruleset");
    expect(rows().map((row) => row.textContent)).toEqual(PROJECT_SETTINGS_AREAS.map((entry) => entry.label));
  });
});

describe("R-UI-050's matrix for the frame (B-19)", () => {
  test("every state is declared, and each cell is rendered, delegated or impossible with a reason", () => {
    for (const [name, cell] of Object.entries(PROJECT_SETTINGS_NAV_STATES)) {
      if (cell.declared === "rendered") expect(cell.by, `${name} names the module that paints it`).not.toBe("");
      else if (cell.declared === "delegated") expect(cell.to !== "" && cell.why !== "", `${name} names who owns it and why`).toBe(true);
      else expect(cell.why, `${name} says why it cannot arise`).not.toBe("");
    }
  });
});
