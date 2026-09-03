// @vitest-environment jsdom
/**
 * The shapes a state is rendered in: an in-screen state heads below the screen's own title, and the
 * module publishes no shape no declaration can reach (R-UI-050, R-UI-060, B-17).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { lexFile } from "../../../tests/support/source-lex";
import * as shells from "./state-shells";
import { EmptyTeaching, FaultCard } from "./state-shells";

const HEADINGS = "h1, h2, h3, h4, h5, h6";

/** Every `.ts`/`.tsx` under a directory, recursively — the tree a caller could live in. */
function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const child = join(dir, name);
    if (statSync(child).isDirectory()) return sourcesUnder(child);
    return /\.tsx?$/.test(child) ? [child] : [];
  });
}

afterEach(() => {
  cleanup();
});

describe("FaultCard", () => {
  test("heads at the level its in-screen siblings head at", () => {
    const teaching = render(<EmptyTeaching heading="Nothing here" body="Add the first one." action="Add" />);
    const sibling = teaching.container.querySelector(HEADINGS)?.tagName;
    cleanup();

    const { container } = render(<FaultCard body="Something went wrong." />);
    expect(container.querySelector(HEADINGS)?.tagName).toBe(sibling);
  });

  test("names its own alert region by that heading", () => {
    const { container } = render(<FaultCard body="Something went wrong." />);
    const id = container.querySelector(HEADINGS)?.getAttribute("id");
    expect(id).toBeTruthy();
    expect(container.querySelector(`section[role="alert"][aria-labelledby="${id ?? ""}"]`)).not.toBeNull();
  });

  test("two cards on one document name themselves apart", () => {
    const { container } = render(
      <>
        <FaultCard body="One." />
        <FaultCard body="Two." />
      </>,
    );
    const ids = [...container.querySelectorAll(HEADINGS)].map((heading) => heading.getAttribute("id"));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the module's published shapes", () => {
  test("every shape it publishes has a caller: a shape nothing can render is dead code", () => {
    const here = fileURLToPath(import.meta.url);
    const mine = join(dirname(here), "state-shells.tsx");
    // The whole layered tree, not this folder alone: a screen's own declaration lives under
    // `src/app/**/states.ts`, so a roster bounded at `src/ui` would call a shape dead that an app
    // screen renders — and would miss one that only src/ still reaches (B-19).
    const callers = sourcesUnder(resolve(dirname(here), "..", "..")).filter((file) => file !== mine && file !== here);
    expect(callers.length).toBeGreaterThan(0);

    // A name is reached where it is CODE. Prose in a docblock and a word inside a string literal
    // mention a shape; neither renders it, and reading raw bytes would let the module's own
    // enumerating comment keep a deleted shape alive. The tree's one lexer answers what is code
    // (B-17, Q-17), and it goes red rather than quiet on a file it cannot decide.
    const code = callers.map((file) => lexFile(file, readFileSync(file, "utf8")).code);

    const published = Object.keys(shells);
    expect(published.length).toBeGreaterThan(0);
    const uncalled = published.filter((name) => !code.some((text) => new RegExp(`\\b${name}\\b`).test(text)));
    expect(uncalled).toEqual([]);
  });
});
