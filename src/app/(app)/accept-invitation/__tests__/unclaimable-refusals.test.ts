/**
 * The refusals this screen answers in place, enumerated and exercised one code at a time.
 *
 * The screen renders more than one registered code through the same slot, and a chain of hand-spelled
 * comparisons grows a branch each time a door behind it registers another. The set is the roster and
 * the page walks it, so "which codes can this screen show?" has one answer — and every member of it
 * is proved to render, rather than the first one standing in for the rest (Q-07, B-19).
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so `tsc` reads this file too. The page
 * is called rather than rendered — what is judged is the answer it composed and the refusal entry it
 * put in it, and the rendering of an entry is the one renderer's business (ARCH-02).
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { REFUSALS, refusalOf } from "../../../../core/errors";
import { refusal } from "../../../../core/faults/refusal-marker";
import { UNCLAIMABLE_CODES } from "../states";

const seam = vi.hoisted(() => ({
  sessionOf: vi.fn(async () => ({ userId: "user-1" })),
  admitAttempt: vi.fn(async () => undefined),
  offeredInvitation: vi.fn(),
  Unclaimable: (props: { refusal: { code: string } }) => props,
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("../../../../server/shell/resolve", () => ({ sessionOf: seam.sessionOf }));
vi.mock("../../../../server/shell/session", () => ({ presentedSessionToken: async () => "token" }));
vi.mock("../../../../server/auth/rate-limit", () => ({ admitAttempt: seam.admitAttempt }));
vi.mock("../../../../server/auth/invitation-mail", () => ({ invitationMachinery: {} }));
vi.mock("../../../../modules/spine/tenancy", () => ({ offeredInvitation: seam.offeredInvitation }));
// The three legs of the form are the screen's own components; this criterion is about which answer
// the page gives, so they stand in and the element the page built is read for the props it handed.
vi.mock("../accept-invitation-form", () => ({
  AcceptInvitationForm: () => null,
  AcceptInvitationNoToken: () => null,
  AcceptInvitationUnclaimable: seam.Unclaimable,
}));

const AcceptInvitation = (await import("../page")).default;

/** One node of the element the page returned, as a bag with a type and props. */
interface Node {
  readonly type?: unknown;
  readonly props?: Record<string, unknown>;
}

/** The refusal entry the page handed the unclaimable leg, or a loud absence. */
function refusalRendered(node: unknown): { code: string; message: string; remedy: string } {
  const element = node as Node;
  expect(element?.type, "the answer is the unclaimable leg, rendered through the one renderer").toBe(seam.Unclaimable);
  return (element.props as { refusal: { code: string; message: string; remedy: string } }).refusal;
}

const ask = (): Promise<unknown> => AcceptInvitation({ searchParams: Promise.resolve({ token: "a-mailed-token" }) });

beforeEach(() => {
  vi.clearAllMocks();
  seam.sessionOf.mockResolvedValue({ userId: "user-1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

test("the enumerated set is codes of the closed register, not words spelled beside the screen", () => {
  expect(UNCLAIMABLE_CODES.length, "more than one code reaches this slot — that is what the set is for").toBeGreaterThan(1);
  for (const code of UNCLAIMABLE_CODES) {
    expect(Object.keys(REFUSALS), `${code} is a registered refusal (R-SPINE-062)`).toContain(code);
  }
});

for (const code of UNCLAIMABLE_CODES) {
  test(`a read refused ${code} is answered in place, with the register's own entry`, async () => {
    seam.offeredInvitation.mockRejectedValue(refusal(code, "the door behind this screen refused the read"));

    const entry = refusalRendered(await ask());

    expect(entry, "the entry is the register's, carried whole — code, message and remedy").toEqual(refusalOf(code));
    expect(entry.remedy.length, "and its remedy is what the person is given to do next (I-65)").toBeGreaterThan(0);
  });
}

test("a refusal the screen does not answer for travels on rather than being dressed as one it does", async () => {
  const stranger = Object.keys(REFUSALS).find((code) => !UNCLAIMABLE_CODES.some((known) => known === code));
  expect(stranger, "the register holds codes beyond this screen's set").toBeDefined();
  seam.offeredInvitation.mockRejectedValue(refusal(stranger as never, "a refusal this screen has no answer for"));

  await expect(ask(), "an answer this screen cannot give is not this screen's to render (ARCH-03)").rejects.toThrow();
});
