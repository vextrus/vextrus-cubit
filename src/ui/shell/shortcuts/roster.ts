// The ONE home of every R-UI-032 binding (B-17). The palette's global handler, the palette's
// shortcuts group and the ? sheet all read this roster and nothing else, so the keys the product
// documents and the keys it binds cannot drift apart: a binding is added by adding a line here, and
// the three surfaces grow with it.
//
// A binding is stated, not implemented, here. What a key DOES belongs to the surface that arms it —
// the viewer keeps its own hand-written bindings until inc-206 hands this roster down (ARCH-01
// forbids `src/modules` importing `src/ui`), and table navigation is DataTable's own increment. The
// roster lists them so the sheet documents the product's whole keyboard, which is what R-UI-032
// asks for; a row the palette cannot run says so in place rather than lying (I-138).
import type { StringKey } from "../../strings";

/** Where a binding applies: anywhere in the product, inside the viewer, or inside a table. */
export type ShortcutScope = "global" | "viewer" | "table";

/**
 * One binding. `keys` are the steps of a sequence in the order they are pressed — one step for a
 * chord (`"Mod+K"`), two for a go-to (`"G"`, then `"P"`). A step is spelled as the `KeyboardEvent`
 * key it is recognised from, optionally prefixed by `Mod+` (⌘ on an Apple keyboard, Ctrl elsewhere).
 */
export interface Shortcut {
  readonly id: string;
  readonly scope: ShortcutScope;
  readonly keys: readonly string[];
  /** The line of the one string table that names it (R-SPINE-060). */
  readonly label: StringKey;
}

/**
 * Every binding R-UI-032 names, in the order the ? sheet lists them: the global chords first, then
 * the viewer's tools, then table navigation. The order is the roster's own — the sheet and the
 * palette enumerate it rather than re-stating it (B-19).
 */
export const SHORTCUTS: readonly Shortcut[] = Object.freeze([
  { id: "palette", scope: "global", keys: ["Mod+K"], label: "shortcut_palette" },
  { id: "shortcut-sheet", scope: "global", keys: ["?"], label: "shortcut_shortcut_sheet" },
  { id: "go-projects", scope: "global", keys: ["G", "P"], label: "shortcut_go_projects" },
  { id: "go-drawings", scope: "global", keys: ["G", "D"], label: "shortcut_go_drawings" },
  { id: "go-takeoff", scope: "global", keys: ["G", "T"], label: "shortcut_go_takeoff" },
  { id: "go-estimate", scope: "global", keys: ["G", "E"], label: "shortcut_go_estimate" },
  { id: "go-bid", scope: "global", keys: ["G", "B"], label: "shortcut_go_bid" },
  { id: "viewer-select", scope: "viewer", keys: ["V"], label: "shortcut_viewer_select" },
  { id: "viewer-pan", scope: "viewer", keys: ["H"], label: "shortcut_viewer_pan" },
  { id: "viewer-measure", scope: "viewer", keys: ["M"], label: "shortcut_viewer_measure" },
  { id: "viewer-count", scope: "viewer", keys: ["C"], label: "shortcut_viewer_count" },
  { id: "viewer-linear", scope: "viewer", keys: ["L"], label: "shortcut_viewer_linear" },
  { id: "viewer-area", scope: "viewer", keys: ["A"], label: "shortcut_viewer_area" },
  { id: "viewer-snap", scope: "viewer", keys: ["S"], label: "shortcut_viewer_snap" },
  { id: "viewer-fit", scope: "viewer", keys: ["F"], label: "shortcut_viewer_fit" },
  { id: "viewer-escape", scope: "viewer", keys: ["Escape"], label: "shortcut_viewer_escape" },
  { id: "table-move", scope: "table", keys: ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"], label: "shortcut_table_move" },
  { id: "table-edit", scope: "table", keys: ["Enter"], label: "shortcut_table_edit" },
  { id: "table-next", scope: "table", keys: ["Tab"], label: "shortcut_table_next" },
]);

/**
 * How long a sequence's second step may take. Stated once here, so the handler that waits and any
 * test that drives a chord read the same window rather than transcribing a second one (B-19).
 */
export const CHORD_TIMEOUT_MS = 1000;

/** The scopes, in the order the ? sheet groups by — the roster's own order, derived from it. */
export const SHORTCUT_SCOPES: readonly ShortcutScope[] = Object.freeze(["global", "viewer", "table"]);

/** What each scope is called where the sheet groups by it (R-SPINE-060). */
export const SCOPE_LABEL: Readonly<Record<ShortcutScope, StringKey>> = Object.freeze({
  global: "shortcut_sheet_scope_global",
  viewer: "shortcut_sheet_scope_viewer",
  table: "shortcut_sheet_scope_table",
});

/**
 * The binding an id names. An id nobody bound is a mistake in the caller, not a silent `undefined`
 * that would render a row with no keys and no name.
 */
export function shortcutById(id: string): Shortcut {
  const found = SHORTCUTS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no shortcut is registered under "${id}" — SHORTCUTS is the one roster of bindings (R-UI-032)`);
  return found;
}

/** The parts of a keyboard event a binding is recognised from — no more of one than that. */
export interface ShortcutKeyEvent {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
}

/** The prefix that stands for ⌘ on an Apple keyboard and Ctrl everywhere else. */
const MOD = "Mod";

/**
 * Does this event press this step? The reading has one home, so the handler that arms a binding and
 * the sheet that documents it can never disagree about what a step means (B-17).
 *
 * `Shift` is admitted on a bare step rather than required: `?` is Shift+/ on most layouts and a
 * plain key on others, and a person pressing the character the roster names has pressed the step
 * whichever way their keyboard produces it. `Alt` is not: it composes other characters entirely.
 */
export function matchesStep(event: ShortcutKeyEvent, step: string): boolean {
  const parts = step.split("+");
  const key = parts[parts.length - 1] ?? "";
  const wantsMod = parts.slice(0, -1).includes(MOD);
  const holdsMod = event.metaKey === true || event.ctrlKey === true;
  if (event.altKey === true) return false;
  if (wantsMod !== holdsMod) return false;
  return event.key.toLowerCase() === key.toLowerCase();
}

/** The word a keycap draws for one step's part — a key's name is not always what a hand sees. */
const KEY_WORD: Readonly<Record<string, string>> = Object.freeze({
  escape: "Esc",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  enter: "Enter",
  tab: "Tab",
});

/** Whether this machine draws ⌘ for the modifier the roster spells `Mod`. */
function onApple(): boolean {
  if (typeof navigator === "undefined") return false;
  const stated = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /mac|iphone|ipad|ipod/i.test(stated);
}

/** The word one part of a step is drawn as. */
function wordFor(part: string): string {
  if (part === MOD) return onApple() ? "⌘" : "Ctrl";
  const known = KEY_WORD[part.toLowerCase()];
  if (known !== undefined) return known;
  return part.length === 1 ? part.toUpperCase() : part;
}

/**
 * The keycaps a binding is drawn as, one word per cap: a chord's modifier and key are two caps, a
 * sequence's steps are one cap each. The sheet and the palette both draw exactly these, so a
 * binding's keys are counted from the roster and never from a transcription (B-19).
 */
export function keyWords(entry: Shortcut): readonly string[] {
  return entry.keys.flatMap((step) => step.split("+").map(wordFor));
}

/** The same words as one line, for a tooltip or a single keycap. */
export function chordOf(entry: Shortcut): string {
  return keyWords(entry).join(" ");
}

/**
 * Is the keyboard's focus in a place where a letter is text? A global binding other than ⌘K and
 * Escape is ignored there: typing `g` into a name is typing, never a move (Decision §1).
 */
export function isTextField(target: EventTarget | null): boolean {
  if (target === null || typeof target !== "object" || !("tagName" in target)) return false;
  const element = target as HTMLElement;
  const tag = String(element.tagName).toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return element.isContentEditable === true;
}
