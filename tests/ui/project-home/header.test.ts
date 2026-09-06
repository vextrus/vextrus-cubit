// @vitest-environment jsdom
/**
 * AC-1's screen half — S-Project's header, mounted over injected data (S-Project, R-SPINE-013,
 * L-FMT-02, docs/design/s-project.md §1, I-127/I-133).
 *
 * The route's own half of AC-1 — the S-Home card's link, and the header standing inside the shell
 * frame at that address — is walked in the browser by `tests/e2e/project-home.spec.ts`.
 *
 * Nothing is transcribed: every figure is the format seam's own answer for the value handed in,
 * every sentence is read out of the screen's string table by the key §3 fixes, and the zone count
 * is compared against the badges the screen actually drew rather than against a number.
 */
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  aProject,
  all,
  copy,
  formatSeam,
  homeData,
  homeStrings,
  mountHome,
  one,
  projectHome,
  text,
} from "./support/project-home-stage";

afterEach(() => {
  cleanup();
});

describe("AC-1 — the header states the project", () => {
  test("AC-1: the name is the page's own h1, verbatim as it is stored", async () => {
    const root = mountHome(await projectHome(), homeData());

    const heading = screen.getByRole("heading", { level: 1 });
    expect(text(heading), "the h1 is the project's stored name, verbatim").toBe(aProject().name);
    expect(heading.getAttribute("data-testid"), "and that h1 is the header's `project-home-name` (test contract)").toBe("project-home-name");
    expect(one(root, "project-home-header").contains(heading), "the name stands inside `project-home-header`").toBe(true);
  });

  test("AC-1: client and district state the stored text", async () => {
    const project = aProject({ client: "Padma Holdings", district: "Munshiganj" });
    const root = mountHome(await projectHome(), homeData({ project }));

    expect(text(one(root, "project-home-client")), "the client cell states the stored client").toBe(project.client);
    expect(text(one(root, "project-home-district")), "the district cell states the stored district").toBe(project.district);
  });

  test("AC-1: a null client, district or target GFA says so in the table's words, never blank and never a zero", async () => {
    const strings = await homeStrings();
    const unstated = copy(strings, "project_home_unstated");
    const root = mountHome(await projectHome(), homeData({ project: aProject({ client: null, district: null, targetGfaM2: null }) }));

    for (const cell of ["project-home-client", "project-home-district", "project-home-gfa"]) {
      const said = text(one(root, cell));
      expect(said, `\`${cell}\` states the string table's absence line rather than standing empty or saying 0`).toBe(unstated);
    }
    // Decision §1: "a conversion of nothing is nothing" — the square-feet cell does not render at all.
    expect(all(root, "project-home-gfa-sft"), "with no target GFA there is no conversion of it to state").toHaveLength(0);
  });

  test("AC-1: the zone cell's data-count is the badges it holds — whatever the book answers", async () => {
    const component = await projectHome();
    const zones = [
      { book: "Dhaka Metropolitan Building Rules", zone: "R-3" },
      { book: "Dhaka Metropolitan Building Rules", zone: "C-1" },
    ];

    for (const injected of [[], zones] as const) {
      const root = mountHome(component, homeData({ zones: injected }));
      const cell = one(root, "project-home-zones");
      const badges = all(root, "project-home-zone-badge");

      expect(badges, "one badge per zone the page was handed, in the order it was handed them").toHaveLength(injected.length);
      expect(cell.getAttribute("data-count"), "`data-count` is the number of badges the cell holds, never a number of its own").toBe(String(badges.length));
      expect(
        badges.map((badge) => [badge.getAttribute("data-book"), badge.getAttribute("data-zone"), text(badge)]),
        "each badge names its book and its zone, and states the zone verbatim",
      ).toEqual(injected.map((zone) => [zone.book, zone.zone, zone.zone]));
      cleanup();
    }
  });

  test("AC-1: an empty zone roster says why it is empty (R-UI-020, I-133)", async () => {
    const strings = await homeStrings();
    const root = mountHome(await projectHome(), homeData({ zones: [] }));

    expect(text(one(root, "project-home-zones")), "with no book pinned the cell states the reason rather than nothing").toBe(copy(strings, "project_home_zones_none"));
  });

  test("AC-1: the target GFA renders through the format seam, in m² and in sft, each beside its unit", async () => {
    const strings = await homeStrings();
    const format = await formatSeam();
    const project = aProject({ targetGfaM2: "1250.50" });
    const root = mountHome(await projectHome(), homeData({ project }));

    const metres = format.formatUserFigure(project.targetGfaM2 as string);
    const feet = format.formatSquareFeet(project.targetGfaM2 as string);
    expect(text(one(root, "project-home-gfa")), "the m² figure is the seam's own answer for the stored value").toContain(metres);
    expect(text(one(root, "project-home-gfa-sft")), "the sft figure is the seam's conversion of it — the factor is the seam's, spelled nowhere here").toContain(feet);

    // L-FMT-02: "a unit renders from the enum, separately from its quantity" — one shipped badge each.
    const units = all(one(root, "project-home-header"), "unit-badge");
    expect(units.map((badge) => text(badge)), "the header wears exactly the two units of the one quantity it states, m² before sft").toEqual([
      copy(strings, "project_home_unit_m2"),
      copy(strings, "project_home_unit_sft"),
    ]);
    expect([copy(strings, "project_home_unit_m2"), copy(strings, "project_home_unit_sft")], "and those units are the ones S-Project names").toEqual(["m²", "sft"]);
    expect(one(root, "project-home-gfa-sft").contains(units[0] as Node), "the m² badge belongs to the m² figure, not to the conversion").toBe(false);
    expect(one(root, "project-home-gfa").contains(units[1] as Node), "and the sft badge belongs to the conversion, not to the m² figure").toBe(false);
  });
});
