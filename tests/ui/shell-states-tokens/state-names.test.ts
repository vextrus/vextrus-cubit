/**
 * AC-1 — R-UI-050's seven state names have ONE spelling in `src/ui` (B-17, debt-src-ui-18hk5dz).
 *
 * The clause's names live in `src/ui/screen-states/contract.ts`; the shell's matrix keys on a
 * lowerCamel form of the same seven. The rule graded here is that the second form is DERIVED from
 * the first through one exported converter, never re-typed: every expectation below is computed
 * from `STATE_NAMES` as this file reads it out of the product (B-19), so a seventh name added to
 * the clause tomorrow is graded by the same sentences without an edit here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { REPO_ROOT, productModule } from "../../server/support/wire";
import { lex } from "./support/source-text";
import type { ScreenStateName } from "../../../src/ui/screen-states/contract";
import type { ShellStateName } from "../../../src/ui/shell/states";

const CONTRACT_MODULE = "src/ui/screen-states/contract.ts";
const STATES_MODULE = "src/ui/shell/states.ts";
const ROUTES_MODULE = "src/ui/shell/routes.ts";

interface ContractModule {
  STATE_NAMES: readonly string[];
}

interface StatesModule {
  shellStateKey?: unknown;
  SHELL_STATE_NAMES?: unknown;
  SHELL_STATES?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

interface RoutesModule {
  SHELL_AREAS: readonly string[];
}

/**
 * The shell's key form of a clause name, as the criterion states the rule: the kebab segments after
 * the first are capitalised and joined, so a name with no `-` in it keeps its spelling exactly.
 * Computed here so the product's converter is compared with the rule rather than with itself.
 */
function keyForm(name: string): string {
  const [head, ...rest] = name.split("-");
  return [head ?? "", ...rest.map((part) => (part === "" ? "" : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))].join("");
}

/**
 * AC-1(c): the shell's name type is DERIVED from the clause's, not a hand-typed union — stated to
 * the compiler, which is the only place a type derivation can be observed. `tests/**\/*.ts` is in
 * the typecheck's include, so this is graded by `tsc`.
 */
type Camel<S extends string> = S extends `${infer Head}-${infer Tail}` ? `${Head}${Capitalize<Camel<Tail>>}` : S;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
export type ShellStateNameIsDerived = Equal<ShellStateName, Camel<ScreenStateName>> extends true ? true : never;
export const shellStateNameIsDerived: ShellStateNameIsDerived = true;

const sourceOf = (relative: string): string => readFileSync(join(REPO_ROOT, relative), "utf8");

describe("AC-1: the shell derives R-UI-050's names from the clause's one home", () => {
  test("AC-1(a): shellStateKey is the one converter from the clause's name to the shell's key", async () => {
    const { STATE_NAMES } = await productModule<ContractModule>(CONTRACT_MODULE);
    const states = await productModule<StatesModule>(STATES_MODULE);
    expect(typeof states.shellStateKey, `${STATES_MODULE} exports shellStateKey`).toBe("function");
    const shellStateKey = states.shellStateKey as (name: string) => string;

    expect(STATE_NAMES.length, "the clause names states to convert").toBeGreaterThan(0);
    for (const name of STATE_NAMES) {
      expect(shellStateKey(name), `${name} converts to the shell's key form`).toBe(keyForm(name));
    }
    // The converter changes the form of exactly the names that carry a separator, and no others.
    const changed = STATE_NAMES.filter((name) => shellStateKey(name) !== name);
    expect(changed).toEqual(STATE_NAMES.filter((name) => name.includes("-")));
  });

  test("AC-1(b): SHELL_STATE_NAMES is the clause's roster, in the clause's order, in the key form", async () => {
    const { STATE_NAMES } = await productModule<ContractModule>(CONTRACT_MODULE);
    const states = await productModule<StatesModule>(STATES_MODULE);
    expect(states.SHELL_STATE_NAMES, `${STATES_MODULE} exports SHELL_STATE_NAMES`).toBeDefined();
    expect([...(states.SHELL_STATE_NAMES as readonly string[])]).toEqual(STATE_NAMES.map(keyForm));
  });

  test("AC-1(d): states.ts spells none of the seven names as a string literal of its own", async () => {
    const { STATE_NAMES } = await productModule<ContractModule>(CONTRACT_MODULE);
    const spellings = new Set<string>([...STATE_NAMES, ...STATE_NAMES.map(keyForm)]);
    const { strings } = lex(sourceOf(STATES_MODULE), "ts");
    const spelled = strings.filter((literal) => spellings.has(literal.trim()));
    expect(spelled, `${STATES_MODULE} names a state as its own literal instead of deriving it`).toEqual([]);
  });

  test("AC-1(d): states.ts takes the roster from the contract that owns it", async () => {
    const { code } = lex(sourceOf(STATES_MODULE), "ts");
    expect(code, `${STATES_MODULE} imports STATE_NAMES rather than restating it`).toMatch(/import[\s\S]*?\bSTATE_NAMES\b[\s\S]*?from/);
    const { strings } = lex(sourceOf(STATES_MODULE), "ts");
    expect(strings.some((literal) => literal.includes("screen-states/contract")), `${STATES_MODULE} imports from the contract module`).toBe(true);
  });

  test("AC-1(e): every area's cells are keyed by exactly the shell's state names", async () => {
    const states = await productModule<StatesModule>(STATES_MODULE);
    const { SHELL_AREAS } = await productModule<RoutesModule>(ROUTES_MODULE);
    const expected = [...(states.SHELL_STATE_NAMES as readonly string[])].sort();
    const matrix = states.SHELL_STATES;
    expect(matrix, `${STATES_MODULE} exports SHELL_STATES`).toBeDefined();

    expect(SHELL_AREAS.length, "there is an area to grade").toBeGreaterThan(0);
    for (const area of SHELL_AREAS) {
      const cells = (matrix ?? {})[area];
      expect(cells, `${area} declares its states`).toBeDefined();
      expect(Object.keys(cells ?? {}).sort(), `${area}'s cells are keyed by the shell's state names`).toEqual(expected);
    }
  });
});
