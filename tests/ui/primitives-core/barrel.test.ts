// @vitest-environment jsdom
/**
 * AC-1 — the barrel's declared surface, both themes, and the token discipline of everything under
 * src/ui/primitives/core (R-UI-010, R-UI-001, B-17).
 *
 * No JSX is written here: elements are built through `React.createElement` in the support module,
 * so this file collects under the existing unit lane whatever the config does with `.tsx`.
 */
import { afterEach, describe, expect, test } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  BARREL,
  CORE_DIR,
  CORE_EXPORTS,
  COLOURLESS_VALUES,
  COLOUR_PROPERTIES,
  colourLiteralHits,
  coreStylesheets,
  cssRules,
  declarations,
  declaredCustomProperties,
  loadBarrel,
  readRepoFile,
  requireCoreFiles,
  tokenNames,
  varRefs,
} from "./support/primitives";
import { composition, mount, sampleElement, themed } from "./support/render";

afterEach(() => {
  cleanup();
});

describe("AC-1: the core primitive barrel", () => {
  test("AC-1: exports exactly the eleven primitives this increment declares", async () => {
    const mod = await loadBarrel();
    const exported = Object.keys(mod)
      .filter((name) => name !== "default" && name !== "__esModule")
      .sort();
    expect(
      exported,
      `${BARREL} must export exactly the eleven primitives of this increment's interfaces line — nothing more (internals such as the glyph table stay in their own home, B-17), nothing less`,
    ).toEqual([...CORE_EXPORTS]);
  });

  test("AC-1: every export is a component that renders in the default theme and under [data-theme=\"dark\"]", async () => {
    const mod = await loadBarrel();
    for (const name of Object.keys(mod).filter((n) => n !== "default" && n !== "__esModule")) {
      expect(typeof mod[name], `${BARREL} exports \`${name}\`, which is not a component`).toBe("function");
      const light = mount(sampleElement(mod, name));
      expect(light.childElementCount, `${name} rendered nothing in the default theme`).toBeGreaterThan(0);
      const dark = mount(themed(sampleElement(mod, name)));
      expect(
        dark.querySelector('[data-theme="dark"]')?.childElementCount ?? 0,
        `${name} rendered nothing inside a [data-theme="dark"] ancestor`,
      ).toBeGreaterThan(0);
      cleanup();
    }
  });

  test("AC-1: the whole composition renders in both themes without throwing", async () => {
    const mod = await loadBarrel();
    expect(() => mount(composition(mod))).not.toThrow();
    cleanup();
    expect(() => mount(themed(composition(mod)))).not.toThrow();
  });
});

describe("AC-1: styling values under src/ui/primitives/core are token reads (R-UI-001)", () => {
  test("AC-1: the slice ships at least a barrel, a stylesheet and the reticle's home", () => {
    expect(requireCoreFiles().length, `${CORE_DIR} ships no files`).toBeGreaterThan(0);
    expect(coreStylesheets().length, `${CORE_DIR} declares no stylesheet, so nothing is styled on the Datum tokens`).toBeGreaterThan(0);
  });

  test("AC-1: no file under src/ui/primitives/core spells a colour literal", () => {
    const offenders: string[] = [];
    for (const file of requireCoreFiles()) {
      if (!/\.(css|ts|tsx|mts)$/.test(file)) continue;
      const hits = colourLiteralHits(readRepoFile(file));
      if (hits.length > 0) offenders.push(`${file}: ${hits.join(", ")}`);
    }
    expect(
      offenders,
      "R-UI-001: colour literals exist only in src/ui/tokens.ts and its generated stylesheet; every primitive reads var(--…)",
    ).toEqual([]);
  });

  test("AC-1: every colour-bearing declaration reads a token", () => {
    const offenders: string[] = [];
    for (const file of coreStylesheets()) {
      for (const rule of cssRules(readRepoFile(file))) {
        for (const { prop, value } of declarations(rule.body)) {
          if (prop.startsWith("--")) continue;
          if (!COLOUR_PROPERTIES.includes(prop)) continue;
          if (value.includes("var(--")) continue;
          if (COLOURLESS_VALUES.includes(value.toLowerCase())) continue;
          offenders.push(`${file} { ${rule.selector} } ${prop}: ${value}`);
        }
      }
    }
    expect(
      offenders,
      "every colour a primitive paints is a var(--…) read into the committed token source (R-UI-001)",
    ).toEqual([]);
  });

  test("AC-1: every var(--…) a primitive reads is a committed token", () => {
    const tokens = tokenNames();
    expect(tokens.size, "src/ui/tokens.css declares no custom properties — the token source is not where it is expected").toBeGreaterThan(0);
    const unknown: string[] = [];
    for (const file of requireCoreFiles()) {
      if (!/\.(css|ts|tsx|mts)$/.test(file)) continue;
      const text = readRepoFile(file);
      const local = new Set(declaredCustomProperties(text));
      for (const name of varRefs(text)) {
        if (tokens.has(name) || local.has(name)) continue;
        unknown.push(`${file}: var(${name})`);
      }
    }
    expect(
      unknown,
      "a primitive reads a custom property that the committed token source does not define — an invented token paints nothing (R-UI-001)",
    ).toEqual([]);
  });

  test("AC-1: no primitive stylesheet branches on the theme — the tokens flip, the rules do not", () => {
    const branching: string[] = [];
    for (const file of coreStylesheets()) {
      for (const rule of cssRules(readRepoFile(file))) {
        if (rule.selector.includes("data-theme")) branching.push(`${file} { ${rule.selector} }`);
      }
    }
    expect(
      branching,
      "R-UI-001: every difference between light and dark arrives through token values, never through a theme-conditional rule in a primitive",
    ).toEqual([]);
  });
});
