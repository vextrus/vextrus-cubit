// @vitest-environment jsdom
/**
 * The Design Decision's canonical Tree state (§4: "selected: S-101 — Column layout") and the
 * branch of §3's roving-tabindex rule that governs it — "before any focus it is the selected item,
 * else the first". Both are unreachable unless a selection can be mounted, so this suite asserts
 * the prop that mounts it.
 *
 * The identities come from the support roster's single declaration (B-19); nothing here is spelled
 * a second time.
 */
import { afterEach, describe, expect, test } from "vitest";
import * as React from "react";
import {
  TESTIDS,
  TREE_DEFAULT_EXPANDED,
  TREE_ITEMS,
  TREE_SELECTED_ID,
  allTestId,
  loadBarrels,
  textOf,
} from "./support/primitives";
import { mount, unmountAll } from "./support/render";

afterEach(() => {
  unmountAll();
});

/** The label the roster's selected id carries, found in the fixture rather than transcribed. */
function labelOf(id: string): string {
  const walk = (items: typeof TREE_ITEMS): string | undefined => {
    for (const item of items) {
      if (item.id === id) return item.label;
      const hit = item.children ? walk(item.children) : undefined;
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
  const label = walk(TREE_ITEMS);
  expect(label, `the tree fixture declares no item \`${id}\``).toBeTruthy();
  return label as string;
}

describe("R-UI-012: the Tree's mounted selection", () => {
  test("defaultSelectedId renders the selected item and gives it the tab stop before any focus", async () => {
    const b = await loadBarrels();
    const Tree = b.data.Tree;
    expect(typeof Tree, "the data barrel does not export a component named `Tree`").toBe("function");

    mount(
      React.createElement(Tree as React.ComponentType<Record<string, unknown>>, {
        items: TREE_ITEMS,
        defaultExpandedIds: TREE_DEFAULT_EXPANDED,
        defaultSelectedId: TREE_SELECTED_ID,
      }),
    );

    const items = allTestId(document.body, TESTIDS.treeItem);
    const expected = labelOf(TREE_SELECTED_ID);
    const selected = items.filter((item) => item.getAttribute("aria-selected") === "true");

    expect(
      selected.map((item) => textOf(item)),
      "Design Decision §4: the canonical tree state mounts with its declared item selected",
    ).toEqual([expected]);
    expect(
      selected[0]?.getAttribute("tabindex"),
      'Design Decision §3: before any focus the tab stop is the selected item ("else the first")',
    ).toBe("0");
    expect(
      items.filter((item) => item.getAttribute("tabindex") === "0").length,
      "R-UI-012: a roving tabindex leaves exactly one item tabbable",
    ).toBe(1);
  });
});
