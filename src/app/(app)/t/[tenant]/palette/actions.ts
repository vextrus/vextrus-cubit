// The acts R-SPINE-050 names by name, and the one place their availability is read off (I-138). An
// act becomes reachable by gaining a `run` and nothing else changes — the palette never carries a
// list of "what is not built yet", it carries the acts and reads whether each one can be taken.
import type { StringKey } from "@/ui/strings";

/** One act the palette offers. `run` is null while no screen in this workspace can carry it out. */
export interface PaletteAction {
  /** The key the row is found under, and the key the option's id is built from. */
  readonly key: string;
  readonly label: StringKey;
  /** Why it cannot be taken today — read only when `run` is null (R-UI-020: never silent). */
  readonly reason: StringKey;
  readonly run: ((tenantId: string, projectId: string | null) => void) | null;
}

/**
 * The two acts the clause names. Both wait on the screens that carry them: scale is affirmed on a
 * sheet in the viewer, and a bill of quantities is exported from an estimate. They are shown in
 * place with that reason rather than hidden, because an act a person cannot find is an act they
 * cannot plan around (I-138).
 */
export const PALETTE_ACTIONS: readonly PaletteAction[] = Object.freeze([
  { key: "affirm-scale", label: "command_palette_action_affirm_scale", reason: "command_palette_reason_affirm_scale", run: null },
  { key: "export-boq", label: "command_palette_action_export_boq", reason: "command_palette_reason_export_boq", run: null },
]);
