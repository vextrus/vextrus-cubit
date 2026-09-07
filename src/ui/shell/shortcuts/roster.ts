// R-UI-032's keys, in the one home every reader takes them from (B-17): the palette's shortcut
// rows, the `?` sheet and the frame's global key handler all read `SHORTCUTS`, so a documented key
// and a bound key cannot differ. Nothing else in the tree spells a key beside it.
//
// The roster says what a key IS — its steps, its scope, the words it is documented by and what kind
// of thing it does. It says nothing about addresses: a `go` entry names a `PROJECT_AREAS` key (or
// `projects` for the workspace's own home) and the app layer resolves it, because `src/ui` holds no
// address of a screen it does not own (ARCH-01).
import type { StringKey } from "../../strings";

/** Where a key works. The sheet renders one section per scope, in this order (shortcut-sheet I-146). */
export const SHORTCUT_SCOPES = ["global", "viewer", "table"] as const;

/** One of the three. The union is the tuple's, so a scope exists in exactly one place. */
export type ShortcutScope = (typeof SHORTCUT_SCOPES)[number];

/** What a key does, as a kind rather than as a function: the binding is its reader's (I-148). */
export type ShortcutAction = "open-palette" | "open-sheet" | "go" | "viewer" | "table";

/** One documented key. */
export interface Shortcut {
  /** The id the palette row and the sheet row are found by (`data-shortcut`). */
  readonly id: string;
  readonly scope: ShortcutScope;
  /**
   * The sequence that reaches it, a step at a time. A step is a `KeyboardEvent.key` as the browser
   * prints it, so no layout arithmetic happens anywhere; `Mod+k` is the one exception, and means
   * Meta or Control — whichever the machine has (I-149).
   */
  readonly keys: readonly string[];
  readonly label: StringKey;
  readonly action: ShortcutAction;
  /** For `go`: the `PROJECT_AREAS` key, or `projects` for the workspace's own home. */
  readonly target?: string;
}

/** How long a person has to finish a sequence before its first step is forgotten. */
export const CHORD_TIMEOUT_MS = 1000;

/** The chord step that means "the platform's own command key" — Meta or Control (I-149). */
const MOD = "Mod+";

/**
 * Every key R-UI-032 documents, in the order the sheet and the palette list them. Scopes are
 * contiguous, which is what lets the sheet's sections hold roster order inside each of them
 * (shortcut-sheet I-146).
 */
export const SHORTCUTS: readonly Shortcut[] = Object.freeze([
  { id: "palette", scope: "global", keys: ["Mod+k"], label: "shortcut_palette", action: "open-palette" },
  { id: "shortcut-sheet", scope: "global", keys: ["?"], label: "shortcut_shortcut_sheet", action: "open-sheet" },
  { id: "go-projects", scope: "global", keys: ["g", "p"], label: "shortcut_go_projects", action: "go", target: "projects" },
  { id: "go-drawings", scope: "global", keys: ["g", "d"], label: "shortcut_go_drawings", action: "go", target: "drawings" },
  { id: "go-takeoff", scope: "global", keys: ["g", "t"], label: "shortcut_go_takeoff", action: "go", target: "takeoff" },
  { id: "go-estimate", scope: "global", keys: ["g", "e"], label: "shortcut_go_estimate", action: "go", target: "estimate" },
  { id: "go-bid", scope: "global", keys: ["g", "b"], label: "shortcut_go_bid", action: "go", target: "bid" },
  { id: "viewer-select", scope: "viewer", keys: ["v"], label: "shortcut_viewer_select", action: "viewer" },
  { id: "viewer-pan", scope: "viewer", keys: ["h"], label: "shortcut_viewer_pan", action: "viewer" },
  { id: "viewer-measure", scope: "viewer", keys: ["m"], label: "shortcut_viewer_measure", action: "viewer" },
  { id: "viewer-count", scope: "viewer", keys: ["c"], label: "shortcut_viewer_count", action: "viewer" },
  { id: "viewer-linear", scope: "viewer", keys: ["l"], label: "shortcut_viewer_linear", action: "viewer" },
  { id: "viewer-area", scope: "viewer", keys: ["a"], label: "shortcut_viewer_area", action: "viewer" },
  { id: "viewer-snap", scope: "viewer", keys: ["s"], label: "shortcut_viewer_snap", action: "viewer" },
  { id: "viewer-fit", scope: "viewer", keys: ["f"], label: "shortcut_viewer_fit", action: "viewer" },
  { id: "viewer-escape", scope: "viewer", keys: ["Escape"], label: "shortcut_viewer_escape", action: "viewer" },
  { id: "table-move", scope: "table", keys: ["ArrowDown"], label: "shortcut_table_move", action: "table" },
  { id: "table-edit", scope: "table", keys: ["Enter"], label: "shortcut_table_edit", action: "table" },
  { id: "table-next", scope: "table", keys: ["Tab"], label: "shortcut_table_next", action: "table" },
]);

/**
 * The words a step is read by, for the eye and for reading aloud alike (I-149). They live here
 * rather than in a string table because they are the roster's own reading of its own steps — plain
 * English key names, not copy a screen composes.
 */
const STEP_WORD: Readonly<Record<string, string>> = Object.freeze({
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  ArrowDown: "Down arrow",
  ArrowUp: "Up arrow",
});

/** How a sequence's steps are joined, so a chord reads as one phrase and never wraps mid-key. */
const THEN = " then ";

/** The command key as each platform's own people name it. */
const APPLE_MOD = "⌘";
const OTHER_MOD = "Ctrl";

/**
 * Whether this machine is one whose people say ⌘. Read from the browser at draw time, which is why
 * a chord is only ever drawn after a gesture (command-palette I-140): a server cannot know it, and a
 * keycap painted at first paint would either hydrate differently or freeze one platform's form as a
 * lie for the other.
 */
function onApplePlatform(): boolean {
  const stated = globalThis.navigator as { platform?: string; userAgent?: string } | undefined;
  return /Mac|iPhone|iPad|iPod/.test(`${stated?.platform ?? ""} ${stated?.userAgent ?? ""}`);
}

/** One step, as a person reads it. */
function stepWord(step: string): string {
  if (step.startsWith(MOD)) {
    const held = step.slice(MOD.length);
    const modifier = onApplePlatform() ? APPLE_MOD : `${OTHER_MOD} `;
    return `${modifier}${stepWord(held)}`;
  }
  const named = STEP_WORD[step];
  if (named !== undefined) return named;
  return step.length === 1 ? step.toUpperCase() : step;
}

/**
 * The chord a shortcut is documented by — display only, never matching (I-149). The two answers are
 * kept apart on purpose: what a person is shown depends on the platform, and what the handler
 * accepts may not.
 */
export function chordOf(shortcut: Pick<Shortcut, "keys">): string {
  return shortcut.keys.map(stepWord).join(THEN);
}

/** What a key event carries, as much of it as matching reads. */
interface KeyPress {
  key?: unknown;
  metaKey?: unknown;
  ctrlKey?: unknown;
  altKey?: unknown;
}

/**
 * Whether a key event IS this step (I-149). `Mod+k` matches Meta or Control with `k` in either
 * case; a plain step matches `event.key` in either case with no Meta, Control or Alt held — Shift
 * is not read, because `?` is Shift+/ on most layouts and is still the `?` the browser printed.
 */
export function matchStep(event: unknown, step: string): boolean {
  const press = (typeof event === "object" && event !== null ? event : {}) as KeyPress;
  const key = typeof press.key === "string" ? press.key : "";
  if (step.startsWith(MOD)) {
    return (press.metaKey === true || press.ctrlKey === true) && key.toLowerCase() === step.slice(MOD.length).toLowerCase();
  }
  if (press.metaKey === true || press.ctrlKey === true || press.altKey === true) return false;
  return key.toLowerCase() === step.toLowerCase();
}

/** The entry a scope holds, in roster order — the sheet's sections and nothing else read it. */
export function shortcutsInScope(scope: ShortcutScope): readonly Shortcut[] {
  return SHORTCUTS.filter((entry) => entry.scope === scope);
}
