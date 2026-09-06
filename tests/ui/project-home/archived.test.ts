// @vitest-environment jsdom
/**
 * A project that has been put away says so where it is named (R-UI-050: each state says the true
 * thing; C-SPINE-PROJECT's archive is a status the reader is entitled to see on the project's own
 * home, exactly as S-Home's card shows it).
 *
 * `projectHeld` answers true for an archived project and `projectsForHome` returns one, so this
 * home renders for it — and the branch that states the fact is reachable only over a stored status,
 * which no other mount here sets. The word itself is read from the shared table by the key S-Home's
 * card already uses, so the flag has one home and this file transcribes nothing (B-17, B-19).
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { aProject, homeData, mountHome, one, productModule, projectHome, text } from "./support/project-home-stage";

afterEach(() => {
  cleanup();
});

describe("the archived status of a project, on its own home", () => {
  test("the header states the shared archived flag for an archived project, and states nothing for an active one", async () => {
    const table = await productModule<{ strings: Record<string, string> }>("src/ui/strings/index.ts");
    const said = table.strings["home_status_archived"];
    expect(typeof said, "the archived flag is the one the shared table already publishes for S-Home's card").toBe("string");
    const component = await projectHome();

    const archived = mountHome(component, homeData({ project: aProject({ status: "archived", archivedAt: new Date("2026-03-03T04:00:00.000Z") }) }));
    expect(text(one(archived, "project-home-header")), "an archived project wears the flag beside its name").toContain(said);
    cleanup();

    const active = mountHome(component, homeData());
    expect(text(one(active, "project-home-header")), "an active project wears none: a status stated on every project states nothing about any of them").not.toContain(said);
  });
});
