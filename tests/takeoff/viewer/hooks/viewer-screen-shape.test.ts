// @vitest-environment jsdom
/**
 * AC-1 — what is left of the viewer screen once every concern is a hook: a file under the cap, with
 * no effect of its own, composing hook modules it imports from `src/modules/takeoff/viewer/hooks/`,
 * still exporting `ViewerScreen` and still taking the props the route hands it.
 *
 * Two of the three readings are properties of the file's own text — how many lines it is, and whether
 * it calls `useEffect` — which no rendering of the screen can show, so they are read through
 * `sourceOf`/`codeOf`/`importsOf` (the criterion names that seam) and each is marked as the
 * white-box reading it is. The third is behaviour: the screen is mounted over an absence and still
 * renders itself.
 */
import { existsSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { createElement, type FunctionComponent } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { codeOf, importsOf, sourceOf } from "../../../app/support/source-facts";
import { VIEWER_SCREEN_MODULE, productModule } from "../support/viewer-support";
import { effectCalls } from "./source-shape";
import type { ViewerScreenProps } from "../../../../src/app/(app)/t/[tenant]/p/[project]/viewer/[drawing]/[layout]/viewer-screen";

/** AC-1's cap: the physical lines the screen may still be, newlines counted and comments included. */
const LINE_CAP = 250;

/** The home every effect the screen used to run now lives in (AC-2's directory). */
const HOOKS_HOME = "src/modules/takeoff/viewer/hooks";


/**
 * The props the route hands the screen. The value is AC-1's "unchanged `ViewerScreenProps`" half:
 * `tests/**\/*.ts` is typechecked by the tree's own `tsc`, so a member renamed, dropped or retyped by
 * the split reds here before any assertion runs — and the same value is what the screen is mounted
 * over below, so it is a claim about the running component and not only about its types.
 */
const ROUTE_PROPS: ViewerScreenProps = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  drawingId: "33333333-3333-4333-8333-333333333333",
  layoutName: "SHEET ONE",
  initialViewport: null,
  initialSelection: null,
};

afterEach(() => {
  cleanup();
});

describe("AC-1: the screen composes hooks and runs no effect of its own", () => {
  test("AC-1: viewer-screen.tsx is under the line cap, calls no useEffect, and still renders from the route's props", async () => {
    // white-box: AC-1 — two of the three readings are properties of the screen's own text (how long
    // it is, and that it spells no `useEffect(` call); a rendered screen cannot answer either.
    const lines = sourceOf(VIEWER_SCREEN_MODULE).split("\n").length;
    expect(lines, `the screen composes its hooks in fewer than ${LINE_CAP} physical lines`).toBeLessThan(LINE_CAP);

    // The rule is "no call to React's effect", not "no call spelled `useEffect(`": the binding the
    // file itself gives that effect is derived from its imports, so an alias is judged as what it is.
    // The code mask blanks comments and literals, so a sentence about effects is not a call to one.
    const effects = effectCalls(VIEWER_SCREEN_MODULE);
    expect(effects, "every effect lives in a hook module, so the screen itself calls none").toEqual([]);

    const { ViewerScreen } = await productModule<{ ViewerScreen: FunctionComponent<ViewerScreenProps> }>(VIEWER_SCREEN_MODULE);
    expect(typeof ViewerScreen, "viewer-screen.tsx exports ViewerScreen").toBe("function");

    // An absence is the one head that needs neither a feed nor a canvas: the screen renders itself
    // out of exactly the props the route hands it, which is what "unchanged props" means at runtime.
    render(createElement(ViewerScreen, { ...ROUTE_PROPS, head: { kind: "absent", reason: "not-ingested" } }));
    expect(screen.getByTestId("viewer-screen"), "the composed screen still renders itself").toBeDefined();
  });

  test("AC-1: the effects moved into hook modules the screen imports and calls", () => {
    // white-box: AC-1 — "the screen imports and composes the hook modules" is a statement about the
    // file's import graph and the names it calls, which is text about the file rather than output.
    const source = codeOf(VIEWER_SCREEN_MODULE);
    const screenDirectory = dirname(resolve(process.cwd(), VIEWER_SCREEN_MODULE));
    const fromHooks = importsOf(VIEWER_SCREEN_MODULE).filter((line) => line.specifier.includes("/viewer/hooks/"));

    expect(fromHooks.length, `the screen imports its effects from ${HOOKS_HOME}/`).toBeGreaterThan(0);

    for (const line of fromHooks) {
      const module = resolve(screenDirectory, `${line.specifier}.ts`);
      expect(existsSync(module), `${line.specifier} names a module under ${HOOKS_HOME}/`).toBe(true);
      expect(
        module.replace(/\\/g, "/").includes(`/${HOOKS_HOME}/`),
        `${line.specifier} resolves inside ${HOOKS_HOME}/ — the one home the effects moved to`,
      ).toBe(true);

      const called = line.names.filter((name) => new RegExp(`\\b${name}\\s*\\(`).test(source));
      expect(called.length, `the screen composes what it imports from ${basename(line.specifier)}: ${line.names.join(", ")}`).toBeGreaterThan(0);
    }
  });
});
