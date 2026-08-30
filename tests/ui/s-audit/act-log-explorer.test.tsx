// @vitest-environment jsdom
/**
 * Public acceptance for AC-1's act-log anatomy and AC-2's filtering, over the client component the
 * test contract names: `act-log-explorer.tsx` exports `ActLogExplorer({ acts })`, and "filtering is
 * in-component over the given rows".
 *
 * The rows are identified by the digest each one renders, never by an index or a count: the
 * assertions state the RULE — "exactly the acts satisfying the conjunction remain" — computed from
 * the fixture set by the same predicate a reader would apply, so a Builder who renders them in some
 * other order, or a later increment that adds a fourth fixture, is judged by the same file (B-19).
 *
 * What is NOT here: paint. jsdom lays nothing out and resolves no `var()`, so the Decision's tokens,
 * hairlines and column measures are graded in the browser at the J-003 checkpoint, not by a second
 * weaker idea of the same guarantee (ARCH-02).
 */
import { createElement } from "react";
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { formatDate, formatUserFigure } from "../../../src/core/format";
import { fill } from "../../../src/ui/strings";
import { ATTR_ACTOR_ID, ATTR_ACT_TYPE, EXPLORER_MODULE, TESTID, act, decisionCopy, productModule, type AuditAct } from "./support/decision";

type Explorer = (props: { acts: readonly AuditAct[] }) => unknown;

async function explorer(): Promise<Explorer> {
  const module = await productModule<Record<string, unknown>>(EXPLORER_MODULE);
  const component = module["ActLogExplorer"];
  expect(
    typeof component,
    `${EXPLORER_MODULE} must export the client component ActLogExplorer({ acts }) — the test contract names it, and AC-2's filtering is its behaviour`,
  ).toBe("function");
  return component as Explorer;
}

/* ------------------------------------------------------------------ the fixture set */

const TYPE_ASSIGN = "ASSIGN_PARTICIPANT_ROLE";
/**
 * A second act type. The enum holds one member today, and a filter that only ever sees one value
 * cannot be shown to filter at all — so the fixtures carry the shape the act log grows into. The
 * component takes `actType: string` (test contract) and renders it verbatim (Decision I-25).
 */
const TYPE_CONFIRM = "CONFIRM_DISCIPLINES";

const ACTOR_ONE = "aaaaaaaa-0000-4000-8000-000000000001";
const ACTOR_TWO = "aaaaaaaa-0000-4000-8000-000000000002";

const SUBJECT_A = "5b1f0d0c-0000-4000-8000-00000000000a";
const SUBJECT_B = "5b1f0d0c-0000-4000-8000-00000000000b";
const SUBJECT_C = "5b1f0d0c-0000-4000-8000-00000000000c";
const SUBJECT_D = "5b1f0d0c-0000-4000-8000-00000000000d";

/** Newest first, as the module answers them; each digest is unique, so a row names itself. */
const ACTS: readonly AuditAct[] = [
  act({
    actId: "act-1",
    actType: TYPE_ASSIGN,
    actorId: ACTOR_ONE,
    actorLabel: "Farhana Rahman",
    subjects: [SUBJECT_A],
    consequenceDigest: "1".repeat(64),
    occurredAt: new Date(2026, 7, 30, 9, 15, 0),
  }),
  act({
    actId: "act-2",
    actType: TYPE_ASSIGN,
    actorId: ACTOR_TWO,
    actorLabel: "Imran Kabir",
    // One act, three subjects: L-ACT-01 records at the granularity performed.
    subjects: [SUBJECT_B, SUBJECT_C, SUBJECT_D],
    consequenceDigest: "2".repeat(64),
    occurredAt: new Date(2026, 6, 14, 18, 4, 0),
  }),
  act({
    actId: "act-3",
    actType: TYPE_CONFIRM,
    actorId: ACTOR_ONE,
    actorLabel: "Farhana Rahman",
    subjects: [SUBJECT_C],
    consequenceDigest: "3".repeat(64),
    occurredAt: new Date(2026, 5, 2, 11, 42, 0),
  }),
  act({
    actId: "act-4",
    actType: TYPE_CONFIRM,
    actorId: ACTOR_TWO,
    actorLabel: "Imran Kabir",
    subjects: [SUBJECT_A, SUBJECT_D],
    consequenceDigest: "4".repeat(64),
    occurredAt: new Date(2026, 4, 21, 7, 5, 0),
  }),
];

/** The digests of the acts a reader applying these filters would be left with. */
function expected(predicate: (candidate: AuditAct) => boolean): string[] {
  return ACTS.filter(predicate).map((candidate) => candidate.consequenceDigest).sort();
}

/* ------------------------------------------------------------------ reading the rendered list */

function rows(): HTMLElement[] {
  return screen.queryAllByTestId(TESTID.actRow);
}

/** What is on screen, named by the digest each row renders — the act's own identity (I-26). */
function shown(): string[] {
  return rows()
    .map((row) => (within(row).getByTestId(TESTID.consequence).textContent ?? "").trim())
    .sort();
}

function control(testId: string): HTMLElement {
  return screen.getByTestId(testId);
}

function selectFor(testId: string): HTMLSelectElement {
  const element = control(testId);
  expect(element.tagName.toLowerCase(), `[data-testid=${testId}] is the screen's closed choice of act type/actor (Decision I-31)`).toBe("select");
  return element as HTMLSelectElement;
}

/** Put a filter back to the choice that filters nothing — its own first option, whatever it is. */
async function clearChoice(user: ReturnType<typeof userEvent.setup>, testId: string): Promise<void> {
  const select = selectFor(testId);
  const first = select.options[0];
  expect(first, `[data-testid=${testId}] must offer an all-option first, so a filter can be cleared (Decision I-31)`).toBeTruthy();
  await user.selectOptions(select, first as HTMLOptionElement);
}

async function mount(acts: readonly AuditAct[]): Promise<ReturnType<typeof userEvent.setup>> {
  const ActLogExplorer = await explorer();
  const user = userEvent.setup();
  // As an element, never as a call: the component holds the filter state, and a function invoked
  // outside a renderer has no hook to hold it in.
  render(createElement(ActLogExplorer as never, { acts }));
  return user;
}

afterEach(cleanup);

/* ------------------------------------------------------------------ AC-1: the row's anatomy */

describe("AC-1 — the act log lists the project's acts, each showing what it did and what it cited", () => {
  test("AC-1: every act renders a row carrying its act type and its actor as data attributes", async () => {
    await mount(ACTS);

    expect(screen.getByTestId(TESTID.acts), `[data-testid=${TESTID.acts}] is the act-log region the contract names`).toBeTruthy();
    expect(rows().length, `one [data-testid=${TESTID.actRow}] per given act`).toBe(ACTS.length);

    rows().forEach((row, index) => {
      const given = ACTS[index] as AuditAct;
      expect(row.getAttribute(ATTR_ACT_TYPE), `row ${index} must carry ${ATTR_ACT_TYPE} — it is what a filter is proven against`).toBe(given.actType);
      expect(row.getAttribute(ATTR_ACTOR_ID), `row ${index} must carry ${ATTR_ACTOR_ID}`).toBe(given.actorId);
    });
  });

  test("AC-1: the rows stand in the order the module answered them — newest first", async () => {
    await mount(ACTS);
    const digests = rows().map((row) => (within(row).getByTestId(TESTID.consequence).textContent ?? "").trim());
    expect(digests, "the list renders the acts in the given (newest-first) order — it does not re-order them").toEqual(ACTS.map((given) => given.consequenceDigest));
  });

  test("AC-1: each row shows its act type, its actor and its consequence digest whole", async () => {
    await mount(ACTS);

    rows().forEach((row, index) => {
      const given = ACTS[index] as AuditAct;
      const text = (row.textContent ?? "").replace(/\s+/g, " ");
      expect(text, `row ${index} shows the act type verbatim (Decision I-25)`).toContain(given.actType);
      expect(text, `row ${index} shows who acted`).toContain(given.actorLabel);
      expect(
        (within(row).getByTestId(TESTID.consequence).textContent ?? "").trim(),
        `[data-testid=${TESTID.consequence}] holds the digest whole — a digest is never abbreviated (Decision I-26)`,
      ).toBe(given.consequenceDigest);
    });
  });

  test("AC-1: each row cites its evidence — every subject of the act, none omitted", async () => {
    await mount(ACTS);

    rows().forEach((row, index) => {
      const given = ACTS[index] as AuditAct;
      const evidence = (within(row).getByTestId(TESTID.evidence).textContent ?? "").replace(/\s+/g, " ");
      for (const subject of given.subjects) {
        expect(evidence, `[data-testid=${TESTID.evidence}] of row ${index} must cite ${subject} — an act's cited evidence is its subjects, shown whole`).toContain(subject);
      }
    });
  });

  test("AC-1: occurred-at renders through SEAM-FORMAT's BD_DOCUMENT date, never a raw timestamp", async () => {
    await mount(ACTS);

    rows().forEach((row, index) => {
      const given = ACTS[index] as AuditAct;
      const through = formatDate({ year: given.occurredAt.getFullYear(), month: given.occurredAt.getMonth() + 1, day: given.occurredAt.getDate() });
      const text = (row.textContent ?? "").replace(/\s+/g, " ");
      expect(text, `row ${index} must render its occurred-at through SEAM-FORMAT (Decision I-34) — expected ${through}`).toContain(through);
      expect(text, `row ${index} must not print the machine timestamp beside it`).not.toContain(given.occurredAt.toISOString());
    });
  });

  test("AC-1: the three filter controls are present and labelled", async () => {
    await mount(ACTS);

    for (const [testId, labelKey] of [
      [TESTID.filterType, "audit_filter_type_label"],
      [TESTID.filterActor, "audit_filter_actor_label"],
      [TESTID.filterSubject, "audit_filter_subject_label"],
    ] as const) {
      const element = control(testId);
      const label = decisionCopy()[labelKey] ?? "";
      expect(label, `${labelKey} must be ruled in docs/design/s-audit.md §3`).not.toBe("");
      const named = element.getAttribute("aria-label") ?? (element.id === "" ? "" : (document.querySelector(`label[for="${element.id}"]`)?.textContent ?? ""));
      expect(named.replace(/\s+/g, " ").trim(), `[data-testid=${testId}] must carry the Decision's visible label "${label}" (Decision §1, R-UI-012)`).toContain(label);
    }
  });

  test("AC-1: the count line announces how many of the acts are shown", async () => {
    const copy = decisionCopy();
    const user = await mount(ACTS);

    const status = screen.getByRole("status");
    const whole = fill(copy["audit_count"] ?? "", { shown: formatUserFigure(String(ACTS.length)), total: formatUserFigure(String(ACTS.length)) });
    expect((status.textContent ?? "").replace(/\s+/g, " ").trim(), "the count line states the shown and total figures through the string seam and SEAM-FORMAT (Decision §1)").toBe(whole);

    await user.selectOptions(selectFor(TESTID.filterType), TYPE_CONFIRM);
    const remaining = ACTS.filter((candidate) => candidate.actType === TYPE_CONFIRM).length;
    const filtered = fill(copy["audit_count"] ?? "", { shown: formatUserFigure(String(remaining)), total: formatUserFigure(String(ACTS.length)) });
    expect((screen.getByRole("status").textContent ?? "").replace(/\s+/g, " ").trim(), "a filter change is announced by the same live region").toBe(filtered);
  });
});

/* ------------------------------------------------------------------ AC-2: filtering is behaviour */

describe("AC-2 — filtering is real behaviour over the given rows", () => {
  test("AC-2: choosing an act type leaves only the rows whose data-act-type matches, and clearing restores the rest", async () => {
    const user = await mount(ACTS);
    expect(shown(), "with no filter chosen, every given act is listed").toEqual(expected(() => true));

    await user.selectOptions(selectFor(TESTID.filterType), TYPE_CONFIRM);
    expect(shown(), `choosing ${TYPE_CONFIRM} leaves exactly the acts of that type`).toEqual(expected((candidate) => candidate.actType === TYPE_CONFIRM));
    for (const row of rows()) expect(row.getAttribute(ATTR_ACT_TYPE), "no row of another type survives the filter").toBe(TYPE_CONFIRM);

    await clearChoice(user, TESTID.filterType);
    expect(shown(), "clearing the act-type filter restores the hidden rows — nothing was discarded").toEqual(expected(() => true));
  });

  test("AC-2: choosing an actor leaves only the rows whose data-actor-id matches, and clearing restores the rest", async () => {
    const user = await mount(ACTS);

    await user.selectOptions(selectFor(TESTID.filterActor), ACTOR_TWO);
    expect(shown(), "choosing an actor leaves exactly that actor's acts").toEqual(expected((candidate) => candidate.actorId === ACTOR_TWO));
    for (const row of rows()) expect(row.getAttribute(ATTR_ACTOR_ID), "no other actor's row survives the filter").toBe(ACTOR_TWO);

    await clearChoice(user, TESTID.filterActor);
    expect(shown(), "clearing the actor filter restores the hidden rows").toEqual(expected(() => true));
  });

  test("AC-2: entering a subject leaves only the acts whose subjects include it, and clearing restores the rest", async () => {
    const user = await mount(ACTS);
    const subject = control(TESTID.filterSubject);

    await user.type(subject, SUBJECT_C);
    expect(shown(), "the subject filter is membership of the act's cited evidence (Decision I-32)").toEqual(expected((candidate) => candidate.subjects.includes(SUBJECT_C)));

    await user.clear(subject);
    expect(shown(), "an empty subject entry is no filter — every act comes back").toEqual(expected(() => true));
  });

  test("AC-2: a multi-subject act answers the subject filter for each of the subjects it cites", async () => {
    const many = ACTS.find((candidate) => candidate.subjects.length > 1);
    expect(many, "the fixture set carries an act with several subjects — one act, N subjects (L-ACT-01)").toBeDefined();
    const user = await mount(ACTS);
    const subject = control(TESTID.filterSubject);

    for (const cited of (many as AuditAct).subjects) {
      await user.clear(subject);
      await user.type(subject, cited);
      expect(shown(), `filtering by ${cited} must keep the act that cites it among its subjects`).toContain((many as AuditAct).consequenceDigest);
      expect(shown(), `filtering by ${cited} leaves exactly the acts citing it`).toEqual(expected((candidate) => candidate.subjects.includes(cited)));
    }
  });

  test("AC-2: the three filters compose — the rows left are the ones satisfying all of them", async () => {
    const user = await mount(ACTS);

    await user.selectOptions(selectFor(TESTID.filterType), TYPE_CONFIRM);
    await user.selectOptions(selectFor(TESTID.filterActor), ACTOR_TWO);
    await user.type(control(TESTID.filterSubject), SUBJECT_D);

    expect(shown(), "the conjunction of act type, actor and subject — not any one of them, and not their union").toEqual(
      expected((candidate) => candidate.actType === TYPE_CONFIRM && candidate.actorId === ACTOR_TWO && candidate.subjects.includes(SUBJECT_D)),
    );
  });

  test("AC-2: an over-constrained combination shows the Decision's filtered empty state, not a bare gap", async () => {
    const copy = decisionCopy();
    const user = await mount(ACTS);

    await user.selectOptions(selectFor(TESTID.filterType), TYPE_ASSIGN);
    await user.selectOptions(selectFor(TESTID.filterActor), ACTOR_ONE);
    await user.type(control(TESTID.filterSubject), SUBJECT_D);

    expect(
      expected((candidate) => candidate.actType === TYPE_ASSIGN && candidate.actorId === ACTOR_ONE && candidate.subjects.includes(SUBJECT_D)),
      "the fixtures make this combination match nothing — otherwise the case would prove nothing",
    ).toEqual([]);
    expect(rows().length, "no row survives a combination no act satisfies").toBe(0);

    const empty = screen.getByTestId(TESTID.empty);
    const text = (empty.textContent ?? "").replace(/\s+/g, " ");
    expect(text, "the filtered empty state names the filters as the cause (Decision I-33)").toContain(copy["audit_empty_filtered_heading"] ?? " ");
    expect(text, "and says every act stays recorded").toContain(copy["audit_empty_filtered_body"] ?? " ");

    const clear = screen.getByRole("button", { name: copy["audit_empty_clear"] ?? "" });
    await user.click(clear);
    expect(shown(), "the region's one action clears all three filters in place").toEqual(expected(() => true));
    expect(screen.queryByTestId(TESTID.empty), "with rows back on screen, the empty block is gone").toBeNull();
  });

  test("AC-2: with no acts at all the region says so in the Decision's own words", async () => {
    const copy = decisionCopy();
    await mount([]);

    expect(rows().length, "no acts, no rows").toBe(0);
    const empty = screen.getByTestId(TESTID.empty);
    const text = (empty.textContent ?? "").replace(/\s+/g, " ");
    expect(text, "the no-acts variant teaches that the log fills itself (Decision I-33)").toContain(copy["audit_empty_none_heading"] ?? " ");
    expect(text, "and that there is nothing to set up").toContain(copy["audit_empty_none_body"] ?? " ");
    expect(
      screen.queryByRole("button", { name: copy["audit_empty_clear"] ?? "" }),
      "the no-acts variant carries no action — no action on a reader commits an act (Decision I-33)",
    ).toBeNull();
  });
});
