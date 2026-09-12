/**
 * The stage the EvidenceLink pattern is judged over (inc-215-trace, AC-1).
 *
 * Everything here reaches the product through the names the increment's interfaces, its test
 * contract and `docs/design/evidence-link.md` publish: the barrel `src/ui/patterns/evidence-link`,
 * the glyph table's single home `src/ui/primitives/core/basis.ts`, and the gallery's derivation
 * surface. Nothing is transcribed — the basis roster is READ, so a basis added to R-UI-002's table
 * spreads every expectation below over it (B-19).
 *
 * `.ts`, not `.tsx`: tsconfig typechecks `tests/**\/*.ts`, so the tree is built with `createElement`
 * exactly as `tests/ui/takeoff-register/support/fixtures.ts` builds one.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { createElement, type FunctionComponent } from "react";
import { expect } from "vitest";
import { REPO_ROOT, productModule } from "../../../server/support/wire";
import { TESTIDS, testIdSelector } from "../../../../src/ui/testids";

/** The pattern's barrel — the one home of `EvidenceLink` (interfaces, Decision §0). */
export const EVIDENCE_LINK_MODULE = "src/ui/patterns/evidence-link/index.ts";

/** The pattern's authored stylesheet, beside the barrel (Decision §0, §1). */
export const EVIDENCE_LINK_CSS = "src/ui/patterns/evidence-link/evidence-link.css";

/** R-UI-002's glyph table, in its single home (Decision §0: "the glyph table solely from"). */
export const BASIS_MODULE = "src/ui/primitives/core/basis.ts";

/** The gallery's completeness surface (test contract: `missingEntries`, `galleryBarrels`, `galleryEntries`). */
export const GALLERY_MODULE = "src/ui/gallery-derivation/index.ts";

/** The one barrel a screen's copy is read from (R-SPINE-060). */
export const STRINGS_MODULE = "src/ui/strings/index.ts";

/** The barrel id the gallery catalogues this pattern under (Decision §7). */
export const EVIDENCE_LINK_BARREL = "patterns/evidence-link";

/** A sample destination and a sample key, as the Decision's gallery data spells them (§3). */
export const SAMPLE_HREF = "/design";
export const SAMPLE_LABEL = "DXF_HANDLE:1A4";

/** A component of the product, as this stage mounts one. */
export type Mountable = (props: Record<string, unknown>) => unknown;

/** R-UI-002's seven bases and their glyphs, read from the product's own table (B-19). */
export async function basisGlyphs(): Promise<Record<string, string>> {
  const module = await productModule<Record<string, unknown>>(BASIS_MODULE);
  const table = module["BASIS_GLYPHS"];
  expect(table, `${BASIS_MODULE} publishes \`BASIS_GLYPHS\` — R-UI-002's single home`).toBeTypeOf("object");
  return table as Record<string, string>;
}

/** The pattern itself, by the export the interfaces name. */
export async function evidenceLink(): Promise<Mountable> {
  const module = await productModule<Record<string, unknown>>(EVIDENCE_LINK_MODULE);
  expect(typeof module["EvidenceLink"], `${EVIDENCE_LINK_MODULE} publishes \`EvidenceLink\` (interfaces, Decision §0)`).toBe("function");
  return module["EvidenceLink"] as Mountable;
}

/** The gallery's derivation surface, by the three names the test contract fixes. */
export interface GallerySeam {
  galleryBarrels: Record<string, Record<string, unknown>>;
  galleryEntries: Readonly<Record<string, { states: readonly { name: string; render: () => unknown }[] }>>;
  missingEntries: () => string[];
  componentExports: (ns: Record<string, unknown>) => string[];
}

export async function gallerySeam(): Promise<GallerySeam> {
  const module = await productModule<Record<string, unknown>>(GALLERY_MODULE);
  for (const name of ["galleryBarrels", "galleryEntries", "missingEntries", "componentExports"]) {
    expect(module[name], `${GALLERY_MODULE} publishes \`${name}\` (test contract)`).toBeDefined();
  }
  return module as unknown as GallerySeam;
}

/** The one string barrel, so no sentence below is transcribed beside its home (B-17). */
export async function stringTable(): Promise<Record<string, string>> {
  const module = await productModule<{ strings?: Record<string, string> }>(STRINGS_MODULE);
  expect(module.strings, `${STRINGS_MODULE} publishes \`strings\``).toBeTypeOf("object");
  return module.strings as Record<string, string>;
}

/**
 * Mount one link and hand back its anchor. `theme` stands the mount under a `[data-theme]` ancestor,
 * which is how the Decision asks the seven bases to be rendered in both themes (§7 Suites).
 */
export async function mountLink(props: Record<string, unknown>, theme: string | null = null): Promise<HTMLElement> {
  const component = await evidenceLink();
  const host = document.createElement("div");
  if (theme !== null) host.setAttribute("data-theme", theme);
  document.body.append(host);
  const { container } = render(createElement(component as unknown as FunctionComponent<typeof props>, props), { container: host });
  const anchor = container.querySelector(testIdSelector(TESTIDS.evidence.link));
  expect(anchor, "EvidenceLink renders its anchor `evidence-link` (test contract)").not.toBeNull();
  return anchor as HTMLElement;
}

/**
 * The pattern's authored stylesheet, asserted present before it is read — so a file the Builder has
 * not written yet fails as an assertion naming it rather than as an unreadable path.
 */
export function stylesheetText(relative: string = EVIDENCE_LINK_CSS): string {
  const abs = join(REPO_ROOT, relative);
  expect(existsSync(abs), `${relative} is missing from the checkout — the product does not provide it yet`).toBe(true);
  return readFileSync(abs, "utf8");
}

/** The text a node states, whitespace-normalised the way a reader sees it. */
export function text(node: Element | null): string {
  return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
}
