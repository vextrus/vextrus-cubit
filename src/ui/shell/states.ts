// R-UI-050's matrix for the shell's screens, in the one enumerable place the suite reflects over
// (B-19). The clause is explicit that the matrix is checkable rather than aspirational: a state a
// screen never declares is a failing test, never a review note — so prose in the Design Decision
// cannot be where it lives. docs/design/shell.md §2 rules each cell; this is that ruling in a form
// a test can walk, and tests/ui/shell/state-matrix.test.ts is what walks it.
//
// A cell says one of three things and is never silent: the state is rendered here, it is handed to
// a module outside this screen, or it cannot arise on this screen and says why. "Impossible" is a
// claim with a reason attached, which is what makes it reviewable.
import { STATE_NAMES } from "../screen-states/contract";
import type { ScreenStateName } from "../screen-states/contract";
import type { ShellArea } from "./routes";

/** The clause's kebab name in the key form an object is keyed by — the type half of the converter. */
type KeyForm<Name extends string> = Name extends `${infer Head}-${infer Tail}` ? `${Head}${Capitalize<KeyForm<Tail>>}` : Name;

/**
 * The seven states R-UI-050 names, in the shell matrix's key form. The names themselves have one
 * home — `STATE_NAMES` in `../screen-states/contract` — and this type is derived from it, so a state
 * the clause names can never be spelled a second time here to drift (B-17, B-19).
 */
export type ShellStateName = KeyForm<ScreenStateName>;

/**
 * The one converter from a clause name to the key the matrix files it under: the segments after the
 * first are capitalised and joined, so a name carrying no separator keeps its spelling exactly.
 */
export function shellStateKey(name: ScreenStateName): ShellStateName {
  const [head = "", ...rest] = name.split("-");
  return [head, ...rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)].join("") as ShellStateName;
}

/** R-UI-050's roster in the shell's key form, in the clause's own order (B-19). */
export const SHELL_STATE_NAMES: readonly ShellStateName[] = STATE_NAMES.map(shellStateKey);

/** What a screen declares about one state. */
export type ShellStateCell =
  | {
      readonly declared: "rendered";
      /** The module that paints it, repo-relative. */
      readonly by: string;
      /** The hook a journey reads it at, or null for a state with no testid in the contract. */
      readonly testId: string | null;
    }
  | {
      readonly declared: "delegated";
      /** The module that owns the state instead, repo-relative. */
      readonly to: string;
      readonly why: string;
    }
  | { readonly declared: "impossible"; readonly why: string };

/** Every state of every shipped shell screen. Keyed by area, so a new area must declare its own. */
export type ShellStateMatrix = Readonly<Record<ShellArea, Readonly<Record<ShellStateName, ShellStateCell>>>>;

const LOADING: ShellStateCell = {
  declared: "rendered",
  by: "src/app/(app)/t/[tenant]/loading.tsx",
  // Bones, hidden from the accessibility tree by the primitive: nothing for a journey to read.
  testId: null,
};

const ERROR: ShellStateCell = {
  declared: "delegated",
  to: "src/app/error.tsx",
  why: "the root error boundary is the tree's one error state, and its own Decision rules retry and the report id",
};

const OFFLINE: ShellStateCell = {
  declared: "delegated",
  to: "src/app/error.tsx",
  why: "I-20: the shell's pages are server-rendered and hold no data that can age, so unreachability surfaces as the error state — never an invented banner",
};

const PERMISSION_DENIED: ShellStateCell = {
  declared: "rendered",
  by: "src/ui/shell/shell-denied.tsx",
  testId: "shell-permission-denied",
};

const PARTIAL: ShellStateCell = {
  declared: "impossible",
  why: "no shell screen renders rows that can be refused one by one",
};

const EMPTY_STATE: ShellStateCell = {
  declared: "rendered",
  by: "src/ui/shell/shell-empty-state.tsx",
  testId: "shell-empty",
};

export const SHELL_STATES: ShellStateMatrix = {
  projects: {
    loading: LOADING,
    empty: EMPTY_STATE,
    error: ERROR,
    refusal: {
      declared: "impossible",
      why: "the Projects home asks for nothing refusable: the SAMPLE offer's unavailable answer is a notice, deliberately not a refusal",
    },
    partial: PARTIAL,
    offline: OFFLINE,
    permissionDenied: PERMISSION_DENIED,
  },
  books: {
    loading: LOADING,
    empty: EMPTY_STATE,
    error: ERROR,
    refusal: { declared: "impossible", why: "the Books shell requests nothing refusable: it renders its honest empty state and no data" },
    partial: PARTIAL,
    offline: OFFLINE,
    permissionDenied: PERMISSION_DENIED,
  },
  settings: {
    loading: LOADING,
    empty: { declared: "impossible", why: "a workspace always has a name, so Settings has nothing to be empty of" },
    error: ERROR,
    refusal: { declared: "rendered", by: "src/app/(app)/t/[tenant]/settings/rename-form.tsx", testId: "shell-rename-refusal" },
    partial: PARTIAL,
    offline: OFFLINE,
    permissionDenied: PERMISSION_DENIED,
  },
};
