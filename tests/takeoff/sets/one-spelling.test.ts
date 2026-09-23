// @vitest-environment jsdom
/**
 * I-360 — the sets index and the set browser as the 2026-09-23 re-look of the M3 project asked them
 * to read: one spelling of each fact, one helper line a screen, and a cell that states its value.
 *
 *  1. the pinned manifest's digest has ONE name on both screens, and the name is a surveyor's word;
 *  2. the index shows one helper line (its caption); the two section hints are each section's
 *     accessible description, clipped from sight (I-324's idiom), and neither says "digest";
 *  3. navigation is spelled once per row: the set's name is the row's door (`set-open` around
 *     `set-row-name`), and neither header repeats the breadcrumb's "Drawings" crumb;
 *  4. the "In this set" cell states the membership ("In set" / "Not in set"), then the verb, and keeps
 *     `aria-pressed`, the drawing-named `aria-label` and the one control that fills its well.
 *
 * The copy is read from the screens' own table by key (R-SPINE-060); the rows are built here.
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`.
 */
import { createHash, randomUUID } from "node:crypto";
import { createElement, type FunctionComponent } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { productModule } from "../../server/support/wire";
import { TESTIDS } from "../../../src/ui/testids";

const SETS_DIR = "src/app/(app)/t/[tenant]/p/[project]/drawings/sets";
const TENANT = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

type Mountable = (props: Record<string, unknown>) => unknown;

afterEach(() => {
  cleanup();
});

async function table(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(`${SETS_DIR}/strings.ts`);
  return module["sets"] as Record<string, string>;
}

async function componentOf(home: string, name: string): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(home);
  return module[name] as Mountable;
}

function mount(component: Mountable, props: Record<string, unknown>): HTMLElement {
  return render(createElement(component as unknown as FunctionComponent, props)).container;
}

function all(scope: HTMLElement, testId: string): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`)];
}

const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

function summary(name: string, pinned: boolean) {
  return { setId: randomUUID(), name, memberCount: 1, revisionCount: pinned ? 1 : 0, currentDigest: pinned ? sha(name) : null, createdAt: new Date().toISOString() };
}

function lineage(name: string) {
  const revision = { revisionId: randomUUID(), ordinal: 1, sha256: sha(name), createdAt: new Date().toISOString() };
  return { drawingId: randomUUID(), name, revisions: [revision], current: revision };
}

/** The section a heading names, and the text of the element its `aria-describedby` points at. */
function describedBy(container: HTMLElement, heading: string): { section: HTMLElement; description: HTMLElement } {
  const h2 = [...container.querySelectorAll("h2")].find((element) => element.textContent === heading);
  expect(h2, `a section is headed ${JSON.stringify(heading)}`).toBeDefined();
  const section = h2?.closest("section") as HTMLElement;
  const id = section.getAttribute("aria-describedby") ?? "";
  expect(id, `the ${heading} section names its description`).not.toBe("");
  const description = container.ownerDocument.getElementById(id) as HTMLElement;
  expect(description, `and the element it names stands in the section (${heading})`).not.toBeNull();
  return { section, description };
}

describe("I-360: one name for the pinned manifest's fingerprint", () => {
  test("the index's column and the browser's pinned revision say the same words, and neither says 'digest'", async () => {
    const copy = await table();
    expect(copy["sets_col_digest"], "one fact, one name on both screens (CLAUDE.md: a second spelling is a defect)").toBe(copy["sets_revision_digest_label"]);
    for (const key of ["sets_col_digest", "sets_revision_digest_label", "sets_list_hint", "sets_pin_hint", "sets_create_hint", "sets_caption"]) {
      expect((copy[key] ?? "").toLowerCase(), `${key} is said in a surveyor's words, not build vocabulary (Direction §6)`).not.toContain("digest");
    }
  });
});

describe("I-360: the sets index — one helper line, and the name is the door", () => {
  test("the caption is the one visible helper line; each section's hint is its clipped description", async () => {
    const copy = await table();
    const container = mount(await componentOf(`${SETS_DIR}/sets-index.tsx`, "SetsIndex"), {
      tenantId: TENANT,
      projectId: PROJECT,
      sets: [summary("Tender set", true)],
      canPin: true,
      createSet: async () => ({ created: true, setId: randomUUID() }),
    });
    for (const [heading, hint] of [
      [copy["sets_create_heading"], copy["sets_create_hint"]],
      [copy["sets_list_heading"], copy["sets_list_hint"]],
    ] as const) {
      const { description } = describedBy(container, heading as string);
      expect(description.textContent, `the ${heading} section is described by its hint`).toBe(hint);
      expect(description.className, "clipped from sight, as I-324 clips the browser's section hints").toContain("cx-set-described");
    }
    expect(container.querySelectorAll(".cx-sets-hint").length, "no hint stands as a visible line on the index").toBe(0);
    expect(container.querySelector(".cx-sets-caption")?.textContent, "the caption stands, the screen's one helper line").toBe(copy["sets_caption"]);
  });

  test("the set's name is the row's one door, and the header does not repeat the breadcrumb", async () => {
    const held = [summary("Tender set", true), summary("Draft set", false)];
    const container = mount(await componentOf(`${SETS_DIR}/sets-index.tsx`, "SetsIndex"), {
      tenantId: TENANT,
      projectId: PROJECT,
      sets: held,
      canPin: true,
      createSet: async () => ({ created: true, setId: randomUUID() }),
    });
    const rows = all(container, TESTIDS.set.row);
    expect(rows.length).toBe(held.length);
    for (const [at, row] of rows.entries()) {
      const set = held[at] as (typeof held)[number];
      const doors = all(row, TESTIDS.set.open);
      expect(doors.length, "one door per row").toBe(1);
      const door = doors[0] as HTMLElement;
      expect(door.tagName, "a link: navigation a browser can follow, open in a new tab and copy").toBe("A");
      expect(door.getAttribute("href")).toBe(`/t/${TENANT}/p/${PROJECT}/drawings/sets/${set.setId}`);
      expect(door.querySelector(`[data-testid="${TESTIDS.set.rowName}"]`)?.textContent, "and the door is the set's own name").toBe(set.name);
      expect(door.closest('[role="rowheader"]'), "standing in the frozen key column").not.toBeNull();
    }
    expect(container.querySelector("header a"), "the header carries no link: the breadcrumb's Drawings crumb is the way to the sheet index").toBeNull();
    expect(all(container, TESTIDS.set.drawingsLink).length, "and nothing else on a populated index points there").toBe(0);
  });

  test("a reader who may not name a set is still shown the way to the drawings from the empty index", async () => {
    const container = mount(await componentOf(`${SETS_DIR}/sets-index.tsx`, "SetsIndex"), { tenantId: TENANT, projectId: PROJECT, sets: [], canPin: false });
    const links = all(container, TESTIDS.set.drawingsLink);
    expect(links.length, "the empty state's one action is the contract's set-drawings-link").toBe(1);
    expect(links[0]?.getAttribute("href")).toBe(`/t/${TENANT}/p/${PROJECT}/drawings`);
  });
});

describe("I-360: the set browser — the header, and a cell that states its value", () => {
  async function browser(canPin: boolean, members: string[], lineages: ReturnType<typeof lineage>[]): Promise<HTMLElement> {
    return mount(await componentOf(`${SETS_DIR}/[set]/set-browser.tsx`, "SetBrowser"), {
      tenantId: TENANT,
      projectId: PROJECT,
      set: { setId: randomUUID(), name: "Golden Path Set (F-RCC6-BNBC)", members, revisions: [] },
      lineages,
      canPin,
      toggle: async () => ({ toggled: true, member: true }),
      preview: async () => ({ previewed: false, refusal: "SET_NOT_PINNABLE" }),
      commit: async () => ({ committed: false, refusal: "SET_NOT_PINNABLE" }),
    });
  }

  test("the header holds the name, the caption and the way back to the sets — not a second way to the drawings", async () => {
    const copy = await table();
    const one = lineage("rcc6-bnbc.dxf");
    const container = await browser(true, [one.drawingId], [one]);
    const links = [...container.querySelectorAll<HTMLAnchorElement>("header a")];
    expect(links.map((link) => link.textContent), "one link, back to the sets index, until the trail can say 'Drawing sets'").toEqual([copy["sets_sets_link"]]);
    expect(all(container, TESTIDS.set.drawingsLink).length, "the breadcrumb's Drawings crumb is the way to the sheet index").toBe(0);
  });

  test("the membership well states the value, then the verb, and keeps the toggle's contract", async () => {
    const copy = await table();
    const inside = lineage("member.dxf");
    const outside = lineage("outsider.dxf");
    const container = await browser(true, [inside.drawingId], [inside, outside]);
    for (const [drawing, member] of [
      [inside, true],
      [outside, false],
    ] as const) {
      const row = container.querySelector<HTMLElement>(`[data-testid="${TESTIDS.set.drawing}"][data-drawing="${drawing.drawingId}"]`) as HTMLElement;
      const toggle = all(row, TESTIDS.set.memberToggle)[0] as HTMLElement;
      expect(toggle.querySelector(".cx-set-member-state")?.textContent, `${drawing.name}'s cell says whether the set names it`).toBe(member ? copy["sets_member_in"] : copy["sets_member_out"]);
      expect(toggle.querySelector(".cx-set-member-verb")?.textContent, "then what pressing it does").toBe(member ? copy["sets_member_remove"] : copy["sets_member_add"]);
      expect(toggle.getAttribute("aria-pressed"), "the pressed state still carries the membership (R-UI-012)").toBe(member ? "true" : "false");
      expect(toggle.getAttribute("aria-label"), "named for the drawing it acts on").toBe((member ? copy["sets_member_remove_label"] : copy["sets_member_add_label"])?.replace("{drawing}", drawing.name));
      expect(toggle.getAttribute("data-variant"), "one ghost control: no border to lay on the row's hairlines").toBe("ghost");
      expect(toggle.closest('[data-control="true"]'), "and it still fills its well, one target with the cell (SC 2.5.8)").not.toBeNull();
    }
  });
});
