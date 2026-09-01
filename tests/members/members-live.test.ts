// @vitest-environment jsdom
/**
 * AC-2: the members surface is reached by visible navigation and answered by the shipped doors
 * (R-UI-031, R-SPINE-003).
 *
 * Nothing is mocked and nothing is stubbed: a scratch database is built by the tree's own migration
 * lane, the people are made through the shipped sign-up door, the product is BUILT and SERVED, and
 * every assertion below is made against the HTML a person's browser would be sent.
 *
 * B-19: the roster, the roles and the movement counts a page must show are read back out of the
 * database the page read them from, never frozen here — a workspace staged with a fourth member
 * would change every expected number without an edit to this file. The one thing named literally is
 * the increment's own contract (`support/members-page.ts`), which C-05 fixes before any code exists.
 *
 * jsdom for `DOMParser`: the answers are parsed as a browser parses them, and the rest of the file
 * is ordinary node work.
 */
import { afterAll, describe, expect, test } from "vitest";
import { REFUSALS } from "../../src/core/errors";
import {
  MEMBERS_MODULES,
  TESTIDS,
  byTestId,
  historyEntriesOf,
  memberRows,
  membersPath,
  oneByTestId,
  readText,
  refusalCodesIn,
  roleOf,
  settingsPath,
  type ReadableElement,
} from "./support/members-page";
import {
  dropDatabase,
  enrol,
  fetchPage,
  joinWorkspace,
  movementsAbout,
  openDatabase,
  productModule,
  requireModules,
  rosterOf,
  serveApp,
  stageProject,
  stopApp,
  type Person,
} from "./support/members-stage";

/** A live stage of this shape takes minutes to build; every test states its own budget. */
const LIVE = 900_000;

/** The dist directory this suite's build lands in: regenerable output under a gitignored name. */
const DIST = ".next-members";

/** The roles the staging gives its three people, so each row is identifiable by the word it shows. */
const OWNER = "OWNER";
const ADMIN = "ADMIN";
const MEMBER = "MEMBER";

/** The project role granted so a member's history has a movement in it. */
const PRINCIPAL = "PRINCIPAL";
const MEASURER = "MEASURER";

interface Stage {
  origin: string;
  tenantId: string;
  owner: Person;
  admin: Person;
  member: Person;
  stranger: Person;
  roles: Record<string, string>;
}

let pending: Promise<Stage> | undefined;

/**
 * Staged lazily and memoised, so every test fails on its own with the staging error rather than
 * being skipped by a throwing hook — a skipped test reports no criterion.
 */
const staged = (): Promise<Stage> =>
  (pending ??= (async () => {
    // Asserted before a database is made or a build is run, so a tree without the screen reds in a
    // second and names the file it is missing.
    requireModules(Object.values(MEMBERS_MODULES));

    await openDatabase();
    const owner = await enrol("members-owner");
    const admin = await enrol("members-admin");
    const member = await enrol("members-member");
    const stranger = await enrol("members-stranger");

    joinWorkspace(owner.tenantId, admin, ADMIN);
    joinWorkspace(owner.tenantId, member, MEMBER);
    stageProject(owner.tenantId, [owner, member], [
      { person: owner, role: PRINCIPAL },
      { person: member, role: MEASURER },
    ]);

    const served = await serveApp(DIST);
    return {
      origin: served.origin,
      tenantId: owner.tenantId,
      owner,
      admin,
      member,
      stranger,
      roles: { [owner.userId]: OWNER, [admin.userId]: ADMIN, [member.userId]: MEMBER },
    };
  })());

afterAll(async () => {
  stopApp();
  await dropDatabase();
});

/** The answer, parsed as a browser parses it. */
const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

/** The row whose role word is this one — the staging gives each of its three people a distinct role. */
function rowHolding(rows: readonly ReadableElement[], role: string): ReadableElement {
  const held = rows.filter((row) => roleOf(row) === role);
  expect(held.length, `exactly one staged member holds ${role}, so exactly one row shows it`).toBe(1);
  const row = held[0];
  if (row === undefined) throw new Error(`no row shows ${role}`);
  return row;
}

describe("AC-2: reached by visible navigation from the settings landing", () => {
  test(
    "AC-2: the landing renders a members link, named from the table, resolving to the members route",
    async () => {
      const stage = await staged();
      const landing = await fetchPage(stage.origin, settingsPath(stage.tenantId), stage.owner.cookie);
      expect(landing.status, `${settingsPath(stage.tenantId)} answers the workspace's own member`).toBe(200);

      const dom = parse(landing.html);
      const link = oneByTestId(dom, TESTIDS.membersLink);
      expect(link, `the settings landing renders ${TESTIDS.membersLink} — a screen reachable only by typed URL is a failing criterion (R-UI-031)`).not.toBeNull();
      if (link === null) return;

      expect(link.getAttribute("hidden"), "the link is visible, not hidden markup").toBeNull();
      expect(link.getAttribute("aria-hidden"), "the link is in the accessibility tree").not.toBe("true");

      const href = link.getAttribute("href") ?? "";
      expect(href.length, "the members link is a link, and carries where it goes").toBeGreaterThan(0);
      expect(new URL(href, `${stage.origin}${settingsPath(stage.tenantId)}`).pathname, `the link resolves to ${membersPath(stage.tenantId)}`).toBe(membersPath(stage.tenantId));

      const exported = (await productModule<Record<string, unknown>>(MEMBERS_MODULES.strings))["membersStrings"];
      expect(typeof exported, `${MEMBERS_MODULES.strings} exports membersStrings (the increment's declared interface)`).toBe("object");
      const published = new Set(
        Object.values(exported as Record<string, unknown>)
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.replace(/\s+/g, " ").trim()),
      );
      const name = readText(link);
      expect(name.length, "the link has an accessible name").toBeGreaterThan(0);
      expect(published.has(name), `"${name}" is the members strings table's own copy, by key (R-SPINE-060)`).toBe(true);
    },
    LIVE,
  );
});

describe("AC-2: the roster the module answers with, rendered whole", () => {
  test(
    "AC-2: one row per membership, each showing the role the store holds",
    async () => {
      const stage = await staged();
      const page = await fetchPage(stage.origin, membersPath(stage.tenantId), stage.owner.cookie);
      expect(page.status, `${membersPath(stage.tenantId)} answers a member of the workspace`).toBe(200);

      const dom = parse(page.html);
      const section = oneByTestId(dom, TESTIDS.section);
      expect(section, `the members page renders ${TESTIDS.section}`).not.toBeNull();
      if (section === null) return;

      const lists = byTestId(section, TESTIDS.list);
      expect(lists.length, `${TESTIDS.section} holds one ${TESTIDS.list}`).toBe(1);
      const list = lists[0];
      if (list === undefined) return;

      const stored = rosterOf(stage.tenantId);
      const rows = memberRows(list);
      expect(rows.length, "one row per membership the workspace holds — read back from the store, not assumed").toBe(stored.size);

      const db = await productModule<Record<string, unknown>>("src/core/db.ts");
      const closed = db["WORKSPACE_ROLES"];
      expect(Array.isArray(closed), "src/core/db exports the closed set of workspace roles").toBe(true);
      const roleWords = new Set((closed as readonly string[]).map((role) => role));

      const rendered = rows.map((row) => roleOf(row)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      for (const role of rendered) {
        expect(roleWords.has(role), `"${role}" is one of the store's own workspace roles, rendered verbatim`).toBe(true);
      }
      const expected = [...stored.values()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(rendered, "the roles rendered are the roles the memberships hold").toEqual(expected);
    },
    LIVE,
  );

  test(
    "AC-2: each row carries the role history the module answers for that member",
    async () => {
      const stage = await staged();
      const page = await fetchPage(stage.origin, membersPath(stage.tenantId), stage.owner.cookie);
      const dom = parse(page.html);
      const section = oneByTestId(dom, TESTIDS.section);
      expect(section, `the members page renders ${TESTIDS.section}`).not.toBeNull();
      if (section === null) return;

      const rows = memberRows(section);
      expect(rows.length, "the roster renders rows to carry histories").toBeGreaterThan(0);
      for (const row of rows) {
        expect(byTestId(row, TESTIDS.roleHistory).length, `every row renders one ${TESTIDS.roleHistory}`).toBe(1);
      }

      for (const [userId, role] of Object.entries(stage.roles)) {
        const row = rowHolding(rows, role);
        const shown = historyEntriesOf(row).length;
        const held = movementsAbout(stage.tenantId, userId);
        expect(shown, `the ${role} row shows one ${TESTIDS.historyEntry} per movement the workspace's ledgers hold about them`).toBe(held);
      }

      // The staging gives one member a movement and another none: both the entries and the absence
      // are the module's answer, so neither number is a constant this file invented.
      const total = rows.reduce((count, row) => count + historyEntriesOf(row).length, 0);
      expect(total, "the movements shown across the roster are exactly the movements the ledgers hold").toBe(
        Object.keys(stage.roles).reduce((count, userId) => count + movementsAbout(stage.tenantId, userId), 0),
      );
    },
    LIVE,
  );

  test(
    "AC-2: a stranger to the workspace is refused, never answered with an empty list",
    async () => {
      const stage = await staged();
      const page = await fetchPage(stage.origin, membersPath(stage.tenantId), stage.stranger.cookie);
      const dom = parse(page.html);

      expect(byTestId(dom, TESTIDS.list).length, "a stranger is not served the workspace's roster at all").toBe(0);
      expect(byTestId(dom, TESTIDS.row).length, "and not served an empty one either — an empty list is an answer about a workspace they may not read").toBe(0);

      const codes = refusalCodesIn(dom);
      expect(codes.length, "the stranger is refused, and the refusal says which one it is (R-UI-020)").toBeGreaterThan(0);
      const registered = REFUSALS as unknown as Record<string, unknown>;
      for (const code of codes) {
        expect(registered[code], `${code} is a code src/core/errors registers (R-SPINE-062)`).toBeDefined();
      }
      for (const person of [stage.owner, stage.admin, stage.member]) {
        expect(page.html.includes(person.email), "no member of the workspace is named to a stranger").toBe(false);
      }
    },
    LIVE,
  );
});
