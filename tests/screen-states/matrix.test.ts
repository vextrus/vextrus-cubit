// @vitest-environment jsdom
/**
 * Public acceptance for the seven-states matrix (R-UI-050, Q-14, B-19) — AC-1, AC-2, AC-3.
 *
 * Nothing here is a list of today's screens. The roster comes from this file's own filesystem walk
 * over `src/app`, written independently of `src/ui/screen-states/route-scan.ts` so that the two
 * agreeing means something: a screen added later joins the required set by existing, and its seven
 * missing declarations red this suite rather than waiting for a review note.
 *
 * The one thing spelled out verbatim is the seven state names, in R-UI-050's order — that clause is
 * the specification of the tuple, not a snapshot of what the tree happens to hold today.
 *
 * jsdom, because AC-3 mounts every declared state for real.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { STATE_NAMES, missingStates, screenStates } from "../../src/ui/screen-states";
import type { ScreenDeclaration, ScreenState, ScreenStateName, ScreenStatesMatrix } from "../../src/ui/screen-states";
import { routesOnDisk } from "../../src/ui/screen-states/route-scan";
import { SCREEN_STATE_ATTRIBUTE, SCREEN_STATE_TESTID, hasPerceivableContent, mountState, unmountAll, visibleText } from "./support/matrix-contract";

// The lane's root, which is the checkout — `import.meta.url` is not a file URL under jsdom.
const REPO_ROOT = process.cwd();
const APP_DIR = join(REPO_ROOT, "src", "app");

/** R-UI-050's seven, in the clause's own order. */
const R_UI_050_STATES = ["loading", "empty", "error", "refusal", "partial", "offline", "permission-denied"] as const;

/** Code point order — `localeCompare` is banned tree-wide (no-raw-intl) and is machine-dependent. */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/* ------------------------------------------------------- the acceptance's own roster (AC-1) */

/** A route-group segment — `(app)`, `(auth)` — contributes no path segment. */
const isGroup = (segment: string): boolean => segment.startsWith("(") && segment.endsWith(")");

/** The route key of a `page.tsx` reached through these directory segments below `src/app`. */
function routeKeyOf(segments: readonly string[]): string {
  const kept = segments.filter((segment) => !isGroup(segment));
  return kept.length === 0 ? "/" : `/${kept.join("/")}`;
}

/**
 * Every `page.tsx` under an app directory, as route keys — this suite's own walk, deliberately not
 * a call into the product's scanner. Recursive, so a screen nested at any depth is found.
 */
function scanRoutes(appDir: string): string[] {
  const found: string[] = [];
  const walk = (dir: string, segments: string[]): void => {
    for (const name of readdirSync(dir)) {
      const child = join(dir, name);
      if (statSync(child).isDirectory()) walk(child, [...segments, name]);
      else if (name === "page.tsx") found.push(routeKeyOf(segments));
    }
  };
  walk(appDir, []);
  return found.sort(byCodePoint);
}

/* ------------------------------------------------- totality, judged by the compiler (AC-2) */

/** A type-level assertion: the alias only instantiates when its argument is exactly `true`. */
type Assert<T extends true> = T;

/** Exactness in both directions — `[A] extends [B]` alone passes for `Record<string, …>` and `any`. */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** `ScreenStateName` is the seven, and only the seven. */
type NameUnionIsTheSeven = Assert<Equal<ScreenStateName, (typeof R_UI_050_STATES)[number]>>;

/** A declaration's key set is exactly the seven names — no extra key, no absent one. */
type DeclarationIsTotal = Assert<Equal<keyof ScreenDeclaration, ScreenStateName>>;

/** …and no state is optional: `Required` would change the type if one were. */
type NoStateIsOptional = Assert<Equal<Required<ScreenDeclaration>, ScreenDeclaration>>;

/** Every state of a declaration is a `ScreenState` — the thing AC-3 mounts. */
type StatesAreMountable = Assert<Equal<ScreenDeclaration[ScreenStateName], ScreenState>>;

/** …whose `render` is required, so no state can be declared as an empty stub. */
type RenderIsRequired = Assert<Equal<Required<ScreenState>, ScreenState>>;

/** The matrix is keyed by route, and a declaration is what it holds. */
type MatrixHoldsDeclarations = Assert<Equal<NonNullable<ScreenStatesMatrix[string]>, ScreenDeclaration>>;

const nameUnionIsTheSeven: NameUnionIsTheSeven = true;
const declarationIsTotal: DeclarationIsTotal = true;
const noStateIsOptional: NoStateIsOptional = true;
const statesAreMountable: StatesAreMountable = true;
const renderIsRequired: RenderIsRequired = true;
const matrixHoldsDeclarations: MatrixHoldsDeclarations = true;

/* --------------------------------------------------------------------------------- helpers */

/** The matrix with exactly one state of one screen removed — the probe AC-2 asks for. */
function matrixWithout(route: string, state: ScreenStateName): ScreenStatesMatrix {
  const declaration = screenStates[route];
  expect(declaration, `${route} is declared, so a state can be removed from it`).toBeDefined();
  const stripped: Record<string, unknown> = { ...(declaration as unknown as Record<string, unknown>) };
  delete stripped[state];
  return { ...screenStates, [route]: stripped } as unknown as ScreenStatesMatrix;
}

/** Every `"<route>/<state>"` a roster owes, code-point sorted. */
function everyOwedEntry(routes: readonly string[]): string[] {
  return routes.flatMap((route) => R_UI_050_STATES.map((state) => `${route}/${state}`)).sort(byCodePoint);
}

describe("AC-1: the roster is derived, and closed both ways", () => {
  test("AC-1: routesOnDisk() agrees with an independent scan of src/app, and is not empty", () => {
    expect(existsSync(APP_DIR), `${APP_DIR} is the app router this suite scans`).toBe(true);
    const own = scanRoutes(APP_DIR);
    expect(own.length, "src/app holds page.tsx screens for a scan to find").toBeGreaterThan(0);
    expect(routesOnDisk(), "the product's scan and this suite's own walk answer the same roster").toEqual(own);
  });

  test("AC-1: routesOnDisk accepts an explicit app directory", () => {
    expect(routesOnDisk(APP_DIR), "an explicit dir argument scans that dir").toEqual(scanRoutes(APP_DIR));
  });

  test("AC-1: route keys drop route-group segments, name the root page '/', and sort by code point", () => {
    const routes = routesOnDisk();
    expect(routes, "the order is Array#sort's own comparison, never a locale's").toEqual([...routes].sort(byCodePoint));
    expect(new Set(routes).size, "two page.tsx files cannot claim one route key").toBe(routes.length);
    for (const route of routes) {
      expect(route.startsWith("/"), `${route} begins at the root`).toBe(true);
      expect(
        route.split("/").some((segment) => isGroup(segment)),
        `${route} carries no (group) segment`,
      ).toBe(false);
    }
  });

  test("AC-1: screenStates' keys are exactly the routes on disk", () => {
    const routes = routesOnDisk();
    expect(Object.keys(screenStates).sort(byCodePoint), "a screen on disk owes a declaration, and no declaration names a route the tree lacks").toEqual(
      routes,
    );
  });
});

describe("AC-2: totality is mechanical, and the mechanism can go red", () => {
  test("AC-2: STATE_NAMES is R-UI-050's seven, in the clause's order", () => {
    expect([...STATE_NAMES]).toEqual([...R_UI_050_STATES]);
  });

  test("AC-2: the compiler judges ScreenDeclaration total over ScreenStateName", () => {
    // The proof is `tsc` instantiating the aliases above; this test consumes their witnesses so the
    // assertions cannot be deleted as unused.
    expect([nameUnionIsTheSeven, declarationIsTotal, noStateIsOptional, statesAreMountable, renderIsRequired, matrixHoldsDeclarations]).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  test("AC-2: every declaration holds all seven states at runtime too", () => {
    for (const [route, declaration] of Object.entries(screenStates)) {
      expect(Object.keys(declaration).sort(byCodePoint), `${route} declares the seven states and nothing else`).toEqual([...R_UI_050_STATES].sort(byCodePoint));
      for (const state of R_UI_050_STATES) {
        expect(typeof declaration[state].render, `${route}/${state} declares a render function`).toBe("function");
      }
    }
  });

  test("AC-2: missingStates() owes nothing on the shipped tree, with the matrix defaulted", () => {
    expect(missingStates(routesOnDisk(), screenStates), "a screen without its seven declarations fails here (R-UI-050)").toEqual([]);
    expect(missingStates(routesOnDisk()), "the matrix defaults to screenStates").toEqual([]);
  });

  test("AC-2: removing one state of one screen owes exactly that entry", () => {
    const routes = routesOnDisk();
    for (const [index, route] of routes.entries()) {
      const state = R_UI_050_STATES[index % R_UI_050_STATES.length] as ScreenStateName;
      expect(missingStates(routes, matrixWithout(route, state)), `a matrix lacking ${route}/${state} owes exactly it`).toEqual([`${route}/${state}`]);
    }
    const first = routes[0] as string;
    for (const state of R_UI_050_STATES) {
      expect(missingStates(routes, matrixWithout(first, state)), `a matrix lacking ${first}/${state} owes exactly it`).toEqual([`${first}/${state}`]);
    }
  });

  test("AC-2: an empty matrix owes every entry, sorted; an unasked route owes nothing", () => {
    const routes = routesOnDisk();
    expect(missingStates(routes, {}), "nothing declared means every route crossed with every state is owed").toEqual(everyOwedEntry(routes));
    expect(missingStates([], screenStates), "a roster that asks for no route is owed nothing").toEqual([]);
    const owed = missingStates(routes, {});
    expect(owed, "the report is code-point sorted").toEqual([...owed].sort(byCodePoint));
  });
});

describe("AC-3: every declared state mounts as real UI", () => {
  afterEach(() => {
    unmountAll();
  });

  /** Mount one state, grade everything AC-3 asks of it, and answer the copy it showed. */
  const mountAndGrade = (label: string, state: ScreenStateName, declaration: ScreenDeclaration): string => {
    const { root } = mountState(declaration[state].render());
    expect(root, `${label} mounts an element`).not.toBeNull();
    const element = root as Element;
    expect(element.getAttribute("data-testid"), `${label}: the root carries the contract's testid`).toBe(SCREEN_STATE_TESTID);
    expect(element.getAttribute(SCREEN_STATE_ATTRIBUTE), `${label}: data-state is the state's own name`).toBe(state);
    expect(hasPerceivableContent(element), `${label} renders text or an accessible name, not an empty box`).toBe(true);
    // Q-14: no placeholder UI. The reading is what a person is shown — an `<input placeholder>`
    // attribute is lawful HTML — so the ban is on the copy and on TODO/FIXME markers anywhere.
    expect(visibleText(element), `${label}: shipped copy, never a placeholder (Q-14)`).not.toMatch(/\b(?:TODO|FIXME|placeholder|lorem ipsum)\b/i);
    expect(element.outerHTML, `${label}: no TODO/FIXME marker in the markup (Q-14)`).not.toMatch(/\b(?:TODO|FIXME)\b/);
    return visibleText(element);
  };

  test("AC-3: each screen × state mounts to a rooted, perceivable, placeholder-free state", () => {
    const routes = routesOnDisk();
    expect(routes.length, "there is something to mount").toBeGreaterThan(0);
    for (const route of routes) {
      const declaration = screenStates[route];
      expect(declaration, `${route} is declared`).toBeDefined();
      for (const state of R_UI_050_STATES) {
        mountAndGrade(`${route}/${state}`, state, declaration as ScreenDeclaration);
        unmountAll();
      }
    }
  });

  test("AC-3: render() is callable per mount — a second mount answers the same state", () => {
    for (const [route, declaration] of Object.entries(screenStates)) {
      for (const state of R_UI_050_STATES) {
        // Both mounts are graded, so a state that renders once and then empties out reds here
        // rather than passing on the equality of two blanks.
        const firstText = mountAndGrade(`${route}/${state} (first mount)`, state, declaration);
        unmountAll();
        const secondText = mountAndGrade(`${route}/${state} (second mount)`, state, declaration);
        expect(secondText, `${route}/${state} renders the same state on a second mount (no module-level singleton)`).toBe(firstText);
        unmountAll();
      }
    }
  });
});
