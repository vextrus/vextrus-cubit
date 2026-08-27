// Breaker acceptance for the refusal card's design-system law, as the arbitration on
// "the refusal block on /sessions is styled unlike every other refusal" amended it.
//
// The finding it replaces asserted a uniformity the law does not require. R-SPINE-062 gives every
// registered code its own severity and its own surface hint, so two codes of different severity
// MUST be able to paint differently (R-UI-060's "severity paints; it does not mean" is that rule's
// design-system form), and the standing Decisions prescribe per-surface silhouette and per-screen
// measure: the RefusalState Decision's Surfaces section rules `banner` region-width with no inline
// borders and no corners, and docs/design/s-auth.md § 1 and § 3 rule a 380 px auth column against
// the 560 px column /sessions renders its banner across. Demanding those deltas away is a change of
// design law, which B-20 makes the Decision's business, not a CSS patch — so this file never asserts
// cross-surface sameness of anything the law varies.
//
// What it does assert is the whole of what the law does require, so "styled unlike every other
// refusal" can never again be raised against a delta the law prescribes, nor go unnoticed when the
// delta is one the law does not:
//
//   1. every refusal surface renders the ONE renderer — one component file, one stylesheet, and on
//      the screen, one RefusalState inside the wrapper (ARCH-02, B-17);
//   2. the card's surface-INVARIANT chrome is identical across surfaces, and no per-surface or
//      per-screen override exists anywhere — not in another stylesheet, not in an inline style;
//   3. the paint each card wears is its registered severity's pair from src/core/errors.ts, never
//      the neighbouring card's (R-UI-060, the Decision's severity table);
//   4. each surface's prescribed chrome and each screen's prescribed container measure, asserted
//      per surface against the Decision — never as an equality between two surfaces.
//
// Two live cards carry it, reached the way a person reaches them: a credential that names no account
// on /sign-in (CREDENTIALS_NOT_VALID — error, inline) and /sessions held with no session at all
// (SIGNED_OUT — warning, banner). They are the exact pair the finding compared, and the registry is
// asked, not told, which severity and surface each of them is.
//
// The describe title carries the J-001 tag so `pnpm e2e --journey J-001` (which forwards to
// Playwright's --grep) collects this file: a guarantee no gate invocation runs is green-by-omission,
// which J-001's own words forbid.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { REFUSALS, type RefusalCode, type RefusalSeverity, type RefusalSurface } from "../../../src/core/errors";
import { S_AUTH } from "../pages/s-auth.page";

/** The pattern's one home (the RefusalState Decision § 1): one component file, one stylesheet. */
const PATTERN_DIR = join("src", "ui", "patterns", "refusal-state");
const PATTERN_STYLESHEET = join(PATTERN_DIR, "refusal-state.css");

/** The card's class, and the stem every part of it is spelled with. */
const CARD_STEM = "cx-refusal";

/**
 * The severity table of the RefusalState Decision § 1: fill token and the colour the border and the
 * code text share. Not a roster of what exists — the assertion below demands a row for every
 * severity the registry actually uses, so a severity added later is a red here, not a silent pass.
 */
const SEVERITY_PAINT: Readonly<Record<RefusalSeverity, { edge: string; fill: string }>> = Object.freeze({
  error: { edge: "--danger", fill: "--danger-surface" },
  warning: { edge: "--warn", fill: "--warn-surface" },
  info: { edge: "--info", fill: "--info-surface" },
});

/**
 * The Surfaces section of the same Decision, verbatim: `inline` is the block card, `dialog` is
 * chrome-identical to it, `banner` is the region-width answer — radius 0, no inline borders, wider
 * inline padding. `null` is the literal zero the Decision spells, not an absent expectation.
 */
const SURFACE_CHROME: Readonly<Record<RefusalSurface, { radius: string | null; paddingInline: string; inlineBorder: boolean }>> =
  Object.freeze({
    inline: { radius: "--radius-4", paddingInline: "--space-4", inlineBorder: true },
    dialog: { radius: "--radius-4", paddingInline: "--space-4", inlineBorder: true },
    banner: { radius: null, paddingInline: "--space-5", inlineBorder: false },
  });

/** The instrument's own hairline: the Decision's "1 px border", which no token expresses. */
const HAIRLINE_PX = 1;

/**
 * The measure each screen gives the thing it renders the refusal into (docs/design/s-auth.md § 1
 * and § 2): the shared auth column, and the wider column /sessions is. Both are `min(N,
 * calc(100vw - var(--space-8)))`, so the expectation is computed against the live viewport rather
 * than pinned to a number that only holds at one window size.
 */
const COLUMN_PX = Object.freeze({ auth: 380, sessions: 560 });

type Probe = {
  what: string;
  route: string;
  columnPx: number;
  reach: (page: Page) => Promise<void>;
};

/** A credential that names no account is CREDENTIALS_NOT_VALID — an answer, never a fault. */
const NO_SUCH_ACCOUNT = "refusal-uniformity-no-such-account@cubit.test";
const SOME_PASSWORD = "correct-horse-battery-staple-9";

const PROBES: readonly Probe[] = Object.freeze([
  {
    what: "a credential that names no account, on /sign-in",
    route: S_AUTH.signIn,
    columnPx: COLUMN_PX.auth,
    reach: async (page) => {
      await page.getByTestId("s-auth-email").fill(NO_SUCH_ACCOUNT);
      await page.getByTestId("s-auth-password").fill(SOME_PASSWORD);
      await page.getByTestId("s-auth-submit").click();
    },
  },
  {
    // Decision § 3: "On /sessions, a dead or missing session answers SIGNED_OUT: the registered
    // banner entry renders in the refusal wrapper in place of the list, full region width."
    what: "no session at all, on /sessions",
    route: S_AUTH.sessions,
    columnPx: COLUMN_PX.sessions,
    reach: async () => {
      /* arriving is the whole act: the browser holds no session cookie */
    },
  },
]);

/** Everything one painted card is, read off the built product in the browser that painted it. */
type Card = {
  what: string;
  route: string;
  columnPx: number;
  code: string;
  severity: string;
  surface: string;
  /** The chrome the law holds constant across every surface. */
  invariant: Record<string, string>;
  /** The chrome the law lets each surface prescribe, in px, and the Decision's own value for it. */
  radiusPx: number;
  expectedRadiusPx: number;
  paddingInlinePx: number;
  expectedPaddingInlinePx: number;
  inlineBorderPx: number;
  /** The paint, and the token values it is graded against, resolved in the same document. */
  edgeColour: string;
  fillColour: string;
  /** What the surface shows a person — the instrument for message and remedy being visible. */
  pageText: string;
  /** Every text node the surface renders, visible or not — the instrument for AC-3's absence. */
  allText: string;
  /** Chip elements in the DOM, counted whether or not they paint (AC-3: none). */
  codeChips: number;
  expectedEdge: string;
  expectedFill: string;
  /** The measure of the thing the screen renders the refusal into. */
  widthPx: number;
  expectedWidthPx: number;
  /** A style attribute on the card would be an override no stylesheet can be grepped for. */
  inlineStyle: string | null;
  classes: string;
  /** The Decision's block padding and gap, resolved for the invariant comparison. */
  blockPaddingPx: number;
  gapPx: number;
};

const cards: Card[] = [];

function registered(code: string, what: string): { severity: RefusalSeverity; surface: RefusalSurface; message: string; remedy: string } {
  expect(Object.hasOwn(REFUSALS, code), `${what} answered with "${code}", which the closed taxonomy registers (R-SPINE-062)`).toBe(true);
  const entry = REFUSALS[code as RefusalCode];
  return { severity: entry.severity, surface: entry.surface, message: entry.message, remedy: entry.remedy };
}

test.beforeAll(async ({ browser }) => {
  for (const probe of PROBES) {
    // A context of its own: the /sign-in probe must not carry a session into the /sessions probe,
    // whose whole subject is a browser holding none.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(probe.route);
    await probe.reach(page);

    const wrapper = page.getByTestId("s-auth-refusal");
    await expect(wrapper, `${probe.what} answers with a refusal`).toBeVisible();
    const card = wrapper.getByTestId("refusal-state");
    await expect(card, `${probe.what} — the wrapper holds exactly one RefusalState, the single renderer (ARCH-02, B-17)`).toHaveCount(1);

    const code = (await card.getAttribute("data-code")) ?? "";
    const entry = registered(code, probe.what);
    const paint = SEVERITY_PAINT[entry.severity];
    const chrome = SURFACE_CHROME[entry.surface];

    const measured = await card.evaluate(
      (element, given) => {
        const probeElement = document.createElement("div");
        probeElement.style.position = "absolute";
        probeElement.style.visibility = "hidden";
        document.body.append(probeElement);
        const lengthOf = (token: string): number => {
          probeElement.style.width = `var(${token})`;
          return Number.parseFloat(getComputedStyle(probeElement).width);
        };
        const colourOf = (token: string): string => {
          probeElement.style.color = `var(${token})`;
          return getComputedStyle(probeElement).color;
        };

        const style = getComputedStyle(element);
        const viewport = document.documentElement.clientWidth;
        const spaceEight = lengthOf("--space-8");
        const out = {
          invariant: {
            display: style.display,
            flexDirection: style.flexDirection,
            rowGap: style.rowGap,
            borderBlockStartWidth: style.borderBlockStartWidth,
            borderBlockEndWidth: style.borderBlockEndWidth,
            borderBlockStartStyle: style.borderBlockStartStyle,
            borderBlockEndStyle: style.borderBlockEndStyle,
            paddingBlockStart: style.paddingBlockStart,
            paddingBlockEnd: style.paddingBlockEnd,
          } as Record<string, string>,
          radiusPx: Number.parseFloat(style.borderTopLeftRadius),
          paddingInlinePx: Number.parseFloat(style.paddingInlineStart),
          paddingInlineEndPx: Number.parseFloat(style.paddingInlineEnd),
          inlineBorderPx: Number.parseFloat(style.borderInlineStartWidth),
          inlineBorderEndPx: Number.parseFloat(style.borderInlineEndWidth),
          edgeColour: style.borderBlockStartColor,
          fillColour: style.backgroundColor,
          // Two readings of the same surface, each answering the question it can answer.
          // `innerText` is what the browser shows a person — it drops what is clipped, collapsed
          // or hidden — so it is the honest instrument for "the message and the remedy are
          // visible". It is the wrong instrument for AC-3's "appears in no rendered text node":
          // a `visibility: hidden` or sr-only chip still occupies the render tree and is still
          // announced inside `role="alert"`, yet `innerText` omits it. `textContent` is a
          // superset of the rendered text nodes, so absence from it entails the clause with no
          // false passes — and it is the same strict reading the jsdom sibling already encodes.
          codeChips: document.querySelectorAll('[data-testid="refusal-code"]').length,
          pageText: document.body.innerText,
          allText: document.body.textContent ?? "",
          expectedEdge: colourOf(given.edge),
          expectedFill: colourOf(given.fill),
          expectedRadiusPx: given.radius === null ? 0 : lengthOf(given.radius),
          expectedPaddingInlinePx: lengthOf(given.paddingInline),
          blockPaddingPx: lengthOf("--space-3"),
          gapPx: lengthOf("--space-1"),
          expectedWidthPx: Math.min(given.columnPx, viewport - spaceEight),
          inlineStyle: element.getAttribute("style"),
          classes: element.getAttribute("class") ?? "",
        };
        probeElement.remove();
        return out;
      },
      { edge: paint.edge, fill: paint.fill, radius: chrome.radius, paddingInline: chrome.paddingInline, columnPx: probe.columnPx },
    );

    const box = await card.boundingBox();
    expect(box, `${probe.what} — the card is laid out, so it can be measured`).not.toBeNull();

    // The block padding and inline padding of a card are symmetric by the Decision's own shorthand;
    // reading both ends and asserting them here keeps the single values below honest.
    expect(measured.paddingInlineEndPx, `${probe.what} — the card's inline padding is symmetric`).toBe(measured.paddingInlinePx);
    expect(measured.inlineBorderEndPx, `${probe.what} — the card's inline borders are symmetric`).toBe(measured.inlineBorderPx);
    expect(measured.expectedEdge, `${probe.what} — the ${paint.edge} token resolves in the document`).not.toBe("");
    expect(measured.expectedFill, `${probe.what} — the ${paint.fill} token resolves in the document`).not.toBe("");

    cards.push({
      what: probe.what,
      route: probe.route,
      columnPx: probe.columnPx,
      code,
      severity: (await card.getAttribute("data-severity")) ?? "",
      surface: (await card.getAttribute("data-surface")) ?? "",
      invariant: measured.invariant,
      radiusPx: measured.radiusPx,
      // The expectations are resolved in the document that painted the card, so the assertions
      // below grade it against the Decision's tokens rather than against the neighbouring card.
      expectedRadiusPx: measured.expectedRadiusPx,
      paddingInlinePx: measured.paddingInlinePx,
      expectedPaddingInlinePx: measured.expectedPaddingInlinePx,
      inlineBorderPx: measured.inlineBorderPx,
      edgeColour: measured.edgeColour,
      fillColour: measured.fillColour,
      pageText: measured.pageText,
      allText: measured.allText,
      codeChips: measured.codeChips,
      expectedEdge: measured.expectedEdge,
      expectedFill: measured.expectedFill,
      widthPx: box?.width ?? -1,
      expectedWidthPx: measured.expectedWidthPx,
      inlineStyle: measured.inlineStyle,
      classes: measured.classes,
      blockPaddingPx: measured.blockPaddingPx,
      gapPx: measured.gapPx,
    });

    await context.close();
  }
});

/**
 * Every shipped `.css` or `.tsx` under `src/`, so a second dialect of the card cannot hide in one.
 * Suites that sit beside their module are not shipped chrome and are not searched.
 */
function sourceFiles(extension: string): string[] {
  const root = join(process.cwd(), "src");
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(extension) && !name.includes(".test."))
    .map((name) => join("src", name))
    .sort();
}

test.describe("J-001 S-AUTH-BREAKER — every refusal is the one card, and its only deltas are the ones the law prescribes", () => {
  test("S-AUTH-BREAKER: the probes really cover two surfaces and two severities", () => {
    expect(cards.length, "both probes reached a painted refusal").toBe(PROBES.length);
    for (const card of cards) {
      const entry = registered(card.code, card.what);
      expect(card.severity, `${card.what} — the card reflects its registered severity`).toBe(entry.severity);
      expect(card.surface, `${card.what} — the card reflects its registered surface hint (Decision I-8)`).toBe(entry.surface);
    }
    // Without this, every cross-surface assertion below could pass by comparing a thing to itself.
    expect(new Set(cards.map((card) => card.surface)).size, "the two probes are two different surfaces, so the comparison is not a card against itself").toBe(2);
    expect(new Set(cards.map((card) => card.severity)).size, "the two probes are two different severities, so the paint assertions can discriminate").toBe(2);
  });

  test("S-AUTH-BREAKER: every refusal surface renders the one renderer, from the one stylesheet", () => {
    const renderers = sourceFiles(".tsx").filter((file) => readFileSync(join(process.cwd(), file), "utf8").includes(CARD_STEM));
    expect(renderers, `only the pattern's own component renders the card's markup — one home for the refusal (ARCH-02, B-17)`).toEqual([
      join(PATTERN_DIR, "refusal-state.tsx"),
    ]);

    const stylesheets = sourceFiles(".css").filter((file) => readFileSync(join(process.cwd(), file), "utf8").includes(`.${CARD_STEM}`));
    expect(stylesheets, "the card's rules have one home — no screen and no surface re-declares them").toEqual([PATTERN_STYLESHEET]);

    // AC-3: the code is not copy, so nothing paints it — the chip's class carries no rule anywhere,
    // its severity colour rows included (B-20 re-baseline of the Decision's typography table).
    const paintsTheCode = sourceFiles(".css").filter((file) => readFileSync(join(process.cwd(), file), "utf8").includes(`.${CARD_STEM}-code`));
    expect(paintsTheCode, `no shipped stylesheet dresses .${CARD_STEM}-code — the element it painted is gone`).toEqual([]);

    for (const card of cards) {
      expect(card.classes.split(/\s+/), `${card.what} — the painted element is the pattern's card`).toContain(CARD_STEM);
      expect(card.inlineStyle, `${card.what} — the card wears no inline style, which would be an override no stylesheet can be grepped for`).toBeNull();
    }
  });

  test("S-AUTH-BREAKER: the chrome the law holds constant is identical across surfaces", () => {
    const [first, ...rest] = cards;
    expect(first, "a first card to compare against").toBeDefined();
    for (const card of rest) {
      expect(card.invariant, `${card.what} wears the same card chrome as ${first?.what} — the hairline block border, the block padding and the column flow are the pattern's, not the screen's`).toEqual(
        first?.invariant,
      );
      expect(card.edgeColour === card.fillColour, `${card.what} — the border and the fill are the severity's pair, never one flat colour`).toBe(false);
    }
    for (const card of cards) {
      expect(Number.parseFloat(card.invariant["borderBlockStartWidth"] ?? ""), `${card.what} — the block border is the instrument's hairline`).toBe(HAIRLINE_PX);
      expect(Number.parseFloat(card.invariant["paddingBlockStart"] ?? ""), `${card.what} — the block padding is the Decision's --space-3`).toBe(card.blockPaddingPx);
      expect(card.invariant["display"], `${card.what} — the card is the Decision's column`).toBe("flex");
      expect(card.invariant["flexDirection"], `${card.what} — the card is the Decision's column`).toBe("column");
      expect(Number.parseFloat(card.invariant["rowGap"] ?? ""), `${card.what} — the parts sit at the Decision's --space-1`).toBe(card.gapPx);
    }
  });

  test("S-AUTH-BREAKER: severity paint is the registered severity's pair, never the neighbour's", () => {
    for (const severity of new Set(Object.values(REFUSALS).map((entry) => entry.severity))) {
      expect(Object.hasOwn(SEVERITY_PAINT, severity), `the severity "${severity}" has a paint row in the Decision's table`).toBe(true);
    }
    for (const card of cards) {
      const paint = SEVERITY_PAINT[card.severity as RefusalSeverity];
      expect(card.edgeColour, `${card.what} — the border is ${paint.edge}, the colour its registered severity pairs with`).toBe(card.expectedEdge);
      expect(card.fillColour, `${card.what} — the fill is ${paint.fill}, the tint its registered severity pairs with`).toBe(card.expectedFill);
      // The other card's paint is the wrong answer for this one: severity paints, it does not mean,
      // and two severities that painted alike would be the finding this file replaces, inverted.
      for (const other of cards.filter((c) => c.severity !== card.severity)) {
        expect(card.edgeColour, `${card.what} does not wear ${other.what}'s paint — different severities are allowed to differ (R-SPINE-062, R-UI-060)`).not.toBe(other.edgeColour);
      }
    }
  });

  test("S-AUTH-BREAKER: every refusal surface shows the register's message and remedy, and its code to nobody", () => {
    for (const card of cards) {
      const entry = registered(card.code, card.what);
      // R-SPINE-062: what a person is shown is what happened and what resolves it.
      expect(card.pageText, `${card.what} — the register's message is what the surface shows`).toContain(entry.message);
      expect(card.pageText, `${card.what} — and its remedy beside it`).toContain(entry.remedy);
      // The code is machine-readable and nothing else: it travels as `data-code`, which the probes
      // above read every card's identity from, and it is copy on no surface (AC-3, B-20 — this
      // file's own code-chip probes are re-baselined by exactly this assertion).
      expect(card.code, `${card.what} — the card still names its taxonomy code machine-readably`).not.toBe("");
      expect(card.codeChips, `${card.what} — no code chip element is rendered anywhere on the surface, painted or not`).toBe(0);
      // Read off `textContent`, not `innerText`: AC-3's words are "appears in no rendered text
      // node", and a hidden or sr-only chip is a rendered text node a screen reader announces.
      expect(
        card.allText.includes(card.code),
        `${card.what} — "${card.code}" appears in no text node ${card.route} renders, hidden ones included: a taxonomy code is an operator's handle, never a person's copy (R-SPINE-062)`,
      ).toBe(false);
    }
  });

  test("S-AUTH-BREAKER: each surface wears its prescribed silhouette and each screen its prescribed measure", () => {
    for (const card of cards) {
      const chrome = SURFACE_CHROME[card.surface as RefusalSurface];
      expect(card.radiusPx, `${card.what} — the ${card.surface} surface's corner is ${chrome.radius ?? "0"} (the RefusalState Decision's Surfaces table)`).toBe(card.expectedRadiusPx);
      expect(card.paddingInlinePx, `${card.what} — the ${card.surface} surface's inline padding is ${chrome.paddingInline}`).toBe(card.expectedPaddingInlinePx);
      expect(card.inlineBorderPx, `${card.what} — the ${card.surface} surface's inline border is the Decision's`).toBe(chrome.inlineBorder ? HAIRLINE_PX : 0);
      // Per surface, against the Decision — never as an equality between the two columns. The
      // narrow auth measure and the wide /sessions measure are both prescribed (s-auth § 1, § 2),
      // and levelling them is a change of design law, not a fix (B-20).
      expect(Math.round(card.widthPx), `${card.route} renders its refusal across the measure the Decision gives that screen (${card.columnPx} px)`).toBe(Math.round(card.expectedWidthPx));
    }
  });
});
