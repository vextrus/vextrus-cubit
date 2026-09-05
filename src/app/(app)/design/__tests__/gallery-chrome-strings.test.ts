// @vitest-environment jsdom
/**
 * The gallery's two sentences come from the one string table, like every other sentence a person
 * reads (R-SPINE-060, B-17).
 *
 * The page used to reach past the derivation's barrel into an internal module for them, and that
 * module authored the copy itself: a second table, of two entries, that nothing enumerating the
 * product's copy would ever find. The keys are now registry entries and the derivation reads the
 * same two, so the words on the screen and the words in the table cannot come apart.
 *
 * `.ts` rather than `.tsx`: tsconfig includes `src/**\/*.ts`, so `tsc` reads this file too, and the
 * page is built with `createElement`.
 */
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { galleryChrome } from "../../../../ui/gallery-derivation/chrome";
import { strings } from "../../../../ui/strings";
import DesignGalleryPage from "../page";

afterEach(() => {
  cleanup();
});

test("the gallery's chrome reads the registry, rather than authoring copy beside the derivation", () => {
  expect(galleryChrome.heading, "the derivation's heading is the registered key").toBe(strings.design_gallery_heading);
  expect(galleryChrome.caption, "and so is its caption").toBe(strings.design_gallery_caption);
});

test("the page shows the registered sentences", () => {
  render(createElement(DesignGalleryPage));

  const shell = screen.getByTestId("gallery-shell");
  expect(shell.textContent, "the heading a person reads is the table's").toContain(strings.design_gallery_heading);
  expect(shell.textContent, "and so is the caption under it").toContain(strings.design_gallery_caption);
});
