// @vitest-environment jsdom
/**
 * AC-5's screen half — the sets index and the set browser, mounted over injected data (R-TO-005,
 * R-UI-020/050, docs/design/s-drawings-sets.md §1, §2, §7).
 *
 * Both screens publish a mountable client component taking its data and its doors as props, so what
 * is judged here is the screen's own behaviour and not the server's: the anatomy the Decision closes,
 * every `data-` hook the contract names, the three `set-empty` causes and their precedence, the
 * toggle's single call, and the pin's handoff to the one ConsequenceDialog.
 *
 * Nothing is transcribed: the rows are derived from the data handed in, and every sentence asserted
 * is read out of the screen's own string table (`strings.ts`) or out of the refusal register.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { randomUUID } from "node:crypto";
import { createElement, type FunctionComponent } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import {
  PIN_DRAWING_SET,
  SETS_INDEX_COMPONENT,
  SETS_STRINGS_MODULE,
  SET_BROWSER_COMPONENT,
  byCodePoint,
  productModule,
  routeAddresses,
  sha256OfText,
  type ConsequenceLike,
  type DrawingLineage,
  type DrawingSetSummary,
  type DrawingSetView,
  type ManifestMember,
  type SetRevision,
} from "./support/sets-stage";

/** A component of the product, as this file mounts one. */
type Mountable = (props: Record<string, unknown>) => unknown;

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

afterEach(() => {
  cleanup();
});

/** The screen's own copy, found by the keys the Decision fixes rather than by the export's name. */
async function strings(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(SETS_STRINGS_MODULE);
  for (const value of Object.values(module)) {
    if (value !== null && typeof value === "object" && "sets_create_submit" in (value as Record<string, unknown>)) return value as Record<string, string>;
  }
  throw new Error(`${SETS_STRINGS_MODULE} publishes no table carrying the keys the Design Decision §3 fixes (sets_…)`);
}

async function setsIndex(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(SETS_INDEX_COMPONENT);
  expect(typeof module["SetsIndex"], `${SETS_INDEX_COMPONENT} publishes \`SetsIndex\` (increment interfaces)`).toBe("function");
  return module["SetsIndex"] as Mountable;
}

async function setBrowser(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(SET_BROWSER_COMPONENT);
  expect(typeof module["SetBrowser"], `${SET_BROWSER_COMPONENT} publishes \`SetBrowser\` (increment interfaces)`).toBe("function");
  return module["SetBrowser"] as Mountable;
}

function mount(component: Mountable, props: Record<string, unknown>): HTMLElement {
  const { container } = render(createElement(component as unknown as FunctionComponent, props));
  return container;
}

/** Every element carrying a test id, in document order — the closed contract's own hooks (C-05). */
function all(scope: HTMLElement, testId: string): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
}

/** The one element carrying a test id inside a scope, refused by name where the scope has none. */
function one(scope: HTMLElement, testId: string, where: string): HTMLElement {
  const found = all(scope, testId);
  expect(found.length, `${where} renders exactly one ${testId} (Design Decision §7)`).toBe(1);
  return found[0] as HTMLElement;
}

/* ------------------------------------------------------------------ the data the screens are given */

let seed = 0;

/** A drawing lineage of `count` revisions, as the module answers one. */
function lineage(name: string, count: number): DrawingLineage {
  const drawingId = randomUUID();
  const revisions = Array.from({ length: count }, (_, at) => ({
    revisionId: at === 0 ? drawingId : randomUUID(),
    sha256: sha256OfText(`${name}-${(seed += 1)}`),
    ordinal: at + 1,
    createdAt: new Date(Date.UTC(2026, 0, 1 + at)).toISOString(),
  }));
  return { drawingId, name, format: "dxf", revisions, current: revisions[count - 1] as DrawingLineage["current"] };
}

/** The citation a pin of these lineages would carry. */
function manifestOf(lineages: readonly DrawingLineage[]): ManifestMember[] {
  return lineages.map((one_) => ({ drawingId: one_.drawingId, revisionId: one_.current.revisionId, sha256: one_.current.sha256, name: one_.name }));
}

/** One pinned set revision over those citations. */
function revisionOf(lineages: readonly DrawingLineage[], current: boolean): SetRevision {
  const manifest = manifestOf(lineages);
  return {
    setRevisionId: randomUUID(),
    digest: sha256OfText(manifest.map((member) => member.sha256).join("|")),
    actId: randomUUID(),
    pinnedAt: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    current,
    manifest,
  };
}

/** A set, whole, over the lineages it names. */
function view(lineages: readonly DrawingLineage[], revisions: readonly SetRevision[], name = "Tender set"): DrawingSetView {
  return { setId: randomUUID(), name, members: lineages.map((one_) => one_.drawingId), revisions: [...revisions] };
}

/** A row of the sets index. */
function summary(name: string, digest: string | null, members = 2, revisions = 1): DrawingSetSummary {
  return { setId: randomUUID(), name, memberCount: members, revisionCount: revisions, currentDigest: digest };
}

/** The props the index page hands its client half, with the doors stood in for. */
function indexProps(sets: readonly DrawingSetSummary[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    sets,
    canPin: true,
    createSet: async () => ({ created: true, setId: randomUUID() }),
    ...overrides,
  };
}

/** The props the set page hands its client half, with the three doors stood in for. */
function browserProps(set: DrawingSetView, lineages: readonly DrawingLineage[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    tenantId: TENANT,
    projectId: PROJECT,
    set,
    lineages,
    canPin: true,
    toggle: async () => ({ toggled: true, member: true }),
    preview: async () => ({ previewed: true, consequence: consequenceFor(lineages), consequenceDigest: sha256OfText("carried") }),
    commit: async () => ({ committed: true, actId: randomUUID(), setRevisionId: randomUUID(), digest: sha256OfText("committed") }),
    ...overrides,
  };
}

/** What a preview of the pin answers, in the shape the dialog renders (L-ACT-02's SUBJECTS arm). */
function consequenceFor(lineages: readonly DrawingLineage[]): ConsequenceLike {
  return {
    actType: PIN_DRAWING_SET,
    tenantId: TENANT,
    projectId: PROJECT,
    rendering: "SUBJECTS",
    subjects: lineages.map((one_) => ({ subjectId: one_.drawingId, subjectLabel: one_.name, before: [], after: [one_.current.sha256] })),
  };
}

/* ------------------------------------------------------------------ the sets index */

describe("AC-5: the sets index", () => {
  test("AC-5: one row per set, each carrying its name, its digest and the way into it", async () => {
    const table = await strings();
    const { setRoute } = await routeAddresses();
    const pinned = summary("Tender set", sha256OfText("pinned"));
    const unpinned = summary("Revision set", null, 0, 0);
    const container = mount(await setsIndex(), indexProps([pinned, unpinned]));

    const index = one(container, "sets-index", "the sets index");
    const rows = all(index, "set-row");
    expect(
      rows.map((row) => row.getAttribute("data-set")),
      "one row per set the project holds, named by the set it is for",
    ).toEqual([pinned.setId, unpinned.setId]);

    for (const [at, row] of rows.entries()) {
      const set = [pinned, unpinned][at] as DrawingSetSummary;
      expect(row.getAttribute("data-name"), "the row publishes the name it carries").toBe(set.name);
      expect(one(row, "set-row-name", `the row for ${set.name}`).textContent, "and shows that name verbatim").toContain(set.name);
      expect(one(row, "set-open", `the row for ${set.name}`).getAttribute("href"), "and opens the set at its own address").toBe(setRoute(TENANT, PROJECT, set.setId));

      const digest = one(row, "set-row-digest", `the row for ${set.name}`);
      if (set.currentDigest === null) {
        expect(digest.getAttribute("data-digest"), "a set that has never been pinned publishes no digest (I-99)").toBe("");
        expect((digest.textContent ?? "").trim(), "and says so in prose from the screen's own table, never a dash and never a fake hex value").toBe(table["sets_row_digest_none"]);
      } else {
        expect(digest.getAttribute("data-digest"), "a pinned set publishes the digest it stands at").toBe(set.currentDigest);
        expect((digest.textContent ?? "").trim(), "and shows it character for character (I-99)").toBe(set.currentDigest);
      }
    }
  });

  test("AC-5: the create door is a labelled field and a button, and a project with no set says so", async () => {
    const table = await strings();
    const container = mount(await setsIndex(), indexProps([summary("Tender set", sha256OfText("one"))]));

    const form = one(container, "set-create-form", "the sets index");
    const field = one(container, "set-name-input", "the create form");
    expect(form.contains(field), "the name field stands inside the create form").toBe(true);
    expect(screen.getByLabelText(table["sets_name_label"] as string), "the name field carries the visible label the Decision fixes (R-UI-012: no placeholder stands in for a label)").toBe(field);
    expect(one(container, "set-create", "the sets index").textContent, "the door says what it does, from the screen's own table").toContain(table["sets_create_submit"]);

    cleanup();
    const empty = mount(await setsIndex(), indexProps([]));
    expect(all(empty, "set-row").length, "a project holding no set has no row to show").toBe(0);
    const said = one(empty, "sets-empty", "the sets index of a project with no set");
    expect(said.textContent ?? "", "silence never happens: an empty list teaches the next action (R-UI-020, R-UI-050)").toContain(table["sets_empty_heading"]);
  });

  test("AC-5: naming a set calls the injected door once with the name that was typed", async () => {
    const table = await strings();
    const asked: { name: string }[] = [];
    const container = mount(
      await setsIndex(),
      indexProps([], {
        createSet: async (request: { name: string }) => {
          asked.push(request);
          return { created: true, setId: randomUUID() };
        },
      }),
    );

    const person = userEvent.setup();
    await person.type(one(container, "set-name-input", "the create form"), "Tender set");
    await person.click(screen.getByRole("button", { name: table["sets_create_submit"] as string }));
    expect(asked.map((request) => request.name), "the door is asked once, for the name the person typed").toEqual(["Tender set"]);
  });
});

/* ------------------------------------------------------------------ the set browser */

describe("AC-5: the set browser", () => {
  test("AC-5: one row per lineage, with its membership, its revisions and its toggle", async () => {
    const table = await strings();
    const member = lineage("member.dxf", 2);
    const outsider = lineage("outsider.dxf", 1);
    const set = view([member], [revisionOf([member], true)]);
    const container = mount(await setBrowser(), browserProps(set, [member, outsider]));

    const browser = one(container, "set-browser", "the set browser");
    expect(browser.getAttribute("data-set"), "the browser publishes the set it is for").toBe(set.setId);
    expect(one(container, "set-heading", "the set browser").textContent, "and shows its name verbatim").toContain(set.name);

    const drawings = all(one(container, "set-drawings", "the set browser"), "set-drawing");
    expect(
      drawings.map((row) => row.getAttribute("data-drawing")),
      "every drawing the project holds is listed, whether or not the set names it (Design Decision §3: sets_members_hint)",
    ).toEqual([member.drawingId, outsider.drawingId]);

    for (const [at, row] of drawings.entries()) {
      const drawing = [member, outsider][at] as DrawingLineage;
      const isMember = set.members.includes(drawing.drawingId);
      expect(row.getAttribute("data-member"), `${drawing.name} publishes whether this set names it`).toBe(isMember ? "true" : "false");
      expect(row.getAttribute("data-current-sha256"), `${drawing.name} publishes the content it stands at now`).toBe(drawing.current.sha256);
      expect(one(row, "set-drawing-name", drawing.name).textContent, "the row shows the presented name verbatim").toContain(drawing.name);
      expect(one(row, "set-drawing-revision-count", drawing.name).textContent, "and how many revisions it holds").toContain(String(drawing.revisions.length));

      const revisions = all(row, "set-drawing-revision");
      expect(revisions.map((revision) => revision.getAttribute("data-revision")), `${drawing.name} lists its revisions oldest first (I-95)`).toEqual(drawing.revisions.map((revision) => revision.revisionId));
      for (const [ordinal, element] of revisions.entries()) {
        const revision = drawing.revisions[ordinal] as DrawingLineage["revisions"][number];
        expect(element.getAttribute("data-sha256"), "a revision publishes the content it is").toBe(revision.sha256);
        expect(element.getAttribute("data-ordinal"), "and the ordinal it stands at").toBe(String(revision.ordinal));
        expect(element.getAttribute("data-current"), "and whether it is the one the drawing stands at").toBe(revision === drawing.current ? "true" : "false");
        expect(element.textContent ?? "", "and shows the sha256 whole — a machine identifier renders verbatim (I-25, I-95)").toContain(revision.sha256);
        expect(element.textContent ?? "", "saying in words which revision is current, never by colour alone (R-UI-060)").toContain(revision === drawing.current ? table["sets_revision_current"] : table["sets_revision_superseded"]);
      }

      const toggle = one(row, "set-member-toggle", drawing.name);
      expect(toggle.getAttribute("data-drawing"), "the toggle names the drawing it moves").toBe(drawing.drawingId);
      expect(toggle.getAttribute("aria-pressed"), "and carries the membership it would flip (R-UI-012)").toBe(isMember ? "true" : "false");
      const label = (isMember ? table["sets_member_remove_label"] : table["sets_member_add_label"]) ?? "";
      expect(toggle.getAttribute("aria-label"), "named for the drawing it acts on, from the screen's own table").toBe(label.replace("{drawing}", drawing.name));
    }
  });

  test("AC-5: pinned revisions stand newest first, each shown whole and citing every member it held", async () => {
    const member = lineage("cited.dxf", 2);
    const other = lineage("also-cited.dxf", 1);
    const older = revisionOf([member], false);
    const newest = revisionOf([member, other], true);
    const set = view([member, other], [newest, older]);
    const container = mount(await setBrowser(), browserProps(set, [member, other]));

    const revisions = all(one(container, "set-revisions", "the set browser"), "set-revision");
    expect(
      revisions.map((revision) => revision.getAttribute("data-set-revision")),
      "the pinned revisions stand newest first, in the order the module answered them",
    ).toEqual([newest.setRevisionId, older.setRevisionId]);

    for (const [at, element] of revisions.entries()) {
      const revision = [newest, older][at] as SetRevision;
      expect(element.getAttribute("data-digest"), "a pinned revision publishes its address").toBe(revision.digest);
      expect(element.getAttribute("data-current"), "and whether the set stands at it now").toBe(revision.current ? "true" : "false");
      const digest = one(element, "set-revision-digest", `the revision ${revision.setRevisionId}`);
      expect((digest.textContent ?? "").trim(), "the digest renders whole, character for character, and equals the value published on the card (I-99)").toBe(revision.digest);

      const cited = all(element, "set-revision-member");
      expect(
        byCodePoint(cited.map((citation) => citation.getAttribute("data-drawing") ?? "")),
        "every member the manifest held is cited, whether or not the set still names it (L-REG-06, I-98)",
      ).toEqual(byCodePoint(revision.manifest.map((entry) => entry.drawingId)));
      for (const citation of cited) {
        const entry = revision.manifest.find((candidate) => candidate.drawingId === citation.getAttribute("data-drawing"));
        expect(citation.getAttribute("data-revision"), "a citation names the revision it pinned").toBe(entry?.revisionId);
        expect(citation.getAttribute("data-sha256"), "and the content that revision is").toBe(entry?.sha256);
        expect(citation.textContent ?? "", "and shows that content address whole").toContain(entry?.sha256 ?? "");
      }
    }
  });

  test("AC-5: set-empty says which emptiness it is, one element at a time, in the Decision's order", async () => {
    const member = lineage("only.dxf", 1);
    const pin = revisionOf([member], true);

    const cases: { props: Record<string, unknown>; cause: string; why: string }[] = [
      { props: browserProps(view([], []), []), cause: "no-drawings", why: "a project holding no drawing can name none in a set" },
      { props: browserProps(view([member], []), [member]), cause: "no-revisions", why: "a set that has never been pinned teaches how to get a first pin" },
      { props: browserProps(view([], [pin]), [member]), cause: "no-members", why: "a set that names nothing now says pinning as it stands would refuse (I-97)" },
    ];

    for (const scenario of cases) {
      cleanup();
      const container = mount(await setBrowser(), scenario.props);
      const empties = all(container, "set-empty");
      expect(empties.length, `exactly one set-empty stands at a time (I-97) — ${scenario.why}`).toBe(1);
      expect((empties[0] as HTMLElement).getAttribute("data-cause"), scenario.why).toBe(scenario.cause);
    }

    cleanup();
    const whole = mount(await setBrowser(), browserProps(view([member], [pin]), [member]));
    expect(all(whole, "set-empty").length, "a set with members and pinned revisions is not empty of anything").toBe(0);
  });

  test("AC-5: a toggle writes at once, and the pin door carries PIN_DRAWING_SET into the one ConsequenceDialog", async () => {
    const table = await strings();
    const member = lineage("toggled.dxf", 1);
    const asked: { drawingId: string }[] = [];
    const carried: { consequenceDigest: string }[] = [];
    const digest = sha256OfText("preview-carried");
    const set = view([], []);
    const container = mount(
      await setBrowser(),
      browserProps(set, [member], {
        toggle: async (request: { drawingId: string }) => {
          asked.push(request);
          return { toggled: true, member: true };
        },
        preview: async () => ({ previewed: true, consequence: consequenceFor([member]), consequenceDigest: digest }),
        commit: async (request: { consequenceDigest: string }) => {
          carried.push(request);
          return { committed: true, actId: randomUUID(), setRevisionId: randomUUID(), digest: sha256OfText("committed") };
        },
      }),
    );

    const person = userEvent.setup();
    await person.click(one(container, "set-member-toggle", "the row for the drawing"));
    expect(asked.map((request) => request.drawingId), "a press writes the draft at once — no dialog, no digest, no consequence (I-96)").toEqual([member.drawingId]);
    expect(all(container, "consequence-dialog").length, "toggling a member opens no dialog").toBe(0);

    await person.click(screen.getByRole("button", { name: table["sets_pin_submit"] as string }));
    const dialog = await screen.findByTestId("consequence-dialog");
    expect(dialog.textContent ?? "", "the dialog names the act it carries, verbatim (L-ACT-02)").toContain(PIN_DRAWING_SET);
    expect(within(dialog).getAllByTestId("consequence-subject-row").length, "one row per subject the preview resolved server-side").toBe(1);

    await person.click(within(dialog).getByTestId("consequence-confirm"));
    expect(carried.map((request) => request.consequenceDigest), "the commit carries back the very digest the preview answered (L-ACT-02)").toEqual([digest]);
  });
});
