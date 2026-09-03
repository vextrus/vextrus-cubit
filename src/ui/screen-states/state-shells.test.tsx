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

    // A name is reached where it is CODE, and a shape is mentioned in three channels that render
    // nothing: prose in a docblock, a word inside a string literal, and rendered copy in JSX
    // children (`<p>Shape is gone</p>` is a sentence, not a call). Reading raw bytes would let any
    // of the three keep a deleted shape alive. An element name in a tag IS code, so a genuine
    // `<Shape />` still counts. The tree's one lexer answers all of this (B-17, Q-17), and it goes
    // red rather than quiet on a file it cannot decide; the fixture below grades the reading itself.
    const code = callers.map((file) => lexFile(file, readFileSync(file, "utf8")).code);

    const published = Object.keys(shells);
    expect(published.length).toBeGreaterThan(0);
    const uncalled = published.filter((name) => !code.some((text) => new RegExp(`\\b${name}\\b`).test(text)));
    expect(uncalled).toEqual([]);
  });

  /**
   * The roster above is only as sound as "reached where it is CODE", so the reading is graded on a
   * fixture rather than assumed (B-19): one name mentioned in all three non-rendering channels, one
   * rendered as an element beside it.
   */
  test("a shape named only in prose, a literal or rendered copy is not a caller; an element name is", () => {
    const fixture = [
      "/** GhostShape is named in this docblock and rendered nowhere. */",
      "export function Panel(): unknown {",
      '  const label = "GhostShape";',
      "  return (",
      "    <section aria-label={label}>",
      "      <p>GhostShape is gone</p>",
      "      <LiveShape />",
      "    </section>",
      "  );",
      "}",
      "",
    ].join("\n");
    const { code, comments, text } = lexFile("<fixture>/mentions.tsx", fixture);

    expect(code, "a name mentioned only in prose, a literal and rendered copy is not code").not.toMatch(/\bGhostShape\b/);
    expect(code, "an element name in a tag is code").toMatch(/\bLiveShape\b/);
    expect(comments.some((comment) => comment.includes("GhostShape")), "the docblock mention is read as a comment").toBe(true);
    expect(text, "the rendered copy is read as copy").toContain("GhostShape is gone");
  });
});
