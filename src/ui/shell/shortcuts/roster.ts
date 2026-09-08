/**
 * R-UI-032's keys, in their one home (B-17, ARCH-02). The palette's shortcut rows, the `?` sheet and
 * the frame's global key handler all read `SHORTCUTS` and nothing else, so a key the product
 * documents and a key it binds cannot differ — there is no second list to drift from.
 *
 * A step is a `KeyboardEvent.key` as the browser prints it, so no layout arithmetic happens anywhere
 * (shortcut-sheet I-147). `Mod+k` is the one written form: it means Meta on an Apple machine and
 * Control everywhere else, and only `matchStep` decides what that matches. `chordOf` is display and
 * never matching (I-149) — the two are separate so a cap a person reads can be worded for reading
 * while the match stays exact.
 *
 * No `index.ts` stands beside this file on purpose: `src/ui/shell` is itself a gallery barrel, and a
 * second index under it would enter the barrel scan as one more surface owing entries.
 */
import type { StringKey } from "../../strings";

/** Where a key works. The order is the order the `?` sheet renders its sections in (I-146). */
export const SHORTCUT_SCOPES = ["global", "viewer", "table"] as const;

/** One of the three. The union is the tuple's, so a scope exists in exactly one place. */
export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number];

/** What a key does, in the vocabulary the readers of this roster act on. */
export type ShortcutAction = "open-palette" | "open-sheet" | "go" | "viewer" | "table";

/** One documented key: what it is called, where it works, what it does and what reaches it. */
export interface Shortcut {
  readonly id: string;
  readonly scope: ShortcutScope;
  /** A sequence; a step is a `KeyboardEvent.key`, and `Mod+k` means Meta or Control. */
  readonly keys: readonly string[];
  readonly label: StringKey;
  readonly action: ShortcutAction;
  /** For `go`: the `PROJECT_AREAS` key, or `projects` for the workspace's own home. */
  readonly target?: string;
}

/**
 * The keys R-UI-032 names, in the order the sheet and the palette list them. Scopes are contiguous
 * because the sheet's sections are drawn from `SHORTCUT_SCOPES` while its rows keep roster order:
 * an entry that broke the run would put a row under a heading that does not describe it.
 */
export const SHORTCUTS: readonly Shortcut[] = Object.freeze([
  { id: "palette", scope: "global", keys: Object.freeze(["Mod+k"]), label: "shortcut_palette", action: "open-palette" },
  { id: "shortcut-sheet", scope: "global", keys: Object.freeze(["?"]), label: "shortcut_shortcut_sheet", action: "open-sheet" },
  { id: "go-projects", scope: "global", keys: Object.freeze(["g", "p"]), label: "shortcut_go_projects", action: "go", target: "projects" },
  { id: "go-drawings", scope: "global", keys: Object.freeze(["g", "d"]), label: "shortcut_go_drawings", action: "go", target: "drawings" },
  { id: "go-takeoff", scope: "global", keys: Object.freeze(["g", "t"]), label: "shortcut_go_takeoff", action: "go", target: "takeoff" },
  { id: "go-estimate", scope: "global", keys: Object.freeze(["g", "e"]), label: "shortcut_go_estimate", action: "go", target: "estimate" },
  { id: "go-bid", scope: "global", keys: Object.freeze(["g", "b"]), label: "shortcut_go_bid", action: "go", target: "bid" },
  { id: "viewer-select", scope: "viewer", keys: Object.freeze(["v"]), label: "shortcut_viewer_select", action: "viewer" },
  { id: "viewer-pan", scope: "viewer", keys: Object.freeze(["h"]), label: "shortcut_viewer_pan", action: "viewer" },
  { id: "viewer-measure", scope: "viewer", keys: Object.freeze(["m"]), label: "shortcut_viewer_measure", action: "viewer" },
  { id: "viewer-count", scope: "viewer", keys: Object.freeze(["c"]), label: "shortcut_viewer_count", action: "viewer" },
  { id: "viewer-linear", scope: "viewer", keys: Object.freeze(["l"]), label: "shortcut_viewer_linear", action: "viewer" },
  { id: "viewer-area", scope: "viewer", keys: Object.freeze(["a"]), label: "shortcut_viewer_area", action: "viewer" },
  { id: "viewer-snap", scope: "viewer", keys: Object.freeze(["s"]), label: "shortcut_viewer_snap", action: "viewer" },
  { id: "viewer-fit", scope: "viewer", keys: Object.freeze(["f"]), label: "shortcut_viewer_fit", action: "viewer" },
  { id: "viewer-escape", scope: "viewer", keys: Object.freeze(["Escape"]), label: "shortcut_viewer_escape", action: "viewer" },
  { id: "table-move", scope: "table", keys: Object.freeze(["ArrowDown"]), label: "shortcut_table_move", action: "table" },
  { id: "table-edit", scope: "table", keys: Object.freeze(["Enter"]), label: "shortcut_table_edit", action: "table" },
  { id: "table-next", scope: "table", keys: Object.freeze(["Tab"]), label: "shortcut_table_next", action: "table" },
]);

/** How long a sequence's steps may be apart and still read as one chord (increment interfaces). */
export const CHORD_TIMEOUT_MS = 1000;

/** The written form of "this platform's command key", and the two ways it is drawn. */
const MOD_PREFIX = "mod+";
const APPLE_MOD = "⌘";
const OTHER_MOD = "Ctrl";

/** The separator a sequence's steps are read with — a non-breaking space so a chord never wraps. */
const THEN = "\u00a0then\u00a0";

/** Between this platform's modifier and the letter it is held with. */
const MOD_JOIN = "\u00a0";

/**
 * The keys whose printed `key` is not the word a person says. Every one of them is plain English:
 * the sheet is read aloud as often as it is scanned (shortcut-sheet I-149).
 */
const KEY_WORD: Readonly<Record<string, string>> = Object.freeze({
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  ArrowDown: "Down arrow",
  ArrowUp: "Up arrow",
  ArrowLeft: "Left arrow",
  ArrowRight: "Right arrow",
});

/** What a `KeyboardEvent` carries that a step is judged against — the fields, never the class. */
export interface ShortcutKeyEvent {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
}

/**
 * Whether this machine's command key is Meta. Read from the browser at call time rather than at
 * module load: the answer is the platform's, and a value frozen at import would survive a
 * server render into a client that disagrees with it (command-palette I-140).
 */
function onApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const said = `${(navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? ""} ${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`;
  return /mac|iphone|ipad|ipod/i.test(said);
}

/** The letter a `Mod+…` step is held with, or null for a step that names no modifier. */
function modifiedLetter(step: string): string | null {
  return step.toLowerCase().startsWith(MOD_PREFIX) ? step.slice(step.indexOf("+") + 1) : null;
}

/** One step, as a person reads it. */
function stepWord(step: string): string {
  const letter = modifiedLetter(step);
  if (letter !== null) {
    const drawn = stepWord(letter);
    return onApplePlatform() ? `${APPLE_MOD}${drawn}` : `${OTHER_MOD}${MOD_JOIN}${drawn}`;
  }
  const word = KEY_WORD[step];
  if (word !== undefined) return word;
  return step.length === 1 ? step.toUpperCase() : step;
}

/**
 * The display form of an entry's steps — and only of its steps: two entries with the same keys read
 * the same however they are named, which is what makes the sheet's cap the key it documents.
 */
export function chordOf(shortcut: Pick<Shortcut, "keys">): string {
  return shortcut.keys.map(stepWord).join(THEN);
}

/**
 * Whether an event is this step. `Mod+k` matches Meta or Control with the letter, case-insensitively;
 * a plain step matches the printed key with no Meta, Control or Alt held — Shift is not consulted,
 * because `?` is Shift+/ on most layouts and the printed key already says which character arrived.
 */
export function matchStep(event: ShortcutKeyEvent, step: string): boolean {
  const key = typeof event.key === "string" ? event.key : "";
  const letter = modifiedLetter(step);
  if (letter !== null) return (event.metaKey === true || event.ctrlKey === true) && key.toLowerCase() === letter.toLowerCase();
  if (event.metaKey === true || event.ctrlKey === true || event.altKey === true) return false;
  return key.toLowerCase() === step.toLowerCase();
}
