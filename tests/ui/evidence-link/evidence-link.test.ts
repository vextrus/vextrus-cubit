/**
 * AC-1 — the EvidenceLink pattern and its catalogue entry (R-UI-002, R-UI-011, R-UI-022, B-19).
 *
 * Every expectation here is DERIVED from R-UI-002's own glyph table: the roster is read off
 * `src/ui/primitives/core/basis.ts`, so a basis added to the clause spreads the anatomy, the theme
 * pass and the gallery's states over it without a line of this file changing. Nothing is a frozen
 * list of seven.
 *
 * @vitest-environment jsdom
 */
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { TESTIDS, testIdSelector } from "../../../src/ui/testids";
import {
  EVIDENCE_LINK_BARREL,
  SAMPLE_HREF,
  SAMPLE_LABEL,
  basisGlyphs,
  gallerySeam,
  mountLink,
  stringTable,
  stylesheetText,
  text,
} from "./support/evidence-link-support";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe("AC-1: the link", () => {
  test("AC-1: renders the contract's anatomy for every basis R-UI-002 declares", async () => {
    const glyphs = await basisGlyphs();
    const bases = Object.keys(glyphs);
    expect(bases.length, "R-UI-002's glyph table declares the bases this pattern is spread over").toBeGreaterThan(0);

    for (const basis of bases) {
      const href = `${SAMPLE_HREF}?basis=${basis}`;
      const anchor = await mountLink({ href, basis, label: SAMPLE_LABEL });

      expect(anchor.tagName, `${basis}: the link is an anchor — a place, never a door (Decision I-178)`).toBe("A");
      expect(anchor.getAttribute("href"), `${basis}: the anchor's href is the \`href\` prop, verbatim`).toBe(href);
      expect(anchor.getAttribute("data-basis"), `${basis}: the anchor carries \`data-basis\` (test contract)`).toBe(basis);
      expect([...anchor.classList].sort(), `${basis}: the anchor carries exactly \`cx-evidence-link cx-reticle\` — the focus ring from the reticle's one home (B-17)`).toEqual(["cx-evidence-link", "cx-reticle"]);

      const glyph = anchor.querySelector(testIdSelector(TESTIDS.evidence.linkGlyph));
      expect(glyph, `${basis}: the anchor holds \`evidence-link-glyph\` (test contract)`).not.toBeNull();
      expect((glyph as HTMLElement).getAttribute("aria-hidden"), `${basis}: the glyph is the colour's greyscale twin, not a second announcement`).toBe("true");
      expect(text(glyph), `${basis}: the glyph is BASIS_GLYPHS[${basis}], read from its single home`).toBe(glyphs[basis]);

      expect(anchor.textContent ?? "", `${basis}: the label is visible beside the glyph, whole (I-26)`).toContain(SAMPLE_LABEL);
      expect(text(anchor).replace(/\s+/g, ""), `${basis}: the anchor reads as the glyph then the label and nothing else`).toBe(`${glyphs[basis]}${SAMPLE_LABEL}`);

      cleanup();
      document.body.replaceChildren();
    }
  });

  test("AC-1: the anchor states its purpose from the one string table", async () => {
    const strings = await stringTable();
    const title = strings["evidence_link_title"];
    expect(typeof title, "`evidence_link_title` is registered in the one string barrel (interfaces, Decision §3)").toBe("string");

    const glyphs = await basisGlyphs();
    const basis = Object.keys(glyphs)[0] as string;
    const anchor = await mountLink({ href: SAMPLE_HREF, basis, label: SAMPLE_LABEL });
    expect(anchor.getAttribute("title"), "the anchor's title is `evidence_link_title` — the purpose, on hover (Decision §3)").toBe(title);
  });

  test("AC-1: rest props reach the anchor, so a consumer may mark its own row", async () => {
    const glyphs = await basisGlyphs();
    const basis = Object.keys(glyphs)[0] as string;
    const anchor = await mountLink({ href: SAMPLE_HREF, basis, label: SAMPLE_LABEL, "data-line": "line-C1", "data-origin": "true", "aria-current": "true" });

    expect(anchor.getAttribute("data-line"), "`data-line` spreads onto the anchor (interfaces: rest props)").toBe("line-C1");
    expect(anchor.getAttribute("data-origin"), "`data-origin` spreads onto the anchor (interfaces: rest props)").toBe("true");
    expect(anchor.getAttribute("aria-current"), "`aria-current` spreads onto the anchor (Decision §1)").toBe("true");
    expect(anchor.getAttribute("data-testid"), "and a caller may not re-id the element (Decision §1)").toBe("evidence-link");
  });

  test("AC-1: the anatomy holds under a dark ancestor as it holds in light", async () => {
    const glyphs = await basisGlyphs();
    for (const theme of ["light", "dark"]) {
      for (const basis of Object.keys(glyphs)) {
        const anchor = await mountLink({ href: SAMPLE_HREF, basis, label: SAMPLE_LABEL }, theme);
        expect(anchor.getAttribute("data-basis"), `${theme}/${basis}: the basis is carried by data, so the theme changes no markup (Decision §6)`).toBe(basis);
        expect(text(anchor.querySelector(testIdSelector(TESTIDS.evidence.linkGlyph))), `${theme}/${basis}: the glyph survives greyscale in both themes (R-UI-002)`).toBe(glyphs[basis]);
        cleanup();
        document.body.replaceChildren();
      }
    }
  });

  test("AC-1: colour is spent only through the basis tokens", async () => {
    const glyphs = await basisGlyphs();
    // white-box: AC-1 — "coloured only through var(--basis-<basis lowercased>)" and Decision §6's "no
    // [data-theme] selector, no hex" are properties of the authored stylesheet TEXT: jsdom performs no
    // cascade over an imported sheet, so there is no computed value to read. The precedent is
    // primitives-core's own suite (Decision §7: "the stylesheet facts as authored CSS text").
    const css = stylesheetText();

    for (const basis of Object.keys(glyphs)) {
      expect(css, `the ${basis} rule reaches its colour through \`var(--basis-${basis.toLowerCase()})\``).toContain(`var(--basis-${basis.toLowerCase()})`);
    }
    expect(css.match(/#[0-9a-fA-F]{3,8}\b/g), "no hex: every colour is a token (Decision §5)").toBeNull();
    expect(css.includes("[data-theme"), "no `[data-theme]` selector: the themes differ by token value alone (Decision §6)").toBe(false);
  });
});

describe("AC-1: the catalogue", () => {
  test("AC-1: the gallery catalogues the pattern, one state per basis, and owes nothing", async () => {
    const { galleryBarrels, galleryEntries, missingEntries, componentExports } = await gallerySeam();
    const glyphs = await basisGlyphs();

    const barrel = galleryBarrels[EVIDENCE_LINK_BARREL];
    expect(barrel, `\`galleryBarrels\` holds \`${EVIDENCE_LINK_BARREL}\` — a component joins the gallery by existing (R-UI-011)`).toBeTypeOf("object");

    const exported = componentExports(barrel as Record<string, unknown>);
    expect(exported, "the barrel publishes `EvidenceLink` as a mountable component").toContain("EvidenceLink");

    // One entry per component export, compelled rather than listed (Decision §7).
    for (const name of exported) {
      const key = `${EVIDENCE_LINK_BARREL}/${name}`;
      const entry = galleryEntries[key];
      expect(entry, `the catalogue holds \`${key}\``).toBeTypeOf("object");

      const stateNames = (entry as { states: readonly { name: string }[] }).states.map((state) => state.name);
      expect(stateNames, `\`${key}\` renders one state per basis, named by the basis verbatim and derived from BASIS_GLYPHS (B-19)`).toEqual(Object.keys(glyphs));
      for (const state of (entry as { states: readonly { render: () => unknown }[] }).states) {
        expect(typeof state.render, `every state of \`${key}\` is mountable`).toBe("function");
      }
    }

    expect(missingEntries(), "`missingEntries()` is empty — the catalogue owes nothing (R-UI-011)").toEqual([]);
  });
});
