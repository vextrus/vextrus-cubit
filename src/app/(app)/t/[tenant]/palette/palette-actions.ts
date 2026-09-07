// The two acts R-SPINE-050 names by name, and where each of them will be run from. Neither has a
// screen in this workspace today, so both are listed with the reason in place rather than hidden:
// a person who has been told the palette runs actions is owed the two the clause promises, and an
// action that vanished until it worked would teach them the product has fewer parts than it has
// (command-palette I-138, R-UI-020).
//
// Availability is read off `run`, never written beside the row: the day the viewer affirms a scale
// and an estimate exports a bill, each becomes reachable by gaining a function and nothing else
// changes — the `PROJECT_AREAS` law, in the same shape (I-126).
import type { StringKey } from "@/ui/strings";

/** One act the palette offers. */
export interface PaletteAction {
  /** The key its row is found under, and the tail of its option id. */
  readonly key: string;
  readonly label: StringKey;
  /** Why it cannot be run in this workspace yet — shown on the row itself (I-138). */
  readonly reason: StringKey;
  /** What running it does, or `null` for an act with no screen behind it on this tree. */
  readonly run: ((tenantId: string, projectId: string | null) => void) | null;
}

export const PALETTE_ACTIONS: readonly PaletteAction[] = Object.freeze([
  {
    key: "affirm-scale",
    label: "command_palette_action_affirm_scale",
    reason: "command_palette_unavailable",
    run: null,
  },
  {
    key: "export-boq",
    label: "command_palette_action_export_boq",
    reason: "command_palette_unavailable",
    run: null,
  },
]);
