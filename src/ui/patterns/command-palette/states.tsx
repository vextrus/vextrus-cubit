// R-UI-050 for the two surfaces this pattern ships. The palette is not a route, so it declares no
// row in `src/ui/screen-states`; its declaration lives here, where the suite reflects over it
// (Decision §2, B-19), and every cell mounts the very components the running palette mounts — a
// second drawing of a state is a state that can drift from the one people see.
import type { ReactNode } from "react";
import { Skeleton } from "../../primitives/core";
import { SCREEN_STATE_TESTID, STATE_NAMES, type ScreenStateName } from "../../screen-states/contract";
import { REFUSAL_ENTRIES } from "../../screen-states/refusal-entries";
import { strings } from "../../strings";
import { PaletteBody, paletteRefusalOf, type PaletteGroup } from "./palette-body";
import { ShortcutSheetBody } from "./shortcut-sheet";
import type { PaletteRow } from "./types";

/** One state, as a mountable node — the shape `src/ui/screen-states` declares a state in. */
export interface PaletteState {
  readonly render: () => ReactNode;
}

/** The two rows this pattern rules, each total over R-UI-050's seven. */
export type PaletteStateRow = "command-palette" | "shortcut-sheet";

/** Sample rows, so a declared cell shows the surface with something in it rather than an outline. */
const SAMPLE_ROWS: readonly PaletteRow[] = [
  { key: "meghna", group: "navigate", kind: "project", label: "Meghna Bridge Approach", meta: "Meghna Works", href: "/t/t/p/p" },
  { key: "foundation", group: "navigate", kind: "sheet", label: "FOUNDATION PLAN", meta: "A-101", href: "/t/t/p/p/viewer/d/FOUNDATION%20PLAN" },
];

const SAMPLE_AREAS: readonly PaletteRow[] = [
  { key: "takeoff", group: "areas", kind: "area", label: "Takeoff", reason: strings.command_palette_reason_area_unbuilt },
];

const listed = (rows: readonly PaletteRow[]): readonly PaletteGroup[] => [
  { id: rows[0]?.group ?? "navigate", rows },
];

const LIST_ID = "cx-palette-declared-list";

/** The declaration's own root: the state's name is the attribute, so the two cannot drift apart. */
function shell(state: ScreenStateName, body: ReactNode): ReactNode {
  return (
    <div className="cx-screen-state" data-testid={SCREEN_STATE_TESTID} data-state={state}>
      {body}
    </div>
  );
}

/** The palette's seven, each rendering the body the running palette renders (Decision §2). */
const PALETTE_CELLS: Readonly<Record<ScreenStateName, () => ReactNode>> = {
  loading: () => <PaletteBody listId={LIST_ID} status="loading" groups={[]} />,
  empty: () => <PaletteBody listId={LIST_ID} status="empty" groups={[]} query="ashuganj" />,
  error: () => <PaletteBody listId={LIST_ID} status="idle" groups={[]} fault={{ reportId: "f-2f41c0", onRetry: () => undefined }} />,
  refusal: () => <PaletteBody listId={LIST_ID} status="refused" groups={[]} refusal={paletteRefusalOf(REFUSAL_ENTRIES.SIGNED_OUT.code)} />,
  // A refusal beside rows: the rows that were answered stand, and the card sits under them (I-142).
  partial: () => <PaletteBody listId={LIST_ID} status="idle" groups={listed(SAMPLE_ROWS)} refusal={paletteRefusalOf(REFUSAL_ENTRIES.WORKSPACE_PERMISSION_NOT_HELD.code)} />,
  offline: () => <PaletteBody listId={LIST_ID} status="idle" groups={listed(SAMPLE_AREAS)} offline />,
  "permission-denied": () => <PaletteBody listId={LIST_ID} status="refused" groups={[]} refusal={paletteRefusalOf(REFUSAL_ENTRIES.WORKSPACE_PERMISSION_NOT_HELD.code)} />,
};

/**
 * The sheet's seven. The sheet answers no seam: its content is the roster, which is code — so the
 * cells that belong to a seam say what is true of this surface instead of miming a wait it never
 * has, and the ones it does have render the sheet as it stands.
 */
const SHEET_CELLS: Readonly<Record<ScreenStateName, () => ReactNode>> = {
  loading: () => (
    <>
      <p role="status">{strings.state_loading_nothing_awaited}</p>
      <Skeleton className="cx-palette-bone" />
    </>
  ),
  empty: () => (
    <>
      <p role="note">{strings.state_empty_compiled_in}</p>
      <ShortcutSheetBody />
    </>
  ),
  error: () => <p role="note">{strings.state_empty_compiled_in}</p>,
  refusal: () => <p role="note">{strings.state_empty_compiled_in}</p>,
  partial: () => <ShortcutSheetBody />,
  offline: () => (
    <>
      <p role="status" className="cx-palette-notice">
        {strings.command_palette_offline}
      </p>
      <ShortcutSheetBody />
    </>
  ),
  "permission-denied": () => <p role="note">{strings.state_empty_compiled_in}</p>,
};

/** File a set of cells under their own names, each building its node afresh on every mount. */
function declare(cells: Readonly<Record<ScreenStateName, () => ReactNode>>): Readonly<Record<ScreenStateName, PaletteState>> {
  const declared: Partial<Record<ScreenStateName, PaletteState>> = {};
  for (const state of STATE_NAMES) declared[state] = { render: () => shell(state, cells[state]()) };
  return declared as Readonly<Record<ScreenStateName, PaletteState>>;
}

/** The enumerable declaration the suite walks (R-UI-050, B-19). */
export const COMMAND_PALETTE_STATES: Readonly<Record<PaletteStateRow, Readonly<Record<ScreenStateName, PaletteState>>>> = {
  "command-palette": declare(PALETTE_CELLS),
  "shortcut-sheet": declare(SHEET_CELLS),
};
