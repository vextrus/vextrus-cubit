// @vitest-environment jsdom
/**
 * AC-1 — the two barrels, the roster derived from them, and axe in both document-root themes
 * (R-UI-010, R-UI-011, R-UI-012, B-19, Q-11).
 *
 * The completeness surface is REFLECTED, never transcribed: the roster of canonical states is
 * checked against `Object.keys` of each barrel, in both directions. A primitive added to a barrel
 * by a later increment fails here until its canonical state joins the roster — which is the rule
 * B-19 asks for, not a frozen inventory. The interfaces line's own names are asserted separately
 * as a floor, because those the increment promises outright.
 *
 * No JSX is written here: elements are built through `React.createElement` in the support module,
 * so this file needs nothing of the transform beyond TypeScript.
 */
import { afterEach, describe, expect, test } from "vitest";
import { waitFor } from "@testing-library/react";
import type { Barrels } from "./support/primitives";
import {
  DATA_BARREL,
  OVERLAY_BARREL,
  ROSTER,
  describeViolations,
  exportNames,
  keyboardUser,
  loadBarrels,
  seriousOrCritical,
} from "./support/primitives";
import type { ThemeName } from "./support/render";
import { THEMES, mount, unmountAll } from "./support/render";

/**
 * The interfaces line's promised surface — the floor each barrel must clear. This is not the
 * completeness check (that is derived from the barrels below); it is the increment's own word.
 */
const PROMISED_OVERLAY_EXPORTS = [
  "Dialog",
  "DialogTrigger",
  "DialogContent",
  "DialogTitle",
  "DialogClose",
  "Sheet",
  "SheetTrigger",
  "SheetContent",
  "Popover",
  "PopoverTrigger",
  "PopoverContent",
  "DropdownMenu",
  "DropdownMenuTrigger",
  "DropdownMenuContent",
  "DropdownMenuItem",
  "ContextMenu",
  "ContextMenuTrigger",
  "ContextMenuContent",
  "ContextMenuItem",
  "Toaster",
  "toast",
] as const;

const PROMISED_DATA_EXPORTS = [
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Tree",
  "ScrollArea",
  "ResizablePanelGroup",
  "ResizablePanel",
  "ResizableHandle",
  "DataTable",
] as const;

afterEach(() => {
  unmountAll();
});

describe("AC-1: the overlay and data barrels", () => {
  test("AC-1: the overlay barrel exports every part the interfaces line promises, callable", async () => {
    const mod = await loadBarrels().then((b) => b.overlay);
    const missing = PROMISED_OVERLAY_EXPORTS.filter((name) => typeof mod[name] !== "function");
    expect(
      missing,
      `${OVERLAY_BARREL} must export each of these as a component (and \`toast\` as a function) — R-UI-010's overlay set`,
    ).toEqual([]);
  });

  test("AC-1: the data barrel exports every part the interfaces line promises, callable", async () => {
    const mod = await loadBarrels().then((b) => b.data);
    const missing = PROMISED_DATA_EXPORTS.filter((name) => typeof mod[name] !== "function");
    expect(
      missing,
      `${DATA_BARREL} must export each of these as a component — R-UI-010's data set`,
    ).toEqual([]);
  });

  test("AC-1: every export of both barrels has exactly one canonical state in the roster", async () => {
    const b = await loadBarrels();
    const declared = new Map<string, string[]>();
    for (const entry of ROSTER) {
      for (const name of entry.covers) {
        declared.set(name, [...(declared.get(name) ?? []), entry.id]);
      }
    }

    const uncovered: string[] = [];
    for (const [barrel, mod] of [
      [OVERLAY_BARREL, b.overlay],
      [DATA_BARREL, b.data],
    ] as const) {
      for (const name of exportNames(mod)) {
        if (!declared.has(name)) uncovered.push(`${barrel} → ${name}`);
      }
    }
    expect(
      uncovered,
      "R-UI-011/B-19: the roster is derived from the barrels, so every export a barrel offers owes one canonical mounted/open state in tests/ui/primitives-overlay-data/support/primitives.tsx — add the state, never a list of exceptions",
    ).toEqual([]);

    const duplicated = [...declared.entries()].filter(([, cases]) => cases.length > 1);
    expect(
      duplicated.map(([name, cases]) => `${name}: ${cases.join(", ")}`),
      "each export is declared exactly once — a second canonical state is a second source of truth",
    ).toEqual([]);
  });

  test("AC-1: the roster names no export the barrels do not offer", async () => {
    const b = await loadBarrels();
    const offered = new Set([...exportNames(b.overlay), ...exportNames(b.data)]);
    const stray = ROSTER.flatMap((entry) =>
      entry.covers.filter((name) => !offered.has(name)).map((name) => `${entry.id} → ${name}`),
    );
    expect(stray, "a roster case names an export neither barrel exports").toEqual([]);
  });
});

describe("AC-1: axe reports zero serious and zero critical in both document-root themes", () => {
  // The barrels are loaded INSIDE each case, not in a beforeAll: a hook that throws marks its
  // whole block skipped, and a skipped case judges nothing (gen-3 lesson).
  for (const entry of ROSTER) {
    for (const theme of THEMES) {
      test(`AC-1: ${entry.id} under data-theme="${theme}"`, async () => {
        const criterion = `AC-1 axe — ${entry.id} (${theme})`;
        const barrels: Barrels = await loadBarrels();
        const container = mount(entry.element(barrels), theme as ThemeName);
        expect(container.childElementCount, `${entry.id} rendered nothing`).toBeGreaterThan(0);

        if (entry.open) {
          const user = await keyboardUser(criterion);
          await entry.open(barrels, user);
        }
        if (entry.openedTestId) {
          const id = entry.openedTestId;
          await waitFor(() => {
            expect(
              document.body.querySelector(`[data-testid="${id}"]`),
              `${entry.id}: the declared opening gesture did not bring [data-testid="${id}"] into the document`,
            ).toBeTruthy();
          });
        }
        if (entry.openedText) {
          const text = entry.openedText;
          await waitFor(() => {
            expect(document.body.textContent ?? "", `${entry.id}: the opened state never showed \`${text}\``).toContain(text);
          });
        }

        // The whole document, not just the container: every overlay this increment ships portals to
        // document.body, and an unexamined portal is the half of the set most likely to be unnamed.
        const violations = await seriousOrCritical(document.body, criterion);
        expect(
          violations.length,
          `Q-11: zero serious/critical for ${entry.id} under data-theme="${theme}" — the gate is exactly those two impacts\n${describeViolations(violations)}`,
        ).toBe(0);
      });
    }
  }
});
