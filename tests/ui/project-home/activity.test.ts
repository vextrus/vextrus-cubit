// @vitest-environment jsdom
/**
 * AC-4 — recent activity: the newest acts this project has, in the order `getAuditSurfaces` answers
 * them, capped at the screen's one named number (R-SPINE-013, docs/design/s-project.md §1, I-132).
 *
 * The cap is not transcribed here: it is read from `RECENT_ACTIVITY_LIMIT`, the one place the screen
 * states it, and the fixture is built from that number (B-19). Dates render absolute through the
 * format seam — no relative time, out of scope by name.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import {
  PROJECT,
  TENANT,
  acts,
  all,
  areasModule,
  copy,
  formatSeam,
  homeData,
  homeStrings,
  mountHome,
  one,
  projectHome,
  text,
} from "./support/project-home-stage";

/** The audit address "All activity" opens (test contract). */
const AUDIT_ROUTE = `/t/${TENANT}/p/${PROJECT}/audit`;

afterEach(() => {
  cleanup();
});

describe("AC-4 — recent activity", () => {
  test("AC-4: the newest five are five — the cap is the screen's own number, and one more act does not pass it", async () => {
    const { RECENT_ACTIVITY_LIMIT: limit } = await areasModule();
    // The screen's number, as S-Project's Decision fixes it (I-132) and AC-4 names it. Every count
    // below is derived from this one reading of it, so the cap is stated once and asserted once.
    expect(limit, "S-Project shows the five newest acts (AC-4, I-132)").toBe(5);

    const answered = acts(limit + 1);
    const root = mountHome(await projectHome(), homeData({ recentActs: answered }));
    const rows = all(root, "project-home-activity-row");

    expect(rows, "handed more acts than the cap, the region shows the cap").toHaveLength(limit);
    expect(
      rows.map((row, index) => [row.getAttribute("data-act-type"), text(row).includes(answered[index]?.actorLabel ?? " ")]),
      "and it shows the first of them, in place — the order the audit door answered, newest first, never re-sorted",
    ).toEqual(answered.slice(0, limit).map((act) => [act.actType, true]));
    expect(all(root, "project-home-activity-empty"), "a list with rows in it is not an empty list").toHaveLength(0);
  });

  test("AC-4: each row states its act type verbatim, its actor and its day through the format seam", async () => {
    const format = await formatSeam();
    const answered = acts(2);
    const root = mountHome(await projectHome(), homeData({ recentActs: answered }));

    const rows = all(root, "project-home-activity-row");
    expect(rows, "fewer acts than the cap are all of them").toHaveLength(answered.length);
    rows.forEach((row, index) => {
      const act = answered[index] as (typeof answered)[number];
      const said = text(row);
      expect(row.getAttribute("data-act-type"), "the row names the act it is").toBe(act.actType);
      expect(said, "the act type is an identifier and renders verbatim as data (I-47's class)").toContain(act.actType);
      expect(said, "the actor is named as the log names them").toContain(act.actorLabel);
      expect(said, "and the day is absolute, through the one date seam (I-132)").toContain(format.formatDate(format.dhakaDateParts(act.occurredAt)));
    });
  });

  test("AC-4: with no act recorded the region says why, and holds no row", async () => {
    const strings = await homeStrings();
    const root = mountHome(await projectHome(), homeData({ recentActs: [] }));

    expect(all(root, "project-home-activity-row"), "nothing has happened, so nothing is listed").toHaveLength(0);
    expect(text(one(root, "project-home-activity-empty")), "and the empty region teaches the next action rather than standing silent (R-UI-050)").toBe(
      copy(strings, "project_home_activity_empty"),
    );
  });

  test("AC-4: All activity opens the audit address, whether or not there is anything recent", async () => {
    const component = await projectHome();

    for (const recentActs of [[], acts(3)] as const) {
      const root = mountHome(component, homeData({ recentActs }));
      expect(one(root, "project-home-activity-all").getAttribute("href"), "the whole log is one link away in every case").toBe(AUDIT_ROUTE);
      cleanup();
    }
  });
});
