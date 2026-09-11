// @vitest-environment jsdom
/**
 * The vendored icon set (Design Direction 00 §1 "Iconography", B-24, AM-08).
 *
 * Three things are worth proving about a set nobody maintains upstream for us. That it is ONE set:
 * every glyph the same box, the same stroke, `currentColor`, and no colour of its own. That it is
 * COMPLETE: every tool §3's templates name has a glyph, checked against the direction's own list
 * rather than against whatever happens to be exported. And that it is VENDORED: no icon package is
 * imported anywhere in the tree, which is the promise `lucide-react` not being installed rests on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import * as icons from "./index";
import { createIcon, type IconProps } from "./icon-base";

// The jsdom lane has no file-scheme `import.meta.url`, so the tree is reached from the lane's own
// root — which vitest sets to the repo root, where the manifest this suite also reads lives.
const REPO_ROOT = process.cwd();
const HERE = join(REPO_ROOT, "src/ui/icons");

type IconComponent = (props: IconProps) => unknown;

/** Every glyph the barrel publishes, by export name. */
const GLYPHS: readonly (readonly [string, IconComponent])[] = Object.entries(icons)
  .filter((entry): entry is [string, IconComponent] => entry[0].startsWith("Icon") && typeof entry[1] === "function")
  .sort((a, b) => (a[0] < b[0] ? -1 : 1));

/**
 * The toolbar and chrome glyphs Design Direction 00 §3 names, by the `data-icon` each must carry.
 * This list is the direction's, not the barrel's: an icon deleted from the set fails here.
 */
const REQUIRED = [
  "select", "pan", "linear", "area", "count", "snap", "ortho", "angle", "views", "grid", "fit",
  "zoom-in", "zoom-out", "layers", "inspector", "search", "copy", "chevron-down", "chevron-up",
  "chevron-left", "chevron-right", "check", "x", "alert", "info", "upload", "plus",
  "more-horizontal", "external-link", "sun", "moon", "user", "bell", "refresh",
] as const;

afterEach(cleanup);

describe("the vendored icon set", () => {
  test("every glyph is the same instrument: one 24 box, one 1.5 stroke, currentColor, no fill", () => {
    for (const [name, Glyph] of GLYPHS) {
      const { container } = render(<Glyph />);
      const svg = container.querySelector("svg");
      expect(svg, `${name} renders an svg`).not.toBeNull();
      expect(svg?.getAttribute("viewBox"), `${name} is traced in the set's box`).toBe("0 0 24 24");
      expect(svg?.getAttribute("stroke"), `${name} takes the ink of whatever names it`).toBe("currentColor");
      expect(svg?.getAttribute("stroke-width"), `${name} is drawn at the set's weight`).toBe("1.5");
      expect(svg?.getAttribute("fill")).toBe("none");
      cleanup();
    }
    expect(GLYPHS.length, "the set is not empty").toBeGreaterThanOrEqual(REQUIRED.length);
  });

  test("no glyph spells a colour: an icon has no colour of its own (R-UI-001)", () => {
    const source = readFileSync(join(HERE, "glyphs.tsx"), "utf8");
    expect(/#[0-9a-fA-F]{3,8}\b/.test(source), "a hex literal in the icon set would be a colour outside the token source").toBe(false);
    for (const [name, Glyph] of GLYPHS) {
      const { container } = render(<Glyph />);
      const painted = [...container.querySelectorAll("[fill]")].map((node) => node.getAttribute("fill"));
      for (const fill of painted) {
        expect(fill === "none" || fill === "currentColor", `${name} paints "${fill ?? ""}"`).toBe(true);
      }
      cleanup();
    }
  });

  test("a glyph is decorative until a consumer names it — then it is an image with that name", () => {
    const { container: silent } = render(<icons.IconFit />);
    expect(silent.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    cleanup();
    const { container: named } = render(<icons.IconFit title="Fit to sheet" />);
    expect(named.querySelector("svg")?.getAttribute("role")).toBe("img");
    expect(named.querySelector("svg")?.getAttribute("aria-label")).toBe("Fit to sheet");
    expect(named.querySelector("svg")?.hasAttribute("aria-hidden")).toBe(false);
  });

  test("the three sizes are the layout tokens' and nothing else is an icon size", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const { container } = render(<icons.IconFit size={size} />);
      expect(container.querySelector("svg")?.getAttribute("data-size")).toBe(size);
      cleanup();
    }
    const { container } = render(<icons.IconFit />);
    expect(container.querySelector("svg")?.getAttribute("data-size"), "16 px is the default — the toolbar's size").toBe("md");
  });

  test("every glyph §3's templates name is in the set", () => {
    const present = new Set(
      GLYPHS.map(([, Glyph]) => {
        const { container } = render(<Glyph />);
        const name = container.querySelector("svg")?.getAttribute("data-icon") ?? "";
        cleanup();
        return name;
      }),
    );
    const missing = REQUIRED.filter((name) => !present.has(name));
    expect(missing, `the templates of §3 name these tools and the set has no glyph for them: ${missing.join(", ")}`).toEqual([]);
  });

  test("the set is vendored: nothing in the tree imports an icon package (B-24, AM-08)", () => {
    const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const declared = { ...packageJson.dependencies, ...packageJson.devDependencies };
    for (const name of ["lucide-react", "lucide", "react-icons", "@heroicons/react", "feather-icons"]) {
      expect(Object.hasOwn(declared, name), `${name} is a runtime dependency — the set is vendored as source instead`).toBe(false);
    }
  });

  test("the licence and the provenance of the set are committed beside it", () => {
    const licence = readFileSync(join(HERE, "LICENSE-lucide.txt"), "utf8");
    expect(licence).toContain("ISC License");
    expect(licence, "the Feather copyright Lucide's own notice preserves").toContain("Cole Bemis");
    for (const [name] of GLYPHS) {
      expect(licence.includes(name), `${name}'s provenance is recorded`).toBe(true);
    }
  });

  test("the factory is what keeps them one set, so a new glyph cannot arrive with its own geometry", () => {
    const Made = createIcon("proof", <path d="M4 4h16" />) as IconComponent;
    const { container } = render(<Made />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("data-icon")).toBe("proof");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
  });
});
