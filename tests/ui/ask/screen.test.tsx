// @vitest-environment jsdom
/**
 * S-Ask, mounted (docs/design/s-ask.md §1.1, §2, I-403, J-043's unit half): the thread kept in the
 * tab and restored with no request; a question in the address asked ONCE and the address replaced by
 * the bare route; a kept answer read against an older stamp saying so; an answer's anatomy over the
 * engine's own facts for the F-RCC6-BNBC read-back; and the denied, empty and no-campaign cells.
 *
 * The door is the suite's: it answers with the engine's own `answerStatement` over the read-back, so
 * what renders is what the product would answer, and every call it receives is counted.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { answerStatement } from "@/modules/takeoff/ask/answer";
import type { AskAnswer } from "@/modules/takeoff/ask/law";
import { strings } from "@/ui/strings";
import { TESTIDS, testIdSelector } from "@/ui/testids";
import { readBackSources } from "../../ai/ask/support/readback";
import { memoryStorage } from "./support/storage";

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/", notFound: vi.fn(), redirect: vi.fn() }));

const { FIGURES } = await import("../../../src/app/(app)/t/[tenant]/figures");
const { FigureProvider } = await import("@/ui/primitives/core");
const { AskScreen } = await import("../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/ask-screen");
const { threadKey } = await import("../../../src/app/(app)/t/[tenant]/p/[project]/takeoff/ask/thread");

const SOURCES = readBackSources();
const TENANT = "tenant-1";
const PROJECT = "project-1";
const USER = "user-1";
const KEY = threadKey(USER, TENANT, PROJECT);
const ARRIVAL = { campaign: { campaignId: "c-1", setRevisionId: "r-1" }, stamp: "stamp-now", example: { class: "column", mark: "C1", level: "GF" } };

/** The suite's door: the engine's own answer over the read-back, every call counted. */
const door = vi.fn(async (_projectId: string, ask: { question: string }) => ({ ok: true as const, answer: answerStatement(ask, SOURCES) }));

beforeEach(() => {
  door.mockClear();
  router.replace.mockClear();
});

afterEach(() => cleanup());

function mount(props: Partial<Parameters<typeof AskScreen>[0]> = {}) {
  return render(
    <FigureProvider format={FIGURES}>
      <AskScreen tenantId={TENANT} projectId={PROJECT} userId={USER} arrival={ARRIVAL} participant={true} reportId={null} question={null} door={door} storage={memoryStorage()} {...props} />
    </FigureProvider>,
  );
}

const one = (root: HTMLElement, id: string): HTMLElement | null => root.querySelector(testIdSelector(id as never));
const all = (root: HTMLElement, id: string): HTMLElement[] => [...root.querySelectorAll<HTMLElement>(testIdSelector(id as never))];

function kept(id: string, question: string, answer: AskAnswer, stamp = ARRIVAL.stamp) {
  return { id, question, askedAt: "2026-09-24T06:00:00.000Z", stamp, answer, refusal: null, fault: null, previous: null, declined: false };
}

describe("the thread is kept in the tab, and a return asks nothing (I-403)", () => {
  test("a kept thread is restored with no request at all, newest first", async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, JSON.stringify([kept("b", "What is the column concrete?", answerStatement({ question: "What is the column concrete?" }, SOURCES)), kept("a", "How many C3 columns are on 5F?", answerStatement({ question: "How many C3 columns are on 5F?" }, SOURCES))]));
    const { container } = mount({ storage });
    await waitFor(() => expect(all(container, TESTIDS.ask.answer).length).toBe(2));
    expect(door, "restoring the thread sends no question").not.toHaveBeenCalled();
    expect(all(container, TESTIDS.ask.question).map((node) => node.textContent)).toEqual(["What is the column concrete?", "How many C3 columns are on 5F?"]);
    expect(one(container, TESTIDS.ask.screen)?.getAttribute("data-state")).toBe("ready");
  });

  test("the answer a link was followed from wears the origin mark on return", async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, JSON.stringify([kept("a", "How many C3 columns are on 5F?", answerStatement({ question: "How many C3 columns are on 5F?" }, SOURCES))]));
    storage.setItem(`${KEY}:origin`, JSON.stringify("a"));
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = mount({ storage });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-origin")).toBe("true"));
  });

  test("a kept answer read at an older stamp says so, and offers to ask again", async () => {
    const storage = memoryStorage();
    storage.setItem(KEY, JSON.stringify([kept("a", "How many C3 columns are on 5F?", answerStatement({ question: "How many C3 columns are on 5F?" }, SOURCES), "stamp-before")]));
    const { container } = mount({ storage });
    await waitFor(() => expect(one(container, TESTIDS.ask.stale)).not.toBeNull());
    expect(one(container, TESTIDS.ask.stale)?.textContent).toContain(strings.ask_stale);
    await act(async () => {
      fireEvent.click(one(container, TESTIDS.ask.again) as HTMLElement);
    });
    expect(door, "asking again re-runs the kept reading, routed by the person — never the question to a model").toHaveBeenCalledTimes(1);
    expect(door.mock.calls[0]?.[1]).toMatchObject({ reading: { intent: "COUNT", mark: "C3", level: "5F" } });
  });
});

describe("a question in the address is asked once, and the address is replaced (I-403)", () => {
  test("?q= is asked exactly once and the bare route replaces it", async () => {
    const { container, rerender } = mount({ question: "How many C3 columns are on 5F?" });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-answer")).toBe("answered"));
    expect(door).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith(`/t/${TENANT}/p/${PROJECT}/takeoff/ask`);
    rerender(
      <FigureProvider format={FIGURES}>
        <AskScreen tenantId={TENANT} projectId={PROJECT} userId={USER} arrival={ARRIVAL} participant={true} reportId={null} question="How many C3 columns are on 5F?" door={door} storage={memoryStorage()} />
      </FigureProvider>,
    );
    expect(door, "a re-render with the same address asks nothing again").toHaveBeenCalledTimes(1);
  });
});

describe("an answer's anatomy, over the engine's own facts (§1.1)", () => {
  test("asked through the band: the question, the Understood row, a figure inside an EvidenceLink with its unit apart, the basis", async () => {
    const { container } = mount();
    await waitFor(() => expect(one(container, TESTIDS.ask.empty)).not.toBeNull());
    fireEvent.change(one(container, TESTIDS.ask.field) as HTMLElement, { target: { value: "What is the column concrete?" } });
    await act(async () => {
      fireEvent.submit(one(container, TESTIDS.ask.form) as HTMLElement);
    });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-answer")).not.toBe("answering"));
    const article = one(container, TESTIDS.ask.answer) as HTMLElement;
    expect(article.getAttribute("data-intent")).toBe("QUANTITY");
    expect(article.getAttribute("data-routed-by")).toBe("GRAMMAR");
    expect(one(article, TESTIDS.ask.understood)?.textContent).toContain(strings.ask_intent_quantity);
    const figure = article.querySelector<HTMLElement>(`${testIdSelector(TESTIDS.evidence.link)}[data-figure]`);
    expect(figure?.textContent).toContain("93.893");
    expect(figure?.getAttribute("data-unit")).toBe("m3");
    expect(figure?.querySelector(testIdSelector(TESTIDS.unit.badge)), "the unit is never inside the link").toBeNull();
    expect(one(article, TESTIDS.ask.body)?.querySelector(testIdSelector(TESTIDS.unit.badge))?.textContent).toBe("m3");
    expect(one(article, TESTIDS.ask.body)?.getAttribute("aria-live"), "the newest answer's body is announced").toBe("polite");
    expect(one(article, TESTIDS.ask.basis)?.textContent).toContain(strings.ask_basis_register);
    // No figure on an answer stands outside an EvidenceLink (§6's asserted absence).
    for (const node of article.querySelectorAll("[data-figure]")) expect(node.getAttribute("data-testid")).toBe(TESTIDS.evidence.link);
  });

  test("a cost is refused by name, with the draft BOQ as its evidence", async () => {
    const { container } = mount();
    await waitFor(() => expect(one(container, TESTIDS.ask.empty)).not.toBeNull());
    fireEvent.change(one(container, TESTIDS.ask.field) as HTMLElement, { target: { value: "What will the column concrete cost?" } });
    await act(async () => {
      fireEvent.submit(one(container, TESTIDS.ask.form) as HTMLElement);
    });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-answer")).toBe("refused"));
    expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-code")).toBe("ASK_ESTIMATE_NOT_BUILT");
    expect(one(container, TESTIDS.refusal.evidenceLink)?.getAttribute("href")).toBe(`/t/${TENANT}/p/${PROJECT}/takeoff/boq`);
    expect(one(container, TESTIDS.ask.screen)?.getAttribute("data-state")).toBe("refused");
  });

  test("a clarify offers at most two readings and None of these; choosing one answers in the same article, routed by the person", async () => {
    const { container } = mount();
    await waitFor(() => expect(one(container, TESTIDS.ask.empty)).not.toBeNull());
    fireEvent.change(one(container, TESTIDS.ask.field) as HTMLElement, { target: { value: "How many C3 columns are on level 5?" } });
    await act(async () => {
      fireEvent.submit(one(container, TESTIDS.ask.form) as HTMLElement);
    });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-answer")).toBe("clarify"));
    const readings = all(container, TESTIDS.ask.reading);
    expect(readings.length).toBeGreaterThan(0);
    expect(readings.length).toBeLessThanOrEqual(2);
    expect(one(container, TESTIDS.ask.readingNone)?.textContent).toBe(strings.ask_reading_none);
    await act(async () => {
      fireEvent.click(readings[0] as HTMLElement);
    });
    await waitFor(() => expect(one(container, TESTIDS.ask.answer)?.getAttribute("data-routed-by")).toBe("PERSON"));
    expect(all(container, TESTIDS.ask.answer).length, "the choice answers in the same article").toBe(1);
  });
});

describe("the screen's other cells (§2)", () => {
  test("denied: no band, no thread, the participation refusal by name", () => {
    const { container } = mount({ participant: false, arrival: null });
    expect(one(container, TESTIDS.ask.screen)?.getAttribute("data-state")).toBe("denied");
    expect(one(container, TESTIDS.ask.form)).toBeNull();
    expect(one(container, TESTIDS.refusal.state)?.getAttribute("data-code")).toBe("PERMISSION_NOT_HELD");
  });

  test("empty with a campaign: the example is built from the register, and asks it", async () => {
    const { container } = mount();
    await waitFor(() => expect(one(container, TESTIDS.ask.example)).not.toBeNull());
    expect(one(container, TESTIDS.ask.example)?.textContent).toBe("How many columns marked C1 are on GF?");
    expect(one(container, TESTIDS.ask.screen)?.getAttribute("data-state")).toBe("empty");
  });

  test("no campaign: the band is absent and the one action browses the drawing sets", () => {
    const { container } = mount({ arrival: { campaign: null, stamp: "none", example: null }, question: "How many C3 columns are on 5F?" });
    expect(one(container, TESTIDS.ask.form)).toBeNull();
    expect(one(container, TESTIDS.ask.empty)?.textContent).toContain(strings.ask_empty_no_campaign_heading);
    expect(door, "a question arriving with no campaign is not asked").not.toHaveBeenCalled();
  });

  test("error: the read's report id and a retry", () => {
    const { container } = mount({ arrival: null, reportId: "report-1" });
    expect(one(container, TESTIDS.ask.screen)?.getAttribute("data-state")).toBe("error");
    expect(one(container, TESTIDS.error.stateReport)).not.toBeNull();
  });
});
